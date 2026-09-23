import test from "node:test";
import assert from "node:assert/strict";
import { DISTRICTS, INDICATORS, MEASURES } from "./data";
import { simulate, validatePlan } from "./engine";
import { PROMISES, runMods } from "./mods";
import { buildSocialFeed, hashSeed, rng } from "./social";
import type { SocialPost } from "./social";
import type { Choice, DistrictId, MeasureId } from "./types";

const c = (measureId: MeasureId, districtId: DistrictId | null = null): Choice => ({ measureId, districtId });
const example = [c("M7", "nura"), c("M8", "nura"), c("M10", "nura"), c("M12"), c("M5", "saryarka")];
const broken = example.map((choice) => choice.measureId === "M7" ? c("M7", "esil") : choice);
const forgotten = [c("M9", "baikonur"), c("M11", "almaty"), c("M10", "baikonur"), c("M12"), c("M4", "baikonur")];
const allOn = { emergencies: true, anger: true, promises: true };
const allOff = { emergencies: false, anger: false, promises: false };
const inputs = (plan = example, seed = "social-case", flags = allOn, responses: Record<string, string> = {}, promiseIds = ["schools-nura"]) => {
  const result = simulate(plan);
  return { plan, result, mods: runMods(result, plan, flags, responses, promiseIds), seed };
};
const find = (feed: SocialPost[], id: string) => {
  const post = feed.find((entry) => entry.id === id);
  assert.ok(post, `Missing post: ${id}`);
  return post;
};
const engagement = (post: SocialPost) => post.likes + post.dislikes + post.reposts;
const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} ≠ ${expected}`);

test("Social: same inputs are deterministic, while seeds can change sentiments", () => {
  const args = inputs();
  const feed = buildSocialFeed(args);
  assert.deepEqual(buildSocialFeed(args), feed);
  assert.deepEqual(buildSocialFeed({ ...args, plan: [...args.plan].reverse() }), feed);
  const sentiments = new Set(Array.from({ length: 20 }, (_, i) => {
    const posts = buildSocialFeed({ ...args, seed: `seed-${i}` });
    return JSON.stringify(posts.map(({ id, sentiment }) => ({ id, sentiment })).sort((a, b) => a.id.localeCompare(b.id)));
  }));
  assert.ok(sentiments.size > 1);
});

test("Social: hash and random generator are stable unsigned, bounded primitives", () => {
  assert.equal(hashSeed(""), 0x811c9dc5);
  assert.equal(hashSeed("hello"), 0x4f9f2cab);
  assert.equal(hashSeed("Нура"), hashSeed("Нура"));
  for (const seed of [0, -1, 0xffffffff, hashSeed("Нура")]) {
    const first = rng(seed), second = rng(seed);
    const values = Array.from({ length: 1000 }, () => first());
    assert.deepEqual(values, Array.from({ length: 1000 }, () => second()));
    assert.ok(values.every((value) => value >= 0 && value < 1));
    assert.ok(new Set(values).size > 1);
  }
});

test("Social: schools-nura promise has exact kept and broken probabilities", () => {
  for (const [plan, kept, chance] of [[broken, false, 0.12], [example, true, 0.8]] as const) {
    assert.deepEqual(validatePlan(plan), []);
    const args = inputs(plan);
    assert.equal(args.mods.promises?.[0].kept, kept);
    const post = find(buildSocialFeed(args), "promise:schools-nura");
    assert.equal(post.supportChance, chance);
    assert.equal(post.districtId, "nura");
    assert.ok(post.facts.includes(args.mods.promises![0].proof));
    assert.ok(post.text.includes(kept ? "выполнено" : "не выполнено"));
  }
  assert.equal(simulate(broken).indicators.nura.S1, 38);
});

test("Social: emergency probabilities follow none, full and partial responses", () => {
  const args = inputs(example, "responses", allOn, {
    "flood-nura": "none", "heating-almaty": "full", "smog-saryarka": "care",
  });
  const feed = buildSocialFeed(args);
  for (const [id, chance] of [["flood-nura", 0.15], ["heating-almaty", 0.75], ["smog-saryarka", 0.45]] as const) {
    const post = find(feed, `event:${id}`);
    const outcome = args.mods.emergencies!.find(({ event }) => event.id === id)!;
    assert.equal(post.supportChance, chance);
    assert.equal(post.districtId, outcome.event.districtId);
    assert.ok(post.facts.includes(outcome.event.title));
    assert.ok(post.facts.some((fact) => fact.includes(outcome.response.title)));
  }
});

test("Social: weakest district is forgotten only without an addressed district measure", () => {
  for (const plan of [forgotten, example]) {
    assert.deepEqual(validatePlan(plan), []);
    const args = inputs(plan, "forgotten", allOff);
    const feed = buildSocialFeed(args);
    assert.equal(args.result.weakestDistrict, "nura");
    if (plan === forgotten) {
      const post = find(feed, "forgotten:nura");
      assert.equal(post.supportChance, 0.2);
      assert.equal(post.districtId, args.result.weakestDistrict);
    } else {
      assert.ok(feed.every((post) => post.kind !== "forgotten"));
    }
  }
});

test("Social: measure probabilities include gains, critical fixes, lag and anger", () => {
  const off = buildSocialFeed(inputs(example, "formula", allOff));
  assert.equal(off.filter((post) => post.kind === "measure").length, 5);
  // Saryarka gains 1.65 points, fixes no critical indicators, and M5 has a long lag.
  close(find(off, "measure:M5").supportChance, 0.499);
  // Nura fixes both critical indicators; support is capped after the lag penalty.
  assert.equal(find(off, "measure:M7").supportChance, 0.95);
  const anger = buildSocialFeed(inputs(example, "formula", { ...allOff, anger: true }));
  close(find(anger, "measure:M7").supportChance, 0.91095);
  assert.ok(find(anger, "measure:M5").supportChance < find(off, "measure:M5").supportChance);
});

test("Social: city measures post from the district with the largest official gain", () => {
  const args = inputs(example, "city", allOff);
  const feed = buildSocialFeed(args);
  assert.equal(find(feed, "measure:M12").districtId, "nura");
  for (const choice of example.filter((choice) => choice.districtId !== null)) {
    assert.equal(find(feed, `measure:${choice.measureId}`).districtId, choice.districtId);
  }
  const post = find(feed, "measure:M8");
  assert.ok(post.facts[0].includes(MEASURES.M8.title));
  assert.ok(post.facts[0].includes(DISTRICTS.nura.name));
  assert.equal(post.facts[1], `${INDICATORS.B1.name}, Нура: 55 → 67,5`);
});

test("Social: adding a promise leaves other posts unchanged when anger is off", () => {
  const flags = { ...allOff, promises: true };
  const before = buildSocialFeed(inputs(example, "independent", flags, {}, []));
  const after = buildSocialFeed(inputs(example, "independent", flags, {}, ["schools-nura"]));
  assert.equal(after.length, before.length + 1);
  for (const post of before) assert.deepEqual(find(after, post.id), post);
});

test("Social: mods can each be independently disabled", () => {
  for (const flags of [allOff, { ...allOff, anger: true }, { ...allOff, emergencies: true }, { ...allOff, promises: true }]) {
    const feed = buildSocialFeed(inputs(example, "toggles", flags));
    assert.equal(feed.filter((post) => post.kind === "event").length, flags.emergencies ? 3 : 0);
    assert.equal(feed.filter((post) => post.kind === "promise").length, flags.promises ? 1 : 0);
    assert.equal(feed.filter((post) => post.kind === "measure").length, 5);
  }
});

test("Social: city-wide numeric promises keep numbers in facts, never in text", () => {
  const feed = buildSocialFeed(inputs(example, "reserve", { ...allOff, promises: true }, {}, ["reserve"]));
  const post = find(feed, "promise:reserve");
  assert.equal(post.districtId, null);
  assert.ok(post.handle.endsWith("_city"));
  assert.ok(post.facts.some((fact) => fact.includes("15")));
  assert.ok(post.text.includes("резерв"));
  assert.ok(post.text.includes("Весь город"));
  assert.doesNotMatch(post.text, /\d/);
});

test("Social: bounded probabilities, integer engagement, factual copy and sorted top nine", () => {
  const authors = new Set<string>();
  for (const plan of [example, broken, forgotten]) for (let i = 0; i < 40; i++) {
    const feed = buildSocialFeed(inputs(plan, `invariants-${i}`, allOn, {}, PROMISES.map(({ id }) => id)));
    assert.equal(feed.length, 9);
    assert.equal(new Set(feed.map(({ id }) => id)).size, feed.length);
    feed.forEach((post, index) => {
      assert.ok(post.supportChance >= 0.05 && post.supportChance <= 0.95);
      for (const count of [post.likes, post.dislikes, post.reposts]) assert.ok(Number.isInteger(count) && count >= 0);
      assert.doesNotMatch(post.text, /\d/);
      assert.ok(post.text.includes(post.districtId === null ? "Весь город" : DISTRICTS[post.districtId].name));
      assert.ok(post.facts.length >= 1 && post.facts.length <= 3);
      assert.ok(post.facts.every((fact) => fact.length > 0));
      assert.match(post.handle, /^@[a-z]+_[a-z]+_(esil|almaty|saryarka|baikonur|nura|city)$/);
      authors.add(post.author);
      if (index) assert.ok(engagement(feed[index - 1]) >= engagement(post));
    });
  }
  assert.ok(authors.size >= 16);
});

test("Social: top nine preserve the highest engagement across all candidates", () => {
  const flags = { ...allOn, anger: false };
  const base = inputs(example, "ranking", flags, {}, []);
  const candidates = buildSocialFeed(base);
  for (const promise of PROMISES) {
    const feed = buildSocialFeed(inputs(example, "ranking", flags, {}, [promise.id]));
    candidates.push(find(feed, `promise:${promise.id}`));
  }
  const expected = candidates.sort((a, b) => engagement(b) - engagement(a) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)).slice(0, 9);
  assert.deepEqual(buildSocialFeed(inputs(example, "ranking", flags, {}, PROMISES.map(({ id }) => id))), expected);
});

test("Social: feed building never mutates the plan, result, mods or catalog", () => {
  const args = inputs();
  const before = JSON.stringify({ args, DISTRICTS, INDICATORS, MEASURES });
  const feed = buildSocialFeed(args);
  feed[0].facts.push("Локальная правка");
  feed[0].text = "Локальная правка";
  assert.equal(JSON.stringify({ args, DISTRICTS, INDICATORS, MEASURES }), before);
  assert.ok(buildSocialFeed(args).every((post) => !post.facts.includes("Локальная правка")));
});

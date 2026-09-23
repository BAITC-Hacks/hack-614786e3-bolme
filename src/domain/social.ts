import { CRITICAL_THRESHOLD, DISTRICTS, INDICATORS, MEASURES } from "./data";
import { DISTRICT_IDS, INDICATOR_IDS } from "./types";
import type { Choice, DistrictId, SimulationResult } from "./types";
import type { ModsOutcome } from "./mods";

// Game assumptions, not forecasts or real social-network statistics.
const BASE_SUPPORT = 0.5;
const SCORE_GAIN_SUPPORT = 0.06;
const FIXED_CRITICAL_SUPPORT = 0.2;
const ANGER_DIVISOR = 250;
const LONG_LAG_QUARTERS = 3;
const LONG_LAG_PENALTY = 0.1;
const MIN_SUPPORT = 0.05;
const MAX_SUPPORT = 0.95;
const KEPT_PROMISE_SUPPORT = 0.8;
const BROKEN_PROMISE_SUPPORT = 0.12;
const NO_RESPONSE_SUPPORT = 0.15;
const FULL_RESPONSE_SUPPORT = 0.75;
const PARTIAL_RESPONSE_SUPPORT = 0.45;
const FORGOTTEN_SUPPORT = 0.2;
const NEUTRAL_SHARE = 0.35;
const BASE_AUDIENCE = 150;
const POPULATION_AUDIENCE = 5000;
const CITY_POPULATION_SHARE = 0.3;
const AUDIENCE_MIN_FACTOR = 0.6;
const AUDIENCE_RANDOM_FACTOR = 0.8;
const ENGAGEMENT_MIN_FACTOR = 0.8;
const ENGAGEMENT_RANDOM_FACTOR = 0.4;
const LIKE_RATE = { support: 0.7, neutral: 0.35, angry: 0.1 };
const DISLIKE_RATE = { support: 0.04, neutral: 0.15, angry: 0.5 };
const REPOST_RATE = 0.12;
const MAX_POSTS = 9;

export type Sentiment = "support" | "neutral" | "angry";

export type SocialPost = {
  id: string;
  kind: "measure" | "promise" | "event" | "forgotten";
  districtId: DistrictId | null;
  author: string;
  handle: string;
  sentiment: Sentiment;
  /** Probability used for the supportive reaction draw, in [0, 1]. */
  supportChance: number;
  likes: number;
  dislikes: number;
  reposts: number;
  /** Real fact phrases; numbers are allowed here. */
  facts: string[];
  /** Russian fallback copy; contains no digits. */
  text: string;
};

/** FNV-1a over UTF-16 code units, returned as an unsigned 32-bit seed. */
export function hashSeed(s: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    hash = Math.imul(hash ^ s.charCodeAt(i), 0x01000193);
  }
  return hash >>> 0;
}

/** Mulberry32: independent, repeatable draws in [0, 1), without global state. */
export function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

// Fictional residents. The second field is the Latin transliteration of the name.
const AUTHORS = [
  ["Айгерим С.", "aigerim_s"], ["Данияр К.", "daniyar_k"],
  ["Асем Т.", "asem_t"], ["Нурлан Ж.", "nurlan_zh"],
  ["Мадина Б.", "madina_b"], ["Ермек О.", "ermek_o"],
  ["Алия Н.", "aliya_n"], ["Руслан Д.", "ruslan_d"],
  ["Жанар М.", "zhanar_m"], ["Тимур А.", "timur_a"],
  ["Анна В.", "anna_v"], ["Иван Л.", "ivan_l"],
  ["Ольга П.", "olga_p"], ["Сергей Р.", "sergei_r"],
  ["Елена Ф.", "elena_f"], ["Михаил Г.", "mikhail_g"],
  ["Дарья Е.", "darya_e"], ["Павел И.", "pavel_i"],
] as const;

// Each template follows a sentence containing the district, subject and outcome.
// Support for a broken promise or an ignored emergency can be support for neighbours.
const TEMPLATES: Record<SocialPost["kind"], Record<Sentiment, readonly [string, string]>> = {
  measure: {
    support: ["Вот это мне нравится, давно ждали!", "За такую идею я обеими руками, пусть получится!"],
    neutral: ["Пока присматриваюсь, хочется увидеть результат своими глазами.", "Звучит интересно, но выводы оставлю на потом."],
    angry: ["А с ежедневными проблемами нам что делать, опять ждать?", "Красиво звучит, а жить с неудобствами всё ещё нам!"],
  },
  promise: {
    support: ["Поддерживаю соседей, которые следят за обещаниями!", "Хорошо, что об этом говорят открыто, я с соседями!"],
    neutral: ["Запомнили, будем дальше следить за делами.", "Обсудим с соседями, пока без громких выводов."],
    angry: ["Мне от этих отчётов не легче, вопросов ещё полно!", "А жителей вообще спросили, довольны ли мы?"],
  },
  event: {
    support: ["Соседи, держимся вместе, спасибо всем, кто помогает!", "Поддерживаю тех, кто не даёт забыть об этой беде!"],
    neutral: ["Слежу за новостями, хочется понять, что будет дальше.", "Пока собираем новости в домовом чате, посмотрим."],
    angry: ["Людям тяжело прямо сейчас, сколько можно нервничать!", "В домовом чате кипит, нам нужны понятные действия!"],
  },
  forgotten: {
    support: ["Поддерживаю соседей, давайте вместе напомним о себе!", "Радуюсь, что соседи не молчат, вместе добьёмся внимания!"],
    neutral: ["Пока наблюдаем, но про наш район тоже хочется услышать.", "Обсуждаем в чате, будем ждать понятного ответа."],
    angry: ["Ну сколько можно обходить нас стороной!", "Опять про нас забыли, а проблемы сами не исчезнут!"],
  },
};

const clampSupport = (value: number) => Math.max(MIN_SUPPORT, Math.min(MAX_SUPPORT, value));
const formatNumber = (value: number) => value.toLocaleString("ru-RU", { maximumFractionDigits: 1 });
const location = (districtId: DistrictId | null) => districtId === null ? "Весь город" : `Район ${DISTRICTS[districtId].name}`;
const withoutDigits = (text: string) => text.replace(/\d+/g, "").replace(/\s+/g, " ").trim();
const engagement = (post: SocialPost) => post.likes + post.dislikes + post.reposts;

function indicatorFact(result: SimulationResult, districtId: DistrictId): string {
  // Absolute change includes deterioration. Ties follow the dataset's indicator order.
  const change = (id: typeof INDICATOR_IDS[number]) => Math.abs(result.indicators[districtId][id] - result.baseline[districtId][id]);
  const indicator = INDICATOR_IDS.reduce((best, id) => change(id) > change(best) ? id : best);
  return `${INDICATORS[indicator].name}, ${DISTRICTS[districtId].name}: ${formatNumber(result.baseline[districtId][indicator])} → ${formatNumber(result.indicators[districtId][indicator])}`;
}

/** Build from a signed, valid plan and its official result; does not mutate inputs.
 * Every candidate is generated before ranking; only the nine most engaged survive.
 */
export function buildSocialFeed({ plan, result, mods, seed }: {
  plan: Choice[];
  result: SimulationResult;
  mods: ModsOutcome;
  seed: string;
}): SocialPost[] {
  const posts: SocialPost[] = [];
  const addPost = (id: string, kind: SocialPost["kind"], districtId: DistrictId | null, supportChance: number, facts: string[], subject: string) => {
    const random = rng(hashSeed(`${seed}|${id}`));
    const draw = random();
    const sentiment: Sentiment = draw < supportChance ? "support"
      : draw < supportChance + (1 - supportChance) * NEUTRAL_SHARE ? "neutral" : "angry";
    const share = districtId === null ? CITY_POPULATION_SHARE : DISTRICTS[districtId].population;
    const audience = Math.round(BASE_AUDIENCE + share * POPULATION_AUDIENCE * (AUDIENCE_MIN_FACTOR + AUDIENCE_RANDOM_FACTOR * random()));
    const likes = Math.round(audience * LIKE_RATE[sentiment] * (ENGAGEMENT_MIN_FACTOR + ENGAGEMENT_RANDOM_FACTOR * random()));
    const dislikes = Math.round(audience * DISLIKE_RATE[sentiment] * (ENGAGEMENT_MIN_FACTOR + ENGAGEMENT_RANDOM_FACTOR * random()));
    const reposts = Math.round((likes + dislikes) * REPOST_RATE * random());
    const [author, latin] = AUTHORS[Math.floor(random() * AUTHORS.length)];
    const variants = TEMPLATES[kind][sentiment];
    const text = withoutDigits(`${location(districtId)} — ${subject}. ${variants[Math.floor(random() * variants.length)]}`);
    posts.push({ id, kind, districtId, author, handle: `@${latin}_${districtId ?? "city"}`, sentiment, supportChance, likes, dislikes, reposts, facts, text });
  };

  const gain = (id: DistrictId) => result.districtScores[id] - result.baselineDistrictScores[id];
  // Ties follow the dataset's district order, independently of plan order.
  const mostImproved = DISTRICT_IDS.reduce((best, id) => gain(id) > gain(best) ? id : best);
  for (const choice of plan) {
    const measure = MEASURES[choice.measureId];
    const districtId = measure.scope === "city" ? mostImproved : choice.districtId!;
    const fixed = INDICATOR_IDS.filter((id) => result.baseline[districtId][id] < CRITICAL_THRESHOLD
      && result.indicators[districtId][id] >= CRITICAL_THRESHOLD).length;
    const longLag = measure.lag >= LONG_LAG_QUARTERS;
    const supportChance = clampSupport(BASE_SUPPORT + SCORE_GAIN_SUPPORT * gain(districtId)
      + FIXED_CRITICAL_SUPPORT * fixed - (mods.anger?.[districtId].value ?? 0) / ANGER_DIVISOR
      - (longLag ? LONG_LAG_PENALTY : 0));
    addPost(`measure:${measure.id}`, "measure", districtId, supportChance,
      [`${measure.title} — ${DISTRICTS[districtId].name}`, indicatorFact(result, districtId), `Срок запуска: ${measure.lag} кв.`],
      `«${measure.title}»${longLag ? ", результата ещё ждать" : ""}`);
  }

  for (const { promise, kept, proof } of mods.promises ?? []) {
    const status = kept ? "выполнено" : "не выполнено";
    addPost(`promise:${promise.id}`, "promise", promise.districtId, kept ? KEPT_PROMISE_SUPPORT : BROKEN_PROMISE_SUPPORT,
      [`${promise.text} — ${status}`, proof], `обещание «${promise.text}» ${status}`);
  }

  for (const { event, response } of mods.emergencies ?? []) {
    const supportChance = response.id === "none" ? NO_RESPONSE_SUPPORT
      : response.id === "full" ? FULL_RESPONSE_SUPPORT : PARTIAL_RESPONSE_SUPPORT;
    addPost(`event:${event.id}`, "event", event.districtId, supportChance,
      [event.title, `Реакция: ${response.title}`], `«${event.title}», ответ: «${response.title}»`);
  }

  const weakest = result.weakestDistrict;
  if (!plan.some((choice) => MEASURES[choice.measureId].scope === "district" && choice.districtId === weakest)) {
    addPost(`forgotten:${weakest}`, "forgotten", weakest, FORGOTTEN_SUPPORT,
      [`${DISTRICTS[weakest].name}: самый низкий районный балл — ${formatNumber(result.districtScores[weakest])}`, "В плане нет адресных мер для района"],
      "район с самым низким баллом остался без адресных мер");
  }

  return posts.sort((a, b) => engagement(b) - engagement(a) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)).slice(0, MAX_POSTS);
}

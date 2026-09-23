"use client";

import { useEffect, useMemo, useState } from "react";
import { DISTRICTS } from "@/domain/data";
import { buildSocialFeed, type SocialPost } from "@/domain/social";
import { socialSeed, type Analysis } from "@/sim/analysis";
import { useSimStore } from "@/sim/store";

const liveFeeds = new Map<string, { posts: SocialPost[]; model?: string }>();

function useFeed(a: Analysis) {
  const plan = useSimStore((s) => s.plan);
  const mods = useSimStore((s) => s.mods);
  const responses = useSimStore((s) => s.responses);
  const promiseIds = useSimStore((s) => s.promiseIds);
  const key = JSON.stringify({ plan, mods, responses, promiseIds });
  const offline = useMemo(() => buildSocialFeed({ plan, result: a.result, mods: a.mods, seed: socialSeed(plan, { responses, promiseIds }) }), [plan, a, responses, promiseIds]);
  const [, force] = useState(0);
  useEffect(() => {
    if (liveFeeds.has(key)) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      fetch("/api/reactions", { method: "POST", headers: { "Content-Type": "application/json" }, body: key, signal: controller.signal })
        .then((res) => (res.ok ? res.json() : null))
        .then((body: { source: string; model?: string; posts: SocialPost[] } | null) => {
          if (body?.source === "live") {
            liveFeeds.set(key, { posts: body.posts, model: body.model });
            force((x) => x + 1);
          }
        })
        .catch(() => undefined);
    }, 700);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [key]);
  const live = liveFeeds.get(key);
  return { posts: live?.posts ?? offline, live: !!live, model: live?.model };
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

export function SocialFeed({ a }: { a: Analysis }) {
  const { posts, live, model } = useFeed(a);
  const likes = posts.reduce((s, p) => s + p.likes, 0);
  const dislikes = posts.reduce((s, p) => s + p.dislikes, 0);
  const approval = likes + dislikes ? (likes / (likes + dislikes)) * 100 : 50;
  return (
    <div className="debrief__card social">
      <h3>
        Реакция в соцсетях
        <span className={`sim-ai__badge${live ? " is-live" : ""}`}>{live ? `тексты GPT · ${model}` : "шаблоны движка"}</span>
      </h3>
      <div className="social__mood">
        <span className="social__bar">
          <span style={{ width: `${approval}%` }} />
        </span>
        <b>{Math.round(approval)}% одобрения</b>
      </div>
      <ul className="social__feed">
        {posts.map((p) => (
          <li key={p.id} className={`social__post is-${p.sentiment}`}>
            <span className="social__avatar" aria-hidden>
              {initials(p.author)}
            </span>
            <div className="social__body">
              <div className="social__meta">
                <b>{p.author}</b> <span>{p.handle}</span>
                {p.districtId && <em>{DISTRICTS[p.districtId].name}</em>}
              </div>
              <p>{p.text}</p>
              <div className="social__stats">
                <span>👍 {p.likes.toLocaleString("ru-RU")}</span>
                <span>👎 {p.dislikes.toLocaleString("ru-RU")}</span>
                <span>↻ {p.reposts.toLocaleString("ru-RU")}</span>
                <span className="social__chance" title="Шанс одобрения рассчитан кодом из результата; исход — случайный бросок с фиксированным seed">
                  шанс одобрения {Math.round(p.supportChance * 100)}%
                </span>
              </div>
            </div>
          </li>
        ))}
      </ul>
      <p className="sim-note">Вымышленные жители. Кто пишет и как реагируют, решает код по результату плана (с долей случайности); GPT только пишет текст.</p>
    </div>
  );
}

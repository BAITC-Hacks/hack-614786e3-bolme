/**
 * POST /api/reactions — the city's social-network reaction to a signed plan.
 *
 * CODE decides who posts, about what, the sentiment (seeded chance) and the
 * likes/dislikes (src/domain/social.ts). GPT only rewrites each post's text
 * in a lively social-media voice. A rewritten text may use digits only if
 * they appear in that post's computed facts; otherwise the template text stays.
 */
import { buildSocialFeed, type SocialPost } from "@/domain/social";
import type { Choice } from "@/domain/types";
import { analyzePlan, socialSeed, type ModsInput } from "@/sim/analysis";

const MODEL = process.env.OPENAI_MODEL ?? "gpt-6-luna";
const TIMEOUT_MS = 25_000;

const INSTRUCTIONS = `Ты пишешь посты жителей Астаны в вымышленной городской соцсети для игры-симулятора «Аким на 5 часов» (данные синтетические).
Тебе дают посты: id, район, тема, настроение (support — одобряют, neutral — сомневаются, angry — злятся) и facts — факты из расчёта.
Перепиши text каждого поста живым языком соцсетей: 1–2 коротких предложения, от первого лица жителя, можно 1 эмодзи и разговорные слова, можно смешать русский с казахскими словечками.
Правила: строго сохраняй настроение и тему; не придумывай новых событий, мер и цифр; цифры можно писать только те, что есть в facts этого поста; не упоминай реальных людей и политиков; без оскорблений.`;

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["posts"],
  properties: {
    posts: {
      type: "array",
      items: { type: "object", additionalProperties: false, required: ["id", "text"], properties: { id: { type: "string" }, text: { type: "string" } } },
    },
  },
};

function digitsAllowed(text: string, facts: string[]): boolean {
  const allowed = new Set(facts.join(" ").match(/\d+(?:[.,]\d+)?/g) ?? []);
  return (text.match(/\d+(?:[.,]\d+)?/g) ?? []).every((n) => allowed.has(n));
}

async function rewrite(posts: SocialPost[], apiKey: string): Promise<Record<string, string>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model: MODEL,
        instructions: INSTRUCTIONS,
        input: JSON.stringify(posts.map((p) => ({ id: p.id, district: p.districtId, topic: p.kind, sentiment: p.sentiment, facts: p.facts, text: p.text }))),
        reasoning: { effort: "low" },
        max_output_tokens: 2500,
        store: false,
        text: { format: { type: "json_schema", name: "social_posts", strict: true, schema } },
      }),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}`);
    const body = (await res.json()) as { output?: Array<{ type: string; content?: Array<{ type: string; text?: string }> }> };
    const text = body.output?.find((o) => o.type === "message")?.content?.find((c) => c.type === "output_text")?.text;
    if (!text) throw new Error("Пустой ответ модели");
    const parsed = JSON.parse(text) as { posts: Array<{ id: string; text: string }> };
    return Object.fromEntries(parsed.posts.map((p) => [p.id, p.text]));
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(request: Request) {
  let payload: { plan?: Choice[] } & Partial<ModsInput>;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Некорректный JSON" }, { status: 400 });
  }
  const plan = Array.isArray(payload.plan) ? payload.plan : [];
  const modsInput: ModsInput = {
    mods: payload.mods ?? { emergencies: false, anger: false, promises: false },
    responses: payload.responses ?? {},
    promiseIds: payload.promiseIds ?? [],
  };
  const analyzed = analyzePlan(plan, modsInput);
  if (!analyzed.ok) return Response.json({ error: "План недопустим", issues: analyzed.issues }, { status: 422 });
  const { result, mods } = analyzed.analysis;
  const posts = buildSocialFeed({ plan, result, mods, seed: socialSeed(plan, modsInput) });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return Response.json({ source: "offline", posts });
  try {
    const texts = await rewrite(posts, apiKey);
    return Response.json({
      source: "live",
      model: MODEL,
      posts: posts.map((p) => (texts[p.id] && digitsAllowed(texts[p.id], p.facts) ? { ...p, text: texts[p.id] } : p)),
    });
  } catch {
    return Response.json({ source: "offline", posts });
  }
}


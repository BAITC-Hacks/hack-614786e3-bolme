/**
 * POST /api/analyze — grounded AI analysis of a signed plan.
 *
 * The server recomputes everything from the plan (never trusts client
 * numbers), builds a registry of computed facts, and asks the model for a
 * structured report where numbers may appear only as {{fact_id}}
 * placeholders. Items that reference unknown facts or contain raw numbers are
 * dropped. Without OPENAI_API_KEY (or on any model error) the route returns a
 * deterministic report built from the same facts, labelled "offline".
 */
import { analyzePlan, contributionsOf, parseRequest } from "@/sim/analysis";
import { offlineReport, renderItem, SECTIONS, type ReportItem, type ReportPayload } from "@/sim/report";

const MODEL = process.env.OPENAI_MODEL ?? "gpt-6-luna";
const TIMEOUT_MS = 25_000;

const INSTRUCTIONS = `Ты — AI-аналитик городского симулятора «Аким на 5 часов» (синтетические данные кейса HackAlem, условные районы Астаны).
Тебе передают JSON: facts (числа, рассчитанные кодом, с id) и context (план, районы, правила, моды).
Жёсткие правила:
1. Никогда не вычисляй и не придумывай числа. Любое число — даже «5 решений» или «порог 40» — вставляй ТОЛЬКО плейсхолдером {{id}} из facts, например «Score вырос до {{score}}», «из {{decisions}} решений», «ниже порога {{threshold}}». Ставь плейсхолдер рядом со словами, которые точно описывают этот факт (см. label факта). Цифры без плейсхолдера допустимы только в кодах мер (M8) и показателей (S1); пункт с любой другой цифрой будет отброшен.
2. Не упоминай эффектов и механизмов, которых нет в данных и правилах.
3. Пиши по-русски, коротко и конкретно, для городского управленца. Каждый пункт — 1–2 предложения.
4. summary — 1–2 предложения: главный итог сценария.
5. strengths (2–4): что план делает хорошо и за счёт каких мер (используй contrib_* и изменения показателей).
6. risks (2–4): оставшиеся критические показатели (< порога), самый слабый район, долгие лаги, неиспользованный бюджет; если включены моды — ЧС и нарушенные обещания.
7. consequences (2–4): что изменится для жителей конкретных районов и когда (лаги: lag_*).
8. tradeoffs (2–3): главные компромиссы — весь город против самого слабого района, цена против эффекта, от чего пришлось отказаться.
9. recommendations (1–3): только варианты из context.swaps (ссылайся на swapN_delta/swapN_score) или качественные управленческие советы без чисел.
10. В factIds каждого пункта перечисли id использованных фактов.
Моды — игровой слой с допущениями, официальный Score они не меняют: так и говори, если упоминаешь stressed_score.`;

const itemSchema = {
  type: "object",
  additionalProperties: false,
  required: ["text", "factIds"],
  properties: { text: { type: "string" }, factIds: { type: "array", items: { type: "string" } } },
};

const reportSchema = {
  type: "object",
  additionalProperties: false,
  required: ["summary", ...SECTIONS],
  properties: {
    summary: { type: "string" },
    ...Object.fromEntries(SECTIONS.map((s) => [s, { type: "array", items: itemSchema }])),
  },
};

type RawReport = { summary: string } & Record<(typeof SECTIONS)[number], ReportItem[]>;

async function callModel(input: unknown, apiKey: string): Promise<RawReport> {
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
        input: JSON.stringify(input),
        reasoning: { effort: "low" },
        max_output_tokens: 4000,
        store: false,
        text: { format: { type: "json_schema", name: "akim_report", strict: true, schema: reportSchema } },
      }),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const body = (await res.json()) as { output?: Array<{ type: string; content?: Array<{ type: string; text?: string }> }> };
    const text = body.output?.find((o) => o.type === "message")?.content?.find((c) => c.type === "output_text")?.text;
    if (!text) throw new Error("Пустой ответ модели");
    return JSON.parse(text) as RawReport;
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Некорректный JSON" }, { status: 400 });
  }
  const parsed = parseRequest(body);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });
  const { plan, modsInput } = parsed;
  const analyzed = analyzePlan(plan, modsInput);
  if (!analyzed.ok) return Response.json({ error: "План недопустим — Score не рассчитывается", issues: analyzed.issues }, { status: 422 });
  const { analysis } = analyzed;
  const { facts, context } = analysis.facts;
  const fallback = () => offlineReport(plan, analysis.result, analysis.facts, analysis.swaps, analysis.mods, contributionsOf(analysis));

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return Response.json(fallback());

  try {
    const raw = await callModel({ facts, context }, apiKey);
    const off = fallback();
    const report: ReportPayload = {
      source: "live",
      model: MODEL,
      summary: renderItem({ text: raw.summary, factIds: [] }, facts)?.text ?? off.summary,
      strengths: [],
      risks: [],
      consequences: [],
      tradeoffs: [],
      recommendations: [],
      swaps: analysis.swaps,
      contributions: contributionsOf(analysis),
    };
    let dropped = 0;
    for (const s of SECTIONS) {
      const items = (raw[s] ?? []).map((it) => renderItem(it, facts));
      dropped += items.filter((x) => !x).length;
      report[s] = items.filter((x): x is ReportItem => x !== null);
      if (!report[s].length) report[s] = off[s]; // never show an empty section
    }
    if (dropped) report.note = `Проверка фактов отклонила пунктов: ${dropped} (числа вне расчёта движка).`;
    return Response.json(report);
  } catch (error) {
    const report = fallback();
    report.note = `AI недоступен (${error instanceof Error ? error.message.slice(0, 120) : "ошибка"}); показан отчёт из расчёта движка.`;
    return Response.json(report);
  }
}

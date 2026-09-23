"use client";

import { useEffect, useMemo, useState } from "react";
import { contributionsOf, type Analysis } from "@/sim/analysis";
import { offlineReport, type ReportItem, type ReportPayload } from "@/sim/report";
import { useSimStore } from "@/sim/store";

const SECTION_TITLES: Array<[keyof Pick<ReportPayload, "strengths" | "risks" | "consequences" | "tradeoffs" | "recommendations">, string]> = [
  ["strengths", "Сильные стороны"],
  ["risks", "Риски"],
  ["consequences", "Последствия для жителей"],
  ["tradeoffs", "Компромиссы"],
  ["recommendations", "Рекомендации"],
];

/** Latest live report per request key, shared with the brief. */
export const liveReports = new Map<string, ReportPayload>();

export function useReport(a: Analysis) {
  const plan = useSimStore((s) => s.plan);
  const mods = useSimStore((s) => s.mods);
  const responses = useSimStore((s) => s.responses);
  const promiseIds = useSimStore((s) => s.promiseIds);
  const key = JSON.stringify({ plan, mods, responses, promiseIds });
  const offline = useMemo(() => offlineReport(plan, a.result, a.facts, a.swaps, a.mods, contributionsOf(a)), [plan, a]);
  const [state, setState] = useState<{ key: string; status: "loading" | "ready" | "error"; report?: ReportPayload; error?: string }>({ key: "", status: "loading" });

  useEffect(() => {
    if (liveReports.has(key)) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setState({ key, status: "loading" });
      fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: key,
        signal: controller.signal,
      })
        .then(async (res) => {
          const body = await res.json();
          if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
          liveReports.set(key, body as ReportPayload);
          setState({ key, status: "ready", report: body as ReportPayload });
        })
        .catch((e: unknown) => {
          if (controller.signal.aborted) return;
          setState({ key, status: "error", error: e instanceof Error ? e.message : "ошибка" });
        });
    }, 500);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [key]);

  const cached = liveReports.get(key);
  if (cached) return { report: cached, loading: false, error: null as string | null };
  if (state.key === key && state.status === "error") return { report: offline, loading: false, error: state.error ?? null };
  return { report: offline, loading: true, error: null as string | null };
}

function Items({ items }: { items: ReportItem[] }) {
  return (
    <ul className="sim-ai__items">
      {items.map((it, i) => (
        <li key={i}>{it.text}</li>
      ))}
    </ul>
  );
}

export function AiReport({ a }: { a: Analysis }) {
  const { report, loading, error } = useReport(a);
  return (
    <div className="sim-block sim-ai">
      <h3 className="sim-block__title">
        AI-анализ сценария
        <span className={`sim-ai__badge${report.source === "live" ? " is-live" : ""}`}>
          {loading ? "GPT анализирует…" : report.source === "live" ? `GPT · ${report.model}` : "офлайн-отчёт движка"}
        </span>
      </h3>
      <p className="sim-ai__summary">{report.summary}</p>
      {SECTION_TITLES.map(([key, title]) => (
        <details key={key} open={key !== "consequences"}>
          <summary>{title}</summary>
          <Items items={report[key]} />
        </details>
      ))}
      {(report.note || error) && <p className="sim-note">{error ? `AI недоступен: ${error}. Показан отчёт движка.` : report.note}</p>}
      <p className="sim-note">AI только объясняет: все числа подставлены из расчёта движка, пункты с «чужими» числами отбрасываются.</p>
    </div>
  );
}

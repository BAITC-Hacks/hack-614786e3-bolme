"use client";

import { DATASET_VERSION, DISTRICTS, MEASURES } from "@/domain/data";
import { DISTRICT_IDS } from "@/domain/types";
import { num, signed } from "@/sim/labels";
import { useSimStore } from "@/sim/store";
import { useSignedAnalysis } from "@/sim/useAnalysis";
import type { Analysis } from "@/sim/analysis";
import { useReport } from "./AiReport";

function Sheet({ a }: { a: Analysis }) {
  const plan = useSimStore((s) => s.plan);
  const setBriefOpen = useSimStore((s) => s.setBriefOpen);
  const { report } = useReport(a);
  const r = a.result;
  return (
    <div className="brief" role="dialog" aria-label="Бриф решения">
      <article className="brief__page">
        <header>
          <p className="brief__eyebrow">HackAlem AI · «Аким на 5 часов» · команда Bolme</p>
          <h1>Решение акима: {num(r.score)} Astana QoL Score</h1>
          <p>
            {signed(r.score - r.baselineScore)} к базе {num(r.baselineScore)} · реализовано {num(a.rank.potentialPercent, 1)}% возможного прироста · лучше{" "}
            {num(a.rank.beatsPercent, 1)}% из {a.rank.validPlanCount.toLocaleString("ru-RU")} допустимых планов
          </p>
        </header>
        <section>
          <h2>Пять решений · {r.cost} из 100</h2>
          <table>
            <tbody>
              {plan.map((c) => (
                <tr key={c.measureId}>
                  <td>{c.measureId}</td>
                  <td>{MEASURES[c.measureId].title}</td>
                  <td>{c.districtId ? DISTRICTS[c.districtId].name : "весь город"}</td>
                  <td>{MEASURES[c.measureId].cost}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="brief__cols">
          <div>
            <h2>Районы</h2>
            <table>
              <tbody>
                {DISTRICT_IDS.map((d) => (
                  <tr key={d}>
                    <td>{DISTRICTS[d].name}</td>
                    <td>
                      {num(r.baselineDistrictScores[d])} → <b>{num(r.districtScores[d])}</b>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p>
              Критических показателей: {r.nCrit}. Слабейший район: {DISTRICTS[r.weakestDistrict].name}.
            </p>
          </div>
          <div>
            <h2>Вывод AI</h2>
            <p>{report.summary}</p>
            <h3>Сильные стороны</h3>
            <ul>{report.strengths.slice(0, 3).map((x, i) => <li key={i}>{x.text}</li>)}</ul>
            <h3>Риски</h3>
            <ul>{report.risks.slice(0, 3).map((x, i) => <li key={i}>{x.text}</li>)}</ul>
            <h3>Рекомендации</h3>
            <ul>{report.recommendations.slice(0, 2).map((x, i) => <li key={i}>{x.text}</li>)}</ul>
          </div>
        </section>
        <footer>
          Данные: синтетический датасет кейса ({DATASET_VERSION}). Score по официальной формуле; AI объясняет, числа считает код. Отчёт: {report.source === "live" ? `GPT (${report.model})` : "офлайн-движок"}.
        </footer>
      </article>
      <div className="brief__actions">
        <button type="button" className="sim-btn sim-btn--primary" onClick={() => window.print()}>
          Печать / PDF
        </button>
        <button type="button" className="sim-btn" onClick={() => setBriefOpen(false)}>
          Закрыть
        </button>
      </div>
    </div>
  );
}

export function BriefSheet() {
  const open = useSimStore((s) => s.briefOpen);
  const a = useSignedAnalysis();
  if (!open || !a) return null;
  return <Sheet a={a} />;
}

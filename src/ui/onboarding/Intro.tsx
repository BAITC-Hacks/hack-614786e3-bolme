"use client";

import { useEffect } from "react";
import { BUDGET, DECISIONS, HORIZON_QUARTERS } from "@/domain/data";
import { useCityStore } from "@/city/store";
import { Icon } from "@/ui/icons";
import { useOnboardingStore } from "./store";

const FACTS = [
  { value: String(BUDGET), label: "единиц бюджета" },
  { value: String(DECISIONS), label: "решений из 14" },
  { value: String(HORIZON_QUARTERS), label: "кварталов · 2 года" },
] as const;

/** Welcome card over the cinematic flyover. `?nointro` skips it (dev). */
export function Intro() {
  const stage = useOnboardingStore((s) => s.stage);
  const startGuide = useOnboardingStore((s) => s.startGuide);
  const finish = useOnboardingStore((s) => s.finish);
  const buildings = useCityStore((s) => s.manifest?.counts.buildings);

  useEffect(() => {
    if (useOnboardingStore.getState().stage !== "intro") return;
    if (new URLSearchParams(window.location.search).has("nointro")) {
      useOnboardingStore.setState({ stage: "done" });
      return;
    }
    useCityStore.getState().setMode("tour");
  }, []);

  useEffect(() => {
    if (stage !== "intro") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Enter") startGuide();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stage, startGuide]);

  if (stage !== "intro") return null;
  return (
    <div className="intro" role="dialog" aria-modal="true" aria-labelledby="intro-title">
      <section className="intro__card">
        <p className="intro__eyebrow">
          <span className="intro__dot" aria-hidden /> HackAlem · кейс «Аким на 5 часов»
        </p>
        <h1 id="intro-title" className="intro__title">
          Вы — аким
          <br />
          Астаны
        </h1>
        <p className="intro__lead">
          Два года, один бюджет и пять решений. Выберите меры для районов, подпишите бюджет — и посмотрите, как изменится жизнь горожан.
        </p>
        <ul className="intro__facts">
          {FACTS.map((f) => (
            <li key={f.label}>
              <b>{f.value}</b>
              <span>{f.label}</span>
            </li>
          ))}
        </ul>
        <p className="intro__note">
          <Icon name="sparkle" size={16} />
          Точный движок считает Astana Quality of Life Score по формуле кейса, AI-аналитик объясняет результат, но ни одного числа не придумывает.
        </p>
        <div className="intro__actions">
          <button type="button" className="sim-btn sim-btn--primary intro__start" onClick={startGuide} autoFocus>
            Показать, как всё устроено
            <Icon name="arrow" size={16} />
          </button>
          <button type="button" className="sim-btn sim-btn--ghost" onClick={finish}>
            Сразу к игре
          </button>
        </div>
        <p className="intro__foot">3D-макет по OpenStreetMap · {buildings ? buildings.toLocaleString("ru-RU") : "42 314"} зданий · команда Bolme</p>
      </section>
    </div>
  );
}

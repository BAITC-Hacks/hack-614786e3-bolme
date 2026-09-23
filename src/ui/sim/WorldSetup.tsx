"use client";

/**
 * Stages before the plan, over the flyover: world settings (mode + mods),
 * then — with «Память народа» — exactly PROMISE_COUNT public promises.
 * Both are fixed for the rest of the game; «Новая игра» starts over.
 */
import { DISTRICTS } from "@/domain/data";
import { PROMISES } from "@/domain/mods";
import { PROMISE_COUNT, useSimStore, type ModSettings } from "@/sim/store";
import { Icon, type IconName } from "@/ui/icons";
import { useOnboardingStore } from "@/ui/onboarding/store";

export const MOD_INFO: Record<keyof ModSettings, { icon: IconName; title: string; short: string; text: string }> = {
  emergencies: { icon: "bolt", title: "ЧС", short: "ЧС", text: "Паводок, порыв теплотрассы, смог. Реагировать придётся из остатка бюджета." },
  anger: { icon: "flame", title: "Шкала недовольства", short: "Недовольство", text: "Насколько злы жители каждого района — от проблем, ЧС и нарушенных обещаний." },
  promises: { icon: "chat", title: "Память народа", short: "Обещания", text: `Перед планом вы дадите жителям ${PROMISE_COUNT} публичных обещания. Через 2 года их проверят.` },
};

const MODES = [
  { analyst: false, icon: "user" as const, title: "Аким", text: "Последствия скрыты до подписи бюджета — как в жизни." },
  { analyst: true, icon: "chart" as const, title: "Аналитик", text: "Живой прогноз Score и «+X к Score» на каждой мере." },
];

function Steps({ now }: { now: 1 | 2 }) {
  const promisesOn = useSimStore((s) => s.mods.promises);
  const total = promisesOn ? 3 : 2;
  return (
    <p className="intro__eyebrow">
      Этап {now} из {total} · {now === 1 ? "Настройки мира" : "Память народа"}
    </p>
  );
}

function Settings() {
  const analyst = useSimStore((s) => s.analyst);
  const setAnalyst = useSimStore((s) => s.setAnalyst);
  const mods = useSimStore((s) => s.mods);
  const setMod = useSimStore((s) => s.setMod);
  const createWorld = useSimStore((s) => s.createWorld);
  const startPendingGuide = useOnboardingStore((s) => s.startPendingGuide);
  const create = () => {
    createWorld();
    if (useSimStore.getState().phase === "plan") startPendingGuide();
  };
  return (
    <section className="intro__card world" aria-labelledby="world-title">
      <Steps now={1} />
      <h1 id="world-title" className="world__title">
        Настройки мира
      </h1>
      <p className="intro__lead">Выберите правила один раз — до конца игры они не меняются.</p>

      <h2 className="world__label">Режим</h2>
      <div className="world__modes" role="radiogroup" aria-label="Режим">
        {MODES.map((m) => (
          <button key={m.title} type="button" role="radio" aria-checked={analyst === m.analyst} className="world__option" onClick={() => setAnalyst(m.analyst)}>
            <Icon name={m.icon} size={18} />
            <b>{m.title}</b>
            <small>{m.text}</small>
          </button>
        ))}
      </div>

      <h2 className="world__label">
        Моды города <span>официальный Score не меняют</span>
      </h2>
      <ul className="world__mods">
        {(Object.keys(MOD_INFO) as (keyof ModSettings)[]).map((key) => (
          <li key={key}>
            <label className="sim-switch world__mod">
              <input type="checkbox" checked={mods[key]} onChange={(e) => setMod(key, e.target.checked)} />
              <span className="sim-switch__track" aria-hidden />
              <span>
                <b>
                  <Icon name={MOD_INFO[key].icon} size={14} /> {MOD_INFO[key].title}
                </b>
                <small>{MOD_INFO[key].text}</small>
              </span>
            </label>
          </li>
        ))}
      </ul>

      <div className="intro__actions">
        <button type="button" className="sim-btn sim-btn--primary intro__start" onClick={create} autoFocus>
          Создать мир
          <Icon name="arrow" size={16} />
        </button>
      </div>
    </section>
  );
}

function Promises() {
  const promiseIds = useSimStore((s) => s.promiseIds);
  const togglePromise = useSimStore((s) => s.togglePromise);
  const confirmPromises = useSimStore((s) => s.confirmPromises);
  const backToSetup = useSimStore((s) => s.backToSetup);
  const startPendingGuide = useOnboardingStore((s) => s.startPendingGuide);
  const full = promiseIds.length >= PROMISE_COUNT;
  const confirm = () => {
    confirmPromises();
    if (useSimStore.getState().phase === "plan") startPendingGuide();
  };
  return (
    <section className="intro__card world" aria-labelledby="promises-title">
      <Steps now={2} />
      <h1 id="promises-title" className="world__title">
        Дайте жителям {PROMISE_COUNT} обещания
      </h1>
      <p className="intro__lead">Их запомнят и проверят через 2 года. Нарушенное обещание разозлит район сильнее, чем провал без обещаний.</p>
      <ul className="world__promises">
        {PROMISES.map((p) => {
          const chosen = promiseIds.includes(p.id);
          return (
            <li key={p.id}>
              <button type="button" className="world__promise" aria-pressed={chosen} disabled={!chosen && full} onClick={() => togglePromise(p.id)}>
                <span className="world__check" aria-hidden>
                  {chosen && <Icon name="check" size={12} />}
                </span>
                <span>
                  «{p.text}»<small>{p.districtId ? DISTRICTS[p.districtId].name : "Весь город"}</small>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="world__footer">
        <span className={`world__count${full ? " is-full" : ""}`} aria-live="polite">
          Выбрано <b>{promiseIds.length}</b> из {PROMISE_COUNT}
        </span>
        <button type="button" className="sim-btn sim-btn--ghost" onClick={backToSetup}>
          Назад
        </button>
        <button type="button" className="sim-btn sim-btn--primary" disabled={!full} onClick={confirm}>
          Дать обещания
          <Icon name="arrow" size={16} />
        </button>
      </div>
    </section>
  );
}

/** Full-screen stage card; rendered by SimHud while phase is "setup" or "promises". */
export function WorldSetup() {
  const phase = useSimStore((s) => s.phase);
  if (phase !== "setup" && phase !== "promises") return null;
  return <div className="intro world-stage">{phase === "setup" ? <Settings /> : <Promises />}</div>;
}

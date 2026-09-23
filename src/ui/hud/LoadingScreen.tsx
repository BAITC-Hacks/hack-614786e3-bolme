"use client";

import { useCityStore } from "@/city/store";

export function LoadingScreen({ stage }: { stage: string }) {
  const status = useCityStore((s) => s.status);
  const progress = useCityStore((s) => s.progress);
  const error = useCityStore((s) => s.error);
  const done = status === "ready";
  return (
    <div className={`loading${done ? " is-done" : ""}`} aria-hidden={done} role="status">
      <div className="loading__inner">
        <span className="loading__mark">АКИМ</span>
        <p className="loading__title">Астана в масштабе 1:1</p>
        {status === "error" ? (
          <p className="loading__error">{error}</p>
        ) : (
          <>
            <div className="loading__bar">
              <span style={{ transform: `scaleX(${Math.max(0.02, progress)})` }} />
            </div>
            <p className="loading__stage">{stage}</p>
          </>
        )}
      </div>
    </div>
  );
}

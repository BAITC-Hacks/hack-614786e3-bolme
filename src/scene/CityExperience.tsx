"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { demoHotspots } from "@/city/demoHotspots";
import { prepareCity, type PreparedCity } from "@/city/prepare";
import { useCityStore } from "@/city/store";
import { Hud } from "@/ui/hud/Hud";
import { MapLabels } from "@/ui/labels/MapLabels";
import { LoadingScreen } from "@/ui/hud/LoadingScreen";
import { isTyping } from "./camera/useKeyboard";

const CityCanvas = dynamic(() => import("./CityCanvas"), { ssr: false });

/** Global view hotkeys: M map, 3 orbit, F drone, T tour, Esc back to the map. */
function useViewHotkeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      const { setMode, backToMap, status } = useCityStore.getState();
      if (status !== "ready") return;
      if (e.code === "KeyM" || e.code === "Escape") backToMap();
      else if (e.code === "Digit3") setMode("orbit");
      else if (e.code === "KeyF") setMode("drone");
      else if (e.code === "KeyT") setMode("tour");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

export function CityExperience() {
  const [city, setCity] = useState<PreparedCity | null>(null);
  const [stage, setStage] = useState("Загружаем карту Астаны");
  useViewHotkeys();

  useEffect(() => {
    let alive = true;
    const { setProgress, setReady, setError, setHotspots } = useCityStore.getState();
    prepareCity((fraction, text) => {
      if (!alive) return;
      setProgress(fraction);
      setStage(text);
    })
      .then((prepared) => {
        if (!alive) return;
        setCity(prepared);
        setHotspots(demoHotspots(prepared.manifest));
        setReady(prepared.manifest);
      })
      .catch((error: unknown) => {
        console.error("City preparation failed", error);
        setError(error instanceof Error ? error.message : "Не удалось построить город");
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <main className="city-app">
      {city && <CityCanvas city={city} />}
      <MapLabels />
      <Hud />
      <LoadingScreen stage={stage} />
    </main>
  );
}

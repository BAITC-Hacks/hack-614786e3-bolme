"use client";

import { EffectComposer, N8AO, ToneMapping, Vignette } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";

/**
 * Screen-space ambient occlusion gives the maquette its grounded look
 * (dark creases where facades meet the ground, inside courtyards).
 */
export function Effects() {
  return (
    <EffectComposer multisampling={4}>
      <N8AO aoRadius={22} distanceFalloff={0.55} intensity={2.2} quality="medium" halfRes color="#1a2130" />
      <ToneMapping mode={ToneMappingMode.NEUTRAL} />
      <Vignette offset={0.32} darkness={0.32} />
    </EffectComposer>
  );
}

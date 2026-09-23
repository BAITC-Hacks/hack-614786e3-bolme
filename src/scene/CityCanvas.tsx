"use client";

import { Canvas } from "@react-three/fiber";
import type { PreparedCity } from "@/city/prepare";
import { CameraRig } from "./camera/CameraRig";
import { Effects } from "./fx/Effects";
import { Districts } from "./markers/Districts";
import { Ripples } from "./markers/Ripples";
import { DebugGroundPicker } from "./DebugGroundPicker";
import { FpsProbe } from "./FpsProbe";
import { LabelProjector } from "./labels/LabelProjector";
import { Atmosphere } from "./world/Atmosphere";
import { Buildings } from "./world/Buildings";
import { Ground } from "./world/Ground";
import { Landmarks } from "./world/Landmarks";
import { Traffic } from "./world/Traffic";
import { Trees } from "./world/Trees";
import { SimLayer } from "@/sim/scene/SimLayer";

export default function CityCanvas({ city }: { city: PreparedCity }) {
  return (
    <Canvas
      className="city-canvas"
      shadows="percentage"
      dpr={[1, 1.75]}
      gl={{ antialias: false, powerPreference: "high-performance", stencil: false }}
      camera={{ fov: 30, near: 5, far: 120000, position: [0, 20000, 10] }}
    >
      <Atmosphere />
      <Ground layers={city.ground} />
      <Buildings chunks={city.buildingChunks} />
      <Trees manifest={city.manifest} />
      <Landmarks manifest={city.manifest} />
      <Traffic roads={city.traffic.roads} rails={city.traffic.rails} />
      <Districts manifest={city.manifest} />
      <Ripples />
      <CameraRig manifest={city.manifest} />
      <Effects />
      <LabelProjector />
      <FpsProbe />
      <DebugGroundPicker manifest={city.manifest} />
      {/* Simulator objects (ghost buildings, initiatives…) mount here — see docs/city-scene-guide.md */}
      <SimLayer manifest={city.manifest} />
    </Canvas>
  );
}

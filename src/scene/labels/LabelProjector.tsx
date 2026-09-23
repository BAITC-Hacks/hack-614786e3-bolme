"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo } from "react";
import { Vector3 } from "three";
import { labelAnchors } from "./anchors";

/** Projects registered label anchors to screen space after each render. */
export function LabelProjector() {
  const v = useMemo(() => new Vector3(), []);
  useFrame(({ camera, size }) => {
    for (const anchor of labelAnchors.values()) {
      v.set(anchor.x, anchor.y, anchor.z).project(camera);
      const onScreen = v.z > -1 && v.z < 1 && Math.abs(v.x) < 1.15 && Math.abs(v.y) < 1.15;
      if (!onScreen) {
        anchor.el.style.visibility = "hidden";
        continue;
      }
      const px = (v.x * 0.5 + 0.5) * size.width;
      const py = (-v.y * 0.5 + 0.5) * size.height;
      anchor.el.style.visibility = "";
      anchor.el.style.transform = `translate3d(${px.toFixed(1)}px, ${py.toFixed(1)}px, 0)`;
    }
  }, 2);
  return null;
}

/**
 * Shared materials for the clay city. Shader tweaks go through
 * onBeforeCompile so the standard PBR lighting, shadows and fog still apply.
 */
import { Color, DoubleSide, MeshStandardMaterial, type Material } from "three";
import { PALETTE } from "../palette";

/** Uniforms animated from the render loop. */
export const sceneUniforms = {
  uTime: { value: 0 },
  uHighlight: { value: -1 },
  uHighlightColor: { value: new Color("#ffd27a") },
  uHighlightMix: { value: 0 },
};

export function createBuildingMaterial(): MeshStandardMaterial {
  const material = new MeshStandardMaterial({ color: PALETTE.building, roughness: 0.86, metalness: 0, envMapIntensity: 0.55 });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uHighlight = sceneUniforms.uHighlight;
    shader.uniforms.uHighlightColor = sceneUniforms.uHighlightColor;
    shader.uniforms.uHighlightMix = sceneUniforms.uHighlightMix;
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
attribute float aTint;
attribute float aDistrict;
uniform float uHighlight;
varying float vTint;
varying float vHeight;
varying float vDistrictMatch;`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
vTint = aTint;
vHeight = position.y;
vDistrictMatch = 1.0 - step(0.5, abs(aDistrict - uHighlight));`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
uniform vec3 uHighlightColor;
uniform float uHighlightMix;
varying float vTint;
varying float vHeight;
varying float vDistrictMatch;`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
diffuseColor.rgb *= vTint;
// Contact darkening: the first metres of every facade sit in ambient occlusion.
diffuseColor.rgb *= mix(0.7, 1.0, smoothstep(0.0, 10.0, vHeight));
diffuseColor.rgb = mix(diffuseColor.rgb, uHighlightColor, vDistrictMatch * uHighlightMix * 0.42);`,
      );
  };
  material.customProgramCacheKey = () => "clay-building-v1";
  return material;
}

/** Flat ground layer: drawn in painter's order on top of the ground plane. */
export function createLayerMaterial(color: string, roughness = 0.95): MeshStandardMaterial {
  const material = new MeshStandardMaterial({ color, roughness, metalness: 0, envMapIntensity: 0.35 });
  material.depthTest = false;
  material.depthWrite = false;
  return material;
}

export function createWaterMaterial(): MeshStandardMaterial {
  const material = new MeshStandardMaterial({
    color: "#86a6c3",
    roughness: 0.2,
    metalness: 0.02,
    envMapIntensity: 0.75,
  });
  material.depthTest = false;
  material.depthWrite = false;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = sceneUniforms.uTime;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec2 vWaterXZ;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvWaterXZ = position.xz;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform float uTime;\nvarying vec2 vWaterXZ;")
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
{
  vec2 p = vWaterXZ;
  float t = uTime;
  vec2 g = vec2(
    sin(p.x * 0.045 + t * 0.9) * 0.6 + sin((p.x + p.y) * 0.11 - t * 1.3) * 0.3 + sin(p.y * 0.23 + t * 1.7) * 0.15,
    cos(p.y * 0.05 - t * 0.8) * 0.6 + cos((p.x - p.y) * 0.09 + t * 1.1) * 0.3 + cos(p.x * 0.21 - t * 1.5) * 0.15
  ) * 0.045;
  vec3 ripple = normalize(vec3(g.x, 1.0, g.y));
  normal = normalize((viewMatrix * vec4(ripple, 0.0)).xyz);
}`,
      );
  };
  material.customProgramCacheKey = () => "water-v1";
  return material;
}

/** Dashed lane markings, faded out with distance to avoid shimmering. */
export function createMarkingMaterial(): MeshStandardMaterial {
  const material = createLayerMaterial(PALETTE.marking, 0.7);
  material.transparent = false;
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float lineDistance;\nvarying float vLineDistance;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvLineDistance = lineDistance;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying float vLineDistance;")
      .replace(
        "#include <clipping_planes_fragment>",
        `#include <clipping_planes_fragment>
if (fract(vLineDistance / 9.0) > 0.5) discard;
if (-vViewPosition.z > 2600.0) discard;`,
      );
  };
  material.customProgramCacheKey = () => "marking-v1";
  return material;
}

export function createSolidMaterial(color: string, roughness = 0.8, metalness = 0): MeshStandardMaterial {
  return new MeshStandardMaterial({ color, roughness, metalness });
}

export function createDoubleSidedMaterial(color: string, roughness = 0.8): MeshStandardMaterial {
  return new MeshStandardMaterial({ color, roughness, side: DoubleSide });
}

export function disposeMaterials(materials: Material[]): void {
  for (const m of materials) m.dispose();
}

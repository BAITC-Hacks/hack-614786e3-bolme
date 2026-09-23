/**
 * Shared materials for the clay city. Shader tweaks go through
 * onBeforeCompile so the standard PBR lighting, shadows and fog still apply.
 */
import { Color, DoubleSide, MeshStandardMaterial, type Material } from "three";
import { PALETTE } from "../palette";

/** Uniforms animated from the render loop. */
export const sceneUniforms = {
  uTime: { value: 0 },
  /** World metres per screen pixel at 1 m view distance (2·tan(fov/2) / viewport height). */
  uPixelScale: { value: 0.001 },
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
diffuseColor.rgb = mix(diffuseColor.rgb, uHighlightColor, vDistrictMatch * uHighlightMix * 0.26);`,
      );
  };
  material.customProgramCacheKey = () => "clay-building-v1";
  return material;
}

/**
 * Flat ground layer: drawn in painter's order on top of the ground plane.
 * With `minPixels`, ribbons carrying `aExpand` never get thinner than that many
 * screen pixels, so the road network stays readable on the zoomed-out map.
 */
export function createLayerMaterial(color: string, roughness = 0.95, minPixels = 0): MeshStandardMaterial {
  const material = new MeshStandardMaterial({ color, roughness, metalness: 0, envMapIntensity: 0.35 });
  material.depthTest = false;
  material.depthWrite = false;
  if (minPixels > 0) {
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uPixelScale = sceneUniforms.uPixelScale;
      shader.uniforms.uMinHalfPixels = { value: minPixels / 2 };
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nattribute vec2 aExpand;\nuniform float uPixelScale;\nuniform float uMinHalfPixels;")
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
{
  vec3 centre = transformed - vec3(aExpand.x, 0.0, aExpand.y);
  float viewDistance = max(1.0, -(modelViewMatrix * vec4(centre, 1.0)).z);
  float halfWidth = max(length(aExpand), 1e-3);
  float grow = max(1.0, uMinHalfPixels * uPixelScale * viewDistance / halfWidth);
  transformed.xz = centre.xz + aExpand * grow;
}`,
        );
    };
    material.customProgramCacheKey = () => `layer-min-px-${minPixels}`;
  }
  return material;
}

export function createWaterMaterial(): MeshStandardMaterial {
  const material = new MeshStandardMaterial({
    color: "#93aec6",
    roughness: 0.24,
    metalness: 0.02,
    envMapIntensity: 0.45,
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

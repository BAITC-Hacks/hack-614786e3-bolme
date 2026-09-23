/**
 * Tree records (trees.bin) → per-chunk instance data, and the unit tree mesh.
 */
import { BufferAttribute, BufferGeometry, CylinderGeometry, IcosahedronGeometry } from "three";
import { mergeGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { TREE_RECORD_BYTES, type TreesIndex } from "../schema";

export type TreeChunkData = {
  centerX: number;
  centerZ: number;
  count: number;
  x: Float32Array;
  z: Float32Array;
  height: Float32Array;
  conifer: Uint8Array;
  /** 0..1 random tint seed. */
  tint: Float32Array;
};

export function decodeTreeChunks(buffer: ArrayBuffer, index: TreesIndex): TreeChunkData[] {
  const view = new DataView(buffer);
  const scale = index.chunkSize / 65535;
  return index.chunks.map((chunk) => {
    const count = chunk.count;
    const data: TreeChunkData = {
      centerX: chunk.x + index.chunkSize / 2,
      centerZ: chunk.z + index.chunkSize / 2,
      count,
      x: new Float32Array(count),
      z: new Float32Array(count),
      height: new Float32Array(count),
      conifer: new Uint8Array(count),
      tint: new Float32Array(count),
    };
    for (let k = 0; k < count; k++) {
      const o = (chunk.offset + k) * TREE_RECORD_BYTES;
      data.x[k] = chunk.x + view.getUint16(o, true) * scale;
      data.z[k] = chunk.z + view.getUint16(o + 2, true) * scale;
      data.height[k] = view.getUint8(o + 4) / 10;
      const bits = view.getUint8(o + 5);
      data.conifer[k] = bits & 1;
      data.tint[k] = (bits >> 1) / 127;
    }
    return data;
  });
}

function jitter(x: number, y: number, z: number): number {
  const h = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
  return h - Math.floor(h);
}

/**
 * Unit-height tree (height 1): a lumpy crown plus a short trunk, with vertex
 * colours carrying a baked top-to-bottom occlusion gradient.
 */
export function createTreeGeometry(): BufferGeometry {
  let crown: BufferGeometry = new IcosahedronGeometry(1, 1);
  crown.deleteAttribute("uv");
  crown.deleteAttribute("normal");
  crown = mergeVertices(crown);
  const pos = crown.getAttribute("position") as BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const bump = 0.86 + jitter(x, y, z) * 0.28;
    // Flatten the underside a little, as real crowns are wider than deep.
    const yy = y < 0 ? y * 0.7 : y;
    pos.setXYZ(i, x * bump * 0.42, 0.6 + yy * bump * 0.4, z * bump * 0.42);
  }
  crown.computeVertexNormals();
  const crownColors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const t = Math.min(1, Math.max(0, (pos.getY(i) - 0.3) / 0.7));
    const shade = 0.55 + 0.45 * t;
    crownColors.set([shade, shade, shade], i * 3);
  }
  crown.setAttribute("color", new BufferAttribute(crownColors, 3));

  const trunk = new CylinderGeometry(0.03, 0.045, 0.34, 5, 1, true);
  trunk.translate(0, 0.17, 0);
  trunk.deleteAttribute("uv");
  const trunkColors = new Float32Array(trunk.getAttribute("position").count * 3).fill(0.42);
  trunk.setAttribute("color", new BufferAttribute(trunkColors, 3));

  const merged = mergeGeometries([crown.toNonIndexed(), trunk.toNonIndexed()]);
  if (!merged) throw new Error("Tree geometry merge failed");
  return merged;
}

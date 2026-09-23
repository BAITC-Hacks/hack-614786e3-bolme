/**
 * World-anchored DOM labels. UI components register an element with a world
 * position; LabelProjector (inside the Canvas) moves it every frame. One DOM
 * tree for all labels — no per-label React roots, no layout thrash.
 */
export type LabelAnchor = { el: HTMLElement; x: number; y: number; z: number };

export const labelAnchors = new Map<string, LabelAnchor>();

export function bindLabel(id: string, el: HTMLElement | null, x: number, y: number, z: number): void {
  if (el) labelAnchors.set(id, { el, x, y, z });
  else labelAnchors.delete(id);
}

// Floor plan layout: folders are rooms, files are cells sized by lines.
import type { FileNode } from "./types";

export type Rect = { x: number; y: number; w: number; h: number };
export type Room = Rect & { path: string; label: string; depth: number };
export type Cell = Rect & { path: string; lines: number; copies: number };
export type FloorPlan = { rooms: Room[]; cells: Cell[]; byPath: Map<string, Cell> };

type TreeNode = {
  name: string;
  path: string;
  value: number;
  children: TreeNode[];
  file?: FileNode;
};

const MIN_VALUE = 18;

function buildTree(files: FileNode[]): TreeNode {
  const root: TreeNode = { name: "", path: "", value: 0, children: [] };
  for (const f of files) {
    const parts = f.path.split("/");
    let node = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const path = parts.slice(0, i + 1).join("/");
      let child = node.children.find((c) => c.path === path && !c.file);
      if (!child) {
        child = { name: parts[i]!, path, value: 0, children: [] };
        node.children.push(child);
      }
      node = child;
    }
    node.children.push({
      name: parts[parts.length - 1]!,
      path: f.path,
      value: Math.max(MIN_VALUE, f.lines),
      children: [],
      file: f,
    });
  }
  const sum = (n: TreeNode): number => {
    if (n.file) return n.value;
    n.value = n.children.reduce((a, c) => a + sum(c), 0);
    return n.value;
  };
  sum(root);
  // Collapse single folder chains so "src" alone does not eat a level.
  const collapse = (n: TreeNode): TreeNode => {
    n.children = n.children.map(collapse);
    if (!n.file && n.children.length === 1 && !n.children[0]!.file && n.path) {
      const only = n.children[0]!;
      return { ...only, name: `${n.name}/${only.name}` };
    }
    return n;
  };
  return collapse(root);
}

function worst(row: number[], side: number): number {
  const s = row.reduce((a, b) => a + b, 0);
  const max = Math.max(...row);
  const min = Math.min(...row);
  const s2 = s * s;
  const side2 = side * side;
  return Math.max((side2 * max) / s2, s2 / (side2 * min));
}

/** Squarified treemap of values into rect. Returns rects in input order. */
function squarify(values: number[], rect: Rect): Rect[] {
  const total = values.reduce((a, b) => a + b, 0);
  const out: Rect[] = new Array(values.length);
  if (total <= 0 || rect.w <= 0 || rect.h <= 0) {
    values.forEach((_, i) => (out[i] = { x: rect.x, y: rect.y, w: 0, h: 0 }));
    return out;
  }
  const scale = (rect.w * rect.h) / total;
  const order = values
    .map((v, i) => ({ a: v * scale, i }))
    .sort((p, q) => q.a - p.a);
  let { x, y, w, h } = rect;
  let k = 0;
  while (k < order.length) {
    const side = Math.min(w, h);
    const row: typeof order = [order[k]!];
    k++;
    while (k < order.length) {
      const next = [...row.map((r) => r.a), order[k]!.a];
      if (worst(next, side) <= worst(row.map((r) => r.a), side)) {
        row.push(order[k]!);
        k++;
      } else break;
    }
    const area = row.reduce((a, r) => a + r.a, 0);
    if (w >= h) {
      const rw = area / h;
      let cy = y;
      for (const r of row) {
        const rh = r.a / rw;
        out[r.i] = { x, y: cy, w: rw, h: rh };
        cy += rh;
      }
      x += rw;
      w -= rw;
    } else {
      const rh = area / w;
      let cx = x;
      for (const r of row) {
        const rw = r.a / rh;
        out[r.i] = { x: cx, y, w: rw, h: rh };
        cx += rw;
      }
      y += rh;
      h -= rh;
    }
  }
  return out;
}

export function layoutFloorPlan(
  files: FileNode[],
  width: number,
  height: number,
  opts: { pad?: number; header?: number; gap?: number } = {},
): FloorPlan {
  const pad = opts.pad ?? 5;
  const header = opts.header ?? 15;
  const gap = opts.gap ?? 1.5;
  const rooms: Room[] = [];
  const cells: Cell[] = [];
  const tree = buildTree(files);

  const place = (node: TreeNode, rect: Rect, depth: number) => {
    if (node.file) {
      const c: Cell = {
        x: rect.x + gap / 2,
        y: rect.y + gap / 2,
        w: Math.max(0, rect.w - gap),
        h: Math.max(0, rect.h - gap),
        path: node.path,
        lines: node.file.lines,
        copies: node.file.copies,
      };
      cells.push(c);
      return;
    }
    let inner = rect;
    if (node.path) {
      const showHeader = rect.w > 60 && rect.h > header + 18;
      rooms.push({ ...rect, path: node.path, label: node.name, depth });
      inner = {
        x: rect.x + pad,
        y: rect.y + (showHeader ? header : pad),
        w: Math.max(0, rect.w - pad * 2),
        h: Math.max(0, rect.h - (showHeader ? header : pad) - pad),
      };
    }
    const rects = squarify(
      node.children.map((c) => c.value),
      inner,
    );
    node.children.forEach((c, i) => place(c, rects[i]!, depth + 1));
  };
  place(tree, { x: 0, y: 0, w: width, h: height }, 0);
  return { rooms, cells, byPath: new Map(cells.map((c) => [c.path, c])) };
}

import fs from "node:fs";
import path from "node:path";

import { ts } from "./ts-morph.js";

export type Diag = { file: string; line: number; col: number; code: string; message: string };
export type CheckResult = {
  diags: Diag[];
  coveredFiles: string[];
  ms: number;
  build?: { ran: boolean; ok: boolean; ms: number; tail?: string };
  /** The repo's own test script, run with the network off. */
  tests?: { ran: boolean; ok: boolean; ms: number; tail?: string };
};

export const MIN_COVERAGE = 0.6;

function readConfig(file: string): any | null {
  try {
    const text = fs.readFileSync(file, "utf8");
    const parsed = ts.parseConfigFileTextToJson(file, text);
    return parsed.error ? null : parsed.config;
  } catch {
    return null;
  }
}

/**
 * Configs to type check: `["tsconfig.json"]`, or the referenced configs when the
 * root config is a solution file (has `references` and `files: []`).
 * With no root tsconfig.json, the nested package configs; `[]` when there are none.
 */
const SKIP_DIRS = new Set(["node_modules", "dist", "build", "out", "coverage", "vendor"]);

/**
 * Package configs in a repo with no root tsconfig.json (a monorepo of separate
 * packages): every nested tsconfig.json up to four folders deep, outermost first,
 * skipping folders already covered by an outer config.
 */
export function nestedTargets(dir: string, maxDepth = 4, limit = 12): string[] {
  const found: string[] = [];
  const walk = (rel: string, depth: number) => {
    if (depth > maxDepth || found.length >= limit) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(path.join(dir, rel), { withFileTypes: true });
    } catch {
      return;
    }
    if (rel && entries.some((e) => e.isFile() && e.name === "tsconfig.json")) {
      found.push(path.posix.join(rel, "tsconfig.json"));
      return;
    }
    for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (!e.isDirectory() || e.name.startsWith(".") || SKIP_DIRS.has(e.name)) continue;
      walk(rel ? `${rel}/${e.name}` : e.name, depth + 1);
    }
  };
  walk("", 0);
  return found;
}

export function checkTargets(dir: string): string[] {
  const root = readConfig(path.join(dir, "tsconfig.json"));
  if (!root || typeof root !== "object") {
    if (fs.existsSync(path.join(dir, "tsconfig.json"))) return ["tsconfig.json"];
    const nested = nestedTargets(dir);
    if (nested.length > 0) return nested;
    // A JavaScript repo with a jsconfig.json can still be checked.
    return fs.existsSync(path.join(dir, "jsconfig.json")) ? ["jsconfig.json"] : [];
  }
  const refs: unknown[] = Array.isArray(root.references) ? root.references : [];
  const solution = refs.length > 0 && Array.isArray(root.files) && root.files.length === 0 && !root.include;
  if (!solution) return ["tsconfig.json"];
  const out: string[] = [];
  for (const r of refs) {
    const p = (r as { path?: unknown })?.path;
    if (typeof p !== "string") continue;
    let rel = path.posix.normalize(p.replace(/\\/g, "/"));
    if (rel.startsWith("../") || path.posix.isAbsolute(rel)) continue;
    if (!rel.endsWith(".json")) {
      rel = fs.existsSync(path.join(dir, rel, "tsconfig.json"))
        ? path.posix.join(rel, "tsconfig.json")
        : `${rel}.json`;
    }
    if (fs.existsSync(path.join(dir, rel)) && !out.includes(rel)) out.push(rel);
  }
  return out.length ? out : ["tsconfig.json"];
}

function normRoot(root: string): { posix: string; ci: boolean } {
  let r = root.replace(/\\/g, "/").replace(/\/+$/, "");
  const ci = /^[A-Za-z]:/.test(r);
  if (ci) r = r.toLowerCase();
  return { posix: r, ci };
}

/** Repo-relative POSIX path, or null when the file is outside the repo. */
function relativise(file: string, root: { posix: string; ci: boolean }): string | null {
  let f = file.trim().replace(/\\/g, "/");
  const abs = f.startsWith("/") || /^[A-Za-z]:\//.test(f);
  if (abs) {
    const cmp = root.ci ? f.toLowerCase() : f;
    if (cmp === root.posix) return null;
    if (!cmp.startsWith(`${root.posix}/`)) return null;
    f = f.slice(root.posix.length + 1);
  }
  f = path.posix.normalize(f);
  if (f.startsWith("./")) f = f.slice(2);
  if (f.startsWith("../")) return null;
  return f;
}

function inNodeModules(f: string): boolean {
  return f === "node_modules" || f.startsWith("node_modules/") || f.includes("/node_modules/");
}

const DIAG_RE = /^(.+?)\((\d+),(\d+)\): (error|warning|message) (TS\d+): (.*)$/;
const GLOBAL_RE = /^(error|warning|message) (TS\d+): (.*)$/;
const ABS_RE = /^(?:\/|[A-Za-z]:[\\/])\S/;

/**
 * Parse `tsgo --noEmit --pretty false --listFiles -p <cfg>` output. Diagnostics in
 * node_modules are dropped; paths become repo-relative.
 */
export function parseTsgo(stdout: string, root: string): { diags: Diag[]; files: string[] } {
  const r = normRoot(root);
  const diags: Diag[] = [];
  const files = new Set<string>();
  let last: Diag | null = null;

  for (const rawLine of stdout.split(/\r?\n/)) {
    const line = rawLine.replace(/\s+$/, "");
    if (!line) continue;

    // Continuation of a multi-line message (indented chain).
    if (/^\s/.test(line)) {
      if (last) last.message += `\n${line.trim()}`;
      continue;
    }

    const m = DIAG_RE.exec(line);
    if (m) {
      const file = relativise(m[1]!, r);
      const d: Diag = {
        file: file ?? m[1]!.replace(/\\/g, "/"),
        line: Number(m[2]),
        col: Number(m[3]),
        code: m[5]!,
        message: m[6]!,
      };
      last = d;
      if (file === null || !inNodeModules(file)) diags.push(d);
      continue;
    }
    const g = GLOBAL_RE.exec(line);
    if (g) {
      const d: Diag = { file: "", line: 0, col: 0, code: g[2]!, message: g[3]! };
      last = d;
      diags.push(d);
      continue;
    }
    if (ABS_RE.test(line) || /\.(ts|tsx|js|jsx|mjs|cjs|mts|cts|json)$/.test(line)) {
      last = null;
      const f = relativise(line, r);
      if (f && !inNodeModules(f)) files.add(f);
      continue;
    }
    // Summary lines ("Found 2 errors") and anything else: end any open message.
    last = null;
  }
  return { diags, files: [...files].sort() };
}

function keyOf(d: Diag): string {
  return `${d.code}\u0000${d.message}`;
}

/**
 * Multiset comparison on code + message. The file is ignored, so an existing
 * error that moved with the code into the shared file is not counted as new.
 */
export function compareDiags(base: Diag[], after: Diag[]): { added: Diag[]; fixed: number } {
  const counts = new Map<string, number>();
  for (const d of base) counts.set(keyOf(d), (counts.get(keyOf(d)) ?? 0) + 1);
  const added: Diag[] = [];
  for (const d of after) {
    const k = keyOf(d);
    const n = counts.get(k) ?? 0;
    if (n > 0) counts.set(k, n - 1);
    else added.push(d);
  }
  let fixed = 0;
  for (const n of counts.values()) fixed += n;
  return { added, fixed };
}

export function coverage(covered: string[], scanned: string[]): { covered: number; total: number; ratio: number } {
  const set = new Set(covered);
  const total = scanned.length;
  const hit = scanned.filter((f) => set.has(f)).length;
  return { covered: hit, total, ratio: total === 0 ? 0 : hit / total };
}

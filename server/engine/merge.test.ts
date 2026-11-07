import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { Project, ts } from "ts-morph";
import { afterAll, describe, expect, it } from "vitest";

import { EngineError } from "./errors.js";
import { kebab, lineDiff, planMerge } from "./merge.js";
import type { MergePlan } from "./merge.js";
import { scanRepo } from "./scan.js";

const dirs: string[] = [];
function makeRepo(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "twins-merge-"));
  dirs.push(dir);
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
  }
  return dir;
}
afterAll(() => {
  for (const d of dirs) fs.rmSync(d, { recursive: true, force: true });
});

function apply(dir: string, plan: MergePlan) {
  for (const e of plan.edits) {
    const abs = path.join(dir, e.path);
    if (e.after === null) fs.rmSync(abs, { force: true });
    else {
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, e.after);
    }
  }
}

/** Real in-process type check of every .ts file in the fixture. */
function typeErrors(dir: string): string[] {
  const files: string[] = [];
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.tsx?$/.test(e.name)) files.push(p);
    }
  };
  walk(dir);
  const project = new Project({
    compilerOptions: {
      strict: true,
      noEmit: true,
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      noUnusedLocals: true,
      lib: ["lib.es2022.d.ts"],
      types: [],
    },
  });
  for (const f of files) project.addSourceFileAtPath(f);
  return project.getPreEmitDiagnostics().map((d) => {
    const raw = d.getMessageText();
    const msg = typeof raw === "string" ? raw : ts.flattenDiagnosticMessageText(raw.compilerObject, "\n");
    const file = d.getSourceFile();
    return file ? `${path.relative(dir, file.getFilePath())}: ${msg}` : msg;
  });
}

const code = (fn: () => unknown) => {
  try {
    fn();
    return "none";
  } catch (e) {
    expect(e).toBeInstanceOf(EngineError);
    return (e as EngineError).code;
  }
};

const sharedBlock = `type Opts = { scale: number };
const FACTOR = 3;
function scaleIt(n: number, o: Opts): number {
  return n * o.scale * FACTOR + helperDep(n);
}
`;
const computeBody = (name: string) => `function ${name}(xs: number[], o: Opts): number {
  const ok = parseNumbers(xs);
  let t = 0;
  for (const x of ok) t += scaleIt(x, o);
  return t;
}
`;

function fixture() {
  return makeRepo({
    "src/util/dep.ts": "export function helperDep(n: number): number { return n + 1; }\n",
    "src/util/schema.ts":
      "export function parseNumbers(xs: number[]): number[] { return xs.filter((x) => !Number.isNaN(x)); }\n",
    "src/util/other.ts": "export function other(n: number): number { return n * 10; }\n",
    "src/lib/one.ts": `import { parseNumbers } from "../util/schema";
import { helperDep } from "../util/dep";
import { other } from "../util/other";

${sharedBlock}
export ${computeBody("compute")}
export const keep = () => other(1);
`,
    "src/feature/two.ts": `import { helperDep } from "../util/dep";
import { parseNumbers } from "../util/schema";

${sharedBlock}
${computeBody("calc")}
export const useIt = () => calc([1, 2], { scale: 1 });
`,
    "src/feature/uses-one.ts": `import { compute } from "../lib/one";\nexport const v = compute([3], { scale: 2 });\n`,
  });
}

describe("planMerge", () => {
  it("merges exact copies into a shared module that type checks", () => {
    const dir = fixture();
    expect(typeErrors(dir)).toEqual([]);
    const scan = scanRepo(dir);
    const set = scan.sets.find((s) => s.name === "calc / compute")!;
    expect(set.kind).toBe("exact");
    expect(set.mergeable).toBe(true);

    const plan = planMerge(dir, set);
    expect(plan.canonicalName).toBe("calc"); // members sorted by path: src/feature first
    expect(plan.sharedPath).toBe("src/calc.ts");
    const shared = plan.edits.find((e) => e.path === plan.sharedPath)!;
    expect(shared.before).toBeNull();
    const text = shared.after!;

    // transitive helpers and types, exported, in order, then the canonical decl
    const order = ["export type Opts", "export const FACTOR", "export function scaleIt", "export function calc"].map(
      (s) => text.indexOf(s),
    );
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    // re-relativised imports (from src/feature to src)
    expect(text).toContain(`import { helperDep } from "./util/dep";`);
    expect(text).toContain(`import { parseNumbers } from "./util/schema";`);
    expect(text).not.toContain("other");

    const one = plan.edits.find((e) => e.path === "src/lib/one.ts")!.after!;
    expect(one).toContain(`import { calc as compute } from "../calc";`);
    expect(one).toContain("export { compute };");
    expect(one).not.toMatch(/function scaleIt|const FACTOR|type Opts|function compute/);
    // unused import cleanup, unrelated imports kept
    expect(one).not.toContain("../util/schema");
    expect(one).not.toContain("../util/dep");
    expect(one).toContain(`import { other } from "../util/other";`);

    const two = plan.edits.find((e) => e.path === "src/feature/two.ts")!.after!;
    expect(two).toContain(`import { calc } from "../calc";`);
    expect(two).not.toContain("export { calc }");
    expect(two).not.toContain("helperDep");

    expect(plan.linesAdded).toBeGreaterThan(0);
    expect(plan.linesRemoved).toBeGreaterThan(0);

    apply(dir, plan);
    expect(typeErrors(dir)).toEqual([]);
    const after = scanRepo(dir).sets.filter((s) => s.members.some((m) => m.name === "calc" || m.name === "compute"));
    expect(after).toHaveLength(0);
  });

  it("keeps helpers that the member file still uses", () => {
    const dir = fixture();
    fs.appendFileSync(path.join(dir, "src/feature/two.ts"), "export const alsoScale = scaleIt(1, { scale: 1 });\n");
    const set = scanRepo(dir).sets.find((s) => s.name === "calc / compute")!;
    const plan = planMerge(dir, set);
    const two = plan.edits.find((e) => e.path === "src/feature/two.ts")!.after!;
    expect(two).toContain("function scaleIt");
    expect(two).toContain("const FACTOR");
    expect(two).toContain("helperDep");
    expect(two).not.toContain("parseNumbers");
    apply(dir, plan);
    expect(typeErrors(dir)).toEqual([]);
  });

  it("honours memberIds and a caller-given sharedPath", () => {
    const dir = fixture();
    fs.writeFileSync(
      path.join(dir, "src/three.ts"),
      `import { helperDep } from "./util/dep";\nimport { parseNumbers } from "./util/schema";\n\n${sharedBlock}\nexport ${computeBody("third")}`,
    );
    const set = scanRepo(dir).sets.find((s) => s.members.length === 3)!;
    expect(set.kind).toBe("exact");
    const ids = set.members.filter((m) => m.name !== "third").map((m) => m.id);
    const plan = planMerge(dir, set, { memberIds: ids, sharedPath: "src/shared/compute.ts" });
    expect(plan.sharedPath).toBe("src/shared/compute.ts");
    expect(plan.edits.map((e) => e.path).sort()).toEqual([
      "src/feature/two.ts",
      "src/lib/one.ts",
      "src/shared/compute.ts",
    ]);
    expect(plan.edits.find((e) => e.path === "src/shared/compute.ts")!.after).toContain(`from "../util/dep"`);
    apply(dir, plan);
    expect(typeErrors(dir)).toEqual([]);
  });

  it("rejects near copies, bad paths and unknown members", () => {
    const dir = fixture();
    const onePath = path.join(dir, "src/lib/one.ts");
    fs.writeFileSync(onePath, fs.readFileSync(onePath, "utf8").replace("let t = 0;", "let t = 1;"));
    const near = scanRepo(dir).sets.find((s) => s.name === "calc / compute")!;
    expect(near.kind).toBe("near");
    expect(code(() => planMerge(dir, near))).toBe("near_copies");

    const exact = { ...near, kind: "exact" as const, members: near.members.map((m) => ({ ...m, variant: 0 })) };
    expect(code(() => planMerge(dir, exact, { sharedPath: "../evil.ts" }))).toBe("invalid_shared_path");
    expect(code(() => planMerge(dir, exact, { sharedPath: "src/x.js" }))).toBe("invalid_shared_path");
    expect(code(() => planMerge(dir, exact, { sharedPath: "src/util/dep.ts" }))).toBe("invalid_shared_path");
    expect(code(() => planMerge(dir, exact, { memberIds: ["nope"] }))).toBe("unknown_member");
    expect(code(() => planMerge(dir, exact, { memberIds: [exact.members[0]!.id] }))).toBe("too_few_members");
  });

  it("uses src/shared at the repo root, adds -shared on clashes, and handles arrow consts", () => {
    const fn = (n: string, exp: boolean) => `${exp ? "export " : ""}const ${n} = (input: string): string => {
  const parts = input.split(",");
  const out = parts.map((p) => p.trim()).filter((p) => p.length > 0);
  return out.join(" | ");
};
`;
    const dir = makeRepo({
      "a/x.ts": `'use client';\n${fn("joinParts", true)}`,
      "b/y.ts": `${fn("joinParts", false)}export const z = joinParts("a,b");\n`,
      "src/shared/join-parts.ts": "export {};\n",
    });
    const set = scanRepo(dir).sets[0]!;
    expect(set.kind).toBe("exact");
    const plan = planMerge(dir, set);
    expect(plan.sharedPath).toBe("src/shared/join-parts-shared.ts");
    const x = plan.edits.find((e) => e.path === "a/x.ts")!.after!;
    expect(x.indexOf("'use client'")).toBe(0);
    expect(x).toContain(`import { joinParts } from "../src/shared/join-parts-shared";`);
    expect(x).toContain("export { joinParts };");
    expect(plan.edits.find((e) => e.path === plan.sharedPath)!.after).toContain("export const joinParts = (input");
    apply(dir, plan);
    expect(typeErrors(dir)).toEqual([]);
  });
});

describe("planMerge layout details", () => {
  const fn = (n: string) => `function ${n}(value: string): string {
  const parts = value.split("-");
  const out = parts.map((p) => p.toUpperCase()).filter((p) => p.length > 1);
  return out.join("+");
}
`;

  it("inserts the import after the last import even with a leading comment", () => {
    const dir = makeRepo({
      "src/dep.ts": "export const dep = 1;\n",
      "src/a.ts": `// generated header\nimport { dep } from './dep';\n\n${fn("shout")}\nexport const a = shout('x') + dep;\n`,
      "src/b.ts": `// another header\n\n${fn("shout")}\nexport const b = shout('y');\n`,
    });
    const plan = planMerge(dir, scanRepo(dir).sets[0]!);
    const a = plan.edits.find((e) => e.path === "src/a.ts")!.after!;
    expect(a).toBe(
      `// generated header\nimport { dep } from './dep';\nimport { shout } from './shout';\n\nexport const a = shout('x') + dep;\n`,
    );
    const b = plan.edits.find((e) => e.path === "src/b.ts")!.after!;
    expect(b.startsWith("// another header")).toBe(true);
    expect(b).toContain(`import { shout } from "./shout";`);
    apply(dir, plan);
    expect(typeErrors(dir)).toEqual([]);
  });

  it("refuses copies that get properties set on them (displayName)", () => {
    const dir = makeRepo({
      "src/a.ts": `${fn("Footer")}\nFooter.displayName = "Footer";\nexport { Footer };\n`,
      "src/b.ts": `${fn("SheetFooter")}\nexport { SheetFooter };\n`,
    });
    const set = scanRepo(dir).sets[0]!;
    expect(set.kind).toBe("exact");
    expect(set.mergeable).toBe(false);
    expect(set.reason).toMatch(/displayName/);
    expect(code(() => planMerge(dir, set))).toBe("assigned_member");
  });

  it("does not add a second export when the member is exported through an export list", () => {
    const dir = makeRepo({
      "src/a.ts": `${fn("one")}\nexport { one };\n`,
      "src/b.ts": `${fn("two")}\nexport { two as renamed };\n`,
    });
    const set = scanRepo(dir).sets[0]!;
    expect(set.members.every((m) => m.exported)).toBe(true);
    const plan = planMerge(dir, set);
    const b = plan.edits.find((e) => e.path === "src/b.ts")!.after!;
    expect(b).toContain(`import { one as two } from "./one";`);
    expect(b.match(/export \{/g)).toHaveLength(1);
    apply(dir, plan);
    expect(typeErrors(dir)).toEqual([]);
  });
});

describe("merge helpers", () => {
  it("kebab-cases names", () => {
    expect(kebab("createSupabaseFetch")).toBe("create-supabase-fetch");
    expect(kebab("DialogFooter")).toBe("dialog-footer");
    expect(kebab("parseURLValue")).toBe("parse-url-value");
  });
  it("counts line diffs", () => {
    expect(lineDiff(null, "a\nb\n")).toEqual({ removed: 0, added: 3 });
    expect(lineDiff("a\nb\nc", "a\nc")).toEqual({ removed: 1, added: 0 });
    expect(lineDiff("a\nb\nc", "a\nB\nc\nd")).toEqual({ removed: 1, added: 2 });
  });
});

describe("packages and Node ESM imports", () => {
  const body = `export function clampValue(n: number, lo: number, hi: number): number {
  if (n < lo) return lo;
  if (n > hi) return hi;
  const mid = (lo + hi) / 2;
  return Number.isFinite(n) ? n : mid;
}
`;

  it("does not offer a one click merge across separate packages", () => {
    const dir = makeRepo({
      "packages/a/package.json": "{}",
      "packages/a/src/x.ts": body,
      "packages/b/package.json": "{}",
      "packages/b/src/y.ts": body,
    });
    const set = scanRepo(dir).sets.find((s) => s.name === "clampValue")!;
    expect(set.mergeable).toBe(false);
    expect(set.reason).toMatch(/separate packages/);
  });

  it("adds .js to the new import when the package resolves modules the NodeNext way", () => {
    const dir = makeRepo({
      "pkg/package.json": "{}",
      "pkg/tsconfig.json": `{ "compilerOptions": { "module": "NodeNext", "moduleResolution": "NodeNext" } }`,
      "pkg/src/one/x.ts": body,
      "pkg/src/two/y.ts": body,
    });
    const set = scanRepo(dir).sets.find((s) => s.name === "clampValue")!;
    expect(set.mergeable).toBe(true);
    const plan = planMerge(dir, set);
    for (const e of plan.edits.filter((e) => e.before !== null)) {
      expect(e.after).toMatch(/from ["']\.\.\/clamp-value\.js["']/);
    }
  });
});

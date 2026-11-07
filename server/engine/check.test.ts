import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { checkTargets, compareDiags, coverage, parseTsgo } from "./check.js";
import type { Diag } from "./check.js";

const dirs: string[] = [];
function makeRepo(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "twins-check-"));
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

const SAMPLE = [
  "C:/Users/me/repo/node_modules/typescript/lib/lib.es5.d.ts",
  "C:/tmp/checker/node_modules/@typescript/native-preview/lib/lib.dom.d.ts",
  "C:/Users/me/repo/src/a.ts",
  "C:\\Users\\me\\repo\\src\\b.tsx",
  "C:/Users/me/other/outside.ts",
  "src/a.ts(3,5): error TS2322: Type 'string' is not assignable to type 'number'.",
  "src/b.tsx(10,1): error TS2345: Argument of type '{ a: string; }' is not assignable to parameter of type 'Foo'.",
  "  Property 'b' is missing in type '{ a: string; }' but required in type 'Foo'.",
  "    Extra detail line.",
  "node_modules/pkg/index.d.ts(1,1): error TS1000: Broken typings.",
  "  continuation of a dropped diagnostic",
  "C:/Users/me/repo/src/c.ts(2,2): error TS2304: Cannot find name 'x'.",
  "error TS5083: Cannot read file 'C:/Users/me/repo/tsconfig.base.json'.",
  "",
  "Found 4 errors.",
].join("\r\n");

describe("parseTsgo", () => {
  it("parses diagnostics, multi-line messages and --listFiles lines", () => {
    const { diags, files } = parseTsgo(SAMPLE, "C:\\Users\\me\\repo\\");
    expect(files).toEqual(["src/a.ts", "src/b.tsx"]);
    expect(diags).toHaveLength(4);
    expect(diags[0]).toEqual({
      file: "src/a.ts",
      line: 3,
      col: 5,
      code: "TS2322",
      message: "Type 'string' is not assignable to type 'number'.",
    });
    expect(diags[1]!.message).toBe(
      "Argument of type '{ a: string; }' is not assignable to parameter of type 'Foo'.\n" +
        "Property 'b' is missing in type '{ a: string; }' but required in type 'Foo'.\n" +
        "Extra detail line.",
    );
    expect(diags[2]).toMatchObject({ file: "src/c.ts", line: 2, col: 2, code: "TS2304" });
    expect(diags[3]).toMatchObject({ file: "", line: 0, code: "TS5083" });
    expect(diags.some((d) => d.file.includes("node_modules"))).toBe(false);
  });

  it("works with POSIX sandbox roots", () => {
    const out = [
      "/vercel/sandbox/src/x.ts",
      "/tmp/checker/node_modules/@typescript/native-preview/lib/lib.es5.d.ts",
      "/vercel/sandbox/node_modules/react/index.d.ts",
      "src/x.ts(1,7): error TS2322: Type 'number' is not assignable to type 'string'.",
    ].join("\n");
    const { diags, files } = parseTsgo(out, "/vercel/sandbox");
    expect(files).toEqual(["src/x.ts"]);
    expect(diags).toHaveLength(1);
    expect(parseTsgo("", "/vercel/sandbox")).toEqual({ diags: [], files: [] });
  });
});

const d = (file: string, code: string, message: string, line = 1): Diag => ({ file, line, col: 1, code, message });

describe("compareDiags", () => {
  it("treats diagnostics as a multiset on code and message", () => {
    const base = [d("a.ts", "TS1", "m1"), d("a.ts", "TS1", "m1"), d("b.ts", "TS2", "m2")];
    // one m1 moved to a new file, m2 fixed, one new error
    const after = [d("a.ts", "TS1", "m1"), d("shared.ts", "TS1", "m1", 9), d("c.ts", "TS3", "m3")];
    const r = compareDiags(base, after);
    expect(r.added).toEqual([d("c.ts", "TS3", "m3")]);
    expect(r.fixed).toBe(1);
  });

  it("counts a duplicated error as added", () => {
    const r = compareDiags([d("a.ts", "TS1", "m1")], [d("a.ts", "TS1", "m1"), d("b.ts", "TS1", "m1")]);
    expect(r.added).toHaveLength(1);
    expect(r.fixed).toBe(0);
  });

  it("is clean for identical runs", () => {
    const base = [d("a.ts", "TS1", "m1")];
    expect(compareDiags(base, [...base])).toEqual({ added: [], fixed: 0 });
  });
});

describe("checkTargets", () => {
  it("returns referenced configs for a solution-style tsconfig", () => {
    const dir = makeRepo({
      "tsconfig.json": `{
        // Lovable / Vite style
        "files": [],
        "references": [
          { "path": "./tsconfig.app.json" },
          { "path": "./tsconfig.node.json" },
          { "path": "./packages/api" },
          { "path": "./missing.json" },
        ],
      }`,
      "tsconfig.app.json": "{}",
      "tsconfig.node.json": "{}",
      "packages/api/tsconfig.json": "{}",
    });
    expect(checkTargets(dir)).toEqual(["tsconfig.app.json", "tsconfig.node.json", "packages/api/tsconfig.json"]);
  });

  it("returns tsconfig.json for a plain config, and [] without one", () => {
    const plain = makeRepo({ "tsconfig.json": `{ "include": ["src"], "references": [{ "path": "./x.json" }] }` });
    expect(checkTargets(plain)).toEqual(["tsconfig.json"]);
    expect(checkTargets(makeRepo({ "a.js": "" }))).toEqual([]);
  });

  it("finds package configs in a monorepo with no root tsconfig", () => {
    const dir = makeRepo({
      "app/tsconfig.json": "{}",
      "app/src/inner/tsconfig.json": "{}",
      "packages/core/tsconfig.json": "{}",
      "packages/keeper/tsconfig.json": "{}",
      "agent/a/b/c/tsconfig.json": "{}",
      "agent/a/b/c/d/e/tsconfig.json": "{}",
      "node_modules/x/tsconfig.json": "{}",
      ".github/tsconfig.json": "{}",
      "relay/index.js": "",
    });
    expect(checkTargets(dir)).toEqual([
      "agent/a/b/c/tsconfig.json",
      "app/tsconfig.json",
      "packages/core/tsconfig.json",
      "packages/keeper/tsconfig.json",
    ]);
  });
});

describe("coverage", () => {
  it("counts scanned files the checker covered", () => {
    expect(coverage(["a.ts", "b.ts", "lib/x.ts"], ["a.ts", "b.ts", "c.ts", "d.ts"])).toEqual({
      covered: 2,
      total: 4,
      ratio: 0.5,
    });
    expect(coverage([], [])).toEqual({ covered: 0, total: 0, ratio: 0 });
  });
});

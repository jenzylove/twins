import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { resolveImport, scanRepo } from "./scan.js";

const dirs: string[] = [];
function makeRepo(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "twins-scan-"));
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

const body = (name: string, lit = "2", call = "x * " + lit) => `function ${name}(xs: number[]): number {
  let total = 0;
  for (const x of xs) {
    if (x > 0) total += ${call};
  }
  return total;
}
`;

describe("scanRepo", () => {
  it("groups exact copies with different names as one variant", () => {
    const dir = makeRepo({
      "src/a.ts": `export ${body("sumAll")}`,
      "src/b.ts": `${body("total")}\nexport const t = total([1]);\n`,
    });
    const r = scanRepo(dir);
    expect(r.sets).toHaveLength(1);
    const set = r.sets[0]!;
    expect(set.kind).toBe("exact");
    expect(set.name).toBe("sumAll / total");
    expect(new Set(set.members.map((m) => m.variant)).size).toBe(1);
    expect(set.mergeable).toBe(true);
    expect(set.members.find((m) => m.name === "sumAll")!.exported).toBe(true);
    expect(set.members.find((m) => m.name === "total")!.exported).toBe(false);
    expect(set.id).toMatch(/^[0-9a-f]{12}$/);
    expect(set.duplicateLines).toBe(7);
    expect(r.totals.sets).toBe(1);
    expect(r.files.find((f) => f.path === "src/a.ts")!.copies).toBe(1);
  });

  it("treats the same text calling different modules as near copies", () => {
    const fmt = (n: string) => `export function fmt(n: number): number { return n + ${n}; }\n`;
    const dir = makeRepo({
      "src/fmt-a.ts": fmt("1"),
      "src/fmt-b.ts": fmt("2"),
      "src/c.ts": `import { fmt } from "./fmt-a";\n${body("score", "", "fmt(x)")}`,
      "src/d.ts": `import { fmt } from "./fmt-b";\n${body("score", "", "fmt(x)")}`,
    });
    const set = scanRepo(dir).sets.find((s) => s.name === "score")!;
    expect(set.kind).toBe("near");
    expect(new Set(set.members.map((m) => m.variant)).size).toBe(2);
    expect(set.mergeable).toBe(false);
    expect(set.reason).toBeTruthy();
  });

  it("treats the same text calling the same module through different specifiers as exact", () => {
    const dir = makeRepo({
      "tsconfig.json": `{ "compilerOptions": { "paths": { "@/*": ["./src/*"] } } }`,
      "src/lib/fmt.ts": `export function fmt(n: number): number { return n + 1; }\n`,
      "src/c.ts": `import { fmt } from "./lib/fmt";\n${body("score", "", "fmt(x)")}`,
      "src/deep/d.ts": `import { fmt } from "@/lib/fmt";\n${body("score", "", "fmt(x)")}`,
    });
    const set = scanRepo(dir).sets.find((s) => s.name === "score")!;
    expect(set.kind).toBe("exact");
  });

  it("labels copies that differ only in a literal as near", () => {
    const dir = makeRepo({
      "src/a.ts": body("double", "2"),
      "src/b.ts": body("triple", "3"),
    });
    const set = scanRepo(dir).sets[0]!;
    expect(set.kind).toBe("near");
    expect(set.members.map((m) => m.variant).sort()).toEqual([0, 1]);
  });

  it("is not mergeable for default exports or two copies in one file", () => {
    const dir = makeRepo({
      "src/a.ts": `export default ${body("one")}`,
      "src/b.ts": body("two"),
      "src/c.ts": `${body("p")}\n${body("q")}`,
    });
    const set = scanRepo(dir).sets[0]!;
    expect(set.kind).toBe("exact");
    expect(set.mergeable).toBe(false);
    expect(set.members.find((m) => m.name === "one")!.isDefault).toBe(true);
  });

  it("skips tiny functions, excluded folders, tests and components/ui", () => {
    const tiny = (n: string) => `export const ${n} = (a: number) => a + 1;\n`;
    const dir = makeRepo({
      "src/a.ts": tiny("a") + body("keep1"),
      "src/b.ts": tiny("b"),
      "src/a.test.ts": body("t1"),
      "src/components/ui/x.tsx": body("ui1"),
      "dist/x.js": body("d1"),
      "node_modules/p/index.js": body("n1"),
      "src/types.d.ts": "declare const x: number;\n",
    });
    const r = scanRepo(dir);
    expect(r.files.map((f) => f.path)).toEqual(["src/a.ts", "src/b.ts"]);
    expect(r.sets).toHaveLength(0);
  });

  it("finds arrow function consts and marks JSX components", () => {
    const comp = (n: string) => `export const ${n} = ({ title }: { title: string }) => {
  const upper = title.toUpperCase();
  return (
    <div className="box">
      <h1>{upper}</h1>
      <p>{title.length}</p>
    </div>
  );
};
`;
    const dir = makeRepo({ "src/a.tsx": comp("CardA"), "src/b.tsx": comp("CardB") });
    const set = scanRepo(dir).sets[0]!;
    expect(set.isComponent).toBe(true);
    expect(set.members[0]!.declKind).toBe("const");
    expect(set.kind).toBe("exact");
  });

  it("builds the file map with resolved imports", () => {
    const dir = makeRepo({
      "tsconfig.json": `{ "files": [], "references": [{ "path": "./tsconfig.app.json" }] }`,
      "tsconfig.app.json": `{
        // comments are fine
        "compilerOptions": { "baseUrl": ".", "paths": { "@/*": ["./src/*"] } }
      }`,
      "src/lib/util.ts": "export const u = 1;\n",
      "src/lib/index.ts": "export * from './util';\n",
      "src/main.ts": `import { u } from "@/lib/util";\nimport x from "./lib";\nimport React from "react";\nimport "./style.css";\nexport const m = u + x;\n`,
    });
    const r = scanRepo(dir);
    expect(r.files.find((f) => f.path === "src/main.ts")!.imports).toEqual(["src/lib/index.ts", "src/lib/util.ts"]);
    expect(r.files.find((f) => f.path === "src/lib/index.ts")!.imports).toEqual(["src/lib/util.ts"]);
    expect(r.totals.files).toBe(3);
  });
});

describe("resolveImport", () => {
  const dir = makeRepo({
    "tsconfig.json": `{ "compilerOptions": { "paths": { "@/*": ["./src/*"], "~utils": ["./src/utils/index.ts"] } } }`,
    "src/a.ts": "",
    "src/b.tsx": "",
    "src/utils/index.ts": "",
    "src/old.js": "",
  });
  it("resolves relative, alias, index, and .js specs", () => {
    expect(resolveImport(dir, "src/x/y.ts", "../a")).toBe("src/a.ts");
    expect(resolveImport(dir, "src/x.ts", "./b")).toBe("src/b.tsx");
    expect(resolveImport(dir, "src/x.ts", "./a.js")).toBe("src/a.ts");
    expect(resolveImport(dir, "src/x.ts", "./old.js")).toBe("src/old.js");
    expect(resolveImport(dir, "src/x.ts", "./utils")).toBe("src/utils/index.ts");
    expect(resolveImport(dir, "lib/q.ts", "@/a")).toBe("src/a.ts");
    expect(resolveImport(dir, "lib/q.ts", "~utils")).toBe("src/utils/index.ts");
  });
  it("leaves packages, missing files and escapes unresolved", () => {
    expect(resolveImport(dir, "src/x.ts", "react")).toBeNull();
    expect(resolveImport(dir, "src/x.ts", "./missing")).toBeNull();
    expect(resolveImport(dir, "src/x.ts", "../../outside")).toBeNull();
  });
});

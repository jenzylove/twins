import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { ts } from "./ts-morph.js";

import { EngineError } from "./errors.js";

export type FileNode = { path: string; lines: number; imports: string[]; copies: number };
export type Member = {
  id: string; // `${path}#${name}#${line}`
  name: string;
  path: string;
  line: number;
  endLine: number;
  lines: number;
  declKind: "function" | "const";
  exported: boolean;
  isDefault: boolean;
  variant: number; // members with the same variant are true copies (same tokens + same dependencies)
};
export type TwinSet = {
  id: string; // shape hash, 12 hex chars
  name: string; // shared name, or "a / b"
  kind: "exact" | "near"; // exact = one variant across all members
  isComponent: boolean; // body contains JSX
  members: Member[];
  duplicateLines: number; // sum of member lines minus the largest
  mergeable: boolean; // deterministic merge possible for all members
  reason?: string; // why not mergeable, plain words
};
export type ScanResult = {
  files: FileNode[];
  sets: TwinSet[];
  totals: { files: number; sourceLines: number; duplicateLines: number; sets: number };
  ms: number;
};

// ---------------------------------------------------------------------------
// File discovery

export const SOURCE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs)$/;
const EXCLUDED_DIRS = new Set([
  "node_modules",
  "dist",
  "build",
  "out",
  "coverage",
  "vendor",
  ".git",
  ".next",
  ".output",
  ".vercel",
  ".turbo",
  ".svelte-kit",
]);
const MAX_LINES = 3_000;
const MAX_BYTES = 1024 * 1024;
const MIN_NODES = 25;
const MIN_LINES = 4;

export function toPosix(p: string): string {
  return p.replace(/\\/g, "/");
}

function isExcludedFile(rel: string): boolean {
  const base = rel.slice(rel.lastIndexOf("/") + 1);
  if (!SOURCE_EXT.test(base)) return true;
  if (/\.d\.[mc]?ts$/.test(base)) return true;
  if (/\.(test|spec)\./.test(base)) return true;
  if (/(^|\/)components\/ui\//.test(rel)) return true;
  return false;
}

/** Repo-relative POSIX paths of every source file the engine looks at. */
export function listSourceFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (relDir: string) => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(path.join(dir, relDir), { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const rel = relDir ? `${relDir}/${e.name}` : e.name;
      if (e.isDirectory()) {
        if (EXCLUDED_DIRS.has(e.name)) continue;
        if (rel.endsWith("components/ui")) continue;
        walk(rel);
      } else if (e.isFile()) {
        if (!isExcludedFile(rel)) out.push(rel);
      }
    }
  };
  walk("");
  return out.sort();
}

// ---------------------------------------------------------------------------
// Import resolution

type PathRule = { prefix: string; suffix: string; wildcard: boolean; targets: string[] };
export type Resolver = {
  dir: string;
  rules: PathRule[];
  baseUrl: string | null; // repo-relative
  resolve(fromPath: string, spec: string): string | null;
};

function readJsonc(file: string): any | null {
  try {
    const text = fs.readFileSync(file, "utf8");
    const parsed = ts.parseConfigFileTextToJson(file, text);
    return parsed.error ? null : parsed.config;
  } catch {
    return null;
  }
}

function insideRepo(rel: string): boolean {
  return rel !== ".." && !rel.startsWith("../") && !path.posix.isAbsolute(rel) && !/^[A-Za-z]:/.test(rel);
}

function loadPathRules(dir: string): { rules: PathRule[]; baseUrl: string | null } {
  const rules: PathRule[] = [];
  let baseUrl: string | null = null;
  const seen = new Set<string>();
  const visit = (relCfg: string, depth: number) => {
    if (depth > 8 || seen.has(relCfg)) return;
    seen.add(relCfg);
    const cfg = readJsonc(path.join(dir, relCfg));
    if (!cfg || typeof cfg !== "object") return;
    const cfgDir = path.posix.dirname(relCfg);
    const co = cfg.compilerOptions ?? {};
    const ownBase =
      typeof co.baseUrl === "string" ? path.posix.normalize(path.posix.join(cfgDir, co.baseUrl)) : null;
    if (ownBase && baseUrl === null && insideRepo(ownBase)) baseUrl = ownBase;
    if (co.paths && typeof co.paths === "object") {
      const root = ownBase ?? cfgDir;
      for (const [pattern, targets] of Object.entries(co.paths as Record<string, unknown>)) {
        if (!Array.isArray(targets)) continue;
        if (rules.some((r) => r.prefix + (r.wildcard ? "*" : "") + r.suffix === pattern)) continue;
        const star = pattern.indexOf("*");
        rules.push({
          prefix: star >= 0 ? pattern.slice(0, star) : pattern,
          suffix: star >= 0 ? pattern.slice(star + 1) : "",
          wildcard: star >= 0,
          targets: targets
            .filter((t): t is string => typeof t === "string")
            .map((t) => path.posix.normalize(path.posix.join(root, t))),
        });
      }
    }
    const next = (p: string) => {
      let rel = path.posix.normalize(path.posix.join(cfgDir, toPosix(p)));
      if (!rel.endsWith(".json")) {
        const asDir = path.join(dir, rel, "tsconfig.json");
        rel = fs.existsSync(asDir) ? `${rel}/tsconfig.json` : `${rel}.json`;
      }
      if (insideRepo(rel)) visit(rel, depth + 1);
    };
    const ext = cfg.extends;
    for (const e of Array.isArray(ext) ? ext : ext ? [ext] : []) {
      if (typeof e === "string" && e.startsWith(".")) next(e);
    }
    if (Array.isArray(cfg.references)) {
      for (const r of cfg.references) if (r && typeof r.path === "string") next(r.path);
    }
  };
  visit("tsconfig.json", 0);
  visit("jsconfig.json", 0);
  // Longest prefix first, as TypeScript does.
  rules.sort((a, b) => b.prefix.length - a.prefix.length);
  return { rules, baseUrl };
}

const TRY_EXT = [".ts", ".tsx", ".js", ".jsx"];
const DIRECT_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|mts|cts)$/;

export function createResolver(dir: string): Resolver {
  const { rules, baseUrl } = loadPathRules(dir);
  const cache = new Map<string, boolean>();
  const isFile = (rel: string) => {
    let hit = cache.get(rel);
    if (hit === undefined) {
      try {
        hit = fs.statSync(path.join(dir, rel)).isFile();
      } catch {
        hit = false;
      }
      cache.set(rel, hit);
    }
    return hit;
  };
  const probe = (raw: string): string | null => {
    const base = path.posix.normalize(raw).replace(/\/$/, "");
    if (!insideRepo(base) || base === ".") return null;
    if (DIRECT_EXT.test(base) && !/\.d\.ts$/.test(base) && isFile(base)) return base;
    const js = /\.(m|c)?jsx?$/.exec(base);
    if (js) {
      const stem = base.slice(0, -js[0].length);
      const swaps = js[1] === "m" ? [".mts"] : js[1] === "c" ? [".cts"] : [".ts", ".tsx"];
      for (const e of swaps) if (isFile(stem + e)) return stem + e;
    }
    for (const e of TRY_EXT) if (isFile(base + e)) return base + e;
    for (const e of TRY_EXT) if (isFile(`${base}/index${e}`)) return `${base}/index${e}`;
    return null;
  };
  const resolve = (fromPath: string, spec: string): string | null => {
    if (!spec) return null;
    if (spec.startsWith("./") || spec.startsWith("../") || spec === "." || spec === "..") {
      return probe(path.posix.join(path.posix.dirname(toPosix(fromPath)), spec));
    }
    if (spec.startsWith("/")) return null;
    for (const r of rules) {
      let captured: string;
      if (r.wildcard) {
        if (!spec.startsWith(r.prefix) || !spec.endsWith(r.suffix)) continue;
        if (spec.length < r.prefix.length + r.suffix.length) continue;
        captured = spec.slice(r.prefix.length, spec.length - r.suffix.length);
      } else {
        if (spec !== r.prefix) continue;
        captured = "";
      }
      for (const t of r.targets) {
        const hit = probe(r.wildcard ? t.replace("*", captured) : t);
        if (hit) return hit;
      }
    }
    if (baseUrl !== null) return probe(path.posix.join(baseUrl, spec));
    return null;
  };
  return { dir, rules, baseUrl, resolve };
}

/** Resolve an import specifier to a repo-relative file, using tsconfig paths. */
export function resolveImport(dir: string, fromPath: string, spec: string): string | null {
  return createResolver(dir).resolve(fromPath, spec);
}

// ---------------------------------------------------------------------------
// AST helpers (shared with merge.ts)

export function scriptKindFor(file: string): ts.ScriptKind {
  if (file.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (file.endsWith(".jsx")) return ts.ScriptKind.JSX;
  if (/\.[mc]?js$/.test(file)) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

/** True when this identifier refers to a binding (not a property or member name). */
export function isReferenceIdentifier(id: ts.Identifier): boolean {
  const p = id.parent;
  if (!p) return true;
  if (ts.isPropertyAccessExpression(p) && p.name === id) return false;
  if (ts.isQualifiedName(p) && p.right === id) return false;
  if (
    (ts.isPropertyAssignment(p) ||
      ts.isPropertyDeclaration(p) ||
      ts.isPropertySignature(p) ||
      ts.isMethodDeclaration(p) ||
      ts.isMethodSignature(p) ||
      ts.isGetAccessorDeclaration(p) ||
      ts.isSetAccessorDeclaration(p) ||
      ts.isEnumMember(p)) &&
    p.name === id
  ) {
    return false;
  }
  if (ts.isJsxAttribute(p) && p.name === id) return false;
  if (ts.isBindingElement(p) && p.propertyName === id) return false;
  if (ts.isImportSpecifier(p) && p.propertyName === id) return false;
  if (ts.isExportSpecifier(p)) {
    // `export { local as exported }`: only the local side is a binding, and only without `from`.
    if (p.parent.parent.moduleSpecifier) return false;
    return p.propertyName ? p.propertyName === id : true;
  }
  if (ts.isLabeledStatement(p) || ts.isBreakStatement(p) || ts.isContinueStatement(p)) return false;
  return true;
}

/** Names referenced anywhere inside `node` (identifiers in reference positions). */
export function referencedNames(node: ts.Node, sf: ts.SourceFile, from = 0): Set<string> {
  const out = new Set<string>();
  const visit = (n: ts.Node) => {
    if (ts.isIdentifier(n)) {
      if (n.getStart(sf) >= from && isReferenceIdentifier(n)) out.add(n.text);
      return;
    }
    ts.forEachChild(n, visit);
  };
  visit(node);
  return out;
}

const SKIP_MODIFIERS = new Set([
  ts.SyntaxKind.ExportKeyword,
  ts.SyntaxKind.DefaultKeyword,
  ts.SyntaxKind.DeclareKeyword,
]);

/** Leaf tokens of `node` (trivia skipped), optionally from a position onward. */
export function tokenText(node: ts.Node, sf: ts.SourceFile, from = 0): string {
  const out: string[] = [];
  const visit = (n: ts.Node) => {
    if (n.kind >= ts.SyntaxKind.FirstJSDocNode && n.kind <= ts.SyntaxKind.LastJSDocNode) return;
    const kids = n.getChildren(sf);
    if (kids.length === 0) {
      if (n.end <= from || n.getStart(sf) < from) return;
      if (SKIP_MODIFIERS.has(n.kind) && n.parent && ts.canHaveModifiers(n.parent)) {
        if (ts.getModifiers(n.parent)?.some((m) => m === n)) return;
      }
      let t = n.getText(sf);
      if (n.kind === ts.SyntaxKind.JsxText) t = t.replace(/\s+/g, " ").trim();
      if (t) out.push(t);
      return;
    }
    for (const k of kids) visit(k);
  };
  visit(node);
  return out.join("\u0001");
}

export function sha(text: string, len = 12): string {
  return createHash("sha1").update(text).digest("hex").slice(0, len);
}

/** Binding names declared by a top-level statement. */
export function declaredNames(stmt: ts.Statement): string[] {
  if (
    (ts.isFunctionDeclaration(stmt) ||
      ts.isClassDeclaration(stmt) ||
      ts.isInterfaceDeclaration(stmt) ||
      ts.isTypeAliasDeclaration(stmt) ||
      ts.isEnumDeclaration(stmt)) &&
    stmt.name
  ) {
    return [stmt.name.text];
  }
  if (ts.isVariableStatement(stmt)) {
    const names: string[] = [];
    const bind = (n: ts.BindingName) => {
      if (ts.isIdentifier(n)) names.push(n.text);
      else for (const el of n.elements) if (!ts.isOmittedExpression(el)) bind(el.name);
    };
    for (const d of stmt.declarationList.declarations) bind(d.name);
    return names;
  }
  return [];
}

/**
 * Names whose binding or properties are assigned anywhere in the file
 * (`X = ...`, `X.displayName = ...`, `X["a"] = ...`, `Object.assign(X, ...)`).
 * Merging such a function would share one mutable object between files.
 */
export function assignedNames(sf: ts.SourceFile): Set<string> {
  const out = new Set<string>();
  const target = (e: ts.Expression) => {
    let cur: ts.Expression = e;
    while (ts.isParenthesizedExpression(cur)) cur = cur.expression;
    if (ts.isIdentifier(cur)) out.add(cur.text);
    else if ((ts.isPropertyAccessExpression(cur) || ts.isElementAccessExpression(cur)) && ts.isIdentifier(cur.expression)) {
      out.add(cur.expression.text);
    }
  };
  const visit = (n: ts.Node) => {
    if (
      ts.isBinaryExpression(n) &&
      n.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
      n.operatorToken.kind <= ts.SyntaxKind.LastAssignment
    ) {
      target(n.left);
    } else if (
      (ts.isPrefixUnaryExpression(n) || ts.isPostfixUnaryExpression(n)) &&
      (n.operator === ts.SyntaxKind.PlusPlusToken || n.operator === ts.SyntaxKind.MinusMinusToken)
    ) {
      target(n.operand);
    } else if (
      ts.isCallExpression(n) &&
      ts.isPropertyAccessExpression(n.expression) &&
      n.expression.getText(sf) === "Object.assign" &&
      n.arguments[0]
    ) {
      target(n.arguments[0]);
    }
    // Stay at module level: inner scopes may shadow the name.
    if (ts.isFunctionLike(n) || ts.isClassLike(n)) return;
    ts.forEachChild(n, visit);
  };
  ts.forEachChild(sf, visit);
  return out;
}

function hasModifier(node: ts.Node, kind: ts.SyntaxKind): boolean {
  return ts.canHaveModifiers(node) ? Boolean(ts.getModifiers(node)?.some((m) => m.kind === kind)) : false;
}

function containsJsx(node: ts.Node): boolean {
  let found = false;
  const visit = (n: ts.Node) => {
    if (found) return;
    if (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n) || ts.isJsxFragment(n)) {
      found = true;
      return;
    }
    ts.forEachChild(n, visit);
  };
  visit(node);
  return found;
}

// ---------------------------------------------------------------------------
// Scan

type FileCtx = {
  rel: string;
  sf: ts.SourceFile;
  imports: Map<string, string>; // local name -> `import:<target>:<imported>`
  locals: Map<string, ts.Statement>;
  localHash: Map<string, string>;
};

type Candidate = {
  name: string;
  path: string;
  line: number;
  endLine: number;
  declKind: "function" | "const";
  exported: boolean;
  isDefault: boolean;
  shape: string;
  variantKey: string;
  isComponent: boolean;
  assigned: boolean;
};

function shapeOf(parts: (ts.Node | undefined)[]): string[] {
  const out: string[] = [];
  const visit = (n: ts.Node) => {
    const k = n.kind;
    if (k === ts.SyntaxKind.Identifier || k === ts.SyntaxKind.PrivateIdentifier) out.push("I");
    else if (
      k === ts.SyntaxKind.StringLiteral ||
      k === ts.SyntaxKind.NumericLiteral ||
      k === ts.SyntaxKind.BigIntLiteral ||
      k === ts.SyntaxKind.RegularExpressionLiteral ||
      k === ts.SyntaxKind.NoSubstitutionTemplateLiteral
    )
      out.push("L");
    else out.push(String(k));
    ts.forEachChild(n, visit);
  };
  for (const p of parts) if (p) visit(p);
  return out;
}

function functionParts(fn: ts.FunctionLikeDeclarationBase): (ts.Node | undefined)[] {
  const mods = (ts.canHaveModifiers(fn) ? ts.getModifiers(fn) ?? [] : []).filter(
    (m) => !SKIP_MODIFIERS.has(m.kind),
  );
  return [
    ...mods,
    ...(fn.typeParameters ?? []),
    ...fn.parameters,
    fn.type,
    fn.body,
  ];
}

function depSignature(ctx: FileCtx, node: ts.Node, from: number, self: string, visiting: Set<string>): string[] {
  const deps = new Set<string>();
  for (const name of referencedNames(node, ctx.sf, from)) {
    if (name === self) continue;
    const imp = ctx.imports.get(name);
    if (imp) {
      deps.add(imp);
      continue;
    }
    if (ctx.locals.has(name)) deps.add(`local:${localHashOf(ctx, name, visiting)}`);
  }
  return [...deps].sort();
}

function localHashOf(ctx: FileCtx, name: string, visiting: Set<string>): string {
  const memo = ctx.localHash.get(name);
  if (memo) return memo;
  const stmt = ctx.locals.get(name)!;
  const tokens = tokenText(stmt, ctx.sf);
  if (visiting.has(name)) return sha(`cycle|${tokens}`);
  visiting.add(name);
  const deps = depSignature(ctx, stmt, 0, name, visiting);
  visiting.delete(name);
  const h = sha(`${tokens}|${deps.join(",")}`);
  ctx.localHash.set(name, h);
  return h;
}

export function scanRepo(dir: string): ScanResult {
  const t0 = Date.now();
  if (!fs.existsSync(dir)) throw new EngineError("repo_missing", `Repo folder not found: ${dir}`);
  const resolver = createResolver(dir);
  const rels = listSourceFiles(dir);

  const files: FileNode[] = [];
  const candidates: Candidate[] = [];
  let sourceLines = 0;

  for (const rel of rels) {
    const abs = path.join(dir, rel);
    let text: string;
    try {
      if (fs.statSync(abs).size > MAX_BYTES) continue;
      text = fs.readFileSync(abs, "utf8");
    } catch {
      continue;
    }
    const lineCount = text.length === 0 ? 0 : text.split("\n").length;
    if (lineCount > MAX_LINES) continue; // generated or bundled
    sourceLines += lineCount;

    const sf = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, scriptKindFor(rel));
    const ctx: FileCtx = { rel, sf, imports: new Map(), locals: new Map(), localHash: new Map() };
    const fileImports = new Set<string>();
    const exportedNames = new Set<string>();
    const assigned = assignedNames(sf);
    const defaultNames = new Set<string>();

    for (const stmt of sf.statements) {
      if (ts.isImportDeclaration(stmt) && ts.isStringLiteral(stmt.moduleSpecifier)) {
        const spec = stmt.moduleSpecifier.text;
        const target = resolver.resolve(rel, spec);
        if (target) fileImports.add(target);
        const where = target ?? spec;
        const clause = stmt.importClause;
        if (clause?.name) ctx.imports.set(clause.name.text, `import:${where}:default`);
        const nb = clause?.namedBindings;
        if (nb && ts.isNamespaceImport(nb)) ctx.imports.set(nb.name.text, `import:${where}:*`);
        if (nb && ts.isNamedImports(nb)) {
          for (const el of nb.elements) {
            ctx.imports.set(el.name.text, `import:${where}:${(el.propertyName ?? el.name).text}`);
          }
        }
        continue;
      }
      if (ts.isExportDeclaration(stmt)) {
        if (stmt.moduleSpecifier && ts.isStringLiteral(stmt.moduleSpecifier)) {
          const target = resolver.resolve(rel, stmt.moduleSpecifier.text);
          if (target) fileImports.add(target);
        } else if (stmt.exportClause && ts.isNamedExports(stmt.exportClause)) {
          for (const el of stmt.exportClause.elements) {
            const local = (el.propertyName ?? el.name).text;
            if (el.name.text === "default") defaultNames.add(local);
            else exportedNames.add(local);
          }
        }
        continue;
      }
      if (ts.isExportAssignment(stmt) && !stmt.isExportEquals && ts.isIdentifier(stmt.expression)) {
        defaultNames.add(stmt.expression.text);
        continue;
      }
      for (const n of declaredNames(stmt)) if (!ctx.locals.has(n)) ctx.locals.set(n, stmt);
    }

    const lineOf = (pos: number) => sf.getLineAndCharacterOfPosition(pos).line + 1;
    const push = (
      name: string,
      span: ts.Node,
      declKind: "function" | "const",
      parts: (ts.Node | undefined)[],
      tokenRoot: ts.Node,
      tokenFrom: number,
      exportKw: boolean,
      defaultKw: boolean,
    ) => {
      const shapeArr = shapeOf(parts);
      if (shapeArr.length < MIN_NODES) return;
      const line = lineOf(span.getStart(sf));
      const endLine = lineOf(span.end);
      if (endLine - line + 1 < MIN_LINES) return;
      const tokens = tokenText(tokenRoot, sf, tokenFrom);
      const deps = depSignature(ctx, tokenRoot, tokenFrom, name, new Set([name]));
      candidates.push({
        name,
        path: rel,
        line,
        endLine,
        declKind,
        exported: exportKw || exportedNames.has(name),
        isDefault: defaultKw || defaultNames.has(name),
        shape: sha(shapeArr.join(",")),
        variantKey: sha(`${tokens}|${deps.join(",")}`, 16),
        isComponent: parts.some((p) => p !== undefined && containsJsx(p)),
        assigned: assigned.has(name),
      });
    };

    for (const stmt of sf.statements) {
      if (ts.isFunctionDeclaration(stmt) && stmt.name && stmt.body) {
        push(
          stmt.name.text,
          stmt,
          "function",
          functionParts(stmt),
          stmt,
          stmt.name.end,
          hasModifier(stmt, ts.SyntaxKind.ExportKeyword),
          hasModifier(stmt, ts.SyntaxKind.DefaultKeyword),
        );
      } else if (ts.isVariableStatement(stmt)) {
        const decls = stmt.declarationList.declarations;
        for (const d of decls) {
          const init = d.initializer;
          if (!ts.isIdentifier(d.name) || !init) continue;
          if (!ts.isArrowFunction(init) && !ts.isFunctionExpression(init)) continue;
          push(
            d.name.text,
            decls.length === 1 ? stmt : d,
            "const",
            functionParts(init),
            init,
            0,
            hasModifier(stmt, ts.SyntaxKind.ExportKeyword),
            false,
          );
        }
      }
    }

    files.push({ path: rel, lines: lineCount, imports: [...fileImports], copies: 0 });
  }

  // Keep the map self-contained: only edges between scanned files.
  const scanned = new Set(files.map((f) => f.path));
  for (const f of files) f.imports = f.imports.filter((p) => scanned.has(p) && p !== f.path).sort();

  const groups = new Map<string, Candidate[]>();
  for (const c of candidates) {
    const g = groups.get(c.shape);
    if (g) g.push(c);
    else groups.set(c.shape, [c]);
  }

  const sets: TwinSet[] = [];
  const copiesByFile = new Map<string, number>();
  for (const [shape, group] of groups) {
    if (group.length < 2) continue;
    group.sort((a, b) => (a.path === b.path ? a.line - b.line : a.path < b.path ? -1 : 1));
    const variants = new Map<string, number>();
    const members: Member[] = group.map((c) => {
      let v = variants.get(c.variantKey);
      if (v === undefined) {
        v = variants.size;
        variants.set(c.variantKey, v);
      }
      return {
        id: `${c.path}#${c.name}#${c.line}`,
        name: c.name,
        path: c.path,
        line: c.line,
        endLine: c.endLine,
        lines: c.endLine - c.line + 1,
        declKind: c.declKind,
        exported: c.exported,
        isDefault: c.isDefault,
        variant: v,
      };
    });
    const names = [...new Set(members.map((m) => m.name))];
    const kind: TwinSet["kind"] = variants.size === 1 ? "exact" : "near";
    const totalLines = members.reduce((n, m) => n + m.lines, 0);
    const maxLines = Math.max(...members.map((m) => m.lines));
    let reason: string | undefined;
    if (kind === "near") reason = "The copies differ, so a shared version has to be written by hand or by the agent.";
    else if (members.some((m) => m.isDefault)) reason = "One copy is a default export.";
    else if (new Set(members.map((m) => m.path)).size < members.length) reason = "Two copies live in the same file.";
    else if (group.some((c) => c.assigned)) {
      reason = "A copy gets properties set on it after it is declared (like displayName), so one shared function would change behaviour.";
    }
    const set: TwinSet = {
      id: shape,
      name: names.join(" / "),
      kind,
      isComponent: group.some((c) => c.isComponent),
      members,
      duplicateLines: totalLines - maxLines,
      mergeable: reason === undefined,
    };
    if (reason !== undefined) set.reason = reason;
    sets.push(set);
    for (const m of members) copiesByFile.set(m.path, (copiesByFile.get(m.path) ?? 0) + 1);
  }
  sets.sort((a, b) => b.duplicateLines - a.duplicateLines || (a.id < b.id ? -1 : 1));
  for (const f of files) f.copies = copiesByFile.get(f.path) ?? 0;

  return {
    files,
    sets,
    totals: {
      files: files.length,
      sourceLines,
      duplicateLines: sets.reduce((n, s) => n + s.duplicateLines, 0),
      sets: sets.length,
    },
    ms: Date.now() - t0,
  };
}

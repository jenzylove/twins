import fs from "node:fs";
import path from "node:path";

import { Node, Project, SyntaxKind, ts } from "./ts-morph.js";
import type { SourceFile, Statement, VariableStatement } from "ts-morph";

import { EngineError } from "./errors.js";
import type { Member, TwinSet } from "./scan.js";
import { assignedNames, declaredNames, isReferenceIdentifier, referencedNames, tokenText } from "./scan.js";

export type FileEdit = { path: string; before: string | null; after: string | null }; // null before = new file
export type MergePlan = {
  sharedPath: string;
  canonicalName: string;
  edits: FileEdit[];
  linesRemoved: number;
  linesAdded: number;
};

// ---------------------------------------------------------------------------
// Small helpers

export function kebab(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
    .replace(/[^A-Za-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function commonDir(paths: string[]): string {
  const dirs = paths.map((p) => path.posix.dirname(p).split("/").filter((s) => s && s !== "."));
  const first = dirs[0] ?? [];
  let n = first.length;
  for (const d of dirs) {
    let i = 0;
    while (i < n && i < d.length && d[i] === first[i]) i++;
    n = i;
  }
  return first.slice(0, n).join("/");
}

function existsIn(dir: string, rel: string): boolean {
  return fs.existsSync(path.join(dir, rel));
}

function defaultSharedPath(dir: string, members: Member[], name: string, isComponent: boolean): string {
  let base = commonDir(members.map((m) => m.path));
  if (base === "" && fs.existsSync(path.join(dir, "src"))) base = "src/shared";
  const ext = isComponent ? ".tsx" : ".ts";
  const stem = kebab(name) || "shared";
  const join = (file: string) => (base ? `${base}/${file}` : file);
  let candidate = join(`${stem}${ext}`);
  if (!existsIn(dir, candidate)) return candidate;
  candidate = join(`${stem}-shared${ext}`);
  for (let i = 2; existsIn(dir, candidate); i++) candidate = join(`${stem}-shared-${i}${ext}`);
  return candidate;
}

function checkCallerSharedPath(dir: string, given: string, memberPaths: string[]): string {
  const bad = (why: string) =>
    new EngineError("invalid_shared_path", `Cannot put the shared file at "${given}": ${why}.`);
  const p = path.posix.normalize(given.replace(/\\/g, "/").replace(/^\.\//, ""));
  if (path.posix.isAbsolute(p) || /^[A-Za-z]:/.test(p) || p === ".." || p.startsWith("../")) {
    throw bad("it must stay inside the repo");
  }
  if (!/\.(ts|tsx)$/.test(p) || /\.d\.ts$/.test(p)) throw bad("it must end in .ts or .tsx");
  if (p.split("/").includes("node_modules")) throw bad("it cannot live in node_modules");
  if (memberPaths.includes(p) || existsIn(dir, p)) throw bad("that file already exists");
  return p;
}

/** Count removed and added lines between two texts (LCS on lines). */
export function lineDiff(before: string | null, after: string | null): { removed: number; added: number } {
  const a = before === null || before === "" ? [] : before.split("\n");
  const b = after === null || after === "" ? [] : after.split("\n");
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }
  const x = a.slice(start, endA);
  const y = b.slice(start, endB);
  if (x.length === 0 || y.length === 0) return { removed: x.length, added: y.length };
  // LCS length with two rows.
  let prev = new Array<number>(y.length + 1).fill(0);
  let cur = new Array<number>(y.length + 1).fill(0);
  for (let i = 1; i <= x.length; i++) {
    for (let j = 1; j <= y.length; j++) {
      cur[j] = x[i - 1] === y[j - 1] ? prev[j - 1]! + 1 : Math.max(prev[j]!, cur[j - 1]!);
    }
    [prev, cur] = [cur, prev];
  }
  const lcs = prev[y.length]!;
  return { removed: x.length - lcs, added: y.length - lcs };
}

const HELPER_KINDS = new Set([
  SyntaxKind.FunctionDeclaration,
  SyntaxKind.VariableStatement,
  SyntaxKind.InterfaceDeclaration,
  SyntaxKind.TypeAliasDeclaration,
  SyntaxKind.EnumDeclaration,
  SyntaxKind.ClassDeclaration,
]);

type TopLevel = Map<string, Statement>;

function topLevel(sf: SourceFile): TopLevel {
  const map: TopLevel = new Map();
  for (const st of sf.getStatements()) {
    if (!HELPER_KINDS.has(st.getKind())) continue;
    for (const n of declaredNames(st.compilerNode as ts.Statement)) if (!map.has(n)) map.set(n, st);
  }
  return map;
}

function refs(node: Node): Set<string> {
  return referencedNames(node.compilerNode, node.getSourceFile().compilerNode);
}

/** Is `name` still referenced in `sf`, outside imports and outside `skip`? */
function stillReferenced(sf: SourceFile, name: string, skip?: Node): boolean {
  const csf = sf.compilerNode;
  const skipNode = skip?.compilerNode;
  let found = false;
  const visit = (n: ts.Node) => {
    if (found) return;
    if (ts.isImportDeclaration(n)) return;
    if (skipNode && n === skipNode) return;
    if (ts.isIdentifier(n)) {
      if (n.text === name && isReferenceIdentifier(n)) found = true;
      return;
    }
    ts.forEachChild(n, visit);
  };
  visit(csf);
  return found;
}

function exportModifierKinds(node: Node): boolean {
  return Node.isModifierable(node) && (node.hasModifier(SyntaxKind.ExportKeyword) || node.hasModifier(SyntaxKind.DefaultKeyword));
}

/** Statement text (with JSDoc) re-emitted as a named export. */
function asExported(st: Statement): string {
  const full = st.getText(true);
  const plain = st.getText();
  const doc = full.slice(0, full.length - plain.length);
  let body = plain;
  if (Node.isModifierable(st)) {
    const start = st.getStart();
    const cuts = st
      .getModifiers()
      .filter((m) => m.getKind() === SyntaxKind.ExportKeyword || m.getKind() === SyntaxKind.DefaultKeyword)
      .map((m) => [m.getStart() - start, m.getEnd() - start] as const)
      .sort((a, b) => b[0] - a[0]);
    for (const [s, e] of cuts) body = body.slice(0, s) + body.slice(e).replace(/^\s+/, "");
  }
  if (Node.isModifierable(st) && st.hasModifier(SyntaxKind.DeclareKeyword)) return `${doc}${body}`;
  return `${doc}export ${body}`;
}

function rerelativise(spec: string, fromFile: string, toFile: string): string {
  if (!spec.startsWith(".")) return spec;
  const target = path.posix.normalize(path.posix.join(path.posix.dirname(fromFile), spec));
  let rel = path.posix.relative(path.posix.dirname(toFile), target);
  if (rel === "") rel = ".";
  else if (!rel.startsWith(".")) rel = `./${rel}`;
  if (spec.endsWith("/") && !rel.endsWith("/")) rel += "/";
  return rel;
}

function findDecl(sf: SourceFile, m: Member): { node: Node; statement: Statement } {
  if (m.declKind === "function") {
    const fn = sf.getFunctions().find((f) => f.getName() === m.name && f.hasBody());
    if (fn) return { node: fn, statement: fn };
  } else {
    for (const vs of sf.getVariableStatements()) {
      const d = vs.getDeclarations().find((x) => x.getName() === m.name);
      if (!d) continue;
      const init = d.getInitializer();
      if (init && (Node.isArrowFunction(init) || Node.isFunctionExpression(init))) {
        return { node: d, statement: vs };
      }
    }
  }
  throw new EngineError(
    "member_not_found",
    `${m.name} is no longer in ${m.path}. Scan the repo again.`,
    { member: m.id },
  );
}

function fileStyle(sf: SourceFile): { quote: string; semi: string; ext: "js" | "ts" | "" } {
  const imports = sf.getImportDeclarations();
  const first = imports[0];
  const quote = first ? (first.getModuleSpecifier().getText()[0] ?? '"') : '"';
  const semi = first ? (first.getText().trimEnd().endsWith(";") ? ";" : "") : ";";
  let ext: "js" | "ts" | "" = "";
  for (const d of imports) {
    const spec = d.getModuleSpecifierValue();
    if (!spec.startsWith(".")) continue;
    if (/\.(m|c)?js$/.test(spec)) ext = "js";
    else if (/\.tsx?$/.test(spec) && ext === "") ext = "ts";
  }
  return { quote, semi, ext };
}

/** Index into getStatementsWithComments(), which insertStatements() uses. */
function importInsertIndex(sf: SourceFile): number {
  const sts = sf.getStatementsWithComments();
  let idx = 0;
  // Keep header comments and prologue directives ("use client") first.
  while (idx < sts.length) {
    const st = sts[idx]!;
    if (Node.isExpressionStatement(st) && Node.isStringLiteral(st.getExpression())) idx++;
    else if (Node.isCommentStatement(st)) idx++;
    else break;
  }
  for (let i = 0; i < sts.length; i++) if (Node.isImportDeclaration(sts[i]!)) idx = Math.max(idx, i + 1);
  return idx;
}

/** Keep a blank line after the import block and the original end-of-file newline. */
function tidy(sf: SourceFile, original: string): string {
  let text = sf.getFullText();
  const imports = sf.getImportDeclarations();
  const last = imports[imports.length - 1];
  if (last) {
    const end = last.getEnd();
    const rest = text.slice(end);
    const m = /^(\r?\n)(?=[^\r\n])/.exec(rest);
    if (m && !/^\r?\nimport\b/.test(rest)) text = text.slice(0, end) + m[1] + rest;
  }
  const eol = original.includes("\r\n") ? "\r\n" : "\n";
  if (/\r?\n$/.test(original)) text = text.replace(/\s*$/, eol);
  return text;
}

// ---------------------------------------------------------------------------

export function planMerge(
  dir: string,
  set: TwinSet,
  opts?: { memberIds?: string[]; sharedPath?: string },
): MergePlan {
  let members = set.members;
  if (opts?.memberIds) {
    const byId = new Map(set.members.map((m) => [m.id, m]));
    const missing = opts.memberIds.filter((id) => !byId.has(id));
    if (missing.length) {
      throw new EngineError("unknown_member", `These copies are not in the set: ${missing.join(", ")}.`, { missing });
    }
    members = [...new Set(opts.memberIds)].map((id) => byId.get(id)!);
  }
  if (members.length < 2) throw new EngineError("too_few_members", "Pick at least two copies to merge.");
  if (new Set(members.map((m) => m.variant)).size > 1) {
    throw new EngineError("near_copies", "These copies differ; write a shared version and pass edits.");
  }
  if (members.some((m) => m.isDefault)) {
    throw new EngineError("default_export", "One copy is a default export; merge it by hand and pass edits.");
  }
  if (new Set(members.map((m) => m.path)).size < members.length) {
    throw new EngineError("same_file", "Two copies live in the same file; merge them by hand and pass edits.");
  }

  const canonicalMember = members[0]!;

  const canonicalName = canonicalMember.name;
  const isComponent = set.isComponent;
  const sharedPath = opts?.sharedPath
    ? checkCallerSharedPath(dir, opts.sharedPath, members.map((m) => m.path))
    : defaultSharedPath(dir, members, canonicalName, isComponent);

  const project = new Project({
    useInMemoryFileSystem: true,
    skipFileDependencyResolution: true,
    compilerOptions: { allowJs: true, jsx: ts.JsxEmit.Preserve },
  });
  const originals = new Map<string, string>();
  const files = new Map<string, SourceFile>();
  for (const m of members) {
    let text: string;
    try {
      text = fs.readFileSync(path.join(dir, m.path), "utf8");
    } catch {
      throw new EngineError("member_not_found", `${m.path} is missing. Scan the repo again.`, { member: m.id });
    }
    originals.set(m.path, text);
    files.set(m.path, project.createSourceFile(`/${m.path}`, text, { overwrite: true }));
  }

  for (const m of members) {
    if (assignedNames(files.get(m.path)!.compilerNode).has(m.name)) {
      throw new EngineError(
        "assigned_member",
        `${m.name} in ${m.path} gets properties set on it after it is declared; merge it by hand and pass edits.`,
        { member: m.id },
      );
    }
  }

  // --- Build the shared module from the canonical copy -----------------------
  const home = files.get(canonicalMember.path)!;
  const homeDecl = findDecl(home, canonicalMember);
  const homeTop = topLevel(home);

  const helperStmts = new Set<Statement>();
  const helperNames: string[] = [];
  const queue: Node[] = [homeDecl.node];
  const seen = new Set<string>([canonicalName]);
  while (queue.length) {
    const node = queue.shift()!;
    for (const n of refs(node)) {
      if (seen.has(n)) continue;
      const st = homeTop.get(n);
      if (!st) continue;
      seen.add(n);
      if (st === homeDecl.statement) {
        throw new EngineError(
          "cannot_merge",
          `${canonicalName} shares one declaration statement with ${n}; split it first or pass edits.`,
        );
      }
      helperNames.push(n);
      if (!helperStmts.has(st)) {
        helperStmts.add(st);
        queue.push(st);
      }
    }
  }
  const orderedHelpers = [...helperStmts].sort((a, b) => a.getPos() - b.getPos());
  const helperTokens = new Map<string, string>();
  for (const n of helperNames) {
    const st = homeTop.get(n)!;
    helperTokens.set(n, tokenText(st.compilerNode, home.compilerNode));
  }

  const movedNames = new Set<string>(refs(homeDecl.node));
  for (const st of orderedHelpers) for (const n of refs(st)) movedNames.add(n);

  const importLines: string[] = [];
  for (const d of home.getImportDeclarations()) {
    const clause = d.getImportClause();
    if (!clause) continue; // side-effect import stays with its file
    const def = d.getDefaultImport();
    const ns = d.getNamespaceImport();
    const named = d.getNamedImports().filter((el) => movedNames.has((el.getAliasNode() ?? el.getNameNode()).getText()));
    const useDef = def && movedNames.has(def.getText());
    const useNs = ns && movedNames.has(ns.getText());
    if (!useDef && !useNs && named.length === 0) continue;
    const parts: string[] = [];
    if (useDef) parts.push(def!.getText());
    if (useNs) parts.push(`* as ${ns!.getText()}`);
    else if (named.length) parts.push(`{ ${named.map((el) => el.getText()).join(", ")} }`);
    if (useNs && named.length) {
      // `* as ns` and `{}` cannot share one clause.
      const q0 = d.getModuleSpecifier().getText()[0] ?? '"';
      const spec0 = rerelativise(d.getModuleSpecifierValue(), canonicalMember.path, sharedPath);
      importLines.push(`import ${d.isTypeOnly() ? "type " : ""}{ ${named.map((el) => el.getText()).join(", ")} } from ${q0}${spec0}${q0};`);
    }
    const q = d.getModuleSpecifier().getText()[0] ?? '"';
    const spec = rerelativise(d.getModuleSpecifierValue(), canonicalMember.path, sharedPath);
    importLines.push(`import ${d.isTypeOnly() ? "type " : ""}${parts.join(", ")} from ${q}${spec}${q};`);
  }

  let canonicalText: string;
  if (Node.isVariableDeclaration(homeDecl.node) && (homeDecl.statement as VariableStatement).getDeclarations().length > 1) {
    const vs = homeDecl.statement as VariableStatement;
    canonicalText = `export ${vs.getDeclarationKind()} ${homeDecl.node.getText()};`;
  } else {
    canonicalText = asExported(homeDecl.statement);
  }

  const sharedText =
    [importLines.join("\n"), orderedHelpers.map(asExported).join("\n\n"), canonicalText]
      .filter((s) => s.length > 0)
      .join("\n\n") + "\n";
  const shared = project.createSourceFile(`/${sharedPath}`, sharedText, { overwrite: true });

  // --- Rewrite each member file ----------------------------------------------
  const edits: FileEdit[] = [];
  for (const m of members) {
    const sf = files.get(m.path)!;
    const style = fileStyle(sf);
    const { node, statement } = findDecl(sf, m);
    const exportKw = exportModifierKinds(statement);
    const removedNames = new Set(refs(node));

    if (Node.isVariableDeclaration(node) && (statement as VariableStatement).getDeclarations().length > 1) {
      node.remove();
    } else {
      statement.remove();
    }

    // Identical, unexported helper copies that nothing uses any more.
    let changed = true;
    while (changed) {
      changed = false;
      const top = topLevel(sf);
      for (const n of helperNames) {
        const st = top.get(n);
        if (!st || st.wasForgotten()) continue;
        if (declaredNames(st.compilerNode as ts.Statement).length !== 1) continue;
        if (exportModifierKinds(st)) continue;
        if (tokenText(st.compilerNode, sf.compilerNode) !== helperTokens.get(n)) continue;
        if (stillReferenced(sf, n, st)) continue;
        for (const r of refs(st)) removedNames.add(r);
        st.remove();
        changed = true;
      }
    }

    // Import specifiers that only the removed code used.
    for (const d of [...sf.getImportDeclarations()]) {
      if (d.wasForgotten() || !d.getImportClause()) continue;
      let touched = false;
      const def = d.getDefaultImport();
      if (def && removedNames.has(def.getText()) && !stillReferenced(sf, def.getText())) {
        d.removeDefaultImport();
        touched = true;
      }
      const ns = d.getNamespaceImport();
      if (ns && removedNames.has(ns.getText()) && !stillReferenced(sf, ns.getText())) {
        d.removeNamespaceImport();
        touched = true;
      }
      for (const el of [...d.getNamedImports()]) {
        if (d.wasForgotten()) break;
        const local = (el.getAliasNode() ?? el.getNameNode()).getText();
        if (removedNames.has(local) && !stillReferenced(sf, local)) {
          el.remove();
          touched = true;
        }
      }
      if (touched && !d.wasForgotten()) {
        if (!d.getDefaultImport() && !d.getNamespaceImport() && d.getNamedImports().length === 0) d.remove();
      }
    }

    // Import the shared version under the local name.
    let spec = sf.getRelativePathAsModuleSpecifierTo(shared);
    if (style.ext === "js") spec += ".js";
    else if (style.ext === "ts") spec += path.posix.extname(sharedPath);
    const binding = m.name === canonicalName ? canonicalName : `${canonicalName} as ${m.name}`;
    sf.insertStatements(
      importInsertIndex(sf),
      `import { ${binding} } from ${style.quote}${spec}${style.quote}${style.semi}`,
    );
    if (exportKw) sf.addStatements(`export { ${m.name} }${style.semi}`);

    edits.push({ path: m.path, before: originals.get(m.path)!, after: tidy(sf, originals.get(m.path)!) });
  }
  edits.push({ path: sharedPath, before: null, after: sharedText });

  let linesRemoved = 0;
  let linesAdded = 0;
  for (const e of edits) {
    const d = lineDiff(e.before, e.after);
    linesRemoved += d.removed;
    linesAdded += d.added;
  }
  return { sharedPath, canonicalName, edits, linesRemoved, linesAdded };
}

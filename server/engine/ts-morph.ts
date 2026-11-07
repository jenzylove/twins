// The TypeScript compiler breaks when the production build bundles it
// (it reads __filename in ESM). Load ts-morph from node_modules at runtime
// instead; createRequire keeps the bundler from inlining it. Types still come
// from the real package, so callers keep full typing.
import { createRequire } from "node:module";
import type * as TM from "ts-morph";

const tsMorph = createRequire(import.meta.url)("ts-morph") as typeof TM;

export const Node: typeof TM.Node = tsMorph.Node;
export type Node<T extends TM.ts.Node = TM.ts.Node> = TM.Node<T>;
export const Project: typeof TM.Project = tsMorph.Project;
export type Project = TM.Project;
export const SyntaxKind: typeof TM.SyntaxKind = tsMorph.SyntaxKind;
export type SyntaxKind = TM.SyntaxKind;
export const ts: typeof TM.ts = tsMorph.ts;
// eslint-disable-next-line @typescript-eslint/no-namespace
export declare namespace ts {
  export type Node = TM.ts.Node;
  export type SourceFile = TM.ts.SourceFile;
  export type Identifier = TM.ts.Identifier;
  export type Statement = TM.ts.Statement;
  export type CompilerOptions = TM.ts.CompilerOptions;
  export type Diagnostic = TM.ts.Diagnostic;
  export type ScriptKind = TM.ts.ScriptKind;
  export type SyntaxKind = TM.ts.SyntaxKind;
  export type BindingName = TM.ts.BindingName;
  export type Expression = TM.ts.Expression;
  export type FunctionLikeDeclarationBase = TM.ts.FunctionLikeDeclarationBase;
}

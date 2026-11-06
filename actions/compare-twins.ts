import { defineAction } from "@agent-native/core/action";
import { diffArrays } from "diff";
import { z } from "zod";
import {
  ensureWorkdir,
  loadRepo,
  parseScan,
  readOrNull,
  twinsErrors,
  bail,
} from "../server/lib/twins.js";

const LINE_CAP = 200;
const DIFF_CAP = 40;

type Tok = { text: string; line: number };

/** Small lexical tokenizer (no repo code runs; this only reads text). */
function tokenize(src: string, firstLine: number): Tok[] {
  const toks: Tok[] = [];
  const re =
    /\/\/[^\n]*|\/\*[\s\S]*?\*\/|`(?:\[\s\S]|[^`\])*`|"(?:\.|[^"\\n])*"|'(?:\.|[^'\\n])*'|[A-Za-z_$][\w$]*|\d[\w.]*|=>|\.\.\.|[=!<>]=?=?|&&|\|\||\?\?|[^\s\w]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const t = m[0];
    if (t.startsWith("//") || t.startsWith("/*")) continue;
    const line = firstLine + (src.slice(0, m.index).match(/\n/g)?.length ?? 0);
    toks.push({ text: t, line });
  }
  return toks;
}

export default defineAction({
  description:
    "Compare the members of a copy set: returns each member's source text (capped at 200 lines) and a short list of token-level differences against the first member, so an agent can write one parameterised shared version for near copies and pass it to merge-twins as edits.",
  schema: z.object({
    repoId: z.string().describe("Repo id returned by import-repo"),
    setId: z.string().describe("Copy set id from find-twins or get-map"),
  }),
  outputSchema: z.object({
    setId: z.string(),
    name: z.string(),
    kind: z.enum(["exact", "near"]),
    isComponent: z.boolean(),
    referenceMemberId: z.string().describe("Differences are measured against this member"),
    members: z.array(
      z.object({
        id: z.string(),
        path: z.string(),
        line: z.number(),
        endLine: z.number(),
        variant: z.number(),
        truncated: z.boolean(),
        source: z.string(),
      }),
    ),
    differences: z.array(
      z.object({
        memberId: z.string(),
        line: z.number().describe("Line in the member's file where the difference starts"),
        reference: z.string().describe("Tokens in the reference member"),
        other: z.string().describe("Tokens in this member"),
      }),
    ),
    differencesTruncated: z.boolean(),
  }),
  http: { method: "GET" },
  mcpTool: true,
  errors: twinsErrors,
  run: async (args, ctx) => {
    const row = await loadRepo(ctx, args.repoId);
    const scan = parseScan(row);
    const set = scan.sets.find((s) => s.id === args.setId);
    if (!set) {
      bail("No copy set with that id.", "set_not_found", {
        statusCode: 404,
      });
    }
    const dir = await ensureWorkdir(row);
    const loaded = set.members.map((m) => {
      const text = readOrNull(dir, m.path) ?? "";
      const lines = text.split("\n").slice(m.line - 1, m.endLine);
      return { m, lines };
    });
    const members = loaded.map(({ m, lines }) => ({
      id: m.id,
      path: m.path,
      line: m.line,
      endLine: m.endLine,
      variant: m.variant,
      truncated: lines.length > LINE_CAP,
      source: lines.slice(0, LINE_CAP).join("\n"),
    }));
    const differences: {
      memberId: string;
      line: number;
      reference: string;
      other: string;
    }[] = [];
    let truncated = false;
    const ref = loaded[0];
    if (!ref) return bail("This set has no members.", "set_not_found", { statusCode: 404 });
    const refToks = tokenize(ref.lines.join("\n"), ref.m.line);
    for (const { m, lines } of loaded.slice(1)) {
      if (m.variant === ref.m.variant) continue; // true copy: no differences
      const toks = tokenize(lines.join("\n"), m.line);
      const parts = diffArrays(
        refToks.map((t) => t.text),
        toks.map((t) => t.text),
      );
      let ri = 0;
      let oi = 0;
      for (let p = 0; p < parts.length; p++) {
        const part = parts[p];
        if (!part) continue;
        const n = part.value.length;
        if (!part.added && !part.removed) {
          ri += n;
          oi += n;
          continue;
        }
        const next = parts[p + 1];
        let reference = "";
        let other = "";
        if (part.removed) {
          reference = part.value.join(" ");
          ri += n;
          if (next?.added) {
            other = next.value.join(" ");
            oi += next.value.length;
            p++;
          }
        } else {
          other = part.value.join(" ");
          oi += n;
        }
        if (differences.length >= DIFF_CAP) {
          truncated = true;
          break;
        }
        differences.push({
          memberId: m.id,
          line: toks[Math.max(0, oi - 1)]?.line ?? m.line,
          reference: reference.slice(0, 160),
          other: other.slice(0, 160),
        });
      }
    }
    return {
      setId: set.id,
      name: set.name,
      kind: set.kind,
      isComponent: set.isComponent,
      referenceMemberId: ref.m.id,
      members,
      differences,
      differencesTruncated: truncated,
    };
  },
});

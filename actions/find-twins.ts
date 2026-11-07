import { defineAction } from "@agent-native/core/action";
import { z } from "zod";
import { mapEmbed } from "../server/lib/map-embed.js";
import { loadRepo, parseScan, twinsErrors } from "../server/lib/twins.js";

const memberSchema = z.object({
  id: z.string().describe("Member id: path#name#line"),
  name: z.string(),
  path: z.string(),
  line: z.number(),
  endLine: z.number(),
  lines: z.number(),
  declKind: z.enum(["function", "const"]),
  exported: z.boolean(),
  isDefault: z.boolean(),
  variant: z.number().describe("Members sharing a variant are true copies"),
});

export default defineAction({
  description:
    "List the duplicate code sets (copies) in an imported repo with their members, biggest first. kind exact means identical copies that can merge deterministically; near means similar copies an agent can merge with compare-twins plus merge-twins edits.",
  schema: z.object({
    repoId: z.string().describe("Repo id returned by import-repo"),
    kind: z
      .enum(["exact", "near", "all"])
      .default("all")
      .describe('Filter by set kind: "exact", "near" or "all"; defaults to "all"'),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(200)
      .default(20)
      .describe("Maximum sets to return; defaults to 20"),
  }),
  outputSchema: z.object({
    total: z.number().describe("Sets matching the filter before the limit"),
    sets: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        kind: z.enum(["exact", "near"]),
        isComponent: z.boolean(),
        duplicateLines: z.number(),
        mergeable: z.boolean(),
        reason: z.string().nullable(),
        members: z.array(memberSchema),
      }),
    ),
  }),
  http: { method: "GET" },
  mcpTool: true,
  errors: twinsErrors,
  ...mapEmbed<{ repoId: string }>({
    title: "Twins copies map",
    openLabel: "Open the map in Twins",
  }),
  run: async (args, ctx) => {
    const row = await loadRepo(ctx, args.repoId);
    const scan = parseScan(row);
    const all = scan.sets.filter((s) => args.kind === "all" || s.kind === args.kind);
    return {
      total: all.length,
      sets: all.slice(0, args.limit).map((s) => ({
        id: s.id,
        name: s.name,
        kind: s.kind,
        isComponent: s.isComponent,
        duplicateLines: s.duplicateLines,
        mergeable: s.mergeable,
        reason: s.reason ?? null,
        members: s.members.map((m) => ({
          id: m.id,
          name: m.name,
          path: m.path,
          line: m.line,
          endLine: m.endLine,
          lines: m.lines,
          declKind: m.declKind,
          exported: m.exported,
          isDefault: m.isDefault,
          variant: m.variant,
        })),
      })),
    };
  },
});

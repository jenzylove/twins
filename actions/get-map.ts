import { defineAction } from "@agent-native/core/action";
import { z } from "zod";
import type { Diag } from "../server/engine/check.js";
import {
  compactSet,
  listMerges,
  loadRepo,
  parseBaseline,
  parseScan,
  twinsErrors,
} from "../server/lib/twins.js";

function parseDiags(json: string): Diag[] {
  try {
    const v = JSON.parse(json || "[]");
    return Array.isArray(v) ? (v as Diag[]) : [];
  } catch {
    return [];
  }
}

export default defineAction({
  description:
    "Get the map of an imported repo: files (path, lines, imports, copies), duplicate sets summary, preparation status, baseline type check summary (errors, coverage, build), the merges list, and ending metrics (duplicate lines at start vs now, merges kept and refused).",
  schema: z.object({
    repoId: z.string().describe("Repo id returned by import-repo"),
    maxFiles: z.coerce
      .number()
      .int()
      .min(1)
      .max(5000)
      .default(500)
      .describe(
        "Maximum files to list, most duplicated first; defaults to 500. totals.files is always the full count",
      ),
  }),
  outputSchema: z.object({
    repo: z.object({
      id: z.string(),
      owner: z.string(),
      name: z.string(),
      sha: z.string(),
      htmlUrl: z.string(),
    }),
    status: z.string().describe("scanning, preparing, ready or failed"),
    statusDetail: z.string().nullable(),
    totals: z.object({
      files: z.number(),
      sourceLines: z.number(),
      duplicateLines: z.number(),
      sets: z.number(),
    }),
    files: z.array(
      z.object({
        path: z.string(),
        lines: z.number(),
        imports: z.array(z.string()),
        copies: z.number(),
      }),
    ),
    sets: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        kind: z.enum(["exact", "near"]),
        isComponent: z.boolean(),
        members: z.number(),
        duplicateLines: z.number(),
        mergeable: z.boolean(),
        reason: z.string().nullable(),
      }),
    ),
    baseline: z
      .object({
        errors: z.number(),
        coverage: z.object({
          covered: z.number(),
          total: z.number(),
          ratio: z.number(),
        }),
        build: z
          .object({ ran: z.boolean(), ok: z.boolean(), ms: z.number() })
          .nullable(),
        checkMs: z.number(),
      })
      .nullable(),
    merges: z.array(
      z.object({
        id: z.string(),
        setId: z.string(),
        status: z.string(),
        mode: z.string(),
        caller: z.string(),
        sharedPath: z.string(),
        linesRemoved: z.number(),
        linesAdded: z.number(),
        checkMs: z.number(),
        summary: z.string(),
        setName: z
          .string()
          .describe("The copy set's display name when the merge ran"),
        added: z
          .array(
            z.object({
              file: z.string(),
              line: z.number(),
              col: z.number(),
              code: z.string(),
              message: z.string(),
            }),
          )
          .describe("Type errors this merge added (set for refused merges)"),
        createdAt: z.string(),
      }),
    ),
    metrics: z.object({
      duplicateLinesAtStart: z.number(),
      duplicateLinesNow: z.number(),
      mergesKept: z.number(),
      mergesRefused: z.number(),
      mergesUndone: z.number(),
    }),
  }),
  http: { method: "GET" },
  mcpTool: true,
  errors: twinsErrors,
  run: async (args, ctx) => {
    const row = await loadRepo(ctx, args.repoId);
    const scan = parseScan(row);
    const baseline = parseBaseline(row);
    const merges = await listMerges(row.id);
    const files = [...scan.files]
      .sort((a, b) => b.copies - a.copies || b.lines - a.lines)
      .slice(0, args.maxFiles);
    const count = (s: string) => merges.filter((m) => m.status === s).length;
    return {
      repo: {
        id: row.id,
        owner: row.repoOwner,
        name: row.repoName,
        sha: row.sha,
        htmlUrl: row.htmlUrl,
      },
      status: row.status,
      statusDetail: row.statusDetail ?? null,
      totals: scan.totals,
      files,
      sets: scan.sets.map(compactSet),
      baseline: baseline
        ? {
            errors: baseline.diags.length,
            coverage: baseline.coverage,
            build: baseline.build
              ? {
                  ran: baseline.build.ran,
                  ok: baseline.build.ok,
                  ms: baseline.build.ms,
                }
              : null,
            checkMs: baseline.ms,
          }
        : null,
      merges: merges.map((m) => ({
        id: m.id,
        setId: m.setId,
        status: m.status,
        mode: m.mode,
        caller: m.caller,
        sharedPath: m.sharedPath,
        linesRemoved: m.linesRemoved,
        linesAdded: m.linesAdded,
        checkMs: m.checkMs,
        summary: m.summary,
        setName:
          m.setName ||
          /^Merged (.+?) into /.exec(m.summary)?.[1] ||
          scan.sets.find((x) => x.id === m.setId)?.name ||
          m.setId,
        added: parseDiags(m.addedDiagsJson),
        createdAt: m.createdAt,
      })),
      metrics: {
        duplicateLinesAtStart: scan.initial?.duplicateLines ?? scan.totals.duplicateLines,
        duplicateLinesNow: scan.totals.duplicateLines,
        mergesKept: count("kept"),
        mergesRefused: count("refused"),
        mergesUndone: count("undone"),
      },
    };
  },
});

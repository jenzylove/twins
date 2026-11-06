import {
  defineAction,
  fail,
  noteExternalWrite,
} from "@agent-native/core/action";
import { z } from "zod";
import { compareDiags } from "../server/engine/check.js";
import type { FileEdit } from "../server/engine/merge.js";
import { runCheck, writeFiles } from "../server/engine/sandbox.js";
import {
  applyToDisk,
  engine,
  ensureReady,
  formatDiag,
  listMerges,
  loadRepo,
  markUndone,
  parseBaseline,
  rescan,
  twinsErrors,
  withRepoLock,
  bail,
} from "../server/lib/twins.js";

export default defineAction({
  description:
    "Undo a kept merge: restores the original file contents in the sandbox and the working copy, re-checks that the type check is back to baseline, then marks the merge undone. Only works for a kept merge whose files were not touched by a later kept merge (undo the later one first).",
  schema: z.object({
    repoId: z.string().describe("Repo id returned by import-repo"),
    mergeId: z
      .string()
      .describe("Id of a kept merge, from merge-twins or get-map"),
  }),
  outputSchema: z.object({
    mergeId: z.string(),
    status: z.literal("undone"),
    filesRestored: z.array(z.string()),
    checkMs: z.number(),
    errorsNow: z.number(),
    baselineErrors: z.number(),
    duplicateLinesNow: z.number(),
  }),
  mcpTool: true,
  mcpAnnotations: {
    readOnlyHint: false,
    destructiveHint: true,
    openWorldHint: true,
  },
  errors: twinsErrors,
  run: async (args, ctx) => {
    const repo0 = await loadRepo(ctx, args.repoId);
    return withRepoLock(repo0.id, async () => {
      const merges = await listMerges(repo0.id);
      const target = merges.find((m) => m.id === args.mergeId);
      if (!target) {
        bail("Merge not found.", "merge_not_found", {
          statusCode: 404,
        });
      }
      if (target.status !== "kept") {
        bail(
          `Only a kept merge can be undone; this one is ${target.status}.`,
          "undo_blocked",
          { statusCode: 409 },
        );
      }
      const edits = JSON.parse(target.editsJson) as FileEdit[];
      const paths = new Set(edits.map((e) => e.path));
      const later = merges.filter(
        (m) =>
          m.status === "kept" &&
          m.createdAt > target.createdAt &&
          (JSON.parse(m.editsJson) as FileEdit[]).some((e) =>
            paths.has(e.path),
          ),
      );
      if (later.length > 0) {
        bail(
          `A later kept merge touches the same files (${later.map((m) => m.id).join(", ")}). Undo that one first.`,
          "undo_blocked",
          {
            statusCode: 409,
            details: { blockedBy: later.map((m) => m.id) },
          },
        );
      }

      const { row, dir } = await ensureReady(repo0);
      const sandboxId = row.sandboxId as string;
      const baseline = parseBaseline(row);
      if (!baseline) {
        bail(
          "The baseline check has not finished.",
          "not_ready",
          { statusCode: 409 },
        );
      }
      const restore = (e: FileEdit) => ({ path: e.path, content: e.before });
      const reapply = (e: FileEdit) => ({ path: e.path, content: e.after });
      noteExternalWrite("vercel-sandbox");
      await engine(() => writeFiles(sandboxId, edits.map(restore)));
      const withBuild = !!(baseline.build?.ran && baseline.build.ok);
      let after;
      try {
        after = await engine(() =>
          runCheck(sandboxId, baseline.targets, withBuild),
        );
      } catch (err) {
        await writeFiles(sandboxId, edits.map(reapply)).catch(() => undefined);
        throw err;
      }
      const { added } = compareDiags(baseline.diags, after.diags);
      const buildBroke = withBuild && !!after.build?.ran && !after.build.ok;
      if (added.length > 0 || buildBroke) {
        await writeFiles(sandboxId, edits.map(reapply));
        fail(
          `Undo did not get back to baseline (${added.length > 0 ? added.slice(0, 2).map(formatDiag).join("; ") : "the build failed"}). The merge was left in place.`,
          { errorCode: "undo_unverified", statusCode: 422 },
        );
      }
      applyToDisk(dir, edits.map(restore));
      const next = await rescan(row, dir);
      const ok = await markUndone(target.id);
      if (!ok) {
        fail("The merge changed status while undoing.", {
          errorCode: "undo_blocked",
          statusCode: 409,
        });
      }
      return {
        mergeId: target.id,
        status: "undone" as const,
        filesRestored: edits.map((e) => e.path),
        checkMs: after.ms,
        errorsNow: after.diags.length,
        baselineErrors: baseline.diags.length,
        duplicateLinesNow: next.totals.duplicateLines,
      };
    });
  },
});

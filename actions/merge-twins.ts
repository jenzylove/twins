import {
  defineAction,
  fail,
  noteExternalWrite,
} from "@agent-native/core/action";
import { z } from "zod";
import { getDb, schema } from "../server/db/index.js";
import { compareDiags, type Diag } from "../server/engine/check.js";
import {
  planMerge,
  type FileEdit,
  type MergePlan,
} from "../server/engine/merge.js";
import { runCheck, writeFiles } from "../server/engine/sandbox.js";
import {
  applyToDisk,
  callerOf,
  countLines,
  engine,
  ensureReady,
  formatDiag,
  loadRepo,
  nowIso,
  parseBaseline,
  parseScan,
  readOrNull,
  rescan,
  twinsErrors,
  withRepoLock,
  bail,
} from "../server/lib/twins.js";

const MIN_COVERAGE = 0.6;

export default defineAction({
  description:
    "Merge a set of duplicate copies into one shared file, but only if the type check does not get worse. Without edits it plans the merge deterministically (exact copies). With edits (an agent-written merge for near copies, see compare-twins) it applies them as given. Either way the edits are written to the sandbox and re-checked; if the merge adds any type error, or breaks a passing build, it is reverted, recorded as refused, and the action fails with merge_refused and the added errors. Nothing changes on a refusal.",
  schema: z.object({
    repoId: z.string().describe("Repo id returned by import-repo"),
    setId: z.string().describe("Copy set id from find-twins"),
    memberIds: z
      .array(z.string())
      .optional()
      .describe(
        "Subset of the set's member ids to merge (path#name#line); omit to merge every member",
      ),
    sharedPath: z
      .string()
      .optional()
      .describe(
        "Repo-relative path for the new shared file (.ts or .tsx, must not exist); omit to let Twins choose next to the copies",
      ),
    edits: z
      .array(
        z.object({
          path: z
            .string()
            .describe("Repo-relative POSIX path of the file to write"),
          content: z
            .string()
            .nullable()
            .describe("Full new file content, or null to delete the file"),
        }),
      )
      .optional()
      .describe(
        "Agent-written merge: the complete new content of every file to change (including the new shared file). Omit for a deterministic merge of exact copies",
      ),
  }),
  outputSchema: z.object({
    mergeId: z.string(),
    status: z.literal("kept"),
    mode: z.enum(["auto", "agent"]),
    sharedPath: z.string(),
    canonicalName: z.string(),
    filesChanged: z.array(z.string()),
    linesRemoved: z.number(),
    linesAdded: z.number(),
    checkMs: z.number(),
    baselineErrors: z.number(),
    errorsFixed: z.number(),
    summary: z.string(),
    duplicateLinesNow: z.number(),
    nextRequiredAction: z.string(),
  }),
  mcpTool: true,
  mcpAnnotations: {
    readOnlyHint: false,
    destructiveHint: false,
    openWorldHint: true,
  },
  errors: twinsErrors,
  run: async (args, ctx) => {
    const repo0 = await loadRepo(ctx, args.repoId);
    return withRepoLock(repo0.id, async () => {
      const { row, dir } = await ensureReady(await loadRepo(ctx, args.repoId));
      const sandboxId = row.sandboxId as string;
      const scan = parseScan(row);
      const baseline = parseBaseline(row);
      if (!baseline) {
        bail(
          "The baseline check has not finished.",
          "not_ready",
          { statusCode: 409 },
        );
      }
      if (baseline.coverage.ratio < MIN_COVERAGE) {
        bail(
          `Twins can only type check ${Math.round(baseline.coverage.ratio * 100)}% of this repo's source files, so it cannot judge merges safely. Nothing was changed.`,
          "low_coverage",
          { statusCode: 422, details: { ...baseline.coverage } },
        );
      }
      const set = scan.sets.find((s) => s.id === args.setId);
      if (!set) {
        bail("No copy set with that id.", "set_not_found", {
          statusCode: 404,
        });
      }

      // 1. Build the edit list.
      let plan: MergePlan;
      let mode: "auto" | "agent";
      if (args.edits) {
        mode = "agent";
        const seen = new Set<string>();
        const fileEdits: FileEdit[] = [];
        for (const e of args.edits) {
          if (seen.has(e.path)) {
            bail(
              `Path listed twice: ${e.path}`,
              "invalid_edits",
              { statusCode: 400 },
            );
          }
          seen.add(e.path);
          if (
            e.path.startsWith("/") ||
            e.path.includes("\\") ||
            e.path.split("/").includes("..") ||
            e.path.startsWith(".git/") ||
            e.path.startsWith("node_modules/")
          ) {
            bail(
              `Path not allowed: ${e.path}`,
              "invalid_edits",
              { statusCode: 400 },
            );
          }
          const before = readOrNull(dir, e.path);
          if (before === e.content) continue;
          fileEdits.push({ path: e.path, before, after: e.content });
        }
        if (fileEdits.length === 0) {
          bail("The edits change nothing.", "invalid_edits", {
            statusCode: 400,
          });
        }
        const created = fileEdits.find(
          (f) => f.before === null && f.after !== null,
        );
        plan = {
          sharedPath: args.sharedPath ?? created?.path ?? fileEdits[0]?.path ?? set.name,
          canonicalName: set.name,
          edits: fileEdits,
          linesRemoved: fileEdits.reduce(
            (n, f) =>
              n + Math.max(0, countLines(f.before) - countLines(f.after)),
            0,
          ),
          linesAdded: fileEdits.reduce(
            (n, f) =>
              n + Math.max(0, countLines(f.after) - countLines(f.before)),
            0,
          ),
        };
      } else {
        mode = "auto";
        if (!set.mergeable) {
          bail(
            `This set cannot merge automatically: ${set.reason ?? "its copies differ"}. Use compare-twins and pass edits.`,
            "not_mergeable",
            { statusCode: 422 },
          );
        }
        plan = await engine(() =>
          planMerge(dir, set, {
            ...(args.memberIds ? { memberIds: args.memberIds } : {}),
            ...(args.sharedPath ? { sharedPath: args.sharedPath } : {}),
          }),
        );
      }

      // 2. Apply to the sandbox and re-check.
      const toContent = (f: FileEdit) => ({ path: f.path, content: f.after });
      const restore = (f: FileEdit) => ({ path: f.path, content: f.before });
      noteExternalWrite("vercel-sandbox");
      await engine(() => writeFiles(sandboxId, plan.edits.map(toContent)));
      const withBuild = !!(baseline.build?.ran && baseline.build.ok);
      let after;
      try {
        after = await engine(() =>
          runCheck(sandboxId, baseline.targets, withBuild),
        );
      } catch (err) {
        await writeFiles(sandboxId, plan.edits.map(restore)).catch(
          () => undefined,
        );
        throw err;
      }
      const { added, fixed } = compareDiags(baseline.diags, after.diags);
      const buildBroke = withBuild && !!after.build?.ran && !after.build.ok;
      const mergeId = crypto.randomUUID();

      // 3. Refuse: restore, record the row, then fail.
      if (added.length > 0 || buildBroke) {
        await writeFiles(sandboxId, plan.edits.map(restore));
        const first = added.slice(0, 3).map(formatDiag).join("; ").replace(/\.$/, "");
        const message =
          added.length === 0
            ? "Twins said no: this merge breaks the build, which passed before. Nothing was changed."
            : `Twins said no: this merge adds ${added.length} type error${added.length === 1 ? "" : "s"}. ${first}. Nothing was changed.`;
        await getDb()
          .insert(schema.merges)
          .values({
            id: mergeId,
            repoId: row.id,
            ownerEmail: row.ownerEmail,
            orgId: row.orgId,
            setId: set.id,
            status: "refused",
            mode,
            caller: callerOf(ctx),
            sharedPath: plan.sharedPath,
            editsJson: JSON.stringify(plan.edits),
            linesRemoved: plan.linesRemoved,
            linesAdded: plan.linesAdded,
            addedDiagsJson: JSON.stringify(added),
            checkMs: after.ms,
            summary: message,
            setName: set.name,
            createdAt: nowIso(),
          });
        fail(message, {
          errorCode: "merge_refused",
          statusCode: 422,
          details: {
            mergeId,
            added: added.slice(0, 20).map((d: Diag) => ({
              file: d.file,
              line: d.line,
              code: d.code,
              message: d.message,
            })),
            buildBroke,
          },
        });
      }

      // 4. Keep: workdir, rescan, record.
      applyToDisk(dir, plan.edits.map(toContent));
      const next = await rescan(row, dir);
      const summary = `Merged ${set.name} into ${plan.sharedPath}: ${plan.linesRemoved} lines removed, ${plan.linesAdded} added, type check ${after.diags.length} errors (baseline ${baseline.diags.length}).`;
      await getDb()
        .insert(schema.merges)
        .values({
          id: mergeId,
          repoId: row.id,
          ownerEmail: row.ownerEmail,
          orgId: row.orgId,
          setId: set.id,
          status: "kept",
          mode,
          caller: callerOf(ctx),
          sharedPath: plan.sharedPath,
          editsJson: JSON.stringify(plan.edits),
          linesRemoved: plan.linesRemoved,
          linesAdded: plan.linesAdded,
          addedDiagsJson: "[]",
          checkMs: after.ms,
          summary,
          setName: set.name,
          createdAt: nowIso(),
        });
      return {
        mergeId,
        status: "kept" as const,
        mode,
        sharedPath: plan.sharedPath,
        canonicalName: plan.canonicalName,
        filesChanged: plan.edits.map((e) => e.path),
        linesRemoved: plan.linesRemoved,
        linesAdded: plan.linesAdded,
        checkMs: after.ms,
        baselineErrors: baseline.diags.length,
        errorsFixed: fixed,
        summary,
        duplicateLinesNow: next.totals.duplicateLines,
        nextRequiredAction: "find-twins",
      };
    });
  },
});

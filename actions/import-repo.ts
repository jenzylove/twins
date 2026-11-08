import { defineAction } from "@agent-native/core/action";
import { z } from "zod";
import { getDb, schema } from "../server/db/index.js";
import { downloadRepo, fetchRepoInfo, parseRepoUrl, workdirFor } from "../server/engine/repo.js";
import { scanRepo } from "../server/engine/scan.js";
import {
  bail,
  compactSet,
  engine,
  nowIso,
  requireUser,
  startPrepare,
  transitionRepo,
  twinsErrors,
  type StoredScan,
} from "../server/lib/twins.js";
import fs from "node:fs";
import { noteExternalWrite } from "@agent-native/core/action";
import { and, desc, eq, gt, isNotNull, ne } from "drizzle-orm";
import { stopSandbox } from "../server/engine/sandbox.js";

/** Imports per user per day, and sandboxes a user keeps running at once. */
const DAILY_IMPORTS = 20;
const LIVE_SANDBOXES = 2;

export default defineAction({
  description:
    "Import a public GitHub repo into Twins. Downloads it, maps the files and finds duplicate code (copies) in about a second, then prepares a sandbox in the background (install plus baseline type check). Returns the repo id, totals and the top 5 copy sets. Poll get-map until status is ready before merge-twins.",
  schema: z.object({
    url: z
      .string()
      .min(1)
      .describe(
        'Public GitHub repo: "owner/name", "github.com/owner/name" or a full https URL (a /tree/... suffix is ignored)',
      ),
  }),
  outputSchema: z.object({
    id: z.string().describe("Repo id; pass as repoId to the other actions"),
    repo: z.object({
      owner: z.string(),
      name: z.string(),
      sha: z.string(),
      defaultBranch: z.string(),
      htmlUrl: z.string(),
      description: z.string().nullable(),
      stars: z.number(),
    }),
    totals: z.object({
      files: z.number(),
      sourceLines: z.number(),
      duplicateLines: z.number(),
      sets: z.number(),
    }),
    topSets: z.array(
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
    status: z.string().describe("preparing; becomes ready or failed"),
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
    const { email, orgId } = requireUser(ctx);
    const dayAgo = new Date(Date.now() - 24 * 3600_000).toISOString();
    const recent = await getDb()
      .select({ id: schema.repos.id })
      .from(schema.repos)
      .where(and(eq(schema.repos.ownerEmail, email), gt(schema.repos.createdAt, dayAgo)));
    if (recent.length >= DAILY_IMPORTS) {
      bail(
        `You have imported ${DAILY_IMPORTS} repos in the last day. Reuse one of your maps or try again tomorrow.`,
        "rate_limited",
        { statusCode: 429 },
      );
    }
    const info = await engine(async () => fetchRepoInfo(parseRepoUrl(args.url)));
    const id = crypto.randomUUID();
    const now = nowIso();
    await getDb().insert(schema.repos).values({
      id,
      ownerEmail: email,
      orgId,
      repoOwner: info.owner,
      repoName: info.name,
      sha: info.sha,
      defaultBranch: info.defaultBranch,
      htmlUrl: info.htmlUrl,
      status: "scanning",
      createdAt: now,
      updatedAt: now,
    });
    let scan: StoredScan;
    try {
      const dir = workdirFor(id);
      noteExternalWrite("local-disk");
      fs.mkdirSync(dir, { recursive: true });
      await engine(async () => {
        await downloadRepo({ owner: info.owner, name: info.name }, info.sha, dir);
        const result = scanRepo(dir);
        scan = { ...result, initial: result.totals };
      });
      fs.writeFileSync(`${dir}/.twins-ready`, now);
    } catch (err) {
      await transitionRepo(id, "fail", {
        statusDetail:
          err instanceof Error ? err.message.slice(0, 200) : "Import failed.",
      });
      throw err;
    }
    await getDb()
      .update(schema.repos)
      .set({ scanJson: JSON.stringify(scan!) })
      .where(eq(schema.repos.id, id));
    await transitionRepo(id, "scanned");
    const [row] = await getDb()
      .select()
      .from(schema.repos)
      .where(eq(schema.repos.id, id))
      .limit(1);
    if (!row) return bail("Repo vanished.", "repo_not_found", { statusCode: 500 });
    // Keep at most LIVE_SANDBOXES running per user: stop the least recently used.
    // A stopped repo restarts its sandbox (and replays kept merges) on its next merge.
    const live = await getDb()
      .select({ id: schema.repos.id, sandboxId: schema.repos.sandboxId })
      .from(schema.repos)
      .where(
        and(
          eq(schema.repos.ownerEmail, email),
          ne(schema.repos.id, id),
          isNotNull(schema.repos.sandboxId),
        ),
      )
      .orderBy(desc(schema.repos.updatedAt));
    for (const old of live.slice(LIVE_SANDBOXES - 1)) {
      noteExternalWrite("vercel-sandbox");
      void stopSandbox(old.sandboxId!);
      await getDb()
        .update(schema.repos)
        .set({ sandboxId: null })
        .where(eq(schema.repos.id, old.id));
      fs.rmSync(workdirFor(old.id), { recursive: true, force: true });
    }
    // Background prepare: never awaited. ensureReady finishes it if this dies.
    void startPrepare(row);
    return {
      id,
      repo: {
        owner: info.owner,
        name: info.name,
        sha: info.sha,
        defaultBranch: info.defaultBranch,
        htmlUrl: info.htmlUrl,
        description: info.description ?? null,
        stars: info.stars ?? 0,
      },
      totals: scan!.totals,
      topSets: scan!.sets.slice(0, 5).map(compactSet),
      status: "preparing",
      nextRequiredAction: "get-map",
    };
  },
});

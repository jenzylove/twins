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
import { eq } from "drizzle-orm";

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

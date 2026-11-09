import { listOAuthAccountsByOwner } from "@agent-native/core/oauth-tokens";
import { GITHUB_PROVIDER } from "../server/lib/github-connect.js";
import {
  defineAction,
  fail,
  noteExternalWrite,
} from "@agent-native/core/action";
import { getDbExec } from "@agent-native/core/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "../server/db/index.js";
import {
  GithubPrError,
  openPullRequest,
  resolveGithubToken,
} from "../server/lib/github-pr.js";
import {
  bail,
  listMerges,
  loadRepo,
  nowIso,
  parseBaseline,
  parseScan,
  twinsErrors,
} from "../server/lib/twins.js";

export default defineAction({
  description:
    "Open a pull request with all kept merges. Uses only the signed-in user's own GitHub connection: pushes a branch twins/merge-copies-<id> at the imported commit with the final content of every changed file. If the user owns the repo, the PR opens on it. Otherwise Twins forks it to their account and opens the PR on their own fork, so nothing lands on someone else's project; only pass toUpstream when the user explicitly asks to send it to the original repo. With forkOnly it pushes the branch and returns the compare URL instead. Fails with github_not_connected when the user has not connected GitHub; tell them to press Connect GitHub on the repo map. Refuses owner BuilderIO unless confirmUpstream is true.",
  schema: z.object({
    repoId: z.string().describe("Repo id returned by import-repo"),
    title: z.string().max(250).optional().describe("PR title; defaults to a summary of the merges"),
    body: z.string().max(60000).optional().describe("PR body; defaults to a per merge report"),
    forkOnly: z.coerce
      .boolean()
      .optional()
      .describe("Push the branch to the fork and return the compare URL without opening a PR"),
    confirmUpstream: z.coerce
      .boolean()
      .optional()
      .describe("Required to open a PR against a guarded upstream owner (BuilderIO)"),
    toUpstream: z.coerce
      .boolean()
      .optional()
      .describe("Open the PR on the original repo the user does not own. Only when the user explicitly asks for it."),
  }),
  outputSchema: z.object({
    id: z.string(),
    url: z.string().describe("PR url, or the compare url when forkOnly"),
    number: z.number().optional(),
  }),
  mcpTool: true,
  mcpAnnotations: {
    readOnlyHint: false,
    destructiveHint: false,
    openWorldHint: true,
  },
  errors: twinsErrors,
  run: async (args, ctx) => {
    const row = await loadRepo(ctx, args.repoId);
    const email = ctx?.userEmail as string;
    const kept = (await listMerges(row.id)).filter((m) => m.status === "kept");
    const scan = parseScan(row);
    const baseline = parseBaseline(row);

    let token: string;
    try {
      token = await resolveGithubToken(
        (q) => getDbExec().execute(q) as never,
        email,
        async (e) => {
          const accounts = await listOAuthAccountsByOwner(GITHUB_PROVIDER, e.toLowerCase());
          return (accounts[0]?.tokens as { access_token?: string; scope?: string }) ?? null;
        },
      );
    } catch (e) {
      if (e instanceof GithubPrError) bail(e.message, e.code);
      throw e;
    }

    try {
      const result = await openPullRequest({
        token,
        upstream: {
          owner: row.repoOwner,
          name: row.repoName,
          defaultBranch: row.defaultBranch,
          sha: row.sha,
        },
        repoId: row.id,
        merges: kept.map((m) => ({
          id: m.id,
          setName:
            m.setName ||
            /^Merged (.+?) into /.exec(m.summary)?.[1] ||
            scan.sets.find((x) => x.id === m.setId)?.name ||
            m.setId,
          summary: m.summary,
          editsJson: m.editsJson,
          linesRemoved: m.linesRemoved,
        })),
        baseline: {
          errors: baseline?.diags.length ?? 0,
          covered: baseline?.coverage.covered ?? 0,
          total: baseline?.coverage.total ?? 0,
          build: baseline?.build
            ? { ran: baseline.build.ran, ok: baseline.build.ok }
            : null,
        },
        title: args.title,
        body: args.body,
        forkOnly: args.forkOnly,
        confirmUpstream: args.confirmUpstream,
        toUpstream: args.toUpstream,
        onWriteStart: () => noteExternalWrite("github"),
      });
      if (!args.forkOnly) {
        await getDb()
          .update(schema.repos)
          .set({
            prUrl: result.url,
            prNumber: result.number ?? null,
            updatedAt: nowIso(),
          })
          .where(eq(schema.repos.id, row.id));
      }
      return {
        id: row.id,
        url: result.url,
        ...(result.number !== undefined ? { number: result.number } : {}),
      };
    } catch (e) {
      if (e instanceof GithubPrError) {
        if (e.wrote) {
          fail(e.message, { errorCode: e.code, statusCode: 502 });
        }
        bail(e.message, e.code, {
          ...(e.details ? { details: e.details } : {}),
        });
      }
      throw e;
    }
  },
});

// Open a pull request from kept merges using the signed-in user's own GitHub
// token. Pure helpers plus a thin fetch based GitHub client. Nothing here
// touches the database or the action framework, so it can be tested with a
// mocked fetch.
import type { FileEdit } from "../engine/merge.js";

export type GithubErrorCode =
  | "github_not_connected"
  | "nothing_to_merge"
  | "upstream_confirmation_required"
  | "github_error";

export class GithubPrError extends Error {
  readonly code: GithubErrorCode;
  readonly details?: Record<string, unknown> | undefined;
  /** True once something was written on GitHub (fork, branch, commit). */
  readonly wrote: boolean;
  constructor(
    code: GithubErrorCode,
    message: string,
    opts?: { details?: Record<string, unknown>; wrote?: boolean },
  ) {
    super(message);
    this.code = code;
    this.details = opts?.details;
    this.wrote = opts?.wrote ?? false;
  }
}

export const CONNECT_HELP =
  "GitHub is not connected. Open the repo map, press Connect GitHub and approve the public_repo permission, then try again.";

export const GUARDED_OWNERS = ["builderio"];

/* ------------------------------ token lookup ------------------------------ */

export type SqlExec = (q: {
  sql: string;
  args: unknown[];
}) => Promise<{ rows: Array<Record<string, unknown>> }>;

/**
 * The calling user's own GitHub access token from the better-auth `account`
 * table (written when they sign in with or link GitHub). Never reads env.
 */
export async function resolveGithubToken(
  exec: SqlExec,
  email: string,
  stored?: (email: string) => Promise<{ access_token?: string; scope?: string } | null>,
): Promise<string> {
  // Preferred: the token from Twins' own Connect GitHub flow (no account linking).
  const own = stored ? await stored(email).catch(() => null) : null;
  if (own?.access_token) {
    if (!String(own.scope ?? "").split(/[\s,]+/).includes("public_repo")) {
      throw new GithubPrError(
        "github_not_connected",
        "GitHub is connected without permission to write to public repos. Press Connect GitHub and approve public_repo, then try again.",
      );
    }
    return own.access_token;
  }
  const { rows } = await exec({
    sql: `SELECT a.access_token AS access_token, a.scope AS scope
FROM "account" a JOIN "user" u ON u.id = a.user_id
WHERE a.provider_id = ? AND lower(u.email) = lower(?)
ORDER BY a.updated_at DESC LIMIT 1`,
    args: ["github", email],
  });
  const row = rows[0];
  const token = row?.access_token;
  if (typeof token !== "string" || !token) {
    throw new GithubPrError("github_not_connected", CONNECT_HELP);
  }
  const scope = String(row?.scope ?? "");
  if (!scope.split(/[\s,]+/).includes("public_repo")) {
    throw new GithubPrError(
      "github_not_connected",
      "GitHub is connected without permission to write to public repos. Press Connect GitHub and approve public_repo, then try again.",
    );
  }
  return token;
}

/* --------------------------------- pure ----------------------------------- */

export type KeptMerge = {
  id: string;
  setName: string;
  summary: string;
  editsJson: string;
  linesRemoved: number;
};

export type BaselineInfo = {
  errors: number;
  covered: number;
  total: number;
  build: { ran: boolean; ok: boolean } | null;
};

export type FinalChange = { path: string; content: string | null };

/** Latest `after` per path across kept merges, oldest first. Unchanged files drop out. */
export function collapseEdits(
  merges: Pick<KeptMerge, "editsJson">[],
): FinalChange[] {
  const original = new Map<string, string | null>();
  const final = new Map<string, string | null>();
  for (const m of merges) {
    for (const e of JSON.parse(m.editsJson) as FileEdit[]) {
      if (!original.has(e.path)) original.set(e.path, e.before);
      final.set(e.path, e.after);
    }
  }
  return [...final.keys()]
    .sort()
    .filter((p) => (original.get(p) ?? null) !== (final.get(p) ?? null))
    .map((path) => ({ path, content: final.get(path) ?? null }));
}

export function filesTouched(m: Pick<KeptMerge, "editsJson">): string[] {
  return (JSON.parse(m.editsJson) as FileEdit[]).map((e) => e.path);
}

function errorsAfter(m: KeptMerge, baseline: number): number {
  const hit = /type check (\d+) errors?/.exec(m.summary);
  return hit ? Number(hit[1]) : baseline;
}

export function buildPrBody(
  merges: KeptMerge[],
  baseline: BaselineInfo,
): string {
  const buildText = baseline.build?.ran
    ? baseline.build.ok
      ? "build passes"
      : "build fails (same as baseline)"
    : "build not run";
  const sections = merges.map((m) => {
    const files = filesTouched(m);
    const after = errorsAfter(m, baseline.errors);
    const rel =
      after === baseline.errors
        ? "same as baseline"
        : after < baseline.errors
          ? "fewer than baseline"
          : "more than baseline";
    return [
      `### ${m.setName || m.id}`,
      `- Files touched: ${files.map((f) => `\`${f}\``).join(", ") || "none"}`,
      `- Lines removed: ${m.linesRemoved}`,
      `- Type check: ${baseline.errors} errors before, ${after} after (${rel}), ${baseline.covered} of ${baseline.total} files checked, ${buildText}`,
    ].join("\n");
  });
  return [
    "Twins found code that was written more than once and merged each copy set into one shared file. Each merge was kept only after the type check ran again and did not get worse.",
    "",
    ...sections.flatMap((s) => [s, ""]),
    "---",
    "Opened with Twins",
  ].join("\n");
}

export function defaultTitle(merges: KeptMerge[]): string {
  return merges.length === 1
    ? `Merge duplicate code: ${merges[0]!.setName || "copy set"}`
    : `Merge duplicate code (${merges.length} copy sets)`;
}

export function branchName(id: string, mergeIds: string[] = []): string {
  const short = id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8) || "x";
  if (mergeIds.length === 0) return `twins/merge-copies-${short}`;
  // One branch per set of kept merges: the same merges map to the same branch.
  let h = 0;
  for (const c of [...mergeIds].sort().join(",")) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return `twins/merge-copies-${short}-${h.toString(36).slice(0, 6)}`;
}

export function isGuardedOwner(owner: string): boolean {
  return GUARDED_OWNERS.includes(owner.toLowerCase());
}

/* ------------------------------ GitHub client ----------------------------- */

type FetchFn = typeof fetch;
const API = "https://api.github.com";

export function createGithubClient(token: string, f: FetchFn = fetch) {
  async function call<T>(
    method: string,
    path: string,
    body?: unknown,
    okStatuses: number[] = [200, 201, 202],
  ): Promise<{ status: number; json: T }> {
    const res = await f(`${API}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "twins-app",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    let json: unknown = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }
    if (!okStatuses.includes(res.status)) {
      const msg =
        (json as { message?: string } | null)?.message ?? res.statusText;
      throw new GithubPrError(
        res.status === 401 ? "github_not_connected" : "github_error",
        res.status === 401
          ? CONNECT_HELP
          : `GitHub said ${res.status} on ${method} ${path.split("?")[0]}: ${msg}`,
        { details: { status: res.status } },
      );
    }
    return { status: res.status, json: json as T };
  }
  return { call };
}

export type OpenPrInput = {
  token: string;
  fetch?: FetchFn;
  upstream: { owner: string; name: string; defaultBranch: string; sha: string };
  repoId: string;
  merges: KeptMerge[];
  baseline: BaselineInfo;
  title?: string | undefined;
  body?: string | undefined;
  forkOnly?: boolean | undefined;
  confirmUpstream?: boolean | undefined;
  /**
   * Open the pull request on the original repo even when the user does not own
   * it. Off by default: then the pull request opens on the user's own fork, so
   * nothing lands on someone else's project unless they ask for it.
   */
  toUpstream?: boolean | undefined;
  /** Test hooks. */
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  forkTimeoutMs?: number;
  /** Called right before the first GitHub write. */
  onWriteStart?: () => void;
};

export type OpenPrResult = {
  url: string;
  number?: number;
  branch: string;
  fork: string;
};

export async function openPullRequest(
  input: OpenPrInput,
): Promise<OpenPrResult> {
  const { upstream, merges } = input;
  if (isGuardedOwner(upstream.owner) && !input.confirmUpstream) {
    throw new GithubPrError(
      "upstream_confirmation_required",
      `${upstream.owner}/${upstream.name} is a guarded upstream. Pass confirmUpstream: true to open a pull request against it.`,
    );
  }
  const changes = collapseEdits(merges);
  if (merges.length === 0 || changes.length === 0) {
    throw new GithubPrError(
      "nothing_to_merge",
      "There are no kept merges to open a pull request for. Merge a copy set first.",
    );
  }
  const sleep =
    input.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const now = input.now ?? Date.now;
  const gh = createGithubClient(input.token, input.fetch ?? fetch);
  const up = `${upstream.owner}/${upstream.name}`;

  const viewer = (await gh.call<{ login: string }>("GET", "/user")).json.login;
  input.onWriteStart?.();

  let forkFull = up;
  let forkOwner = upstream.owner;
  let wrote = false;
  const ownsRepo = viewer.toLowerCase() === upstream.owner.toLowerCase();
  try {
    if (!ownsRepo) {
      const fork = (
        await gh.call<{ full_name: string; owner: { login: string } }>(
          "POST",
          `/repos/${up}/forks`,
          { default_branch_only: true },
        )
      ).json;
      wrote = true;
      forkFull = fork.full_name;
      forkOwner = fork.owner.login;
      const deadline = now() + (input.forkTimeoutMs ?? 60_000);
      for (;;) {
        const probe = await gh.call<unknown>(
          "GET",
          `/repos/${forkFull}/git/commits/${upstream.sha}`,
          undefined,
          [200, 404, 409],
        );
        if (probe.status === 200) break;
        if (now() >= deadline) {
          throw new GithubPrError(
            "github_error",
            "GitHub is still creating your fork after 60 seconds. Try again in a minute.",
            { wrote: true },
          );
        }
        await sleep(2000);
      }
    }

    const baseCommit = (
      await gh.call<{ tree: { sha: string } }>(
        "GET",
        `/repos/${forkFull}/git/commits/${upstream.sha}`,
      )
    ).json;

    // Where the pull request opens: the user's repo, else their fork unless
    // they asked for the original.
    const prRepo = ownsRepo || input.toUpstream ? up : forkFull;
    const branch = branchName(input.repoId, merges.map((m) => m.id));
    const made = await gh.call(
      "POST",
      `/repos/${forkFull}/git/refs`,
      { ref: `refs/heads/${branch}`, sha: upstream.sha },
      [200, 201, 422],
    );
    if (made.status === 422) {
      // These exact merges were sent before: hand back that pull request.
      const open = (
        await gh.call<{ html_url: string; number: number }[]>(
          "GET",
          `/repos/${prRepo}/pulls?state=all&head=${encodeURIComponent(`${forkOwner}:${branch}`)}`,
        )
      ).json;
      if (open[0] && !input.forkOnly) {
        return { url: open[0].html_url, number: open[0].number, branch, fork: forkFull };
      }
      if (input.forkOnly) {
        return {
          url: `https://github.com/${up}/compare/${upstream.defaultBranch}...${forkOwner}:${branch}?expand=1`,
          branch,
          fork: forkFull,
        };
      }
      throw new GithubPrError(
        "github_error",
        `The branch ${branch} already exists on ${forkFull} without a pull request. Delete it on GitHub and try again.`,
      );
    }
    wrote = true;

    // Keep file modes of files that already exist.
    const modes = new Map<string, string>();
    try {
      const t = await gh.call<{
        tree: { path: string; mode: string; type: string }[];
      }>(
        "GET",
        `/repos/${forkFull}/git/trees/${baseCommit.tree.sha}?recursive=1`,
      );
      for (const e of t.json.tree ?? [])
        if (e.type === "blob") modes.set(e.path, e.mode);
    } catch {
      /* default modes */
    }

    const entries: {
      path: string;
      mode: string;
      type: "blob";
      sha: string | null;
    }[] = [];
    for (const c of changes) {
      const mode = modes.get(c.path) ?? "100644";
      if (c.content === null) {
        entries.push({ path: c.path, mode, type: "blob", sha: null });
        continue;
      }
      const blob = (
        await gh.call<{ sha: string }>("POST", `/repos/${forkFull}/git/blobs`, {
          content: Buffer.from(c.content, "utf8").toString("base64"),
          encoding: "base64",
        })
      ).json;
      entries.push({ path: c.path, mode, type: "blob", sha: blob.sha });
    }
    const tree = (
      await gh.call<{ sha: string }>("POST", `/repos/${forkFull}/git/trees`, {
        base_tree: baseCommit.tree.sha,
        tree: entries,
      })
    ).json;
    const title = input.title?.trim() || defaultTitle(merges);
    const commit = (
      await gh.call<{ sha: string }>("POST", `/repos/${forkFull}/git/commits`, {
        message: `${title}\n\nOpened with Twins`,
        tree: tree.sha,
        parents: [upstream.sha],
      })
    ).json;
    await gh.call("PATCH", `/repos/${forkFull}/git/refs/heads/${branch}`, {
      sha: commit.sha,
      force: false,
    });

    if (input.forkOnly) {
      return {
        url: `https://github.com/${up}/compare/${upstream.defaultBranch}...${forkOwner}:${branch}?expand=1`,
        branch,
        fork: forkFull,
      };
    }
    const pr = (
      await gh.call<{ html_url: string; number: number }>(
        "POST",
        `/repos/${prRepo}/pulls`,
        {
          title,
          body: input.body?.trim() || buildPrBody(merges, input.baseline),
          head: `${forkOwner}:${branch}`,
          base: upstream.defaultBranch,
          maintainer_can_modify: true,
        },
      )
    ).json;
    return { url: pr.html_url, number: pr.number, branch, fork: forkFull };
  } catch (err) {
    if (err instanceof GithubPrError && wrote && !err.wrote) {
      throw new GithubPrError(err.code, err.message, {
        ...(err.details ? { details: err.details } : {}),
        wrote: true,
      });
    }
    throw err;
  }
}

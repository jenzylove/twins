import { describe, expect, it } from "vitest";
import {
  GithubPrError,
  branchName,
  buildPrBody,
  collapseEdits,
  openPullRequest,
  resolveGithubToken,
  type KeptMerge,
} from "./github-pr.js";

const merge = (
  id: string,
  setName: string,
  edits: { path: string; before: string | null; after: string | null }[],
  summary = "Merged x into y: 5 lines removed, 1 added, type check 2 errors (baseline 2).",
): KeptMerge => ({
  id,
  setName,
  summary,
  editsJson: JSON.stringify(edits),
  linesRemoved: 5,
});

const baseline = {
  errors: 2,
  covered: 8,
  total: 10,
  build: { ran: true, ok: true },
};
const upstream = {
  owner: "acme",
  name: "app",
  defaultBranch: "main",
  sha: "base123",
};

function mockFetch(opts: { forkReadyAfter?: number; viewer?: string } = {}) {
  const calls: { method: string; url: string; body: any }[] = [];
  let probes = 0;
  const f = (async (url: string, init: any) => {
    const u = String(url).replace("https://api.github.com", "");
    const method = init.method as string;
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ method, url: u, body });
    const res = (status: number, json: unknown) =>
      ({ status, statusText: "", json: async () => json }) as Response;
    if (u === "/user") return res(200, { login: opts.viewer ?? "me" });
    if (u === "/repos/acme/app/forks")
      return res(202, { full_name: "me/app", owner: { login: "me" } });
    if (u === "/repos/me/app/git/commits/base123") {
      probes++;
      if (probes <= (opts.forkReadyAfter ?? 0))
        return res(404, { message: "nf" });
      return res(200, { tree: { sha: "tree0" } });
    }
    if (u === "/repos/me/app/git/refs") return res(201, {});
    if (u.startsWith("/repos/me/app/git/trees/tree0"))
      return res(200, {
        tree: [{ path: "a.ts", mode: "100755", type: "blob" }],
      });
    if (u === "/repos/me/app/git/blobs")
      return res(201, {
        sha: `blob${calls.filter((c) => c.url.endsWith("blobs")).length}`,
      });
    if (u === "/repos/me/app/git/trees") return res(201, { sha: "tree1" });
    if (u === "/repos/me/app/git/commits") return res(201, { sha: "commit1" });
    if (u.startsWith("/repos/me/app/git/refs/heads/")) return res(200, {});
    if (u === "/repos/acme/app/pulls")
      return res(201, {
        html_url: "https://github.com/acme/app/pull/7",
        number: 7,
      });
    if (u === "/repos/me/app/pulls")
      return res(201, {
        html_url: "https://github.com/me/app/pull/3",
        number: 3,
      });
    return res(500, { message: "unexpected " + u });
  }) as unknown as typeof fetch;
  return { f, calls };
}

describe("collapseEdits", () => {
  it("keeps the latest after per path and handles deletes", () => {
    const out = collapseEdits([
      merge("1", "A", [
        { path: "a.ts", before: "v0", after: "v1" },
        { path: "b.ts", before: "b", after: null },
        { path: "new.ts", before: null, after: "n1" },
      ]),
      merge("2", "B", [
        { path: "a.ts", before: "v1", after: "v2" },
        { path: "new.ts", before: "n1", after: null },
        { path: "same.ts", before: "s", after: "x" },
      ]),
      merge("3", "C", [{ path: "same.ts", before: "x", after: "s" }]),
    ]);
    expect(out).toEqual([
      { path: "a.ts", content: "v2" },
      { path: "b.ts", content: null },
    ]);
  });
});

describe("buildPrBody", () => {
  it("lists each merge with numbers and the footer", () => {
    const body = buildPrBody(
      [merge("1", "Button", [{ path: "a.ts", before: "x", after: "y" }])],
      baseline,
    );
    expect(body).toContain("### Button");
    expect(body).toContain("`a.ts`");
    expect(body).toContain("Lines removed: 5");
    expect(body).toContain(
      "Type check: 2 errors before, 2 after (same as baseline), 8 of 10 files checked, build passes",
    );
    expect(body.trimEnd().endsWith("Opened with Twins")).toBe(true);
  });
});

describe("openPullRequest", () => {
  const merges = [
    merge("1", "Button", [
      { path: "a.ts", before: "old", after: "mid" },
      { path: "gone.ts", before: "g", after: null },
    ]),
    merge("2", "Card", [{ path: "a.ts", before: "mid", after: "new é" }]),
  ];
  const BR = branchName("abcd1234-ffff", ["1", "2"]);

  it("opens the PR on the user's own fork when they do not own the repo", async () => {
    const { f, calls } = mockFetch();
    const r = await openPullRequest({
      token: "t",
      fetch: f,
      upstream,
      repoId: "abcd1234-ef",
      merges,
      baseline,
      sleep: async () => {},
    });
    expect(r).toMatchObject({ url: "https://github.com/me/app/pull/3", number: 3 });
    expect(calls.some((c) => c.url === "/repos/acme/app/pulls")).toBe(false);
    const pr = calls.find((c) => c.url === "/repos/me/app/pulls")!;
    expect(pr.body.base).toBe("main");
  });

  it("opens the PR on the user's own repo with no fork", async () => {
    const { f, calls } = mockFetch({ viewer: "acme" });
    const fetchOwn = (async (url: string, init: any) => {
      const u = String(url).replace("https://api.github.com", "");
      const res = (status: number, json: unknown) =>
        ({ status, statusText: "", json: async () => json }) as Response;
      calls.push({ method: init.method, url: u, body: init.body ? JSON.parse(init.body) : undefined });
      if (u === "/user") return res(200, { login: "acme" });
      if (u === "/repos/acme/app/git/commits/base123") return res(200, { tree: { sha: "tree0" } });
      if (u === "/repos/acme/app/git/refs") return res(201, {});
      if (u.startsWith("/repos/acme/app/git/trees/tree0")) return res(200, { tree: [] });
      if (u === "/repos/acme/app/git/blobs") return res(201, { sha: "b1" });
      if (u === "/repos/acme/app/git/trees") return res(201, { sha: "tree1" });
      if (u === "/repos/acme/app/git/commits") return res(201, { sha: "c1" });
      if (u.startsWith("/repos/acme/app/git/refs/heads/")) return res(200, {});
      if (u === "/repos/acme/app/pulls")
        return res(201, { html_url: "https://github.com/acme/app/pull/9", number: 9 });
      return res(500, { message: "unexpected " + u });
    }) as unknown as typeof fetch;
    void f;
    const r = await openPullRequest({
      token: "t",
      fetch: fetchOwn,
      upstream,
      repoId: "abcd1234-ef",
      merges,
      baseline,
      sleep: async () => {},
    });
    expect(r.url).toBe("https://github.com/acme/app/pull/9");
    expect(calls.some((c) => c.url.endsWith("/forks"))).toBe(false);
  });

  it("runs fork, poll, branch, blobs, tree, commit, ref update, PR in order", async () => {
    const { f, calls } = mockFetch({ forkReadyAfter: 2 });
    const sleeps: number[] = [];
    const r = await openPullRequest({
      token: "t",
      fetch: f,
      upstream,
      repoId: "abcd1234-ef",
      merges,
      baseline,
      toUpstream: true,
      sleep: async (ms) => void sleeps.push(ms),
    });
    expect(r).toMatchObject({
      url: "https://github.com/acme/app/pull/7",
      number: 7,
    });
    expect(sleeps).toHaveLength(2);
    const seq = calls.map((c) => `${c.method} ${c.url.split("?")[0]}`);
    expect(seq.filter((s) => !s.includes("commits/base123"))).toEqual([
      "GET /user",
      "POST /repos/acme/app/forks",
      "POST /repos/me/app/git/refs",
      "GET /repos/me/app/git/trees/tree0",
      "POST /repos/me/app/git/blobs",
      "POST /repos/me/app/git/trees",
      "POST /repos/me/app/git/commits",
      `PATCH /repos/me/app/git/refs/heads/${BR}`,
      "POST /repos/acme/app/pulls",
    ]);
    const ref = calls.find((c) => c.url === "/repos/me/app/git/refs")!;
    expect(ref.body).toEqual({
      ref: `refs/heads/${BR}`,
      sha: "base123",
    });
    const blob = calls.find((c) => c.url.endsWith("/blobs"))!;
    expect(Buffer.from(blob.body.content, "base64").toString("utf8")).toBe(
      "new é",
    );
    const tree = calls.find((c) => c.url === "/repos/me/app/git/trees")!;
    expect(tree.body).toEqual({
      base_tree: "tree0",
      tree: [
        { path: "a.ts", mode: "100755", type: "blob", sha: "blob1" },
        { path: "gone.ts", mode: "100644", type: "blob", sha: null },
      ],
    });
    const commit = calls.find((c) => c.url === "/repos/me/app/git/commits")!;
    expect(commit.body.parents).toEqual(["base123"]);
    expect(commit.body.tree).toBe("tree1");
    const pr = calls.find((c) => c.url === "/repos/acme/app/pulls")!;
    expect(pr.body.head).toBe(`me:${BR}`);
    expect(pr.body.base).toBe("main");
    expect(pr.body.body).toContain("### Card");
    expect(pr.body.body).toContain("Opened with Twins");
  });

  it("forkOnly returns the compare url and opens no PR", async () => {
    const { f, calls } = mockFetch();
    const r = await openPullRequest({
      token: "t",
      fetch: f,
      upstream,
      repoId: "abcd1234",
      merges,
      baseline,
      forkOnly: true,
      sleep: async () => {},
    });
    expect(r.url).toBe(
      `https://github.com/acme/app/compare/main...me:${BR}?expand=1`,
    );
    expect(calls.some((c) => c.url.endsWith("/pulls"))).toBe(false);
  });

  it("times out when the fork never becomes ready", async () => {
    const { f } = mockFetch({ forkReadyAfter: 999 });
    let t = 0;
    await expect(
      openPullRequest({
        token: "t",
        fetch: f,
        upstream,
        repoId: "x",
        merges,
        baseline,
        sleep: async () => {
          t += 2000;
        },
        now: () => t,
      }),
    ).rejects.toMatchObject({ code: "github_error", wrote: true });
  });

  it("refuses BuilderIO without confirmUpstream, makes no calls", async () => {
    const { f, calls } = mockFetch();
    const up = { ...upstream, owner: "BuilderIO" };
    await expect(
      openPullRequest({
        token: "t",
        fetch: f,
        upstream: up,
        repoId: "x",
        merges,
        baseline,
      }),
    ).rejects.toMatchObject({ code: "upstream_confirmation_required" });
    expect(calls).toHaveLength(0);
  });

  it("nothing_to_merge with no kept merges", async () => {
    const { f } = mockFetch();
    await expect(
      openPullRequest({
        token: "t",
        fetch: f,
        upstream,
        repoId: "x",
        merges: [],
        baseline,
      }),
    ).rejects.toMatchObject({ code: "nothing_to_merge" });
  });
});

describe("resolveGithubToken", () => {
  it("fails github_not_connected when no account row", async () => {
    const err = await resolveGithubToken(
      async () => ({ rows: [] }),
      "a@b.c",
    ).catch((e) => e);
    expect(err).toBeInstanceOf(GithubPrError);
    expect(err.code).toBe("github_not_connected");
    expect(err.message).toContain("Connect GitHub");
  });
  it("fails when public_repo scope is missing", async () => {
    const err = await resolveGithubToken(
      async () => ({
        rows: [{ access_token: "tok", scope: "read:user,user:email" }],
      }),
      "a@b.c",
    ).catch((e) => e);
    expect(err.code).toBe("github_not_connected");
  });
  it("returns the token for the caller when scoped", async () => {
    let args: unknown[] = [];
    const tok = await resolveGithubToken(async (q) => {
      args = q.args;
      return {
        rows: [{ access_token: "tok", scope: "read:user,public_repo" }],
      };
    }, "a@b.c");
    expect(tok).toBe("tok");
    expect(args).toEqual(["github", "a@b.c"]);
  });
});

describe("branchName", () => {
  it("gives the same merges the same branch and new merges a new one", () => {
    expect(branchName("abcd1234-x", ["b", "a"])).toBe(branchName("abcd1234-x", ["a", "b"]));
    expect(branchName("abcd1234-x", ["a"])).not.toBe(branchName("abcd1234-x", ["a", "b"]));
    expect(branchName("abcd1234-x", ["a"])).toMatch(/^twins\/merge-copies-abcd1234-[a-z0-9]+$/);
  });
});

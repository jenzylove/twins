import { mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

import { x as untar } from "tar";

import { EngineError } from "./errors.js";

export type RepoRef = { owner: string; name: string };

export type RepoInfo = {
  owner: string;
  name: string;
  defaultBranch: string;
  sha: string;
  isPrivate: boolean;
  sizeKb: number;
  htmlUrl: string;
  description: string | null;
  stars: number;
};

export const MAX_REPO_KB = 200_000;
export const MAX_FILE_BYTES = 1024 * 1024;
export const MAX_FILES = 8_000;
export const MAX_TOTAL_BYTES = 150 * 1024 * 1024;

const OWNER_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const NAME_RE = /^[A-Za-z0-9._-]{1,100}$/;

/**
 * Accepts `owner/name`, `github.com/owner/name`, and
 * `https://github.com/owner/name(.git)(/tree/...)`.
 */
export function parseRepoUrl(input: string): RepoRef {
  const bad = () =>
    new EngineError(
      "invalid_repo_url",
      `Not a GitHub repo: "${input}". Use owner/name or https://github.com/owner/name.`,
    );
  if (typeof input !== "string") throw bad();
  let s = input.trim();
  if (!s) throw bad();

  let hosted = false;
  const proto = /^https?:\/\//i;
  if (proto.test(s)) {
    s = s.replace(proto, "");
    hosted = true;
  }
  const host = /^(?:www\.)?github\.com\//i;
  if (host.test(s)) {
    s = s.replace(host, "");
    hosted = true;
  } else if (hosted) {
    throw bad(); // some other host
  }

  s = s.replace(/[?#].*$/, "").replace(/\/+$/, "");
  const parts = s.split("/");
  if (parts.length < 2) throw bad();
  if (parts.length > 2 && !hosted) throw bad();
  const owner = parts[0] ?? "";
  let name = parts[1] ?? "";
  if (parts.length > 2) {
    // Only browse paths under the repo, e.g. /tree/main/src or /blob/...
    const sub = parts[2];
    if (!["tree", "blob", "commit", "commits", "pulls", "issues"].includes(sub ?? "")) {
      throw bad();
    }
  }
  if (name.toLowerCase().endsWith(".git")) name = name.slice(0, -4);
  if (!OWNER_RE.test(owner) || !NAME_RE.test(name) || name === "." || name === "..") {
    throw bad();
  }
  return { owner, name };
}

function githubHeaders(token?: string): Record<string, string> {
  const t = token ?? process.env.GITHUB_TOKEN; // guard:allow-env-credential — deploy-level server config, not a user credential
  const h: Record<string, string> = {
    "User-Agent": "twins-app",
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (t) h.Authorization = `Bearer ${t}`;
  return h;
}

async function githubJson(url: string, ref: RepoRef, token?: string): Promise<any> {
  let res: Response;
  try {
    res = await fetch(url, { headers: githubHeaders(token) });
  } catch (err) {
    throw new EngineError("github_unreachable", "Could not reach GitHub.", {
      cause: String(err),
    });
  }
  if (res.status === 404 || res.status === 451) {
    throw new EngineError(
      "repo_not_found",
      `${ref.owner}/${ref.name} was not found or is private.`,
    );
  }
  if (res.status === 403 || res.status === 429) {
    const remaining = res.headers.get("x-ratelimit-remaining");
    if (remaining === "0" || res.status === 429) {
      throw new EngineError("github_rate_limited", "GitHub rate limit reached. Try again later.");
    }
    throw new EngineError(
      "repo_not_found",
      `${ref.owner}/${ref.name} was not found or is private.`,
    );
  }
  if (!res.ok) {
    throw new EngineError("github_error", `GitHub answered ${res.status}.`, {
      status: res.status,
    });
  }
  return res.json();
}

export async function fetchRepoInfo(ref: RepoRef, token?: string): Promise<RepoInfo> {
  const base = `https://api.github.com/repos/${encodeURIComponent(ref.owner)}/${encodeURIComponent(ref.name)}`;
  const repo = await githubJson(base, ref, token);
  if (repo.private) {
    throw new EngineError(
      "repo_not_found",
      `${ref.owner}/${ref.name} was not found or is private.`,
    );
  }
  const sizeKb = Number(repo.size ?? 0);
  if (sizeKb > MAX_REPO_KB) {
    throw new EngineError(
      "repo_too_large",
      `${ref.owner}/${ref.name} is ${Math.round(sizeKb / 1024)} MB; the limit is ${MAX_REPO_KB / 1000} MB.`,
      { sizeKb },
    );
  }
  const defaultBranch = String(repo.default_branch ?? "main");
  const branch = await githubJson(
    `${base}/branches/${encodeURIComponent(defaultBranch)}`,
    ref,
    token,
  );
  const sha = branch?.commit?.sha;
  if (typeof sha !== "string") {
    throw new EngineError("github_error", "GitHub did not return a head commit.");
  }
  return {
    owner: String(repo.owner?.login ?? ref.owner),
    name: String(repo.name ?? ref.name),
    defaultBranch,
    sha,
    isPrivate: Boolean(repo.private),
    sizeKb,
    htmlUrl: String(repo.html_url ?? `https://github.com/${ref.owner}/${ref.name}`),
    description: typeof repo.description === "string" ? repo.description : null,
    stars: Number(repo.stargazers_count ?? 0),
  };
}

const SKIP_SEGMENTS = new Set(["node_modules", ".git"]);
const FILE_TYPES = new Set(["File", "OldFile", "ContiguousFile"]);

/**
 * Extract a GitHub tarball stream into `dir` (top folder stripped). Skips links,
 * node_modules, .git and files over 1 MB; stops past the file and byte caps.
 */
export async function extractTarball(
  source: Readable,
  dir: string,
): Promise<{ files: number; bytes: number }> {
  await mkdir(dir, { recursive: true });
  let files = 0;
  let bytes = 0;
  let tooLarge: EngineError | null = null;

  const extractor = untar({
    cwd: dir,
    strip: 1,
    filter: (p, entry) => {
      if (tooLarge) return false;
      const type = "type" in entry ? entry.type : "File";
      if (type === "SymbolicLink" || type === "Link") return false;
      const segs = p.replace(/\\/g, "/").split("/");
      if (segs.some((s) => SKIP_SEGMENTS.has(s))) return false;
      if (type === "Directory") return true;
      if (!FILE_TYPES.has(type)) return false;
      const size = Number(entry.size ?? 0);
      if (size > MAX_FILE_BYTES) return false;
      files += 1;
      bytes += size;
      if (files > MAX_FILES || bytes > MAX_TOTAL_BYTES) {
        tooLarge = new EngineError(
          "repo_too_large",
          `The repo has more than ${MAX_FILES} files or ${MAX_TOTAL_BYTES / 1024 / 1024} MB of source.`,
          { files, bytes },
        );
        source.destroy(tooLarge);
        return false;
      }
      return true;
    },
  });

  try {
    await pipeline(source, extractor);
  } catch (err) {
    if (tooLarge) throw tooLarge;
    if (err instanceof EngineError) throw err;
    throw new EngineError("download_failed", "Could not unpack the repo archive.", {
      cause: String(err),
    });
  }
  if (tooLarge) throw tooLarge;
  return { files, bytes };
}

export async function downloadRepo(
  ref: RepoRef,
  sha: string,
  dir: string,
  token?: string,
): Promise<{ files: number; bytes: number }> {
  const url = `https://codeload.github.com/${encodeURIComponent(ref.owner)}/${encodeURIComponent(ref.name)}/tar.gz/${encodeURIComponent(sha)}`;
  const t = token ?? process.env.GITHUB_TOKEN; // guard:allow-env-credential — deploy-level server config, not a user credential
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "User-Agent": "twins-app", ...(t ? { Authorization: `Bearer ${t}` } : {}) },
    });
  } catch (err) {
    throw new EngineError("download_failed", "Could not reach GitHub to download the repo.", {
      cause: String(err),
    });
  }
  if (res.status === 404) {
    throw new EngineError("repo_not_found", `${ref.owner}/${ref.name}@${sha} was not found.`);
  }
  if (!res.ok || !res.body) {
    throw new EngineError("download_failed", `GitHub answered ${res.status} for the archive.`);
  }
  const source = Readable.fromWeb(res.body as any);
  return extractTarball(source, dir);
}

export function workdirFor(repoId: string): string {
  if (!/^[A-Za-z0-9_-]+$/.test(repoId)) {
    throw new EngineError("invalid_repo_id", `Bad repo id: ${repoId}`);
  }
  return path.join(process.env.TWINS_WORKDIR ?? path.join(os.tmpdir(), "twins"), repoId); // guard:allow-env-credential — deploy-level server config, not a user credential
}

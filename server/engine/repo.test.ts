import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { c as tarCreate } from "tar";
import { afterAll, describe, expect, it } from "vitest";

import { EngineError } from "./errors.js";
import { extractTarball, parseRepoUrl, workdirFor } from "./repo.js";

const dirs: string[] = [];
function tmp(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  dirs.push(dir);
  return dir;
}
afterAll(() => {
  for (const d of dirs) fs.rmSync(d, { recursive: true, force: true });
});

describe("parseRepoUrl", () => {
  const ok = { owner: "cmonson66", name: "nectarpay-crm" };
  it.each([
    "cmonson66/nectarpay-crm",
    "  cmonson66/nectarpay-crm  ",
    "github.com/cmonson66/nectarpay-crm",
    "www.github.com/cmonson66/nectarpay-crm",
    "https://github.com/cmonson66/nectarpay-crm",
    "http://github.com/cmonson66/nectarpay-crm/",
    "https://github.com/cmonson66/nectarpay-crm.git",
    "https://github.com/cmonson66/nectarpay-crm/tree/main/src",
    "https://github.com/cmonson66/nectarpay-crm/blob/main/README.md",
    "https://github.com/cmonson66/nectarpay-crm?tab=readme",
  ])("accepts %s", (input) => {
    expect(parseRepoUrl(input)).toEqual(ok);
  });

  it("keeps dots and underscores in names", () => {
    expect(parseRepoUrl("a-b/my_repo.js")).toEqual({ owner: "a-b", name: "my_repo.js" });
  });

  it.each([
    "",
    "nectarpay",
    "https://gitlab.com/a/b",
    "https://github.com/onlyowner",
    "a/b/c",
    "https://github.com/a/b/settings",
    "-bad/repo",
    "owner/..",
    "owner/na me",
    "git@github.com:a/b.git",
  ])("rejects %s", (input) => {
    try {
      parseRepoUrl(input);
      throw new Error("expected a throw");
    } catch (e) {
      expect(e).toBeInstanceOf(EngineError);
      expect((e as EngineError).code).toBe("invalid_repo_url");
    }
  });
});

describe("extractTarball", () => {
  it("strips the top folder and skips node_modules, .git and big files", async () => {
    const src = tmp("twins-tar-src-");
    const top = path.join(src, "owner-repo-abc123");
    const write = (rel: string, text: string | Buffer) => {
      fs.mkdirSync(path.dirname(path.join(top, rel)), { recursive: true });
      fs.writeFileSync(path.join(top, rel), text);
    };
    write("src/a.ts", "export const a = 1;\n");
    write("package.json", "{}");
    write("node_modules/x/index.js", "bad");
    write(".git/HEAD", "ref");
    write("big.bin", Buffer.alloc(1024 * 1024 + 10));
    const archive = path.join(src, "repo.tgz");
    await tarCreate({ gzip: true, file: archive, cwd: src }, ["owner-repo-abc123"]);

    const out = tmp("twins-tar-out-");
    const stats = await extractTarball(fs.createReadStream(archive), out);
    expect(stats.files).toBe(2);
    expect(fs.readFileSync(path.join(out, "src/a.ts"), "utf8")).toContain("export const a");
    expect(fs.existsSync(path.join(out, "package.json"))).toBe(true);
    expect(fs.existsSync(path.join(out, "node_modules"))).toBe(false);
    expect(fs.existsSync(path.join(out, ".git"))).toBe(false);
    expect(fs.existsSync(path.join(out, "big.bin"))).toBe(false);
  });

  it("fails cleanly on a broken archive", async () => {
    const src = tmp("twins-tar-bad-");
    const archive = path.join(src, "bad.tgz");
    fs.writeFileSync(archive, "not a tarball at all");
    const out = tmp("twins-tar-out-");
    await expect(extractTarball(fs.createReadStream(archive), out)).rejects.toBeInstanceOf(EngineError);
  });
});

describe("workdirFor", () => {
  it("joins TWINS_WORKDIR and the repo id, and rejects traversal", () => {
    const prev = process.env.TWINS_WORKDIR; // guard:allow-env-credential — deploy-level server config, not a user credential
    process.env.TWINS_WORKDIR = path.join(os.tmpdir(), "tw"); // guard:allow-env-credential — deploy-level server config, not a user credential
    try {
      expect(workdirFor("abc_123")).toBe(path.join(os.tmpdir(), "tw", "abc_123"));
      expect(() => workdirFor("../x")).toThrow(EngineError);
    } finally {
      if (prev === undefined) delete process.env.TWINS_WORKDIR; // guard:allow-env-credential — deploy-level server config, not a user credential
      else process.env.TWINS_WORKDIR = prev; // guard:allow-env-credential — deploy-level server config, not a user credential
    }
  });
});

// Vercel Sandbox session: repo code only ever installs, type checks and builds in here.
import path from "node:path";
import { Sandbox } from "@vercel/sandbox";
import { EngineError } from "./errors.js";
import { parseTsgo, type CheckResult, type Diag } from "./check.js";

const TSGO = "/tmp/checker/node_modules/.bin/tsgo";

/** Single quote a path for bash: repo folder names must never expand. */
function shq(s: string): string {
  return `'${s.replace(/'/g, `'\''`)}'`;
}
const SANDBOX_TIMEOUT_MS = 45 * 60 * 1000;

function credentials():
  | { token: string; teamId: string; projectId: string }
  | Record<string, never> {
  const { VERCEL_TOKEN, VERCEL_TEAM_ID, VERCEL_PROJECT_ID } = process.env; // guard:allow-env-credential — deploy-level sandbox service credentials
  if (VERCEL_TOKEN && VERCEL_TEAM_ID && VERCEL_PROJECT_ID) {
    return {
      token: VERCEL_TOKEN,
      teamId: VERCEL_TEAM_ID,
      projectId: VERCEL_PROJECT_ID,
    };
  }
  return {};
}

async function getSandbox(sandboxId: string): Promise<Sandbox> {
  try {
    return await Sandbox.get({ name: sandboxId, ...credentials() });
  } catch (err) {
    console.error("[twins] sandbox lookup failed:", redact(String(err)));
    throw new EngineError(
      "sandbox_gone",
      "The sandbox for this repo is no longer running.",
      { cause: String(err) },
    );
  }
}

/** Strip anything credential shaped before an error reaches the console. */
export function redact(text: string): string {
  return text
    .replace(
      /(authorization|bearer|token|secret|password|key)(["'\s:=]+)[A-Za-z0-9._~+/=-]{8,}/gi,
      "$1$2[redacted]",
    )
    .replace(/eyJ[A-Za-z0-9._-]{20,}/g, "[redacted]")
    .slice(0, 1500);
}

type Sh = { code: number; out: string; err: string };

async function sh(
  sbx: Sandbox,
  script: string,
  opts: { timeoutMs?: number; env?: Record<string, string> } = {},
): Promise<Sh> {
  const r = await sbx.runCommand({
    cmd: "bash",
    args: ["-lc", script],
    ...(opts.env ? { env: opts.env } : {}),
    ...(opts.timeoutMs ? { signal: AbortSignal.timeout(opts.timeoutMs) } : {}),
  });
  const [out, err] = await Promise.all([r.stdout(), r.stderr()]);
  return { code: r.exitCode ?? 0, out, err };
}

export async function createRepoSandbox(info: {
  owner: string;
  name: string;
  sha: string;
}): Promise<{ sandboxId: string }> {
  try {
    const sbx = await Sandbox.create({
      source: {
        type: "git",
        url: `https://github.com/${info.owner}/${info.name}`,
        revision: info.sha,
        depth: 1,
      },
      runtime: "node22",
      resources: { vcpus: 4 },
      timeout: SANDBOX_TIMEOUT_MS,
      ...credentials(),
    });
    return { sandboxId: sbx.name };
  } catch (err) {
    console.error("[twins] sandbox create failed:", redact(String(err)));
    throw new EngineError(
      "sandbox_create_failed",
      "Could not start a sandbox for this repo.",
      { cause: String(err) },
    );
  }
}

export async function prepareSandbox(
  sandboxId: string,
  targets: string[],
  hasBuild: boolean,
  onStage: (stage: string) => void = () => undefined,
): Promise<CheckResult> {
  const sbx = await getSandbox(sandboxId);
  let checkerDone = false;
  onStage("installing dependencies");
  // One install at the root, or one per package when the repo has no root
  // package.json (separate packages side by side, each with its own lockfile).
  const pkgDirs = [
    ...new Set(
      targets
        .map((t) => path.posix.dirname(t))
        .filter((d) => d !== "." && !d.startsWith("..")),
    ),
  ];
  const installRepo = async () => {
    const rootPkg = (await sh(sbx, "[ -f package.json ] && echo yes || echo no")).out.trim() === "yes";
    const dirs = rootPkg || pkgDirs.length === 0 ? ["."] : pkgDirs;
    const results = await Promise.all(dirs.map((d) => installIn(d)));
    const bad = results.find((r) => r.code !== 0);
    if (bad && (rootPkg || results.every((r) => r.code !== 0))) {
      throw new EngineError(
        "install_failed",
        "The repo's dependencies would not install in the sandbox.",
        { tail: (bad.err || bad.out).slice(-600) },
      );
    }
  };
  const installIn = (d: string) =>
    sh(
      sbx,
      `cd ${shq(d)} || exit 0
if [ ! -f package.json ]; then exit 0; fi
if [ -d node_modules/.bin ]; then exit 0; fi
if [ -f package-lock.json ] || { [ ! -f pnpm-lock.yaml ] && [ ! -f yarn.lock ]; }; then
  npm install --ignore-scripts --no-audit --no-fund --legacy-peer-deps --loglevel=error
elif [ -f pnpm-lock.yaml ]; then
  corepack pnpm install --ignore-scripts --no-frozen-lockfile || npm install --ignore-scripts --no-audit --no-fund --legacy-peer-deps --loglevel=error
else
  corepack yarn install --ignore-scripts || npm install --ignore-scripts --no-audit --no-fund --legacy-peer-deps --loglevel=error
fi`,
      { timeoutMs: 8 * 60 * 1000 },
    );
  const installChecker = async () => {
    const r = await sh(
      sbx,
      `if [ -x ${TSGO} ]; then exit 0; fi
npm install --prefix /tmp/checker @typescript/native-preview --no-audit --no-fund --loglevel=error`,
      { timeoutMs: 4 * 60 * 1000 },
    );
    if (r.code !== 0) {
      throw new EngineError(
        "checker_install_failed",
        "Could not install the type checker in the sandbox.",
        { tail: (r.err || r.out).slice(-400) },
      );
    }
  };
  await Promise.all([
    installRepo().then(() => {
      if (!checkerDone) onStage("installing checker");
    }),
    installChecker().then(() => {
      checkerDone = true;
    }),
  ]);
  try {
    await sbx.updateNetworkPolicy("deny-all");
  } catch {
    // Policy update is best effort; the checks themselves never run repo scripts.
  }
  onStage(hasBuild ? "building" : "type checking baseline");
  const first = await runCheck(sandboxId, targets, hasBuild);
  if (!first.build?.ran) return first;
  onStage("type checking baseline");
  // The build can generate files (route trees, codegen) that the type check
  // needs, so take the baseline diagnostics again now that it has run.
  const settled = await runCheck(sandboxId, targets, false);
  return { ...settled, ms: first.ms + settled.ms, build: first.build };
}

export async function runCheck(
  sandboxId: string,
  targets: string[],
  withBuild: boolean,
): Promise<CheckResult> {
  const sbx = await getSandbox(sandboxId);
  const t0 = Date.now();
  const root = sbx.cwd;
  const buildP = withBuild
    ? (async () => {
        const b0 = Date.now();
        try {
          const r = await sh(sbx, "npm run build", {
            timeoutMs: 180_000,
            env: { CI: "1" },
          });
          return {
            ran: true,
            ok: r.code === 0,
            ms: Date.now() - b0,
            ...(r.code === 0 ? {} : { tail: (r.err || r.out).slice(-500) }),
          };
        } catch (err) {
          return {
            ran: true,
            ok: false,
            ms: Date.now() - b0,
            tail: `build did not finish: ${String(err).slice(0, 200)}`,
          };
        }
      })()
    : Promise.resolve(undefined);
  const checks = await Promise.all(
    targets.map(async (cfg) => {
      const r = await sh(
        sbx,
        `${TSGO} --noEmit --pretty false --listFiles -p ${shq(cfg)}`,
        { timeoutMs: 240_000 },
      );
      if (r.code !== 0 && r.code !== 2 && !r.out.trim()) {
        throw new EngineError(
          "check_failed",
          "The type checker did not run to the end.",
          { tail: (r.err || r.out).slice(-400) },
        );
      }
      return parseTsgo(r.out, root);
    }),
  );
  const diags: Diag[] = [];
  const files = new Set<string>();
  for (const c of checks) {
    diags.push(...c.diags);
    for (const f of c.files) files.add(f);
  }
  const build = await buildP;
  return {
    diags,
    coveredFiles: [...files],
    ms: Date.now() - t0,
    ...(build ? { build } : {}),
  };
}

export async function writeFiles(
  sandboxId: string,
  edits: { path: string; content: string | null }[],
): Promise<void> {
  const sbx = await getSandbox(sandboxId);
  const writes = edits.filter((e) => e.content !== null) as {
    path: string;
    content: string;
  }[];
  const deletes = edits.filter((e) => e.content === null).map((e) => e.path);
  if (writes.length) {
    const dirs = [...new Set(writes.map((w) => w.path.split("/").slice(0, -1).join("/")).filter(Boolean))];
    if (dirs.length) {
      await sh(sbx, `mkdir -p ${dirs.map((d) => JSON.stringify(d)).join(" ")}`);
    }
    await sbx.writeFiles(
      writes.map((w) => ({ path: w.path, content: Buffer.from(w.content, "utf8") })),
    );
  }
  if (deletes.length) {
    await sh(sbx, `rm -f ${deletes.map((d) => JSON.stringify(d)).join(" ")}`);
  }
}

export async function stopSandbox(sandboxId: string): Promise<void> {
  try {
    const sbx = await Sandbox.get({ name: sandboxId, ...credentials() });
    await sbx.stop();
  } catch {
    // already gone
  }
}

export async function isAlive(sandboxId: string): Promise<boolean> {
  try {
    const sbx = await Sandbox.get({ name: sandboxId, ...credentials() });
    // stopped, stopping, failed, aborted and snapshotting all count as dead.
    return sbx.status === "running" || sbx.status === "pending";
  } catch {
    return false;
  }
}

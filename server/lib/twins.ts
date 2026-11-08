// Shared helpers for the Twins actions: ownership, workdir, sandbox lifecycle,
// background prepare, per-repo locking.
import fs from "node:fs";
import path from "node:path";
import {
  defineActionErrors,
  fail,
  noteExternalWrite,
  type ActionRunContext,
} from "@agent-native/core/action";
import { and, eq, inArray } from "drizzle-orm";
import { getDbExec, sql } from "@agent-native/core/db";
import { getDb, schema } from "../db/index.js";
import { mergeMachine, repoMachine } from "../db/schema.js";
import { EngineError } from "../engine/errors.js";
import { downloadRepo, workdirFor } from "../engine/repo.js";
import { scanRepo, type ScanResult } from "../engine/scan.js";
import {
  checkTargets,
  coverage as calcCoverage,
  type CheckResult,
  type Diag,
} from "../engine/check.js";
import type { FileEdit } from "../engine/merge.js";
import {
  createRepoSandbox,
  isAlive,
  prepareSandbox,
  redact,
  writeFiles,
} from "../engine/sandbox.js";

export type RepoRow = typeof schema.repos.$inferSelect;
export type MergeRow = typeof schema.merges.$inferSelect;
export type StoredScan = ScanResult & {
  /** Totals at import, before any merge. */
  initial: ScanResult["totals"];
};
export type Baseline = CheckResult & {
  targets: string[];
  coverage: { covered: number; total: number; ratio: number };
};

export const twinsErrors = defineActionErrors(
  "unauthorized",
  "repo_not_found",
  "set_not_found",
  "merge_not_found",
  "not_ready",
  "not_mergeable",
  "invalid_edits",
  "invalid_path",
  "low_coverage",
  "merge_refused",
  "undo_blocked",
  "undo_unverified",
  "github_not_connected",
  "nothing_to_merge",
  "upstream_confirmation_required",
  "github_error",
  "rate_limited",
);

type ErrCode = (typeof twinsErrors.codes)[number];
/** Fail before any write (nothing saved). Declared `never` so callers narrow. */
export function bail(
  message: string,
  code: ErrCode,
  options?: { statusCode?: number; details?: Record<string, unknown> },
): never {
  return twinsErrors.noWrite(message, code, options);
}

export const nowIso = () => new Date().toISOString();

export function requireUser(ctx?: ActionRunContext): {
  email: string;
  orgId: string | null;
} {
  const email = ctx?.userEmail;
  if (!email) return bail("Sign in to use Twins.", "unauthorized", { statusCode: 401 });
  return { email, orgId: ctx?.orgId ?? null };
}

/** Run engine code, mapping EngineError to a caller readable action failure. */
export async function engine<T>(fn: () => Promise<T> | T): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof EngineError) {
      const d = err.details;
      const details =
        d && typeof d === "object"
          ? (d as Record<string, unknown>)
          : d !== undefined
            ? { info: d }
            : null;
      fail(err.message, {
        errorCode: err.code,
        ...(details ? { details } : {}),
      });
    }
    throw err;
  }
}

export async function loadRepo(
  ctx: ActionRunContext | undefined,
  repoId: string,
): Promise<RepoRow> {
  const { email } = requireUser(ctx);
  const [row] = await getDb()
    .select()
    .from(schema.repos)
    .where(and(eq(schema.repos.id, repoId), eq(schema.repos.ownerEmail, email)))
    .limit(1);
  if (!row) {
    bail("Repo not found.", "repo_not_found", {
      statusCode: 404,
    });
  }
  return row;
}

export function parseScan(row: RepoRow): StoredScan {
  if (!row.scanJson) {
    bail("This repo has not been scanned yet.", "not_ready", {
      statusCode: 409,
    });
  }
  return JSON.parse(row.scanJson) as StoredScan;
}

export function parseBaseline(row: RepoRow): Baseline | null {
  return row.baselineJson ? (JSON.parse(row.baselineJson) as Baseline) : null;
}

export async function listMerges(repoId: string): Promise<MergeRow[]> {
  return getDb()
    .select()
    .from(schema.merges)
    .where(eq(schema.merges.repoId, repoId))
    .orderBy(schema.merges.createdAt)
    .limit(1000);
}

export function keptEdits(merges: MergeRow[]): FileEdit[][] {
  return merges
    .filter((m) => m.status === "kept")
    .map((m) => JSON.parse(m.editsJson) as FileEdit[]);
}

/** The caller field the framework passes to run(): ctx.caller (+ MCP client name). */
export function callerOf(ctx?: ActionRunContext): string {
  if (!ctx?.caller) return "unknown";
  const client = ctx.mcpClient?.name;
  return client ? `${ctx.caller}:${client}` : ctx.caller;
}

/**
 * Like callerOf, but when an MCP client sent no name with the call, fall back to
 * the name it registered with over OAuth (for example "Claude Code"), so the map
 * can credit the right agent.
 */
export async function callerLabel(ctx?: ActionRunContext): Promise<string> {
  const base = callerOf(ctx);
  if (!ctx?.caller || ctx.mcpClient?.name) return base;
  const clientId = ctx.mcpClient?.oauthClientId;
  if (!clientId) return base;
  try {
    const { rows } = await getDbExec().execute(
      sql`SELECT client_name FROM mcp_oauth_clients WHERE client_id = ${sql.value(clientId)} LIMIT 1`,
    );
    const name = (rows[0] as { client_name?: string } | undefined)?.client_name;
    return name ? `${ctx.caller}:${name}` : base;
  } catch {
    return base;
  }
}

type RepoEvent = "scanned" | "prepared" | "fail" | "reprepare";
const EVENT_TARGET = {
  scanned: "preparing",
  prepared: "ready",
  fail: "failed",
  reprepare: "preparing",
} as const;

/** Status change as a compare-and-set against the machine's source states. */
export async function transitionRepo(
  id: string,
  event: RepoEvent,
  patch: Partial<typeof schema.repos.$inferInsert> = {},
): Promise<boolean> {
  const sources = [...repoMachine.fromStates(event)];
  const rows = await getDb()
    .update(schema.repos)
    .set({
      ...patch,
      status: EVENT_TARGET[event],
      updatedAt: nowIso(),
    })
    .where(and(eq(schema.repos.id, id), inArray(schema.repos.status, sources)))
    .returning({ id: schema.repos.id });
  return rows.length === 1;
}

export async function markUndone(mergeId: string): Promise<boolean> {
  const rows = await getDb()
    .update(schema.merges)
    .set({ status: mergeMachine.transition("kept", "undo") as "undone" })
    .where(
      and(
        eq(schema.merges.id, mergeId),
        inArray(schema.merges.status, [...mergeMachine.fromStates("undo")] as MergeRow["status"][]),
      ),
    )
    .returning({ id: schema.merges.id });
  return rows.length === 1;
}

// ---- per-repo lock (one merge or undo at a time per repo) -----------------

const locks = new Map<string, Promise<unknown>>();
export async function withRepoLock<T>(
  repoId: string,
  fn: () => Promise<T>,
): Promise<T> {
  const prev = locks.get(repoId) ?? Promise.resolve();
  const next = prev.catch(() => undefined).then(fn);
  locks.set(repoId, next);
  try {
    return await next;
  } finally {
    if (locks.get(repoId) === next) locks.delete(repoId);
  }
}

// ---- workdir ---------------------------------------------------------------

const MARKER = ".twins-ready";

function safeJoin(dir: string, rel: string): string {
  const root = path.resolve(dir);
  const full = path.resolve(root, rel);
  if (full !== root && !full.startsWith(root + path.sep)) {
    throw new EngineError("invalid_path", `Path escapes the repo: ${rel}`);
  }
  return full;
}

export function applyToDisk(
  dir: string,
  edits: { path: string; content: string | null }[],
): void {
  noteExternalWrite("local-disk");
  for (const e of edits) {
    const full = safeJoin(dir, e.path);
    if (e.content === null) {
      fs.rmSync(full, { force: true });
    } else {
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, e.content, "utf8");
    }
  }
}

export function readOrNull(dir: string, rel: string): string | null {
  try {
    return fs.readFileSync(safeJoin(dir, rel), "utf8");
  } catch {
    return null;
  }
}

/** Make sure the repo exists on disk at its sha with every kept merge applied. */
export async function ensureWorkdir(row: RepoRow): Promise<string> {
  const dir = workdirFor(row.id);
  if (fs.existsSync(path.join(dir, MARKER))) return dir;
  noteExternalWrite("local-disk");
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  await downloadRepo({ owner: row.repoOwner, name: row.repoName }, row.sha, dir);
  for (const edits of keptEdits(await listMerges(row.id))) {
    applyToDisk(
      dir,
      edits.map((e) => ({ path: e.path, content: e.after })),
    );
  }
  fs.writeFileSync(path.join(dir, MARKER), nowIso());
  return dir;
}

export async function rescan(row: RepoRow, dir: string): Promise<StoredScan> {
  const prev = row.scanJson ? (JSON.parse(row.scanJson) as StoredScan) : null;
  const scan = scanRepo(dir);
  const stored: StoredScan = { ...scan, initial: prev?.initial ?? scan.totals };
  await getDb()
    .update(schema.repos)
    .set({ scanJson: JSON.stringify(stored), updatedAt: nowIso() })
    .where(eq(schema.repos.id, row.id));
  return stored;
}

export function hasBuildScript(dir: string): boolean {
  try {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(dir, "package.json"), "utf8"),
    );
    return typeof pkg?.scripts?.build === "string";
  } catch {
    return false;
  }
}

// ---- prepare ---------------------------------------------------------------

const inflight = new Map<string, Promise<void>>();
const HEARTBEAT_MS = 8_000;
const STALE_MS = 40_000;

/** Marker in status_detail meaning the next call retries by itself. */
const RETRY_NOTE = "Twins will retry on the next request.";

function plainDetail(err: unknown): string {
  if (
    err instanceof EngineError &&
    (err.code === "sandbox_create_failed" || err.code === "sandbox_gone")
  ) {
    return `${err.message} ${RETRY_NOTE}`;
  }
  if (err instanceof EngineError) return err.message;
  const msg = err instanceof Error ? err.message : String(err);
  return `Preparation failed: ${msg.slice(0, 200)}`;
}

/** Create a sandbox, install, baseline check, store the baseline, mark ready. */
async function doPrepare(row: RepoRow): Promise<void> {
  const beat = setInterval(() => {
    void getDb()
      .update(schema.repos)
      .set({ updatedAt: nowIso() })
      .where(eq(schema.repos.id, row.id))
      .catch(() => undefined);
  }, HEARTBEAT_MS);
  const stage = (detail: string) => {
    void getDb()
      .update(schema.repos)
      .set({ statusDetail: detail, updatedAt: nowIso() })
      .where(
        and(eq(schema.repos.id, row.id), eq(schema.repos.status, "preparing")),
      )
      .catch(() => undefined);
  };
  try {
    stage("starting sandbox");
    const dir = await ensureWorkdir(row);
    const scan = parseScan(await reload(row.id));
    const targets = checkTargets(dir);
    const hasBuild = hasBuildScript(dir);
    noteExternalWrite("vercel-sandbox");
    const { sandboxId } = await createRepoSandbox({
      owner: row.repoOwner,
      name: row.repoName,
      sha: row.sha,
    });
    await getDb()
      .update(schema.repos)
      .set({ sandboxId, hasBuild, updatedAt: nowIso() })
      .where(eq(schema.repos.id, row.id));
    const result = await prepareSandbox(sandboxId, targets, hasBuild, stage);
    const priorBaseline = row.baselineJson
      ? (JSON.parse(row.baselineJson) as Baseline)
      : null;
    let baseline: Baseline;
    if (
      priorBaseline &&
      JSON.stringify(priorBaseline.targets) === JSON.stringify(targets)
    ) {
      baseline = priorBaseline; // keep the original baseline when recreating
    } else {
      const cov = calcCoverage(
        result.coveredFiles,
        scan.files.map((f) => f.path),
      );
      baseline = { ...result, targets, coverage: cov };
    }
    for (const edits of keptEdits(await listMerges(row.id))) {
      await writeFiles(
        sandboxId,
        edits.map((e) => ({ path: e.path, content: e.after })),
      );
    }
    await transitionRepo(row.id, "prepared", {
      baselineJson: JSON.stringify(baseline),
      statusDetail: null,
    });
  } catch (err) {
    console.error(
      `[twins] prepare failed for ${row.id}:`,
      redact(
        err instanceof EngineError
          ? `${err.code}: ${err.message} ${JSON.stringify(err.details ?? "")}`
          : String(err instanceof Error ? (err.stack ?? err.message) : err),
      ),
    );
    await transitionRepo(row.id, "fail", { statusDetail: plainDetail(err) });
  } finally {
    clearInterval(beat);
  }
}

/** Background (non-awaited) prepare. One run per repo per process. */
export function startPrepare(row: RepoRow): Promise<void> {
  const existing = inflight.get(row.id);
  if (existing) return existing;
  const p = doPrepare(row).finally(() => inflight.delete(row.id));
  inflight.set(row.id, p);
  return p;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function reload(id: string): Promise<RepoRow> {
  const [row] = await getDb()
    .select()
    .from(schema.repos)
    .where(eq(schema.repos.id, id))
    .limit(1);
  if (!row) {
    bail("Repo not found.", "repo_not_found", {
      statusCode: 404,
    });
  }
  return row;
}

/**
 * Return a repo that is ready to merge: workdir on disk, sandbox alive and
 * prepared. Finishes preparation synchronously if the background run died.
 */
export async function ensureReady(
  row: RepoRow,
): Promise<{ row: RepoRow; dir: string }> {
  let cur = row;
  if (cur.status === "scanning") {
    bail(
      "Twins is still reading this repo. Try again in a moment.",
      "not_ready",
      { statusCode: 409 },
    );
  }
  if (cur.status === "preparing") {
    const local = inflight.get(cur.id);
    if (local) {
      await local;
    } else {
      // Another process may be preparing it: wait while its heartbeat is fresh.
      const deadline = Date.now() + 10 * 60_000;
      while (cur.status === "preparing" && Date.now() < deadline) {
        const age = Date.now() - Date.parse(cur.updatedAt);
        if (!(age < STALE_MS)) break;
        await sleep(3_000);
        cur = await reload(cur.id);
      }
      if (cur.status === "preparing") await startPrepare(cur);
    }
    cur = await reload(cur.id);
  }
  if (
    cur.status === "failed" &&
    cur.scanJson &&
    (cur.baselineJson || (cur.statusDetail ?? "").includes(RETRY_NOTE))
  ) {
    // A sandbox problem, not a repo problem: try to start again right now.
    await transitionRepo(cur.id, "reprepare", {
      sandboxId: null,
      statusDetail: "starting sandbox",
    });
    cur = await reload(cur.id);
    await startPrepare(cur);
    cur = await reload(cur.id);
  }
  if (cur.status === "failed") {
    bail(
      `Twins could not prepare this repo: ${cur.statusDetail ?? "unknown reason"}.`,
      "not_ready",
      { statusCode: 409, details: { status: cur.status } },
    );
  }
  const dir = await ensureWorkdir(cur);
  if (!cur.sandboxId || !(await isAlive(cur.sandboxId))) {
    // Sandbox expired or was stopped: rebuild it and replay the kept edits.
    await transitionRepo(cur.id, "reprepare", {
      sandboxId: null,
      statusDetail: "starting sandbox",
    });
    cur = await reload(cur.id);
    await startPrepare(cur);
    cur = await reload(cur.id);
    if (cur.status !== "ready") {
      bail(
        `Twins could not restart the sandbox: ${cur.statusDetail ?? "unknown reason"}.`,
        "not_ready",
        { statusCode: 409 },
      );
    }
  }
  return { row: cur, dir };
}

/**
 * tsgo repeats the head line of some messages as its first chain line. Drop
 * repeated lines for display only; comparisons keep the raw message.
 */
export function cleanDiagMessage(message: string): string {
  const out: string[] = [];
  for (const line of message.split("\n")) {
    if (out[out.length - 1] !== line) out.push(line);
  }
  return out.join("\n");
}

export function formatDiag(d: Diag): string {
  return `${d.file}:${d.line} ${d.code} ${cleanDiagMessage(d.message).replace(/\n/g, " ")}`;
}

// ---- shared output shapes ----------------------------------------------------

export function compactSet(s: ScanResult["sets"][number]) {
  return {
    id: s.id,
    name: s.name,
    kind: s.kind,
    isComponent: s.isComponent,
    members: s.members.length,
    duplicateLines: s.duplicateLines,
    mergeable: s.mergeable,
    reason: s.reason ?? null,
  };
}

export function countLines(text: string | null): number {
  if (!text) return 0;
  return text.split("\n").length - (text.endsWith("\n") ? 1 : 0);
}

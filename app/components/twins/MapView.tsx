import { sendToAgentChat } from "@agent-native/core/client/agent-chat";
import { actionErrorCode, writeClientAppState } from "@agent-native/core/client/hooks";
import { AgentToggleButton } from "@agent-native/toolkit/app/chat";
import {
  IconArrowBackUp,
  IconBrandGithub,
  IconDownload,
  IconExternalLink,
  IconGitMerge,
  IconMessageCircle,
  IconX,
} from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { toast } from "sonner";

import { TAB_ID } from "@/lib/tab-id";

import { AnimatedNumber, callerLabel, formatNumber, timeAgo } from "./bits";
import { BlueprintMap, type MapEvent } from "./BlueprintMap";
import {
  connectGithub,
  errorMessage,
  useCompare,
  useTwinsActions,
  useTwinsMap,
  type MergeOutcome,
} from "./use-twins";
import type { Diag, MapData, MergeRecord, TwinSet } from "./types";

export function MapView({ repoId }: { repoId: string }) {
  const { data, error, isLoading } = useTwinsMap(repoId);
  const [params, setParams] = useSearchParams();
  const selectedId = params.get("set");
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [event, setEvent] = useState<MapEvent | null>(null);
  const [lastOutcome, setLastOutcome] = useState<
    (MergeOutcome & { setId: string }) | null
  >(null);
  const knownSets = useRef(new Map<string, TwinSet>());
  const seenMerges = useRef<Set<string> | null>(null);

  for (const s of data?.sets ?? []) knownSets.current.set(s.id, s);

  const select = useCallback(
    (setId: string | null) => {
      setParams(
        (p) => {
          const next = new URLSearchParams(p);
          if (setId) next.set("set", setId);
          else next.delete("set");
          return next;
        },
        { replace: true, preventScrollReset: true },
      );
      setLastOutcome((o) => (o && o.setId !== setId ? null : o));
    },
    [setParams],
  );

  const selectedSet = selectedId
    ? (data?.sets.find((s) => s.id === selectedId) ??
      knownSets.current.get(selectedId) ??
      null)
    : null;

  // Tell the agent what is selected (navigation carries the ids from the URL).
  useEffect(() => {
    void writeClientAppState(
      `selection:${TAB_ID}`,
      selectedSet
        ? {
            kind: "twin-set",
            id: selectedSet.id,
            repoId,
            text: `${selectedSet.name}: ${selectedSet.members.length} copies, ${selectedSet.duplicateLines} duplicate lines (${selectedSet.kind})`,
          }
        : null,
      { requestSource: TAB_ID },
    ).catch(() => {});
  }, [repoId, selectedSet]);

  // Animate every new merge, whoever made it (you, the agent, Claude Code).
  useEffect(() => {
    if (!data) return;
    const keyOf = (m: MergeRecord) => `${m.id}:${m.status}`;
    if (seenMerges.current === null) {
      seenMerges.current = new Set(data.merges.map(keyOf));
      return;
    }
    const fresh = data.merges.filter(
      (m) =>
        !seenMerges.current!.has(keyOf(m)) &&
        (m.status === "kept" || m.status === "refused"),
    );
    data.merges.forEach((m) => seenMerges.current!.add(keyOf(m)));
    if (fresh.length === 0) return;
    const m = fresh[0]!;
    const set = knownSets.current.get(m.setId);
    if (!set) return;
    setEvent({ key: m.id, kind: m.status === "kept" ? "kept" : "refused", set });
    const who = callerLabel(m.caller);
    if (who !== "you") {
      if (m.status === "refused") {
        toast.error(`${capital(who)} tried to merge ${set.name}. Twins said no.`, {
          description: m.added
            ? `${m.added.length} new type ${m.added.length === 1 ? "error" : "errors"}. Undone automatically.`
            : "The check got worse, so it was undone automatically.",
        });
      } else {
        toast.success(`${capital(who)} merged ${set.name}. Still builds.`, { position: "top-center" });
      }
    }
  }, [data]);

  useEffect(() => {
    if (!event) return;
    const t = setTimeout(() => setEvent(null), event.kind === "kept" ? 2600 : 4200);
    return () => clearTimeout(t);
  }, [event]);

  const mergedSetIds = useMemo(() => {
    const latest = new Map<string, MergeRecord>();
    for (const m of [...(data?.merges ?? [])].reverse()) latest.set(m.setId, m);
    const out = new Set<string>();
    for (const [id, m] of latest) if (m.status === "kept") out.add(id);
    return out;
  }, [data?.merges]);

  const liveSets = useMemo(
    () => (data?.sets ?? []).filter((s) => !mergedSetIds.has(s.id)),
    [data?.sets, mergedSetIds],
  );

  if (error && !data) {
    return (
      <Shell>
        <div className="flex flex-1 flex-col items-start justify-center gap-5 px-6 py-16 md:px-12">
          <p className="tw-label">Could not open this map</p>
          <h1 className="tw-display max-w-2xl text-4xl md:text-6xl">
            {errorMessage(error)}
          </h1>
          <Link to="/map" className="tw-btn tw-btn-ghost">
            Map another repo
          </Link>
        </div>
      </Shell>
    );
  }

  if (isLoading || !data) {
    return (
      <Shell>
        <div className="tw-grid-bg relative flex flex-1 items-center justify-center">
          <div className="relative h-px w-64 overflow-hidden bg-[var(--hair)]">
            <div className="tw-scan absolute inset-0" />
          </div>
          <p className="tw-label absolute mt-10">Opening the map</p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <TopStrip data={data} />
      <div className="flex min-h-0 flex-1 flex-col @4xl:flex-row">
        <section className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="tw-grid-bg relative h-[380px] shrink-0 p-3 pb-8 sm:h-[460px] md:p-5 md:pb-10 @4xl:h-auto @4xl:min-h-0 @4xl:flex-1">
            {data.files.length > 0 ? (
              <BlueprintMap
                files={data.files}
                sets={liveSets}
                activeSetId={selectedId}
                hoverSetId={hoverId}
                mergedSetIds={mergedSetIds}
                event={event}
                onSelectSet={(id) => select(id === selectedId ? null : id)}
                onHoverSet={setHoverId}
                minHeight={0}
              />
            ) : (
              <EmptyMap status={data.status} />
            )}
            <Legend />
          </div>
          {selectedSet ? (
            <ComparePanel
              key={selectedSet.id}
              repoId={repoId}
              set={selectedSet}
              data={data}
              merged={mergedSetIds.has(selectedSet.id)}
              outcome={lastOutcome?.setId === selectedSet.id ? lastOutcome : null}
              onOutcome={(o) => setLastOutcome({ ...o, setId: selectedSet.id })}
              onClose={() => select(null)}
            />
          ) : null}
        </section>
        <aside className="flex min-h-0 w-full shrink-0 flex-col border-t border-[var(--hair)] bg-[var(--ink-2)] @4xl:w-[360px] @4xl:border-l @4xl:border-t-0 @6xl:w-[400px]">
          <SetRail
            sets={liveSets}
            mergedCount={mergedSetIds.size}
            selectedId={selectedId}
            onSelect={(id) => select(id === selectedId ? null : id)}
            onHover={setHoverId}
          />
          <Timeline data={data} repoId={repoId} knownSets={knownSets.current} />
        </aside>
      </div>
    </Shell>
  );
}

function capital(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="tw @container min-h-full lg:h-full">
      <div className="flex min-h-full flex-col bg-[var(--ink)] @4xl:h-full">
        {children}
      </div>
    </div>
  );
}

/* -------------------------------- top strip ------------------------------- */

function TopStrip({ data }: { data: MapData }) {
  const { repo, baseline, metrics, status } = data;
  const saved = metrics.duplicateLinesStart - metrics.duplicateLinesNow;
  return (
    <header className="relative flex flex-col gap-4 border-b border-[var(--hair)] px-4 py-4 md:flex-row md:items-end md:justify-between md:px-6">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <IconBrandGithub className="size-3.5 text-[var(--paper-3)]" />
          <a
            href={repo.htmlUrl}
            target="_blank"
            rel="noreferrer"
            className="tw-mono truncate text-[13px] text-[var(--paper-2)] hover:text-[var(--paper)]"
          >
            {repo.owner}/<span className="text-[var(--paper)]">{repo.name}</span>
          </a>
          <span className="tw-mono text-[11px] text-[var(--paper-3)]">
            @{repo.sha.slice(0, 7)}
          </span>
        </div>
        <StatusLine data={data} />
      </div>

      <div className="absolute right-3 top-3 hidden md:block">
        <AgentToggleButton />
      </div>
      <div className="flex items-end gap-6 self-end md:gap-10 md:self-auto md:pr-10">
        <div className="hidden sm:block">
          <p className="tw-label">Baseline</p>
          {baseline ? (
            <p className="tw-mono mt-1 text-[12px] leading-5 text-[var(--paper-2)]">
              <span className="text-[var(--paper)]">{formatNumber(baseline.errors)}</span>{" "}
              type errors
              <br />
              <span className="text-[var(--paper)]">
                {formatNumber(baseline.coverage.covered)} of {formatNumber(baseline.coverage.total)}
              </span>{" "}
              files checked
              {baseline.build?.ran ? (
                <>
                  <br />
                  build{" "}
                  <span style={{ color: baseline.build.ok ? "var(--green)" : "var(--red)" }}>
                    {baseline.build.ok ? "passes" : "fails"}
                  </span>
                </>
              ) : null}
            </p>
          ) : (
            <p className="tw-mono mt-1 text-[12px] text-[var(--paper-3)]">
              {status === "failed" ? "not recorded" : "recording…"}
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="tw-label">Duplicate lines</p>
          <p className="mt-1 flex items-baseline justify-end gap-3">
            {saved > 0 ? (
              <span className="tw-mono text-[15px] text-[var(--paper-3)] line-through decoration-[var(--paper-3)]">
                {formatNumber(metrics.duplicateLinesStart)}
              </span>
            ) : null}
            <AnimatedNumber
              value={metrics.duplicateLinesNow}
              className="tw-display text-5xl text-[var(--amber)] md:text-6xl"
            />
          </p>
          <p className="tw-mono mt-1 text-[11px] text-[var(--paper-3)]">
            {metrics.kept} kept · {metrics.refused} said no
          </p>
        </div>
      </div>
    </header>
  );
}

function StatusLine({ data }: { data: MapData }) {
  const { status, statusDetail } = data;
  if (status === "ready") {
    return (
      <p className="mt-2 flex items-center gap-2 text-[13px] text-[var(--paper-2)]">
        <span className="size-1.5 rounded-full bg-[var(--green)] shadow-[0_0_8px_var(--green)]" />
        Sandbox ready. Every merge is type checked against the baseline.
      </p>
    );
  }
  if (status === "failed") {
    return (
      <p className="mt-2 flex items-center gap-2 text-[13px] text-[var(--red)]">
        <span className="size-1.5 rounded-full bg-[var(--red)]" />
        {statusDetail ?? "Something failed while preparing this repo."}
      </p>
    );
  }
  const label =
    status === "scanning" ? "Reading the code" : "Preparing sandbox";
  return (
    <div className="mt-2 flex items-center gap-3 text-[13px] text-[var(--paper-2)]">
      <span className="relative block h-px w-16 overflow-hidden bg-[var(--hair-2)]">
        <span className="tw-scan absolute inset-0" />
      </span>
      <span>
        {label}
        {statusDetail ? (
          <span className="tw-mono text-[12px] text-[var(--paper-3)]"> · {statusDetail}</span>
        ) : (
          "…"
        )}
      </span>
    </div>
  );
}

function EmptyMap({ status }: { status: MapData["status"] }) {
  return (
    <div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-3 text-center">
      <p className="tw-display text-3xl text-[var(--paper-2)]">
        {status === "scanning" ? "Drawing the map…" : "No source files found."}
      </p>
      <p className="tw-mono text-[12px] text-[var(--paper-3)]">
        {status === "scanning"
          ? "Reading every TypeScript and JavaScript file"
          : "Twins reads .ts, .tsx, .js and .jsx files."}
      </p>
    </div>
  );
}

function Legend() {
  return (
    <div className="tw-mono pointer-events-none absolute bottom-3 left-5 hidden items-center gap-4 text-[10px] tracking-[0.12em] text-[var(--paper-3)] md:flex">
      <span className="flex items-center gap-1.5">
        <span className="inline-block size-2.5 border border-[rgba(150,215,255,0.34)]" />
        FOLDER
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block size-2.5 border border-[rgba(125,200,255,0.2)] bg-[rgba(143,216,255,0.05)]" />
        FILE
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block size-2.5 border border-[var(--amber)] bg-[rgba(255,181,71,0.35)] shadow-[0_0_8px_var(--amber)]" />
        HOLDS A COPY
      </span>
    </div>
  );
}

/* --------------------------------- set rail -------------------------------- */

function SetRail({
  sets,
  mergedCount,
  selectedId,
  onSelect,
  onHover,
}: {
  sets: TwinSet[];
  mergedCount: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}) {
  const ranked = useMemo(
    () => [...sets].sort((a, b) => b.duplicateLines - a.duplicateLines),
    [sets],
  );
  return (
    <div className="flex min-h-0 flex-col @4xl:flex-[1.3]">
      <div className="flex items-baseline justify-between px-5 pb-3 pt-5">
        <h2 className="tw-display text-[28px]">
          {ranked.length} {ranked.length === 1 ? "set" : "sets"} of copies
        </h2>
        {mergedCount > 0 ? (
          <span className="tw-mono text-[11px] text-[var(--green)]">{mergedCount} merged</span>
        ) : null}
      </div>
      <div
        role="listbox"
        aria-label="Sets of copies"
        className="min-h-0 flex-1 overflow-y-auto border-t border-[var(--hair)]"
      >
        {ranked.length === 0 ? (
          <p className="px-5 py-6 text-[13px] text-[var(--paper-3)]">
            {mergedCount > 0
              ? "Every copy is merged. Export the patch below."
              : "No copies found in this repo."}
          </p>
        ) : null}
        {ranked.map((s, i) => (
          <button
            key={s.id}
            type="button"
            role="option"
            aria-selected={s.id === selectedId}
            onClick={() => onSelect(s.id)}
            onMouseEnter={() => onHover(s.id)}
            onMouseLeave={() => onHover(null)}
            onFocus={() => onHover(s.id)}
            onBlur={() => onHover(null)}
            className="tw-row grid w-full grid-cols-[22px_1fr_auto] items-baseline gap-x-3 border-b border-[var(--hair)] px-5 py-3 text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[var(--cyan)]"
          >
            <span className="tw-mono text-[10px] text-[var(--paper-3)]">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="min-w-0">
              <span className="tw-mono block truncate text-[13px] text-[var(--paper)]">
                {s.name}
              </span>
              <span className="mt-0.5 flex items-center gap-2 text-[11.5px] text-[var(--paper-3)]">
                <span>{s.members.length} copies</span>
                <span aria-hidden>·</span>
                <KindBadge set={s} />
                {s.isComponent ? (
                  <>
                    <span aria-hidden>·</span>
                    <span>component</span>
                  </>
                ) : null}
              </span>
            </span>
            <span className="text-right">
              <span className="tw-mono block text-[15px] text-[var(--amber)]">
                {formatNumber(s.duplicateLines)}
              </span>
              <span className="tw-mono text-[10px] text-[var(--paper-3)]">lines</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function KindBadge({ set }: { set: TwinSet }) {
  const exact = set.kind === "exact";
  return (
    <span
      className="tw-mono rounded-sm px-1 text-[9.5px] tracking-[0.14em]"
      style={{
        color: exact ? "var(--amber)" : "var(--cyan)",
        border: `1px solid ${exact ? "rgba(255,181,71,0.45)" : "rgba(143,216,255,0.35)"}`,
      }}
      title={exact ? "Same code, same dependencies" : "Same shape, small differences"}
    >
      {exact ? "EXACT" : "NEAR"}
    </span>
  );
}

/* ------------------------------ compare panel ------------------------------ */

function ComparePanel({
  repoId,
  set,
  data,
  merged,
  outcome,
  onOutcome,
  onClose,
}: {
  repoId: string;
  set: TwinSet;
  data: MapData;
  merged: boolean;
  outcome: (MergeOutcome & { setId: string }) | null;
  onOutcome: (o: MergeOutcome) => void;
  onClose: () => void;
}) {
  const compare = useCompare(repoId, merged ? null : set.id);
  const { runMerge } = useTwinsActions(repoId);
  const [pending, setPending] = useState(false);
  const ready = data.status === "ready";
  // A sandbox hiccup, not a repo problem: merging again restarts the sandbox first.
  const retryable =
    data.status === "failed" && /retry/i.test(data.statusDetail ?? "");
  const latest = data.merges.find((m) => m.setId === set.id);
  const refusedErrors: Diag[] | null =
    outcome?.status === "refused"
      ? outcome.added
      : latest?.status === "refused"
        ? (latest.added ?? [])
        : null;

  async function merge() {
    setPending(true);
    const o = await runMerge(set.id);
    setPending(false);
    onOutcome(o);
    if (o.status === "error") toast.error(o.message);
  }

  function askAgent() {
    const members = set.members
      .map((m) => `- ${m.name} in ${m.path}:${m.line}-${m.endLine}`)
      .join("\n");
    sendToAgentChat({
      message:
        set.kind === "exact" && set.mergeable
          ? `Merge the copies of ${set.name} on the map I have open.`
          : `Merge the copies of ${set.name}. They differ, so compare them, write one shared version that keeps every caller working, and pass your edits to merge-twins.`,
      context: `Twins repo ${repoId} (${data.repo.owner}/${data.repo.name}), set ${set.id}: "${set.name}", ${set.kind}, ${set.members.length} copies, ${set.duplicateLines} duplicate lines.${set.reason ? ` Not mergeable in one click: ${set.reason}.` : ""}\nCopies:\n${members}\nUse compare-twins to read them and merge-twins to merge. The merge is kept only if the type check is no worse than the baseline.`,
      submit: true,
      openSidebar: true,
    });
  }

  const canOneClick = set.mergeable && !merged;

  return (
    <div className="tw-fade-in flex max-h-[48vh] min-h-[220px] shrink-0 flex-col border-t border-[var(--hair-2)] bg-[var(--ink-2)] @4xl:max-h-[46%]">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-[var(--hair)] px-4 py-3 md:px-5">
        <div className="min-w-[min(100%,240px)] flex-1">
          <div className="flex items-center gap-2">
            <h3 className="tw-mono truncate text-[15px] text-[var(--amber)]">{set.name}</h3>
            <KindBadge set={set} />
          </div>
          <p className="mt-0.5 line-clamp-2 text-[12px] text-[var(--paper-3)]">
            {set.members.length} copies · {formatNumber(set.duplicateLines)} duplicate lines
            {set.reason && !merged ? ` · ${set.reason}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {merged ? (
            <span className="tw-mono text-[12px] text-[var(--green)]">Merged · still builds</span>
          ) : (
            <>
              <button
                type="button"
                onClick={askAgent}
                className={`tw-btn ${canOneClick ? "tw-btn-ghost" : "tw-btn-primary"} h-9`}
              >
                <IconMessageCircle className="size-4" strokeWidth={1.8} />
                Ask the agent to merge this
              </button>
              {set.mergeable ? (
                <button
                  type="button"
                  onClick={() => void merge()}
                  disabled={pending || !(ready || retryable)}
                  className="tw-btn tw-btn-primary h-9"
                  title={ready || retryable ? undefined : "Waiting for the sandbox"}
                >
                  <IconGitMerge className="size-4" strokeWidth={1.8} />
                  {pending
                    ? "Checking the build…"
                    : ready
                      ? `Merge ${set.members.length} copies`
                      : retryable
                        ? "Restart sandbox and merge"
                        : "Sandbox warming up"}
                </button>
              ) : null}
            </>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-9 items-center justify-center rounded-full text-[var(--paper-3)] hover:bg-[rgba(143,216,255,0.06)] hover:text-[var(--paper)]"
          >
            <IconX className="size-4" />
          </button>
        </div>
        {pending ? (
          <div className="w-full">
            <div className="relative h-px w-full overflow-hidden bg-[var(--hair)]">
              <div className="tw-scan absolute inset-0" />
            </div>
            <p className="tw-mono mt-2 text-[11px] text-[var(--paper-3)]">
              Writing one shared file, rewiring callers, then type checking{" "}
              {data.baseline ? `${formatNumber(data.baseline.coverage.covered)} files` : "the app"} against the baseline
            </p>
          </div>
        ) : null}
      </div>

      {refusedErrors ? <Refusal errors={refusedErrors} /> : null}

      <div className="min-h-0 flex-1 overflow-auto">
        {merged ? (
          <p className="px-5 py-6 text-[13px] text-[var(--paper-2)]">
            These copies now live in one shared file. Undo it from the history if you change your mind.
          </p>
        ) : compare.isLoading ? (
          <div className="px-5 py-6">
            <p className="tw-label">Reading the copies</p>
          </div>
        ) : compare.error ? (
          <p className="px-5 py-6 text-[13px] text-[var(--red)]">
            {errorMessage(compare.error)}
          </p>
        ) : (
          <div
            className="grid min-w-full divide-x divide-[var(--hair)]"
            style={{
              gridTemplateColumns: `repeat(${compare.data?.members.length ?? set.members.length}, minmax(300px, 1fr))`,
            }}
          >
            {(compare.data?.members ?? []).map((m) => (
              <div key={m.id} className="min-w-0 overflow-x-auto">
                <div className="tw-mono sticky top-0 z-[1] truncate border-b border-[var(--hair)] bg-[var(--ink-2)] px-4 py-2 text-[11px] text-[var(--paper-2)]">
                  {m.path}
                  <span className="text-[var(--paper-3)]">
                    :{m.line}–{m.endLine}
                  </span>
                </div>
                <CodeBlock code={m.code} start={m.line} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CodeBlock({ code, start }: { code: string; start: number }) {
  const lines = code.replace(/\s+$/, "").split("\n");
  return (
    <pre className="tw-code min-w-max px-0 py-2 text-[var(--paper-2)]">
      {lines.map((l, i) => (
        <div key={i} className="flex hover:bg-[rgba(143,216,255,0.04)]">
          <span className="w-11 shrink-0 select-none pr-3 text-right text-[var(--paper-3)] opacity-60">
            {start + i}
          </span>
          <span className="whitespace-pre pr-4">{l || " "}</span>
        </div>
      ))}
    </pre>
  );
}

function Refusal({ errors }: { errors: Diag[] }) {
  return (
    <div
      className="tw-fade-in border-b px-4 py-3 md:px-5"
      style={{ borderColor: "rgba(255,90,82,0.35)", background: "var(--red-dim)" }}
      role="alert"
    >
      <p className="flex flex-wrap items-baseline gap-x-3 text-[13px]">
        <span className="tw-mono font-bold tracking-[0.12em] text-[var(--red)]">SAID NO</span>
        <span className="text-[var(--paper)]">
          This merge added {errors.length} new type {errors.length === 1 ? "error" : "errors"}.
        </span>
        <span className="text-[var(--paper-3)]">Undone automatically. Your code is as it was.</span>
      </p>
      {errors.length > 0 ? (
        <ul className="tw-mono mt-2 space-y-1 text-[11.5px]">
          {errors.slice(0, 8).map((d, i) => (
            <li key={i} className="flex gap-3">
              <span className="shrink-0 text-[var(--red)]">
                {d.file}:{d.line}
              </span>
              <span className="text-[var(--paper-2)]">
                <span className="text-[var(--paper-3)]">{d.code}</span> {d.message}
              </span>
            </li>
          ))}
          {errors.length > 8 ? (
            <li className="text-[var(--paper-3)]">and {errors.length - 8} more</li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}

/* --------------------------------- timeline -------------------------------- */

function Timeline({
  data,
  repoId,
  knownSets,
}: {
  data: MapData;
  repoId: string;
  knownSets: Map<string, TwinSet>;
}) {
  const { runUndo, runExport, runOpenPr, undoPending } = useTwinsActions(repoId);
  const [exporting, setExporting] = useState(false);
  const [opening, setOpening] = useState(false);
  const [needsGithub, setNeedsGithub] = useState(false);
  const [prUrl, setPrUrl] = useState<string | null>(null);

  async function openPr() {
    setOpening(true);
    try {
      const r = await runOpenPr();
      setPrUrl(r.url);
      toast.success("Pull request opened.");
    } catch (e) {
      if (actionErrorCode(e) === "github_not_connected") {
        setNeedsGithub(true);
        toast("Connect GitHub first, then press Open pull request again.");
      } else {
        toast.error(errorMessage(e));
      }
    } finally {
      setOpening(false);
    }
  }

  async function linkGithub() {
    try {
      await connectGithub();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }
  const kept = data.merges.filter((m) => m.status === "kept").length;

  async function exportPatch() {
    setExporting(true);
    try {
      const r = await runExport();
      if (!r?.patch) {
        toast("Nothing to export yet. Merge a set first.");
        return;
      }
      const blob = new Blob([r.patch], { type: "text/x-diff" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${data.repo.name}.twins.patch`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-col border-t border-[var(--hair-2)] @4xl:flex-1">
      <div className="flex items-baseline justify-between px-5 pb-2 pt-4">
        <h2 className="tw-label">History</h2>
        <span className="tw-mono text-[10.5px] text-[var(--paper-3)]">you · agent · Claude Code</span>
      </div>
      <ol className="min-h-0 flex-1 overflow-y-auto px-5">
        {data.merges.length === 0 ? (
          <li className="py-3 text-[12.5px] leading-relaxed text-[var(--paper-3)]">
            No merges yet. Merges from this page, the agent and Claude Code all land here.
          </li>
        ) : null}
        {data.merges.map((m) => (
          <TimelineRow
            key={m.id}
            m={m}
            setName={
              knownSets.get(m.setId)?.name ??
              m.setName ??
              /^Merged? (?:of )?(\S+)/.exec(m.summary)?.[1] ??
              m.setId
            }
            onUndo={() =>
              void runUndo(m.id).catch((e) => toast.error(errorMessage(e)))
            }
            undoPending={undoPending}
          />
        ))}
      </ol>
      <div className="flex flex-wrap items-center gap-2 border-t border-[var(--hair)] px-5 py-3">
        <button
          type="button"
          onClick={() => void exportPatch()}
          disabled={exporting || kept === 0}
          className="tw-btn tw-btn-ghost h-9"
        >
          <IconDownload className="size-4" strokeWidth={1.8} />
          {exporting ? "Preparing…" : "Export patch"}
        </button>
        {data.repo.prUrl || prUrl ? (
          <a
            href={(prUrl ?? data.repo.prUrl) as string}
            target="_blank"
            rel="noreferrer"
            className="tw-btn tw-btn-ghost h-9"
          >
            <IconExternalLink className="size-4" strokeWidth={1.8} />
            View pull request
          </a>
        ) : needsGithub ? (
          <button
            type="button"
            onClick={() => void linkGithub()}
            className="tw-btn tw-btn-ghost h-9"
            title="Approve public repo access so Twins can open the pull request from your account"
          >
            <IconBrandGithub className="size-4" strokeWidth={1.8} />
            Connect GitHub
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void openPr()}
            disabled={opening || kept === 0}
            className="tw-btn tw-btn-ghost h-9"
            title="Fork the repo to your GitHub and open a pull request with the kept merges"
          >
            <IconExternalLink className="size-4" strokeWidth={1.8} />
            {opening ? "Opening pull request…" : "Open pull request"}
          </button>
        )}
      </div>
    </div>
  );
}

function TimelineRow({
  m,
  setName,
  onUndo,
  undoPending,
}: {
  m: MergeRecord;
  setName: string;
  onUndo: () => void;
  undoPending: boolean;
}) {
  const who = callerLabel(m.caller);
  const color =
    m.status === "kept"
      ? "var(--green)"
      : m.status === "refused"
        ? "var(--red)"
        : m.status === "checking"
          ? "var(--cyan)"
          : "var(--paper-3)";
  const verdict =
    m.status === "kept"
      ? "kept"
      : m.status === "refused"
        ? "said no"
        : m.status === "checking"
          ? "checking"
          : "undone";
  return (
    <li className="tw-fade-in relative border-l border-[var(--hair-2)] py-2.5 pl-4">
      <span
        className="absolute -left-[4.5px] top-[15px] size-2 rounded-full"
        style={{ background: color, boxShadow: `0 0 8px ${color}` }}
      />
      <div className="flex items-baseline justify-between gap-2">
        <p className="min-w-0 text-[12.5px] text-[var(--paper-2)]">
          <span className="text-[var(--paper)]">{who}</span>{" "}
          {m.status === "refused" ? "tried to merge" : "merged"}{" "}
          <span className="tw-mono text-[var(--amber)]">{setName}</span>
        </p>
        <span className="tw-mono shrink-0 text-[10.5px] font-semibold tracking-[0.1em]" style={{ color }}>
          {verdict.toUpperCase()}
        </span>
      </div>
      <p className="mt-0.5 flex items-center gap-2 text-[11px] text-[var(--paper-3)]">
        <span>{timeAgo(m.createdAt)}</span>
        {m.status === "kept" ? (
          <span className="tw-mono">
            −{m.linesRemoved} +{m.linesAdded}
          </span>
        ) : null}
        {m.status === "refused" ? (
          <span>
            {m.added
              ? `${m.added.length} new ${m.added.length === 1 ? "error" : "errors"}, undone`
              : "undone automatically"}
          </span>
        ) : null}
        {m.status === "kept" ? (
          <button
            type="button"
            onClick={onUndo}
            disabled={undoPending}
            className="ml-auto inline-flex items-center gap-1 text-[var(--paper-3)] hover:text-[var(--paper)]"
          >
            <IconArrowBackUp className="size-3.5" />
            Undo
          </button>
        ) : null}
      </p>
    </li>
  );
}

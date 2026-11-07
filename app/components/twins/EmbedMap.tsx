import { openMcpAppHostLink } from "@agent-native/core/client";
import { IconExternalLink } from "@tabler/icons-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { AnimatedNumber, callerLabel, formatNumber, timeAgo } from "./bits";
import { BlueprintMap, type MapEvent } from "./BlueprintMap";
import { errorMessage, useTwinsMap } from "./use-twins";
import type { MapData, MergeRecord, TwinSet } from "./types";

/**
 * The compact map an MCP host renders inline (Claude, ChatGPT, Cursor...):
 * the copies glowing, the duplicate-lines number, and the last merge result.
 * It polls like the full map, so a merge from any caller lands here live.
 */
export function EmbedMap({
  repoId,
  mergeId,
}: {
  repoId: string;
  mergeId: string | null;
}) {
  const { data, error, isLoading } = useTwinsMap(repoId);
  const [event, setEvent] = useState<MapEvent | null>(null);
  const [focusId, setFocusId] = useState<string | null>(mergeId);
  const knownSets = useRef(new Map<string, TwinSet>());
  const seen = useRef<Set<string> | null>(null);

  for (const s of data?.sets ?? []) knownSets.current.set(s.id, s);

  // Flash every merge recorded after the card opened, whoever made it.
  useEffect(() => {
    if (!data) return;
    const keyOf = (m: MergeRecord) => `${m.id}:${m.status}`;
    if (seen.current === null) {
      seen.current = new Set(data.merges.map(keyOf));
      // Opened for a specific merge: play it once so the card lands on it.
      const first = mergeId
        ? data.merges.find((m) => m.id === mergeId)
        : undefined;
      const set = first ? knownSets.current.get(first.setId) : undefined;
      if (first && set && (first.status === "kept" || first.status === "refused")) {
        setEvent({ key: first.id, kind: first.status, set });
      }
      return;
    }
    const fresh = data.merges.filter(
      (m) =>
        !seen.current!.has(keyOf(m)) &&
        (m.status === "kept" || m.status === "refused"),
    );
    data.merges.forEach((m) => seen.current!.add(keyOf(m)));
    const m = fresh[0];
    if (!m) return;
    setFocusId(m.id);
    const set = knownSets.current.get(m.setId);
    if (set) setEvent({ key: m.id, kind: m.status === "kept" ? "kept" : "refused", set });
  }, [data, mergeId]);

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
      <Frame>
        <div className="flex flex-1 flex-col justify-center gap-2 px-5">
          <p className="tw-label">Could not open this map</p>
          <p className="text-[14px] text-[var(--paper-2)]">{errorMessage(error)}</p>
        </div>
      </Frame>
    );
  }

  if (isLoading || !data) {
    return (
      <Frame>
        <div className="tw-grid-bg relative flex flex-1 items-center justify-center">
          <div className="relative h-px w-48 overflow-hidden bg-[var(--hair)]">
            <div className="tw-scan absolute inset-0" />
          </div>
        </div>
      </Frame>
    );
  }

  const shown =
    (focusId ? data.merges.find((m) => m.id === focusId) : undefined) ??
    data.merges.find((m) => m.status === "kept" || m.status === "refused") ??
    null;

  return (
    <Frame>
      <Header data={data} repoId={repoId} liveSets={liveSets.length} />
      <div className="tw-grid-bg relative min-h-0 flex-1 p-2.5">
        {data.files.length > 0 ? (
          <BlueprintMap
            files={data.files}
            sets={liveSets}
            mergedSetIds={mergedSetIds}
            event={event}
            minHeight={0}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="tw-label">
              {data.status === "failed" ? "This repo failed to prepare" : "Reading the code"}
            </p>
          </div>
        )}
      </div>
      <Result merge={shown} knownSets={knownSets.current} />
    </Frame>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="tw h-dvh w-full overflow-hidden">
      <div className="flex h-full flex-col bg-[var(--ink)]">{children}</div>
    </div>
  );
}

function Header({
  data,
  repoId,
  liveSets,
}: {
  data: MapData;
  repoId: string;
  liveSets: number;
}) {
  const { repo, metrics, status } = data;
  const saved = metrics.duplicateLinesStart - metrics.duplicateLinesNow;
  const fullMap = `/map/${encodeURIComponent(repoId)}`;
  return (
    <header className="flex items-end justify-between gap-4 border-b border-[var(--hair)] px-4 py-3">
      <div className="min-w-0">
        <p className="tw-mono truncate text-[12px] text-[var(--paper-2)]">
          {repo.owner}/<span className="text-[var(--paper)]">{repo.name}</span>
          <span className="text-[var(--paper-3)]"> @{repo.sha.slice(0, 7)}</span>
        </p>
        <p className="mt-1 flex items-center gap-2 text-[12px] text-[var(--paper-3)]">
          <span
            className="size-1.5 rounded-full"
            style={{
              background: status === "ready" ? "var(--green)" : status === "failed" ? "var(--red)" : "var(--amber)",
            }}
          />
          {liveSets} {liveSets === 1 ? "set" : "sets"} of copies · {metrics.kept} kept ·{" "}
          {metrics.refused} said no
        </p>
        <button
          type="button"
          onClick={() => void openFullMap(fullMap)}
          className="tw-mono mt-1.5 inline-flex items-center gap-1 text-[11px] text-[var(--paper-3)] hover:text-[var(--paper)]"
        >
          Open full map <IconExternalLink className="size-3" />
        </button>
      </div>
      <div className="shrink-0 text-right">
        <p className="tw-label">Duplicate lines</p>
        <p className="mt-0.5 flex items-baseline justify-end gap-2">
          {saved > 0 ? (
            <span className="tw-mono text-[13px] text-[var(--paper-3)] line-through">
              {formatNumber(metrics.duplicateLinesStart)}
            </span>
          ) : null}
          <AnimatedNumber
            value={metrics.duplicateLinesNow}
            className="tw-display text-4xl text-[var(--amber)]"
          />
        </p>
      </div>
    </header>
  );
}

async function openFullMap(path: string) {
  const url = new URL(path, window.location.origin).toString();
  try {
    const opened = await openMcpAppHostLink(url);
    if (opened) return;
  } catch {
    // Not inside a host bridge; fall through to a normal tab.
  }
  window.open(url, "_blank", "noopener");
}

function Result({
  merge,
  knownSets,
}: {
  merge: MergeRecord | null;
  knownSets: Map<string, TwinSet>;
}) {
  if (!merge) {
    return (
      <div className="border-t border-[var(--hair)] px-4 py-3 text-[12px] text-[var(--paper-3)]">
        No merges yet. Every merge is type checked against the baseline before it is kept.
      </div>
    );
  }
  const name = merge.setName ?? knownSets.get(merge.setId)?.name ?? merge.setId;
  const who = callerLabel(merge.caller);
  const by = `${who === "you" ? "You" : who.charAt(0).toUpperCase() + who.slice(1)} · ${timeAgo(merge.createdAt)}`;

  if (merge.status === "refused") {
    const errors = merge.added ?? [];
    return (
      <div
        key={merge.id}
        className="tw-fade-in max-h-[38%] shrink-0 overflow-auto border-t px-4 py-3"
        style={{ borderColor: "rgba(255,90,82,0.4)", background: "var(--red-dim)" }}
        role="alert"
      >
        <p className="flex flex-wrap items-baseline gap-x-3 text-[13px]">
          <span className="tw-mono font-bold tracking-[0.12em] text-[var(--red)]">SAID NO</span>
          <span className="tw-mono text-[var(--paper)]">{name}</span>
          <span className="text-[var(--paper-2)]">
            {errors.length > 0
              ? `${errors.length} new type ${errors.length === 1 ? "error" : "errors"}. Nothing was changed.`
              : "The build broke. Nothing was changed."}
          </span>
          <span className="ml-auto text-[11px] text-[var(--paper-3)]">{by}</span>
        </p>
        {errors.length > 0 ? (
          <ul className="tw-mono mt-2 space-y-1 text-[11px]">
            {errors.slice(0, 4).map((d, i) => (
              <li key={i} className="flex gap-2">
                <span className="shrink-0 text-[var(--red)]">
                  {d.file}:{d.line}
                </span>
                <span className="text-[var(--paper-2)]">
                  <span className="text-[var(--paper-3)]">{d.code}</span> {d.message.split("\n")[0]}
                </span>
              </li>
            ))}
            {errors.length > 4 ? (
              <li className="text-[var(--paper-3)]">and {errors.length - 4} more</li>
            ) : null}
          </ul>
        ) : null}
      </div>
    );
  }

  const kept = merge.status === "kept";
  return (
    <div
      key={merge.id}
      className="tw-fade-in shrink-0 border-t px-4 py-3"
      style={{
        borderColor: kept ? "rgba(95,240,196,0.35)" : "var(--hair)",
        background: kept ? "rgba(95,240,196,0.06)" : undefined,
      }}
    >
      <p className="flex flex-wrap items-baseline gap-x-3 text-[13px]">
        <span
          className="tw-mono font-bold tracking-[0.12em]"
          style={{ color: kept ? "var(--green)" : "var(--paper-3)" }}
        >
          {kept ? "KEPT" : merge.status === "undone" ? "UNDONE" : "CHECKING"}
        </span>
        <span className="tw-mono text-[var(--paper)]">{name}</span>
        <span className="text-[var(--paper-2)]">
          {kept
            ? `${merge.linesRemoved} lines removed, ${merge.linesAdded} added. No new type errors.`
            : merge.status === "undone"
              ? "Undone. The baseline is back."
              : "Type checking against the baseline…"}
        </span>
        <span className="ml-auto text-[11px] text-[var(--paper-3)]">{by}</span>
      </p>
    </div>
  );
}

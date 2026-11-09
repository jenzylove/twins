import { useEffect, useMemo, useRef, useState } from "react";

import { layoutFloorPlan, type Cell } from "./treemap";
import type { FileNode, TwinSet } from "./types";

export type MapEvent = {
  key: string;
  kind: "kept" | "refused";
  /** The set as it was before the merge, so the animation still has its cells. */
  set: TwinSet;
};

interface BlueprintMapProps {
  files: FileNode[];
  sets: TwinSet[];
  activeSetId?: string | null;
  hoverSetId?: string | null;
  mergedSetIds?: ReadonlySet<string>;
  event?: MapEvent | null;
  onSelectSet?: (setId: string) => void;
  onHoverSet?: (setId: string | null) => void;
  className?: string;
  /** Hide file names and hover tips (landing hero). */
  quiet?: boolean;
  minHeight?: number;
}

function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const r = entry!.contentRect;
      setSize((s) =>
        Math.abs(s.w - r.width) < 1 && Math.abs(s.h - r.height) < 1
          ? s
          : { w: Math.floor(r.width), h: Math.floor(r.height) },
      );
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

function center(c: Cell) {
  return { x: c.x + c.w / 2, y: c.y + c.h / 2 };
}

function memberPoint(c: Cell, line: number, fileLines: number) {
  const t = Math.min(0.92, Math.max(0.08, line / Math.max(1, fileLines)));
  return { x: c.x + c.w / 2, y: c.y + c.h * t };
}

function arcPath(a: { x: number; y: number }, b: { x: number; y: number }) {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy) || 1;
  const bend = Math.min(140, dist * 0.32);
  const cx = mx - (dy / dist) * bend;
  const cy = my + (dx / dist) * bend;
  // Rough length of the quadratic for dash animation.
  const len = Math.round(dist * 1.25 + bend * 0.6);
  return { d: `M${a.x},${a.y} Q${cx},${cy} ${b.x},${b.y}`, len };
}

function basename(path: string) {
  return path.slice(path.lastIndexOf("/") + 1);
}

export function BlueprintMap({
  files,
  sets,
  activeSetId,
  hoverSetId,
  mergedSetIds,
  event,
  onSelectSet,
  onHoverSet,
  className,
  quiet,
  minHeight = 320,
}: BlueprintMapProps) {
  const [wrapRef, size] = useSize<HTMLDivElement>();
  const [tip, setTip] = useState<{ x: number; y: number; cell: Cell } | null>(
    null,
  );

  const plan = useMemo(
    () =>
      size.w > 0 && size.h > 0
        ? layoutFloorPlan(files, size.w, size.h, {
            header: size.w < 520 ? 13 : 16,
            pad: size.w < 520 ? 3 : 5,
          })
        : null,
    [files, size.w, size.h],
  );

  const liveSets = useMemo(
    () => sets.filter((s) => !mergedSetIds?.has(s.id)),
    [sets, mergedSetIds],
  );

  // file path -> first live set id that touches it
  const setByPath = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of liveSets)
      for (const mem of s.members) if (!m.has(mem.path)) m.set(mem.path, s.id);
    return m;
  }, [liveSets]);

  const fileLines = useMemo(
    () => new Map(files.map((f) => [f.path, f.lines])),
    [files],
  );

  const focusId = hoverSetId ?? activeSetId ?? null;
  const focusSet = focusId ? sets.find((s) => s.id === focusId) : undefined;
  const focusPaths = useMemo(
    () => new Set(focusSet?.members.map((m) => m.path) ?? []),
    [focusSet],
  );

  const eventSet = event?.set;
  const eventCells = useMemo(() => {
    if (!plan || !eventSet) return [];
    const seen = new Set<string>();
    const out: Cell[] = [];
    for (const m of eventSet.members) {
      const c = plan.byPath.get(m.path);
      if (c && !seen.has(c.path)) {
        seen.add(c.path);
        out.push(c);
      }
    }
    return out;
  }, [plan, eventSet]);

  const eventCenter = useMemo(() => {
    if (eventCells.length === 0) return null;
    const xs = eventCells.map((c) => center(c));
    return {
      x: xs.reduce((a, p) => a + p.x, 0) / xs.length,
      y: xs.reduce((a, p) => a + p.y, 0) / xs.length,
    };
  }, [eventCells]);

  const arcs = useMemo(() => {
    if (!plan || !focusSet) return [];
    const pts = focusSet.members
      .map((m) => {
        const c = plan.byPath.get(m.path);
        return c ? memberPoint(c, m.line, fileLines.get(m.path) ?? 1) : null;
      })
      .filter((p): p is { x: number; y: number } => Boolean(p));
    const out: { d: string; len: number; key: string }[] = [];
    for (let i = 1; i < pts.length; i++) {
      const a = arcPath(pts[0]!, pts[i]!);
      out.push({ ...a, key: `${focusSet.id}-${i}` });
    }
    return { pts, out };
  }, [plan, focusSet, fileLines]);

  const showNames = !quiet && size.w >= 520;

  return (
    <div
      ref={wrapRef}
      className={`tw-map relative h-full w-full overflow-hidden ${className ?? ""}`}
      style={{ minHeight }}
      onMouseLeave={() => {
        setTip(null);
        onHoverSet?.(null);
      }}
    >
      {plan ? (
        <svg
          width={size.w}
          height={size.h}
          viewBox={`0 0 ${size.w} ${size.h}`}
          className="absolute inset-0 block"
          role="img"
          aria-label={`Map of ${files.length} files with ${liveSets.length} sets of copies`}
        >
          <defs>
            <filter id="tw-glow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="5" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="tw-glow-soft" x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur stdDeviation="9" />
            </filter>
            <linearGradient id="tw-arc-grad" x1="0" x2="1">
              <stop offset="0" stopColor="var(--accent-hot)" />
              <stop offset="1" stopColor="var(--accent)" />
            </linearGradient>
          </defs>

          {/* Rooms */}
          {plan.rooms.map((r) => {
            const strong = r.depth <= 1;
            const showLabel = r.w > 60 && r.h > 30;
            return (
              <g key={`room-${r.path}`}>
                <rect
                  x={r.x + 0.5}
                  y={r.y + 0.5}
                  width={Math.max(0, r.w - 1)}
                  height={Math.max(0, r.h - 1)}
                  fill={r.depth === 1 ? "rgba(20,19,17,0.035)" : "none"}
                  stroke={strong ? "rgba(20,19,17,0.28)" : "rgba(20,19,17,0.14)"}
                  strokeWidth={1}
                  strokeDasharray={strong ? undefined : "3 3"}
                />
                {showLabel ? (
                  <text
                    x={r.x + 6}
                    y={r.y + (size.w < 520 ? 10 : 11.5)}
                    fontSize={size.w < 520 ? 7.5 : 8.5}
                    letterSpacing="0.1em"
                    fill={strong ? "rgba(20,19,17,0.68)" : "rgba(20,19,17,0.42)"}
                  >
                    {r.label.toUpperCase().slice(0, Math.floor(r.w / 6.2))}
                  </text>
                ) : null}
              </g>
            );
          })}

          {/* Cells */}
          {plan.cells.map((c) => {
            const setId = setByPath.get(c.path);
            const isCopy = Boolean(setId);
            const inFocus = focusPaths.has(c.path);
            const dim = Boolean(focusSet) && !inFocus;
            return (
              <g
                key={c.path}
                className={isCopy && onSelectSet ? "cursor-pointer" : undefined}
                onMouseEnter={(e) => {
                  if (!quiet) setTip({ x: e.clientX, y: e.clientY, cell: c });
                  if (setId) onHoverSet?.(setId);
                }}
                onMouseMove={(e) => {
                  if (!quiet) setTip({ x: e.clientX, y: e.clientY, cell: c });
                }}
                onMouseLeave={() => {
                  setTip(null);
                  if (setId) onHoverSet?.(null);
                }}
                onClick={() => setId && onSelectSet?.(setId)}
              >
                <rect
                  className="tw-cell"
                  x={c.x}
                  y={c.y}
                  width={c.w}
                  height={c.h}
                  fill={
                    inFocus
                      ? "rgba(74,44,255,0.18)"
                      : isCopy
                        ? "rgba(74,44,255,0.08)"
                        : "rgba(20,19,17,0.06)"
                  }
                  stroke={
                    inFocus
                      ? "var(--accent-hot)"
                      : isCopy
                        ? "rgba(74,44,255,0.55)"
                        : "rgba(20,19,17,0.22)"
                  }
                  strokeWidth={inFocus ? 1.25 : 0.75}
                  opacity={dim ? 0.5 : 1}
                />
                {isCopy ? (
                  <rect
                    className={inFocus ? "tw-copy-active" : "tw-copy"}
                    x={c.x}
                    y={c.y}
                    width={c.w}
                    height={c.h}
                    fill="var(--accent)"
                    opacity={0.35}
                    filter="url(#tw-glow-soft)"
                    pointerEvents="none"
                    style={{ mixBlendMode: "multiply" }}
                  />
                ) : null}
                {showNames && c.w > 64 && c.h > 20 ? (
                  <text
                    x={c.x + 5}
                    y={c.y + 12}
                    fontSize={8.5}
                    fill={
                      isCopy ? "var(--accent)" : "rgba(20,19,17,0.5)"
                    }
                    pointerEvents="none"
                  >
                    {basename(c.path).slice(0, Math.floor((c.w - 8) / 5.3))}
                  </text>
                ) : null}
              </g>
            );
          })}

          {/* Arcs between copies of the focused set */}
          {arcs && "out" in arcs ? (
            <g pointerEvents="none">
              {arcs.out.map((a) => (
                <g key={a.key}>
                  <path
                    d={a.d}
                    fill="none"
                    stroke="var(--accent)"
                    strokeOpacity={0.2}
                    strokeWidth={5}
                    filter="url(#tw-glow)"
                    className="tw-arc"
                    style={{ ["--len" as string]: a.len }}
                  />
                  <path
                    d={a.d}
                    fill="none"
                    stroke="url(#tw-arc-grad)"
                    strokeWidth={1.4}
                    className="tw-arc"
                    style={{ ["--len" as string]: a.len }}
                  />
                  <path
                    d={a.d}
                    fill="none"
                    stroke="var(--accent-hot)"
                    strokeWidth={1.4}
                    strokeLinecap="round"
                    className="tw-arc-flow"
                    opacity={0.8}
                  />
                </g>
              ))}
              {arcs.pts.map((p, i) => (
                <g key={`pt-${i}`}>
                  <circle cx={p.x} cy={p.y} r={7} fill="var(--accent)" opacity={0.2} filter="url(#tw-glow)" />
                  <circle cx={p.x} cy={p.y} r={2.6} fill="var(--accent)" />
                </g>
              ))}
            </g>
          ) : null}

          {/* Kept: copies fly into one */}
          {event?.kind === "kept" && eventCells.length > 0 ? (
            <g key={event.key} pointerEvents="none">
              {eventCells.slice(1).map((c) => {
                const t = center(eventCells[0]!);
                const s = center(c);
                return (
                  <rect
                    key={`ghost-${c.path}`}
                    className="tw-ghost"
                    x={c.x}
                    y={c.y}
                    width={c.w}
                    height={c.h}
                    fill="var(--accent)"
                    style={{
                      ["--dx" as string]: `${t.x - s.x}px`,
                      ["--dy" as string]: `${t.y - s.y}px`,
                    }}
                  />
                );
              })}
              <rect
                x={eventCells[0]!.x}
                y={eventCells[0]!.y}
                width={eventCells[0]!.w}
                height={eventCells[0]!.h}
                fill="none"
                stroke="var(--green)"
                strokeWidth={2}
                className="tw-ring"
              />
              <rect
                x={eventCells[0]!.x}
                y={eventCells[0]!.y}
                width={eventCells[0]!.w}
                height={eventCells[0]!.h}
                fill="rgba(14,143,97,0.2)"
                stroke="var(--green)"
                strokeWidth={1.25}
                className="tw-fade-in"
              />
            </g>
          ) : null}

          {/* Refused: cells flash red */}
          {event?.kind === "refused" && eventCells.length > 0 ? (
            <g key={event.key} pointerEvents="none">
              {eventCells.map((c) => (
                <rect
                  key={`red-${c.path}`}
                  className="tw-flash"
                  x={c.x}
                  y={c.y}
                  width={c.w}
                  height={c.h}
                  fill="rgba(224,52,31,0.35)"
                  stroke="var(--red)"
                  strokeWidth={1.5}
                />
              ))}
            </g>
          ) : null}
        </svg>
      ) : null}

      {!quiet && focusSet && arcs && "pts" in arcs && !event
        ? arcs.pts.map((p, i) => (
            <div
              key={`copy-${focusSet.id}-${i}`}
              className="tw-mono tw-fade-in pointer-events-none absolute z-[5] flex size-[18px] items-center justify-center rounded-full text-[10px] font-bold"
              style={{
                left: p.x + 6 + (i % 2) * 2,
                top: p.y - 22 - (i % 2) * 4,
                background: "var(--accent)",
                color: "var(--accent-ink)",
                boxShadow: "0 0 0 2px var(--ink), 0 6px 18px -6px rgba(74,44,255,0.8)",
              }}
            >
              {i + 1}
            </div>
          ))
        : null}
      {event?.kind === "refused" && eventCenter ? (
        <div
          key={`stamp-${event.key}`}
          className="tw-stamp absolute whitespace-nowrap"
          style={{
            left: Math.min(Math.max(eventCenter.x, size.w < 520 ? 70 : 110), size.w - (size.w < 520 ? 70 : 110)),
            top: Math.min(Math.max(eventCenter.y, 40), size.h - 40),
            fontSize: size.w < 520 ? 22 : 34,
          }}
        >
          SAID NO
        </div>
      ) : null}
      {event?.kind === "kept" && eventCells[0] ? (
        <div
          key={`kept-${event.key}`}
          className="tw-kept-badge tw-mono pointer-events-none absolute whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-semibold tracking-[0.12em]"
          style={{
            left: Math.min(Math.max(center(eventCells[0]).x, 90), size.w - 90),
            top: Math.max(14, eventCells[0].y - 14),
            background: "rgba(255,255,255,0.94)", boxShadow: "0 8px 24px -10px rgba(20,19,17,0.35)",
            color: "var(--green)",
            border: "1px solid rgba(14,143,97,0.55)",
          }}
        >
          ONE COPY · APP STILL WORKS
        </div>
      ) : null}

      {tip ? <CellTip tip={tip} wrap={wrapRef.current} sets={liveSets} /> : null}
    </div>
  );
}

function CellTip({
  tip,
  wrap,
  sets,
}: {
  tip: { x: number; y: number; cell: Cell };
  wrap: HTMLDivElement | null;
  sets: TwinSet[];
}) {
  if (!wrap) return null;
  const box = wrap.getBoundingClientRect();
  const x = tip.x - box.left;
  const y = tip.y - box.top;
  const inSets = sets.filter((s) => s.members.some((m) => m.path === tip.cell.path));
  const flip = x > box.width - 260;
  return (
    <div
      className="tw-mono pointer-events-none absolute z-10 max-w-[260px] rounded-md px-2.5 py-2 text-[11px] leading-relaxed"
      style={{
        left: flip ? x - 14 : x + 14,
        top: Math.min(y + 14, box.height - 70),
        transform: flip ? "translateX(-100%)" : undefined,
        background: "rgba(255,255,255,0.96)",
        border: "1px solid var(--hair-2)", boxShadow: "0 8px 24px -10px rgba(20,19,17,0.3)",
        color: "var(--paper)",
      }}
    >
      <div className="break-all">{tip.cell.path}</div>
      <div style={{ color: "var(--paper-3)" }}>{tip.cell.lines} lines</div>
      {inSets.map((s) => (
        <div key={s.id} style={{ color: "var(--amber)" }}>
          {s.name} · {s.members.length} copies
        </div>
      ))}
    </div>
  );
}

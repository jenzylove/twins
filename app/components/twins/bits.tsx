import { useEffect, useRef, useState } from "react";

const fmt = new Intl.NumberFormat("en-US");
export const formatNumber = (n: number) => fmt.format(Math.round(n));

/** Number that ticks to its new value. */
export function AnimatedNumber({
  value,
  duration = 700,
  className,
}: {
  value: number;
  duration?: number;
  className?: string;
}) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    if (a === value) return;
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const e = 1 - Math.pow(1 - p, 3);
      setShown(a + (value - a) * e);
      if (p < 1) raf = requestAnimationFrame(step);
      else from.current = value;
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      from.current = value;
    };
  }, [value, duration]);
  return <span className={className}>{formatNumber(shown)}</span>;
}

export function callerLabel(caller: string): string {
  // Action callers: frontend, tool (built in agent), mcp[:client], cli, http...
  const c = caller.toLowerCase();
  if (c === "frontend" || c === "ui" || c === "you" || c.startsWith("mcp-widget")) return "you";
  if (c.includes("claude")) return "Claude Code";
  if (c.startsWith("mcp")) {
    const client = caller.slice(4).trim();
    return client || "an MCP agent";
  }
  if (c === "tool" || c === "agent" || c === "webmcp" || c === "a2a") return "agent";
  if (c === "cli") return "terminal";
  if (c === "automation") return "automation";
  if (c === "http") return "API";
  return caller;
}

export function timeAgo(at: string | number): string {
  const t = typeof at === "number" ? at : Date.parse(at);
  if (!Number.isFinite(t)) return "";
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}

export function TwinsMark({ className }: { className?: string }) {
  // Two offset frames: the copy and the one that stays.
  return (
    <svg viewBox="0 0 28 28" className={className} aria-hidden="true">
      <rect x="3.5" y="3.5" width="14" height="14" rx="1.5" fill="none" stroke="currentColor" strokeOpacity="0.35" />
      <rect x="10.5" y="10.5" width="14" height="14" rx="1.5" fill="var(--accent)" fillOpacity="0.14" stroke="var(--accent)" />
      <circle cx="10.5" cy="10.5" r="1.6" fill="var(--accent)" />
    </svg>
  );
}

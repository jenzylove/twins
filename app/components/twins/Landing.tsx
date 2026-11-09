import { IconArrowRight, IconArrowUpRight, IconCheck, IconCopy, IconPlus } from "@tabler/icons-react";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";

import { AnimatedNumber, TwinsMark } from "./bits";
import { BlueprintMap, type MapEvent } from "./BlueprintMap";
import { fixtureMap } from "./fixture";
import type { HeroPhase } from "./Hero3D";

const Hero3D = lazy(() => import("./Hero3D").then((m) => ({ default: m.Hero3D })));

const CONNECT = "npx @agent-native/core@latest connect https://twins.jdollar.site";
const REPO_URL = "https://github.com/jenzylove/twins";

/* ------------------------------- motion utils ------------------------------ */

/** Reveal `.rv` elements once, as they enter the viewport. */
function useReveal() {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>(".tw .rv"));
    if (!("IntersectionObserver" in window)) {
      els.forEach((e) => e.setAttribute("data-in", ""));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.setAttribute("data-in", "");
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.12 },
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);
}

/** 0 when the element's top reaches the bottom of the screen, 1 when its bottom passes the middle. */
function useScrollProgress<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [p, setP] = useState(0);
  useEffect(() => {
    let raf = 0;
    const read = () => {
      raf = 0;
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const total = r.height + vh * 0.5;
      setP(Math.min(1, Math.max(0, (vh - r.top) / total)));
    };
    const on = () => {
      if (!raf) raf = requestAnimationFrame(read);
    };
    read();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => {
      window.removeEventListener("scroll", on);
      window.removeEventListener("resize", on);
      cancelAnimationFrame(raf);
    };
  }, []);
  return { ref, p };
}

/* --------------------------------- hero ----------------------------------- */

const PHASE_LINE: Record<HeroPhase, { text: string; tone: string }> = {
  apart: { text: "formatDate, written twice in two files", tone: "var(--paper-3)" },
  joining: { text: "Merging into one shared file, then type checking", tone: "var(--accent)" },
  kept: { text: "Kept. Type check 0 errors, same as before", tone: "var(--green)" },
  refused: { text: "Said no. 2 new type errors, so it was undone", tone: "var(--red)" },
};

function Hero() {
  const [phase, setPhase] = useState<HeroPhase>("apart");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const line = PHASE_LINE[phase];
  return (
    <header className="relative px-4 pt-24 md:px-10 md:pt-28">
      <div className="mx-auto flex max-w-[1100px] flex-col items-center text-center">
        <p className="tw-hero-in tw-mono text-[11px] uppercase tracking-[0.16em] text-[var(--paper-3)]" style={{ animationDelay: "60ms" }}>
          For code your AI wrote more than once
        </p>
        <h1 className="tw-display tw-hero-in mt-5 text-[40px] sm:text-[68px] md:text-[84px]" style={{ animationDelay: "140ms" }}>
          Your AI wrote it twice.
          <br />
          Twins keeps <span className="tw-pill-word">one</span>.
        </h1>
        <p
          className="tw-hero-in mt-6 max-w-[600px] text-[17px] leading-relaxed text-[var(--paper-2)] md:text-[18px]"
          style={{ animationDelay: "240ms" }}
        >
          Paste a GitHub repo. Twins finds every place the same code was written
          again, merges the copies into one shared file, and keeps the merge only
          if your app still type checks.
        </p>
        <div className="tw-hero-in mt-8 flex flex-wrap justify-center gap-3" style={{ animationDelay: "320ms" }}>
          <Link to="/map" className="tw-btn tw-btn-primary h-12 px-6 text-[15px]">
            Map a repo
            <IconArrowRight className="size-4" strokeWidth={2} />
          </Link>
          <a href="#said-no" className="tw-btn tw-btn-ghost h-12 px-6 text-[15px]">
            See it say no
          </a>
        </div>
      </div>

      <div className="tw-hero-in relative mx-auto -mt-4 h-[360px] max-w-[1200px] sm:h-[460px] md:h-[520px]" style={{ animationDelay: "420ms" }}>
        <div className="tw-stage-glow" data-tone={phase} aria-hidden />
        {mounted ? (
          <Suspense fallback={null}>
            <Hero3D onPhase={setPhase} />
          </Suspense>
        ) : null}
      </div>
      <p className="tw-mono -mt-4 pb-4 text-center text-[12px] transition-colors duration-500 md:-mt-6" style={{ color: line.tone }} aria-live="polite">
        <span key={phase} className="tw-fade-in inline-block">
          {line.text}
        </span>
      </p>
    </header>
  );
}

/* ------------------------------ problem statement -------------------------- */

const PROBLEM =
  "AI coding tools copy instead of reuse. One app ends up with three ways to call the API and four ways to format a date. The copies drift, and a fix lands in only one of them.";

function Problem() {
  const { ref, p } = useScrollProgress<HTMLDivElement>();
  const words = useMemo(() => PROBLEM.split(" "), []);
  const lit = Math.round(p * 1.35 * words.length);
  return (
    <section className="px-4 py-32 md:px-10 md:py-48">
      <div ref={ref} className="mx-auto max-w-[1000px]">
        <p className="tw-kicker rv">The problem</p>
        <p className="tw-display mt-8 text-[34px] leading-[1.08] md:text-[60px]">
          {words.map((w, i) => (
            <span key={i} className="transition-colors duration-300" style={{ color: i < lit ? "var(--paper)" : "rgba(20,19,17,0.16)" }}>
              {w}{" "}
            </span>
          ))}
        </p>
      </div>
    </section>
  );
}

/* --------------------------------- map demo -------------------------------- */

function useMapDemo() {
  const sets = fixtureMap.sets;
  const [tick, setTick] = useState(0);
  const [merged, setMerged] = useState<Set<string>>(new Set());
  const [event, setEvent] = useState<MapEvent | null>(null);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 2200);
    return () => clearInterval(id);
  }, []);

  const live = sets.filter((s) => !merged.has(s.id));
  const active = live.length ? live[tick % live.length] : undefined;

  useEffect(() => {
    if (tick === 0 || tick % 3 !== 2 || !active) return;
    if (active.mergeable) {
      setEvent({ key: `k${tick}`, kind: "kept", set: active });
      const t = setTimeout(() => setMerged((m) => new Set(m).add(active.id)), 900);
      return () => clearTimeout(t);
    }
    setEvent({ key: `r${tick}`, kind: "refused", set: active });
  }, [tick, active]);

  useEffect(() => {
    if (!event) return;
    const t = setTimeout(() => setEvent(null), 2000);
    return () => clearTimeout(t);
  }, [event]);

  useEffect(() => {
    if (live.length === 0) {
      const t = setTimeout(() => setMerged(new Set()), 2400);
      return () => clearTimeout(t);
    }
  }, [live.length]);

  const dup = useMemo(
    () => sets.filter((s) => !merged.has(s.id)).reduce((n, s) => n + s.duplicateLines, 0),
    [sets, merged],
  );
  return { active, event, merged, dup };
}

function MapDemo() {
  const { active, event, merged, dup } = useMapDemo();
  return (
    <div>
      <div className="tw-grid-bg tw-fade-edges relative h-[340px] p-2 sm:h-[420px] md:h-[480px]">
        <BlueprintMap
          files={fixtureMap.files}
          sets={fixtureMap.sets}
          mergedSetIds={merged}
          activeSetId={active?.id ?? null}
          event={event}
          quiet
          minHeight={0}
        />
      </div>
      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-3 border-t border-[var(--hair)] pt-4">
        <p className="tw-mono text-[11px] text-[var(--paper-3)]">
          {active ? (
            <>
              <span className="text-[var(--accent)]">{active.name}</span> written {active.members.length} times
            </>
          ) : (
            <span className="text-[var(--green)]">every exact copy merged</span>
          )}
        </p>
        <p className="tw-mono text-[11px] text-[var(--paper-3)]">
          duplicate lines <AnimatedNumber value={dup} className="ml-1 text-[16px] text-[var(--paper)]" />
        </p>
      </div>
    </div>
  );
}

/* ------------------------------- how it works ------------------------------ */

const STEPS = [
  {
    t: "Paste a repo",
    d: "A public GitHub link to a TypeScript or JavaScript app, monorepos included. Twins reads every source file and records a baseline first: type errors, files checked, and whether the build passes.",
  },
  {
    t: "See the copies",
    d: "Folders become rooms and files become cells. Every function that was written more than once glows, with a line drawn between the copies, biggest first.",
  },
  {
    t: "Merge them",
    d: "One click moves an exact copy into one shared file and rewires every caller. Copies that differ in a few values go to the agent, which writes one shared version.",
  },
  {
    t: "Keep what builds",
    d: "The whole app is type checked again in a sealed sandbox. No new errors and the merge is kept. One new error and it is written back, with the exact lines shown.",
  },
  {
    t: "Ship the pull request",
    d: "Open one pull request on your repo, or on your fork, carrying every kept merge. Or take the patch and apply it with git.",
  },
];

function HowItWorks() {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    let raf = 0;
    const read = () => {
      raf = 0;
      const mid = window.innerHeight * 0.45;
      let best = 0;
      let bestD = Infinity;
      refs.current.forEach((el, i) => {
        if (!el) return;
        const r = el.getBoundingClientRect();
        const d = Math.abs(r.top + 30 - mid);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      });
      setActive(best);
    };
    const on = () => {
      if (!raf) raf = requestAnimationFrame(read);
    };
    read();
    window.addEventListener("scroll", on, { passive: true });
    return () => {
      window.removeEventListener("scroll", on);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <section id="how" className="px-4 py-24 md:px-10 md:py-36">
      <div className="mx-auto max-w-[1200px]">
        <p className="tw-kicker rv">How it works</p>
        <h2 className="tw-display rv mt-6 max-w-[780px] text-[40px] md:text-[68px]">
          From a messy repo to one pull request.
        </h2>

        <div className="mt-16 grid gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-20">
          <ol className="relative">
            <span className="absolute bottom-3 left-[7px] top-3 w-px bg-[var(--hair-2)]" aria-hidden />
            <span
              className="absolute left-[7px] top-3 w-px bg-[var(--accent)] transition-[height] duration-700 ease-out"
              style={{ height: `calc(${(active / (STEPS.length - 1)) * 100}% - 24px)` }}
              aria-hidden
            />
            {STEPS.map((s, i) => {
              const on = i === active;
              const done = i < active;
              return (
                <li
                  key={s.t}
                  ref={(el) => {
                    refs.current[i] = el;
                  }}
                  className="relative pb-14 pl-12 last:pb-0 md:pb-20"
                >
                  <span
                    className="absolute left-0 top-[14px] size-[15px] rounded-full border transition-all duration-500"
                    style={{
                      borderColor: on || done ? "var(--accent)" : "var(--hair-3)",
                      background: on ? "var(--accent)" : "var(--ink)",
                      boxShadow: on ? "0 0 0 6px var(--accent-dim)" : "none",
                    }}
                    aria-hidden
                  />
                  <button
                    type="button"
                    onClick={() => refs.current[i]?.scrollIntoView({ behavior: "smooth", block: "center" })}
                    className="block text-left"
                  >
                    <span className="tw-mono text-[11px] text-[var(--paper-3)]">{String(i + 1).padStart(2, "0")}</span>
                    <span
                      className="tw-display mt-1 block text-[32px] transition-colors duration-500 md:text-[44px]"
                      style={{ color: on ? "var(--paper)" : "rgba(20,19,17,0.24)" }}
                    >
                      {s.t}
                    </span>
                  </button>
                  <div className="tw-open" data-open={on ? "" : undefined}>
                    <div>
                      <p className="max-w-[460px] pt-4 text-[16px] leading-relaxed text-[var(--paper-2)]">{s.d}</p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
          <div className="lg:sticky lg:top-28 lg:self-start">
            <MapDemo />
          </div>
        </div>
      </div>
    </section>
  );
}

/* --------------------------------- said no --------------------------------- */

function SaidNo() {
  return (
    <section id="said-no" className="bg-[var(--paper)] px-4 py-28 text-[var(--ink)] md:px-10 md:py-40">
      <div className="mx-auto max-w-[1200px]">
        <p className="tw-kicker rv" style={{ color: "rgba(242,241,237,0.5)" }}>
          The check
        </p>
        <h2 className="tw-display rv mt-6 text-[44px] md:text-[88px]">
          Claude Code said done.
          <br />
          <span className="text-[#ff5a3d]">Twins said no.</span>
        </h2>

        <div className="mt-16 grid gap-12 md:grid-cols-2 md:gap-0">
          <div className="rv md:border-r md:border-[rgba(242,241,237,0.14)] md:pr-12">
            <p className="tw-mono text-[11px] uppercase tracking-[0.14em] text-[rgba(242,241,237,0.45)]">In the terminal</p>
            <pre className="tw-code mt-6 whitespace-pre-wrap text-[13px] leading-[1.9] text-[rgba(242,241,237,0.7)]">
              <span className="text-[#9d8cff]">&gt; </span>
              <span className="text-[var(--ink)]">merge every copy of createSupabaseFetch</span>
              {"\n\n"}● twins · compare-twins{"\n"}● twins · read-repo-file{"\n"}● twins · merge-twins, 3 files
              {"\n\n"}
              <span className="text-[var(--ink)]">Done. The three clients now share one helper.</span>
            </pre>
          </div>
          <div className="rv relative md:pl-12" style={{ transitionDelay: "450ms" }}>
            <p className="tw-mono text-[11px] uppercase tracking-[0.14em] text-[rgba(242,241,237,0.45)]">On the map, the same second</p>
            <p className="tw-mono mt-6 text-[12px] font-semibold tracking-[0.12em] text-[#ff5a3d]">SAID NO · UNDONE AUTOMATICALLY</p>
            <ul className="tw-code mt-4 space-y-3 text-[12.5px] text-[rgba(242,241,237,0.7)]">
              <li>
                <span className="text-[#ff8a73]">src/integrations/supabase/client.server.ts:31</span>
                <br />
                TS2554 Expected 2 arguments, but got 1.
              </li>
              <li>
                <span className="text-[#ff8a73]">src/integrations/supabase/auth-middleware.ts:40</span>
                <br />
                TS2345 Argument of type 'string | undefined' is not assignable to parameter of type 'string'.
              </li>
            </ul>
            <div className="tw-said-stamp" aria-hidden>
              SAID NO
            </div>
          </div>
        </div>

        <p className="rv mt-16 max-w-[640px] text-[17px] leading-relaxed text-[rgba(242,241,237,0.66)]">
          The check runs inside the merge action, not in the page. You, the built
          in agent and Claude Code over MCP all call that same action, so a merge
          that adds one type error, or breaks a build that passed, is written back
          before anyone sees it.
        </p>
      </div>
    </section>
  );
}

/* --------------------------------- agents ---------------------------------- */

function CopyCommand({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-4 border-b border-[var(--hair-3)] pb-4">
      <code className="tw-mono min-w-0 flex-1 overflow-x-auto whitespace-nowrap text-[13px] text-[var(--paper)] md:text-[15px]">
        <span className="select-none text-[var(--accent)]">$ </span>
        {text}
      </code>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard?.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1400);
          });
        }}
        className="tw-btn tw-btn-ghost h-10 shrink-0 px-4"
        aria-label="Copy command"
      >
        {copied ? <IconCheck className="size-4 text-[var(--green)]" /> : <IconCopy className="size-4" />}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

const PROMPTS = [
  "find the copies in github.com/owner/repo",
  "merge every exact copy, biggest first",
  "write one shared version of formatDate",
  "open a pull request with the kept merges",
];

function Agents() {
  return (
    <section id="agents" className="px-4 py-28 md:px-10 md:py-40">
      <div className="mx-auto max-w-[900px] text-center">
        <p className="tw-kicker rv">From your agent</p>
        <h2 className="tw-display rv mt-6 text-[40px] md:text-[72px]">
          Ask Claude Code. <br className="hidden md:block" />
          Twins does the checking.
        </h2>
        <p className="rv mx-auto mt-7 max-w-[600px] text-[17px] leading-relaxed text-[var(--paper-2)]">
          Connect once and your coding agent gets the same tools as this page:
          import, compare, read, merge, undo, export and open a pull request. The
          map you have open moves live while it works.
        </p>
        <div className="rv mx-auto mt-12 max-w-[760px] text-left">
          <CopyCommand text={CONNECT} />
        </div>
        <ul className="mx-auto mt-12 max-w-[760px] text-left">
          {PROMPTS.map((p, i) => (
            <li
              key={p}
              className="rv tw-mono flex items-baseline gap-4 border-b border-[var(--hair)] py-4 text-[13px] text-[var(--paper-2)] md:text-[14px]"
              style={{ transitionDelay: `${i * 140}ms` }}
            >
              <span className="text-[var(--accent)]">&gt;</span>
              {p}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ----------------------------------- faq ----------------------------------- */

const FAQ = [
  {
    q: "What counts as a copy?",
    a: "Two functions with the same structure once names and values are set aside. Exact copies share the same code and imports and merge in one click. Near copies have the same shape with small differences, and the agent writes one shared version for those.",
  },
  {
    q: "Does my code run on your server?",
    a: "No. The server only downloads the source and reads it. Installs, type checks and builds run in an isolated sandbox with install scripts turned off, and the network is cut before the build runs.",
  },
  {
    q: "What does said no mean?",
    a: "After a merge Twins type checks the whole app again. If there is even one error that was not in the baseline, or a build that passed now fails, the merge is written back and recorded as said no, with the exact errors.",
  },
  {
    q: "Can Claude Code get around the check?",
    a: "No. The check lives inside the merge action itself. The page, the built in agent and Claude Code over MCP all call that same action, so the same rule applies to each of them.",
  },
  {
    q: "Which repos work?",
    a: "Public TypeScript and JavaScript repos up to 200 MB, including monorepos where each package has its own tsconfig. Twins merges only where it can type check the code. Private repos are not supported yet.",
  },
  {
    q: "What do I get at the end?",
    a: "A pull request on your repo, or on your fork if the repo is not yours, or a patch you can apply with git. Each merge is listed with what moved and how many lines went away.",
  },
];

function Faq() {
  const [open, setOpen] = useState(0);
  return (
    <section id="faq" className="px-4 py-24 md:px-10 md:py-36">
      <div className="mx-auto grid max-w-[1200px] gap-12 lg:grid-cols-[360px_1fr]">
        <div>
          <p className="tw-kicker rv">Questions</p>
          <h2 className="tw-display rv mt-6 text-[40px] md:text-[56px]">Before you paste a repo.</h2>
        </div>
        <div className="border-b border-[var(--hair-2)]">
          {FAQ.map((f, i) => {
            const on = open === i;
            return (
              <div key={f.q} className="rv border-t border-[var(--hair-2)]" style={{ transitionDelay: `${i * 70}ms` }}>
                <button
                  type="button"
                  onClick={() => setOpen(on ? -1 : i)}
                  aria-expanded={on}
                  className="flex w-full items-center justify-between gap-6 py-6 text-left"
                >
                  <span className="tw-display text-[22px] md:text-[28px]" style={{ letterSpacing: "-0.02em" }}>
                    {f.q}
                  </span>
                  <IconPlus
                    className="size-5 shrink-0 transition-transform duration-300"
                    style={{ transform: on ? "rotate(45deg)" : "none", color: on ? "var(--accent)" : "var(--paper-3)" }}
                  />
                </button>
                <div className="tw-open" data-open={on ? "" : undefined}>
                  <div>
                    <p className="max-w-[640px] pb-7 text-[16px] leading-relaxed text-[var(--paper-2)]">{f.a}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* --------------------------------- landing --------------------------------- */

export function Landing() {
  useReveal();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  return (
    <div className="tw min-h-screen overflow-x-hidden">
      <nav className="fixed inset-x-0 top-4 z-30 flex justify-center px-4">
        <div className="tw-nav flex h-12 w-full max-w-[720px] items-center justify-between rounded-full pl-4 pr-1.5" data-scrolled={scrolled ? "" : undefined}>
          <Link to="/" className="flex items-center gap-2">
            <TwinsMark className="size-6 text-[var(--paper)]" />
            <span className="tw-display text-[20px]" style={{ letterSpacing: "-0.03em" }}>
              Twins
            </span>
          </Link>
          <div className="flex items-center gap-1">
            <a href="#how" className="hidden rounded-full px-3 py-2 text-[13.5px] text-[var(--paper-2)] hover:text-[var(--paper)] sm:inline">
              How it works
            </a>
            <a href="#agents" className="hidden rounded-full px-3 py-2 text-[13.5px] text-[var(--paper-2)] hover:text-[var(--paper)] sm:inline">
              Agents
            </a>
            <a href="#faq" className="hidden rounded-full px-3 py-2 text-[13.5px] text-[var(--paper-2)] hover:text-[var(--paper)] md:inline">
              Questions
            </a>
            <Link to="/map" className="tw-btn tw-btn-primary ml-1 h-9 px-4">
              Map a repo
            </Link>
          </div>
        </div>
      </nav>

      <Hero />
      <Problem />
      <HowItWorks />
      <SaidNo />
      <Agents />
      <Faq />

      {/* closing */}
      <section className="px-4 pb-24 pt-20 md:px-10 md:pb-32 md:pt-28">
        <div className="mx-auto flex max-w-[1200px] flex-col items-center text-center">
          <h2 className="tw-display rv text-[52px] md:text-[104px]">
            One copy is <span className="tw-pill-word">enough</span>.
          </h2>
          <p className="rv mt-6 max-w-[480px] text-[17px] text-[var(--paper-2)]">
            Free for public repos. Your first map takes about a minute.
          </p>
          <Link to="/map" className="rv tw-btn tw-btn-primary mt-9 h-12 px-6 text-[15px]">
            Map a repo
            <IconArrowRight className="size-4" strokeWidth={2} />
          </Link>
        </div>
      </section>

      <footer className="border-t border-[var(--hair-2)] px-4 pb-10 pt-14 md:px-10">
        <div className="mx-auto grid max-w-[1200px] gap-12 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2">
              <TwinsMark className="size-6 text-[var(--paper)]" />
              <span className="tw-display text-[22px]" style={{ letterSpacing: "-0.03em" }}>
                Twins
              </span>
            </div>
            <p className="mt-4 max-w-[320px] text-[14.5px] leading-relaxed text-[var(--paper-2)]">
              Finds the code your AI wrote twice and keeps one copy, only when your
              app still type checks.
            </p>
          </div>
          <div>
            <p className="tw-kicker">Product</p>
            <ul className="mt-4 space-y-2.5 text-[14.5px] text-[var(--paper-2)]">
              <li><Link to="/map" className="hover:text-[var(--paper)]">Map a repo</Link></li>
              <li><a href="#how" className="hover:text-[var(--paper)]">How it works</a></li>
              <li><a href="#faq" className="hover:text-[var(--paper)]">Questions</a></li>
            </ul>
          </div>
          <div>
            <p className="tw-kicker">Build</p>
            <ul className="mt-4 space-y-2.5 text-[14.5px] text-[var(--paper-2)]">
              <li><a href="#agents" className="hover:text-[var(--paper)]">Connect Claude Code</a></li>
              <li>
                <a href={REPO_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-[var(--paper)]">
                  Source on GitHub <IconArrowUpRight className="size-3.5" />
                </a>
              </li>
              <li>
                <a href="https://github.com/BuilderIO/agent-native" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-[var(--paper)]">
                  Built on Agent Native <IconArrowUpRight className="size-3.5" />
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="mx-auto mt-14 flex max-w-[1200px] flex-col gap-2 border-t border-[var(--hair)] pt-6 text-[12.5px] text-[var(--paper-3)] sm:flex-row sm:justify-between">
          <span>Twins, 2026</span>
          <span>Your code is read, never run on our server.</span>
        </div>
      </footer>
    </div>
  );
}

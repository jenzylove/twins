import { IconArrowRight, IconBrandGithub, IconCheck, IconCopy } from "@tabler/icons-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";

import { AnimatedNumber, TwinsMark } from "./bits";
import { BlueprintMap, type MapEvent } from "./BlueprintMap";
import { fixtureMap } from "./fixture";

const CONNECT = "npx @agent-native/core@latest connect https://twins.jdollar.site";
const REPO_URL = "https://github.com/jenzylove/twins";

/* ------------------------------ hero map demo ----------------------------- */

function useHeroDemo() {
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
    // Every few beats: merge the exact set in focus, or refuse a near one.
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

function HeroMap() {
  const { active, event, merged, dup } = useHeroDemo();
  return (
    <div className="relative">
      <div className="tw-grid-bg relative h-[340px] overflow-hidden border border-[var(--hair-2)] p-3 sm:h-[460px] md:h-[540px] md:p-5">
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
      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-3">
        <p className="tw-mono text-[11.5px] text-[var(--paper-3)]">
          {fixtureMap.repo.owner}/{fixtureMap.repo.name} · {fixtureMap.files.length} files ·{" "}
          {active ? (
            <span className="text-[var(--amber)]">
              {active.name} × {active.members.length}
            </span>
          ) : (
            <span className="text-[var(--green)]">all merged</span>
          )}
        </p>
        <p className="tw-mono text-[11.5px] text-[var(--paper-3)]">
          duplicate lines{" "}
          <AnimatedNumber value={dup} className="text-[17px] text-[var(--amber)]" />
        </p>
      </div>
    </div>
  );
}

/* --------------------------------- pieces --------------------------------- */

function Section({
  n,
  title,
  id,
  children,
}: {
  n: string;
  title: string;
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="border-t border-[var(--hair)] px-5 py-20 md:px-14 md:py-28">
      <div className="mx-auto grid max-w-[1240px] gap-10 md:grid-cols-[180px_1fr]">
        <div className="flex items-baseline gap-3 md:block">
          <p className="tw-mono text-[12px] text-[var(--amber)]">{n}</p>
          <p className="tw-label md:mt-2">{title}</p>
        </div>
        <div className="min-w-0">{children}</div>
      </div>
    </section>
  );
}

function CopyCommand({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-stretch overflow-hidden border border-[var(--hair-2)] bg-[var(--ink-2)]">
      <code className="tw-mono flex-1 overflow-x-auto whitespace-nowrap px-4 py-4 text-[13px] text-[var(--paper)] md:text-[14px]">
        <span className="select-none text-[var(--amber)]">$ </span>
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
        className="flex w-14 shrink-0 items-center justify-center border-l border-[var(--hair-2)] text-[var(--paper-2)] hover:bg-[rgba(143,216,255,0.06)] hover:text-[var(--paper)]"
        aria-label="Copy command"
      >
        {copied ? <IconCheck className="size-4 text-[var(--green)]" /> : <IconCopy className="size-4" />}
      </button>
    </div>
  );
}

const STEPS = [
  {
    t: "Paste",
    d: "Any public GitHub link. Twins reads every TypeScript and JavaScript file and records a baseline: type errors, files checked, build.",
  },
  {
    t: "See",
    d: "Folders become rooms and files become cells. Every place the same code was written twice glows, with light drawn between the copies.",
  },
  {
    t: "Merge",
    d: "One click moves the code into one shared file and rewires every caller. Near copies go to the agent, which writes one shared version.",
  },
  {
    t: "Pull request",
    d: "Every kept merge is checked against the baseline. Take the patch, or open a pull request with one commit per merge.",
  },
];

const FAQ = [
  {
    q: "What counts as a copy?",
    a: "Two functions with the same structure after names and values are set aside. Exact copies have the same code and the same imports. Near copies have the same shape with small differences, and the agent handles those.",
  },
  {
    q: "Does my code run on your server?",
    a: "No. The server only downloads the source and parses it. Installs, type checks and builds run inside an isolated sandbox with the network cut off after install.",
  },
  {
    q: "What does said no mean?",
    a: "After a merge Twins type checks the whole app again. If there is even one error that was not in the baseline, or the build broke, the merge is written back to how it was and recorded as said no, with the exact errors.",
  },
  {
    q: "Can Claude Code get around the check?",
    a: "No. The check lives inside the merge action itself. The page, the built in agent and Claude Code over MCP all call that same action, so the same rule applies to each of them.",
  },
  {
    q: "Which repos work?",
    a: "Public TypeScript and JavaScript repos up to about 300 source files, with one tsconfig. Private repos and monorepos with many projects are not supported yet.",
  },
  {
    q: "What do I get at the end?",
    a: "A patch you can apply with git, and soon a pull request on your repo. Each merge is listed with what moved and the lines removed.",
  },
];

/* --------------------------------- landing -------------------------------- */

export function Landing() {
  return (
    <div className="tw min-h-screen overflow-x-hidden">
      <nav className="sticky top-0 z-20 border-b border-[var(--hair)] bg-[rgba(6,10,20,0.82)] backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[1240px] items-center justify-between px-5 md:px-14 md:max-w-none">
          <Link to="/" className="flex items-center gap-2.5">
            <TwinsMark className="size-6 text-[var(--paper)]" />
            <span className="tw-display text-[24px]">Twins</span>
          </Link>
          <div className="flex items-center gap-1 md:gap-6">
            <a href="#how" className="hidden text-[13px] text-[var(--paper-2)] hover:text-[var(--paper)] md:inline">
              How it works
            </a>
            <a href="#agents" className="hidden text-[13px] text-[var(--paper-2)] hover:text-[var(--paper)] md:inline">
              Agents
            </a>
            <a href="#faq" className="hidden text-[13px] text-[var(--paper-2)] hover:text-[var(--paper)] md:inline">
              FAQ
            </a>
            <Link to="/map" className="tw-btn tw-btn-primary h-9 px-4">
              Map a repo
            </Link>
          </div>
        </div>
      </nav>

      {/* 01 hero */}
      <header className="px-5 pb-16 pt-12 md:px-14 md:pb-24 md:pt-14">
        <div className="mx-auto max-w-[1240px]">
          <p className="tw-mono text-[12px] text-[var(--amber)]">
            01 <span className="tw-label ml-2">Copies, found and merged</span>
          </p>
          <h1 className="tw-display mt-6 text-[52px] sm:text-[80px] md:text-[108px]">
            Your AI wrote it twice.
            <br />
            <em className="text-[var(--amber)]">Twins keeps the one that builds.</em>
          </h1>
          <div className="mt-10 flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
            <p className="max-w-xl text-[17px] leading-relaxed text-[var(--paper-2)] md:text-[19px]">
              Paste a GitHub repo. See every place your AI wrote the same code
              again, glowing on a map of your project. Merge the copies into one,
              and keep the merge only if your app still type checks.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to="/map" className="tw-btn tw-btn-primary h-12 px-6 text-[15px]">
                Map a repo
                <IconArrowRight className="size-4" strokeWidth={2} />
              </Link>
              <a href="#how" className="tw-btn tw-btn-ghost h-12 px-6 text-[15px]">
                How it works
              </a>
            </div>
          </div>
          <div className="mt-14">
            <HeroMap />
          </div>
        </div>
      </header>

      {/* 02 problem */}
      <Section n="02" title="The problem">
        <p className="tw-display text-[38px] md:text-[64px]">
          AI coding tools copy instead of reuse.{" "}
          <span className="text-[var(--paper-3)]">
            The copies drift, and bugs get fixed in one place only.
          </span>
        </p>
        <p className="mt-8 max-w-2xl text-[16px] leading-relaxed text-[var(--paper-2)]">
          The agent cannot see the whole project at once, so it writes the same
          helper again. One app ends up with three ways to call the API and four
          ways to format a date, each slightly different, and nobody notices
          until a fix lands in one of them.
        </p>
      </Section>

      {/* 03 how */}
      <Section n="03" title="How it works" id="how">
        <ol className="grid gap-0 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li
              key={s.t}
              className="border-t border-[var(--hair-2)] py-6 pr-6 sm:[&:nth-child(n+3)]:border-t lg:border-l lg:border-t-0 lg:py-2 lg:pl-6 lg:first:border-l-0 lg:first:pl-0"
            >
              <p className="tw-mono text-[11px] text-[var(--paper-3)]">{String(i + 1).padStart(2, "0")}</p>
              <h3 className="tw-display mt-3 text-[40px]">{s.t}</h3>
              <p className="mt-3 text-[14.5px] leading-relaxed text-[var(--paper-2)]">{s.d}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* 04 said no */}
      <Section n="04" title="Twins said no">
        <h2 className="tw-display text-[44px] md:text-[76px]">
          Claude Code said done.
          <br />
          <span className="text-[var(--red)]">Twins said no.</span>
        </h2>
        <div className="mt-12 grid gap-px border border-[var(--hair-2)] bg-[var(--hair-2)] lg:grid-cols-2">
          <div className="bg-[var(--ink-2)] p-5 md:p-7">
            <p className="tw-label">Terminal · Claude Code</p>
            <pre className="tw-code mt-4 whitespace-pre-wrap text-[12.5px] text-[var(--paper-2)]">
              <span className="text-[var(--amber)]">&gt; </span>
              <span className="text-[var(--paper)]">merge every copy of createSupabaseFetch</span>
              {"\n\n"}
              <span className="text-[var(--paper-3)]">● twins · compare-twins</span>
              {"\n"}
              <span className="text-[var(--paper-3)]">● twins · merge-twins  edits: 3 files</span>
              {"\n\n"}
              <span className="text-[var(--paper)]">Done. The three clients now share one helper.</span>
            </pre>
          </div>
          <div className="relative overflow-hidden bg-[var(--ink-2)] p-5 md:p-7">
            <p className="tw-label">The map, same second</p>
            <div className="mt-4 border-l-2 border-[var(--red)] pl-4">
              <p className="tw-mono text-[12px] font-bold tracking-[0.12em] text-[var(--red)]">SAID NO · UNDONE AUTOMATICALLY</p>
              <ul className="tw-mono mt-3 space-y-1.5 text-[12px] text-[var(--paper-2)]">
                <li>
                  <span className="text-[var(--red)]">src/integrations/supabase/client.server.ts:31</span>{" "}
                  <span className="text-[var(--paper-3)]">TS2554</span> Expected 2 arguments, but got 1.
                </li>
                <li>
                  <span className="text-[var(--red)]">src/integrations/supabase/auth-middleware.ts:40</span>{" "}
                  <span className="text-[var(--paper-3)]">TS2345</span> Argument of type 'string | undefined' is not assignable to parameter of type 'string'.
                </li>
              </ul>
            </div>
            <div
              className="tw-mono absolute right-6 top-6 rotate-[-9deg] rounded-md border-[3px] border-[var(--red)] px-3 py-1 text-[22px] font-extrabold tracking-[0.08em] text-[var(--red)] md:text-[28px]"
              style={{ boxShadow: "0 0 40px rgba(255,90,82,0.3)" }}
              aria-hidden
            >
              SAID NO
            </div>
          </div>
        </div>
        <p className="mt-8 max-w-2xl text-[16px] leading-relaxed text-[var(--paper-2)]">
          The check runs inside the merge action, not in the page. So it holds for
          you, for the built in agent, and for Claude Code over MCP. A merge that
          adds a single type error, or breaks a build that passed, is written back
          before anyone sees it.
        </p>
      </Section>

      {/* 05 agents */}
      <Section n="05" title="From your agent" id="agents">
        <h2 className="tw-display text-[40px] md:text-[64px]">
          Use it from Claude Code.
        </h2>
        <p className="mt-6 max-w-2xl text-[16px] leading-relaxed text-[var(--paper-2)]">
          Connect once and your coding agent gets the same tools as this page:
          import a repo, read the map, compare copies, merge, undo and export. The
          map you have open updates live while it works.
        </p>
        <div className="mt-8 max-w-3xl">
          <CopyCommand text={CONNECT} />
        </div>
        <ul className="tw-mono mt-8 grid max-w-3xl gap-px text-[13px] text-[var(--paper-2)] sm:grid-cols-2">
          {[
            "find the copies in github.com/owner/repo",
            "merge every exact copy, biggest first",
            "write one shared version of formatDate",
            "export the patch",
          ].map((p) => (
            <li key={p} className="border-l border-[var(--hair-2)] py-2 pl-4">
              <span className="text-[var(--amber)]">&gt; </span>
              {p}
            </li>
          ))}
        </ul>
      </Section>

      {/* 06 faq */}
      <Section n="06" title="Questions" id="faq">
        <div className="border-b border-[var(--hair)]">
          {FAQ.map((f) => (
            <details key={f.q} className="group border-t border-[var(--hair)]">
              <summary className="flex items-center justify-between gap-6 py-5">
                <span className="tw-display text-[24px] md:text-[30px]">{f.q}</span>
                <span className="tw-mono text-[18px] text-[var(--amber)] transition-transform duration-150 group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="max-w-3xl pb-6 text-[15px] leading-relaxed text-[var(--paper-2)]">{f.a}</p>
            </details>
          ))}
        </div>
      </Section>

      {/* final CTA + footer */}
      <section className="border-t border-[var(--hair)] px-5 py-24 md:px-14">
        <div className="mx-auto flex max-w-[1240px] flex-col items-start gap-8 md:flex-row md:items-end md:justify-between">
          <h2 className="tw-display text-[48px] md:text-[88px]">
            One copy is <em className="text-[var(--amber)]">enough.</em>
          </h2>
          <Link to="/map" className="tw-btn tw-btn-primary h-12 px-6 text-[15px]">
            Map a repo
            <IconArrowRight className="size-4" strokeWidth={2} />
          </Link>
        </div>
      </section>
      <footer className="border-t border-[var(--hair)] px-5 py-8 md:px-14">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-4 text-[12.5px] text-[var(--paper-3)] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <TwinsMark className="size-5 text-[var(--paper-2)]" />
            <span>Twins. Built on Agent Native.</span>
          </div>
          <div className="flex items-center gap-5">
            <Link to="/map" className="hover:text-[var(--paper)]">
              Map a repo
            </Link>
            <a href={REPO_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:text-[var(--paper)]">
              <IconBrandGithub className="size-4" />
              Source
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

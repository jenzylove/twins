# Twins build plan

> Planning document written on Nov 5 2026, before the build. Kept as a record. What actually shipped is in the [README](../README.md) and [ENGINE_SPEC.md](ENGINE_SPEC.md).


Today is Thu Nov 5 2026. Deadline Mon Nov 9, 11:59 PM PT (Tue Nov 10, 08:59 Lagos). Target: submitted Mon Nov 9 evening Lagos, with margin.

## Stack

- Agent-Native framework (`npx @agent-native/core@latest create twins --standalone`), React UI, Node 22.22+.
- Postgres on Neon (`DATABASE_URL`). Local dev on the framework's local database.
- Code engine: ts-morph for reading, fingerprinting, moving and rewiring. jscpd as the independent answer key. `tsc --noEmit`, the repo's test and build scripts for the check.
- Isolated workspaces: shallow `git clone` plus dependency install into a per-session folder on the server.
- Hosting: Docker on Railway (Node preset); cloning, installing and building need a real container. Domain twins.jdollar.site.
- AI: Anthropic Claude for near-copy confirmation and the shared version.
- GitHub OAuth for fork, push and pull request.
- Canvas: blueprint map in React (SVG), own bold design.

## Phases

Each phase ends with a check that proves it is done.

### Phase 0. Spikes (Thu Nov 5 night)

Time boxed, against the real thing, written up in docs/spikes/.

1. **Framework.** Scaffold, one action, called from the UI, the in-app agent and Claude Code over MCP, with live sync. Check: a Claude Code call changes the open page with no refresh.
2. **Engine.** Clone a real public AI-built repo, install, record the baseline, find exact copies with fingerprints, merge one set with callers rewired, then the check passes. Check: under 60 s for clone + install + baseline on a ~200 file repo, under 15 s per merge check.
3. **Host.** The same engine runs in a Railway container (git, package manager, tsc, enough memory and disk). Check: a deployed endpoint returns the copy sets for a public repo URL.
4. **MCP App.** The map route renders inline in Claude. Check: screenshot inside Claude.

If any spike fails, stop and bring a changed plan to the user before building.

### Phase 1. Engine, pure and tested (Fri Nov 6)

- `buildMap`, `findTwins` (fingerprints + similarity candidates), `mergeTwins` (shared version in, deterministic rewiring), `runCheck` vs baseline with automatic undo, `metrics`.
- Check: unit tests on fixture repos pass, including a merge that breaks the build and must undo.

### Phase 2. Actions and agent (Fri Nov 6)

- All actions as defineAction, workspace state in SQL, change log with caller identity.
- In-app agent instructions; selection context for "merge these".
- Near-copy confirmation by the AI with a reason.
- Check: the same merge works from the UI, the agent chat and the CLI, all in the change log.

### Phase 3. The map UI (Sat Nov 7)

- Import screen, blueprint map, copy sets pulsing, side-by-side compare with editable shared version, set states, change log, undo, live updates from any caller.
- Design within the phase: own bold direction, dark and light rendered in a headless browser.
- Check: merge a real set on a real repo and watch it turn green; break one and watch it turn red and undo.

### Phase 4. Outside callers (Sat Nov 7)

- MCP for Claude Code and Cursor with a one line connect instruction on the site.
- MCP App inline map in Claude and ChatGPT.
- Check: recorded Claude Code merge that lights up the open map, and one that gets refused.

### Phase 5. Pull request (Sun Nov 8)

- GitHub OAuth, fork, one commit per merge, PR with a full list. Patch download without sign in.
- Check: a real PR link on a real fork.

### Phase 6. Deploy and prove (Sun Nov 8)

- Deploy to Railway at twins.jdollar.site.
- Proof runs: 5 real public AI-built repos plus a fork of BuilderIO/agent-native. Compare with jscpd and a hand-checked set. Publish found, merged, kept, undone, missed on a proof page and in docs/BUILD_LOG.md.
- "Try a real messy AI-built app" button pointing at one of those repos.

### Phase 7. Audit (Sun Nov 8 night)

- release-readiness-audit on the repo and the live app. Fix every real finding and prove each fix. Secrets scan of the full history before going public.

### Gate: user approval of the live app (Mon Nov 9 morning Lagos)

### Phase 8. Launch (Mon Nov 9)

- README: hero, judge fast path, what is real, pre-existing work disclosure, proof numbers.
- Public Clips demo, about 90 seconds: messy repo, glowing copies, merge, Claude Code merge refused on screen, real PR.
- Submit the form, confirm receipt, launch post.

## Risks and unknowns

| Risk | Status |
|---|---|
| Agent-Native scaffold, MCP and live sync behave as documented | needs a spike (0.1) |
| Clone + install + baseline fast enough for the judge's minute | needs a spike (0.2). Fallback: map and copies appear first from the clone alone; install and baseline run in the background before the first merge |
| Railway container can install and build within memory, disk and time | needs a spike (0.3) |
| MCP App renders in Claude and ChatGPT | needs a spike (0.4) |
| Repo already fails to build | known: the check compares against the baseline ("no new errors"), and the UI says the repo started broken |
| Near-copy merges change behaviour | known: shared version shown as a diff and needs approval; tests run if present |
| Abuse: huge repos, many clones, malicious install scripts | known: file cap, rate limit, installs with scripts disabled, workspace cleanup job, no secrets in the container |
| GitHub OAuth scopes | known: `public_repo` |

## Keys and access needed from the user (one message)

1. Anthropic API key, or confirm the Builder.io gateway.
2. Neon Postgres connection string, or permission to create it.
3. Railway: permission to create the service and set env vars.
4. GitHub OAuth app for twins.jdollar.site (steps in chat).
5. DNS: CNAME for twins.jdollar.site.

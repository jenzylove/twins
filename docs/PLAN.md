# Floorplan build plan

Today is Thu Nov 5 2026. Deadline Mon Nov 9, 11:59 PM PT (Tue Nov 10, 08:59 Lagos). Target: submitted by Mon Nov 9 evening Lagos, with a day of margin.

## Stack

- Agent-Native framework (`npx @agent-native/core@latest create floorplan --standalone`), React UI, Node 22.22+.
- Postgres on Neon (`DATABASE_URL`). Local dev on the framework's local database.
- Code engine: ts-morph (TypeScript compiler API) for reading, moving and renaming. `tsc --noEmit` for the build gate.
- Isolated workspaces: shallow `git clone` into a per-session temp folder on the server.
- Hosting: Docker on Railway (Node preset), because cloning and running the type check need a real container. Domain floorplan.jdollar.site.
- AI: Anthropic Claude for the tidy plan and for merging duplicates.
- GitHub OAuth for fork, push and pull request.
- Canvas: React with SVG or a canvas library, blueprint design.

## Phases

Each phase ends with a check that proves it is done.

### Phase 0. Spikes (Thu Nov 5, evening)

Each spike is time boxed, run against the real thing, and written up in docs/spikes/.

1. **Framework.** Scaffold an app, one action, called from the UI, the agent and Claude Code over MCP, with live sync. Check: a Claude Code call changes the open browser page with no refresh.
2. **Engine.** Clone a real public repo, build the map with ts-morph, move one file and rewrite imports, then `tsc --noEmit` passes. Check: the move runs in under 10 s on a ~200 file repo.
3. **Host.** The same engine runs inside a Railway container (git and tsc available, enough memory). Check: a deployed endpoint returns a map for a public repo URL.
4. **MCP App.** The map route renders inline in Claude. Check: screenshot of it inside Claude.

If any spike fails, stop and bring a changed plan to the user before building.

### Phase 1. Core engine, pure and tested (Fri Nov 6)

- `buildMap(repoDir)` gives rooms, blocks, threads and twins.
- `moveFile`, `renameSymbol`, `extractModule`, `mergeTwins` (the merge body is written by the AI, the rewiring is deterministic).
- Build gate with automatic revert.
- Metrics: before vs after diff.
- Check: unit tests on fixture repos pass, including a move that would break the build and must revert.

### Phase 2. Actions and agent (Fri Nov 6)

- All actions as defineAction, with workspace state in SQL.
- In-app agent instructions and skills.
- Selection context wired so "merge these" acts on the selected blocks.
- `propose_plan` produces suggestions with reasons.
- Check: the same move works from the UI, the agent chat and the CLI, and all land in the change log.

### Phase 3. The floor plan UI (Sat Nov 7)

- Import screen.
- Blueprint canvas: zoom, select, lasso, drag between rooms, block states, ghost arrows for the plan.
- Change log with who did what, undo.
- Live updates from any caller.
- Design last within the phase: own bold direction first, render dark and light in a headless browser.
- Check: drag a real file on a real repo and watch it turn green.

### Phase 4. Outside surfaces (Sat Nov 7)

- MCP for Claude Code and Cursor, with a one line connect instruction on the site.
- MCP App inline map in Claude and ChatGPT.
- Check: a Claude Code command moves blocks live on the open canvas (recorded).

### Phase 5. Ship (Sun Nov 8)

- GitHub OAuth, fork, one commit per change, open a pull request with a full change list.
- Patch download without sign in.
- Check: a real PR link on a real fork.

### Phase 6. Deploy and prove (Sun Nov 8)

- Deploy to Railway at floorplan.jdollar.site.
- Run on 5 real public repos and log the results honestly (including failures) in docs/BUILD_LOG.md.
- A "Try a real messy AI-built app" button pointing at a real public repo built with AI tools.

### Phase 7. Audit (Sun Nov 8 night)

- release-readiness-audit on the repo and the live app.
- Fix every real finding and prove each fix.
- Secrets scan of the full git history before going public.

### Gate: user approval of the live app (Mon Nov 9 morning Lagos)

### Phase 8. Launch (Mon Nov 9)

- README: hero, judge fast path, what is real, pre-existing work disclosure.
- Public Clips demo recording, about 90 seconds, one journey: messy repo, map, drag, merge, Claude Code moment, ship the PR.
- Submit the form and confirm receipt. Launch post.

## Risks and unknowns

| Risk | Status |
|---|---|
| Agent-Native scaffold, MCP and live sync behave as documented | needs a spike (0.1) |
| ts-morph moves plus tsc fast enough on ~300 files | needs a spike (0.2) |
| Railway container can clone and type check within memory and time | needs a spike (0.3) |
| MCP App renders in Claude and ChatGPT | needs a spike (0.4) |
| Repos without a tsconfig or with broken builds before we touch them | known: detect at import. If the repo doesn't build at the start, say so and run moves with a "no new errors" gate instead of "zero errors" |
| Abuse: cloning huge repos or many in a row | known: file cap, per IP rate limit, workspace cleanup job |
| GitHub OAuth scopes for fork and PR | known: `public_repo` scope |
| Duplicate merging changes behaviour | known: the merged function is shown before apply, and the type check gates it. Exact twins merge automatically, near twins need approval |

## Keys and access needed from the user (one message)

1. Anthropic API key (or confirm using the Builder.io gateway).
2. Neon Postgres connection string (or permission for me to create the project).
3. Railway: permission to create the service and set env vars, or a token.
4. GitHub OAuth app client ID and secret for floorplan.jdollar.site (click by click steps provided).
5. DNS: a CNAME for floorplan.jdollar.site.

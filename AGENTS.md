# Twins — Agent Guide

Twins finds code that was written more than once in a public GitHub repo and merges the copies into one, keeping a merge only if the app's type check and build are no worse than before. Signed out, `/` is the landing page; signed in, `/map` is the home where a repo is pasted, and `/map/<repoId>` is its map. The assistant chat lives at `/chat`. Every capability is an action, shared by the page, this assistant and external agents over MCP.

## Skills

Search with `rg --hidden --follow`; read the exact linked guide before deeper work. `.agents/skills/build-an-app/SKILL.md` — start here for vague requests to create a domain app. `.agents/skills/adding-a-feature/SKILL.md` — cross-area feature checklist. Data/integrations: `.agents/skills/actions/SKILL.md`, `.agents/skills/storing-data/SKILL.md`, `.agents/skills/security/SKILL.md`, `.agents/skills/secrets/SKILL.md`, `.agents/skills/sharing/SKILL.md`. UI: `.agents/skills/frontend-design/SKILL.md`, `.agents/skills/shadcn-ui/SKILL.md`, `.agents/skills/client-side-routing/SKILL.md`. Agent context/workflows: `.agents/skills/context-awareness/SKILL.md`, `.agents/skills/real-time-sync/SKILL.md`, `.agents/skills/reliable-mutations/SKILL.md`, `.agents/skills/performance/SKILL.md`, `.agents/skills/delegate-to-agent/SKILL.md`. Framework: `.agents/skills/agent-native-docs/SKILL.md`, `.agents/skills/agent-native-toolkit/SKILL.md`, `.agents/skills/customizing-agent-native/SKILL.md`.

Use local docs only (no web research): `pnpm action docs-search --query "<topic>"`, `pnpm action docs-search --slug "<slug>"`, `pnpm action docs-search --list`, `pnpm action source-search --query "<pattern>"`, `pnpm action source-search --path <path>`, or `pnpm action source-search --list`. For external-agent integrations, read `pnpm action docs-search --slug "external-agents"`.

## Core rules

- UI feedback: target 100 ms, never exceed 400 ms; acknowledge before network work.
- Normal app data must flow through actions. Keep actions deterministic and focused; use agent chat/AgentSidebar for AI work and follow-ups in the same thread. Keep structured state in SQL and large files in configured storage; persist references only.
- For external integrations, inspect the workspace/provider connection catalog first; reuse its scoped resolver. Never hardcode credentials, webhook URLs, or private/customer data.
- Never fabricate. Report failures and recover; verify writes by reading the row or screen. Navigation is in `<current-screen>`; use `view-screen` for fresh visible-record details.

For custom branding, keep `server/plugins/agent-native-email-branding.ts` aligned: `app.name` appears in transactional email and optional `app.logoUrl` must be an absolute HTTPS URL.

## Application state

- `navigation` describes the view and selected ids. The map is at `/map/<repoId>`, with `?set=<setId>` when a set of copies is open; new maps start at `/map`; chat is at `/chat` and `/chat/<threadId>`.
- Use `navigate` when supported and `view-screen` for a fresh read of visible details; basic navigation is already in `<current-screen>`.

- Guarded verification: run `pnpm agent-native:doctor`; fix findings before done.

## Twins actions

Twins imports a public GitHub repo, finds duplicate code, and merges copies inside a Vercel Sandbox, keeping a merge only if the type check does not get worse. Repo code never runs on this server.

| Action | Use it to |
| --- | --- |
| `import-repo` | Import `{ url }`; returns `id`, totals and top 5 copy sets; the sandbox prepares in the background. Poll `get-map` until `status` is `ready`. |
| `get-map` | Files, sets summary, status, baseline (errors, coverage, build), merges list and duplicate-line metrics for `{ repoId }`. |
| `find-twins` | List copy sets with members for `{ repoId, kind?, limit? }`. |
| `compare-twins` | Member source text plus token-level differences for `{ repoId, setId }`; read it before writing a near-copy merge. |
| `merge-twins` | Merge a set `{ repoId, setId, memberIds?, sharedPath?, edits? }`. Exact copies merge deterministically; pass `edits` (full new file contents) for near copies. Refused with `merge_refused` if the type check gets worse. |
| `undo-merge` | Revert a kept merge `{ repoId, mergeId }` and confirm the baseline is restored. |
| `export-patch` | Unified diff of all kept merges `{ repoId }`. |
| `open-pull-request` | Push the kept merges and open a PR `{ repoId, title?, body?, forkOnly?, confirmUpstream?, toUpstream? }`: on the user's own repo, or on their own fork when they do not own it (pass `toUpstream` only if they explicitly ask for the original repo). Needs the user's GitHub connected (`github_not_connected` otherwise). Refuses BuilderIO without `confirmUpstream`. |

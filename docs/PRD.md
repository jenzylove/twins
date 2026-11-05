# Twins PRD

Builder.io Agent-Native Hackathon. Deadline Mon Nov 9 2026, 11:59 PM PT (Tue Nov 10, 08:59 Lagos).

## One liner

Paste a GitHub repo. Twins finds the code your AI wrote over and over, shows the copies glowing on a map of your project, and merges them into one. It only keeps a merge if the app still builds, then opens the pull request.

## The problem, in plain words

When people build apps with AI (Cursor, Claude Code, Lovable, Builder Fusion), the AI can't see the whole project at once, so it writes the same helper again and again. One app ends up with five versions of "format a date", four of "call the API" and three of "check the user is logged in". They look slightly different, so nobody notices. Then a bug gets fixed in one copy and the other four still have it.

Evidence:

- GitClear studied 211M changed lines. Duplicated blocks rose eightfold, and moved code (the sign of someone tidying) fell from 24.8% in 2021 to 9.5% in 2024. In 2024 copy and pasted lines outnumbered moved lines for the first time. https://devclass.com/2025/02/20/ai-is-eroding-code-quality-states-new-in-depth-report/
- A paid industry now exists to clean up AI-built apps: Callstack (https://www.callstack.com/services/ai-vibe-coding-cleanup), Lightning Workgroup (https://lightningworkgroup.com/vibe-code-cleanup/), devPulse, and about ten firms in one roundup (https://agilityportal.io/blog/vibe-coding-cleanup-service-companies).
- Claude Code users wrote a dedicated skill just to find the duplicate functions the agent keeps writing (https://claude-plugins.dev/skills/@obra/superpowers-lab/finding-duplicate-functions).

## Reframe

AI-built code doesn't have a "bad code" problem. It has a "copies" problem. The AI writes the same thing five times because it can't see that it already wrote it.

## User and front door

User: anyone who built a TypeScript or JavaScript app with AI tools. Solo builders, small teams, agencies doing cleanup.

First ten seconds: one box, "Paste any public GitHub link", and one button, "Try a real messy AI-built app". No signup to look. Within about 30 seconds the map draws itself: folders as rooms, files as blocks, and every set of copies pulsing in its own colour. A counter shows "9 sets of copies, 214 duplicate lines". GitHub sign in is only needed to open the pull request.

## The one loop

```
public repo -> map with glowing copies -> merge (you, the in-app AI, or Claude Code)
            -> build + tests + type check vs baseline -> kept (green) or undone (red)
            -> real pull request
```

## Full scope

1. **Import.** Paste a public GitHub URL. The server shallow clones it into an isolated workspace, reads it with the TypeScript compiler (ts-morph), installs dependencies, and records a **baseline**: type check error count, test result and build result before we touch anything. Up to about 300 source files. Larger repos are refused with a clear message, never half loaded.
2. **Copy finder.**
   - Exact and renamed copies: normalised function fingerprints (identifiers and literals abstracted, AST shape hashed).
   - Near copies: candidates from token similarity, confirmed by the AI with a short reason ("same date format, one adds a timezone").
   - Every set is shown side by side before anything changes. Nothing is merged on the AI's word alone.
3. **The map.** A blueprint canvas: rooms (folders), blocks (files), and copy sets pulsing in matching colours with threads between them. Click a set to open the side-by-side view. Each set shows its state: found, merging, checking, kept (green) or undone (red, with the reason).
4. **Merge.**
   - The AI writes one shared version. It is shown as a diff before apply.
   - The TypeScript compiler moves the shared version to the right place and rewires every caller (deterministic, not guessed).
   - Exact copies can be merged in one click. Near copies need approval of the shared version.
5. **The check, inside the action.** After every merge: type check (no new errors compared to the baseline), the repo's tests if present, and the real build if present. Anything worse means the merge is undone automatically, the set turns red and the reason is shown. Because the check lives inside the `merge_twins` action, it holds for every caller: you, the in-app agent and Claude Code.
6. **Three callers, one live map.**
   - **You:** click a set, press Merge.
   - **The in-app agent:** knows the current selection ("merge these", "merge every copy of the API client").
   - **Claude Code or Cursor over MCP:** "merge every copy of formatDate" in a terminal.

   All call the same actions and the map updates live (SSE) wherever it is open. The change log says who did what.
7. **The moment.** When Claude Code makes a merge that breaks the build, the map shows it turn red and undo itself: "Claude Code said done. Twins said no."
8. **Inside Claude and ChatGPT.** The map renders inline as an MCP App, so "find the copies in github.com/x/y" in Claude shows the real map in the chat, with a link to the full workspace.
9. **Pull request.** Sign in with GitHub. Twins forks the repo (if the user doesn't own it), pushes a branch with one commit per merge, and opens a real pull request listing every merge with before and after. Without sign in, the user downloads a patch.
10. **The ending number.** Measured, not estimated: duplicate lines removed, copy sets merged, merges undone, and "still builds".
11. **Side feature:** move a file to another folder with imports rewired (same check). Not the headline.
12. **Proof page.** Results on real public AI-built repos and on a fork of Builder's own agent-native repo: copies found, compared with an independent copy detector (jscpd) and a hand-checked set; merged; kept; undone; and missed. Published honestly, misses included.

## Actions (one defineAction each, shared by every caller)

`import_repo`, `get_map`, `find_twins`, `compare_twins`, `merge_twins` (with the check inside), `undo_merge`, `move_file`, `open_pull_request`, `export_patch`.

## How each judging criterion is met

| Criterion | How |
|---|---|
| Usefulness and Execution (40%) | A paid-for pain, and a complete loop from any public repo to a real pull request, with every merge proven by the build |
| Creativity and Design (20%) | Code as a living blueprint with copies pulsing as twins. Nothing like the board-of-cards entries |
| Innovation (20%) | The AI does the merge and the build decides if it stays. Copy finders only report; Twins fixes and proves |
| Cleverness and Use of Agent-Native (20%) | Three callers, one guarded action, one live map, plus the inline map in Claude and ChatGPT. Claude Code gets refused on screen by a rule that lives in the action |

## Builder's four literal asks

| Ask | Twins |
|---|---|
| People and agents work together | You, the in-app AI and Claude Code merge copies on the same map at the same time |
| An agent with a clear purpose | Find the copies AI wrote and merge them safely |
| A UI to explore results, make edits and guide the agent | Explore the map, compare copies side by side, edit the shared version, pick which sets to merge |
| UI and agent on the same data and actions | Your Merge button, the agent and Claude Code all call `merge_twins` |

## Claims and how each is proven

| Claim | Proof |
|---|---|
| Finds real copies | Compared with jscpd plus a hand-checked set on 5 real repos, published with misses |
| Never keeps a merge that breaks the app | Check runs inside the action for every caller. Undone merges shown, never hidden. Tests cover a breaking merge that must undo |
| Works on any public TS/JS repo up to ~300 files | Results on 5 real repos of different shapes in docs/BUILD_LOG.md, failures included |
| Claude Code drives the same map | Recorded live: terminal and browser side by side, including a refused merge |
| A real pull request | A real PR link on a real fork, in the demo and the README |

## What it does not do

- Languages other than TypeScript and JavaScript.
- Private repos in the hackathon build (public only, so any judge can try any repo).
- Bug fixing, code review or logic changes beyond merging copies.
- Open pull requests on repos the user didn't ask for. Runs on Builder's repo happen on our fork only.

## Cut from scope, and why

- Private repos: needs a GitHub App with code access and a stronger sandbox than four days allows.
- Monorepos with many tsconfigs: one project per run in this build.

## Submission checklist (docs/SUBMISSION_CHECKLIST.md, ticked only from the live app)

From the official rules (https://www.builder.io/hackathon/rules) and submit form (https://www.builder.io/hackathon/submit):

- [ ] Functional application built with Agent-Native
- [ ] Work started on or after Oct 27 2026. Pre-existing work, templates and libraries identified in the README and the form
- [ ] Public Clips recording of the real app in use (clips.agent-native.com), viewable without login
- [ ] Submission form: first name, email, project name, project description, project or GitHub URL, public Clips URL, optional slides URL, agreement checkbox
- [ ] Repo public and live deployment reachable (encouraged, not required)
- [ ] Submitted before Nov 9 11:59 PM PT, and receipt confirmed
- [ ] Every team member identified and eligible

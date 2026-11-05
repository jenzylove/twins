# Floorplan PRD

Builder.io Agent-Native Hackathon. Deadline Mon Nov 9 2026, 11:59 PM PT (Tue Nov 10, 08:59 Lagos).

## One liner

Paste any GitHub repo. See your code as a floor plan. Drag files into the right rooms and merge the duplicates, and the AI does the real refactor and opens the pull request.

## The problem

Apps built with AI tools (Cursor, Claude Code, Lovable, Builder Fusion) turn messy fast. The same helper gets written three times, files land in the wrong folders, and after a few weeks the owner is scared to touch anything.

Evidence:

- GitClear studied 211M changed lines. Moved code (the refactoring signal) fell from 24.8% in 2021 to 9.5% in 2024, and in 2024 copy and pasted lines outnumbered moved lines for the first time. Duplicated blocks rose eightfold. https://devclass.com/2025/02/20/ai-is-eroding-code-quality-states-new-in-depth-report/
- A paid industry now exists just to clean up AI-built apps: Callstack (https://www.callstack.com/services/ai-vibe-coding-cleanup), Lightning Workgroup (https://lightningworkgroup.com/vibe-code-cleanup/), devPulse, and about ten firms in one roundup (https://agilityportal.io/blog/vibe-coding-cleanup-service-companies).
- Claude Code users wrote a dedicated skill to find the duplicate functions the agent keeps writing (https://claude-plugins.dev/skills/@obra/superpowers-lab/finding-duplicate-functions).
- Structure101 proved people want to restructure code by dragging it on a map, but it only produced a to-do list for humans, and it is no longer sold (https://community.sonarsource.com/t/structure101-in-sonarcloud/147702.md).

## Reframe

Messy AI code is not a coding problem, it is a "nobody can see it" problem. You can't tidy a house you can't see. Floorplan shows you the house, and the AI moves the furniture.

## User and front door

User: anyone who built a TypeScript or JavaScript app with AI tools and is now afraid of their own code. Solo builders, small teams, and agencies doing cleanup work.

First ten seconds: one box, "Paste any public GitHub link", and one button, "Try a real messy AI-built app". No signup to look. Within about 30 seconds the map draws itself live:

- rooms are folders
- blocks are files, sized by lines
- threads are imports that cross rooms
- pulsing twins are duplicate functions

Signing in with GitHub is only needed to ship a pull request.

## The one loop

```
public repo  ->  floor plan  ->  you + AI + Claude Code rearrange it  ->  every change must still build  ->  real pull request
```

## Full scope

1. **Import.** Paste a public GitHub URL. The server clones it into an isolated workspace, reads it with the TypeScript compiler (ts-morph), and builds the map: rooms, blocks, threads, and duplicate twins (found by normalised function body hashing plus an AI pass on near duplicates). Up to about 300 source files. Larger repos are refused with a clear message, never half loaded.
2. **The floor plan.** A full screen blueprint canvas. Zoom from rooms to files. Select by click or lasso. Every block shows its state: idle, moving, checking, green (still builds) or reverted.
3. **Tidy plan.** The agent studies the map and proposes a plan, drawn as ghost arrows on the canvas, for example "these 6 files belong in lib/api" and "these 3 formatDate functions are the same". Each suggestion can be accepted, changed or dismissed. The agent proposes and does the work. It never just grades the code.
4. **Actions** (one defineAction each, shared by every caller):
   - `import_repo`
   - `move_file`
   - `merge_twins`
   - `extract_module` (pull a group of files into a new room)
   - `rename_symbol`
   - `propose_plan`
   - `accept_suggestion`
   - `undo_change`
   - `ship_pr`
   - `get_map` (read)
5. **Safe changes.**
   - Moves and renames are deterministic, using the TypeScript compiler API (ts-morph): no AI guessing.
   - The AI is used only to write the merged version of duplicates and to propose the plan.
   - After every change the workspace runs the type check (and the repo's tests if they exist and are fast). A block turns green only if it still builds. Otherwise the change is reverted automatically and the block shows why.
6. **Three surfaces moving one map, live.**
   - Drag in the browser.
   - The in-app agent, which knows the current selection ("merge these", "move this into billing").
   - Claude Code or Cursor over MCP, typing "move all billing code into packages/billing" in a terminal.

   All three call the same actions, and the canvas updates live (SSE) wherever it is open.
7. **Inside Claude and ChatGPT.** The map renders inline as an MCP App (embedRoute), so "tidy my repo github.com/x/y" in Claude shows the real floor plan in the chat, with a link to the full workspace.
8. **Ship.** Sign in with GitHub. Floorplan forks the repo to the user's account (if they don't own it), pushes a branch with one commit per change, and opens a real pull request. The PR body lists every change with before and after paths. Without signing in, the user can download the changes as a patch.
9. **The ending number.** Every session shows a real count, measured not estimated: lines removed, duplicates merged, cross-room imports reduced, files moved, and "still builds".
10. **Change log.** Every change records who made it: you, the in-app agent, or Claude Code. Any change can be undone.

## How each judging criterion is met

| Criterion | How |
|---|---|
| Usefulness and Execution (40%) | A paid-for pain, and a complete loop from any public repo to a real pull request, with every change type checked |
| Creativity and Design (20%) | Code as an architect's blueprint you rearrange, with blocks sliding live. A visual identity no other entry has |
| Innovation (20%) | Old tools only gave humans a to-do list. Here the AI proposes the tidy plan and carries out each move, gated by the build |
| Cleverness and Use of Agent-Native (20%) | Four callers drive one live map through the same actions: your drag, the in-app agent with selection context, Claude Code over MCP, and the inline map in Claude or ChatGPT |

## Builder's four literal asks

| Ask | Floorplan |
|---|---|
| People and agents work together | You and the AI tidy the same codebase on the same map at the same time |
| An agent with a clear purpose | Reorganise messy code safely, and actually do the moves |
| A UI to explore results, make edits and guide the agent | Explore the map, drag blocks yourself, accept or change the AI's plan, point at blocks and tell it what to do |
| UI and agent on the same data and actions | Your drag and the AI's move are the same `move_file` action. Claude Code calls it too |

## Claims and how each is proven

| Claim | Proof |
|---|---|
| Works on any public TypeScript repo up to ~300 files | Run on 5 real public repos of different shapes, results logged in docs/BUILD_LOG.md |
| Moves never break the build | Every change is followed by a type check. Reverted changes are shown, never hidden. Test suite covers move and rename on fixtures |
| Duplicates are real | Twins are shown side by side before any merge |
| The ending numbers are real | Computed from the actual diff and the import graph, before vs after |
| Claude Code drives the same map | Recorded live in the demo: terminal and browser side by side |
| A real pull request | A real PR link on a real fork, shown in the demo and listed in the README |

## What it does not do

- Languages other than TypeScript and JavaScript.
- Private repos in the hackathon build. Public repos only, so judges can try any repo without granting access.
- Line by line editing. It works at file, folder and function level.
- Logic changes, bug fixing or code review.

## Cut from scope, and why

- Private repo support: needs a GitHub App with code access and a stronger sandbox story than four days allows. Listed as next.
- Monorepo workspace graphs beyond one tsconfig: the import graph is per tsconfig in this build.

## Submission checklist (becomes docs/SUBMISSION_CHECKLIST.md, ticked only from the live app)

From the official rules (https://www.builder.io/hackathon/rules) and submit form (https://www.builder.io/hackathon/submit):

- [ ] Functional application built with Agent-Native
- [ ] Work started on or after Oct 27 2026. Pre-existing work, templates and libraries identified in the README and the form
- [ ] Public Clips recording of the real app in use (clips.agent-native.com), viewable without login
- [ ] Submission form: first name, email, project name, project description, project or GitHub URL, public Clips URL, optional slides URL, agreement checkbox
- [ ] Repo public and live deployment reachable (encouraged, not required)
- [ ] Submitted before Nov 9 11:59 PM PT, and receipt confirmed
- [ ] Every team member identified and eligible

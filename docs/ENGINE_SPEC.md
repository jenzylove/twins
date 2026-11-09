# Engine reference

How the Twins engine works as shipped (Nov 9 2026). The code under `server/engine/`, `server/lib/` and `actions/` is the source of truth; this page explains it.

## Hard rules

- Repo code never runs on the Twins server. The server only downloads a tarball and parses files. Installs, the type check, the build and the repo's tests run only inside a Vercel Sandbox.
- Every engine function throws `EngineError(code, message, details?)` (`server/engine/errors.ts`) for expected failures; actions turn it into a typed action error.
- Paths inside the engine are repo relative POSIX (`src/lib/x.ts`).

## repo.ts: download

- `parseRepoUrl(input)` accepts `owner/name`, `github.com/owner/name`, or a full GitHub URL (with `.git` or `/tree/...`). Anything else is `invalid_repo_url`.
- `fetchRepoInfo(ref)` reads the repo and its default branch head commit from the GitHub API. Private or missing repos give `repo_not_found`; repos over 200 MB give `repo_too_large`.
- `downloadRepo(ref, sha, dir)` streams the tarball through `tar` with a filter that **drops symlinks and hard links**, `node_modules`, `.git` and files over 1 MB, and stops past 8,000 files or 150 MB.

## scan.ts: the map and the copy finder (about 1 s per repo)

- Files: `.ts .tsx .js .jsx .mjs .cjs`, excluding `node_modules dist build out coverage vendor .git .next .output .vercel .turbo .svelte-kit`, `*.d.ts`, `*.test.*`, `*.spec.*`, shadcn `components/ui`, and files over 3,000 lines (usually generated).
- Candidates: top level function declarations and top level `const x = () => ...` or function expressions, with at least 25 syntax nodes and 4 lines. Class methods and nested functions are not candidates yet.
- Shape hash: identifiers become `I`, literals `L`, other nodes their kind. Members with the same shape form a set.
- Variant key: the token text plus a dependency signature (what each identifier resolves to: an import's target and name, or a local helper's own hash). Same text calling different modules is **not** an identical copy.
- A set is `exact` (identical, one variant) or `near` (same shape, small differences). It is mergeable in one click only when it is exact, no member is a default export, and no two members share a file; otherwise `reason` says why in plain words.
- File imports are resolved through relative paths and tsconfig `paths`, so the map knows which files depend on which.

## merge.ts: planning a merge (pure, no writes)

`planMerge(dir, set, { memberIds?, sharedPath? })` returns `{ sharedPath, canonicalName, edits, linesRemoved, linesAdded }`.

- The shared file gets the imports the moved code needs (relative paths re-relativised), the local helpers it uses, then the canonical declaration, all exported.
- Each member file loses the declaration and any helpers and imports only it used, and gains `import { canonical as local }` (plus `export { local }` when the member was exported).
- `sharedPath` defaults to the members' common directory plus a kebab case file name (`.tsx` for components).
- Near copies are not planned here: an agent writes the shared version and passes it to `merge-twins` as `edits`.

## check.ts and sandbox.ts: the safety test

`CheckResult = { diags, coveredFiles, ms, build?, tests? }` where `build` and `tests` are `{ ran, ok, ms, tail? }`.

**Sandbox.** Created from the repo's git commit with `runtime: node22`, 4 vCPUs, a 45 minute timeout and `persistent: false`, so nothing is kept after it stops.

**Prepare (once per repo, gives the baseline).**
1. Install the repo with `--ignore-scripts` (npm, or pnpm or yarn via corepack when that lockfile is present), and in parallel install the checker (`@typescript/native-preview`, `tsgo`) into `/tmp/checker`.
2. Cut the sandbox off from the network (`deny-all`). Everything after this runs repo scripts, so it never runs with the network open.
3. Type check every target config (`tsconfig.json`, or its referenced configs), and run `npm run build` when the repo has a build script. When the build ran, type check again so generated files count.
4. When the repo has a real `test` script, run `npm test` once (CI=1, 180 s cap). A suite that fails or times out here is recorded and not used.

**Every merge.** Write the edits to the sandbox, then:
1. type check again and compare with the baseline (`compareDiags`, a multiset on error code plus message, so code that moved files does not count as new);
2. run the build again if it passed at baseline;
3. run the tests again if they passed at baseline.

The merge is **kept** only when it adds no type error, the build still passes (if it passed before), and the tests still pass (if they passed before). Otherwise the original files are written back, the merge is recorded as `refused`, and the action fails with `merge_refused` and the reason. Type check coverage under 60% of the source files blocks merges (`low_coverage`).

What this proves: no new type errors, no newly broken build, no newly failing tests. What it does not prove: identical behaviour where the repo has no tests.

## Actions

| Action | What it does |
| --- | --- |
| `import-repo` | Downloads a public repo, scans it, starts preparing the sandbox in the background. 20 imports per user per day. |
| `get-map` | Files, sets, status, baseline (errors, coverage, build, tests), merge history and metrics. |
| `find-twins` | Sets of copies with their members. |
| `compare-twins` | The copies' source side by side, for writing a near copy merge. |
| `read-repo-file` | One file, confined to the repo (no `..`, no absolute paths, 256 KB cap). |
| `merge-twins` | Plans or applies a merge and runs the safety test above. |
| `undo-merge` | Restores a kept merge and re-checks. |
| `export-patch` | A unified diff of every kept merge. |
| `open-pull-request` | Pushes one branch with every kept merge and opens a pull request: on the user's own repo, or on their own fork when they do not own it (`toUpstream` only when they explicitly ask for the original). Needs the user's GitHub connected with `public_repo`. |

Every action loads the repo by its id **and** the signed in user's email, so nobody can read or change another user's maps. The safety test lives inside `merge-twins`, so it holds for every caller: the page, the in-app assistant, and any agent over MCP.

## Data (Postgres)

- `repos`: owner email and org, the GitHub repo and commit, status (`scanning`, `preparing`, `ready`, `failed`) and detail, sandbox id, scan JSON, baseline JSON, `has_build`, pull request url and number, timestamps.
- `merges`: repo, owner, set id and name, status (`kept`, `refused`, `undone`), mode (`auto` or `agent`), caller, shared path, edits JSON, lines removed and added, added errors JSON, check time, summary, created at.

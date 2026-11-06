# Engine spec (Phase 1 and 2)

Source of truth for the module boundaries. Reference spikes: `C:/Users/LENOVO/twins-launch/spike-engine/{find,merge}.mjs`, `C:/Users/LENOVO/twins-launch/spike-sandbox/run.mjs`, and `docs/spikes/*.md`. Real test repos are already cloned in `C:/Users/LENOVO/twins-launch/ws/` (nectarpay-crm, medi-docs-plus-85c8a0c5, mzansi-adearn).

Hard rules
- Repo code never runs on our server or the dev PC. On the server we only download a tarball and parse files with ts-morph. Install, type check, build and tests run only inside the Vercel Sandbox.
- Every engine function throws `EngineError(code, message, details?)` (in `server/engine/errors.ts`) for expected failures; actions map that to `fail()`.
- Paths inside the engine are repo-relative POSIX (`src/lib/x.ts`).

## Modules (all under `server/engine/`)

### errors.ts
`class EngineError extends Error { code: string; details?: unknown }`.

### repo.ts (download, no git binary needed)
- `parseRepoUrl(input: string): { owner: string; name: string }`. Accepts `owner/name`, `github.com/owner/name`, `https://github.com/owner/name(.git)(/tree/...)`. Rejects anything else with `invalid_repo_url`.
- `fetchRepoInfo(ref, token?)`: GitHub REST `GET /repos/{o}/{r}` then the default branch head sha. Returns `{ owner, name, defaultBranch, sha, isPrivate, sizeKb, htmlUrl, description, stars }`. Private or missing gives `repo_not_found`. `sizeKb > 200_000` gives `repo_too_large`. Header `User-Agent: twins-app`. Use `Authorization: Bearer ${token}` when given (`process.env.GITHUB_TOKEN` is the server fallback).
- `downloadRepo(ref, sha, dir)`: stream `https://codeload.github.com/{o}/{r}/tar.gz/{sha}` through `tar` v7 `x({ cwd: dir, strip: 1, filter })`. The filter skips symlinks and hard links, `node_modules`, `.git`, files over 1 MB, and stops past 8,000 files or 150 MB total (`repo_too_large`).
- `workdirFor(repoId)`: `path.join(process.env.TWINS_WORKDIR ?? path.join(os.tmpdir(), "twins"), repoId)`.

### scan.ts (map plus copy finder, about 1 s per repo)
```ts
export type FileNode = { path: string; lines: number; imports: string[]; copies: number };
export type Member = {
  id: string;            // `${path}#${name}#${line}`
  name: string; path: string; line: number; endLine: number; lines: number;
  declKind: "function" | "const"; exported: boolean; isDefault: boolean;
  variant: number;       // members with the same variant are true copies (same tokens + same dependencies)
};
export type TwinSet = {
  id: string;            // shape hash, 12 hex chars
  name: string;          // shared name, or "a / b"
  kind: "exact" | "near";// exact = one variant across all members
  isComponent: boolean;  // body contains JSX
  members: Member[];
  duplicateLines: number;// sum of member lines minus the largest
  mergeable: boolean;    // deterministic merge possible for all members
  reason?: string;       // why not mergeable, plain words
};
export type ScanResult = {
  files: FileNode[]; sets: TwinSet[];
  totals: { files: number; sourceLines: number; duplicateLines: number; sets: number };
  ms: number;
};
export function scanRepo(dir: string): ScanResult;
export function resolveImport(dir: string, fromPath: string, spec: string): string | null; // uses tsconfig paths
```
- Files: `**/*.{ts,tsx,js,jsx,mjs,cjs}`. Exclude `node_modules, dist, build, .next, out, coverage, vendor, .git, **/*.d.ts, **/*.test.*, **/*.spec.*, **/components/ui/**`, and any generated file over 3,000 lines.
- Candidates: top-level function declarations, and top-level `const x = () => …` / `function` expressions. Keep only bodies with ≥25 AST nodes and ≥4 lines.
- The shape hash works as in the spike: identifiers become `I`, literals become `L`, other nodes use their kind name. Group by shape. Groups with fewer than 2 members are dropped.
- Variant key = token text hash plus dependency signature.
  - Token text hash: the declaration from its parameters onward (excluding its own name), tokenised with `ts.createScanner` with trivia skipped.
  - Dependency signature: for every identifier in the body that names a file-level import, use `import:<resolved path or package>:<imported name>`. For a top-level local declaration, use `local:<token hash of that decl>`.
  - So the same text that calls different modules is NOT an exact copy.
- `mergeable` is false (with a `reason`) when:
  - the set is near;
  - any member is a default export;
  - two members are in the same file.
- `imports`: resolved repo-relative targets of each file's import declarations. Relative imports are resolved, and tsconfig `paths` are read from `tsconfig.json` and its referenced configs. Try the extensions `.ts .tsx .js .jsx`, then `/index.*`, and map a `.js` spec to `.ts`. Unresolved imports and packages are left out.
- Sort sets by `duplicateLines` desc.

### merge.ts (plan a merge, pure, no disk writes)
```ts
export type FileEdit = { path: string; before: string | null; after: string | null }; // null before = new file
export type MergePlan = { sharedPath: string; canonicalName: string; edits: FileEdit[]; linesRemoved: number; linesAdded: number };
export function planMerge(dir: string, set: TwinSet, opts?: { memberIds?: string[]; sharedPath?: string }): MergePlan;
```
Port the spike merge, with these additions.
- The chosen members must all share one variant. Otherwise throw `near_copies` ("these copies differ; write a shared version and pass edits").
- `sharedPath` defaults to the common directory of the member files plus `kebab(name).ts`, or `.tsx` when the set is a component. If the common dir is the repo root and `src/` exists, use `src/shared/`. If the file exists, add `-shared`. A caller-given path must not exist, must stay inside the repo, and must end in .ts or .tsx.
- The shared file contains:
  - the imports the moved code needs, with relative specifiers re-relativised from the home file's dir to the shared dir (aliases and packages unchanged);
  - the transitive local helpers (functions, variable statements, interfaces, type aliases, enums), exported, in their original order;
  - then the canonical declaration, exported.
- Each member file:
  - remove the declaration (the variable statement if it has a single declarator);
  - remove identical, unexported helper copies that are no longer used;
  - remove import specifiers that only the removed code used (and the declaration if it ends up empty);
  - add `import { canonical as local }` (just `{ canonical }` when the names match), using `getRelativePathAsModuleSpecifierTo`;
  - if the member was exported, also add `export { local };`.
- Return edits for every changed file plus the new shared file. `linesRemoved` and `linesAdded` come from a line diff count.

### check.ts (parse checker output, compare to baseline)
```ts
export type Diag = { file: string; line: number; col: number; code: string; message: string };
export type CheckResult = { diags: Diag[]; coveredFiles: string[]; ms: number; build?: { ran: boolean; ok: boolean; ms: number; tail?: string } };
export function checkTargets(dir: string): string[];           // ["tsconfig.json"] or the referenced configs when root has references and files: []
export function parseTsgo(stdout: string, root: string): { diags: Diag[]; files: string[] }; // `tsgo --noEmit --pretty false --listFiles -p <cfg>` output; drop node_modules, relativise
export function compareDiags(base: Diag[], after: Diag[]): { added: Diag[]; fixed: number }; // multiset on code+message (file ignored, so moved code does not count as new)
export function coverage(covered: string[], scanned: string[]): { covered: number; total: number; ratio: number };
```
A merge is kept only when `added.length === 0`, and (when the baseline build passed) the build still passes. Coverage under 0.6 blocks merges with `low_coverage`.

### sandbox.ts (Vercel Sandbox session)
```ts
export async function createRepoSandbox(info: { owner: string; name: string; sha: string }): Promise<{ sandboxId: string }>;
export async function prepareSandbox(sandboxId: string, targets: string[], hasBuild: boolean): Promise<CheckResult>; // idempotent; returns the baseline
export async function runCheck(sandboxId: string, targets: string[], withBuild: boolean): Promise<CheckResult>;
export async function writeFiles(sandboxId: string, edits: { path: string; content: string | null }[]): Promise<void>; // null deletes
export async function stopSandbox(sandboxId: string): Promise<void>;
export async function isAlive(sandboxId: string): Promise<boolean>;
```
- Credentials: if `VERCEL_TOKEN`, `VERCEL_TEAM_ID` and `VERCEL_PROJECT_ID` are set, pass `{ token, teamId, projectId }`; otherwise let the SDK read `VERCEL_OIDC_TOKEN`.
- Create: `source: { type: "git", url, revision: sha, depth: 1 }`, `runtime: "node22"`, `resources: { vcpus: 4 }`, `timeout: 45 min`.
- Prepare runs the repo install (`npm install --ignore-scripts --no-audit --no-fund --legacy-peer-deps`; use pnpm or yarn via corepack only when that lockfile exists and package-lock does not). In parallel, it installs our checker into `/tmp/checker` (`npm install --prefix /tmp/checker @typescript/native-preview`). Skip each step when its marker already exists (`node_modules/.bin` / `/tmp/checker/node_modules/.bin/tsgo`).
- After installs, call `updateNetworkPolicy("deny-all")` so repo code run by the build cannot reach the network.
- Check: run `/tmp/checker/node_modules/.bin/tsgo --noEmit --pretty false --listFiles -p <cfg>` for each target. When `withBuild`, run `npm run build` in parallel (`CI=1`, 180 s cap).

## Data (server/db)
- `repos`: `id`, `owner_email`, `org_id`, `repo_owner`, `repo_name`, `sha`, `default_branch`, `html_url`, `status` (`scanning|preparing|ready|failed`), `status_detail`, `sandbox_id`, `scan_json` (ScanResult), `baseline_json` (CheckResult plus coverage plus targets), `has_build`, `created_at`, `updated_at`.
- `merges`: `id`, `repo_id`, `owner_email`, `org_id`, `set_id`, `status` (`kept|refused|undone`), `mode` (`auto|agent`), `caller`, `shared_path`, `edits_json` (FileEdit[]), `lines_removed`, `lines_added`, `added_diags_json`, `check_ms`, `summary`, `created_at`.

## Actions (Phase 2)
`import-repo, get-map, find-twins, compare-twins, merge-twins, undo-merge, export-patch` (`open-pull-request` and `move-file` come later). `merge-twins` accepts `{ repoId, setId, memberIds?, sharedPath?, edits?: {path, content|null}[] }`.
- Without `edits`, it plans the merge deterministically. With `edits` (an agent-written near-copy merge), it applies them as given.
- Either way it writes the edits to the sandbox, re-checks and compares. If anything is added, it writes the originals back, records `refused`, and `fail()`s with code `merge_refused` and the added errors (file:line message). Otherwise it applies the edits to the server workdir and records `kept`.
- This check lives inside the action, so it holds for every caller: UI, in-app agent, MCP (Claude Code), CLI, HTTP.

# Spike: the copy engine on real AI-built repos

Date: Nov 5 to 6 2026. Scripts kept outside the repo (twins-launch/spike-engine).

## Question

Can we find real copies in real AI-built apps, merge one set with every caller rewired, and prove with a type check against a baseline whether the merge is safe, fast enough for a live demo?

## What was run

1. Shallow cloned three public Lovable-built repos: cmonson66/nectarpay-crm (205 files), drhimam/medi-docs-plus-85c8a0c5 (177), MzansiTalk/mzansi-adearn (127). Clone took 2 to 4 s each.
2. Copy finder (ts-morph, function bodies normalised so renamed copies hash the same).
3. On nectarpay-crm: `npm install --ignore-scripts`, baseline type check, merge the three `createSupabaseFetch` copies into `src/integrations/supabase/supabase-fetch.ts`, re-check. Then a deliberately broken merge (one import left out), re-check.
4. Timed the standard checker (tsc), tsc incremental, an in-memory ts-morph re-check, and tsgo (TypeScript native preview).

## Output

Copy finder, about 1 s per repo:

| Repo | Files | Copy sets | Duplicate lines | Real examples |
|---|---|---|---|---|
| nectarpay-crm | 205 | 8 | 106 | `createSupabaseFetch` x3 across supabase clients |
| medi-docs-plus | 177 | 6 | 1,029 | four 200-line patient condition dialogs; `hexToRgb` x2; three growth percentile functions |
| mzansi-adearn | 127 | 7 | 109 | `createSupabaseFetch` x3; `timeAgo` x2 |

Noise to filter: stock shadcn `components/ui` pieces (Header/Footer, Shortcut) match by shape. Exclude `components/ui` by default. Sibling functions that differ only in literals (`isRateLimited` vs `isForbidden`) are shape twins, not text twins: they need a parameterised shared version written by the AI and must be labelled "near copy".

Merge on nectarpay-crm:

- First naive merge: the type check went from 1 error (baseline) to 2. The shared function used a local helper (`isNewSupabaseApiKey`, itself copied three times) that was left behind. The check caught it. This is the "Twins said no" moment, happening for real.
- Engine fixed to carry local helpers along (transitive, same file) and remove helper copies only when identical and unused.
- Second merge: 3 files changed, 75 lines removed, 3 imports added. Errors identical to baseline. Kept.
- Deliberately broken merge (one import left out): 2 errors vs baseline 1, exact file and line reported. Would be undone.

Check speed on nectarpay-crm (207 files covered):

| Checker | Baseline | After a merge |
|---|---|---|
| tsc | 39 s | 29 to 35 s |
| tsc --incremental | 24 s | 75 s (worse) |
| ts-morph in memory, scoped | 36 s load | 33 s (program rebuild) |
| **tsgo** | **15 s** | **6.5 to 8 s** |

tsgo error counts match tsc exactly.

Coverage lesson: mzansi-adearn is a flattened dump with no `src` folder, so its tsconfig covered 1 file and reported "0 errors". The baseline must report files covered vs source files, and refuse to call a repo "checked" when coverage is low.

## Verdict

**Pass.** Real copies exist in real AI-built apps, the merge with rewiring works, and the baseline check catches a real broken merge in under 10 s with tsgo. Build decisions:

- Use tsgo for the check, with tsc only as a fallback.
- The engine carries local helpers into the shared module.
- Exclude `components/ui` by default. Label near copies and let the AI write the parameterised version.
- Show coverage (files checked out of source files) on every baseline.
- Restore `package-lock.json` changes from our own install before building the PR.
- Repo code never runs outside a sandbox: install with scripts off, and run only our own checker. Builds and tests, which run repo code, happen only inside the throwaway sandbox (spike 3).

Still a pass against the rubric's core test: the agent does the real work (finding, merging, carrying helpers), and the check inside the action decides what stays.

# Spike: running repos in a throwaway Vercel Sandbox

Date: Nov 6 2026. Script kept outside the repo (twins-launch/spike-sandbox/run.mjs).

## Question

Untrusted public repos must never install or run on our server or a developer's PC. Can the clone, install, baseline check, merge and re-check all run inside a throwaway Vercel Sandbox, fast enough for a live session?

## What was run

`@vercel/sandbox`, OIDC credentials from a linked spike project, 4 vCPUs, node22. Repo: cmonson66/nectarpay-crm. Install with scripts off, our own checker (tsgo) and ts-morph installed with `--no-save`, baseline, merge of the three `createSupabaseFetch` copies, re-check, diff, stop.

## Output

| Step | Time |
|---|---|
| Sandbox created and repo cloned | 1.2 s |
| `npm install --ignore-scripts` | 34.7 s |
| Our checker installed | 46.1 s |
| Baseline (tsgo) | 5.8 s, 1 error |
| Merge (3 files, helpers carried) | 11.8 s |
| Re-check (tsgo) | 5.1 s, 1 error (same as baseline), merge kept |
| Stop | 104 s total |

Diff: 3 files changed, 3 insertions, 75 deletions.

## Verdict

**Pass.** Build decisions:

- Each session gets its own sandbox, stopped and deleted at the end or on timeout. Repo code never runs on our server.
- Pre-bake a sandbox snapshot with tsgo and ts-morph installed, so only the repo's own install remains (removes about 46 s).
- The map and copy sets come first: the copy finder only parses files (it never runs repo code), so it runs on our server straight after a shallow clone and shows copies within seconds. Install and the baseline run in the sandbox in the background before the first merge is allowed.
- Production credentials: a Vercel access token plus team and project id as host env vars (OIDC tokens from `vercel env pull` expire after 12 h).

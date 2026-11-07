# Connect Claude Code to Twins

Twins runs every merge through one action, `merge-twins`, and that action runs the type check itself. So when Claude Code sends Twins its own merge, Twins checks it in a sandbox and keeps it only if nothing got worse. Claude Code can say done; Twins can still say no.

You need Node 22 or newer, Claude Code, and a GitHub account to sign in to Twins.

## 1. Connect

In a terminal:

```bash
npx @agent-native/core@latest connect https://twins.jdollar.site --client claude-code
```

This writes a remote MCP entry for Twins into your Claude Code config. It holds no token.

## 2. Sign in

1. Start Claude Code (restart it if it was already open).
2. Run `/mcp`, pick the Twins server, and choose **Authenticate**.
3. Your browser opens Twins. Sign in and approve access. Claude Code now acts as you.

Check it worked: ask Claude Code "What Twins tools do you have?" It should list `import-repo`, `get-map`, `find-twins`, `compare-twins`, `read-file`, `merge-twins`, `undo-merge`, `export-patch` and `open-pull-request`.

## 3. Open the map next to the terminal

Open https://twins.jdollar.site/map in your browser, signed in with the same account. Every merge Claude Code makes shows up on the open map within about two seconds: the copies flash and merge on KEPT, or the cells flash red with a SAID NO stamp and a toast naming the caller.

Every tool result also ends with an **Open the map in Twins** link to that repo's map.

## 4. Try these prompts

**Find the copies**

```text
Use Twins to import https://github.com/cmonson66/nectarpay-crm and tell me which code was written more than once. Wait for the map to be ready.
```

**A merge Twins keeps**

```text
In that repo, merge the exact copies of createSupabaseFetch with Twins and tell me the numbers it reports.
```

Claude Code gets back one line such as:

```text
Kept: merged createSupabaseFetch into src/integrations/supabase/create-supabase-fetch.ts. 76 lines removed, 27 added; duplicate lines 59 to 21; type check 0 errors vs 0 at baseline; checked in 13.8s.
```

**A merge Twins refuses**

```text
Merge qrToDataURL and qrToString in src/lib/qr.ts yourself. Write a new src/lib/qr-shared.ts with one helper qrTo(kind) that is typed to return a number, then send your edits to merge-twins. Tell me exactly what Twins says.
```

The helper returns a string where it promised a number, so the type check gets worse. Twins refuses and Claude Code receives a tool error like this:

```text
Twins said no: this merge adds 1 type error the baseline does not have: src/lib/qr-shared.ts:2 TS2322 Type 'string' is not assignable to type 'number'. Nothing was changed. (errorCode: merge_refused)
```

On the open map, SAID NO stamps across the files Claude Code touched. Nothing in the repo changed, and the refusal stays in the map's history.

## In Claude chat apps

The same server works in Claude on the web and in Claude Desktop: add a custom connector with `https://twins.jdollar.site/mcp`. To get the map as an inline card in the chat, turn on **App cards in chat apps** in Twins under Settings, Labs, then reconnect the connector. The card shows the glowing copies, the duplicate line count and the last merge result. The Claude Code terminal shows the link instead.

## If something goes wrong

* **401 or "Authentication required"**: run `npx -y @agent-native/core@latest reconnect https://twins.jdollar.site --client claude-code`, then `/mcp` and **Authenticate** again.
* **Tools missing after connecting**: restart Claude Code so it reloads its MCP servers.
* **`not_ready`**: the sandbox is still preparing. Ask Claude Code to call `get-map` until the status is `ready`.

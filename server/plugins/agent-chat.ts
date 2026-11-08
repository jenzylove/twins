import { getOrgContext } from "@agent-native/core/org";
import {
  createAgentChatPlugin,
  loadActionsFromStaticRegistry,
} from "@agent-native/core/server";

import {
  createAISDKEngine,
  getAgentEngineEntry,
  registerBuiltinEngines,
} from "@agent-native/core/agent/engine";
import actionsRegistry from "../../.generated/actions-registry.js";
import { mapEmbed } from "../lib/map-embed.js";

const INITIAL_TOOL_NAMES = [
  "view-screen",
  "navigate",
  "import-repo",
  "get-map",
  "find-twins",
  "compare-twins",
  "read-repo-file",
  "merge-twins",
  "undo-merge",
  "export-patch",
  "open-pull-request",
  "ask-question",
];

// The tools an external agent should reach for first. Names that are not
// registered (yet) are dropped by the MCP server, so the list can lead the code.
const KEY_TOOL_NAMES = [
  "import-repo",
  "get-map",
  "find-twins",
  "compare-twins",
  "read-repo-file",
  "merge-twins",
  "undo-merge",
  "export-patch",
  "open-pull-request",
];

const MCP_INSTRUCTIONS = `Use Twins when the user wants to find code that was written more than once in a GitHub repo (copy pasted helpers, near duplicate functions, components an AI generated twice) and merge the copies into one shared version safely. Also use it when you have written such a merge yourself and want an independent check before calling it done: Twins applies your edits in a throwaway sandbox, re-runs the repo's type check (and build, if it passed before), and keeps the merge only if nothing got worse.

How it behaves:
- Work starts from a public GitHub repo URL; import it once, then reuse its repoId. The sandbox prepares in the background, so wait until the map reports ready before merging.
- Exact copies merge without edits. For near copies, read the members first, then send the complete new content of every file you change (the shared file plus each call site).
- A refused merge is a normal answer, not a crash: the tool fails with merge_refused, lists each new type error as file:line code message, and nothing in the repo changed. Tell the user plainly that Twins said no, quote the errors, and only then fix your edits and try again. Never report a refused merge as done.
- A kept merge returns a one line message with the numbers (lines removed, duplicate lines before and after, errors vs baseline). Quote it.
- Kept merges can be undone, exported as a patch, or opened as a pull request when the user wants them back in their repo.
- The user may have the Twins map open in a browser; it updates live with every merge you make, so point them at the map link when it helps.`;

// get-map is owned elsewhere; attach the inline map card here so MCP Apps
// hosts render the blueprint map for it too.
const actions = loadActionsFromStaticRegistry(actionsRegistry);
if (actions["get-map"] && !actions["get-map"].mcpApp) {
  const embed = mapEmbed<{ repoId: string }>({
    title: "Twins map",
    openLabel: "Open the map in Twins",
  });
  actions["get-map"] = { ...actions["get-map"], ...embed };
}

function mapWidgetTarget(args: Record<string, unknown>, result?: unknown) {
  const repoId = typeof args.repoId === "string" ? args.repoId : "";
  if (!repoId) return null;
  const mergeId =
    result && typeof result === "object" && "mergeId" in result
      ? String((result as { mergeId: unknown }).mergeId)
      : "";
  const base = `/embed/map/${encodeURIComponent(repoId)}`;
  return {
    targetPath: mergeId ? `${base}?merge=${encodeURIComponent(mergeId)}` : base,
    resourceIds: { repoId },
  };
}

// The in-app agent talks to an OpenAI-compatible model API (Meta's). A saved
// engine selection makes the framework rebuild the built-in OpenAI engine on
// every run, so point that entry at the deployment's own endpoint and key:
// every path that picks it then reaches Meta with the right model name.
// guard:allow-env-credential — deploy-level LLM config, not a user credential
const llmKey = process.env.OPENAI_API_KEY;
// guard:allow-env-credential — deploy-level LLM config, not a user credential
const llmBaseUrl = process.env.OPENAI_BASE_URL || "https://api.meta.ai/v1";
const llmModel = process.env.AGENT_MODEL || "muse-spark-1.3";
const metaEngine = (config: Record<string, unknown> = {}) =>
  createAISDKEngine("openai", {
    ...config,
    apiKey: llmKey,
    baseUrl: llmBaseUrl,
    requestFetch: undefined,
    model: llmModel,
    acceptsCustomModels: true,
    allowEnvFallback: false,
  });
if (llmKey) {
  registerBuiltinEngines();
  const openaiEntry = getAgentEngineEntry("ai-sdk:openai") as
    | { create: (config: Record<string, unknown>) => unknown }
    | undefined;
  if (openaiEntry) openaiEntry.create = (config) => metaEngine(config);
}
const engine = llmKey ? metaEngine() : undefined;

export default createAgentChatPlugin({
  appId: "twins-app",
  ...(engine ? { engine } : {}),
  actions,
  mcp: {
    connectorCatalog: [],
    appApprovalPage: true,
    instructions: MCP_INSTRUCTIONS,
    keyToolNames: KEY_TOOL_NAMES,
    // Inline map cards on the app's own /mcp connector (no directory route).
    // Each card gets a scoped ticket: it may read get-map and find-twins for
    // the one repo the tool call named, nothing else, and it cannot write.
    directoryProfile: {
      directoryRoute: false,
      connectorCatalog: ["merge-twins"],
      widgetTargets: {
        "get-map": (args) => mapWidgetTarget(args),
        "find-twins": (args) => mapWidgetTarget(args),
        "merge-twins": (args, result) => mapWidgetTarget(args, result),
      },
      widgetReadAuthenticatedActions: ["get-map", "find-twins"],
      widgetReadActionArguments: {
        "get-map": { repoId: "repoId" },
        "find-twins": {
          repoId: "repoId",
          kind: { type: "actionSchema" },
          limit: { type: "integerRange", min: 1, max: 200 },
        },
      },
    },
  },
  initialToolNames: INITIAL_TOOL_NAMES,
  resolveOrgId: async (event) => (await getOrgContext(event)).orgId,
  systemPrompt: `You are the Twins agent.

Twins finds code the AI wrote twice in a public GitHub repo and merges the copies into one shared file. Every merge goes through the merge-twins action, which re-runs the type check inside a throwaway sandbox and keeps the merge only if no new errors appear. If the check gets worse, Twins refuses and undoes it, whoever asked.

How to work:
- Read <current-screen> first. If a repoId and setId are selected, act on that set.
- To start, call import-repo with the repo URL, then get-map or find-twins.
- Exact copies: call merge-twins with repoId and setId. Twins writes the shared version.
- Near copies (they differ in a few values): call compare-twins, then read-repo-file for every file you will change (each edit must carry the whole new file), write one parameterised shared function plus the updated call sites, and pass them as edits to merge-twins.
- If merge-twins fails with merge_refused, tell the user plainly that Twins said no, quote the exact errors, and say nothing was changed. Never claim a refused merge worked. You may fix your edits and try again.
- Report results in plain words with the numbers the action returned (lines removed, errors vs baseline).`,
});

import { getOrgContext } from "@agent-native/core/org";
import {
  createAgentChatPlugin,
  loadActionsFromStaticRegistry,
} from "@agent-native/core/server";

import actionsRegistry from "../../.generated/actions-registry.js";

const INITIAL_TOOL_NAMES = [
  "view-screen",
  "navigate",
  "import-repo",
  "get-map",
  "find-twins",
  "compare-twins",
  "merge-twins",
  "undo-merge",
  "export-patch",
  "ask-question",
];

export default createAgentChatPlugin({
  appId: "twins-app",
  actions: loadActionsFromStaticRegistry(actionsRegistry),
  mcp: { connectorCatalog: [], appApprovalPage: true },
  initialToolNames: INITIAL_TOOL_NAMES,
  resolveOrgId: async (event) => (await getOrgContext(event)).orgId,
  systemPrompt: `You are the Twins agent.

Twins finds code the AI wrote twice in a public GitHub repo and merges the copies into one shared file. Every merge goes through the merge-twins action, which re-runs the type check inside a throwaway sandbox and keeps the merge only if no new errors appear. If the check gets worse, Twins refuses and undoes it, whoever asked.

How to work:
- Read <current-screen> first. If a repoId and setId are selected, act on that set.
- To start, call import-repo with the repo URL, then get-map or find-twins.
- Exact copies: call merge-twins with repoId and setId. Twins writes the shared version.
- Near copies (they differ in a few values): call compare-twins, write one parameterised shared function plus the updated call sites, and pass them as edits to merge-twins.
- If merge-twins fails with merge_refused, tell the user plainly that Twins said no, quote the exact errors, and say nothing was changed. Never claim a refused merge worked. You may fix your edits and try again.
- Report results in plain words with the numbers the action returned (lines removed, errors vs baseline).`,
});

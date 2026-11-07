import { embedRoute } from "@agent-native/core";
import type { ActionLinkBuilder, ActionMcpAppConfig } from "@agent-native/core/action";

/**
 * The compact blueprint map as an MCP App card. Hosts that render MCP Apps
 * (Claude, ChatGPT, Cursor...) load /embed/map/:repoId inline; every other
 * client gets an "Open the map" link to the full /map/:repoId page. The route is the real
 * React map (BlueprintMap) without app chrome, and it refetches live, so the
 * card shows a KEPT or SAID NO result as soon as it is recorded.
 */
export function mapEmbed<
  TArgs extends { repoId?: string },
  TResult = unknown,
>(options: {
  title: string;
  openLabel: string;
  /** The merge this card should lead with, when the call made one. */
  mergeId?: (ctx: { args: TArgs; result: TResult }) => string | undefined;
}): { link: ActionLinkBuilder; mcpApp: ActionMcpAppConfig } {
  const route = embedRoute<TArgs, TResult>({
    title: options.title,
    openLabel: options.openLabel,
    description:
      "Twins blueprint map: the copies glowing, duplicate lines, and the last merge result (kept or said no, with the exact errors).",
    iframeTitle: "Twins map",
    height: 520,
    path: ({ args, result }) => {
      const repoId = args?.repoId;
      if (!repoId) return null;
      const mergeId = options.mergeId?.({ args, result });
      const base = `/embed/map/${encodeURIComponent(repoId)}`;
      return mergeId ? `${base}?merge=${encodeURIComponent(mergeId)}` : base;
    },
  });
  // Text-only clients (the Claude Code terminal, Codex CLI) get the full map,
  // which flashes KEPT or SAID NO live; inline hosts get the compact card,
  // whose scoped target comes from mapWidgetTarget in the agent-chat plugin.
  const link: ActionLinkBuilder = ({ args }) => {
    const repoId = (args as TArgs | undefined)?.repoId;
    if (!repoId) return null;
    return { url: `/map/${encodeURIComponent(repoId)}`, label: options.openLabel };
  };
  // Keep the card visible in the compact catalog chat hosts discover.
  return { link, mcpApp: { ...route.mcpApp, compactCatalog: true } };
}

import { useParams, useSearchParams } from "react-router";

import { EmbedMap } from "@/components/twins/EmbedMap";

export function meta() {
  return [{ title: "Map card · Twins" }];
}

// MCP App card for get-map, find-twins and merge-twins (see
// server/lib/map-embed.ts). Rendered without app chrome by app/root.tsx.
export default function EmbedMapRoute() {
  const { repoId = "" } = useParams();
  const [params] = useSearchParams();
  return <EmbedMap key={repoId} repoId={repoId} mergeId={params.get("merge")} />;
}

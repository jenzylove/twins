import { useParams } from "react-router";

import { MapView } from "@/components/twins/MapView";

export function meta() {
  return [{ title: "Map · Twins" }];
}

export default function MapRoute() {
  const { repoId = "" } = useParams();
  return <MapView key={repoId} repoId={repoId} />;
}

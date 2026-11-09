import { MapView } from "@/components/twins/MapView";
import sample from "@/components/twins/sample.json";
import { SampleContext, type Sample } from "@/components/twins/use-twins";

export function meta() {
  return [
    { title: "A real map · Twins" },
    {
      name: "description",
      content:
        "A real Twins run on a public app built with an AI app builder: the copies it found, one merge kept, and one merge from Claude Code blocked.",
    },
  ];
}

// Public and read only: a recorded real run, so anyone can see the map before
// making an account.
export default function SampleRoute() {
  return (
    <SampleContext.Provider value={sample as Sample}>
      <MapView repoId="sample" />
    </SampleContext.Provider>
  );
}

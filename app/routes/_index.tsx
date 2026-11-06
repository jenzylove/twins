import { Landing } from "@/components/twins/Landing";

const SEO_TITLE = "Twins: your AI wrote it twice";
const SEO_DESCRIPTION =
  "Paste a GitHub repo. Twins finds the code your AI wrote twice, merges the copies into one shared file, and keeps the merge only if the app still type checks.";

export function meta() {
  return [
    { title: SEO_TITLE },
    { name: "description", content: SEO_DESCRIPTION },
    { property: "og:title", content: SEO_TITLE },
    { property: "og:description", content: SEO_DESCRIPTION },
    { name: "twitter:card", content: "summary" },
    { name: "twitter:title", content: SEO_TITLE },
    { name: "twitter:description", content: SEO_DESCRIPTION },
  ];
}

export default function IndexRoute() {
  return <Landing />;
}

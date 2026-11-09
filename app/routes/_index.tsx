import { Landing } from "@/components/twins/Landing";

const SEO_TITLE = "Twins: your AI wrote it twice";
const SEO_DESCRIPTION =
  "Paste a GitHub repo. Twins finds the code your AI wrote more than once and keeps one copy, so a fix lands everywhere, only if your app still builds with no new errors.";

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

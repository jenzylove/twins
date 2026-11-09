import { createToolkitAuthPlugin } from "@agent-native/toolkit/app/auth/server";

export default createToolkitAuthPlugin({
  // "/" is the public Twins landing page; sign-in stays at its own route and
  // every map route still needs a session.
  workspaceAppPublicPaths: ["/"],
  publicPaths: ["/"],
  rootAuth: false,
  marketing: {
    appName: "Twins",
    tagline: "Your AI wrote it twice. Twins keeps one.",
    description:
      "Paste a public GitHub repo. Twins finds the code written more than once and keeps one copy, only if your app still builds with no new errors.",
    features: [
      "A map of every copy, numbered, biggest first",
      "One click keeps one copy, tested on a private machine first",
      "Your coding agent can use it too, and gets the same safety test",
    ],
  },
});

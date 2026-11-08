import { createToolkitAuthPlugin } from "@agent-native/toolkit/app/auth/server";

export default createToolkitAuthPlugin({
  // "/" is the public Twins landing page; sign-in stays at its own route and
  // every map route still needs a session.
  workspaceAppPublicPaths: ["/"],
  publicPaths: ["/", "/api/diag-cimd"],
  rootAuth: false,
  marketing: false,
});

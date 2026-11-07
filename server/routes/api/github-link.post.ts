import { defineEventHandler } from "h3";
import {
  createBetterAuthSessionForEmail,
  getSession,
  setBetterAuthSessionCookie,
} from "@agent-native/core/server";

/**
 * Linking GitHub runs through Better Auth's link-social, which needs Better
 * Auth's own session cookie. The framework signs users in with its own cookie,
 * so give the signed-in user a Better Auth session first. Same user, same
 * email; nothing else changes.
 */
export default defineEventHandler(async (event) => {
  const session = await getSession(event);
  if (!session?.email) {
    return new Response(JSON.stringify({ message: "Sign in to Twins first." }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }
  const linked = await createBetterAuthSessionForEmail(session.email);
  if (!linked) {
    return new Response(
      JSON.stringify({ message: "This account cannot link GitHub right now." }),
      { status: 409, headers: { "content-type": "application/json" } },
    );
  }
  await setBetterAuthSessionCookie(event, linked.token);
  return { ok: true };
});

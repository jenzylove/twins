import { defineEventHandler, getQuery, redirect, setCookie } from "h3";
import { getSession } from "@agent-native/core/server";
import {
  STATE_COOKIE,
  callbackUrl,
  githubAppCredentials,
  newState,
  safeReturn,
} from "../../../lib/github-connect.js";

/** Send the signed in user to GitHub to grant Twins public_repo access. */
export default defineEventHandler(async (event) => {
  const session = await getSession(event);
  if (!session?.email) return redirect("/sign-in");
  const app = githubAppCredentials();
  if (!app) return new Response("GitHub is not configured on this server.", { status: 503 });
  const back = safeReturn(getQuery(event).return);
  const state = newState();
  setCookie(event, STATE_COOKIE, JSON.stringify({ state, back }), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/api/github",
    maxAge: 600,
  });
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", app.clientId);
  url.searchParams.set("redirect_uri", callbackUrl(event));
  url.searchParams.set("scope", "public_repo");
  url.searchParams.set("state", state);
  url.searchParams.set("allow_signup", "false");
  return redirect(url.toString());
});

import { defineEventHandler, deleteCookie, getCookie, getQuery, redirect } from "h3";
import { getSession } from "@agent-native/core/server";
import { saveOAuthTokens } from "@agent-native/core/oauth-tokens";
import {
  GITHUB_PROVIDER,
  STATE_COOKIE,
  callbackUrl,
  githubAppCredentials,
} from "../../../lib/github-connect.js";

function back(path: string, status: string): string {
  return `${path}${path.includes("?") ? "&" : "?"}github=${status}`;
}

/** GitHub returns here: check state, swap the code for a token, store it for this user. */
export default defineEventHandler(async (event) => {
  const session = await getSession(event);
  if (!session?.email) return redirect("/sign-in");
  let saved: { state?: string; back?: string } = {};
  try {
    saved = JSON.parse(getCookie(event, STATE_COOKIE) ?? "{}");
  } catch {
    saved = {};
  }
  deleteCookie(event, STATE_COOKIE, { path: "/api/github" });
  const returnTo = saved.back ?? "/map";
  const q = getQuery(event);
  const app = githubAppCredentials();
  if (!app || !saved.state || q.state !== saved.state || typeof q.code !== "string") {
    return redirect(back(returnTo, "failed"));
  }
  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: app.clientId,
      client_secret: app.clientSecret,
      code: q.code,
      redirect_uri: callbackUrl(event),
    }),
  });
  const token = (await tokenRes.json().catch(() => ({}))) as {
    access_token?: string;
    scope?: string;
  };
  if (!token.access_token) return redirect(back(returnTo, "failed"));
  const userRes = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${token.access_token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "twins-app",
    },
  });
  const user = (await userRes.json().catch(() => ({}))) as { login?: string };
  if (!user.login) return redirect(back(returnTo, "failed"));
  await saveOAuthTokens(
    GITHUB_PROVIDER,
    `${session.email.toLowerCase()}:${user.login}`,
    { access_token: token.access_token, scope: token.scope ?? "", login: user.login },
    session.email.toLowerCase(),
  );
  return redirect(back(returnTo, "connected"));
});

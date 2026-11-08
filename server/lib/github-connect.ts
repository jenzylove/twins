import crypto from "node:crypto";
import type { H3Event } from "h3";
import { getAppUrl } from "@agent-native/core/server";

/**
 * Twins asks GitHub for its own repo access token (public_repo) to open pull
 * requests. This is separate from sign in: it never links accounts, so the
 * GitHub email does not have to match the Twins email. Tokens live in the
 * framework OAuth token store (encrypted at rest), owned by the signed in user.
 */
export const GITHUB_PROVIDER = "twins-github";
export const STATE_COOKIE = "twins_gh_state";

export function githubAppCredentials(): { clientId: string; clientSecret: string } | null {
  // guard:allow-env-credential — deploy-level OAuth app config, not a user credential
  const clientId = process.env.GITHUB_CLIENT_ID;
  // guard:allow-env-credential — deploy-level OAuth app config, not a user credential
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

export function callbackUrl(event: H3Event): string {
  return getAppUrl(event, "/api/github/callback");
}

/** Only same site paths are allowed as the place to return to. */
export function safeReturn(value: unknown): string {
  const v = typeof value === "string" ? value : "";
  return v.startsWith("/") && !v.startsWith("//") && !v.includes("\\") ? v : "/map";
}

export function newState(): string {
  return crypto.randomBytes(24).toString("base64url");
}

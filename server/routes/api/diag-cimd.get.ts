import { defineEventHandler } from "h3";
import { ssrfSafeFetch } from "@agent-native/core/extensions/url-safety";

// Temporary: shows why the MCP OAuth client metadata fetch fails in production.
export default defineEventHandler(async () => {
  try {
    const r = await ssrfSafeFetch(
      "https://claude.ai/oauth/claude-code-client-metadata",
      { headers: { Accept: "application/json" } },
      { maxRedirects: 3, httpsOnly: true },
    );
    return { ok: true, status: r.status, type: r.headers.get("content-type") };
  } catch (e) {
    const err = e as Error & { cause?: unknown };
    return { ok: false, message: err.message, cause: String(err.cause ?? "") };
  }
});

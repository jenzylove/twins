// Relays the Twins agent's model calls to Meta's API (Meta does not serve the
// Railway network). Only requests carrying the Twins key are forwarded: the key
// is checked by its SHA-256 fingerprint, so this function never stores it.
export const config = { runtime: "edge" };

const UPSTREAM = "https://api.meta.ai/v1";

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default async function handler(req: Request): Promise<Response> {
  const auth = req.headers.get("authorization") ?? "";
  const key = auth.replace(/^Bearer\s+/i, "");
  // guard:allow-env-credential — separate Vercel relay project; a hash of the deploy key, not a user credential
  const allowed = (process.env.ALLOWED_KEY_SHA256 ?? "").trim();
  if (!key || !allowed || (await sha256(key)) !== allowed) {
    return new Response(JSON.stringify({ error: { message: "unauthorized" } }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }
  const url = new URL(req.url);
  const path = (url.searchParams.get("path") ?? "").replace(/^\/+/, "");
  url.searchParams.delete("path");
  const qs = url.searchParams.toString();
  const res = await fetch(`${UPSTREAM}/${path}${qs ? `?${qs}` : ""}`, {
    method: req.method,
    headers: {
      authorization: auth,
      "content-type": req.headers.get("content-type") ?? "application/json",
      accept: req.headers.get("accept") ?? "*/*",
    },
    body: req.method === "GET" || req.method === "HEAD" ? undefined : req.body,
    // @ts-expect-error duplex is required for streaming request bodies
    duplex: "half",
  });
  return new Response(res.body, {
    status: res.status,
    headers: { "content-type": res.headers.get("content-type") ?? "application/json" },
  });
}

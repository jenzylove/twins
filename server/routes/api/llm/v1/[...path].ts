import { defineEventHandler, getRequestHeader, readRawBody } from "h3";

/**
 * Pass-through to the Meta model API for the in-app agent. Only accepts our own
 * deploy key, logs the model name it was asked for, and forwards the request.
 */
export default defineEventHandler(async (event) => {
  // guard:allow-env-credential — deploy-level LLM config, not a user credential
  const key = process.env.OPENAI_API_KEY ?? "";
  // guard:allow-env-credential — deploy-level LLM config, not a user credential
  const upstream = (process.env.LLM_UPSTREAM_URL ?? "https://api.meta.ai/v1").replace(/\/+$/, "");
  const auth = getRequestHeader(event, "authorization") ?? "";
  if (!key || auth !== `Bearer ${key}`) {
    return new Response(JSON.stringify({ error: { message: "unauthorized" } }), { status: 401 });
  }
  const path = String(event.context.params?.path ?? "");
  const method = event.method;
  const body = method === "GET" || method === "HEAD" ? null : ((await readRawBody(event, "utf8")) ?? null);
  const m = body ? /"model"\s*:\s*"([^"]+)"/.exec(body) : null;
  console.log(`[llm-proxy] ${method} /${path} model=${m?.[1] ?? "-"}`);
  const res = await fetch(`${upstream}/${path}`, {
    method,
    headers: {
      authorization: auth,
      "content-type": getRequestHeader(event, "content-type") ?? "application/json",
      accept: getRequestHeader(event, "accept") ?? "*/*",
    },
    body,
  });
  if (!res.ok) console.log(`[llm-proxy] upstream ${res.status} for model=${m?.[1] ?? "-"}`);
  return new Response(res.body, {
    status: res.status,
    headers: { "content-type": res.headers.get("content-type") ?? "application/json" },
  });
});

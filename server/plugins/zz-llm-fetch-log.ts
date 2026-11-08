// Temporary diagnostic: logs host, path and status of outgoing LLM requests. No headers or bodies.
export default function llmFetchLog() {
  const orig = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const res = await orig(input as RequestInfo, init);
    if (/openai|meta\.ai|\/v1\/(responses|chat|models)/.test(url)) {
      const u = new URL(url);
      console.log(`[llm-fetch] ${init?.method ?? "GET"} ${u.host}${u.pathname} -> ${res.status}`);
    }
    return res;
  }) as typeof fetch;
}

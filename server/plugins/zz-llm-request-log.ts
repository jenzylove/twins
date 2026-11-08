// Temporary diagnostic: logs host, path and model name of outgoing LLM requests. No keys, no prompts.
import diagnostics from "node:diagnostics_channel";

export default function llmRequestLog() {
  diagnostics.channel("undici:request:create").subscribe((msg: unknown) => {
    const req = (msg as { request?: { origin?: unknown; path?: string; body?: unknown } }).request;
    if (!req?.path || !/\/v1\/(responses|chat)/.test(req.path)) return;
    let model = "?";
    const b = req.body;
    const text = typeof b === "string" ? b : b instanceof Uint8Array ? Buffer.from(b).toString("utf8") : "";
    const m = /"model"\s*:\s*"([^"]+)"/.exec(text);
    if (m) model = m[1]!;
    console.log(`[llm-request] ${String(req.origin)}${req.path} model=${model}`);
  });
}

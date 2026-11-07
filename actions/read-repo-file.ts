import fs from "node:fs";
import path from "node:path";
import { defineAction } from "@agent-native/core/action";
import { z } from "zod";
import {
  bail,
  ensureWorkdir,
  loadRepo,
  readOrNull,
  twinsErrors,
} from "../server/lib/twins.js";

const MAX_BYTES = 256 * 1024;

export default defineAction({
  description:
    "Read one whole file from an imported repo, as it is now (with every kept merge applied). Use it before merge-twins: each edit must carry the complete new content of the file, so read every file you will change first. Read only; nothing in the repo runs.",
  schema: z.object({
    repoId: z.string().describe("Repo id returned by import-repo"),
    path: z
      .string()
      .describe("Repo relative path, for example src/lib/qr.ts (from get-map, find-twins or compare-twins)"),
  }),
  outputSchema: z.object({
    path: z.string(),
    exists: z.boolean(),
    lines: z.number(),
    content: z.string().describe("Full file text; empty when the file does not exist"),
  }),
  http: { method: "GET" },
  mcpTool: true,
  mcpAnnotations: {
    readOnlyHint: true,
    destructiveHint: false,
    openWorldHint: false,
  },
  errors: twinsErrors,
  run: async (args, ctx) => {
    const row = await loadRepo(ctx, args.repoId);
    const rel = path.posix.normalize(args.path.replace(/\\/g, "/").replace(/^\.?\//, ""));
    if (
      rel === ".." ||
      rel.startsWith("../") ||
      path.posix.isAbsolute(rel) ||
      /^[A-Za-z]:/.test(rel) ||
      rel.split("/").some((s) => s === ".git" || s === "node_modules")
    ) {
      bail(`Cannot read "${args.path}": the path must stay inside the repo.`, "invalid_path", {
        statusCode: 400,
      });
    }
    const dir = await ensureWorkdir(row);
    const full = path.join(dir, rel);
    try {
      if (fs.statSync(full).size > MAX_BYTES) {
        bail(`"${rel}" is larger than 256 KB, too big to read here.`, "invalid_path", {
          statusCode: 413,
        });
      }
    } catch (err) {
      if ((err as { code?: string }).code !== "ENOENT") throw err;
    }
    const content = readOrNull(dir, rel);
    return {
      path: rel,
      exists: content !== null,
      lines: content === null ? 0 : content.split("\n").length,
      content: content ?? "",
    };
  },
});

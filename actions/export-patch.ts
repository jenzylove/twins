import { defineAction } from "@agent-native/core/action";
import { createTwoFilesPatch } from "diff";
import { z } from "zod";
import type { FileEdit } from "../server/engine/merge.js";
import { listMerges, loadRepo, twinsErrors } from "../server/lib/twins.js";

export default defineAction({
  description:
    "Export a unified diff of all kept merges against the original repo at its imported commit. Returns the patch as text, ready for git apply.",
  schema: z.object({
    repoId: z.string().describe("Repo id returned by import-repo"),
  }),
  outputSchema: z.object({
    patch: z.string().describe("Unified diff text; empty when nothing is kept"),
    files: z.array(z.string()),
    mergesKept: z.number(),
    linesAdded: z.number(),
    linesRemoved: z.number(),
  }),
  http: { method: "GET" },
  mcpTool: true,
  errors: twinsErrors,
  run: async (args, ctx) => {
    const row = await loadRepo(ctx, args.repoId);
    const merges = (await listMerges(row.id)).filter((m) => m.status === "kept");
    // original = `before` of the first kept edit per file; final = `after` of the last.
    const original = new Map<string, string | null>();
    const final = new Map<string, string | null>();
    for (const m of merges) {
      for (const e of JSON.parse(m.editsJson) as FileEdit[]) {
        if (!original.has(e.path)) original.set(e.path, e.before);
        final.set(e.path, e.after);
      }
    }
    const parts: string[] = [];
    const files: string[] = [];
    let linesAdded = 0;
    let linesRemoved = 0;
    for (const p of [...final.keys()].sort()) {
      const a = original.get(p) ?? null;
      const b = final.get(p) ?? null;
      if (a === b) continue;
      const oldName = a === null ? "/dev/null" : `a/${p}`;
      const newName = b === null ? "/dev/null" : `b/${p}`;
      const body = createTwoFilesPatch(oldName, newName, a ?? "", b ?? "", "", "", {
        context: 3,
      });
      const lines = body.split("\n").filter((l) => !l.startsWith("Index: ") && !/^=+$/.test(l));
      for (const l of lines) {
        if (l.startsWith("+") && !l.startsWith("+++")) linesAdded++;
        else if (l.startsWith("-") && !l.startsWith("---")) linesRemoved++;
      }
      const header = `diff --git a/${p} b/${p}\n${a === null ? "new file mode 100644\n" : ""}${b === null ? "deleted file mode 100644\n" : ""}`;
      parts.push(header + lines.join("\n").replace(/\n*$/, "\n"));
      files.push(p);
    }
    return {
      patch: parts.join(""),
      files,
      mergesKept: merges.length,
      linesAdded,
      linesRemoved,
    };
  },
});

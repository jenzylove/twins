import { sql } from "drizzle-orm";
import { boolean, integer, pgTable, text } from "drizzle-orm/pg-core";
import { defineMachine } from "@agent-native/core/state-machine";

export const repos = pgTable("repos", {
  id: text("id").primaryKey(),
  ownerEmail: text("owner_email").notNull(),
  orgId: text("org_id"),
  repoOwner: text("repo_owner").notNull(),
  repoName: text("repo_name").notNull(),
  sha: text("sha").notNull(),
  defaultBranch: text("default_branch").notNull(),
  htmlUrl: text("html_url").notNull(),
  status: text("status", {
    enum: ["scanning", "preparing", "ready", "failed"],
  })
    .notNull()
    .default("scanning"),
  statusDetail: text("status_detail"),
  sandboxId: text("sandbox_id"),
  scanJson: text("scan_json"),
  baselineJson: text("baseline_json"),
  hasBuild: boolean("has_build").notNull().default(false),
  createdAt: text("created_at")
    .notNull()
    .default(sql`now()`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`now()`),
});

export const merges = pgTable("merges", {
  id: text("id").primaryKey(),
  repoId: text("repo_id").notNull(),
  ownerEmail: text("owner_email").notNull(),
  orgId: text("org_id"),
  setId: text("set_id").notNull(),
  status: text("status", { enum: ["kept", "refused", "undone"] })
    .notNull()
    .default("kept"),
  mode: text("mode", { enum: ["auto", "agent"] })
    .notNull()
    .default("auto"),
  caller: text("caller").notNull().default("unknown"),
  sharedPath: text("shared_path").notNull().default(""),
  editsJson: text("edits_json").notNull().default("[]"),
  linesRemoved: integer("lines_removed").notNull().default(0),
  linesAdded: integer("lines_added").notNull().default(0),
  addedDiagsJson: text("added_diags_json").notNull().default("[]"),
  checkMs: integer("check_ms").notNull().default(0),
  summary: text("summary").notNull().default(""),
  setName: text("set_name").notNull().default(""),
  createdAt: text("created_at")
    .notNull()
    .default(sql`now()`),
});

/** Repo lifecycle: scanning -> preparing -> ready, or failed at any point. */
export const repoMachine = defineMachine({
  id: "twins-repo",
  states: ["scanning", "preparing", "ready", "failed"],
  initial: "scanning",
  terminal: [],
  transitions: {
    scanned: { from: ["scanning"], to: "preparing" },
    prepared: { from: ["preparing"], to: "ready" },
    fail: { from: ["scanning", "preparing", "ready"], to: "failed" },
    reprepare: { from: ["ready", "failed", "preparing"], to: "preparing" },
  },
});

/**
 * Merge lifecycle: a merge is checked, then kept or refused; a kept merge can
 * be undone. Only kept, refused and undone are ever stored.
 */
export const mergeMachine = defineMachine({
  id: "twins-merge",
  states: ["checking", "kept", "refused", "undone"],
  initial: "checking",
  terminal: ["refused", "undone"],
  transitions: {
    keep: { from: ["checking"], to: "kept" },
    refuse: { from: ["checking"], to: "refused" },
    undo: { from: ["kept"], to: "undone" },
  },
});

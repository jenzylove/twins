import { runMigrations } from "@agent-native/core/db";

export default runMigrations(
  [
    {
      version: 1,
      name: "repos-and-merges",
      sql: `CREATE TABLE IF NOT EXISTS repos (
  id TEXT PRIMARY KEY,
  owner_email TEXT NOT NULL,
  org_id TEXT,
  repo_owner TEXT NOT NULL,
  repo_name TEXT NOT NULL,
  sha TEXT NOT NULL,
  default_branch TEXT NOT NULL,
  html_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'scanning' CHECK (status IN ('scanning', 'preparing', 'ready', 'failed')),
  status_detail TEXT,
  sandbox_id TEXT,
  scan_json TEXT,
  baseline_json TEXT,
  has_build BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TEXT NOT NULL DEFAULT (now()),
  updated_at TEXT NOT NULL DEFAULT (now())
);
CREATE TABLE IF NOT EXISTS merges (
  id TEXT PRIMARY KEY,
  repo_id TEXT NOT NULL,
  owner_email TEXT NOT NULL,
  org_id TEXT,
  set_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'kept' CHECK (status IN ('kept', 'refused', 'undone')),
  mode TEXT NOT NULL DEFAULT 'auto' CHECK (mode IN ('auto', 'agent')),
  caller TEXT NOT NULL DEFAULT 'unknown',
  shared_path TEXT NOT NULL DEFAULT '',
  edits_json TEXT NOT NULL DEFAULT '[]',
  lines_removed INTEGER NOT NULL DEFAULT 0,
  lines_added INTEGER NOT NULL DEFAULT 0,
  added_diags_json TEXT NOT NULL DEFAULT '[]',
  check_ms INTEGER NOT NULL DEFAULT 0,
  summary TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (now())
);
CREATE INDEX IF NOT EXISTS repos_owner_created_idx ON repos (owner_email, created_at);
CREATE INDEX IF NOT EXISTS merges_repo_created_idx ON merges (repo_id, created_at);
CREATE INDEX IF NOT EXISTS merges_owner_idx ON merges (owner_email)`,
    },
  ],
  { table: "twins_app_migrations" },
);

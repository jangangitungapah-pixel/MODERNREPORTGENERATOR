PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS workspace_states (
  workspace_id TEXT PRIMARY KEY NOT NULL,
  active_incident_id TEXT NOT NULL DEFAULT '',
  payload_json TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  checksum TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  updated_by TEXT NOT NULL,
  FOREIGN KEY (workspace_id)
    REFERENCES workspaces(id)
    ON DELETE CASCADE,
  FOREIGN KEY (updated_by)
    REFERENCES app_users(uid)
);

CREATE INDEX IF NOT EXISTS idx_workspace_states_updated
  ON workspace_states(updated_at);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  workspace_id TEXT NOT NULL,
  request_key TEXT NOT NULL,
  actor_uid TEXT NOT NULL,
  response_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (workspace_id, request_key),
  FOREIGN KEY (workspace_id)
    REFERENCES workspaces(id)
    ON DELETE CASCADE,
  FOREIGN KEY (actor_uid)
    REFERENCES app_users(uid)
);

CREATE INDEX IF NOT EXISTS idx_idempotency_created
  ON idempotency_keys(created_at);

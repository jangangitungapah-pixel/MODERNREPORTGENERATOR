PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS app_users (
  uid TEXT PRIMARY KEY NOT NULL,
  email TEXT,
  display_name TEXT,
  role TEXT NOT NULL DEFAULT 'operator',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY NOT NULL,
  owner_uid TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (owner_uid)
    REFERENCES app_users(uid)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_workspaces_owner
  ON workspaces(owner_uid);

CREATE TABLE IF NOT EXISTS workspace_members (
  workspace_id TEXT NOT NULL,
  uid TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'operator',
  created_at INTEGER NOT NULL,
  FOREIGN KEY (workspace_id)
    REFERENCES workspaces(id)
    ON DELETE CASCADE,
  FOREIGN KEY (uid)
    REFERENCES app_users(uid)
    ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_workspace_member
  ON workspace_members(workspace_id, uid);

CREATE INDEX IF NOT EXISTS idx_workspace_member_uid
  ON workspace_members(uid);

CREATE TABLE IF NOT EXISTS incidents (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL,
  lifecycle TEXT NOT NULL DEFAULT 'active',
  region TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  ticket TEXT NOT NULL DEFAULT '',
  occur_time TEXT NOT NULL DEFAULT '',
  dispatch_time TEXT NOT NULL DEFAULT '',
  pic TEXT NOT NULL DEFAULT '',
  rootcause TEXT NOT NULL DEFAULT '',
  cut_point TEXT NOT NULL DEFAULT '',
  primary_marker TEXT,
  status_tag TEXT,
  revision INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  FOREIGN KEY (workspace_id)
    REFERENCES workspaces(id)
    ON DELETE CASCADE,
  FOREIGN KEY (created_by)
    REFERENCES app_users(uid),
  FOREIGN KEY (updated_by)
    REFERENCES app_users(uid)
);

CREATE INDEX IF NOT EXISTS idx_incidents_workspace_updated
  ON incidents(workspace_id, updated_at);

CREATE INDEX IF NOT EXISTS idx_incidents_ticket
  ON incidents(ticket);

CREATE INDEX IF NOT EXISTS idx_incidents_lifecycle
  ON incidents(workspace_id, lifecycle);

CREATE TABLE IF NOT EXISTS progress_entries (
  id TEXT PRIMARY KEY NOT NULL,
  incident_id TEXT NOT NULL,
  date TEXT,
  time TEXT NOT NULL,
  text TEXT NOT NULL,
  kind TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (incident_id)
    REFERENCES incidents(id)
    ON DELETE CASCADE,
  FOREIGN KEY (created_by)
    REFERENCES app_users(uid)
);

CREATE INDEX IF NOT EXISTS idx_progress_incident_position
  ON progress_entries(incident_id, position);

CREATE TABLE IF NOT EXISTS impact_links (
  id TEXT PRIMARY KEY NOT NULL,
  incident_id TEXT NOT NULL,
  marker TEXT NOT NULL DEFAULT 'unknown',
  region TEXT NOT NULL DEFAULT '',
  status_tag TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  ticket TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (incident_id)
    REFERENCES incidents(id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_impact_incident_position
  ON impact_links(incident_id, position);

CREATE TABLE IF NOT EXISTS cut_points (
  id TEXT PRIMARY KEY NOT NULL,
  incident_id TEXT NOT NULL,
  label TEXT NOT NULL,
  rootcause TEXT NOT NULL DEFAULT '',
  cut_point TEXT NOT NULL DEFAULT '',
  marker TEXT NOT NULL DEFAULT 'unknown',
  position INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (incident_id)
    REFERENCES incidents(id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_cut_point_incident_position
  ON cut_points(incident_id, position);

CREATE TABLE IF NOT EXISTS closure_states (
  incident_id TEXT PRIMARY KEY NOT NULL,
  statement_up_wag INTEGER NOT NULL DEFAULT 0,
  matoa_status_tt INTEGER NOT NULL DEFAULT 0,
  matoa_event_and_photo INTEGER NOT NULL DEFAULT 0,
  matoa_rfo INTEGER NOT NULL DEFAULT 0,
  sent_closed_email INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (incident_id)
    REFERENCES incidents(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS recovery_snapshots (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL,
  incident_id TEXT,
  reason TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER,
  FOREIGN KEY (workspace_id)
    REFERENCES workspaces(id)
    ON DELETE CASCADE,
  FOREIGN KEY (created_by)
    REFERENCES app_users(uid)
);

CREATE INDEX IF NOT EXISTS idx_recovery_workspace_created
  ON recovery_snapshots(workspace_id, created_at);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL,
  incident_id TEXT,
  actor_uid TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT,
  request_id TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (workspace_id)
    REFERENCES workspaces(id)
    ON DELETE CASCADE,
  FOREIGN KEY (actor_uid)
    REFERENCES app_users(uid)
);

CREATE INDEX IF NOT EXISTS idx_audit_workspace_created
  ON audit_events(workspace_id, created_at);

CREATE INDEX IF NOT EXISTS idx_audit_incident_created
  ON audit_events(incident_id, created_at);

CREATE TABLE IF NOT EXISTS sync_metadata (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

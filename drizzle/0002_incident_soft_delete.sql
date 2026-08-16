DROP TRIGGER IF EXISTS trg_incidents_soft_delete;

CREATE INDEX IF NOT EXISTS idx_incidents_workspace_deleted
  ON incidents(workspace_id, deleted_at);

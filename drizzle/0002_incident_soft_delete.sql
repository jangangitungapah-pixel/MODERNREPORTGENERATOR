CREATE TRIGGER IF NOT EXISTS trg_incidents_soft_delete
BEFORE DELETE ON incidents
FOR EACH ROW
WHEN OLD.deleted_at IS NULL
BEGIN
  UPDATE incidents
  SET
    lifecycle = 'archived',
    deleted_at = CAST(strftime('%s', 'now') AS INTEGER) * 1000,
    updated_at = CAST(strftime('%s', 'now') AS INTEGER) * 1000
  WHERE id = OLD.id;

  SELECT RAISE(IGNORE);
END;

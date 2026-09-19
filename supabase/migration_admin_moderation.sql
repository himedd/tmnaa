-- ============================================================
-- 300K Edits Admin Moderation — moderation data, audit + reports
-- Run AFTER migration_likes_aspect.sql in Supabase Dashboard -> SQL Editor.
-- Idempotent: safe to run more than once.
-- ============================================================

-- 1) Moderation columns on wall_submissions
ALTER TABLE wall_submissions
  ADD COLUMN IF NOT EXISTS device_id       TEXT,
  ADD COLUMN IF NOT EXISTS file_hash       TEXT,
  ADD COLUMN IF NOT EXISTS phash           TEXT,
  ADD COLUMN IF NOT EXISTS reject_reason   TEXT,
  ADD COLUMN IF NOT EXISTS internal_note   TEXT,
  ADD COLUMN IF NOT EXISTS reviewing_by    TEXT,
  ADD COLUMN IF NOT EXISTS reviewing_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trash_media_key TEXT,
  ADD COLUMN IF NOT EXISTS trash_poster_key TEXT;

-- 2) Audit log — every moderation action (approve/reject/undo/update/note/...)
CREATE TABLE IF NOT EXISTS wall_actions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id  UUID NOT NULL REFERENCES wall_submissions(id) ON DELETE CASCADE,
  action         TEXT NOT NULL,
  admin          TEXT,
  reason         TEXT,
  note           TEXT,
  meta           JSONB,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wall_actions_submission_idx ON wall_actions (submission_id);
CREATE INDEX IF NOT EXISTS wall_actions_created_idx    ON wall_actions (created_at DESC);
CREATE INDEX IF NOT EXISTS wall_actions_action_idx     ON wall_actions (action);

-- 3) Public report flags (spam / inappropriate / ...)
CREATE TABLE IF NOT EXISTS wall_reports (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id  UUID NOT NULL REFERENCES wall_submissions(id) ON DELETE CASCADE,
  device_id      TEXT NOT NULL,
  reason         TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (submission_id, device_id)
);

CREATE INDEX IF NOT EXISTS wall_reports_submission_idx ON wall_reports (submission_id);
CREATE INDEX IF NOT EXISTS wall_reports_created_idx    ON wall_reports (created_at DESC);

-- anon/authenticated users cannot touch these tables; the API uses the service role.
ALTER TABLE wall_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE wall_reports ENABLE ROW LEVEL SECURITY;
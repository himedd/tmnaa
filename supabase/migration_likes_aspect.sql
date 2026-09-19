-- ============================================================
-- 300K Edits Wall — likes table + aspect ratio / transcode flags
-- Run this once in Supabase Dashboard -> SQL Editor, then confirm.
-- Idempotent: safe to run more than once.
-- ============================================================

-- 1) Aspect ratio + transcode status on wall_submissions
ALTER TABLE wall_submissions
  ADD COLUMN IF NOT EXISTS width INT,
  ADD COLUMN IF NOT EXISTS height INT,
  ADD COLUMN IF NOT EXISTS transcoded BOOLEAN NOT NULL DEFAULT false;

-- 2) Per-device likes
CREATE TABLE IF NOT EXISTS wall_likes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id  UUID NOT NULL REFERENCES wall_submissions(id) ON DELETE CASCADE,
  device_id      TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (submission_id, device_id)
);

CREATE INDEX IF NOT EXISTS wall_likes_submission_idx ON wall_likes (submission_id);
CREATE INDEX IF NOT EXISTS wall_likes_device_idx     ON wall_likes (device_id);

-- anon cannot touch the likes table at all (app goes through the edge API)
ALTER TABLE wall_likes ENABLE ROW LEVEL SECURITY;

-- 3) Atomic like counter (avoids read-modify-write races)
CREATE OR REPLACE FUNCTION adjust_likes(target uuid, delta int)
RETURNS int
LANGUAGE sql
AS $$
  UPDATE wall_submissions
     SET likes = GREATEST(0, COALESCE(likes, 0) + delta)
   WHERE id = target
   RETURNING COALESCE(likes, 0);
$$;

-- Only the service role may adjust the counter (anon/authenticated can't reach it)
REVOKE ALL ON FUNCTION adjust_likes(uuid, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION adjust_likes(uuid, int) FROM anon, authenticated;
GRANT ALL ON FUNCTION adjust_likes(uuid, int) TO service_role;
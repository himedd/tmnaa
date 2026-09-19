-- ============================================================
-- 300K Edits Wall — anti-abuse / flood protection
-- Run AFTER migration_admin_moderation.sql in Supabase Dashboard -> SQL Editor.
-- Idempotent: safe to run more than once.
--
-- Adds a submitter_ip column so the API can rate-limit submissions by IP
-- as well as by device, and indexes the columns the quota queries rely on.
-- ============================================================

-- 1) Where the request came from (best-effort, from proxy headers).
ALTER TABLE wall_submissions
  ADD COLUMN IF NOT EXISTS submitter_ip TEXT;

-- 2) Speed up the per-device / per-IP quota and pending-queue counts.
CREATE INDEX IF NOT EXISTS wall_submissions_device_created_idx
  ON wall_submissions (device_id, created_at DESC);
CREATE INDEX IF NOT EXISTS wall_submissions_ip_created_idx
  ON wall_submissions (submitter_ip, created_at DESC);
CREATE INDEX IF NOT EXISTS wall_submissions_status_created_idx
  ON wall_submissions (status, created_at DESC);
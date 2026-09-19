import { pendingSubmissionCount, submissionCountFor } from './supabase.js';

// Per-edge-instance burst guard — coarse but cheap. The authoritative limits
// below are enforced against the database so they hold across instances.
const BURST_WINDOW_MS = 60_000;
const BURST_MAX = 4;

const HOURLY_LIMIT = Number(process.env.MAX_SUBMISSIONS_PER_HOUR ?? 3);
const DAILY_LIMIT = Number(process.env.MAX_SUBMISSIONS_PER_DAY ?? 6);
const PENDING_CAP = Number(process.env.MAX_PENDING_QUEUE ?? 150);

const bursts = new Map();

function burstKey(deviceId, ip) {
  return `${ip}::${deviceId}`;
}

/** Allow at most BURST_MAX submission requests per minute per device+IP. */
export function allowSubmissionBurst(deviceId, ip) {
  const now = Date.now();
  const key = burstKey(deviceId, ip);
  const arr = (bursts.get(key) ?? []).filter((t) => now - t < BURST_WINDOW_MS);
  if (arr.length >= BURST_MAX) return false;
  arr.push(now);
  bursts.set(key, arr);
  return true;
}

/** Best-effort client IP from proxy headers (Vercel / Cloudflare / Render). */
export function ipOf(request) {
  const fwd = String(request.headers.get('x-forwarded-for') ?? '');
  const first = (fwd.split(',')[0] ?? '').trim();
  if (first) return first;
  return String(request.headers.get('cf-connecting-ip') ?? '').trim() || 'unknown';
}

/**
 * Authoritative anti-abuse checks. Counts are matched against the device ID
 * AND the submitter IP in the DB (so they hold across edge instances and even
 * if a spambot rotates device IDs). Returns a short error code to reject
 * with, or null to allow.
 */
export async function submissionGuard(deviceId, ip) {
  if (DAILY_LIMIT > 0) {
    const daily = await submissionCountFor(deviceId, ip, 24 * 60 * 60 * 1000);
    if (daily != null && daily >= DAILY_LIMIT) return 'too_many_uploads';
  }
  if (HOURLY_LIMIT > 0) {
    const hourly = await submissionCountFor(deviceId, ip, 60 * 60 * 1000);
    if (hourly != null && hourly >= HOURLY_LIMIT) return 'too_many_uploads';
  }
  if (PENDING_CAP > 0) {
    const pending = await pendingSubmissionCount();
    if (pending != null && pending >= PENDING_CAP) return 'queue_full';
  }
  return null;
}
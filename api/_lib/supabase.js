const SUPABASE_URL = (process.env.SUPABASE_URL ?? '').replace(/\/+$/, '');
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE ?? '';
const ADMIN_USER_ID = process.env.ADMIN_USER_ID ?? '';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? '';
const TABLE = 'wall_submissions';

function assertConfigured() {
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    throw new Error('SUPABASE_NOT_CONFIGURED');
  }
}

function authHeaders() {
  return {
    apikey: SERVICE_ROLE,
    Authorization: `Bearer ${SERVICE_ROLE}`,
    'Content-Type': 'application/json',
  };
}

export async function getRow(id) {
  assertConfigured();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}?id=eq.${encodeURIComponent(id)}&select=*`, {
    headers: authHeaders(),
  });
  if (!res.ok) return null;
  const rows = await res.json();
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return rows[0];
}

export async function createRow(payload) {
  assertConfigured();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}`, {
    method: 'POST',
    headers: { ...authHeaders(), Prefer: 'return=minimal' },
    body: JSON.stringify(payload),
  });
  if (!res.ok && res.status !== 201) {
    const text = await res.text().catch(() => '');
    const err = new Error(`DB_INSERT_FAILED:${res.status}:${text.slice(0, 200)}`);
    err.code = 'DB_INSERT_FAILED';
    throw err;
  }
}

export async function updateRow(id, patch) {
  assertConfigured();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(patch),
  });
  if (!res.ok && res.status !== 204) {
    throw new Error('DB_UPDATE_FAILED');
  }
}

export async function listRows(status, limit = 500) {
  assertConfigured();
  let path = `${SUPABASE_URL}/rest/v1/${TABLE}?select=*&order=created_at.desc&limit=${limit}`;
  if (status) path += `&status=eq.${encodeURIComponent(status)}`;
  const res = await fetch(path, { headers: authHeaders() });
  if (!res.ok) return [];
  const rows = await res.json();
  return Array.isArray(rows) ? rows : [];
}

export async function statusCounts() {
  assertConfigured();
  const totals = { pending: 0, approved: 0, rejected: 0 };
  for (const status of ['pending', 'approved', 'rejected']) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/${TABLE}?select=id&status=eq.${status}&limit=1`,
      {
        headers: { ...authHeaders(), Prefer: 'count=exact' },
      },
    );
    if (!res.ok) continue;
    const rows = await res.json();
    const range = res.headers.get('content-range') ?? '';
    const match = range.match(/\/(\d+)$/);
    totals[status] = match ? Number(match[1]) : Array.isArray(rows) ? rows.length : 0;
  }
  return totals;
}

/** Exact count of rows created by a device within a rolling window (anti-spam). */
export async function submissionCountForDevice(deviceId, sinceMs) {
  return submissionCountFor(deviceId, null, sinceMs);
}

/**
 * Exact count of rows created by the same device OR the same submitter IP
 * within a rolling window. Used by the anti-abuse guards — counting on either
 * dimension stops attackers who try to evade by rotating device IDs. If the
 * submitter_ip column does not exist yet, falls back to device-only counting.
 */
export async function submissionCountFor(deviceId, ip, sinceMs) {
  assertConfigured();
  const since = new Date(Date.now() - sinceMs).toISOString();
  const orParts = [];
  if (deviceId) orParts.push(`device_id.eq.${deviceId}`);
  const normIp = (ip ?? '').trim();
  if (normIp && normIp !== 'unknown') orParts.push(`submitter_ip.eq.${normIp}`);
  if (orParts.length === 0) return null;

  const query = async (filters) => {
    const qs = encodeURIComponent(`or=(${filters.join(',')})`);
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/${TABLE}?select=id&created_at=gte.${encodeURIComponent(since)}&${qs}&limit=1`,
      { headers: { ...authHeaders(), Prefer: 'count=exact' } },
    );
    if (!res.ok) return null;
    const rows = await res.json();
    const range = res.headers.get('content-range') ?? '';
    const match = range.match(/\/(\d+)$/);
    return match ? Number(match[1]) : Array.isArray(rows) ? rows.length : 0;
  };

  const full = await query(orParts);
  if (full != null) return full;
  if (deviceId) {
    const deviceOnly = await query([`device_id.eq.${deviceId}`]);
    if (deviceOnly != null) return deviceOnly;
  }
  return null;
}

/** Exact count of rows still awaiting moderation (queues flood protection). */
export async function pendingSubmissionCount() {
  assertConfigured();
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/${TABLE}?select=id&status=eq.pending&limit=1`,
    { headers: { ...authHeaders(), Prefer: 'count=exact' } },
  );
  if (!res.ok) return null;
  const rows = await res.json();
  const range = res.headers.get('content-range') ?? '';
  const match = range.match(/\/(\d+)$/);
  return match ? Number(match[1]) : Array.isArray(rows) ? rows.length : 0;
}

/** Resolve a Supabase Auth access token to a user object, or null. */
export async function userFromToken(token) {
  if (!token) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: SERVICE_ROLE,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export function isAdminUser(user) {
  if (!user) return false;
  if (!user.id) return false;
  if (ADMIN_USER_ID && String(user.id) === String(ADMIN_USER_ID)) return true;
  if (ADMIN_EMAIL && String(user.email ?? '').toLowerCase() === String(ADMIN_EMAIL).toLowerCase()) return true;
  return false;
}

export async function authenticate(request) {
  const header = request.headers.get('authorization') ?? '';
  const token = header.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  const user = await userFromToken(token);
  return isAdminUser(user) ? user : null;
}

// ---------------------------------------------------------------------------
// per-device likes
// ---------------------------------------------------------------------------

const LIKES_TABLE = 'wall_likes';

export async function findLike(submissionId, deviceId) {
  assertConfigured();
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/${LIKES_TABLE}?select=id&submission_id=eq.${encodeURIComponent(submissionId)}&device_id=eq.${encodeURIComponent(deviceId)}&limit=1`,
    { headers: authHeaders() },
  );
  if (!res.ok) return null;
  const rows = await res.json();
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

export async function createLike(submissionId, deviceId) {
  assertConfigured();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${LIKES_TABLE}`, {
    method: 'POST',
    headers: { ...authHeaders(), Prefer: 'return=minimal' },
    body: JSON.stringify({ submission_id: submissionId, device_id: deviceId }),
  });
  return res.ok || res.status === 201 || res.status === 409;
}

export async function deleteLike(submissionId, deviceId) {
  assertConfigured();
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/${LIKES_TABLE}?submission_id=eq.${encodeURIComponent(submissionId)}&device_id=eq.${encodeURIComponent(deviceId)}`,
    { method: 'DELETE', headers: authHeaders() },
  );
  return res.ok || res.status === 204;
}

export async function likedIdsForDevice(deviceId) {
  assertConfigured();
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/${LIKES_TABLE}?select=submission_id&device_id=eq.${encodeURIComponent(deviceId)}&limit=2000`,
    { headers: authHeaders() },
  );
  if (!res.ok) return [];
  const rows = await res.json();
  if (!Array.isArray(rows)) return [];
  return rows.map((r) => String(r.submission_id));
}

// ---------------------------------------------------------------------------
// moderation: audit log (wall_actions) + report flags (wall_reports)
// ---------------------------------------------------------------------------

const ACTIONS_TABLE = 'wall_actions';
const REPORTS_TABLE = 'wall_reports';

function text(v, max) {
  return typeof v === 'string' ? v.slice(0, max ?? 2000) : v ?? null;
}

export async function insertAction({ submissionId, action, admin, reason, note, meta }) {
  assertConfigured();
  const payload = { submission_id: submissionId, action, admin, reason, note };
  if (meta && typeof meta === 'object') payload.meta = meta;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${ACTIONS_TABLE}`, {
    method: 'POST',
    headers: { ...authHeaders(), Prefer: 'return=minimal' },
    body: JSON.stringify(payload),
  });
  if (!res.ok && res.status !== 201) throw new Error('DB_INSERT_FAILED');
  return payload;
}

export async function latestAction(submissionId) {
  assertConfigured();
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/${ACTIONS_TABLE}?select=id,action,admin,reason,note,meta,created_at&submission_id=eq.${encodeURIComponent(submissionId)}&order=created_at.desc&limit=1`,
    { headers: authHeaders() },
  );
  if (!res.ok) return null;
  const rows = await res.json();
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

export async function listActions(limit = 500) {
  assertConfigured();
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/${ACTIONS_TABLE}?select=id,submission_id,action,admin,reason,note,meta,created_at&order=created_at.desc&limit=${limit}`,
    { headers: authHeaders() },
  );
  if (!res.ok) return [];
  const rows = await res.json();
  return Array.isArray(rows) ? rows : [];
}

export async function listReports(limit = 500) {
  assertConfigured();
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/${REPORTS_TABLE}?select=id,submission_id,device_id,reason,created_at&order=created_at.desc&limit=${limit}`,
    { headers: authHeaders() },
  );
  if (!res.ok) return [];
  const rows = await res.json();
  return Array.isArray(rows) ? rows : [];
}

export async function findReport(submissionId, deviceId) {
  assertConfigured();
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/${REPORTS_TABLE}?select=id&submission_id=eq.${encodeURIComponent(submissionId)}&device_id=eq.${encodeURIComponent(deviceId)}&limit=1`,
    { headers: authHeaders() },
  );
  if (!res.ok) return null;
  const rows = await res.json();
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

export async function deleteReports(submissionId) {
  assertConfigured();
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/${REPORTS_TABLE}?submission_id=eq.${encodeURIComponent(submissionId)}`,
    { method: 'DELETE', headers: authHeaders() },
  );
  return res.ok || res.status === 204;
}

/** Count reports created by a device within `sinceMs` (used for public rate limiting). */
export async function reportCountForDevice(deviceId, sinceMs = 24 * 60 * 60 * 1000) {
  assertConfigured();
  const since = new Date(Date.now() - sinceMs).toISOString();
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/${REPORTS_TABLE}?select=id&device_id=eq.${encodeURIComponent(deviceId)}&created_at=gte.${encodeURIComponent(since)}&limit=1`,
    { headers: authHeaders() },
  );
  if (!res.ok) return 999;
  const rows = await res.json();
  const range = res.headers.get('content-range') ?? '';
  const match = range.match(/\/(\d+)$/);
  return match ? Number(match[1]) : Array.isArray(rows) ? rows.length : 0;
}

/** Atomic like-counter adjustment via the adjust_likes RPC. Returns new count, or null. */
export async function adjustLikes(submissionId, delta) {
  assertConfigured();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/adjust_likes`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ target: submissionId, delta }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (Array.isArray(data)) return Number(data[0] ?? 0);
  if (data && typeof data === 'object') {
    const v = Object.values(data)[0];
    return Number(v ?? 0);
  }
  return Number(data ?? 0);
}
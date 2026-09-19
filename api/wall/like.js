import {
  getRow,
  findLike,
  createLike,
  deleteLike,
  likedIdsForDevice,
  adjustLikes,
} from '../_lib/supabase.js';

export const config = {
  runtime: 'edge',
};

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEVICE_RE = /^[A-Za-z0-9_-]{8,128}$/;

// Loose best-effort burst guard per edge instance.
const bursts = new Map();

function allowBurst(deviceId) {
  const now = Date.now();
  const arr = (bursts.get(deviceId) ?? []).filter((t) => now - t < 30000);
  if (arr.length >= 40) return false;
  arr.push(now);
  bursts.set(deviceId, arr);
  return true;
}

function invalidDevice(deviceId) {
  return typeof deviceId !== 'string' || !DEVICE_RE.test(deviceId);
}

function invalidId(id) {
  return typeof id !== 'string' || !UUID_RE.test(id);
}

export default async function handler(request) {
  try {
    if (request.method === 'GET') {
      const url = new URL(request.url);
      const deviceId = String(url.searchParams.get('device_id') ?? '');
      if (invalidDevice(deviceId)) return json({ error: 'invalid_fields' }, 400);
      const ids = await likedIdsForDevice(deviceId).catch(() => []);
      return json({ ids }, 200);
    }

    if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

    let input;
    try {
      input = await request.json();
    } catch {
      return json({ error: 'invalid_fields' }, 400);
    }

    const action = String(input?.action ?? '');
    const submissionId = String(input?.submission_id ?? '');
    const deviceId = String(input?.device_id ?? '');

    if (action !== 'like' && action !== 'unlike') return json({ error: 'invalid_fields' }, 400);
    if (invalidId(submissionId) || invalidDevice(deviceId)) {
      return json({ error: 'invalid_fields' }, 400);
    }
    if (!allowBurst(deviceId)) return json({ error: 'too_many_requests' }, 429);

    const row = await getRow(submissionId);
    if (!row || row.status !== 'approved') {
      return json({ error: 'not_found' }, 404);
    }

    if (action === 'like') {
      const existing = await findLike(submissionId, deviceId);
      if (existing) {
        return json({ liked: true, likes: Number(row.likes ?? 0) }, 200);
      }
      const inserted = await createLike(submissionId, deviceId);
      // 409 (duplicate) is a race another request won — treat as liked.
      const count = await adjustLikes(submissionId, 1);
      if (count === null) {
        if (inserted) await deleteLike(submissionId, deviceId).catch(() => {});
        return json({ error: 'database_unavailable' }, 500);
      }
      return json({ liked: true, likes: count }, 200);
    }

    // unlike
    const existed = Boolean(await findLike(submissionId, deviceId));
    await deleteLike(submissionId, deviceId);
    const count = await adjustLikes(submissionId, -1);
    if (count === null) {
      if (existed) await createLike(submissionId, deviceId).catch(() => {});
      return json({ error: 'database_unavailable' }, 500);
    }
    return json({ liked: false, likes: count }, 200);
  } catch (err) {
    const msg = String(err?.message ?? err ?? '');
    return json(
      { error: /SUPABASE_NOT_CONFIGURED/.test(msg) ? 'supabase_not_configured' : 'internal', detail: msg },
      /SUPABASE_NOT_CONFIGURED/.test(msg) ? 503 : 500,
    );
  }
}
import {
  findReport,
  getRow,
  insertAction,
  reportCountForDevice,
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

const REPORT_REASONS = new Set([
  'Inappropriate',
  'Spam',
  'Offensive',
  'Copyright Concern',
  'Other',
]);

export default async function handler(request) {
  try {
    if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

    let input;
    try {
      input = await request.json();
    } catch {
      return json({ error: 'invalid_fields' }, 400);
    }

    const submissionId = String(input?.submission_id ?? '');
    const deviceId = String(input?.device_id ?? '');
    const reasonInput = String(input?.reason ?? '').trim().slice(0, 80);

    if (!UUID_RE.test(submissionId) || !DEVICE_RE.test(deviceId)) {
      return json({ error: 'invalid_fields' }, 400);
    }
    const reason = REPORT_REASONS.has(reasonInput) ? reasonInput : 'Other';

    const row = await getRow(submissionId);
    if (!row || row.status !== 'approved') {
      return json({ error: 'not_found' }, 404);
    }

    // keep the report table small — one report per device per submission
    const existing = await findReport(submissionId, deviceId);
    if (existing) return json({ ok: true, already: true }, 200);

    const count = await reportCountForDevice(deviceId);
    if (count >= 10) return json({ error: 'too_many_requests' }, 429);

    const res = await fetch(
      `${(process.env.SUPABASE_URL ?? '').replace(/\/+$/, '')}/rest/v1/wall_reports`,
      {
        method: 'POST',
        headers: {
          apikey: process.env.SUPABASE_SERVICE_ROLE ?? '',
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE ?? ''}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({ submission_id: submissionId, device_id: deviceId, reason }),
      },
    );
    if (!res.ok && res.status !== 201 && res.status !== 409) {
      return json({ error: 'database_unavailable' }, 500);
    }

    await insertAction({
      submissionId,
      action: 'report',
      admin: 'system',
      reason,
      note: 'Public flag received',
      meta: { deviceCount: count + 1 },
    }).catch(() => {});

    return json({ ok: true }, 200);
  } catch (err) {
    const msg = String(err?.message ?? err ?? '');
    return json(
      { error: /SUPABASE_NOT_CONFIGURED/.test(msg) ? 'supabase_not_configured' : 'internal', detail: msg },
      /SUPABASE_NOT_CONFIGURED/.test(msg) ? 503 : 500,
    );
  }
}
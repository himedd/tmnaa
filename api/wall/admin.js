import {
  copyObject,
  deleteObjects,
  getAccount,
  presignGet,
} from '../_lib/storj.js';
import {
  authenticate,
  deleteReports,
  getRow,
  insertAction,
  latestAction,
  listActions,
  listReports,
  listRows,
  statusCounts,
  updateRow,
} from '../_lib/supabase.js';

export const config = {
  runtime: 'edge',
};

const REVIEW_LOCK_MS = 120000;
const UNDO_WINDOW_MS = 60000;

const REJECT_REASONS = [
  'Inappropriate / Offensive',
  'Spam or Duplicate',
  'Low Quality',
  'Unrelated to Milestone',
  'Copyright Concern',
  'Other',
];

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function clampText(v, max) {
  return String(v ?? '').trim().slice(0, max);
}

function reviewerName(admin) {
  return admin?.email || admin?.id || '';
}

function safeReason(reason) {
  const r = clampText(reason, 160);
  if (!r) return 'Other';
  return REJECT_REASONS.includes(r) ? r : r;
}

function toItem(row) {
  const isLink = row.media_type === 'link';
  return {
    id: row.id,
    name: row.name ?? '',
    caption: row.caption ?? '',
    kind: row.kind,
    mediaType: row.media_type,
    status: row.status,
    likes: row.likes ?? 0,
    createdAt: row.created_at ?? '',
    url: isLink ? row.link_url : null,
    posterUrl: null,
    mediaUrl: null,
    width: row.width ?? null,
    height: row.height ?? null,
    transcoded: Boolean(row.transcoded),
    deviceId: row.device_id ?? null,
    fileHash: row.file_hash ?? null,
    phash: row.phash ?? null,
    rejectReason: row.reject_reason ?? null,
    internalNote: row.internal_note ?? null,
    reviewingBy: row.reviewing_by ?? null,
    reviewingAt: row.reviewing_at ?? null,
    reviewedAt: row.reviewed_at ?? null,
    reviewer: row.reviewer ?? null,
  };
}

async function withUrls(item, row) {
  if (row.media_type === 'link') return item;
  try {
    const account = getAccount(row.provider);
    if (!account) return item;
    // Rejected rows keep their media in a trash/rejected folder while
    // trash_* keys are set, so the admin can still preview them.
    let mediaKey = row.media_key;
    let posterKey = row.poster_key;
    if (row.status === 'rejected') {
      if (row.trash_media_key) mediaKey = row.trash_media_key;
      if (row.trash_poster_key) posterKey = row.trash_poster_key;
    }
    const previewPoster = posterKey || (row.media_type === 'image' ? mediaKey : null);
    if (previewPoster) item.posterUrl = await presignGet(account, previewPoster, 3600);
    if (row.media_type === 'video' && mediaKey) {
      item.mediaUrl = await presignGet(account, mediaKey, 3600);
    }
  } catch {
    // keep null urls
  }
  return item;
}

async function rowsToItems(rows) {
  return Promise.all(rows.map((row) => withUrls(toItem(row), row)));
}

// ---------------------------------------------------------------------------
// moderation actions (throw on failure; return { state } when gracefully skipped)
// ---------------------------------------------------------------------------

/**
 * Best-effort shadow copy of a stored object into another moderation folder.
 * Legacy/unprefixed keys (whose path has no pending/approved segment) get a
 * shadow path under `300kedits/<folder>/<rowId>/...` instead. A broken/missing
 * source object is not fatal: return { copied:false } so moderation can still
 * proceed (the original key is kept; the item is simply hidden/unpublished).
 */
async function shadowCopy(account, src, folder, rowId) {
  if (!src) return { copied: false, dst: null, src };
  const parts = src.split('/');
  const hit = parts.findIndex((p) => p === 'pending' || p === 'approved');
  let dst;
  if (hit >= 0) {
    parts[hit] = folder;
    dst = parts.join('/');
  } else {
    dst = `300kedits/${folder}/${rowId}/${src.split('/').pop()}`;
  }
  if (dst === src) return { copied: false, dst: null, src };
  try {
    await copyObject(account, src, dst);
    return { copied: true, dst, src };
  } catch {
    return { copied: false, dst: null, src };
  }
}

async function safeDelete(account, keys) {
  try {
    await deleteObjects(account, keys);
  } catch {
    // deletion is best-effort
  }
}

async function moderateApprove(id, admin) {
  const row = await getRow(id);
  if (!row) return { state: 'not_found' };
  if (row.status !== 'pending') return { state: 'skipped' };

  const account = getAccount(row.provider);
  if (!account) throw Object.assign(new Error('storage_not_configured'), { code: 'storage_not_configured' });

  const updates = {};
  const toDelete = [];
  for (const col of ['media_key', 'poster_key']) {
    const r = await shadowCopy(account, row[col], 'approved', row.id);
    if (!r.copied) continue;
    updates[col] = r.dst;
    toDelete.push(r.src);
  }

  const now = new Date().toISOString();
  await updateRow(id, {
    ...updates,
    status: 'approved',
    reviewed_at: now,
    reviewer: reviewerName(admin),
    reject_reason: null,
    reviewing_by: null,
    reviewing_at: null,
    trash_media_key: null,
    trash_poster_key: null,
  });
  await safeDelete(account, toDelete);
  await insertAction({
    submissionId: id,
    action: 'approve',
    admin: reviewerName(admin),
    reason: safeReason(''),
    meta: { from: 'pending' },
  });
  return { state: 'done' };
}

async function moderateReject(id, admin, reasonInput, metaFrom = 'pending') {
  const row = await getRow(id);
  if (!row) return { state: 'not_found' };
  if (row.status !== metaFrom) return { state: 'skipped' };

  const account = getAccount(row.provider);
  if (!account) throw Object.assign(new Error('storage_not_configured'), { code: 'storage_not_configured' });

  const reason = safeReason(reasonInput);
  const trash = {};
  const toDelete = [];
  for (const col of ['media_key', 'poster_key']) {
    const r = await shadowCopy(account, row[col], 'rejected', row.id);
    if (!r.copied) continue;
    trash[col === 'media_key' ? 'trash_media_key' : 'trash_poster_key'] = r.dst;
    toDelete.push(r.src);
  }

  const now = new Date().toISOString();
  await updateRow(id, {
    status: 'rejected',
    reject_reason: reason,
    reviewed_at: now,
    reviewer: reviewerName(admin),
    reviewing_by: null,
    reviewing_at: null,
    ...trash,
  });
  await safeDelete(account, toDelete);
  await insertAction({
    submissionId: id,
    action: metaFrom === 'approved' ? 'unpublish' : 'reject',
    admin: reviewerName(admin),
    reason,
    meta: { from: metaFrom },
  });
  return { state: 'done' };
}

async function moderateUndo(id, admin) {
  const row = await getRow(id);
  if (!row) return { state: 'not_found' };

  const last = await latestAction(id);
  if (!last || last.action === 'undo') return { state: 'nothing' };
  if (!last.created_at) return { state: 'expired' };
  const age = Date.now() - new Date(last.created_at).getTime();
  if (!Number.isFinite(age) || age > UNDO_WINDOW_MS) return { state: 'expired' };

  const name = reviewerName(admin);
  const account = getAccount(row.provider);
  if (!account) throw Object.assign(new Error('storage_not_configured'), { code: 'storage_not_configured' });

  if (last.action === 'approve') {
    // reverse approve: approved -> pending
    const updates = {};
    const toDelete = [];
    for (const col of ['media_key', 'poster_key']) {
      const r = await shadowCopy(account, row[col], 'pending', row.id);
      if (!r.copied) continue;
      updates[col] = r.dst;
      toDelete.push(r.src);
    }
    await updateRow(id, {
      ...updates,
      status: 'pending',
      reviewed_at: null,
      reviewer: null,
      reject_reason: null,
      reviewing_by: null,
      reviewing_at: null,
      trash_media_key: null,
      trash_poster_key: null,
    });
    await safeDelete(account, toDelete);
    await insertAction({
      submissionId: id,
      action: 'undo',
      admin: name,
      reason: 'Undid approval',
      meta: { undone: last.action, actionId: last.id, restored: 'pending' },
    });
    return { state: 'restored', restored: 'pending' };
  }

  // reject / unpublish: restore from trash/rejected folder
  const metaFrom = (last.meta && last.meta.from === 'approved') ? 'approved' : 'pending';
  const trashKeys = [];
  for (const col of ['media_key', 'poster_key']) {
    const trashKey = row[col === 'media_key' ? 'trash_media_key' : 'trash_poster_key'];
    const orig = row[col];
    if (!trashKey || !orig) continue;
    try {
      await copyObject(account, trashKey, orig);
      trashKeys.push(trashKey);
    } catch {
      // keep the trash key so the media is not lost; status restore is enough
    }
  }
  await updateRow(id, {
    status: metaFrom,
    reject_reason: null,
    reviewing_by: null,
    reviewing_at: null,
    trash_media_key: null,
    trash_poster_key: null,
  });
  await safeDelete(account, trashKeys);
  await insertAction({
    submissionId: id,
    action: 'undo',
    admin: name,
    reason: `Undid ${last.action}`,
    meta: { undone: last.action, actionId: last.id, restored: metaFrom },
  });
  return { state: 'restored', restored: metaFrom };
}

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------

async function handleGet(url, request) {
  const admin = await authenticate(request);
  if (!admin) return json({ error: 'unauthorized' }, 401);

  const action = url.searchParams.get('action') ?? '';

  if (action === 'status') {
    const counts = await statusCounts();
    return json({ ...counts, admin: reviewerName(admin) }, 200);
  }
  if (action === 'list') {
    const status = url.searchParams.get('status') ?? '';
    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return json({ error: 'invalid_fields' }, 400);
    }
    const rows = await listRows(status);
    return json({ items: await rowsToItems(rows) }, 200);
  }
  if (action === 'all') {
    const rows = await listRows(null, 2000);
    return json({ items: await rowsToItems(rows) }, 200);
  }
  if (action === 'audit') {
    const actions = await listActions(500);
    return json({ actions }, 200);
  }
  if (action === 'flagged') {
    const reports = await listReports(500);
    const subIds = [...new Set(reports.map((r) => String(r.submission_id)))].slice(0, 50);
    const items = [];
    for (const id of subIds) {
      const row = await getRow(id);
      if (!row) continue;
      const item = await withUrls(toItem(row), row);
      const subReports = reports.filter((r) => String(r.submission_id) === id);
      item.flagCount = subReports.length;
      item.flagReasons = [...new Set(subReports.map((r) => r.reason ?? 'Other'))];
      item.reports = subReports.map((r) => ({
        deviceId: r.device_id ?? '',
        reason: r.reason ?? '',
        createdAt: r.created_at ?? '',
      }));
      items.push(item);
    }
    return json({ items, totalReports: reports.length }, 200);
  }
  if (action === 'whoami') {
    return json({ admin: reviewerName(admin) }, 200);
  }
  return json({ error: 'invalid_fields' }, 400);
}

// ---------------------------------------------------------------------------
// POST
// ---------------------------------------------------------------------------

async function handlePost(request, admin) {
  let input;
  try {
    input = await request.json();
  } catch {
    return json({ error: 'invalid_fields' }, 400);
  }
  const action = String(input?.action ?? '');

  if (action === 'bulk') {
    const op = input.op === 'approve' ? 'approve' : input.op === 'reject' ? 'reject' : '';
    const ids = Array.isArray(input.ids)
      ? input.ids.map(String).filter(Boolean).slice(0, 100)
      : [];
    if (!op || ids.length === 0) return json({ error: 'invalid_fields' }, 400);
    const results = [];
    for (const id of ids) {
      try {
        const res =
          op === 'approve'
            ? await moderateApprove(id, admin)
            : await moderateReject(id, admin, input.reason || 'Other');
        results.push({ id, state: res.state });
      } catch (e) {
        results.push({ id, state: 'failed', error: e.code || 'failed' });
      }
    }
    return json({ ok: true, results }, 200);
  }

  const id = String(input?.id ?? '');
  if (!id) return json({ error: 'invalid_fields' }, 400);

  if (action === 'approve') {
    const res = await moderateApprove(id, admin);
    if (res.state === 'not_found') return json({ error: 'not_found' }, 404);
    if (res.state === 'skipped') return json({ error: 'invalid_state' }, 409);
    return json({ ok: true }, 200);
  }
  if (action === 'reject') {
    const reason = typeof input.reason === 'string' ? input.reason : 'Other';
    const res = await moderateReject(id, admin, reason, 'pending');
    if (res.state === 'not_found') return json({ error: 'not_found' }, 404);
    if (res.state === 'skipped') return json({ error: 'invalid_state' }, 409);
    return json({ ok: true }, 200);
  }
  if (action === 'unpublish') {
    const reason = typeof input.reason === 'string' ? input.reason : 'Other';
    const res = await moderateReject(id, admin, reason, 'approved');
    if (res.state === 'not_found') return json({ error: 'not_found' }, 404);
    if (res.state === 'skipped') return json({ error: 'invalid_state' }, 409);
    return json({ ok: true }, 200);
  }
  if (action === 'undo') {
    const res = await moderateUndo(id, admin);
    if (res.state === 'not_found') return json({ error: 'not_found' }, 404);
    if (res.state === 'nothing') return json({ error: 'nothing_to_undo' }, 400);
    if (res.state === 'expired') return json({ error: 'undo_window_expired' }, 400);
    return json({ ok: true, restored: res.restored }, 200);
  }
  if (action === 'update') {
    const row = await getRow(id);
    if (!row) return json({ error: 'not_found' }, 404);
    const patch = {};
    const changed = [];
    if (typeof input.caption === 'string') {
      const cap = clampText(input.caption, 180);
      if (cap !== (row.caption ?? '')) {
        patch.caption = cap;
        changed.push('caption');
      }
    }
    if (typeof input.name === 'string') {
      const nm = clampText(input.name, 40);
      if (nm !== (row.name ?? '')) {
        patch.name = nm;
        changed.push('name');
      }
    }
    if (Object.keys(patch).length > 0) {
      await updateRow(id, patch);
      await insertAction({
        submissionId: id,
        action: 'update',
        admin: reviewerName(admin),
        reason: '',
        note: `Edited ${changed.join(', ')}`,
      });
    }
    const updated = await getRow(id);
    return json({ ok: true, item: await withUrls(toItem(updated), updated) }, 200);
  }
  if (action === 'set_note') {
    const row = await getRow(id);
    if (!row) return json({ error: 'not_found' }, 404);
    const note = clampText(input.note, 2000);
    await updateRow(id, { internal_note: note });
    await insertAction({
      submissionId: id,
      action: 'note',
      admin: reviewerName(admin),
      reason: '',
      note: note ? 'Updated private note' : 'Cleared private note',
    });
    return json({ ok: true }, 200);
  }
  if (action === 'begin_review') {
    const row = await getRow(id);
    if (!row) return json({ error: 'not_found' }, 404);
    const me = reviewerName(admin);
    if (
      row.reviewing_by &&
      String(row.reviewing_by) !== me &&
      row.reviewing_at &&
      Number.isFinite(new Date(row.reviewing_at).getTime()) &&
      Date.now() - new Date(row.reviewing_at).getTime() < REVIEW_LOCK_MS
    ) {
      return json({ locked: false, lockedBy: String(row.reviewing_by) }, 200);
    }
    await updateRow(id, { reviewing_by: me, reviewing_at: new Date().toISOString() });
    return json({ locked: true, lockedBy: me }, 200);
  }
  if (action === 'end_review') {
    const row = await getRow(id);
    if (!row) return json({ error: 'not_found' }, 404);
    const me = reviewerName(admin);
    if (!row.reviewing_by || String(row.reviewing_by) === me) {
      await updateRow(id, { reviewing_by: null, reviewing_at: null });
    }
    return json({ ok: true }, 200);
  }
  if (action === 'clear_reports') {
    const row = await getRow(id);
    if (!row) return json({ error: 'not_found' }, 404);
    await deleteReports(id);
    await insertAction({
      submissionId: id,
      action: 'clear_reports',
      admin: reviewerName(admin),
      reason: '',
      note: 'Dismissed public report flags',
    });
    return json({ ok: true }, 200);
  }

  return json({ error: 'invalid_fields' }, 400);
}

export default async function handler(request) {
  try {
    const url = new URL(request.url);
    if (request.method === 'GET') return await handleGet(url, request);
    if (request.method === 'POST') {
      const admin = await authenticate(request);
      if (!admin) return json({ error: 'unauthorized' }, 401);
      return await handlePost(request, admin);
    }
    return json({ error: 'method_not_allowed' }, 405);
  } catch (err) {
    const msg = String(err?.message ?? err ?? '');
    return json({ error: /SUPABASE/.test(msg) ? 'supabase_not_configured' : 'internal', detail: msg }, 500);
  }
}
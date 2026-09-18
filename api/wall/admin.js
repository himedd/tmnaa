import {
  copyObject,
  deleteObjects,
  getAccount,
  presignGet,
} from '../_lib/storj.js';
import {
  authenticate,
  getRow,
  listRows,
  statusCounts,
  updateRow,
} from '../_lib/supabase.js';

export const config = {
  runtime: 'nodejs',
  maxDuration: 30,
};

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
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
  };
}

async function withUrls(item, row) {
  if (row.media_type === 'link') return item;
  try {
    const account = getAccount(row.provider);
    if (!account) return item;
    const posterKey =
      row.poster_key || (row.media_type === 'image' ? row.media_key : null);
    if (posterKey) item.posterUrl = await presignGet(account, posterKey, 3600);
    if (row.media_type === 'video' && row.media_key) {
      item.mediaUrl = await presignGet(account, row.media_key, 3600);
    }
  } catch {
    // keep null urls
  }
  return item;
}

function reviewerName(admin) {
  return admin?.email || admin?.id || '';
}

export default async function handler(request) {
  const url = new URL(request.url);
  const method = request.method;

  if (method === 'GET') {
    const admin = await authenticate(request);
    if (!admin) return json({ error: 'unauthorized' }, 401);

    const action = url.searchParams.get('action') ?? '';
    if (action === 'status') {
      const counts = await statusCounts();
      return json(counts, 200);
    }
    if (action === 'list') {
      const status = url.searchParams.get('status') ?? '';
      if (!['pending', 'approved', 'rejected'].includes(status)) {
        return json({ error: 'invalid_fields' }, 400);
      }
      const rows = await listRows(status);
      const items = await Promise.all(rows.map((row) => withUrls(toItem(row), row)));
      return json({ items }, 200);
    }
    return json({ error: 'invalid_fields' }, 400);
  }

  if (method === 'POST') {
    const admin = await authenticate(request);
    if (!admin) return json({ error: 'unauthorized' }, 401);

    let input;
    try {
      input = await request.json();
    } catch {
      return json({ error: 'invalid_fields' }, 400);
    }
    const action = String(input?.action ?? '');
    const id = String(input?.id ?? '');
    if (!id || !['approve', 'reject'].includes(action)) {
      return json({ error: 'invalid_fields' }, 400);
    }

    const row = await getRow(id);
    if (!row) return json({ error: 'not_found' }, 404);

    const account = getAccount(row.provider);
    if (!account) return json({ error: 'storage_not_configured' }, 503);

    if (action === 'reject') {
      await updateRow(id, {
        status: 'rejected',
        reviewed_at: new Date().toISOString(),
        reviewer: reviewerName(admin),
      });
      await deleteObjects(account, [row.media_key, row.poster_key].filter(Boolean));
      return json({ ok: true }, 200);
    }

    // approve: copy pending -> approved inside the same bucket, then update + cleanup
    const updates = {};
    for (const col of ['media_key', 'poster_key']) {
      const src = row[col];
      if (!src) continue;
      const dst = src.replace('pending/', 'approved/');
      try {
        await copyObject(account, src, dst);
      } catch {
        return json({ error: 'storage_unavailable' }, 502);
      }
      updates[col] = dst;
    }

    await updateRow(id, {
      ...updates,
      status: 'approved',
      reviewed_at: new Date().toISOString(),
      reviewer: reviewerName(admin),
    });
    await deleteObjects(account, [row.media_key, row.poster_key].filter(Boolean));
    return json({ ok: true }, 200);
  }

  return json({ error: 'method_not_allowed' }, 405);
}
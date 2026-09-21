import { getAccount, presignGet } from '../_lib/storj.js';
import { getRow } from '../_lib/supabase.js';
import { authenticate } from '../_lib/supabase.js';

export const config = {
  runtime: 'edge',
};

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export default async function handler(request) {
  try {
    if (request.method !== 'GET') return json({ error: 'method_not_allowed' }, 405);

    const url = new URL(request.url);
    const id = url.searchParams.get('id') ?? '';
    const kind = url.searchParams.get('kind') === 'poster' ? 'poster' : 'media';
    if (!id) return json({ error: 'not_found' }, 404);

    const row = await getRow(id);
    if (!row || row.media_type === 'link') return json({ error: 'not_found' }, 404);

    if (row.status !== 'approved') {
      const admin = await authenticate(request);
      if (!admin) return json({ error: 'locked' }, 403);
    }

    const account = getAccount(row.provider);
    if (!account) return json({ error: 'storage_not_configured' }, 503);

    const key =
      kind === 'poster'
        ? row.poster_key || (row.media_type === 'image' ? row.media_key : null)
        : row.media_key;
    if (!key) return json({ error: 'not_found' }, 404);

    try {
      const signed = await presignGet(account, key, 3600, {
        'response-cache-control': 'public,max-age=86400',
      });
      // Public approved media can be cached hard: the presigned URL is stable for
      // the row, so browsers reuse the stored image and skip the storj round-trip.
      const cache = row.status === 'approved' ? 'public, max-age=540' : 'no-store';
      return new Response(null, {
        status: 302,
        headers: { Location: signed, 'Cache-Control': cache },
      });
    } catch {
      return json({ error: 'storage_unavailable' }, 502);
    }
  } catch (err) {
    const msg = String(err?.message ?? err ?? '');
    return json({ error: /SUPABASE/.test(msg) ? 'supabase_not_configured' : 'internal', detail: msg }, 500);
  }
}
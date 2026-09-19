import { createRow } from '../_lib/supabase.js';

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
    if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

    let input;
    try {
      input = await request.json();
    } catch {
      return json({ error: 'invalid_fields' }, 400);
    }

    const name = String(input?.name ?? '').trim();
    const caption = String(input?.caption ?? '').trim();
    const url = String(input?.url ?? '').trim();

    if (!name || name.length > 40) return json({ error: 'invalid_fields' }, 400);
    if (caption.length > 180) return json({ error: 'invalid_fields' }, 400);

    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      return json({ error: 'invalid_fields' }, 400);
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) return json({ error: 'invalid_fields' }, 400);

    const id = crypto.randomUUID();
    const row = {
      id,
      name,
      caption,
      kind: 'link',
      media_type: 'link',
      status: 'pending',
      link_url: url,
      size_bytes: 0,
      created_at: new Date().toISOString(),
    };

    try {
      await createRow(row);
    } catch {
      return json({ error: 'database_unavailable' }, 500);
    }

    return json(
      {
        id: row.id,
        name: row.name,
        caption: row.caption,
        kind: row.kind,
        mediaType: row.media_type,
        status: row.status,
        likes: 0,
        createdAt: row.created_at,
        url: row.link_url,
        posterUrl: null,
        mediaUrl: null,
      },
      200,
    );
  } catch (err) {
    const msg = String(err?.message ?? err ?? '');
    return json({ error: /SUPABASE/.test(msg) ? 'supabase_not_configured' : 'internal', detail: msg }, 500);
  }
}
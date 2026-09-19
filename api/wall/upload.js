import { randomAccount, presignPut, KEY_PREFIX } from '../_lib/storj.js';

export const config = {
  runtime: 'edge',
};

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function mediaLimits() {
  return {
    image: (Number(process.env.MAX_IMAGE_MB) || 12) * 1024 * 1024,
    video: (Number(process.env.MAX_VIDEO_MB) || 150) * 1024 * 1024,
  };
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
    if (!input || typeof input !== 'object') {
      return json({ error: 'invalid_fields' }, 400);
    }

    const name = String(input.name ?? '').trim();
    const caption = String(input.caption ?? '').trim();
    const mediaType = String(input.mediaType ?? '');
    const contentType = String(input.contentType ?? '');
    const sizeBytes = Number(input.sizeBytes ?? 0);

    if (!name || name.length > 40) return json({ error: 'invalid_fields' }, 400);
    if (caption.length > 180) return json({ error: 'invalid_fields' }, 400);
    if (mediaType !== 'image' && mediaType !== 'video') return json({ error: 'unsupported_file' }, 400);
    if (!contentType || !contentType.startsWith(`${mediaType}/`)) {
      return json({ error: 'unsupported_file' }, 400);
    }
    const limits = mediaLimits();
    if (mediaType === 'image' && sizeBytes > limits.image) return json({ error: 'image_too_large' }, 413);
    if (mediaType === 'video' && sizeBytes > limits.video) return json({ error: 'file_too_large' }, 413);

    const account = randomAccount();
    if (!account) return json({ error: 'storage_not_configured' }, 503);

    const id = crypto.randomUUID();
    const mediaKey = `${KEY_PREFIX}pending/${id}/media`;
    const wantPoster = Boolean(input.poster) && mediaType === 'video' && input.posterContentType;

    try {
      const mediaUrl = await presignPut(account, mediaKey, contentType);
      let posterKey = null;
      let posterUrl = null;
      if (wantPoster) {
        posterKey = `${KEY_PREFIX}pending/${id}/poster`;
        posterUrl = await presignPut(account, posterKey, String(input.posterContentType));
      }
      return json(
        {
          id,
          provider: account.index,
          bucket: account.bucket,
          mediaKey,
          posterKey,
          mediaUrl,
          posterUrl,
        },
        200,
      );
    } catch {
      return json({ error: 'storage_unavailable' }, 502);
    }
  } catch (err) {
    return json({ error: 'internal', detail: String(err?.message ?? err ?? '') }, 500);
  }
}
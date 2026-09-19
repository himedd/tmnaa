import { randomAccount, presignPut, KEY_PREFIX } from '../_lib/storj.js';
import { createRow } from '../_lib/supabase.js';
import { allowSubmissionBurst, ipOf, submissionGuard } from '../_lib/limit.js';

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
    video: (Number(process.env.MAX_VIDEO_MB) || 500) * 1024 * 1024,
  };
}

export default async function handler(request) {
  try {
    if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

    let input;
    try {
      input = await request.json();
    } catch (parseErr) {
      const raw = await request.text().catch(() => '');
      return json({ error: 'invalid_fields', detail: `body_unreadable:${String(parseErr?.message ?? parseErr).slice(0, 80)}:${raw.slice(0, 200)}` }, 400);
    }
    if (!input || typeof input !== 'object') {
      return json({ error: 'invalid_fields' }, 400);
    }

    const name = String(input.name ?? '').trim();
    const caption = String(input.caption ?? '').trim();
    const mediaType = String(input.mediaType ?? '');
    const contentType = String(input.contentType ?? '');
    const sizeBytes = Number(input.sizeBytes ?? 0);

    const DEVICE_RE = /^[A-Za-z0-9_-]{8,128}$/;
    const deviceId = String(input.deviceId ?? '').trim();
    const fileHash = String(input.fileHash ?? '').trim();
    const phash = String(input.phash ?? '').trim();
    if (!DEVICE_RE.test(deviceId)) return json({ error: 'invalid_fields' }, 400);
    if (fileHash && !/^[0-9a-f]{16,128}$/i.test(fileHash)) return json({ error: 'invalid_fields' }, 400);
    if (phash && !/^[0-9a-f]{16,64}$/i.test(phash)) return json({ error: 'invalid_fields' }, 400);

    let width = null;
    let height = null;
    const rawW = Number(input.width);
    const rawH = Number(input.height);
    if (Number.isInteger(rawW) && rawW > 0 && rawW <= 8192) width = rawW;
    if (Number.isInteger(rawH) && rawH > 0 && rawH <= 8192) height = rawH;
    const transcoded = input.transcoded === true || input.transcoded === 'true';

    if (!name || name.length > 40) return json({ error: 'invalid_fields' }, 400);
    if (caption.length > 180) return json({ error: 'invalid_fields' }, 400);
    if (mediaType !== 'image' && mediaType !== 'video') return json({ error: 'unsupported_file' }, 400);
    if (!contentType || !contentType.startsWith(`${mediaType}/`)) {
      return json({ error: 'unsupported_file' }, 400);
    }
    const limits = mediaLimits();
    if (mediaType === 'image' && sizeBytes > limits.image) return json({ error: 'image_too_large' }, 413);
    if (mediaType === 'video' && sizeBytes > limits.video) return json({ error: 'file_too_large' }, 413);

    // Anti-abuse: burst guard (per instance) + DB-backed daily/hourly quotas
    // and a pending-queue cap so no one can flood the server or the mod queue.
    const ip = ipOf(request);
    if (!allowSubmissionBurst(deviceId, ip)) return json({ error: 'too_many_uploads' }, 429);
    const guardError = await submissionGuard(deviceId, ip);
    if (guardError) {
      return json({ error: guardError }, guardError === 'queue_full' ? 503 : 429);
    }

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

      const payload = {
        id,
        name,
        caption,
        kind: 'upload',
        media_type: mediaType,
        status: 'pending',
        provider: account.index,
        bucket: account.bucket,
        media_key: mediaKey,
        poster_key: posterKey,
        size_bytes: sizeBytes,
        width,
        height,
        transcoded,
        device_id: deviceId,
        submitter_ip: ip,
        file_hash: fileHash || null,
        phash: phash || null,
        created_at: new Date().toISOString(),
      };
      try {
        await createRow(payload);
      } catch (err) {
        // migration #2 not applied yet — retry without the moderation columns
        if (/PGRST204|Could not find the/.test(String(err?.message ?? ''))) {
          const { device_id, submitter_ip, file_hash, phash, ...base } = payload;
          try {
            await createRow(base);
          } catch {
            return json({ error: 'database_unavailable' }, 500);
          }
        } else {
          return json({ error: 'database_unavailable' }, 500);
        }
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
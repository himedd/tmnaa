import {
  getAccount,
  objectExists,
  presignPut,
  KEY_PREFIX,
} from '../_lib/storj.js';
import { createRow } from '../_lib/supabase.js';

export const config = {
  runtime: 'edge',
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEVICE_RE = /^[A-Za-z0-9_-]{8,128}$/;

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function mediaLimits() {
  return {
    image: (Number(process.env.MAX_IMAGE_MB) || 12) * 1024 * 1024,
    video: (Number(process.env.MAX_VIDEO_MB) || 5000) * 1024 * 1024,
  };
}

/** Rotate the starting account randomly, then scan the rest in numeric order. */
function accountOrder(skip) {
  const skipSet = new Set(skip);
  const all = [1, 2, 3, 4].filter((i) => !skipSet.has(i));
  if (all.length === 0) return [];
  const start = Math.floor(Math.random() * all.length);
  return [...all.slice(start), ...all.slice(0, start)];
}

/** Shared validation for both phases. Returns { error } or normalized fields. */
function validateInput(input) {
  const name = String(input.name ?? '').trim();
  const caption = String(input.caption ?? '').trim();
  const mediaType = String(input.mediaType ?? '');
  const contentType = String(input.contentType ?? '');
  const sizeBytes = Number(input.sizeBytes ?? 0);

  const deviceId = String(input.deviceId ?? '').trim();
  const fileHash = String(input.fileHash ?? '').trim();
  const phash = String(input.phash ?? '').trim();
  if (!DEVICE_RE.test(deviceId)) return { error: 'invalid_fields' };
  if (fileHash && !/^[0-9a-f]{16,128}$/i.test(fileHash)) return { error: 'invalid_fields' };
  if (phash && !/^[0-9a-f]{16,64}$/i.test(phash)) return { error: 'invalid_fields' };

  let width = null;
  let height = null;
  const rawW = Number(input.width);
  const rawH = Number(input.height);
  if (Number.isInteger(rawW) && rawW > 0 && rawW <= 8192) width = rawW;
  if (Number.isInteger(rawH) && rawH > 0 && rawH <= 8192) height = rawH;
  const transcoded = input.transcoded === true || input.transcoded === 'true';

  if (!name || name.length > 40) return { error: 'invalid_fields' };
  if (caption.length > 180) return { error: 'invalid_fields' };
  if (mediaType !== 'image' && mediaType !== 'video') return { error: 'unsupported_file' };
  if (!contentType || !contentType.startsWith(`${mediaType}/`)) {
    return { error: 'unsupported_file' };
  }
  const limits = mediaLimits();
  if (mediaType === 'image' && sizeBytes > limits.image) return { error: 'image_too_large' };
  if (mediaType === 'video' && sizeBytes > limits.video) return { error: 'file_too_large' };

  return {
    name,
    caption,
    mediaType,
    contentType,
    sizeBytes,
    deviceId,
    fileHash: fileHash || null,
    phash: phash || null,
    width,
    height,
    transcoded,
  };
}

// ---------------------------------------------------------------------------
// Phase 1 — request signed PUT urls. Does NOT touch the database yet: a bad or
// abandoned upload must never leave a pending row pointing at a missing object.
// ---------------------------------------------------------------------------
async function handlePresign(input) {
  const v = validateInput(input);
  if (v.error) {
    return json({ error: v.error }, v.error === 'file_too_large' || v.error === 'image_too_large' ? 413 : 400);
  }

  const skip = Array.isArray(input.skip)
    ? input.skip.map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= 4)
    : [];

  const order = accountOrder(skip);
  if (order.length === 0) return json({ error: 'storage_not_configured' }, 503);

  for (const idx of order) {
    const account = getAccount(idx);
    if (!account) continue;

    const id = crypto.randomUUID();
    const mediaKey = `${KEY_PREFIX}pending/${id}/media`;
    const wantPoster = Boolean(input.poster) && v.mediaType === 'video' && input.posterContentType;

    try {
      const mediaUrl = await presignPut(account, mediaKey, v.contentType);
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
      // this account failed to sign — fall through to the next one
    }
  }

  return json({ error: 'storage_unavailable' }, 502);
}

// ---------------------------------------------------------------------------
// Phase 2 — the client uploaded the bytes. Only now create the DB row, and only
// if the media object actually exists (no phantom "NoSuchKey" rows in admin).
// ---------------------------------------------------------------------------
async function handleConfirm(input) {
  const v = validateInput(input);
  if (v.error) return json({ error: v.error }, 400);

  const id = String(input.id ?? '');
  const provider = Number(input.provider);
  if (!UUID_RE.test(id)) return json({ error: 'invalid_fields' }, 400);
  if (!Number.isInteger(provider) || provider < 1 || provider > 4) {
    return json({ error: 'invalid_fields' }, 400);
  }

  const mediaKey = `${KEY_PREFIX}pending/${id}/media`;
  const wantPoster = v.mediaType === 'video' && input.poster === true;
  const posterKey = wantPoster ? `${KEY_PREFIX}pending/${id}/poster` : null;

  // Find the account that actually holds the object: try the reported one first,
  // then fall back through every other account in numeric order.
  let account = null;
  for (const idx of [provider, ...[1, 2, 3, 4].filter((i) => i !== provider)]) {
    const candidate = getAccount(idx);
    if (!candidate) continue;
    try {
      if (await objectExists(candidate, mediaKey)) {
        account = candidate;
        break;
      }
    } catch {
      // this account is unreachable right now — check the next one
    }
  }
  if (!account) {
    return json({ error: 'missing_file' }, 400);
  }

  const payload = {
    id,
    name: v.name,
    caption: v.caption,
    kind: 'upload',
    media_type: v.mediaType,
    status: 'pending',
    provider: account.index,
    bucket: account.bucket,
    media_key: mediaKey,
    poster_key: posterKey,
    size_bytes: v.sizeBytes,
    width: v.width,
    height: v.height,
    transcoded: v.transcoded,
    device_id: v.deviceId,
    file_hash: v.fileHash,
    phash: v.phash,
    created_at: new Date().toISOString(),
  };

  try {
    await createRow(payload);
  } catch (err) {
    // migration #2 not applied yet — retry without the moderation columns
    if (/PGRST204|Could not find the/.test(String(err?.message ?? ''))) {
      const { device_id, file_hash, phash, ...base } = payload;
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
      ok: true,
      id,
      provider: account.index,
      bucket: account.bucket,
      mediaKey,
      posterKey,
    },
    200,
  );
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

    const action = String(input.action ?? '');
    if (action === 'confirm') return await handleConfirm(input);
    if (action === '' || action === 'presign') return await handlePresign(input);
    return json({ error: 'invalid_fields' }, 400);
  } catch (err) {
    return json({ error: 'internal', detail: String(err?.message ?? err ?? '') }, 500);
  }
}
import { supabase, ADMIN_EMAIL } from './supabaseClient';
import { apiUrl } from './apiBase';
import { sha256File, sha256Text, dhashFromDataUrl } from './hash';

export type WallMediaType = 'image' | 'video' | 'link';
export type WallKind = 'upload' | 'link';
export type WallStatus = 'pending' | 'approved' | 'rejected';

export interface WallItem {
  id: string;
  name: string;
  caption: string;
  kind: WallKind;
  mediaType: WallMediaType;
  status?: WallStatus;
  likes: number;
  createdAt: string;
  url: string | null;
  posterUrl: string | null;
  mediaUrl: string | null;
  width: number | null;
  height: number | null;
  transcoded: boolean;
  /** moderation fields (admin only; null on the public wall) */
  deviceId?: string | null;
  fileHash?: string | null;
  phash?: string | null;
  rejectReason?: string | null;
  internalNote?: string | null;
  reviewingBy?: string | null;
  reviewingAt?: string | null;
  reviewedAt?: string | null;
  reviewer?: string | null;
  /** flag section (flagged list only) */
  flagCount?: number;
  flagReasons?: string[];
  reports?: { deviceId: string; reason: string; createdAt: string }[];
}

const ADMIN_TOKEN_KEY = 'tmnaa_admin_token';

export function getAdminToken(): string | null {
  try {
    return localStorage.getItem(ADMIN_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAdminToken(token: string): void {
  try {
    localStorage.setItem(ADMIN_TOKEN_KEY, token);
  } catch {
    /* ignore */
  }
}

export function clearAdminToken(): void {
  try {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

export function timeAgo(iso: string): string {
  const ts = new Date(iso).getTime();
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (!Number.isFinite(diff) || diff < 0) return '';
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function hostOf(url?: string | null): string {
  if (!url) return 'video';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'video';
  }
}

export function tiktokEmbedUrl(url: string): string | null {
  const m = url.match(/tiktok\.com\/(?:@[^/]+\/)?(?:video|photo)\/(\d{9,25})/);
  if (!m) return null;
  return `https://www.tiktok.com/embed/v2/${m[1]}`;
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

interface WallRow {
  id: string;
  name: string;
  caption: string;
  kind: WallKind;
  media_type: WallMediaType;
  status: WallStatus;
  likes: number | null;
  created_at: string;
  link_url: string | null;
  provider: number | null;
  bucket: string | null;
  media_key: string | null;
  poster_key: string | null;
  size_bytes: number | null;
  width: number | null;
  height: number | null;
  transcoded: boolean | null;
  reviewed_at: string | null;
  reviewer: string | null;
  device_id: string | null;
  file_hash: string | null;
  phash: string | null;
  reject_reason: string | null;
  internal_note: string | null;
  reviewing_by: string | null;
  reviewing_at: string | null;
  trash_media_key: string | null;
  trash_poster_key: string | null;
}

/** Approved items render through the /api/wall/media redirect (serverless presign). */
function rowToItem(row: Partial<WallRow>): WallItem {
  const isLink = row.media_type === 'link';
  const mediaBase = apiUrl('/api/wall/media');
  const media = (kind: 'poster' | 'media') => `${mediaBase}?id=${encodeURIComponent(row.id ?? '')}&kind=${kind}`;
return {
    id: row.id ?? '',
    name: row.name ?? '',
    caption: row.caption ?? '',
    kind: row.kind ?? 'upload',
    mediaType: row.media_type ?? 'image',
    status: row.status,
    likes: row.likes ?? 0,
    createdAt: row.created_at ?? '',
    url: row.link_url ?? null,
    posterUrl: isLink ? null : media('poster'),
    mediaUrl: row.media_type === 'video' && row.media_key ? media('media') : null,
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

// ---------------------------------------------------------------------------
// public wall (approved only — enforced by RLS)
// ---------------------------------------------------------------------------

export async function fetchWall(): Promise<WallItem[]> {
  const { data, error } = await supabase
    .from('wall_submissions')
    .select('id,name,caption,kind,media_type,status,likes,created_at,link_url,media_key,poster_key,width,height,transcoded')
    .eq('status', 'approved')
    .order('created_at', { ascending: false });
  if (error) throw new Error(String(error.message ?? 'wall_fetch_failed'));
  return (data ?? []).map(rowToItem);
}

// ---------------------------------------------------------------------------
// submissions
// ---------------------------------------------------------------------------

export interface SubmitUploadInput {
  file: File;
  name: string;
  caption: string;
  poster?: string;
  width?: number;
  height?: number;
  transcoded?: boolean;
}

async function storagePut(url: string, body: Blob, contentType: string): Promise<void> {
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body,
  });
  if (!res.ok) throw new Error('storage_unavailable');
}

export async function submitUpload(input: SubmitUploadInput): Promise<WallItem> {
  const mime = input.file.type;
  const isImage = mime.startsWith('image/');
  const isVideo = mime.startsWith('video/');
  if (!isImage && !isVideo) throw new Error('unsupported_file');
  const maxImage = 12 * 1024 * 1024;
  const maxVideo = 150 * 1024 * 1024;
  if (isImage && input.file.size > maxImage) throw new Error('image_too_large');
  if (isVideo && input.file.size > maxVideo) throw new Error('file_too_large');

  let posterBlob: Blob | null = null;
  let posterContentType = '';
  if (input.poster && isVideo) {
    posterBlob = await (await fetch(input.poster)).blob();
    posterContentType = posterBlob.type || 'image/jpeg';
  }

  // content fingerprinting – exact file hash always, phash for images
  let fileHash = '';
  let phash: string | undefined;
  try {
    fileHash = await sha256File(input.file);
    if (isImage && input.poster) {
      phash = (await dhashFromDataUrl(input.poster).catch(() => null)) ?? undefined;
    }
  } catch {
    fileHash = '';
  }

  const presignRes = await fetch(apiUrl('/api/wall/upload'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: input.name,
      caption: input.caption,
      mediaType: isVideo ? 'video' : 'image',
      contentType: mime,
      sizeBytes: input.file.size,
      width: Number.isFinite(input.width) ? input.width : null,
      height: Number.isFinite(input.height) ? input.height : null,
      transcoded: Boolean(input.transcoded),
      deviceId: getDeviceId(),
      fileHash: fileHash || undefined,
      phash,
      poster: posterBlob ? true : undefined,
      posterContentType: posterBlob ? posterContentType : undefined,
    }),
  });
  const presign = (await presignRes.json().catch(() => ({}))) as {
    id?: string;
    provider?: number;
    bucket?: string;
    mediaKey?: string;
    posterKey?: string | null;
    mediaUrl?: string;
    posterUrl?: string | null;
    error?: string;
  };
  if (!presignRes.ok || !presign.id) {
    throw new Error(presign.error ?? 'upload_failed');
  }

  await storagePut(presign.mediaUrl as string, input.file, mime);

  let posterKey: string | null = null;
  if (posterBlob && presign.posterUrl && presign.posterKey) {
    await storagePut(presign.posterUrl, posterBlob, posterContentType);
    posterKey = presign.posterKey;
  }

  return rowToItem({
    id: presign.id as string,
    name: input.name,
    caption: input.caption,
    kind: 'upload',
    media_type: isVideo ? 'video' : 'image',
    status: 'pending',
    likes: 0,
    created_at: new Date().toISOString(),
    link_url: null,
    provider: presign.provider ?? null,
    bucket: presign.bucket ?? null,
    media_key: presign.mediaKey ?? null,
    poster_key: posterKey,
    size_bytes: input.file.size,
    width: typeof input.width === 'number' ? input.width : null,
    height: typeof input.height === 'number' ? input.height : null,
    transcoded: Boolean(input.transcoded),
    reviewed_at: null,
    reviewer: null,
  });
}

export async function submitLink(input: {
  name: string;
  caption: string;
  url: string;
}): Promise<WallItem> {
  let fileHash = '';
  try {
    fileHash = await sha256Text(`url:${input.url.trim()}`);
  } catch {
    fileHash = '';
  }
  const res = await fetch(apiUrl('/api/wall/link'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...input, deviceId: getDeviceId(), fileHash: fileHash || undefined }),
  });
  const body = (await res.json().catch(() => ({}))) as Partial<WallItem> & { error?: string };
  if (!res.ok || !body.id) throw new Error(body.error ?? 'database_unavailable');
  return body as WallItem;
}

// ---------------------------------------------------------------------------
// admin API — serverless functions verify the Supabase Auth session
// ---------------------------------------------------------------------------

export async function adminLogin(
  password: string,
): Promise<{ token: string; expiresAt: string }> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password,
  });
  if (error) {
    if (/login|credentials|invalid/i.test(String(error.message))) {
      throw new Error('wrong_password');
    }
    throw new Error('login_failed');
  }
  const session = data.session;
  const token = session?.access_token ?? '';
  setAdminToken(token);
  return {
    token,
    expiresAt: session?.expires_at
      ? new Date((session.expires_at as number) * 1000).toISOString()
      : '',
  };
}

export interface AdminStatus {
  pending: number;
  approved: number;
  rejected: number;
}

async function adminFetch(path: string, init?: RequestInit): Promise<unknown> {
  const token = getAdminToken();
  const res = await fetch(apiUrl(path), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (res.status === 401) {
    clearAdminToken();
    throw new Error('unauthorized');
  }
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(body.error ?? 'admin_request_failed');
  return body;
}

export async function adminStatus(): Promise<AdminStatus> {
  const data = (await adminFetch('/api/wall/admin?action=status')) as Partial<AdminStatus>;
  return {
    pending: data.pending ?? 0,
    approved: data.approved ?? 0,
    rejected: data.rejected ?? 0,
  };
}

export async function adminList(status: WallStatus): Promise<WallItem[]> {
  const data = (await adminFetch(
    `/api/wall/admin?action=list&status=${encodeURIComponent(status)}`,
  )) as { items?: WallItem[] };
  return data.items ?? [];
}

export async function adminApprove(id: string): Promise<void> {
  await adminFetch('/api/wall/admin', {
    method: 'POST',
    body: JSON.stringify({ action: 'approve', id }),
  });
}

export async function adminReject(id: string, reason: string): Promise<void> {
  await adminFetch('/api/wall/admin', {
    method: 'POST',
    body: JSON.stringify({ action: 'reject', id, reason }),
  });
}

export async function adminUnpublish(id: string, reason: string): Promise<void> {
  await adminFetch('/api/wall/admin', {
    method: 'POST',
    body: JSON.stringify({ action: 'unpublish', id, reason }),
  });
}

export async function adminUndo(id: string): Promise<{ restored?: string }> {
  const data = (await adminFetch('/api/wall/admin', {
    method: 'POST',
    body: JSON.stringify({ action: 'undo', id }),
  })) as { restored?: string };
  return { restored: data.restored };
}

export async function adminUpdate(
  id: string,
  patch: { name?: string; caption?: string },
): Promise<WallItem> {
  const data = (await adminFetch('/api/wall/admin', {
    method: 'POST',
    body: JSON.stringify({ action: 'update', id, ...patch }),
  })) as { item?: WallItem };
  return data.item as WallItem;
}

export async function adminSetNote(id: string, note: string): Promise<void> {
  await adminFetch('/api/wall/admin', {
    method: 'POST',
    body: JSON.stringify({ action: 'set_note', id, note }),
  });
}

export async function adminBulk(
  op: 'approve' | 'reject' | 'unpublish',
  ids: string[],
  reason?: string,
): Promise<{ id: string; state: string; error?: string }[]> {
  const data = (await adminFetch('/api/wall/admin', {
    method: 'POST',
    body: JSON.stringify({ action: 'bulk', op, ids, reason: reason || 'Other' }),
  })) as { results?: { id: string; state: string; error?: string }[] };
  return data.results ?? [];
}

export async function adminBeginReview(id: string): Promise<{ locked: boolean; lockedBy?: string }> {
  const data = (await adminFetch('/api/wall/admin', {
    method: 'POST',
    body: JSON.stringify({ action: 'begin_review', id }),
  })) as { locked?: boolean; lockedBy?: string };
  return { locked: Boolean(data.locked), lockedBy: data.lockedBy };
}

export async function adminEndReview(id: string): Promise<void> {
  await adminFetch('/api/wall/admin', {
    method: 'POST',
    body: JSON.stringify({ action: 'end_review', id }),
  });
}

export async function adminClearReports(id: string): Promise<void> {
  await adminFetch('/api/wall/admin', {
    method: 'POST',
    body: JSON.stringify({ action: 'clear_reports', id }),
  });
}

export async function adminAll(): Promise<WallItem[]> {
  const data = (await adminFetch('/api/wall/admin?action=all')) as { items?: WallItem[] };
  return data.items ?? [];
}

export interface AdminAction {
  id: string;
  submission_id: string;
  action: string;
  admin: string | null;
  reason: string | null;
  note: string | null;
  meta: Record<string, unknown> | null;
  created_at: string;
}

export async function adminAudit(): Promise<AdminAction[]> {
  const data = (await adminFetch('/api/wall/admin?action=audit')) as { actions?: AdminAction[] };
  return data.actions ?? [];
}

export async function adminFlagged(): Promise<{ items: WallItem[]; totalReports: number }> {
  const data = (await adminFetch('/api/wall/admin?action=flagged')) as {
    items?: WallItem[];
    totalReports?: number;
  };
  return { items: data.items ?? [], totalReports: data.totalReports ?? 0 };
}

export async function adminWhoami(): Promise<string> {
  const data = (await adminFetch('/api/wall/admin?action=whoami')) as { admin?: string };
  return data.admin ?? '';
}

/** Public report flag — routes a wall edit into the admin "Flagged" tab. */
export async function reportSubmission(input: {
  submissionId: string;
  reason: string;
}): Promise<{ already?: boolean }> {
  const res = await fetch(apiUrl('/api/wall/report'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      submission_id: input.submissionId,
      device_id: getDeviceId(),
      reason: input.reason,
    }),
  });
  const body = (await res.json().catch(() => ({}))) as { error?: string; already?: boolean };
  if (!res.ok) throw new Error(body.error ?? 'report_failed');
  return { already: Boolean(body.already) };
}

// ---------------------------------------------------------------------------
// per-device likes
// ---------------------------------------------------------------------------

const DEVICE_KEY = 'tmnaa_device_id';

export function getDeviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `d_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return `d_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }
}

/** Which submission ids this device has already liked (server truth). */
export async function fetchLikedIds(): Promise<string[]> {
  const deviceId = getDeviceId();
  const res = await fetch(apiUrl(`/api/wall/like?device_id=${encodeURIComponent(deviceId)}`));
  if (!res.ok) return [];
  const body = (await res.json().catch(() => ({}))) as { ids?: string[] };
  return body.ids ?? [];
}

export interface LikeResult {
  liked: boolean;
  likes: number;
}

export async function toggleLike(submissionId: string, liked: boolean): Promise<LikeResult> {
  const deviceId = getDeviceId();
  const res = await fetch(apiUrl('/api/wall/like'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: liked ? 'like' : 'unlike',
      submission_id: submissionId,
      device_id: deviceId,
    }),
  });
  const body = (await res.json().catch(() => ({}))) as Partial<LikeResult> & { error?: string };
  if (!res.ok) throw new Error(body.error ?? 'like_failed');
  return { liked: Boolean(body.liked), likes: Number(body.likes ?? 0) };
}
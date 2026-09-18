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
}

import { apiUrl, resolveMediaUrl } from './apiBase';

const ADMIN_TOKEN_KEY = 'tmnaa_admin_token';

export function getAdminToken(): string | null {
  try {
    return localStorage.getItem(ADMIN_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAdminToken(token: string): void {
  localStorage.setItem(ADMIN_TOKEN_KEY, token);
}

export function clearAdminToken(): void {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
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

function resolveItem(u: WallItem): WallItem {
  return {
    ...u,
    posterUrl: resolveMediaUrl(u.posterUrl),
    mediaUrl: resolveMediaUrl(u.mediaUrl),
  };
}

export async function fetchWall(): Promise<WallItem[]> {
  const res = await fetch(apiUrl('/api/wall'));
  const data = await res.json().catch(() => ({ items: [] }));
  if (!res.ok) throw new Error(String(data?.error ?? 'wall_fetch_failed'));
  return Array.isArray(data?.items) ? data.items.map(resolveItem) : [];
}

export interface SubmitUploadInput {
  file: File;
  name: string;
  caption: string;
  poster?: string;
}

export async function submitUpload(input: SubmitUploadInput): Promise<WallItem> {
  const fd = new FormData();
  fd.append('name', input.name);
  fd.append('caption', input.caption);
  if (input.poster) fd.append('poster', input.poster);
  fd.append('file', input.file);
  const res = await fetch(apiUrl('/api/wall/upload'), { method: 'POST', body: fd });
  const data = await res.json().catch(() => ({ error: 'unknown' }));
  if (!res.ok) throw new Error(String(data?.error ?? 'upload_failed'));
  return resolveItem(data.item as WallItem);
}

export async function submitLink(input: {
  name: string;
  caption: string;
  url: string;
}): Promise<WallItem> {
  const res = await fetch(apiUrl('/api/wall/link'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const data = await res.json().catch(() => ({ error: 'unknown' }));
  if (!res.ok) throw new Error(String(data?.error ?? 'link_failed'));
  return resolveItem(data.item as WallItem);
}

// ---------------------------------------------------------------------------
// admin API
// ---------------------------------------------------------------------------

export async function adminLogin(password: string): Promise<{ token: string; expiresAt: string }> {
  const res = await fetch(apiUrl('/api/admin/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  const data = await res.json().catch(() => ({ error: 'unknown' }));
  if (!res.ok) throw new Error(String(data?.error ?? 'login_failed'));
  return data as { token: string; expiresAt: string };
}

export interface AdminStatus {
  pending: number;
  approved: number;
  rejected: number;
}

export async function adminStatus(): Promise<AdminStatus> {
  return adminGet<AdminStatus>('/api/admin/status');
}

export async function adminList(status: WallStatus): Promise<WallItem[]> {
  const data = await adminGet<{ items: WallItem[] }>(`/api/admin/wall?status=${status}`);
  return (data?.items ?? []).map(resolveItem);
}

export async function adminApprove(id: string): Promise<void> {
  await adminPost(`/api/admin/wall/${id}/approve`);
}

export async function adminReject(id: string): Promise<void> {
  await adminPost(`/api/admin/wall/${id}/reject`);
}

async function adminGet<T>(path: string): Promise<T> {
  const token = getAdminToken();
  const res = await fetch(apiUrl(path), { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json().catch(() => ({ error: 'unknown' }));
  if (res.status === 401) {
    clearAdminToken();
    throw new Error('unauthorized');
  }
  if (!res.ok) throw new Error(String(data?.error ?? 'admin_request_failed'));
  return data as T;
}

async function adminPost(path: string): Promise<void> {
  const token = getAdminToken();
  const res = await fetch(apiUrl(path), {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({ error: 'unknown' }));
  if (res.status === 401) {
    clearAdminToken();
    throw new Error('unauthorized');
  }
  if (!res.ok) throw new Error(String(data?.error ?? 'admin_request_failed'));
}
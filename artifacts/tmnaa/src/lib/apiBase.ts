const RAW_BASE = ((import.meta.env.VITE_API_URL as string | undefined) ?? '').trim();
const API_BASE = RAW_BASE ? RAW_BASE.replace(/\/+$/, '') : '';

export function apiUrl(path: string): string {
  if (API_BASE) return API_BASE.endsWith(path) ? API_BASE : `${API_BASE}${path}`;
  return path;
}

export function apiBase(): string {
  return API_BASE;
}

export function resolveMediaUrl(u: string | null | undefined): string | null {
  if (!u) return null;
  if (API_BASE && u.startsWith('/')) return `${API_BASE}${u}`;
  return u;
}
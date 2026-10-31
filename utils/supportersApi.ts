// Tip leaderboards — two live sources, names + rank only.
//   • Streamlabs v6 public leaderboard (no token needed)
//   • creators.sa unified (Dokan) leaderboard
// Both go through /api/kick proxy first (no CORS), then direct, then stale cache.

import { kickFetch } from './kickApi';

export interface TipDonor {
  name: string;
  rank: number;
}

export type TipInterval = 'all' | 'week' | 'month';
export type TipSource = 'streamlabs' | 'dokan';

const STREAMLABS_BASE = 'https://streamlabs.com/api/v6/370edb1df07a702/leaderboard/tip';
const DOKAN_BASE = 'https://api.creators.sa/v1/kebab/unified/xlxwi/leaderboard';

const CACHE_PREFIX = 'xlxwi_tipboard_';
export const TIP_TTL_MS = 5 * 60 * 1000;

const DURATION_OF: Record<TipInterval, string> = {
  all: 'lifetime',
  month: 'monthly',
  week: 'weekly',
};

function cacheKey(source: TipSource, interval: TipInterval): string {
  return `${CACHE_PREFIX}${source}_${interval}`;
}

function normalizeStreamlabs(input: any): TipDonor[] {
  const arr = Array.isArray(input?.donors) ? input.donors : [];
  return arr
    .filter((d: any) => d && typeof d.name === 'string' && d.name.trim())
    .map((d: any) => ({ name: d.name.trim(), rank: Number(d.rank) || 0 }))
    .sort((a: TipDonor, b: TipDonor) => a.rank - b.rank)
    .slice(0, 10);
}

function normalizeDokan(input: any): TipDonor[] {
  const arr = Array.isArray(input) ? input : Array.isArray(input?.data) ? input.data : [];
  return arr
    .filter((d: any) => d && typeof d.uname === 'string' && d.uname.trim())
    .map((d: any, i: number) => ({ name: d.uname.trim(), rank: Number(d.rank) || i + 1 }))
    .slice(0, 10);
}

function readCache(key: string): TipDonor[] | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { at, list } = JSON.parse(raw);
    if (!Array.isArray(list)) return null;
    if (Date.now() - at > TIP_TTL_MS) return null;
    return list;
  } catch {
    return null;
  }
}

function writeCache(key: string, list: TipDonor[]): void {
  try {
    localStorage.setItem(key, JSON.stringify({ at: Date.now(), list }));
  } catch {}
}

function urlFor(source: TipSource, interval: TipInterval): string {
  return source === 'dokan'
    ? `${DOKAN_BASE}?limit=10&duration=${DURATION_OF[interval]}`
    : `${STREAMLABS_BASE}?interval=${interval}`;
}

function normalizeFor(source: TipSource): (raw: any) => TipDonor[] {
  return source === 'dokan' ? normalizeDokan : normalizeStreamlabs;
}

export async function getTipLeaderboard(source: TipSource, interval: TipInterval): Promise<TipDonor[]> {
  const key = cacheKey(source, interval);
  const url = urlFor(source, interval);
  const normalize = normalizeFor(source);

  // 1) server proxy
  try {
    const list = normalize(await kickFetch(url));
    if (list.length) {
      writeCache(key, list);
      return list;
    }
  } catch {}
  // 2) direct
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 9000);
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    clearTimeout(t);
    if (res.ok) {
      const list = normalize(await res.json());
      if (list.length) {
        writeCache(key, list);
        return list;
      }
    }
  } catch {}
  // 3) stale cache (even expired — better than nothing)
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const { list } = JSON.parse(raw);
      if (Array.isArray(list) && list.length) return list;
    }
  } catch {}
  return [];
}

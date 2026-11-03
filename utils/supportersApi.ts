// لوحة المتصدرين — دكان (creators.sa unified) فقط: أسماء الداعمين ورتبهم.
// ستريم لابس لا يملك API عاماً يرجع متصدري باسم الحساب، فبقي دعمه رابطاً فقط.
// المسار: بروكسي /api/kick (بلا CORS) ← مباشر ← كاش قديم.

import { kickFetch } from './kickApi';

export interface TipDonor {
  name: string;
  rank: number;
}

export type TipInterval = 'all' | 'week' | 'month';

const DOKAN_BASE = 'https://api.creators.sa/v1/kebab/unified/tmnaa/leaderboard';

const CACHE_PREFIX = 'tmnaa_tipboard_';
const TIP_TTL_MS = 5 * 60 * 1000;

const DURATION_OF: Record<TipInterval, string> = {
  all: 'lifetime',
  month: 'monthly',
  week: 'weekly',
};

const cacheKey = (interval: TipInterval): string => `${CACHE_PREFIX}${interval}`;

// الرد مصفوفة مرتبة تنازلياً بمجموع الدعم ولا تحمل حقل rank، فتُشتق الرتبة من موضعها
function normalizeDokan(input: any): TipDonor[] {
  const arr = Array.isArray(input) ? input : Array.isArray(input?.data) ? input.data : [];
  return arr
    .filter((d: any) => d && typeof d.uname === 'string' && d.uname.trim())
    .map((d: any, i: number) => ({ name: d.uname.trim(), rank: Number(d.rank) || i + 1 }))
    .sort((a: TipDonor, b: TipDonor) => a.rank - b.rank)
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

/** مصفوفة فارغة = المصدر يعمل ولا داعمين في الفترة. null = تعذّر الوصول للمصدر. */
export async function getTipLeaderboard(interval: TipInterval): Promise<TipDonor[] | null> {
  const key = cacheKey(interval);
  const url = `${DOKAN_BASE}?limit=10&duration=${DURATION_OF[interval]}`;

  const fresh = readCache(key);
  if (fresh) return fresh;

  // 1) server proxy — رد مصفوفة صالح ولو فارغة يعني «لا داعمين في الفترة»
  try {
    const raw = await kickFetch(url);
    const list = normalizeDokan(raw);
    if (Array.isArray(raw) || Array.isArray(raw?.data)) {
      writeCache(key, list);
      return list;
    }
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
      const raw = await res.json();
      const list = normalizeDokan(raw);
      if (Array.isArray(raw) || Array.isArray(raw?.data)) {
        writeCache(key, list);
        return list;
      }
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
      if (Array.isArray(list)) return list;
    }
  } catch {}
  return null;
}

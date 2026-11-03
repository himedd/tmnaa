// ============================================================
//  Botrix leaderboard — المصدر الموحد لأهل الشات
//  يستخدمه: ChatLegends (أساطير الشات) + بطاقة ساعات مشاهدة الكلان
//  كاش 5 دقائق (ذاكرة + localStorage) عشان ما نضرب الـ API مع كل رسالة
// ============================================================

export interface BotrixEntry {
  level: number;
  watchtime: number; // بالدقائق — تقارب النقاط 1:1 يؤكد الوحدة
  xp: number;
  points: number;
  name: string;
}

const API_URL =
  '/api/kick?endpoint=' +
  encodeURIComponent('https://botrix.live/api/public/leaderboard?platform=kick&user=tmnaa');

const CACHE_KEY = 'tmnaa_botrix_cache_v1';
const TTL_MS = 5 * 60 * 1000;

let memCache: { at: number; data: BotrixEntry[] } | null = null;
let inflight: Promise<BotrixEntry[]> | null = null;

function toNum(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.round(v);
  if (typeof v === 'string') {
    const n = parseInt(v.replace(/[^\d]/g, ''), 10);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function normalize(json: unknown): BotrixEntry[] {
  if (!Array.isArray(json)) return [];
  return (json as any[])
    .filter((e) => e && typeof e.name === 'string' && e.name.trim().length > 0)
    .map((e) => ({
      name: String(e.name).trim(),
      level: toNum(e.level),
      watchtime: toNum(e.watchtime),
      xp: toNum(e.xp),
      points: toNum(e.points),
    }));
}

function readCache(): BotrixEntry[] | null {
  if (memCache && Date.now() - memCache.at < TTL_MS) return memCache.data;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { at, data } = JSON.parse(raw);
    if (!Array.isArray(data) || Date.now() - at > TTL_MS) return null;
    memCache = { at, data };
    return data;
  } catch {
    return null;
  }
}

function writeCache(data: BotrixEntry[]) {
  memCache = { at: Date.now(), data };
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data }));
  } catch {}
}

/** يجلب المتصدرين (كاش 5 دقائق + دمج الطلبات المتزامنة). يرجع [] عند الفشل. */
export async function fetchBotrixLeaderboard(force = false): Promise<BotrixEntry[]> {
  if (!force) {
    const hit = readCache();
    if (hit) return hit;
  }
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const res = await fetch(API_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const data = normalize(json);
      if (data.length > 0) writeCache(data);
      return data.length > 0 ? data : readCache() || [];
    } catch {
      return readCache() || [];
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

// Live social counters — كل منصة لها رقم حيّ يتحدث كل 5 دقائق:
//   1) /api/social (سيرفر: Vercel Edge في الإنتاج، middleware في التطوير)
//   2) قراءة مباشرة من المتصفح للمصادر المفتوحة (fxtwitter / كيك عبر /api/kick)
//   3) آخر رقم معروف محفوظ في المتصفح — حتى ما يختفي الرقم أبداً
// واتساب: لا يوجد API عام — رقم ثابت من صاحب الحساب (40,000).
// إنستغرام ويوتيوب وإكس: بلا API عام، فتُقرأ من صفحة البروفايل نفسها (زاحف/قارئ).

export type CountPlatform = 'kick' | 'instagram' | 'tiktok' | 'twitter' | 'discord' | 'youtube';

export interface SocialMediaStats {
  kick?: number;
  instagram?: number;
  tiktok?: number;
  twitter?: number;
  discord?: number;
  youtube?: number;
  whatsapp?: number;
}

export const HANDLES: Record<CountPlatform, string> = {
  kick: 'tmnaa',
  instagram: 'tmnaa16',
  tiktok: 'tmnaa0',
  twitter: 'tmnaa16',
  discord: 'tmfx',
  youtube: 'tmnaa1',
};

/**
 * بذرة آخر قراءة موثّقة (2 نوفمبر 2026 من /api/social لكل منصة).
 * كل المنصات تُقرأ حيّاً الآن، فالبذرة رقم حقيقي لا حشو — البطاقة تبدأ
 * ممتلئة وتُصحَّح لحظة وصول أول طلب.
 */
export const FALLBACK: SocialMediaStats = {
  kick: 309861,
  instagram: 4725,
  tiktok: 57000,
  twitter: 75200,
  discord: 18196,
  youtube: 65600,
  whatsapp: 40000, // رقم المالك — لا يوجد API عام
};

const CACHE_KEY = 'tmnaa_social_cache_v2';
export const SOCIAL_TTL_MS = 5 * 60 * 1000;

async function fetchJson(url: string, timeoutMs = 9000): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v) && v > 0) return Math.round(v);
  if (typeof v === 'string') {
    const n = parseInt(v.replace(/[^\d]/g, ''), 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  return null;
}

/** القراءة المشتركة: سيرفرنا أولاً ثم مصدر مباشر إن وُجد. */
async function readPlatform(p: CountPlatform): Promise<number | null> {
  try {
    const j = await fetchJson(`/api/social?platform=${p}`);
    const n = num(j?.count);
    if (n) return n;
  } catch {}
  try {
    if (p === 'twitter') {
      const d = await fetchJson(`https://api.fxtwitter.com/${HANDLES.twitter}`);
      return num(d?.user?.followers);
    }
    if (p === 'kick') {
      const d = await fetchJson(`/api/kick?endpoint=${encodeURIComponent(`https://kick.com/api/v2/channels/${HANDLES.kick}`)}`);
      const c = d?.channel || d;
      return num(c?.followers_count);
    }
  } catch {}
  return null;
}

/** آخر قيم معروفة (ولو قديمة) — عشان الرقم ما يختفي من الواجهة. */
function cachedStats(): SocialMediaStats {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed?.stats || {};
  } catch {
    return {};
  }
}

export async function getAllSocialMediaStats(): Promise<SocialMediaStats> {
  const previous = cachedStats();
  const platforms: CountPlatform[] = ['kick', 'instagram', 'tiktok', 'twitter', 'discord', 'youtube'];
  const results = await Promise.all(platforms.map(readPlatform));
  const stats: SocialMediaStats = { whatsapp: FALLBACK.whatsapp };
  platforms.forEach((p, i) => {
    stats[p] = results[i] || previous[p] || FALLBACK[p] || 0;
  });
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), stats }));
  } catch {}
  return stats;
}

/** رسم فوري من الكاش (ولو منتهي) — الأرقام تظهر قبل ما يوصل الرد الحيّ. */
export function readSocialCache(): (SocialMediaStats & { _fresh: boolean }) | null {
  const stats = cachedStats();
  if (!Object.keys(stats).length) return null;
  try {
    const { at } = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
    return { ...stats, _fresh: Date.now() - (at || 0) < SOCIAL_TTL_MS };
  } catch {
    return { ...stats, _fresh: false };
  }
}

export function formatFollowerCount(count: number): string {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
  return count ? count.toString() : '';
}

export async function getCachedSocialMediaStats(): Promise<SocialMediaStats> {
  return getAllSocialMediaStats();
}

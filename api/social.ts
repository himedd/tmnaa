// Vercel Edge Function — Live Social Counters API
// GET /api/social?platform=kick|tiktok|instagram|twitter|discord|youtube
// Server-side fetch = no CORS issues, fresh numbers every call.
// Vercel caches success responses for 4 minutes (s-maxage).

export const config = {
  runtime: 'edge',
};

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const HANDLES = {
  kick: 'tmnaa',
  tiktok: 'tmnaa0',
  instagram: 'tmnaa16',
  twitter: 'tmnaa16',
  discord: 'tmfx',
  youtube: 'tmnaa1',
} as const;

type Platform = keyof typeof HANDLES;

async function fetchJson(url: string, timeoutMs = 9000, extraHeaders: Record<string, string> = {}): Promise<any> {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9', ...extraHeaders },
      signal: c.signal,
    });
    if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

async function fetchText(url: string, timeoutMs = 9000, extraHeaders: Record<string, string> = {}): Promise<string> {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      headers: { Accept: 'text/html,application/xhtml+xml', 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9', ...extraHeaders },
      signal: c.signal,
    });
    if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
    return await r.text();
  } finally {
    clearTimeout(t);
  }
}

/** "68,337" | "68.3K" | "1.2M" -> 68337 */
function parseCompact(input: unknown): number | null {
  if (typeof input === 'number' && Number.isFinite(input)) return Math.round(input);
  const s = String(input ?? '').replace(/,/g, '').trim();
  const m = s.match(/([\d.]+)\s*([KMB])?/i);
  if (!m) return null;
  let n = parseFloat(m[1]);
  if (!Number.isFinite(n)) return null;
  const u = (m[2] || '').toUpperCase();
  if (u === 'K') n *= 1e3;
  else if (u === 'M') n *= 1e6;
  else if (u === 'B') n *= 1e9;
  const out = Math.round(n);
  return out > 0 ? out : null;
}

async function fetchMarkdown(url: string, timeoutMs = 14000): Promise<string> {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), timeoutMs);
  try {
    const r = await fetch(`https://r.jina.ai/${url}`, {
      headers: { Accept: 'text/plain', 'User-Agent': UA, 'X-Return-Format': 'markdown' },
      signal: c.signal,
    });
    if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
    return await r.text();
  } finally {
    clearTimeout(t);
  }
}

/** "26.7K Followers" من نص الصفحة — أول نتيجة هي رقم الحساب نفسه */
function parseFollowersFromText(text: string): number | null {
  const m = String(text || '').match(/([\d][\d.,]*\s*[KMB]?)\s*\*{0,2}\s*(?:Followers|followers|subscribers|Subscribers)/);
  return m ? parseCompact(m[1]) : null;
}

async function getKick(): Promise<{ count: number; source: string }> {
  // UA مختصر: الـ UA الكامل يفعّل حظر Kick الأمني (403) — نفس ما يفعّل في /api/kick
  const d = await fetchJson(`https://kick.com/api/v2/channels/${HANDLES.kick}`, 12000, { 'User-Agent': 'Mozilla/5.0' });
  const n = parseCompact(d?.channel?.followers_count ?? d?.followers_count);
  if (!n) throw new Error('kick: empty');
  return { count: n, source: 'kick_v2' };
}

async function getDiscord(): Promise<{ count: number; source: string }> {
  const d = await fetchJson(`https://discord.com/api/v9/invites/${HANDLES.discord}?with_counts=true`);
  const n = parseCompact(d?.approximate_member_count);
  if (!n) throw new Error('discord: empty');
  return { count: n, source: 'discord_invite' };
}

/** يوتيوب ما ينشر عدّاده في API عام بلا مفتاح — قراءة من صفحة القناة نفسها. */
async function getYouTube(): Promise<{ count: number; source: string }> {
  const subsRe = /([\d][\d.,]*)\s*(?:\u0645\u0634\u062a\u0631\u0643|subscribers)/i;
  try {
    const html = await fetchText(`https://www.youtube.com/@${HANDLES.youtube}/about`);
    const ld = html.match(/"subscriberCountText"\s*:\s*\{\s*"simpleText"\s*:\s*"([^"]+)"/)?.[1];
    const n = (ld ? parseCompact(ld) : null) || parseFollowersFromText(html);
    if (n) return { count: n, source: 'yt_page' };
    const m = html.match(subsRe);
    const n2 = m ? parseCompact(m[1]) : null;
    if (n2) return { count: n2, source: 'yt_regex' };
  } catch {}
  try {
    const txt = await fetchMarkdown(`https://www.youtube.com/@${HANDLES.youtube}`);
    const n = parseFollowersFromText(txt) || (() => { const m = txt.match(subsRe); return m ? parseCompact(m[1]) : null; })();
    if (n) return { count: n, source: 'reader' };
  } catch {}
  throw new Error('youtube: no public counter');
}

async function getTikTok(): Promise<{ count: number; source: string }> {
  // 1) TikMatrix — open JSON, exact count
  try {
    const d = await fetchJson(`https://user.tikmatrix.com/api/user?username=${HANDLES.tiktok}`);
    const n = parseCompact(d?.stats?.Followers);
    if (n) return { count: n, source: 'tikmatrix' };
  } catch {}
  // 2) Countik
  try {
    const d = await fetchJson(`https://countik.com/api/tiktok/@${HANDLES.tiktok}`);
    const n = parseCompact(d?.followerCount ?? d?.followers ?? d?.follower_count);
    if (n) return { count: n, source: 'countik' };
  } catch {}
  // 3) نص صفحة البروفايل
  try {
    const txt = await fetchMarkdown(`https://www.tiktok.com/@${HANDLES.tiktok}`);
    const n = parseFollowersFromText(txt);
    if (n) return { count: n, source: 'reader' };
  } catch {}
  throw new Error('tiktok: all sources failed');
}

async function getTwitter(): Promise<{ count: number; source: string }> {
  // 1) FixTweet — exact followers
  try {
    const d = await fetchJson(`https://api.fxtwitter.com/${HANDLES.twitter}`);
    const n = parseCompact(d?.user?.followers);
    if (n) return { count: n, source: 'fxtwitter' };
  } catch {}
  // 2) X syndication endpoint
  try {
    const d = await fetchJson(
      `https://cdn.syndication.twimg.com/widgets/followbutton/info.json?screen_names=${HANDLES.twitter}`
    );
    const n = parseCompact(Array.isArray(d) ? d[0]?.followers_count : d?.followers_count);
    if (n) return { count: n, source: 'syndication' };
  } catch {}
  // 3) قارئ نصي لصفحة البروفايل — الحقل الوحيد الذي لا يحجبه إكس
  try {
    const txt = await fetchMarkdown(`https://x.com/${HANDLES.twitter}`);
    const n = parseFollowersFromText(txt);
    if (n) return { count: n, source: 'reader' };
  } catch {}
  throw new Error('twitter: all sources failed');
}

/** معرّف تطبيق إنستغرام العام (الويب) — بدونه ترجع 429 دائماً */
const IG_APP_ID = '936619743392459';
const IG_HEADERS = {
  'x-ig-app-id': IG_APP_ID,
  Origin: 'https://www.instagram.com',
  Referer: `https://www.instagram.com/${HANDLES.instagram}/`,
};

/** إنستغرام ينشر عدّاده للزواحف فقط — المتصفح العادي ياخد جدار تسجيل دخول */
const IG_CRAWLER_UA =
  'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

/** يستخرج "N Followers" من أي نص (og:description أو بيانات مضمّنة) */
function followersFromText(text: string): number | null {
  const s = String(text || '');
  const m =
    s.match(/([\d.,]+[KMB]?)\s+(?:Followers|متابع)/i) ||
    s.match(/"follower_count"\s*:\s*"?([\d.,]+[KMB]?)"?/i) ||
    s.match(/"edge_followed_by"\s*:\s*\{\s*"count"\s*:\s*([\d]+)/i);
  return m ? parseCompact(m[1]) : null;
}

async function getInstagram(): Promise<{ count: number; source: string }> {
  // 1) واجهة الويب الخاصة — أدق مصدر (تشتغل من سيرفر غير محجوب)
  for (const host of ['i.instagram.com', 'www.instagram.com']) {
    try {
      const d = await fetchJson(
        `https://${host}/api/v1/users/web_profile_info/?username=${HANDLES.instagram}`,
        9000,
        IG_HEADERS,
      );
      const n = parseCompact(d?.data?.user?.edge_followed_by?.count ?? d?.user?.follower_count);
      if (n) return { count: n, source: `web_profile_info:${host}` };
    } catch {}
  }
  // 2) ?__a=1&__d=dis — نفس البيانات بصيغة أخرى
  try {
    const d = await fetchJson(
      `https://www.instagram.com/api/v1/users/web_profile_info/?username=${HANDLES.instagram}&__a=1&__d=dis`,
      9000,
      IG_HEADERS,
    );
    const n = parseCompact(d?.user?.follower_count ?? d?.data?.user?.edge_followed_by?.count);
    if (n) return { count: n, source: 'web_profile_dis' };
  } catch {}
  // 3) HTML البروفايل بواصفة زاحف — إنستغرام يعيد للزواحف الصفحة الكاملة
  //    وفيها og:description ("8,175 Followers, …")، بينما يرد للمتصفح بقشرة JS فارغة
  const ogFromHtml = (html: string) => {
    const og = html.match(/property="og:description"\s+content="([^"]+)"/)?.[1] || '';
    return followersFromText(og) ?? followersFromText(html);
  };
  try {
    const html = await fetchText(`https://www.instagram.com/${HANDLES.instagram}/?hl=en`, 12000, { 'User-Agent': IG_CRAWLER_UA });
    const n = ogFromHtml(html);
    if (n) return { count: n, source: 'og_description_crawler' };
  } catch {}
  // 4) نفس المحاولة بواصفة متصفح عادي
  try {
    const html = await fetchText(`https://www.instagram.com/${HANDLES.instagram}/`);
    const n = ogFromHtml(html);
    if (n) return { count: n, source: 'og_description' };
  } catch {}
  // 5) نص الصفحة عبر قارئ (يحتاج الحساب يكون غير مقفل بتسجيل دخول)
  try {
    const txt = await fetchMarkdown(`https://www.instagram.com/${HANDLES.instagram}/`);
    const n = followersFromText(txt);
    if (n) return { count: n, source: 'reader' };
  } catch {}
  throw new Error('instagram: all sources failed (login-walled)');
}

export default async function handler(request: Request) {
  const { searchParams } = new URL(request.url);
  const platform = (searchParams.get('platform') || '').toLowerCase() as Platform;

  if (!platform || !(platform in HANDLES)) {
    return new Response(JSON.stringify({ error: 'Use ?platform=kick|tiktok|instagram|twitter|discord|youtube' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const loaders: Record<Platform, () => Promise<{ count: number; source: string }>> = {
      kick: getKick,
      tiktok: getTikTok,
      instagram: getInstagram,
      twitter: getTwitter,
      discord: getDiscord,
      youtube: getYouTube,
    };
    const { count, source } = await loaders[platform]();
    return new Response(JSON.stringify({ platform, count, source, updatedAt: new Date().toISOString() }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 's-maxage=240, stale-while-revalidate=600',
      },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ platform, count: null, error: err?.message || 'failed' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 's-maxage=60' },
    });
  }
}

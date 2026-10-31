import React, { useEffect, useState } from 'react';
import type { Language } from '../types';

// ============================================================
//  MODERATORS — قسم المشرفين
//  الطبقات: بروكسي /api/kick → مباشر (FixTweet) → fallback ثابت
//  الكاش: localStorage 30 دقيقة + تحديث صامت كل 10 دقائق
//  xAREEJ1 بلا حساب X — يظهر بديسكورد فقط
// ============================================================

interface RosterEntry {
  kick: string;
  x?: string;
  discordId?: string;
  /** صورة/بانر/نبذة ثابتة يختارها المشرف بنفسه — تتقدم على بيانات X */
  avatar?: string;
  banner?: string;
  bio?: string;
}

const ROSTER: RosterEntry[] = [
  { kick: 'A7MEDO', x: '_A7MEDO_' },
  { kick: 'JustN2sr', x: 'JustN2sr' },
  { kick: 'M0ATAZ', x: 'S7_Moataz' },
  { kick: 'itsN2sser', x: 'itsN2sser' },
  { kick: 'MISK_RY', x: 'MISK_RY' },
  { kick: 'Ahhud', x: '1ahhud' },
  { kick: 'shatha_20', x: 'qirz2i' },
  { kick: 'xAREEJ1', discordId: '709645074421514251', avatar: 'mods/xareej1-avatar.webp', banner: 'mods/xareej1-banner.webp', bio: 'Not every chapter needs an explanation.' },
];

const DISCORD_INVITE = 'https://discord.gg/tmfx';

/** رابط المراسلة المباشرة — يفتح محادثة خاصة مع العضو بدل دخول السيرفر */
const discordDm = (id?: string) => (id ? `https://discord.com/users/${id}` : DISCORD_INVITE);

const uid = (m: RosterEntry) => (m.x || `discord:${m.discordId}`).toLowerCase();

interface ModProfile {
  name: string;
  handle: string;
  avatar: string;
  banner: string;
  bio: string;
  followers: number | null;
  tweets: number | null;
  live: boolean;
}

const CACHE_KEY = 'xlxwi_mods_cache_v1';
const CACHE_TTL_MS = 30 * 60 * 1000;
const REFRESH_MS = 10 * 60 * 1000;

/**
 * يضبط مقاس صورة البانر من CDN — المقاسات المتاحة فقط، غير ذلك 404.
 */
const BANNER_SIZES = ['1500x500', '600x200', '300x100'] as const;

const stripBannerSize = (url: string): string => url.split('?')[0].replace(/\/$/, '').replace(/\/(1500x500|600x200|300x100|normal)$/, '');

const bannerAt = (url: string, size: typeof BANNER_SIZES[number]): string => (url ? `${stripBannerSize(url)}/${size}` : '');

const compact = (n: number | null | undefined) => {
  if (n == null || !Number.isFinite(n)) return '---';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
};

async function fetchJson(url: string, timeoutMs = 10000): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// الطبقة 1: بروكسي الموقع (بلا مشاكل CORS) → الطبقة 2: مباشر → الطبقة 3: بلا بيانات
async function fetchMod(handle: string): Promise<ModProfile | null> {
  const target = `https://api.fxtwitter.com/${handle}`;
  let user: any = null;
  try {
    const via = await fetchJson('/api/kick?endpoint=' + encodeURIComponent(target));
    user = via?.user || null;
  } catch {
    /* fall through */
  }
  if (!user) {
    try {
      const direct = await fetchJson(target);
      user = direct?.user || null;
    } catch {
      /* fall through */
    }
  }
  if (!user) return null;

  const avatarRaw: string = user.avatar_url || '';
  const bannerRaw: string = user.banner_url || '';

  return {
    name: user.name || handle,
    handle: user.screen_name || handle,
    // الصورة تُعرض بحجم 56px — 200x200 أكثر من كافٍ
    avatar: avatarRaw ? avatarRaw.replace('_normal.', '_200x200.') : '',
    banner: bannerAt(bannerRaw, '600x200'),
    bio: user.description || '',
    followers: typeof user.followers === 'number' ? user.followers : null,
    tweets: typeof user.tweets === 'number' ? user.tweets : null,
    live: true,
  };
}

function readCache(): { at: number; data: Record<string, ModProfile> } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.data) return null;
    return parsed;
  } catch {
    return null;
  }
}

// ---------- Icons ----------
const XIconSmall: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className || 'w-3.5 h-3.5'} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const DiscordIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className || 'w-3.5 h-3.5'} viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.317 4.369a19.79 19.79 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.6 12.6 0 00-.617-1.25.077.077 0 00-.079-.037A19.74 19.74 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.056 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.1 13.1 0 01-1.872-.892.077.077 0 01-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 01.078-.01c3.927 1.793 8.18 1.793 12.061 0a.074.074 0 01.079.009c.12.099.245.198.372.292a.077.077 0 01-.006.127 12.3 12.3 0 01-1.873.891.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.84 19.84 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.06.06 0 00-.031-.029zM8.02 15.331c-1.182 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
  </svg>
);

const MessageIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className || 'w-3.5 h-3.5'} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h8M8 14h5m-8 4.5V6a2 2 0 012-2h12a2 2 0 012 2v9a2 2 0 01-2 2h-7l-4 3.5v-3.5H7z" />
  </svg>
);

const ShieldIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className || 'w-3 h-3'} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
  </svg>
);

// ---------- Section ----------
const ModeratorsSection: React.FC<{ lang: Language }> = ({ lang }) => {
  const [profiles, setProfiles] = useState<Record<string, ModProfile>>(() => readCache()?.data || {});
  const [loading, setLoading] = useState(true);

  const t = {
    mod: lang === 'ar' ? 'مشرف' : 'MOD',
    followers: lang === 'ar' ? 'متابع' : 'Followers',
    posts: lang === 'ar' ? 'منشور' : 'Posts',
    follow: lang === 'ar' ? 'تابع' : 'Follow',
    discordOnly: lang === 'ar' ? 'ديسكورد فقط' : 'DISCORD ONLY',
    dm: lang === 'ar' ? 'مراسلة' : 'MESSAGE',
    house: lang === 'ar' ? 'بيت كلان ليفل ون' : 'Clan Level One HQ',
  };

  useEffect(() => {
    let cancelled = false;
    const withX = ROSTER.filter((m) => m.x);

    const load = async (useCacheFirst = true) => {
      const cached = readCache();
      const fresh = cached && Date.now() - cached.at < CACHE_TTL_MS;
      if (useCacheFirst && fresh) {
        setProfiles(cached.data);
        setLoading(false);
        return;
      }
      for (let i = 0; i < withX.length; i += 3) {
        const batch = await Promise.all(
          withX.slice(i, i + 3).map(async (m) => {
            try {
              const p = await fetchMod(m.x!);
              return { id: uid(m), p };
            } catch {
              return { id: uid(m), p: null };
            }
          }),
        );
        if (cancelled) return;
        const next: Record<string, ModProfile> = {};
        batch.forEach(({ id, p }) => {
          if (p) next[id] = p;
        });
        if (Object.keys(next).length > 0) {
          setProfiles((prev) => {
            const merged = { ...prev, ...next };
            try {
              localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data: merged }));
            } catch {}
            return merged;
          });
        }
      }
      if (!cancelled) setLoading(false);
    };

    load(true);
    // تحديث صامت كل 10 دقائق، ويتوقف والتبويب مخفي
    let timer: ReturnType<typeof setInterval> | null = null;
    const startRefresh = () => { if (!timer) timer = setInterval(() => load(false), REFRESH_MS); };
    const stopRefresh = () => { if (timer) { clearInterval(timer); timer = null; } };
    const onVis = () => (document.visibilityState === 'visible' ? startRefresh() : stopRefresh());
    startRefresh();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelled = true;
      stopRefresh();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  // Fallback ذكي: اسم كيك الثابت إن غابت بيانات X، والثابت المختار يدوياً يتقدم على الكل
  const get = (m: RosterEntry): ModProfile => {
    const p = profiles[uid(m)];
    return {
      name: p?.name || m.kick,
      handle: p?.handle || m.x || m.kick,
      avatar: m.avatar || p?.avatar || '',
      banner: m.banner || p?.banner || '',
      bio: m.bio || p?.bio || '',
      followers: p?.followers ?? null,
      tweets: p?.tweets ?? null,
      live: p?.live || false,
    };
  };

  return (
    <div className="w-full">
      {/* شريط المزامنة العلوي */}
      <div
        className={`h-[2px] w-full overflow-hidden rounded-full bg-white/[0.06] mb-4 md:mb-6 transition-opacity duration-700 ${loading ? 'opacity-100' : 'opacity-0'}`}
      >
        <div className="h-full w-1/3 rounded-full bg-gradient-to-r from-transparent via-gold to-transparent animate-pulse" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {ROSTER.map((m, i) => {
          const p = get(m);
          const isDiscordOnly = !m.x;
          return (
            <div
              key={uid(m)}
              className="group relative overflow-hidden rounded-[22px] border border-gold/15 bg-wine-900/85 transition-all hover:border-gold/50 hover:-translate-y-1 hover:shadow-[0_24px_60px_-16px_rgba(227,179,65,0.35)] duration-300 opacity-0 animate-fade-in-up"
              style={{ animationDelay: `${Math.min(i * 70, 490)}ms` }}
            >
              {/* بانر */}
              <div className="relative h-20 sm:h-24 overflow-hidden bg-gradient-to-l from-wine-600/70 via-wine-900 to-wine-950">
                {p.banner && (
                  <img
                    src={p.banner}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    width={600}
                    height={200}
                    onError={(e) => {
                      const img = e.currentTarget;
                      const base = stripBannerSize(p.banner);
                      if (!img.src.endsWith(base)) img.src = base;
                    }}
                    className="w-full h-full object-cover opacity-60 group-hover:opacity-95 group-hover:scale-105 transition-all duration-700"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-wine-950 via-wine-950/35 to-transparent" />
                <span className="absolute top-2 start-2 inline-flex items-center gap-1 text-[8px] font-black tracking-[0.16em] px-2 py-[3px] rounded-lg bg-black/55 backdrop-blur border border-gold/40 text-gold-light uppercase">
                  <ShieldIcon className="w-3 h-3" />
                  {t.mod}
                </span>
                {m.x ? (
                  <a
                    href={`https://x.com/${m.x}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`X — @${m.x}`}
                    className="absolute top-2 end-2 inline-flex items-center justify-center w-7 h-7 rounded-full bg-black/55 backdrop-blur border border-gold/25 text-white/70 hover:bg-gold hover:text-wine-950 transition-all"
                  >
                    <XIconSmall className="w-3.5 h-3.5" />
                  </a>
                ) : (
                  <a
                    href={discordDm(m.discordId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={lang === 'ar' ? 'مراسلة على ديسكورد' : 'Direct message on Discord'}
                    className="absolute top-2 end-2 inline-flex items-center justify-center w-7 h-7 rounded-full bg-black/55 backdrop-blur border border-gold/25 text-white/70 hover:bg-gold hover:text-wine-950 transition-all"
                  >
                    <DiscordIcon className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>

              {/* الهوية */}
              <div className="relative px-4 pb-4 -mt-7">
                <div className="flex items-end gap-3">
                  <div className="relative w-14 h-14 shrink-0">
                    <span
                      className="absolute inset-0 block rounded-full p-[2px]"
                      style={{ background: 'conic-gradient(from 200deg,#FFF3D6,#8A5E12,#F7E3AE,#8A5E12,#FFF3D6)' }}
                    >
                      <span className="w-full h-full rounded-full bg-wine-950 flex items-center justify-center font-black text-xl text-gold-light">
                        {m.kick.replace(/[^A-Za-z0-9\u0600-\u06FF]/g, '').charAt(0).toUpperCase() || 'خ'}
                      </span>
                      {p.avatar && (
                        <img
                          src={p.avatar} alt={p.name} loading="lazy" decoding="async"
                          width={200} height={200}
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          className="absolute inset-[2px] rounded-full object-cover bg-wine-950"
                        />
                      )}
                    </span>
                    {p.live && (
                      <span className="absolute bottom-0 end-0 w-3.5 h-3.5 rounded-full bg-gold border-2 border-wine-950 shadow-[0_0_10px_#E3B341]" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 pb-0.5">
                    <p className="text-[15px] font-black text-white truncate" dir="ltr">
                      {p.name}
                    </p>
                    <p className="text-[11px] font-bold text-white/40 truncate" dir="ltr">
                      {isDiscordOnly ? (
                        <span className="text-gold/70">DISCORD · {m.discordId}</span>
                      ) : (
                        <>@{p.handle} <span className="text-gold/60">• KICK: {m.kick}</span></>
                      )}
                    </p>
                  </div>
                </div>

                <p className="text-[11.5px] text-white/45 font-medium leading-relaxed mt-2 line-clamp-2 min-h-[32px]" dir="auto">
                  {p.bio || (isDiscordOnly ? t.house : '---')}
                </p>

                <div className="flex items-center gap-2 mt-2.5">
                  {isDiscordOnly ? (
                    <span className="text-[11px] font-black text-gold/80">{t.discordOnly}</span>
                  ) : (
                    <span className="text-[11px] font-black text-white/70" dir="ltr">
                      {compact(p.followers)} <span className="font-bold text-white/35">{t.followers}</span>
                    </span>
                  )}
                  <span className="ms-auto flex items-center gap-1.5">
                    {isDiscordOnly ? (
                      <a
                        href={discordDm(m.discordId)}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={lang === 'ar' ? 'مراسلة خاصة على ديسكورد' : 'Direct message on Discord'}
                        className="inline-flex items-center gap-1 h-8 px-3 rounded-xl bg-gradient-to-b from-gold-light to-gold text-wine-950 text-[11px] font-black hover:brightness-105 active:scale-95 transition-all"
                      >
                        <MessageIcon className="w-3.5 h-3.5" />
                        {t.dm}
                      </a>
                    ) : (
                      <a
                        href={`https://x.com/${m.x}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 h-8 px-3 rounded-xl bg-white text-black text-[11px] font-black hover:brightness-90 active:scale-95 transition-all"
                      >
                        <XIconSmall className="w-3 h-3" />
                        {t.follow}
                      </a>
                    )}
                  </span>
                </div>
              </div>
              {/* خط سفلي ذهبي يتمدد */}
              <span className="absolute bottom-0 start-0 h-[2px] w-0 group-hover:w-full bg-gradient-to-r from-gold-light to-gold-deep transition-all duration-500" />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ModeratorsSection;

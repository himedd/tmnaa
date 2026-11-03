import React, { useEffect, useState } from 'react';
import type { Language } from '../types';

// ============================================================
//  MODERATORS — حرس القلعة
//  المصدر: حساب X لكل مشرف (api.fxtwitter.com/<handle>)
//  الكاش: localStorage 15 دقيقة + تحديث صامت كل 5 دقائق
//  الصورة والبانر حيّان من إكس، ونسخة محلية في الروستر تفتح البطاقة مكتملة قبل وصول أي ردّ
// ============================================================

interface RosterEntry {
  /** معرّف حساب X كما يظهر في رابط الملف الشخصي — غائب في بطاقة ديسكورد */
  x?: string;
  /** بطاقة بلا حساب X: تُعرض كما هي، ورابطها بروفايل ديسكورد بالمعرّف */
  discord?: { user: string };
  /** الاسم كما يريده صاحب الموقع في البطاقة — لا يتغيّر بالردّ الحيّ */
  name: string;
  /** صورة محلية مأخوذة من X */
  avatar?: string;
  /** الحساب يحمل البيضة الافتراضية لإكس — تُعرض حرفه الذهبي بدل دائرة رمادية تكسر البطاقة */
  noPic?: boolean;
  /** بانر محلي من X — يُترك فارغاً إذا كان البانر الأصلي سادة */
  banner?: string;
  /** إطار زخرفي متحرك يجلس فوق الصورة */
  frame?: string;
  /** عدد المتابعات من قراءة حيّة، يظهر قبل وصول الردّ */
  seedFollowers?: number;
  /** علامة التوثيق كما ظهرت في قراءة حيّة — لا تنتظر الشبكة */
  seedVerified?: boolean;
  /** البطاقة الرئيسية في الأعلى — تاج وقاية القلعة */
  lead?: boolean;
}

const ROSTER: RosterEntry[] = [
  { x: '7yarall', name: 'YARA', avatar: 'mods/7yarall-avatar.webp', banner: 'mods/7yarall-banner.webp', seedFollowers: 569, lead: true },
  { x: 'tmna16_', name: 'MIRO', avatar: 'mods/tmna16_-avatar.webp', banner: 'mods/tmna16_-banner.webp', seedFollowers: 748, seedVerified: true },
  { x: '_l7o0', name: 'llinay', avatar: 'mods/_l7o0-avatar.webp', banner: 'mods/_l7o0-banner.webp', seedFollowers: 304 },
  { x: 's7le_a', name: 'Alghamdi', avatar: 'mods/s7le_a-avatar.webp', seedFollowers: 2298 },
  { x: 'ixravii', name: 'Reem', avatar: 'mods/ixravii-avatar.webp', seedFollowers: 498, seedVerified: true },
  { x: 'rawah515', name: 'Rawah', avatar: 'mods/rawah515-avatar.webp', seedFollowers: 173 },
  { x: 'abrror1', name: 'abrar', avatar: 'mods/abrror1-avatar.webp', banner: 'mods/abrror1-banner.webp', seedFollowers: 1237 },
  { x: '2_zxl7b', name: 'DANAH', seedFollowers: 73, noPic: true },
  { x: '7reml4', name: '7r', avatar: 'mods/7reml4-avatar.webp', banner: 'mods/7reml4-banner.webp', seedFollowers: 192 },
  { discord: { user: '709645074421514251' }, name: 'xAREEJ1', avatar: 'mods/xareej1-avatar.webp', banner: 'mods/xareej1-banner.webp', frame: 'mods/xareej1-frame.webp' },
];

const uid = (m: RosterEntry) => String(m.x ?? m.discord?.user ?? m.name).toLowerCase();
const profileUrl = (m: RosterEntry) => (m.x ? `https://x.com/${m.x}` : `https://discord.com/users/${m.discord?.user}`);

interface XProfile {
  bio: string;
  followers: number | null;
  verified: boolean;
  /** صورة البروفايل الحيّة من إكس — تحدّث نفسها لما يغيّرها المشرف */
  avatar: string;
  /** بانر إكس الحيّ، فارغ إذا ما عنده بانر */
  banner: string;
}

const CACHE_KEY = 'tmnaa_mods_cache_v3';
const CACHE_TTL_MS = 15 * 60 * 1000;
const REFRESH_MS = 5 * 60 * 1000;

const compact = (n: number | null | undefined) => {
  if (n == null || !Number.isFinite(n)) return '---';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
};

async function fetchJson(url: string, timeoutMs = 12000): Promise<any> {
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

/** إكس ما يفتح API عام بلا مفتاح — فكسغتويتر هو المصدر، ويرأس CORS لذا يندّي المتصفح مباشرة.
    يردّ أحياناً بـ 404 عابر على أول محاولة، فالتكرار بعد سكون يخلّصه. */
async function fetchX(handle: string): Promise<XProfile | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, 1600 * attempt));
    try {
      const d = await fetchJson(`https://api.fxtwitter.com/${handle}`);
      const u = d?.user;
      if (!u) continue;
      const raw = u.followers;
      const pic: string = typeof u.avatar_url === 'string' ? u.avatar_url : '';
      const ban: string = typeof u.banner_url === 'string' ? u.banner_url : '';
      return {
        // السيرة فيها خطوط جديدة ورموز زخرفة — تُسطَّر قبل العرض
        bio: typeof u.description === 'string' ? u.description.replace(/\s+/g, ' ').trim() : '',
        followers: typeof raw === 'number' ? raw : parseInt(String(raw ?? ''), 10) || null,
        verified: Boolean(u.verification?.verified),
        // أحجام CDN الرسمية: 400×400 للصورة و1500×500 للبانر
        // ردّ إكس يجي البانر بلا مقاس (.../profile_banners/<id>/<ts>) — المقاس يُضاف، ويُستبدل لو كان موجوداً
        avatar: pic ? pic.replace(/_(normal|bigger|mini|original)\b/, '_400x400') : '',
        banner: ban ? (/\d+x\d+$/.test(ban) ? ban.replace(/\d+x\d+$/, '1500x500') : `${ban}/1500x500`) : '',
      };
    } catch {
      /* تجربة ثانية، ثم نسقط للبيانات المحفوظة في الروستر */
    }
  }
  return null;
}

function readCache(): { at: number; data: Record<string, XProfile> } | null {
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
const XIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className || 'w-3.5 h-3.5'} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

/** بطاقة ديسكورد: لا حساب X ولا عدّاد متابعين عام — الشعار يشرح المصدر */
const DiscordIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className || 'w-3.5 h-3.5'} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M20.317 4.369A19.79 19.79 0 0015.885 3c-.2.36-.43.844-.588 1.23a18.27 18.27 0 00-5.4 0C8.7 3.845 8.46 3.36 8.26 3A19.74 19.74 0 003.83 4.37C.56 9.15-.31 13.81.12 18.4a19.9 19.9 0 006.03 3.05c.49-.67.92-1.38 1.3-2.13-.71-.27-1.4-.6-2.05-.99.17-.13.34-.26.5-.4a14.2 14.2 0 0012.2 0c.17.14.33.27.5.4-.65.39-1.34.72-2.06.99.38.75.81 1.46 1.3 2.13a19.86 19.86 0 006.04-3.05c.5-5.28-.84-9.9-3.55-14.03ZM8.02 15.6c-1.18 0-2.15-1.09-2.15-2.42 0-1.34.95-2.43 2.15-2.43 1.2 0 2.17 1.1 2.15 2.43 0 1.33-.95 2.42-2.15 2.42Zm7.96 0c-1.18 0-2.15-1.09-2.15-2.42 0-1.34.95-2.43 2.15-2.43 1.2 0 2.17 1.1 2.15 2.43 0 1.33-.94 2.42-2.15 2.42Z" />
  </svg>
);

const ShieldIcon: React.FC<{ className?: string }> = ({ className }) => (  <svg className={className || 'w-3 h-3'} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
  </svg>
);

const VerifiedIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className || 'w-3.5 h-3.5'} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M12 1.8l2.5 1.9 3.1-.4.9 3 2.6 1.6-1.1 2.9 1.1 2.9-2.6 1.6-.9 3-3.1-.4L12 22.2l-2.5-1.9-3.1.4-.9-3L2.9 16l1.1-2.9L2.9 10.2l2.6-1.6.9-3 3.1.4z" fill="currentColor" />
    <path d="M8.4 12.1l2.4 2.4 4.8-4.9" stroke="#0A1828" strokeWidth={2.3} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** تاج فيكتور ذهبي كامل الألوان — ثابت بلا حركة، ومقصوص على نسبة ارتفاعه الحقيقية */
const CrownArt: React.FC<{ eager: boolean }> = ({ eager }) => (
  <img src="crown.svg" alt="" aria-hidden="true" loading={eager ? 'eager' : 'lazy'}
    fetchPriority={eager ? 'high' : 'auto'} decoding="async" width={504} height={332}
    className="block h-auto w-full" />
);

const Sparkle: React.FC<{ className?: string; delay: string }> = ({ className, delay }) => (
  <span className={`cr-spark ${className || ''}`} style={{ animationDelay: delay }} aria-hidden="true" />
);

// ---------- بطاقة المشرفة/المشرف الرئيسي ----------
interface Merged {
  bio: string;
  /** null = لا يوجد عدّاد عام (بطاقة ديسكورد) — تُخفى الخانة بدل رقم كاذب */
  followers: number | null;
  verified: boolean;
  /** صورة البروفايل المعروضة: حيّة من إكس، وإلا النسخة المحلية */
  avatar: string;
  /** البانر المعروض: فارغ إذا ما عنده بانر أو إذا فشل كل منهما */
  banner: string;
  /** الإطار المتحرك فوق الصورة، إن وُجد */
  frame: string;
}

/** الشريط العلوي للبطاقات التي بلا بانر — شعار الموقع في نقش ذهبي بدل مساحة فاضية */
const CrestBand: React.FC<{ eager: boolean }> = ({ eager }) => (
  <>
    <span className="absolute inset-0" aria-hidden="true"
      style={{ background: 'linear-gradient(115deg, rgba(20,44,76,0.92) 0%, rgba(4,10,20,0.96) 52%, rgba(28,59,102,0.88) 100%)' }} />
    <span className="absolute inset-0 opacity-[0.5]" aria-hidden="true"
      style={{ background: 'repeating-linear-gradient(118deg, rgba(227,179,65,0.10) 0 2px, transparent 2px 15px)' }} />
    <span className="absolute inset-0" aria-hidden="true"
      style={{ background: 'radial-gradient(58% 120% at 50% 50%, rgba(227,179,65,0.20) 0%, transparent 68%)' }} />
    <img src="tmnaa-logo.webp" alt="" loading={eager ? 'eager' : 'lazy'} decoding="async"
      className="absolute left-1/2 top-1/2 h-[150%] w-auto -translate-x-1/2 -translate-y-1/2 opacity-[0.26] mix-blend-luminosity" />
  </>
);

const LeadModCard: React.FC<{ m: RosterEntry; p: Merged; lang: Language; eager: boolean; onBroken: (url: string) => void }> = ({ m, p, lang, eager, onBroken }) => {
  const ar = lang === 'ar';
  return (
    <div className="group relative">
      {/* هالة تتنفّس خلف البطاقة */}
      <div className="absolute -inset-3 rounded-[40px] pointer-events-none opacity-60 group-hover:opacity-100 transition-opacity duration-500 animate-pulse-slow" aria-hidden="true"
        style={{ background: 'radial-gradient(52% 78% at 22% 12%, rgba(227,179,65,0.34) 0%, transparent 66%), radial-gradient(48% 74% at 82% 92%, rgba(47,127,214,0.28) 0%, transparent 66%)' }} />

      <div className="relative rounded-[32px] p-[2px]"
        style={{ background: 'linear-gradient(142deg, #FFF3D6 0%, #E3B341 18%, rgba(47,127,214,0.55) 48%, rgba(255,243,214,0.16) 72%, #C8912B 100%)' }}>
        <div className="card-sheen relative overflow-hidden rounded-[30px] bg-navy-950">
          {/* بانر X */}
          {p.banner && (
            <img src={p.banner} alt="" onError={() => onBroken(p.banner)} loading={eager ? 'eager' : 'lazy'} fetchPriority={eager ? 'high' : 'auto'} decoding="async"
              className="absolute inset-0 w-full h-full object-cover opacity-[0.3] saturate-[0.85] transition-transform duration-[1400ms] group-hover:scale-[1.06]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-navy-950 via-navy-950/72 to-navy-900/40" aria-hidden="true" />
          <div className="absolute inset-0" aria-hidden="true"
            style={{ background: 'radial-gradient(64% 92% at 14% 6%, rgba(227,179,65,0.22) 0%, transparent 58%)' }} />

          {/* شرر ذهبي */}
          <Sparkle className="left-[14%] top-[16%]" delay="0s" />
          <Sparkle className="left-[78%] top-[24%]" delay="1.1s" />
          <Sparkle className="left-[62%] top-[70%]" delay="2.3s" />
          <Sparkle className="left-[30%] top-[80%]" delay="3.1s" />

          <div className="relative flex flex-col items-center gap-7 px-5 py-10 sm:px-8 md:flex-row md:items-center md:gap-12 md:px-12 md:py-12 lg:gap-14">
            {/* التاج على رأس الصورة */}
            <div className="relative shrink-0 md:ms-8">
              <div className="relative z-20 mx-auto mt-[84px] w-[124px] h-[124px] sm:mt-[100px] sm:w-[152px] sm:h-[152px]">
                <span className="absolute -inset-[3px] rounded-full animate-spin-slower" aria-hidden="true"
                  style={{ background: 'conic-gradient(from 0deg,#FFF3D6,#8A5E12,#E3B341,#2F7FD6,#F7E3AE,#8A5E12,#FFF3D6)' }} />
                <span className="absolute inset-[3px] rounded-full bg-navy-950 flex items-center justify-center font-black text-3xl text-gold-light" aria-hidden="true">
                  {m.name.replace(/[^A-Za-z0-9؀-ۿ]/g, '').charAt(0).toUpperCase() || 'ط'}
                </span>
                {p.avatar && (
                  <img src={p.avatar} alt={m.name} onError={() => onBroken(p.avatar)} loading={eager ? 'eager' : 'lazy'} fetchPriority={eager ? 'high' : 'auto'} decoding="async"
                    className="absolute inset-[6px] rounded-full object-cover bg-navy-950 ring-1 ring-gold/30" />
                )}
                <span className="absolute -inset-2 rounded-full pointer-events-none animate-pulse-gold" aria-hidden="true"
                  style={{ boxShadow: '0 0 46px 8px rgba(227,179,65,0.46)' }} />

                {/* التاج وأواراه — مُثبّت بحافة الصورة، فيبقى ملتصقاً بها على كل مقاس */}
                <div className="absolute bottom-[90px] left-1/2 z-30 w-[164px] -translate-x-1/2 sm:bottom-[114px] sm:w-[192px]"
                  style={{ filter: 'drop-shadow(0 10px 14px rgba(0,0,0,0.8)) drop-shadow(0 0 18px rgba(227,179,65,0.42))' }}>
                  <div className="crown-rays absolute left-1/2 top-1/2 -ml-[100px] -mt-[100px]" aria-hidden="true" />
                  <div className="absolute left-1/2 top-1/2 -ml-[84px] -mt-[84px] h-[168px] w-[168px] rounded-full" aria-hidden="true"
                    style={{ background: 'radial-gradient(circle, rgba(255,228,158,0.6) 0%, rgba(227,179,65,0.26) 42%, transparent 72%)', filter: 'blur(7px)' }} />
                  <CrownArt eager={eager} />
                </div>
              </div>
            </div>

            {/* الهوية — الاسم بجانب التاج، والإجراء في الجهة المقابلة */}
            <div className="flex min-w-0 flex-1 flex-col items-center gap-6 text-center md:flex-row md:items-center md:justify-between md:gap-8 md:text-start">
              <div className="min-w-0">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/45 bg-gold/12 px-3.5 py-1.5 text-[10px] sm:text-[11px] font-black tracking-[0.2em] uppercase text-gold-light">
                  <ShieldIcon className="w-3.5 h-3.5" />
                  {ar ? 'المشرف الرئيسي' : 'Head moderator'}
                </span>

                <h3 className={`mt-3 pb-[0.09em] leading-[1.2] gold-foil ${ar ? 'font-heading font-black text-[40px] sm:text-[54px]' : 'font-gaming text-[38px] sm:text-[50px] tracking-wide'}`}>
                  {m.name}
                </h3>

                <p className="mt-1 flex items-center justify-center gap-2 md:justify-start">
                  <XIcon className="w-3.5 h-3.5 text-white/55" />
                  <span className="text-[13px] font-black tracking-wide text-white/60" dir="ltr">@{m.x}</span>
                  {p.verified && <VerifiedIcon className="w-4 h-4 text-azure-soft" />}
                </p>

                <p className="mt-3 mx-auto md:mx-0 max-w-[520px] text-[12.5px] sm:text-[13.5px] font-bold leading-relaxed text-white/50 line-clamp-2 min-h-[36px]">
                  <bdi dir="auto">{p.bio || (ar ? 'حامية القلعة — الطاقم اللي يخلي الشات نظيف والبث ماشي.' : 'Keeper of the castle — the crew that keeps chat clean and the stream running.')}</bdi>
                </p>
              </div>

              <div className="flex shrink-0 flex-col items-center gap-3 sm:flex-row sm:gap-4 md:flex-col md:items-end">
                <a href={profileUrl(m)} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2.5 min-h-[52px] px-8 rounded-2xl font-black text-[14px] transition-all duration-300 hover:brightness-110 active:scale-[0.97]"
                  style={{ background: 'linear-gradient(135deg, #FFF3D6 0%, #E3B341 46%, #C8912B 100%)', color: '#08111F', textShadow: '0 1px 0 rgba(255,255,255,0.35)', boxShadow: '0 14px 30px -12px rgba(227,179,65,0.8)' }}>
                  <XIcon className="w-4 h-4" />
                  {ar ? 'متابعة على X' : 'FOLLOW ON X'}
                </a>
                <span className="inline-flex items-baseline gap-2 rounded-2xl border border-gold/25 bg-black/40 px-5 py-2.5">
                  <span className="text-[19px] font-black text-gold-light tabular-nums" dir="ltr">{compact(p.followers)}</span>
                  <span className="text-[10.5px] font-black tracking-[0.14em] uppercase text-white/45">{ar ? 'متابع' : 'Followers'}</span>
                </span>
              </div>
            </div>
          </div>

          {/* شريط التاج السفلي يتمدد عند المرور */}
          <span className="absolute bottom-0 start-0 h-[3px] w-0 group-hover:w-full bg-gradient-to-r from-gold-pale via-gold to-azure transition-all duration-700" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
};

// ---------- Section ----------
const ModeratorsSection: React.FC<{ lang: Language }> = ({ lang }) => {
  const [profiles, setProfiles] = useState<Record<string, XProfile>>(() => readCache()?.data || {});
  const [broken, setBroken] = useState<Record<string, true>>({});
  const [loading, setLoading] = useState(true);
  /* الديسكتوب: الصور والبانرات تُجلب فوراً وبأولوية عالية (شاشة كبيرة وموارد أوفر).
     الجوال: يبقى lazy كما هو — أولوية الفتح الأول فوق كل شيء. */
  const eager = typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches;

  /** CDN إكس ما يضمن إن الصورة تبقى موجودة — الرابط الفاسد يُشال ويُرجع للنسخة المحلية */
  const onBroken = (url: string) => {
    if (!url) return;
    setBroken((b) => (b[url] ? b : { ...b, [url]: true }));
  };
  const pick = (live: string, local: string) => {
    if (live && !broken[live]) return live;
    if (local && !broken[local]) return local;
    return '';
  };

  const t = {
    mod: lang === 'ar' ? 'مشرف' : 'MOD',
    followers: lang === 'ar' ? 'متابع' : 'Followers',
    follow: lang === 'ar' ? 'متابعة' : 'FOLLOW',
    followDc: lang === 'ar' ? 'بروفايل ديسكورد' : 'DISCORD PROFILE',
    house: lang === 'ar' ? 'طاقم حماية القلعة' : 'The castle guard',
  };

  useEffect(() => {
    let cancelled = false;

    const load = async (useCacheFirst = true) => {
      const cached = readCache();
      const fresh = cached && Date.now() - cached.at < CACHE_TTL_MS;
      if (useCacheFirst && fresh) {
        setProfiles(cached.data);
        setLoading(false);
        return;
      }
      // دفع ثلاثية متتابعة — سبعة طلبات في لحظة يفعّل حد المعدل
      const xHandles = ROSTER.filter((m) => m.x);
      for (let i = 0; i < xHandles.length; i += 3) {
        const batch = await Promise.all(
          xHandles.slice(i, i + 3).map(async (m) => {
            try {
              return { id: uid(m), p: await fetchX(m.x as string) };
            } catch {
              return { id: uid(m), p: null };
            }
          }),
        );
        if (cancelled) return;
        const next: Record<string, XProfile> = {};
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
        // فاصل بين الدفعات — السبعة معاً يفعّل حد المعدل عند فكسغتويتر
        if (i + 3 < xHandles.length) await new Promise((r) => setTimeout(r, 600));
      }
      if (!cancelled) setLoading(false);
    };

    load(true);
    // تحديث صامت كل 5 دقائق، ويتوقف والتبويب مخفي
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

  // الاسم ثابت من الروستر؛ الصورة والبانر والعدد والموثّقة والسيرة كلها حيّة من إكس
  const get = (m: RosterEntry): Merged => {
    const p = profiles[uid(m)];
    return {
      bio: p?.bio || '',
      followers: p?.followers ?? m.seedFollowers ?? null,
      verified: p?.verified ?? Boolean(m.seedVerified),
      avatar: m.noPic ? '' : pick(p?.avatar || '', m.avatar || ''),
      banner: pick(p?.banner || '', m.banner || ''),
      frame: m.frame || '',
    };
  };

  const lead = ROSTER.find((m) => m.lead) || ROSTER[0];
  const rest = ROSTER.filter((m) => m !== lead);

  return (
    <div className="w-full">
      {/* شريط المزامنة العلوي */}
      <div
        className={`h-[2px] w-full overflow-hidden rounded-full bg-white/[0.06] mb-4 md:mb-6 transition-opacity duration-700 ${loading ? 'opacity-100' : 'opacity-0'}`}
      >
        <div className="h-full w-1/3 rounded-full bg-gradient-to-r from-transparent via-gold to-transparent animate-pulse" />
      </div>

      <div className="opacity-0 animate-fade-in-up">
        <LeadModCard m={lead} p={get(lead)} lang={lang} eager={eager} onBroken={onBroken} />
      </div>

      <div className="mt-4 md:mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        {rest.map((m, i) => {
          const p = get(m);
          return (
            <a
              key={uid(m)}
              href={profileUrl(m)}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative block overflow-hidden rounded-[22px] border border-gold/15 bg-navy-900/85 transition-all hover:border-gold/50 hover:-translate-y-1 hover:shadow-[0_24px_60px_-16px_rgba(227,179,65,0.35)] duration-300 opacity-0 animate-fade-in-up"
              style={{ animationDelay: `${Math.min(i * 70, 420)}ms` }}
            >
              {/* بانر X الحيّ — ومن لا بانر عنده يأخذ شريط الشعار بدل مساحة فاضية */}
              <div className="relative h-[74px] sm:h-[86px] overflow-hidden bg-navy-950">
                {p.banner ? (
                  <img
                    src={p.banner}
                    alt=""
                    loading={eager ? 'eager' : 'lazy'}
                    fetchPriority={eager ? 'high' : 'auto'}
                    decoding="async"
                    width={800}
                    height={266}
                    onError={() => onBroken(p.banner)}
                    className="w-full h-full object-cover opacity-60 group-hover:opacity-95 group-hover:scale-[1.07] transition-all duration-700"
                  />
                ) : (
                  <CrestBand eager={eager} />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-navy-950 via-navy-950/35 to-transparent" />
                <span className="absolute top-2 start-2 inline-flex items-center gap-1 text-[8px] font-black tracking-[0.16em] px-2 py-[3px] rounded-lg bg-black/55 backdrop-blur border border-gold/40 text-gold-light uppercase">
                  <ShieldIcon className="w-3 h-3" />
                  {t.mod}
                </span>
                <span className="absolute top-2 end-2 inline-flex items-center justify-center w-7 h-7 rounded-full bg-black/60 backdrop-blur border border-white/15 text-white/80 transition-all group-hover:bg-white group-hover:text-navy-950">
                  {m.x ? <XIcon className="w-3.5 h-3.5" /> : <DiscordIcon className="w-4 h-4" />}
                </span>
              </div>

              {/* الهوية */}
              <div className="relative px-4 pb-4 -mt-6">
                <div className="flex items-end gap-3">
                  <div className="relative shrink-0 w-[58px] h-[58px]">
                    <span
                      className="absolute block rounded-full p-[2px] inset-0"
                      style={{ background: 'conic-gradient(from 200deg,#FFF3D6,#8A5E12,#F7E3AE,#8A5E12,#FFF3D6)' }}
                    >
                      <span className="w-full h-full rounded-full bg-navy-950 flex items-center justify-center font-black text-xl text-gold-light">
                        {m.name.replace(/[^A-Za-z0-9\u0600-\u06FF]/g, '').charAt(0).toUpperCase() || 'ط'}
                      </span>
                      {p.avatar && (
                        <img
                          src={p.avatar} alt={m.name} loading={eager ? 'eager' : 'lazy'}
                          fetchPriority={eager ? 'high' : 'auto'} decoding="async"
                          width={54} height={54}
                          onError={() => onBroken(p.avatar)}
                          className="absolute inset-[2px] rounded-full object-cover bg-navy-950"
                        />
                      )}
                    </span>
                    {/* إطار ديسكورد: مربّع الزينة يطابق مربّع الصورة تماماً — الأذنان فوق الرأس والشوارب على الحواف */}
                    {p.frame && (
                      <img src={p.frame} alt="" aria-hidden="true" loading={eager ? 'eager' : 'lazy'}
                        fetchPriority={eager ? 'high' : 'auto'} decoding="async" width={58} height={58}
                        onError={() => onBroken(p.frame)}
                        className="pointer-events-none absolute inset-0 z-20 h-full w-full object-contain" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 pb-0.5">
                    <p className="text-[15px] font-black text-white flex items-center gap-1">
                      <span className="truncate" dir="ltr">{m.name}</span>
                      {p.verified && <VerifiedIcon className="w-3.5 h-3.5 text-azure-soft shrink-0" />}
                    </p>
                    <p className="text-[11px] font-bold text-gold/70 flex items-center gap-1.5">
                      {m.x ? <XIcon className="w-3 h-3 shrink-0 text-white/40" /> : <DiscordIcon className="w-3.5 h-3.5 shrink-0 text-white/40" />}
                      <span className="truncate" dir="ltr">{m.x ? `@${m.x}` : (lang === 'ar' ? 'حساب ديسكورد' : 'DISCORD ACCOUNT')}</span>
                    </p>
                  </div>
                </div>

                <p className="text-[11.5px] text-white/45 font-medium leading-relaxed mt-2 line-clamp-2 min-h-[32px]">
                  {/* bdi يعزل السيرة: المحايدة تحفظ ترتيب اللاتيني والاصطفاف يبقى يمين البطاقة */}
                  <bdi dir="auto">{p.bio || t.house}</bdi>
                </p>

                <div className="flex items-center gap-2 mt-2.5">
                  {/* لا عدّاد عام على ديسكورد — الخانة تُطوى بدل رقم وهمي */}
                  {p.followers != null && (
                    <span className="text-[11px] font-black text-white/70" dir="ltr">
                      {compact(p.followers)} <span className="font-bold text-white/35">{t.followers}</span>
                    </span>
                  )}
                  <span className="ms-auto inline-flex items-center gap-1.5 h-8 px-3.5 rounded-xl bg-gradient-to-b from-white to-white/70 text-navy-950 text-[11px] font-black transition-all group-hover:brightness-95 group-active:scale-95">
                    {m.x ? <XIcon className="w-3 h-3" /> : <DiscordIcon className="w-3.5 h-3.5" />}
                    {m.x ? t.follow : t.followDc}
                  </span>
                </div>
              </div>
              {/* خط سفلي ذهبي يتمدد */}
              <span className="absolute bottom-0 start-0 h-[2px] w-0 group-hover:w-full bg-gradient-to-r from-gold-light to-gold-deep transition-all duration-500" />
            </a>
          );
        })}
      </div>
    </div>
  );
};

export default ModeratorsSection;

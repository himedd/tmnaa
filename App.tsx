import React, { useState, useEffect, useRef, useCallback, useMemo, Suspense, lazy } from 'react';
import { KickIcon, XIcon, SnapchatIcon, DiscordIcon, TikTokIcon, WhatsAppIcon, InstagramIcon, YoutubeIcon, FacebookIcon, MailIcon } from './components/Icons';
import { SocialLink, Language } from './types';
import { supabase } from './supabaseClient';
import { SponsorsSection, ClipsSection, ScheduleSection, FAQSection } from './components/PublicWidgets';
import type { MediaTarget } from './components/MediaModal';
import type { StreamDetail } from './components/LiveTheater';

// Heavy below-fold / on-demand chunks — split out of the first paint
const StatsSection = lazy(() => import('./components/StatsSection').then(m => ({ default: m.StatsSection })));
const ModeratorsSection = lazy(() => import('./components/ModeratorsSection'));
// hls.js يزن نصف ميغا — يُسحب فقط لحظة فتح مشغّل التسجيل، لا مع الحزمة الأولى
const MediaModal = lazy(() => import('./components/MediaModal').then(m => ({ default: m.MediaModal })));
// الشات يجيب معه pusher-js (~70KB) — ينزّل فقط وقت البث المباشر
const LiveTheater = lazy(() => import('./components/LiveTheater').then(m => ({ default: m.LiveTheater })));

// --- Constants ---
const BRAND_LOGO = "xlxwi-logo.webp";
import { kickFetch } from './utils/kickApi';
import { getAllSocialMediaStats, formatFollowerCount, readSocialCache, SOCIAL_TTL_MS, FALLBACK } from './utils/socialMediaApi';
import { fetchBotrixLeaderboard } from './utils/botrixApi';
import { getTipLeaderboard, type TipSource, TipDonor, TipInterval } from './utils/supportersApi';

const SITE_BACKGROUND = "bg-heraldic.webp";
const CHANNEL_SLUG = 'xlxwi';

/** كيك ترجع وقت البث بصيغة "2026-10-31 02:37:59" بتوقيت غرينتش بدون منطقة — نحوّلها لطابع زمني صحيح */
const kickTime = (value?: string | null): number | null => {
    if (!value) return null;
    const iso = value.includes('T') ? value : `${value.replace(' ', 'T')}Z`;
    const ms = Date.parse(iso);
    return Number.isNaN(ms) ? null : ms;
};

const CLAN = { latin: 'LEVEL ONE', ar: 'كلان لفل ون', tag: '#StayOne' };

/**
 * كاش آخر بث حي — صالح ثلاث ساعات فقط.
 * يقرأ هنا ولا يُقرأ داخل LiveTheater حتى لا يُسحب الجزء الثقيل مع الحزمة الأولى.
 */
const readStreamCache = (slug: string): StreamDetail | null => {
    try {
        const raw = localStorage.getItem(`xlxwi_stream_${slug}`);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as StreamDetail & { cachedAt?: number };
        if (!parsed?.cachedAt || Date.now() - parsed.cachedAt > 3 * 3600_000) return null;
        if (!parsed.title) return null;
        return parsed;
    } catch { return null; }
};

const createSocialLink = (key: string, value: string, followerCount?: string, specialDetail?: string): SocialLink | null => {
    if (!value) return null;
    const handle = value.replace(/^https?:\/\/(www\.)?(twitter|x|instagram|youtube|discord|tiktok|facebook|snapchat|whatsapp)\.com\//i, '')
        .replace(/\/channel\//i, '')
        .replace(/^@/, '')
        .replace(/\/$/, '');
    switch (key) {
        case 'twitter': return { name: 'X', url: value.startsWith('http') ? value : `https://x.com/${handle}`, icon: <XIcon className="w-7 h-7" />, color: '', username: `@${handle}`, hex: '#FFFFFF', followerCount, specialDetail };
        case 'instagram': return { name: 'Instagram', url: value.startsWith('http') ? value : `https://instagram.com/${handle}`, icon: <InstagramIcon className="w-7 h-7" />, color: '', username: `@${handle}`, hex: '#E1306C', followerCount, specialDetail };
        case 'youtube': return { name: 'YouTube', url: value.startsWith('http') ? value : `https://youtube.com/@${handle}`, icon: <YoutubeIcon className="w-7 h-7" />, color: '', username: 'Channel', hex: '#FF0000', followerCount, specialDetail };
        case 'discord': return { name: 'Discord', url: value.startsWith('http') ? value : `https://discord.gg/${handle}`, icon: <DiscordIcon className="w-7 h-7" />, color: '', username: 'Community', hex: '#5865F2', followerCount, specialDetail };
        case 'tiktok': return { name: 'TikTok', url: value.startsWith('http') ? value : `https://tiktok.com/@${handle}`, icon: <TikTokIcon className="w-7 h-7" />, color: '', username: `@${handle}`, hex: '#FE2C55', followerCount, specialDetail };
        case 'facebook': return { name: 'Facebook', url: value.startsWith('http') ? value : `https://facebook.com/${handle}`, icon: <FacebookIcon className="w-7 h-7" />, color: '', username: 'Page', hex: '#1877F2', followerCount, specialDetail };
        case 'snapchat': return { name: 'Snapchat', url: value.startsWith('http') ? value : `https://snapchat.com/add/${handle}`, icon: <SnapchatIcon className="w-7 h-7" />, color: '', username: `@${handle}`, hex: '#FFFC00', followerCount, specialDetail };
        case 'whatsapp': return { name: 'WhatsApp', url: value, icon: <WhatsAppIcon className="w-7 h-7" />, color: '', username: 'Channel', hex: '#25D366', followerCount, specialDetail };
        default: return null;
    }
};

const KICK_SOCIAL: SocialLink = {
    name: 'KICK',
    url: 'https://kick.com/xlxwi',
    icon: <KickIcon className="w-8 h-8" />,
    color: '',
    username: 'xlxwi',
    hex: '#E3B341',
    followerCount: '261.3K',
    specialDetail: 'البث الأساسي والتفاعل المباشر'
};

const EMAIL_ADDRESS = "";

// زر "موقع خاص بك" — يفتح موقع HSG
const OWN_SITE_URL = 'https://mohhsg.vercel.app/';
const OWN_SITE_ICON = 'mohhsg-icon.png';

const TRANSLATIONS = {
    en: {
        status: 'LIVE NOW', statusOffline: 'OFFLINE',
        headerTitle: 'xlxwi STREAM HUB',
        bio: 'Ali Al-Hashemi (xlxwi) — a content creator with the Level One clan, broadcasting here daily. Welcome.',
        tags: ['Gaming', 'Just Chatting', 'Live Daily'],
        footer: '© 2026 xlxwi. All Rights Reserved.',
        poweredBy: 'POWERED BY HSG',
        watchLive: 'Watch Live', joinWhatsapp: 'Join WhatsApp',
        subOnly: 'SUB ONLY', dropsEnabled: 'DROPS ENABLED', noTags: 'No tags',
        shareTitle: 'xlxwi Stream Hub', shareText: 'Check out xlxwi live on Kick!', copied: 'Link copied!',
        contact: 'Contact & Business',
        lastSessionReport: 'Last session report', debriefTitle: 'Mission Debrief', debriefSub: 'Everything the last stream did, measured.', ago: 'Ago', duration: 'Duration',
        categoriesSpent: 'Categories in this stream', highlights: 'Stream highlights',
        socialsTitle: 'Social Arena', socialsSub: 'One hub — every platform. Pick your battlefield.',
        supportTitle: 'Support Arena', supportSub: 'Every name here is written in gold. Your support keeps the stream alive.',
        hallTitle: 'HALL OF LEGENDS', hallSub: 'Live top supporters',
        sourceStreamlabs: 'STREAMLABS', sourceDokan: 'DOKAN',
        modsTitle: 'Moderators',
        tiersTitle: 'Special alert tiers', pollLive: 'LIVE POLL',
        theaterTitle: 'Live Theater', viewers: 'watching',
        theater: {
            live: 'LIVE', uptime: 'UPTIME', viewersNow: 'VIEWERS', catViewers: 'IN CATEGORY',
            followers: 'FOLLOWERS', chatRate: 'CHAT / MIN', language: 'LANGUAGE', peak: 'PEAK CHAT',
            chatters: 'ACTIVE CHATTERS', room: 'CHAT ROOM RULES', slow: 'Slow mode · 1 message / {n}s',
            followOnly: 'Followers only', subOnly: 'Subscribers only', public: 'Open to everyone',
            emotes: 'Emotes on', copy: 'Copy link', copied: 'Copied', support: 'Support',
            subscribe: 'Subscribe', discord: 'Discord', kick: 'Kick', tags: 'Tags', noTags: 'No tags',
            updated: 'Updated {n}s ago', never: 'Waiting for data…', mature: '18+', verified: 'Verified partner',
            offline: 'Channel closed', secs: 's ago',
        },
        statsTotal: 'Total followers', statsHours: 'Watch hours', statsPlatforms: 'Platforms', statsStatus: 'Status',
        follow: 'Follow', open: 'Open', followers: 'followers',
        clan: 'CLAN',
        ownSite: 'Want a website of your own?',
        ownSiteBtn: 'Get your own site',
    },
    ar: {
        status: 'بث مباشر الآن', statusOffline: 'غير متصل حالياً',
        headerTitle: 'مركز xlxwi للبث المباشر',
        bio: 'علي الهاشمي (xlxwi) صانع محتوى في كلان لفل ون  يبث هنا يومياً — حياكم الله.',
        tags: ['ألعاب', 'سوالف', 'بث يومي'],
        footer: '© 2026 xlxwi. جميع الحقوق محفوظة.',
        poweredBy: 'بدعم من HSG',
        watchLive: 'شاهد البث', joinWhatsapp: 'انضم إلى الواتساب',
        subOnly: 'للمشتركين فقط', dropsEnabled: 'الجوائز مفعلة', noTags: 'لا يوجد وسوم',
        shareTitle: 'مركز بث xlxwi', shareText: 'تابع بث xlxwi المباشر على كيك!', copied: 'تم نسخ الرابط!',
        contact: 'للتواصل والإعلان',
        lastSessionReport: 'تقرير الجلسة الأخيرة', debriefTitle: 'خلاصة المهمة', debriefSub: 'كل ما قدّمه البث الأخير — بالأرقام.', ago: 'منذ', duration: 'المدة',
        categoriesSpent: 'الفئات التي تم بثها', highlights: 'لقطات ممتعة من البث',
        socialsTitle: 'ساحة التواصل', socialsSub: 'كل المنصات في مكان واحد — اختر ساحتك.',
        supportTitle: 'ساحة الدعم', supportSub: 'كل اسم هنا مكتوب بالذهب. دعمك يخلي البث يستمر.',
        hallTitle: 'قاعة الأساطير', hallSub: 'أعلى الداعمين المباشرين',
        sourceStreamlabs: 'ستريم لابس', sourceDokan: 'دكان',
        modsTitle: 'المشرفون',
        tiersTitle: 'مستويات التنبيه الخاصة', pollLive: 'تصويت مباشر',
        theaterTitle: 'مسرح البث المباشر', viewers: 'مشاهد',
        theater: {
            live: 'مباشر', uptime: 'مدة البث', viewersNow: 'المشاهدون', catViewers: 'في الفئة',
            followers: 'المتابعون', chatRate: 'رسائل / دقيقة', language: 'لغة البث', peak: 'ذروة الشات',
            chatters: 'الفاعلون', room: 'قواعد غرفة الشات', slow: 'وضع بطيء · رسالة كل {n} ث',
            followOnly: 'للمتابعين فقط', subOnly: 'للمشتركين فقط', public: 'مفتوح للجميع',
            emotes: 'الإيموتات مفعّلة', copy: 'نسخ الرابط', copied: 'تم النسخ', support: 'ادعم البث',
            subscribe: 'اشترك', discord: 'الديسكورد', kick: 'كيك', tags: 'الوسوم', noTags: 'بلا وسوم',
            updated: 'آخر تحديث قبل {n} ث', never: 'بانتظار البيانات…', mature: '+١٨', verified: 'حساب موثّق',
            offline: 'القناة مغلقة', secs: 'ث',
        },
        statsTotal: 'مجموع المتابعين', statsHours: 'ساعة مشاهدة', statsPlatforms: 'منصة', statsStatus: 'الحالة',
        follow: 'تابع', open: 'افتح', followers: 'متابع',
        clan: 'الكـلان',
        ownSite: 'تبي موقع خاص بك؟',
        ownSiteBtn: 'اطلب موقعك',
    }
};

// ================= DESIGN SYSTEM =================

const Reveal: React.FC<{ children: React.ReactNode; delay?: number; className?: string; as?: 'div' | 'section' }> = ({ children, delay = 0, className = '' }) => {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        if (typeof IntersectionObserver === 'undefined') { el.classList.add('is-visible'); return; }
        const obs = new IntersectionObserver((entries) => {
            entries.forEach((e) => { if (e.isIntersecting) { el.classList.add('is-visible'); obs.disconnect(); } });
        }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
        obs.observe(el);
        return () => obs.disconnect();
    }, []);
    return <div ref={ref} className={`reveal ${className}`} style={{ transitionDelay: `${delay}ms` }}>{children}</div>;
};

const ArenaBackground: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const ctx = canvas.getContext('2d', { alpha: true });
        if (!ctx) return;

        const isMobile = window.matchMedia('(max-width: 767px)').matches;
        // الجسيمات أقل على الجوال + إطار أبطأ = بطارية وسرعة
        const MIN_DT = isMobile ? 66 : 33; // ~15fps جوال / ~30fps ديسكتوب
        const DPR = Math.min(window.devicePixelRatio || 1, isMobile ? 1 : 1.5);

        let raf = 0;
        let running = true;
        let scrolling = false;
        let scrollTimer = 0;
        let last = 0;
        let w = 0;
        let h = 0;

        type P = { x: number; y: number; r: number; vy: number; vx: number; a: number; gold: boolean };
        let parts: P[] = [];

        /* --- Glowing balls are pre-rendered once into a sprite ---
           (shadowBlur on every frame is one of the most expensive operations in canvas) */
        const makeSprite = (core: string, glow: string) => {
            const size = 64;
            const c = document.createElement('canvas');
            c.width = c.height = size;
            const g = c.getContext('2d')!;
            const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
            grd.addColorStop(0, core);
            grd.addColorStop(0.18, core);
            grd.addColorStop(0.42, glow);
            grd.addColorStop(1, 'rgba(0,0,0,0)');
            g.fillStyle = grd;
            g.fillRect(0, 0, size, size);
            return c;
        };
        const spriteGold = makeSprite('rgba(247,227,174,0.95)', 'rgba(227,179,65,0.34)');
        const spriteEmber = makeSprite('rgba(255,255,255,0.8)', 'rgba(194,30,58,0.22)');

        const resize = () => {
            w = window.innerWidth;
            h = window.innerHeight;
            canvas.width = Math.round(w * DPR);
            canvas.height = Math.round(h * DPR);
            canvas.style.width = `${w}px`;
            canvas.style.height = `${h}px`;
            ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
            const n = Math.min(isMobile ? 20 : 52, Math.floor(w / (isMobile ? 34 : 30)));
            parts = Array.from({ length: n }, () => ({
                x: Math.random() * w, y: Math.random() * h,
                r: 0.8 + Math.random() * 2.4,
                vy: -(0.15 + Math.random() * 0.55), vx: (Math.random() - 0.5) * 0.25,
                a: 0.18 + Math.random() * 0.55, gold: Math.random() > 0.42,
            }));
        };

        const draw = (now: number) => {
            raf = requestAnimationFrame(draw);
            // يتوقف الرسم كلياً أثناء التمرير النشط — التمرير أولاً، والجسيمات بعده
            if (!running || scrolling) { last = now; return; }
            if (now - last < MIN_DT) return;
            last = now;

            ctx.clearRect(0, 0, w, h);
            for (const p of parts) {
                p.y += p.vy;
                p.x += p.vx;
                if (p.y < -8) { p.y = h + 8; p.x = Math.random() * w; }
                if (p.x < -8) p.x = w + 8;
                if (p.x > w + 8) p.x = -8;

                const s = p.r * 10;
                ctx.globalAlpha = p.a;
                ctx.drawImage(p.gold ? spriteGold : spriteEmber, p.x - s / 2, p.y - s / 2, s, s);
            }
            ctx.globalAlpha = 1;
        };

        /* --- Stop completely when the tab is hidden: saves battery + CPU --- */
        const onVisibility = () => {
            running = document.visibilityState === 'visible';
            last = 0;
        };

        resize();
        window.addEventListener('resize', resize, { passive: true });
        document.addEventListener('visibilitychange', onVisibility);
        const onScroll = () => {
            scrolling = true;
            window.clearTimeout(scrollTimer);
            scrollTimer = window.setTimeout(() => { scrolling = false; last = 0; }, 220);
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        raf = requestAnimationFrame(draw);

        return () => {
            cancelAnimationFrame(raf);
            window.clearTimeout(scrollTimer);
            window.removeEventListener('resize', resize);
            window.removeEventListener('scroll', onScroll);
            document.removeEventListener('visibilitychange', onVisibility);
        };
    }, []);
    return (
        <div className="fixed inset-0 z-0 bg-[#120307] overflow-hidden" aria-hidden="true">
            <div className="absolute inset-0 responsive_bg opacity-90" />
            <div className="absolute inset-0 bg-gradient-to-b from-[#120307]/34 via-[#1b0509]/52 to-[#120307]/92 md:from-[#120307]/50 md:via-[#1b0509]/62 md:to-[#120307]" />
            <div className="absolute inset-0 grid-lines opacity-70" />
            {/* Glowing circles using radial gradients (no blur filter) — same look, much cheaper */}
            <div className="absolute -top-40 right-[-10%] w-[55vw] h-[55vw] max-w-[720px] max-h-[720px] rounded-full animate-aurora"
                style={{ background: 'radial-gradient(circle, rgba(227,179,65,0.20) 0%, rgba(227,179,65,0.08) 38%, transparent 68%)' }} />
            <div className="absolute top-[30%] left-[-12%] w-[42vw] h-[42vw] max-w-[560px] max-h-[560px] rounded-full animate-aurora"
                style={{ animationDelay: '-6s', background: 'radial-gradient(circle, rgba(110,27,43,0.42) 0%, rgba(110,27,43,0.16) 38%, transparent 68%)' }} />
            <div className="absolute bottom-[-20%] right-[20%] w-[36vw] h-[36vw] max-w-[480px] max-h-[480px] rounded-full animate-aurora"
                style={{ animationDelay: '-3s', background: 'radial-gradient(circle, rgba(247,227,174,0.10) 0%, rgba(247,227,174,0.04) 38%, transparent 68%)' }} />
            <canvas ref={canvasRef} className="absolute inset-0 opacity-80" />
            <div className="absolute inset-0 opacity-70 md:opacity-100 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,transparent_40%,rgba(18,3,7,0.65)_100%)]" />
        </div>
    );
};
const SectionHeading: React.FC<{ no: string; title: string; sub?: string; en?: string }> = ({ no, title, sub, en }) => (
    <div className="flex items-end gap-3 md:gap-4 mb-6 md:mb-9">
        <span className="font-gaming text-3xl sm:text-4xl md:text-6xl leading-[0.8] tracking-wide text-stroke-gold select-none shrink-0" dir="ltr">{no}</span>
        <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-xl sm:text-2xl md:text-4xl font-black tracking-tight text-white">{title}</h2>
                {en && <span className="hidden sm:inline text-[10px] font-bold tracking-[0.3em] text-gold/35 uppercase" dir="ltr">{en}</span>}
            </div>
            {sub && <p className="text-[13px] md:text-sm text-[#fff7ec]/50 mt-1 font-medium">{sub}</p>}
            <div className="rule-gold mt-2.5 md:mt-3 w-full" />
        </div>
    </div>
);

// --- تحميل مؤجل: ما ينزّل كود القسم إلا لما الزائر يقرب منه ---
const DeferredMount: React.FC<{ children: React.ReactNode; rootMargin?: string; minHeight?: number }> = ({ children, rootMargin = '700px', minHeight = 220 }) => {
    const ref = useRef<HTMLDivElement>(null);
    const [show, setShow] = useState(false);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        if (typeof IntersectionObserver === 'undefined') { setShow(true); return; }
        const obs = new IntersectionObserver(
            (entries) => { if (entries.some(e => e.isIntersecting)) { setShow(true); obs.disconnect(); } },
            { rootMargin, threshold: 0 }
        );
        obs.observe(el);
        return () => obs.disconnect();
    }, [rootMargin]);
    return <div ref={ref} className="h-full" style={show ? undefined : { minHeight }}>{show ? children : null}</div>;
};

/** خلية في شريط الهوية: معلومة نص، عنوان مجموعة، أو شخصية بصورة */
type MarqueeCell =
    | { kind: 'txt'; label: string; gold?: boolean }
    | { kind: 'tag'; label: string }
    | { kind: 'char'; img: string; name: string; role: string; tone: 'gold' | 'ice' };

const Marquee: React.FC<{ lang: Language }> = ({ lang }) => {
    const ar = lang === 'ar';
    const cells: MarqueeCell[] = ar
        ? [
            { kind: 'txt', label: 'علي الهاشمي', gold: true },
            { kind: 'txt', label: '21 سنة' },
            { kind: 'txt', label: 'الإمارات' },
            { kind: 'txt', label: 'صانع محتوى مع لفل ون' },
            { kind: 'tag', label: 'شخصيات قراند' },
            { kind: 'char', img: 'char-scrab.webp', name: 'علي الهاشمي', role: 'مؤسس عصابة السكراب', tone: 'gold' },
            { kind: 'char', img: 'char-iaa.webp', name: 'علي عبدالله', role: 'قطاع IAA الاستخباراتي', tone: 'ice' },
        ]
        : [
            { kind: 'txt', label: 'ALI AL-HASHEMI', gold: true },
            { kind: 'txt', label: 'AGE 21' },
            { kind: 'txt', label: 'UAE' },
            { kind: 'txt', label: 'CREATOR — LEVEL ONE' },
            { kind: 'tag', label: 'GTA CHARACTERS' },
            { kind: 'char', img: 'char-scrab.webp', name: 'Ali Al-Hashemi', role: 'Founder — Scrab Gang', tone: 'gold' },
            { kind: 'char', img: 'char-iaa.webp', name: 'Ali Abdullah', role: 'IAA Intelligence Sector', tone: 'ice' },
        ];
    // صورتان فقط (~5KB لكل واحدة) — التحميل المسبقي أرخص من دائرة فاضية تظهر
    // لحظة دخول الشخصية الشاشة، لأن الكسول ما يجلب إلا بعد مسافة قريبة من الشريط.
    // نصف المسار لازم يتجاوز عرض الشريط وإلا ظهر طرف فارغ عند اللفّ — ٦ مجموعات تكفي لأي شاشة
    const row = Array.from({ length: 6 }, () => cells).flat();
    return (
        <div className="hq-strip" dir={ar ? 'rtl' : 'ltr'} aria-hidden="true">
            <div className="hq-track">
                {row.map((c, i) => (
                    <span key={i} className="hq-item">
                        {c.kind === 'txt' && <span className={c.gold ? 'hq-txt hq-txt-gold' : 'hq-txt'}>{c.label}</span>}
                        {c.kind === 'tag' && (
                            <span className="hq-tag">
                                <span className="hq-tag-line" />
                                {c.label}
                                <span className="hq-tag-line" />
                            </span>
                        )}
                        {c.kind === 'char' && (
                            <span className={`hq-char hq-char-${c.tone}`}>
                                <img src={c.img} alt="" width={28} height={28}
                                    loading="eager" fetchPriority="high" decoding="async" />
                                <span className="hq-char-body">
                                    <span className="hq-char-name">{c.name}</span>
                                    <span className="hq-char-role">{c.role}</span>
                                </span>
                            </span>
                        )}
                        <span className="hq-dia" />
                    </span>
                ))}
            </div>
        </div>
    );
};

// --- Count-up number (rAF, reduced-motion safe) ---
const CountUp: React.FC<{ value: number; duration?: number }> = ({ value, duration = 1300 }) => {
    const [n, setN] = useState(0);
    useEffect(() => {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setN(value); return; }
        let raf = 0;
        const t0 = performance.now();
        const step = (t: number) => {
            const p = Math.min(1, (t - t0) / duration);
            setN(Math.round(value * (1 - Math.pow(1 - p, 3))));
            if (p < 1) raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
        return () => cancelAnimationFrame(raf);
    }, [value, duration]);
    return <span dir="ltr">{n.toLocaleString('en-US')}</span>;
};

// --- Last Session Report: MISSION DEBRIEF edition (rich Kick data) ---
const LastSessionReport: React.FC<{ lang: Language; data: any; clips: any[]; past?: any[]; onPlay: (t: MediaTarget) => void }> = ({ lang, data, clips, past = [], onPlay }) => {
    if (!data) return null;
    const timeAgo = (date: string) => {
        if (!date) return '---';
        const now = new Date(); const pastD = new Date(date);
        if (isNaN(pastD.getTime())) return '---';
        const diff = Math.floor((now.getTime() - pastD.getTime()) / 1000);
        if (diff < 60) return lang === 'en' ? `${diff}s ago` : `منذ ${diff} ثانية`;
        if (diff < 3600) return lang === 'en' ? `${Math.floor(diff / 60)}m ago` : `منذ ${Math.floor(diff / 60)} دقيقة`;
        if (diff < 86400) return lang === 'en' ? `${Math.floor(diff / 3600)}h ago` : `منذ ${Math.floor(diff / 3600)} ساعة`;
        return lang === 'en' ? `${Math.floor(diff / 86400)}d ago` : `منذ ${Math.floor(diff / 86400)} يوم`;
    };
    /** مدة كيك (v2) بالميلي ثانية دائماً */
    const formatDuration = (val: number) => {
        const totalSeconds = Math.floor((Number(val) || 0) / 1000);
        return `${Math.floor(totalSeconds / 3600)}h ${Math.floor((totalSeconds % 3600) / 60)}m`;
    };
    const t = TRANSLATIONS[lang] as any;
    const thumbnail = data.thumbnail?.url || data.thumbnail?.src || (typeof data.thumbnail === 'string' ? data.thumbnail : '') || (data.responsive_url) || SITE_BACKGROUND;
    const views = Number(data.views ?? data.video?.views ?? 0);
    /**
     * كيك يقطع البث إلى أجزاء عند كل إعادة اتصال، وكل جزء يحتفظ بفئته ورقم حضوره لحظة القطع.
     * الجلسة الواحدة = الأجزاء المتصلة (فراغ أقل من ٢٠ دقيقة)، ومنه تُحسب الذروة وكل الفئات التي لُعبت.
     */
    const sessionParts = (() => {
        const GAP = 20 * 60_000;
        const at = (v: any) => new Date(String(v?.start_time || v?.created_at || '').replace(' ', 'T')).getTime();
        const rows = [data, ...past].filter((v: any) => v && Number.isFinite(at(v))).sort((a: any, b: any) => at(a) - at(b));
        const chains: any[][] = [];
        let chainEnd = 0;
        for (const v of rows) {
            const st = at(v), en = st + (Number(v?.duration) || 0);
            if (!chains.length || Math.abs(st - chainEnd) > GAP) { chains.push([v]); chainEnd = en; }
            else { chains[chains.length - 1].push(v); chainEnd = Math.max(chainEnd, en); }
        }
        return chains.find(g => g.includes(data)) || [data];
    })();
    const peakViewers = Math.max(0, ...sessionParts.map((v: any) => Number(v.viewer_count ?? 0)));
    const playedCats = (() => {
        const byName = new Map<string, { name: string; slug: string; img: string; ms: number }>();
        for (const v of sessionParts) {
            const cats = (v?.categories || []).filter(Boolean);
            if (!cats.length) continue;
            const share = (Number(v?.duration) || 0) / cats.length;
            for (const c of cats) {
                const name = c.name || c.category?.name || 'Just Chatting';
                const slug = c.slug || c.category?.slug || name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
                const img = c.banner?.url || c.banner?.responsive || c.category?.banner?.url || c.category?.banner?.responsive
                    || c.responsive_url || c.thumbnail?.url || c.category?.thumbnail?.url || `https://files.kick.com/categories/${slug}/fullsize.png`;
                const cur = byName.get(name);
                if (cur) cur.ms += share;
                else byName.set(name, { name, slug, img, ms: share });
            }
        }
        return [...byName.values()].sort((a, b) => b.ms - a.ms);
    })();
    const catTotalMs = playedCats.reduce((s, c) => s + c.ms, 0);
    const pct = lang === 'en' ? '%' : '٪';
    const durH = (Number(data.duration) || 0) / 3600000;
    const vph = durH > 0.05 ? Math.round(views / durH) : views;
    const playVod = (v: any) => (e: React.MouseEvent) => {
        e.preventDefault();
        const id = v?.video?.uuid || v?.uuid || v?.id;
        if (!id) return;
        onPlay({
            kind: 'vod',
            id: String(id),
            slug: v?.slug,
            title: v?.session_title || v?.title,
            src: v?.source,
            poster: v?.thumbnail?.url || v?.thumbnail?.src || (typeof v?.thumbnail === 'string' ? v.thumbnail : thumbnail),
        });
    };
    const isSubOnly = data.video?.status === 'subscriber_only' || data.video?.is_private === true;
    const fullDate = (() => { try { return new Date(data.created_at).toLocaleDateString(lang === 'ar' ? 'ar-SA-u-nu-latn' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return ''; } })();
    const sessions = [data, ...past].slice(0, 4);
    const maxV = Math.max(1, ...sessions.map((s: any) => Number(s.views ?? s.video?.views ?? 0)));
    const compact = (v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}K` : `${v}`;
    const catTags: string[] = [...new Set((data.categories || []).flatMap((c: any) => c.tags || []))].slice(0, 4) as string[];
    const L = {
        views: lang === 'en' ? 'VIEWS' : 'المشاهدات',
        peak: lang === 'en' ? 'PEAK' : 'الذروة',
        perHour: lang === 'en' ? 'VIEWS / HR' : 'مشاهدة / ساعة',
        pulse: lang === 'en' ? 'RECENT SESSIONS PULSE' : 'نبض الجلسات الأخيرة',
        watch: lang === 'en' ? 'WATCH VOD' : 'مشاهدة التسجيل',
        family: lang === 'en' ? 'FAMILY' : 'عائلي',
    };
    const stats: { label: string; value: React.ReactNode; hot: boolean; crown?: boolean; icon: React.ReactNode }[] = [
        { label: t.duration, value: <span dir="ltr">{formatDuration(data.duration)}</span>, hot: true, icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
        { label: L.views, value: <CountUp value={views} />, hot: false, icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg> },
        { label: L.perHour, value: <CountUp value={vph} />, hot: false, icon: <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" /></svg> },
        { label: L.peak, value: <CountUp value={peakViewers} />, hot: true, crown: true, icon: <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="currentColor"><path d="M3 7.5l4.2 3.4L12 4.6l4.8 6.3L21 7.5l-1.7 10.2H4.7L3 7.5zm1.9 11.9h14.2v1.7H4.9v-1.7z" /></svg> },
    ];
    return (
        <Reveal className="w-full">
            <div className="relative overflow-hidden rounded-[28px] md:rounded-[36px] border border-gold/15 bg-wine-950/92 shadow-[0_30px_80px_rgba(0,0,0,0.6)]">
                {/* cinematic ambient from thumbnail */}
                <img src={thumbnail} alt="" aria-hidden="true" className="hidden sm:block absolute inset-0 w-full h-full object-cover blur-3xl opacity-25 scale-110 pointer-events-none" />
                <div className="absolute inset-0 bg-gradient-to-b from-wine-950/70 via-wine-950/45 to-wine-950/88 pointer-events-none" />
                <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-l from-transparent via-gold to-transparent" />
                <div className="relative p-5 sm:p-8 md:p-10">
                    {/* header */}
                    <div className="flex flex-wrap items-center gap-3 mb-6 md:mb-8 animate-fade-in-up">
                        <span className="w-2.5 h-2.5 rounded-full bg-gold shadow-[0_0_14px_#E3B341] animate-pulse shrink-0" />
                        <span className="text-[11px] font-black tracking-[0.35em] text-gold/50 uppercase">{t.lastSessionReport}</span>
                        <span className="ms-auto flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 text-[10px] font-black px-3 py-1.5 rounded-full bg-white/[0.06] border border-gold/20 text-white/70">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                {fullDate} • {timeAgo(data.created_at)}
                            </span>
                            <span className={`text-[10px] font-black px-3 py-1.5 rounded-full border tracking-widest ${isSubOnly ? 'bg-gold/10 border-gold/40 text-gold-light' : 'bg-crimson/10 border-crimson/40 text-crimson-soft'}`}>
                                {isSubOnly ? t.subOnly : 'PUBLIC'}
                            </span>
                        </span>
                    </div>

                    {/* hero */}
                    <div className="flex flex-col lg:flex-row gap-6 md:gap-8 items-start">
                        <div className="[perspective:1200px] w-full lg:w-[380px] shrink-0 animate-fade-in-up" style={{ animationDelay: '80ms' }}>
                            <button type="button" onClick={playVod(data)}
                                className="group relative block w-full text-start aspect-video rounded-2xl overflow-hidden border border-gold/30 bg-wine-950 shadow-[0_24px_60px_-16px_rgba(227,179,65,0.4)] [transform:rotateY(-7deg)_rotateX(2deg)] hover:[transform:rotateY(0deg)_rotateX(0deg)] transition-transform duration-700">
                                <img src={thumbnail} alt="Last Session" loading="lazy" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                                <div className="absolute inset-0 bg-gradient-to-t from-wine-950/85 via-black/10 to-transparent" />
                                <span className="absolute top-3 start-3 text-[10px] font-black px-2.5 py-1 rounded-full bg-black/70 border border-gold/25 text-gold-light backdrop-blur">VOD</span>
                                <span className="absolute inset-0 m-auto w-14 h-14 md:w-16 md:h-16 rounded-full bg-gold/20 backdrop-blur-md border border-gold/70 flex items-center justify-center transition-transform duration-300 group-hover:scale-110 shadow-[0_0_36px_rgba(227,179,65,0.55)]">
                                    <svg className="w-6 h-6 text-gold-pale fill-current translate-x-[1px] rtl:-translate-x-[1px]" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                                </span>
                                <span className="absolute bottom-3 end-3 text-[10px] font-black px-2.5 py-1 rounded-lg bg-black/75 border border-gold/25 text-white" dir="ltr">{formatDuration(data.duration)}</span>
                                <span className="absolute bottom-3 start-3 inline-flex items-center gap-1 text-[10px] font-black px-2.5 py-1 rounded-lg bg-black/75 border border-gold/25 text-white" dir="ltr">
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                    {compact(views)}
                                </span>
                            </button>
                            <span onClick={playVod(data)} role="button"
                                className="mt-3 w-full min-h-[48px] flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-gold-light to-gold text-wine-950 font-black text-sm cursor-pointer shadow-[0_12px_30px_-10px_rgba(227,179,65,0.6)] active:scale-[0.98] transition-transform">
                                {L.watch}
                                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                            </span>
                        </div>

                        <div className="flex-1 min-w-0 w-full">
                            <div className="flex flex-wrap items-center gap-2 mb-3 animate-fade-in-up" style={{ animationDelay: '140ms' }}>
                                <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-white/[0.07] border border-gold/20 text-white/70" dir="ltr">{data.language || 'AR'}</span>
                                <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-white/[0.07] border border-gold/20 text-white/70">{data.is_mature ? '18+' : L.family}</span>
                                {catTags.map((tag, i) => <span key={i} className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-gold/10 border border-gold/30 text-gold-light" dir="ltr">#{tag}</span>)}
                            </div>
                            <h3 className="text-xl sm:text-2xl md:text-3xl font-black text-white leading-snug mb-5 animate-fade-in-up" style={{ animationDelay: '180ms' }}>{data.session_title || data.title}</h3>
                            <div className="grid grid-cols-2 xl:grid-cols-4 gap-2.5 sm:gap-3">
                                {stats.map((s, i) => (
                                    <div key={i} className={`card-sheen relative overflow-hidden rounded-2xl border px-4 py-4 text-center backdrop-blur-md animate-fade-in-up ${s.crown ? 'border-gold/70' : s.hot ? 'bg-gold/[0.07] border-gold/30' : 'bg-white/[0.04] border-gold/15'}`}
                                        style={s.crown
                                            ? { animationDelay: `${220 + i * 80}ms`, background: 'linear-gradient(150deg, #FFF3D6 0%, #E3B341 52%, #B8860B 100%)', boxShadow: '0 16px 34px -14px rgba(227,179,65,0.85), inset 0 1px 0 rgba(255,255,255,0.6)' }
                                            : { animationDelay: `${220 + i * 80}ms` }}>
                                        <span className={`mx-auto w-8 h-8 rounded-xl flex items-center justify-center mb-2 ${s.crown ? 'bg-wine-950/15 text-wine-950' : s.hot ? 'bg-gold/15 text-gold-light' : 'bg-white/[0.07] text-white/60'}`}>{s.icon}</span>
                                        <p className={`text-lg sm:text-xl md:text-2xl font-black ${s.crown ? 'text-wine-950 [text-shadow:0_1px_0_rgba(255,255,255,0.45)]' : 'text-white'}`}>{s.value}</p>
                                        <p className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-widest mt-1 ${s.crown ? 'text-wine-950/70' : 'text-white/35'}`}>{s.label}</p>
                                    </div>
                                ))}
                            </div>

                            {/* recent sessions pulse */}
                            {sessions.length > 1 && (
                                <div className="mt-6 animate-fade-in-up" style={{ animationDelay: '540ms' }}>
                                    <p className="text-[10px] font-black tracking-[0.25em] text-gold/40 uppercase mb-3">{L.pulse}</p>
                                    <div className="flex items-end gap-2 sm:gap-3 h-28 sm:h-32" dir="ltr">
                                        {sessions.map((s: any, i: number) => {
                                            const v = Number(s.views ?? s.video?.views ?? 0);
                                            const h = Math.max(10, Math.round((v / maxV) * 100));
                                            const cur = i === 0;
                                            return (
                                                <button type="button" key={s.id || i} onClick={playVod(s)} title={s.session_title || s.title}
                                                    className="flex-1 h-full flex flex-col items-center justify-end gap-1.5 group/bar min-w-0">
                                                    <span className={`text-[10px] sm:text-[11px] font-black ${cur ? 'text-gold-light' : 'text-white/45'}`} dir="ltr">{compact(v)}</span>
                                                    <span className="tier-bar w-full max-w-[90px] rounded-t-lg border-x border-t relative overflow-hidden"
                                                        style={{
                                                            height: `${h}%`, animationDelay: `${i * 120}ms`,
                                                            background: cur ? 'linear-gradient(to bottom, #E3B341, #E3B34155 60%, rgba(0,0,0,0.5))' : 'linear-gradient(to bottom, rgba(227,179,65,0.32), rgba(255,255,255,0.06))',
                                                            borderColor: cur ? '#E3B34188' : 'rgba(255,255,255,0.15)',
                                                            boxShadow: cur ? '0 0 22px -4px rgba(227,179,65,0.7)' : 'none',
                                                        }}>
                                                        <span className="absolute top-0 inset-x-2 h-1 rounded-full bg-white/40 blur-[1px]" />
                                                    </span>
                                                    <span className={`w-full max-w-[90px] h-1.5 rounded-b bg-black/70 border-x border-b ${cur ? 'border-gold/50' : 'border-gold/15'}`} />
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {playedCats.length > 0 && (
                                <div className="mt-6 animate-fade-in-up" style={{ animationDelay: '620ms' }}>
                                    <div className="flex items-center gap-2.5 mb-3">
                                        <p className="text-[10px] font-black tracking-[0.25em] text-gold/40 uppercase">{t.categoriesSpent}</p>
                                        <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-gold/10 border border-gold/25 text-gold-light" dir="ltr">{playedCats.length}</span>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {playedCats.map((c) => (
                                            <span key={c.name} title={c.name}
                                                className="inline-flex items-center gap-2.5 bg-white/[0.05] border border-gold/15 rounded-full ps-1 pe-3.5 py-1 hover:border-gold/45 hover:bg-gold/[0.07] transition-colors">
                                                <span className="w-8 h-8 rounded-full overflow-hidden bg-black border border-gold/20 block shrink-0">
                                                    <img src={c.img} alt={c.name} loading="lazy" className="w-full h-full object-cover"
                                                        onError={(e) => { const tg = e.target as HTMLImageElement; tg.src = tg.src.includes('picsum') ? BRAND_LOGO : `https://picsum.photos/seed/${c.slug}/100/100`; }} />
                                                </span>
                                                <span className="flex flex-col leading-tight text-start">
                                                    <span className="text-[11px] font-bold text-white/80" dir="ltr">{c.name}</span>
                                                    <span className="text-[9.5px] font-black text-gold/75" dir="ltr">{formatDuration(c.ms)} · {Math.round((c.ms / catTotalMs) * 100)}{pct}</span>
                                                </span>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {clips && clips.length > 0 && (
                        <div className="mt-8 md:mt-10 pt-7 border-t border-gold/[0.12] animate-fade-in-up" style={{ animationDelay: '680ms' }}>
                            <div className="flex items-center gap-2.5 mb-5">
                                <span className="w-2 h-2 rounded-full bg-gold shadow-[0_0_10px_#E3B341]" />
                                <span className="text-[11px] font-black tracking-[0.25em] text-gold/55 uppercase">{t.highlights}</span>
                            </div>
                            <div className="grid grid-cols-3 gap-2 md:gap-4">
                                {clips.slice(0, 3).map((clip: any, i: number) => (
                                    <button type="button" key={clip.id || i}
                                        onClick={(e) => { e.preventDefault(); if (!clip.id) return; onPlay({ kind: 'clip', id: String(clip.id), title: clip.title, src: clip.clip_url || clip.video_url, poster: clip.thumbnail_url || clip.thumbnail?.url }); }}
                                        className="group relative block aspect-video rounded-xl md:rounded-2xl overflow-hidden border border-gold/15 bg-wine-950 text-start hover:border-gold/60 hover:-translate-y-1 transition-all duration-300">
                                        <img src={clip.thumbnail_url || clip.thumbnail?.url || SITE_BACKGROUND} alt={clip.title} loading="lazy"
                                            className="w-full h-full object-cover opacity-70 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500" />
                                        <div className="absolute inset-0 bg-gradient-to-t from-wine-950/90 via-black/10 to-transparent" />
                                        <span className="absolute top-1.5 start-1.5 w-5 h-5 md:w-6 md:h-6 rounded-lg bg-black/70 border border-gold/25 text-gold-light text-[9px] md:text-[10px] font-black flex items-center justify-center backdrop-blur" dir="ltr">{i + 1}</span>
                                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <span className="w-9 h-9 md:w-11 md:h-11 rounded-full bg-gold/25 backdrop-blur border border-gold/60 flex items-center justify-center">
                                                <svg className="w-4 h-4 md:w-5 md:h-5 text-gold-pale fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                                            </span>
                                        </div>
                                        <div className="absolute bottom-0 inset-x-0 p-2 md:p-3">
                                            <p className="text-[8px] md:text-[11px] font-bold text-white truncate">{clip.title}</p>
                                            <p className="text-[7px] md:text-[10px] text-gold/50 font-medium" dir="ltr">{clip.view_count || 0} {lang === 'en' ? 'views' : 'مشاهدة'}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </Reveal>
    );
};

// --- Platform washes — كلها داخل عائلة الخمري/الذهر، بصمة المنصة بلون واحد خفيف ---
const BRAND_GRADIENTS: Record<string, string> = {
    KICK: 'linear-gradient(135deg, rgba(227,179,65,0.22), rgba(62,14,26,0.55) 55%, transparent)',
    Snapchat: 'linear-gradient(135deg, rgba(227,179,65,0.14), rgba(46,10,18,0.52) 58%, transparent)',
    Instagram: 'linear-gradient(135deg, rgba(194,30,58,0.22), rgba(62,14,26,0.5) 58%, transparent)',
    TikTok: 'linear-gradient(135deg, rgba(194,30,58,0.17), rgba(46,10,18,0.52) 58%, transparent)',
    X: 'linear-gradient(135deg, rgba(255,247,236,0.11), rgba(27,5,9,0.55) 60%, transparent)',
    WhatsApp: 'linear-gradient(135deg, rgba(227,179,65,0.16), rgba(46,10,18,0.52) 58%, transparent)',
    Discord: 'linear-gradient(135deg, rgba(227,179,65,0.14), rgba(62,14,26,0.52) 58%, transparent)',
    YouTube: 'linear-gradient(135deg, rgba(194,30,58,0.19), rgba(46,10,18,0.52) 58%, transparent)',
};

// --- Social Card — premium edition (same data + behavior) ---
const SocialCard: React.FC<{ social: SocialLink; index: number; featured?: boolean; live?: boolean; lang: Language }> = ({ social, index, featured = false, live = false, lang }) => {
    const [hover, setHover] = useState(false);
    const [launching, setLaunching] = useState(false);
    const [pressed, setPressed] = useState(false);
    const brand = social.hex || '#ffffff';
    const bright = social.name === 'Snapchat' || social.name === 'KICK';
    const go = (e: React.MouseEvent) => {
        e.preventDefault();
        if (launching) return;
        setLaunching(true);
        window.setTimeout(() => { window.location.href = social.url; }, 420);
    };
    const active = hover || launching;
    const card = (
        <div className={`card-sheen relative h-full rounded-[22px] border bg-wine-900/92 overflow-hidden transition-all duration-300 group-hover:-translate-y-1 group-active:translate-y-0 group-active:scale-[0.985] ${featured ? 'flex flex-col' : ''} ${launching ? 'glitch-active' : ''} ${pressed ? 'scale-[0.985]' : ''}`}
            style={{ borderColor: launching ? brand : active ? `${brand}99` : 'rgba(255,255,255,0.09)', boxShadow: active ? `0 18px 44px -16px ${brand}66, inset 0 1px 0 rgba(255,255,255,0.08)` : '0 10px 28px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.05)' }}>
            {/* brand wash */}
            <div className="absolute inset-0 pointer-events-none transition-opacity duration-500" style={{ background: BRAND_GRADIENTS[social.name] || `linear-gradient(135deg, ${brand}22, transparent 60%)`, opacity: active ? 1 : 0.75 }} />
            {/* giant watermark icon */}
            <div className="absolute -end-3 -bottom-5 opacity-[0.07] group-hover:opacity-[0.13] transition-opacity duration-500 pointer-events-none scale-[2.6] origin-bottom" style={{ color: brand }}>
                {social.icon}
            </div>
            {/* top energy line */}
            <span className="absolute top-0 start-6 end-6 h-[2.5px] rounded-full transition-all duration-500" style={{ background: `linear-gradient(90deg, transparent, ${brand}, transparent)`, opacity: active ? 1 : 0.3, boxShadow: active ? `0 0 18px ${brand}` : 'none' }} />
            {launching && <span className="absolute bottom-0 start-0 h-1 animate-charge z-30" style={{ width: '100%', backgroundColor: brand, boxShadow: `0 0 12px ${brand}` }} />}
            <div className={`relative p-2.5 sm:p-4 lg:p-5 flex items-center gap-2 sm:gap-3.5 lg:gap-4 ${featured ? 'flex-1 min-h-[104px] sm:min-h-[128px]' : 'min-h-[88px] sm:min-h-[104px]'}`}>
                {/* icon medallion */}
                <div className={`${featured ? 'w-[52px] h-[52px] sm:w-[60px] sm:h-[60px] lg:w-[68px] lg:h-[68px]' : 'w-[42px] h-[42px] sm:w-[52px] sm:h-[52px] lg:w-[60px] lg:h-[60px]'} rounded-[14px] sm:rounded-[18px] flex items-center justify-center shrink-0 transition-all duration-300 group-hover:scale-[1.06] group-hover:-rotate-3 [&_svg]:w-[62%] [&_svg]:h-[62%]`}
                    style={{
                        color: active && bright ? '#000' : brand,
                        background: active && bright ? brand : `linear-gradient(160deg, ${brand}2e, rgba(255,255,255,0.04))`,
                        border: `1.5px solid ${active ? brand : 'rgba(255,255,255,0.13)'}`,
                        boxShadow: active ? `0 0 26px ${brand}55, inset 0 1px 0 rgba(255,255,255,0.25)` : `inset 0 1px 0 rgba(255,255,255,0.08)`
                    }}>
                    {launching
                        ? <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                        : social.icon}
                </div>
                {/* texts */}
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.12em] sm:tracking-[0.2em]" style={{ color: launching ? brand : active ? brand : 'rgba(255,255,255,0.48)' }}>
                            {launching ? 'LAUNCHING…' : social.name}
                        </span>
                        {featured && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-black px-2 py-[3px] rounded-full bg-[#E3B341]/15 border border-[#E3B341]/45 text-[#E3B341] tracking-[0.14em]">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#E3B341] animate-pulse" />MAIN STAGE
                            </span>
                        )}
                    </div>
                    <p className={`font-black text-white truncate leading-tight mt-0.5 ${featured ? 'text-[17px] sm:text-[22px] lg:text-2xl' : 'text-[13px] sm:text-[15px] lg:text-[17px]'}`} dir="ltr">{social.username}</p>
                    <div className="flex items-center gap-1 sm:gap-1.5 mt-1 min-w-0">
                        {social.followerCount && (
                            <span className={`inline-flex items-center gap-1 shrink-0 text-[10px] sm:text-[11px] font-black text-white/85 ${social.name === 'Snapchat' ? 'blur-[3px] select-none' : ''}`} dir="ltr">
                                <svg className="w-3 h-3 text-white/40" fill="currentColor" viewBox="0 0 20 20"><path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" /></svg>
                                {social.followerCount}
                            </span>
                        )}
                        {social.specialDetail && <span className="text-[10px] sm:text-[11px] text-white/40 font-medium truncate">{social.specialDetail}</span>}
                    </div>
                </div>
                {/* CTA */}
                <span className={`shrink-0 flex items-center justify-center rounded-full font-black transition-all duration-300 ${featured ? 'w-10 h-10 sm:w-12 sm:h-12' : 'w-8 h-8 sm:w-10 sm:h-10 lg:w-11 lg:h-11'}`}
                    style={{
                        background: active ? brand : 'rgba(255,255,255,0.07)',
                        color: active ? (bright ? '#000' : '#fff') : '#fff',
                        border: `1.5px solid ${active ? brand : 'rgba(255,255,255,0.14)'}`,
                        boxShadow: active ? `0 0 20px ${brand}66` : 'none'
                    }}>
                    <svg className="w-4 h-4 sm:w-5 sm:h-5 rtl:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                </span>
            </div>
            {/* البطاقة الرئيسية (كيك) عمودية: شريط سفلي يملأ الارتفاع ويوضّح الحالة */}
            {featured && (
                <div className="relative mt-auto px-2.5 sm:px-4 lg:px-5 pb-3 sm:pb-4 lg:pb-5">
                    <div className="flex items-center justify-center gap-2 rounded-2xl px-4 py-3 bg-gradient-to-b from-gold-light to-gold text-wine-950 font-black text-[13px] sm:text-[15px] shadow-[0_10px_28px_-10px_rgba(227,179,65,0.75)] transition-transform duration-300 group-hover:scale-[1.02]">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${live ? 'bg-[#C21E3A] animate-pulse shadow-[0_0_8px_rgba(194,30,58,0.9)]' : 'bg-wine-950/45'}`} />
                        {live
                            ? (lang === 'ar' ? 'الآن مباشر — ادخل البث' : 'LIVE NOW — JOIN IN')
                            : (lang === 'ar' ? 'ادخل القناة' : 'OPEN CHANNEL')}
                    </div>
                </div>
            )}
            {/* bottom fill line */}
            <span className="absolute bottom-0 start-0 h-[2px] transition-all duration-500" style={{ width: active ? '100%' : '0%', background: brand, boxShadow: `0 0 10px ${brand}` }} />
        </div>
    );
    return (
        <a href={social.url} onClick={go}
            onMouseEnter={() => setHover(true)} onMouseLeave={() => { setHover(false); setPressed(false); }}
            onTouchStart={() => setPressed(true)} onTouchEnd={() => setPressed(false)}
            style={{ animationDelay: `${Math.min(index * 60, 400)}ms` }}
            className={`group relative block h-full animate-fade-in-up select-none rounded-[22px] ${launching ? 'z-40' : ''}`}
            title={`${social.name} - xlxwi Official`} aria-label={lang === 'ar' ? `تابع xlxwi على ${social.name}` : `Visit xlxwi on ${social.name}`}>
            {featured ? (
                <div className="h-full rounded-[24px] p-[1.5px] bg-gradient-to-l from-gold-light via-gold/50 to-crimson/70 shadow-[0_0_35px_rgba(227,179,65,0.22)]">
                    <div className="h-full rounded-[22.5px] bg-wine-950">{card}</div>
                </div>
            ) : (
                <>
                    <div className="absolute -inset-0.5 rounded-[24px] opacity-0 group-hover:opacity-100 group-active:opacity-60 transition-opacity duration-500 blur-xl pointer-events-none" style={{ background: `linear-gradient(135deg, ${brand}44, transparent 65%)` }} />
                    {card}
                </>
            )}
        </a>
    );
};

// ============ SUPPORTERS — live tip leaderboard (Streamlabs + Dokan), royal gold ============
type Supporter = { id: number; name: string; amount: number; currency: string; message?: string; source: string; created_at: string };

const rankRing = (rank: number): string => {
    if (rank === 1) return 'conic-gradient(from 200deg, #FFF3D6, #B8860B, #F7E3AE, #8A5E12, #FFF3D6)';
    if (rank === 2) return 'conic-gradient(from 200deg, #E9EDF2, #7C8794, #FFFFFF, #7C8794, #E9EDF2)';
    if (rank === 3) return 'conic-gradient(from 200deg, #E8A87C, #8A4B22, #F3C9A6, #8A4B22, #E8A87C)';
    return 'conic-gradient(from 200deg, #E3B341, #3E0E1A, rgba(227,179,65,0.45), #3E0E1A, #E3B341)';
};

const RankAvatar: React.FC<{ name: string; rank: number; size: string }> = ({ name, rank, size }) => {
    const initial = (name || '?').trim().charAt(0).toUpperCase();
    return (
        <span className={`relative ${size} rounded-full p-[2.5px] shrink-0 block`} style={{ background: rankRing(rank) }}>
            <span className="w-full h-full rounded-full bg-wine-950 flex items-center justify-center font-black text-gold-pale">{initial}</span>
        </span>
    );
};

// Rank plate — gold foil stamped on wine
const RankBadge: React.FC<{ rank: number; big?: boolean }> = ({ rank, big = false }) => (
    <span
        className={`${big ? 'w-12 h-12 text-xl' : 'w-9 h-9 text-base sm:w-11 sm:h-11 sm:text-lg'} rounded-xl font-gaming shrink-0 flex items-center justify-center text-wine-950`}
        dir="ltr"
        style={{
            background: 'linear-gradient(150deg, #FFF3D6 0%, #E3B341 42%, #B8860B 72%, #F7E3AE 100%)',
            textShadow: '0 1px 0 rgba(255,255,255,0.45)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6), inset 0 -3px 0 rgba(0,0,0,0.35), 0 6px 16px -6px rgba(227,179,65,0.75)',
        }}
    >
        {rank}
    </span>
);

// Special alert tiers — 3D metal bars ladder
const TIERS = [
    { amount: '25$', c: '#CD7F32', name: 'BRONZE', h: '28%' },
    { amount: '99$', c: '#C0C0C0', name: 'SILVER', h: '42%' },
    { amount: '300$', c: '#E3B341', name: 'GOLD', h: '60%' },
    { amount: '505$', c: '#7FD4E8', name: 'DIAMOND', h: '80%' },
    { amount: '999$', c: '#C21E3A', name: 'RUBY', h: '100%' },
];

const AlertTiers: React.FC<{ title: string; note: string }> = ({ title, note }) => (
    <div className="card-sheen mt-6 rounded-[26px] border border-gold/15 bg-wine-950/70 p-5 md:p-6 overflow-hidden">
        <p className="text-center text-[10px] md:text-[11px] font-black text-gold/50 tracking-[0.3em] uppercase mb-5">{title}</p>
        <div className="flex items-end justify-center gap-2 sm:gap-4 h-44 sm:h-52" dir="ltr">
            {TIERS.map((tr, i) => (
                <div key={tr.amount} className="flex flex-col items-center justify-end h-full w-[17%] max-w-[110px] min-w-0">
                    <p className="text-sm sm:text-lg font-black tracking-wider mb-1.5" style={{ color: tr.c, textShadow: '0 2px 0 #000' }} dir="ltr">{tr.amount}</p>
                    <div className="tier-bar relative w-full rounded-t-xl border-x border-t overflow-hidden"
                        style={{ height: tr.h, background: `linear-gradient(to bottom, ${tr.c}, ${tr.c}66 55%, rgba(0,0,0,0.55))`, borderColor: `${tr.c}77`, boxShadow: `inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -8px 16px rgba(0,0,0,0.5), 0 0 24px -6px ${tr.c}88`, animationDelay: `${i * 110}ms` }}>
                        <div className="absolute top-0 inset-x-2 h-1.5 rounded-full bg-white/50 blur-[1px]" />
                        <div className="absolute inset-0 bg-gradient-to-b from-white/[0.12] to-transparent" />
                    </div>
                    <div className="w-full h-2 rounded-b-md bg-black/70 border-x border-b border-gold/15" />
                    <p className="text-[8px] sm:text-[9px] font-black tracking-[0.22em] text-white/40 mt-1.5">{tr.name}</p>
                </div>
            ))}
        </div>
        <p className="text-center text-[10px] text-white/30 mt-4 font-medium">{note}</p>
    </div>
);

// Static-3D donate gate with true brand identities + ambient effects (3D stays fixed)
const DonateGate: React.FC<{
    lang: Language; title: string; url: string;
    color: string; color2?: string; label: string;
    markImg?: string; glyph?: string;
    secure: string; cta: string;
}> = ({ lang, title, url, color, color2, label, markImg, glyph = '$', secure, cta }) => {
    const [hover, setHover] = useState(false);
    const [busy, setBusy] = useState(false);
    const go = (e: React.MouseEvent) => {
        e.preventDefault(); if (busy) return; setBusy(true);
        window.setTimeout(() => { window.open(url, '_blank'); window.setTimeout(() => setBusy(false), 600); }, 350);
    };
    const frame = color2
        ? `linear-gradient(165deg, ${color}, ${color2} 55%, ${color})`
        : `linear-gradient(165deg, ${color}99, rgba(255,255,255,0.12) 30%, rgba(255,255,255,0.04) 60%, ${color}55)`;
    const glowBg = color2
        ? `linear-gradient(150deg, ${color}55, ${color2}44 60%, transparent)`
        : `linear-gradient(150deg, ${color}44, transparent 60%)`;
    const wash = color2
        ? `linear-gradient(140deg, ${color}26, ${color2}1a 55%, transparent)`
        : `linear-gradient(140deg, ${color}1f, transparent 55%)`;
    const topLine = color2
        ? `linear-gradient(90deg, transparent, ${color}, ${color2}, transparent)`
        : `linear-gradient(90deg, transparent, ${color}, transparent)`;
    const ctaBg = color2 ? `linear-gradient(135deg, ${color}, ${color2})` : `linear-gradient(180deg, #fff 0%, ${color} 65%, ${color})`;
    const ctaColor = color2 ? '#fff' : '#000';
    return (
        <a href={url} onClick={go} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
            className="group relative block rounded-[26px] [perspective:900px]" aria-label={`${title} donation`}>
            <div className="absolute -inset-1 rounded-[28px] pointer-events-none transition-opacity duration-300 animate-pulse-slow" style={{ background: glowBg, opacity: hover ? 0.9 : 0.45 }} />
            <div className="rounded-[26px] p-[2px] transition-transform duration-300 group-hover:scale-[1.01]" style={{ background: frame }}>
                <div className="card-sheen relative rounded-[24px] bg-wine-900 overflow-hidden [transform-style:preserve-3d]">
                    <div className="absolute inset-0 pointer-events-none" style={{ background: wash }} />
                    <div className="absolute top-0 inset-x-10 h-[2px] rounded-full" style={{ background: topLine }} />
                    <div className="relative p-5 sm:p-6">
                        <div className="flex items-center justify-between gap-3">
                            <span className="text-[10px] font-black tracking-[0.3em] uppercase" style={{ color }}>{busy ? (lang === 'en' ? 'OPENING…' : 'جاري الفتح…') : label}</span>
                            <span className="inline-flex items-center gap-1 text-[9px] font-black tracking-[0.2em] text-white/45 uppercase">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                {secure}
                            </span>
                        </div>
                        <div className="flex items-center gap-4 mt-4 [transform:translateZ(34px)]">
                            <span className="relative w-16 h-16 sm:w-[76px] sm:h-[76px] rounded-[20px] flex items-center justify-center shrink-0 overflow-hidden transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-3"
                                style={markImg
                                    ? { background: `radial-gradient(115% 115% at 50% 8%, #42101D 0%, #1B0509 58%, #0C0205 100%)`, border: `1.5px solid ${color}88`, boxShadow: `0 14px 30px -10px ${color}77, inset 0 1px 0 rgba(255,243,214,0.22), inset 0 0 22px -6px ${color}55` }
                                    : { background: `linear-gradient(160deg, ${color}, ${color}88)`, border: `1.5px solid ${color}`, boxShadow: `0 14px 30px -10px ${color}88, inset 0 1px 0 rgba(255,255,255,0.4)` }}>
                                {markImg
                                    ? <img src={markImg} alt={`${title} logo`} className="absolute inset-0 w-full h-full object-contain p-[8%] drop-shadow-[0_5px_12px_rgba(0,0,0,0.65)]" loading="lazy" />
                                    : <span className="text-3xl sm:text-4xl font-black text-black" style={{ textShadow: '0 1px 0 rgba(255,255,255,0.4)' }}>{glyph}</span>}
                            </span>
                            <h3 className="font-black text-white tracking-tight leading-none text-[34px] sm:text-[40px] [transform:translateZ(18px)]"
                                style={{ textShadow: '0 1px 0 #000, 0 2px 0 #000, 0 3px 0 rgba(0,0,0,0.7), 0 4px 14px rgba(0,0,0,0.8)' }} dir="ltr">{title}</h3>
                        </div>
                        <span className="mt-5 w-full min-h-[52px] inline-flex items-center justify-center gap-2 rounded-2xl font-black text-sm transition-all duration-300 group-hover:brightness-110 group-active:scale-[0.98]"
                            style={{ background: ctaBg, color: ctaColor, boxShadow: hover ? `0 0 28px ${color}88` : `0 10px 24px -10px ${color}88`, textShadow: color2 ? '0 1px 2px rgba(0,0,0,0.5)' : 'none' }}>
                            {cta}
                            <svg className={`w-4 h-4 ${lang === 'ar' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                        </span>
                    </div>
                </div>
            </div>
        </a>
    );
};

const SupportArena: React.FC<{ lang: Language; supporters: Supporter[] }> = ({ lang, supporters }) => {
    const t = TRANSLATIONS[lang] as any;
    const [source, setSource] = useState<TipSource>('streamlabs');
    const [tab, setTab] = useState<TipInterval>('all');
    const [board, setBoard] = useState<TipDonor[] | null>(null);
    useEffect(() => {
        let dead = false;
        setBoard(null);
        getTipLeaderboard(source, tab).then(list => {
            if (dead) return;
            if (list.length) setBoard(list);
            else setBoard(supporters.slice(0, 10).map((s, i) => ({ name: s.name, rank: i + 1 })));
        }).catch(() => { if (!dead) setBoard([]); });
        return () => { dead = true; };
    }, [source, tab, supporters]);
    const top3 = (board || []).slice(0, 3);
    const rows = (board || []).slice(3);
    const podiumOrder = top3.length >= 3 ? [top3[1], top3[0], top3[2]] : top3;
    const stepH = ['h-[74px] sm:h-[92px]', 'h-[104px] sm:h-[128px]', 'h-[58px] sm:h-[72px]'];
    const tabs: { id: TipInterval; ar: string; en: string }[] = [
        { id: 'week', ar: 'أسبوعي', en: 'WEEKLY' },
        { id: 'month', ar: 'شهري', en: 'MONTHLY' },
        { id: 'all', ar: 'الكل', en: 'ALL TIME' },
    ];
    const sources: { id: TipSource; ar: string; en: string; mark: string }[] = [
        { id: 'streamlabs', ar: t.sourceStreamlabs, en: 'STREAMLABS', mark: 'streamlabs-mark.webp' },
        { id: 'dokan', ar: t.sourceDokan, en: 'DOKAN', mark: 'dokan-mark.webp' },
    ];
    return (
        <div className="w-full">
            {/* gates — true brand identities from official logos */}
            <div className="relative">
                <div className="absolute -top-10 right-0 w-64 h-64 rounded-full animate-aurora pointer-events-none" aria-hidden="true"
                    style={{ background: 'radial-gradient(circle, rgba(227,179,65,0.18) 0%, rgba(227,179,65,0.07) 40%, transparent 68%)' }} />
                <div className="absolute -bottom-10 left-0 w-72 h-72 rounded-full animate-aurora pointer-events-none" style={{ animationDelay: '-7s', background: 'radial-gradient(circle, rgba(194,30,58,0.24) 0%, rgba(194,30,58,0.09) 40%, transparent 68%)' }} aria-hidden="true" />
                {/* locked direction: Streamlabs always right, Dokan always left */}
                <div className="relative grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-5" dir="rtl">
                    <DonateGate lang={lang} title="STREAMLABS" url="https://streamlabs.com/xlxwi/tip" color="#E3B341" markImg="streamlabs-gate.webp"
                        label={lang === 'en' ? 'PAYPAL • TIP' : 'ستريم لابس'} secure={lang === 'en' ? 'SECURE' : 'آمن'} cta={lang === 'en' ? 'Support the stream' : 'ادعم البث'} />
                    <DonateGate lang={lang} title="DOKAN" url="https://tip.dokan.sa/xlxwi" color="#C21E3A" color2="#E3B341" markImg="dokan-gate.webp"
                        label={lang === 'en' ? 'DOKAN • TIP' : 'دكان • دعم'}
                        secure={lang === 'en' ? 'SECURE' : 'آمن'} cta={lang === 'en' ? 'Donate via Dokan' : 'ادعم عبر دكان'} />
                </div>
            </div>

            {/* hall of legends — live leaderboard, names + rank only */}
            <div className="mt-6 md:mt-8 rounded-[26px] border border-gold/15 bg-wine-950/95 overflow-hidden">
                <div className="h-[3px] bg-gradient-to-l from-gold-pale via-gold to-crimson" />
                <div className="p-5 sm:p-7">
                    <div className="text-center mb-5">
                        <p className={`text-3xl sm:text-4xl leading-tight gold-foil ${lang === 'en' ? 'font-gaming tracking-wide' : 'font-heading font-black'}`} dir={lang === 'en' ? 'ltr' : 'rtl'}>
                            {lang === 'en' ? 'HALL OF LEGENDS' : t.hallTitle}
                        </p>
                        <p className="text-xs sm:text-sm font-black text-gold/45 mt-1.5">{t.hallSub}</p>
                    </div>

                    {/* source tabs — نفس الوجو، مرقّعة على طراز مربعات الدعم */}
                    <div className="flex justify-center mb-3">
                        <div className="inline-flex rounded-2xl border border-gold/20 bg-gradient-to-b from-black/65 to-wine-950/80 p-1.5 gap-1.5 shadow-[inset_0_1px_0_rgba(255,243,214,0.08)]" role="tablist" aria-label="Leaderboard source">
                            {sources.map(sr => {
                                const on = source === sr.id;
                                return (
                                    <button key={sr.id} role="tab" aria-selected={on} onClick={() => setSource(sr.id)}
                                        className={`inline-flex items-center gap-2.5 px-3.5 sm:px-5 py-2 rounded-xl text-[11px] sm:text-xs font-black tracking-widest uppercase transition-all duration-300 active:scale-95 ${on ? 'text-wine-950' : 'text-white/50 hover:text-gold-light'}`}
                                        style={on ? { background: 'linear-gradient(150deg, #FFF3D6, #E3B341 55%, #B8860B)', boxShadow: '0 8px 24px -8px rgba(227,179,65,0.9), inset 0 1px 0 rgba(255,255,255,0.55)' } : undefined}>
                                        <span className={`w-[26px] h-[26px] rounded-[9px] overflow-hidden shrink-0 transition-all duration-300 ${on ? 'ring-[1.5px] ring-wine-950/50 shadow-[0_0_16px_-2px_rgba(255,243,214,0.85)]' : 'ring-1 ring-gold/25 opacity-80 hover:opacity-100'}`}>
                                            <img src={sr.mark} alt="" aria-hidden="true" loading="lazy" className="w-full h-full object-cover" />
                                        </span>
                                        {lang === 'en' ? sr.en : sr.ar}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* interval tabs */}
                    <div className="flex justify-center mb-6">
                        <div className="inline-flex rounded-2xl border border-gold/15 bg-black/50 p-1 gap-1" role="tablist" aria-label="Leaderboard interval">
                            {tabs.map(tb => {
                                const on = tab === tb.id;
                                return (
                                    <button key={tb.id} role="tab" aria-selected={on} onClick={() => setTab(tb.id)}
                                        className={`px-5 sm:px-7 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all duration-300 active:scale-95 ${on ? 'text-wine-950' : 'text-white/55 hover:text-white'}`}
                                        style={on ? { background: 'linear-gradient(150deg, #F7E3AE, #E3B341 55%, #B8860B)', boxShadow: '0 6px 20px -6px rgba(227,179,65,0.8)' } : undefined}>
                                        {lang === 'en' ? tb.en : tb.ar}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {board === null ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3" aria-hidden="true">
                            {Array.from({ length: 6 }).map((_, i) => (
                                <div key={i} className="flex items-center gap-3 rounded-2xl border border-gold/[0.12] bg-white/[0.02] p-3 animate-pulse">
                                    <span className="w-11 h-11 rounded-xl bg-gradient-to-l from-gold/30 via-gold/10 to-crimson/25" />
                                    <span className="h-4 rounded-lg bg-white/10 flex-1" />
                                </div>
                            ))}
                        </div>
                    ) : board.length > 0 ? (
                        <div key={`${source}-${tab}`}>
                            {/* static 3D podium — names only */}
                            <div className="flex items-end justify-center gap-2 sm:gap-5 [perspective:800px] mb-6" dir="ltr">
                                {podiumOrder.map((d, i) => {
                                    const rank = i === 1 ? 1 : i === 0 ? 2 : 3;
                                    return (
                                        <div key={`${source}-${tab}-${d.rank}-${d.name}`} className="flex flex-col items-center w-[30%] max-w-[190px] animate-fade-in-up" style={{ animationDelay: `${i * 90}ms` }}>
                                            <RankAvatar name={d.name} rank={d.rank} size={rank === 1 ? 'w-14 h-14 sm:w-16 sm:h-16' : 'w-11 h-11 sm:w-14 sm:h-14'} />
                                            <p className="text-white font-black text-xs sm:text-sm truncate max-w-full mt-2" dir="auto">{d.name}</p>
                                            <div className={`${stepH[i]} w-full mt-2 rounded-t-xl border-x border-t border-gold/20 relative overflow-hidden [transform:rotateX(8deg)] origin-bottom`}
                                                style={{ background: rank === 1
                                                    ? 'linear-gradient(to bottom, rgba(227,179,65,0.42), rgba(184,134,11,0.14) 60%, rgba(0,0,0,0.4))'
                                                    : 'linear-gradient(to bottom, rgba(194,30,58,0.30), rgba(227,179,65,0.16) 60%, rgba(0,0,0,0.4))' }}>
                                                <div className="absolute inset-0 bg-gradient-to-b from-white/[0.08] to-transparent" />
                                                <span className="absolute inset-0 flex items-start justify-center pt-2 font-gaming text-2xl sm:text-3xl text-gold/45" dir="ltr">{d.rank}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            {/* ranks wall — name + rank only, 2×2 on mobile */}
                            {rows.length > 0 && (
                                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                                    {rows.map((d, i) => (
                                        <div key={`${source}-${tab}-${d.rank}-${d.name}`}
                                            className="group flex items-center gap-2 sm:gap-3 rounded-2xl border border-gold/[0.14] bg-white/[0.03] p-2.5 sm:p-3 transition-all duration-300 hover:-translate-y-0.5 hover:border-gold/55 hover:shadow-[0_14px_36px_-12px_rgba(227,179,65,0.45)] animate-fade-in-up"
                                            style={{ animationDelay: `${Math.min(i * 60, 420)}ms` }}>
                                            <RankBadge rank={d.rank} />
                                            <p className="flex-1 min-w-0 text-xs sm:text-[15px] font-black text-white truncate" dir="auto">{d.name}</p>
                                            <span className="hidden sm:block text-[9px] font-black tracking-[0.2em] text-gold/35 uppercase shrink-0" dir="ltr">RANK #{d.rank}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="rounded-2xl border border-dashed border-gold/35 bg-gold/[0.04] p-6 sm:p-8 text-center">
                            <div className="mx-auto w-16 h-16 rounded-[20px] bg-gradient-to-b from-gold/25 to-crimson/10 border border-gold/40 flex items-center justify-center">
                                <svg className="w-8 h-8 text-gold-light" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}><path strokeLinecap="round" strokeLinejoin="round" d="M8 21h8m-4-4v4M7 4h10v5a5 5 0 01-10 0V4zm0 0H4v2a3 3 0 003 3m10-5h3v2a3 3 0 01-3 3" /></svg>
                            </div>
                            <p className="text-white font-black mt-4">{lang === 'en' ? 'Be the first legend' : 'كن أول أسطورة تدعم البث'}</p>
                            <p className="text-white/40 text-xs font-medium mt-1">{lang === 'en' ? 'Your name will be written in gold' : 'اسمك سيُكتب هنا بالذهب'}</p>
                        </div>
                    )}
                </div>
            </div>

            <AlertTiers title={t.tiersTitle} note={lang === 'en' ? 'Donations are non-refundable' : 'التبرعات غير قابلة للاسترداد'} />
        </div>
    );
};


export default function App() {
    const [isHoveringProfile, setIsHoveringProfile] = useState(false);
    const [lang, setLang] = useState<Language>('ar');
    const [branding] = useState({ profileImage: BRAND_LOGO, bannerImage: SITE_BACKGROUND });

    /* الأرقام مبدوءة على آخر قراءة موثّقة: كرت ما يطلع فاضي أبداً — لا قبل
       وصول الرد ولا لو فشل (إنستغرام يحجب عناوين السحابة كثيراً). */
    const [socialStats, setSocialStats] = useState<Record<string, string>>({
        'KICK': formatFollowerCount(FALLBACK.kick!), 'Snapchat': formatFollowerCount(FALLBACK.snapchat!),
        'Instagram': formatFollowerCount(FALLBACK.instagram!), 'TikTok': formatFollowerCount(FALLBACK.tiktok!),
        'X': formatFollowerCount(FALLBACK.twitter!), 'WhatsApp': formatFollowerCount(FALLBACK.whatsapp!),
        'Discord': formatFollowerCount(FALLBACK.discord!)
    });
    /** الأرقام الخام لكل منصة — تُجمع في "مجموع المتابعين" بالمربع الأول */
    const [socialRaw, setSocialRaw] = useState<Record<string, number>>({});
    const [clanHours, setClanHours] = useState(0);

    const [socials, setSocials] = useState<SocialLink[]>([]);
    /** عدد منصات الساحة — ثابت ولا يتأثر بوصول الأرقام تباعاً */
    const [platformTotal, setPlatformTotal] = useState(7);
    const [lastSession, setLastSession] = useState<any>(null);
    const [pastSessions, setPastSessions] = useState<any[]>([]);
    const [clips, setClips] = useState<any[]>([]);
    const [supporters, setSupporters] = useState<any[]>([]);

    const [visitorCount, setVisitorCount] = useState(0);
    const [activePoll, setActivePoll] = useState<any>(null);
    const [media, setMedia] = useState<MediaTarget | null>(null);

    const [sponsors, setSponsors] = useState<any[]>([]);
    const [clipsList, setClipsList] = useState<any[]>([]);
    const [schedule, setSchedule] = useState<any[]>([]);
    const [isScheduleActive, setIsScheduleActive] = useState(true);
    const [faqs, setFaqs] = useState<any[]>([]);
    const [isFaqActive, setIsFaqActive] = useState(true);

    const fetchPublicData = async () => {
        try {
            // Parallel: one round-trip instead of 8 sequential ones
            const [sponRes, clpRes, schRes, fqRes, schToggleRes, faqToggleRes, seoRes] = await Promise.all([
                supabase.from('sponsors').select('*').order('id', { ascending: false }),
                supabase.from('highlight_clips').select('*').order('id', { ascending: false }),
                supabase.from('schedule').select('*').order('id', { ascending: true }),
                supabase.from('faqs').select('*').order('id', { ascending: false }),
                supabase.from('announcements').select('*').eq('id', 2).single(),
                supabase.from('announcements').select('*').eq('id', 3).single(),
                supabase.from('seo_settings').select('*').eq('id', 1).single(),
            ]);

            setSponsors(sponRes.data || []);
            setClipsList(clpRes.data || []);
            setSchedule(schRes.data || []);
            setFaqs(fqRes.data || []);

            const schToggle = schToggleRes.data;
            if (schToggle) setIsScheduleActive(schToggle.is_active === true || schToggle.is_active === 'true');
            else setIsScheduleActive(true);
            const faqToggle = faqToggleRes.data;
            if (faqToggle) setIsFaqActive(faqToggle.is_active === true || faqToggle.is_active === 'true');
            else setIsFaqActive(true);

            const seo = seoRes.data;
            if (seo) {
                document.title = seo.title || "xlxwi Stream Hub";
                const setMeta = (name: string, content: string, isProperty = false) => {
                    if (!content) return;
                    const attr = isProperty ? 'property' : 'name';
                    let meta = document.querySelector(`meta[${attr}="${name}"]`);
                    if (!meta) { meta = document.createElement('meta'); meta.setAttribute(attr, name); document.head.appendChild(meta); }
                    meta.setAttribute('content', content);
                };
                setMeta('description', seo.description);
                setMeta('keywords', seo.keywords || 'xlxwi, علي الهاشمي, كلان ليفل ون, Kick, Streamer');
                setMeta('og:title', seo.title, true);
                setMeta('og:description', seo.description, true);
            }
        } catch (e) { console.error("Public Data Fetch Exception:", e); }
    };

    useEffect(() => {
        let isTracked = false;
        const initData = async () => {
            if (!sessionStorage.getItem('site_visited') && !isTracked) {
                isTracked = true;
                sessionStorage.setItem('site_visited', 'true');
                const { data: overall } = await supabase.from('site_stats').select('visits').eq('id', 1).single();
                if (overall) {
                    const newVisits = overall.visits + 1;
                    await supabase.from('site_stats').update({ visits: newVisits }).eq('id', 1);
                    setVisitorCount(newVisits);
                }
                const today = new Date().toISOString().split('T')[0];
                const { data: todayStats } = await supabase.from('daily_views').select('*').eq('view_date', today).single();
                if (todayStats) await supabase.from('daily_views').update({ views_count: todayStats.views_count + 1 }).eq('id', todayStats.id);
                else await supabase.from('daily_views').insert([{ view_date: today, views_count: 1 }]);
            }
            fetchPublicData();
        };
        initData();

        const fetchLive = async () => {
            const [statRes, pollRes] = await Promise.all([
                supabase.from('site_stats').select('visits').eq('id', 1).single(),
                supabase.from('polls').select('*').eq('is_active', true).order('id', { ascending: false }).limit(1).single(),
            ]);
            if (statRes.data) setVisitorCount(statRes.data.visits);
            setActivePoll(pollRes.data || null);
        };
        fetchLive();
        // يتوقف التحديث التلقائي والتبويب مخفي
        let interval: ReturnType<typeof setInterval> | null = null;
        const startLive = () => { if (!interval) interval = setInterval(fetchLive, 30000); };
        const stopLive = () => { if (interval) { clearInterval(interval); interval = null; } };
        const onVis = () => { if (document.visibilityState === 'visible') { fetchLive(); startLive(); } else stopLive(); };
        startLive();
        document.addEventListener('visibilitychange', onVis);
        return () => { stopLive(); document.removeEventListener('visibilitychange', onVis); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Supporters wall — reads public `donations` table (graceful when missing/empty)
    useEffect(() => {
        (async () => {
            try {
                const { data, error } = await supabase.from('donations').select('*').eq('is_visible', true).order('amount', { ascending: false }).limit(24);
                if (!error && data) setSupporters(data);
            } catch { /* table may not exist yet */ }
        })();
    }, []);
    // Live social counters — dedicated 5-minute loop + instant cache paint (API-style)
    useEffect(() => {
        const apply = (stats: { kick?: number; instagram?: number; tiktok?: number; twitter?: number; discord?: number; snapchat?: number; whatsapp?: number }) => {
            setSocialStats(prev => ({
                ...prev,
                'KICK': formatFollowerCount(stats.kick || 0) || prev['KICK'],
                'Instagram': formatFollowerCount(stats.instagram || 0) || prev['Instagram'],
                'TikTok': formatFollowerCount(stats.tiktok || 0) || prev['TikTok'],
                'X': formatFollowerCount(stats.twitter || 0) || prev['X'],
                'Discord': formatFollowerCount(stats.discord || 0) || prev['Discord'],
                'Snapchat': formatFollowerCount(stats.snapchat || 0) || prev['Snapchat'],
                'WhatsApp': formatFollowerCount(stats.whatsapp || 0) || prev['WhatsApp'],
            }));
            setSocialRaw(prev => {
                const next = { ...prev };
                for (const [platform, value] of Object.entries(stats)) {
                    if (typeof value === 'number' && value > 0) next[platform] = value;
                }
                return next;
            });
        };
        const cached = readSocialCache();
        if (cached) apply(cached);
        let dead = false;
        const refreshSocials = () => {
            getAllSocialMediaStats().then(stats => { if (!dead) apply(stats); }).catch(() => {});
        };
        refreshSocials();
        let socialInterval: ReturnType<typeof setInterval> | null = null;
        const startSocials = () => { if (!socialInterval) socialInterval = setInterval(refreshSocials, SOCIAL_TTL_MS); };
        const stopSocials = () => { if (socialInterval) { clearInterval(socialInterval); socialInterval = null; } };
        const onVis = () => { if (document.visibilityState === 'visible') startSocials(); else stopSocials(); };
        startSocials();
        document.addEventListener('visibilitychange', onVis);
        return () => { dead = true; stopSocials(); document.removeEventListener('visibilitychange', onVis); };
    }, []);

    // ساعات مشاهدة الكلان — نفس مصدر "أساطير الشات" (كاش 5 دقائق)
    useEffect(() => {
        let dead = false;
        const load = () =>
            fetchBotrixLeaderboard()
                .then(rows => {
                    if (dead || rows.length === 0) return;
                    // watchtime بالدقائق عند بوتريكس
                    setClanHours(Math.round(rows.reduce((sum, r) => sum + (r.watchtime || 0), 0) / 60));
                })
                .catch(() => {});
        load();
        // المحاولة الأولى تسبق أحياناً انتهاء كاش المتصفح → إعادة محاولة واحدة فقط
        const retry = setTimeout(load, 6000);
        return () => {
            dead = true;
            clearTimeout(retry);
        };
    }, []);

    const totalFollowers = useMemo(
        () => ['kick', 'instagram', 'tiktok', 'twitter', 'discord', 'snapchat', 'whatsapp']
            .reduce((sum, platform) => sum + (socialRaw[platform] || 0), 0),
        [socialRaw],
    );

    const handleVote = async (optionId: number) => {
        if (!activePoll || localStorage.getItem(`voted_${activePoll.id}`)) return;
        const newOptions = activePoll.options.map((opt: any) => opt.id === optionId ? { ...opt, votes: opt.votes + 1 } : opt);
        await supabase.from('polls').update({ options: newOptions }).eq('id', activePoll.id);
        setActivePoll({ ...activePoll, options: newOptions });
        localStorage.setItem(`voted_${activePoll.id}`, 'true');
    };

    useEffect(() => {
        const cards = [
            { ...KICK_SOCIAL, followerCount: socialStats['KICK'] },
            createSocialLink('snapchat', 'https://www.snapchat.com/@xlxwiii', socialStats['Snapchat'], 'يوميات حصرية وتغطيات خاصة'),
            createSocialLink('instagram', 'https://www.instagram.com/3.4i/', socialStats['Instagram'], 'صور وكواليس حصرية'),
            createSocialLink('tiktok', 'https://www.tiktok.com/@xlxwi', socialStats['TikTok'], 'أقوى المقاطع والتحديات'),
            createSocialLink('twitter', 'https://x.com/xlxwi', socialStats['X'], 'أخبار وتحديثات سريعة'),
            createSocialLink('whatsapp', 'https://www.whatsapp.com/channel/0029VadcjLc4Y9lnhHoOAw0a', socialStats['WhatsApp'], 'تواصل مباشر وتنبيهات البث'),
            createSocialLink('discord', 'https://discord.gg/tmfx', socialStats['Discord'], 'بيت كلان ليفل ون'),
        ];
        setPlatformTotal(cards.length);
        setSocials(cards.filter(Boolean) as SocialLink[]);
    }, [socialStats]);

    // مصدر الأرقام الوحيد هو جلب كيك الحي — الكاش يحمي القسم من الاختفاء لحظة فشل طلب دوري واحد
    const [streamInfo, setStreamInfo] = useState<StreamDetail>(() => {
        const cached = readStreamCache(CHANNEL_SLUG);
        if (cached) return { ...cached, isLive: true };
        return {
            isLive: false, viewers: 0, title: '',
            category: '', tags: [], startedAt: null,
            language: '',
            isMature: false, categoryViewers: 0, categoryTags: [], followers: 0, subTiers: 0, verified: false,
            chatMode: '', slowMode: false, messageInterval: 0, followersOnly: false, subsOnly: false, emotesOn: false,
        };
    });
    const [streamUpdatedAt, setStreamUpdatedAt] = useState<number | null>(null);
    // آخر بث حي ناجح — يُخزَّن لثلاث ساعات فقط، فينطفي القسم تلقائياً بعدها لو طالت المدة
    useEffect(() => {
        if (!streamInfo.isLive || !streamInfo.title) return;
        try { localStorage.setItem(`xlxwi_stream_${CHANNEL_SLUG}`, JSON.stringify({ ...streamInfo, cachedAt: Date.now() })); } catch { /* التخزين ممتلئ */ }
    }, [streamInfo]);
    const t = TRANSLATIONS[lang];

    const fetchKickStatus = useCallback(async () => {
        try {
            // الثلاث طلبات مع بعض بدل ما تكون متتابعة
            const [channelData, videosRawData, clipsRawData] = await Promise.all([
                kickFetch(`https://kick.com/api/v2/channels/${CHANNEL_SLUG}`, true),
                kickFetch(`https://kick.com/api/v2/channels/${CHANNEL_SLUG}/videos`, true),
                kickFetch(`https://kick.com/api/v2/channels/${CHANNEL_SLUG}/clips?limit=5`, true),
            ]);

            const data = channelData;
            const videosArray = videosRawData?.videos || (Array.isArray(videosRawData) ? videosRawData : []);
            if (data) {
                const livestreamData = data.livestream || data.live_stream;
                const isLive = livestreamData && (livestreamData.is_live === true || livestreamData.is_live === 1);
                const room = data.chatroom || {};
                if (isLive) {
                    const cat = livestreamData.categories?.[0];
                    setStreamInfo({
                        isLive: true,
                        viewers: livestreamData.viewer_count || 0,
                        title: livestreamData.session_title || livestreamData.title || 'Live Stream',
                        category: cat?.name || 'Just Chatting',
                        tags: livestreamData.tags ? livestreamData.tags.map((tg: any) => tg.name || tg) : [],
                        startedAt: kickTime(livestreamData.start_time || livestreamData.created_at),
                        language: livestreamData.language || '',
                        isMature: !!livestreamData.is_mature,
                        categoryViewers: cat?.viewers || 0,
                        categoryTags: Array.isArray(cat?.tags) ? cat.tags : [],
                        followers: data.followers_count || 0,
                        subTiers: (data.subscriber_badges || []).length,
                        verified: !!data.verified,
                        chatMode: room.chat_mode || '',
                        slowMode: !!room.slow_mode,
                        messageInterval: room.message_interval || 0,
                        followersOnly: !!room.followers_mode,
                        subsOnly: !!room.subscribers_mode,
                        emotesOn: !!room.emotes_mode,
                    });
                } else {
                    // غير مباشر: قسم البث ينطفي، وقسم «آخر جلسة» يتكفّل بالبيانات من مصدره الخاص
                    setStreamInfo(prev => ({
                        ...prev,
                        isLive: false, viewers: 0, title: '', startedAt: null,
                        followers: data.followers_count || prev.followers,
                        subTiers: (data.subscriber_badges || []).length || prev.subTiers,
                        verified: !!data.verified,
                        chatMode: room.chat_mode || prev.chatMode,
                        slowMode: !!room.slow_mode,
                        messageInterval: room.message_interval || 0,
                        followersOnly: !!room.followers_mode,
                        subsOnly: !!room.subscribers_mode,
                        emotesOn: !!room.emotes_mode,
                    }));
                }
                if (data.followers_count !== undefined) {
                    const count = data.followers_count;
                    setSocialStats(prev => ({ ...prev, 'KICK': count >= 1000 ? `${(count / 1000).toFixed(1)}K` : count.toString() }));
                }
            }

            if (videosArray?.length > 0) { setLastSession(videosArray[0]); setPastSessions(videosArray.slice(1, 4)); }
            else {
                const streams = data?.previous_livestreams || data?.recent_streams || [];
                if (streams?.length > 0) { setLastSession(streams[0]); setPastSessions(streams.slice(1, 4)); }
            }

            setStreamUpdatedAt(Date.now());
            const clipsData = clipsRawData?.data || clipsRawData;
            const clipsArray = clipsData?.clips || (Array.isArray(clipsData) ? clipsData : (clipsData?.data && Array.isArray(clipsData.data) ? clipsData.data : []));
            setClips(Array.isArray(clipsArray) ? clipsArray.slice(0, 3) : []);
        } catch (err) {
            // فشل الجلب لا يكسر الصفحة — الأرقام تبقى على آخر قيمة معروضة
            console.warn('[xlxwi] kick status fetch failed', err);
        }
    }, []);

    useEffect(() => {
        fetchKickStatus();
        // ما نسأل السيرفر والتبويب مخفي — يوفّر باقة الداتا والبطارية
        let timer: ReturnType<typeof setInterval> | null = null;
        const start = () => { if (!timer) timer = setInterval(fetchKickStatus, 60000); };
        const stop = () => { if (timer) { clearInterval(timer); timer = null; } };
        const onVis = () => { if (document.visibilityState === 'visible') { fetchKickStatus(); start(); } else stop(); };
        start();
        document.addEventListener('visibilitychange', onVis);
        return () => { stop(); document.removeEventListener('visibilitychange', onVis); };
    }, [fetchKickStatus]);

    const handleShare = async () => {
        const shareUrl = "https://kick.com/xlxwi";
        if (navigator.share) { try { await navigator.share({ title: t.shareTitle, text: t.shareText, url: shareUrl }); } catch { /* dismissed */ } }
        else { try { await navigator.clipboard.writeText(shareUrl); } catch { /* clipboard blocked */ } alert(t.copied); }
    };

    // المسرح يحتل خانة 02 أثناء الحي فقط؛ خلاصة المهمة تُحضَّر للنهاية وتُخفى كلياً أثناء البث
    const showTheater = streamInfo.isLive;
    const showDebrief = !streamInfo.isLive && !!lastSession;

    const kickCard = socials.find(s => s.name === 'KICK');
    const snapCard = socials.find(s => s.name === 'Snapchat');
    const restSocials = socials.filter(s => s.name !== 'KICK' && s.name !== 'Snapchat');

    useEffect(() => {
        document.documentElement.lang = lang;
        document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    }, [lang]);

    /** روابط القائمة — بنفس ترتيب ظهور الأقسام في الصفحة، ولا رابط يقود لقسم غير موجود */
    const navLinks = useMemo(() => {
        const hasSchedule = (isScheduleActive && schedule.length > 0) || (isFaqActive && faqs.length > 0);
        const links = [
            { id: 'socials', ar: 'التواصل', en: 'Socials' },
            // البث مباشرة بعد التواصل لأنه مكانه في الصفحة أثناء البث
            ...(streamInfo.isLive ? [{ id: 'live', ar: 'البث', en: 'Live' }] : []),
            { id: 'support', ar: 'الدعم', en: 'Support' },
            { id: 'moderators', ar: 'المودات', en: 'Mods' },
            // تقرير الجلسة لا يظهر إلا والقناة مغلقة، وموضعه بعد المودات
            ...(!streamInfo.isLive ? [{ id: 'report', ar: 'الجلسة', en: 'Session' }] : []),
        ];
        if (hasSchedule) links.push({ id: 'schedule', ar: 'الجدول', en: 'Schedule' });
        links.push(
            { id: 'kick', ar: 'كيك', en: 'Kick' },
            { id: 'legends', ar: 'الأساطير', en: 'Legends' },
            { id: 'library', ar: 'الفيديوهات', en: 'Videos' },
        );
        return links;
    }, [streamInfo.isLive, isScheduleActive, isFaqActive, schedule.length, faqs.length]);

    const [activeSection, setActiveSection] = useState('');
    const [menuOpen, setMenuOpen] = useState(false);

    /** القفز لقسم — الأقسام المؤجَّلة التركيب تُنزَّل أولاً حتى تُركَّب، عشان ما يصير الرابط ميت */
    const goToSection = useCallback((id: string) => {
        const jump = () => {
            const el = document.getElementById(id);
            if (!el) return false;
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            return true;
        };
        if (jump()) return;
        let guard = 0;
        const step = () => {
            if (jump() || guard++ > 30) return;
            window.scrollTo(0, window.scrollY + window.innerHeight * 0.85);
            window.setTimeout(step, 220);
        };
        window.setTimeout(step, 220);
    }, []);

    useEffect(() => {
        let raf = 0;
        const ids = navLinks.map(n => n.id);
        const onScroll = () => {
            if (raf) return;
            raf = requestAnimationFrame(() => {
                raf = 0;
                const line = window.scrollY + 180;
                let current = '';
                for (const id of ids) {
                    const el = document.getElementById(id);
                    if (el && el.getBoundingClientRect().top + window.scrollY <= line) current = id;
                }
                setActiveSection(current);
            });
        };
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onScroll);
        return () => {
            if (raf) cancelAnimationFrame(raf);
            window.removeEventListener('scroll', onScroll);
            window.removeEventListener('resize', onScroll);
        };
    }, [navLinks]);

    return (
        <div className={`grain relative min-h-screen w-full overflow-x-hidden ${lang === 'ar' ? 'font-arabic' : 'font-sans'}`}>
            <ArenaBackground />
                <div className="relative z-10 w-full max-w-[1200px] mx-auto px-3 sm:px-4 md:px-8 pb-10 overflow-clip">

                    {/* ===== NAV — urgent edition ===== */}
                    <header className="sticky top-2 md:top-5 z-50">
                        <div className="absolute -top-8 inset-x-8 h-16 rounded-full pointer-events-none" aria-hidden="true"
                            style={{ background: 'radial-gradient(ellipse 60% 100% at 50% 50%, rgba(227,179,65,0.16) 0%, transparent 70%)' }} />
                        <nav className="relative flex items-center justify-between gap-2 px-3 sm:px-4 md:px-6 py-2.5 rounded-2xl bg-wine-900/92 border border-gold/15 shadow-[0_18px_50px_rgba(0,0,0,0.55)] overflow-hidden" aria-label="Main">
                            <span className="absolute top-0 inset-x-10 h-[2px] rounded-full bg-gradient-to-r from-transparent via-gold/80 to-transparent pointer-events-none" aria-hidden="true" />
                            <a href="#top" className="nav-brand group flex items-center gap-2.5 shrink-0 min-w-0">
                                <span className="relative w-10 h-10 rounded-[14px] overflow-hidden border border-gold/45 bg-wine-950 shadow-[0_0_20px_rgba(227,179,65,0.35)] shrink-0 block transition-transform duration-500 group-hover:scale-105">
                                    <img src={branding.profileImage} alt="xlxwi logo" className="w-full h-full object-cover" />
                                    <span className={`absolute bottom-1 end-1 w-2 h-2 rounded-full ring-2 ring-wine-950 ${streamInfo.isLive ? 'bg-[#E3B341] animate-pulse' : 'bg-white/25'}`} />
                                </span>
                                <span className="hidden min-[420px]:block leading-none min-w-0">
                                    <span className="flex items-center gap-1.5">
                                        <span className="nav-wm font-gaming text-[20px] leading-[1.1] tracking-[0.04em]" dir="ltr">XLXWI</span>
                                        {streamInfo.isLive && <span className="text-[8px] font-black px-1.5 py-[3px] rounded-md bg-[#C21E3A] text-white tracking-widest animate-pulse" dir="ltr">LIVE</span>}
                                    </span>
                                    <span className="block text-[9px] font-bold text-gold/45 mt-1.5 truncate">{t.headerTitle}</span>
                                </span>
                            </a>
                            <div className="hidden lg:flex items-center gap-0.5 text-[12.5px] font-black">
                                {navLinks.map((n) => {
                                    const on = activeSection === n.id;
                                    return (
                                        <a key={n.id} href={`#${n.id}`} onClick={(e) => { e.preventDefault(); goToSection(n.id); }}
                                            className={`px-3 py-2 rounded-xl transition-all duration-300 ${on ? 'text-wine-950' : 'text-white/55 hover:text-white hover:bg-white/[0.06]'}`}
                                            style={on ? { background: 'linear-gradient(150deg, #FFF3D6, #E3B341 58%, #B8860B)', boxShadow: '0 8px 20px -8px rgba(227,179,65,0.85), inset 0 1px 0 rgba(255,255,255,0.5)' } : undefined}>
                                            {lang === 'en' ? n.en : n.ar}
                                        </a>
                                    );
                                })}
                            </div>
                            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                                <span className={`hidden sm:inline-flex items-center gap-2 text-[11px] font-black px-3 py-2 rounded-full border ${streamInfo.isLive ? 'border-[#E3B341]/50 bg-[#E3B341]/10 text-[#E3B341]' : 'border-gold/20 bg-white/5 text-white/50'}`}>
                                    <span className={`w-2 h-2 rounded-full shrink-0 ${streamInfo.isLive ? 'bg-[#E3B341] animate-pulse shadow-[0_0_10px_#E3B341]' : 'bg-white/30'}`} />
                                    {streamInfo.isLive ? t.status : t.statusOffline}
                                    {streamInfo.isLive && streamInfo.viewers > 0 && <span dir="ltr">• {streamInfo.viewers.toLocaleString()}</span>}
                                </span>
                                <button onClick={() => setMenuOpen(v => !v)} aria-label={lang === 'en' ? 'Sections' : 'الأقسام'} aria-expanded={menuOpen}
                                    className={`btn-arena lg:hidden w-11 h-11 rounded-xl border flex items-center justify-center active:scale-95 transition-colors ${menuOpen ? 'bg-gold text-wine-950 border-gold' : 'bg-white/[0.06] border-gold/15 text-white/70 hover:text-white'}`}>
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                                        {menuOpen
                                            ? <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
                                            : <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h10" />}
                                    </svg>
                                </button>
                                <button onClick={() => fetchKickStatus()} aria-label="Refresh"
                                    className="btn-arena w-11 h-11 rounded-xl bg-white/[0.06] border border-gold/15 text-white/60 hover:text-white active:scale-95 flex items-center justify-center">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                </button>
                                <button onClick={() => setLang(p => p === 'en' ? 'ar' : 'en')}
                                    className="btn-arena h-11 px-4 sm:px-5 rounded-xl bg-gradient-to-b from-gold-light to-gold text-wine-950 text-xs font-black tracking-wider active:scale-95 shadow-[0_0_24px_rgba(227,179,65,0.4)]">
                                    {lang === 'en' ? 'عربي' : 'EN'}
                                </button>
                            </div>
                        </nav>
                        {/* قائمة الأقسام للجوال — خارج الـ nav لأنه overflow-hidden */}
                        {menuOpen && (
                            <div className="lg:hidden absolute top-full inset-x-0 mt-2 z-50 animate-slide-down">
                                <div className="rounded-2xl border border-gold/20 bg-wine-950/97 backdrop-blur-xl shadow-[0_28px_70px_rgba(0,0,0,0.72)] p-2">
                                    <p className="px-3 pt-2 pb-2.5 text-[9px] font-black tracking-[0.3em] text-gold/45 uppercase">{lang === 'en' ? 'SECTIONS' : 'الأقسام'}</p>
                                    {navLinks.map((n) => {
                                        const on = activeSection === n.id;
                                        return (
                                            <a key={n.id} href={`#${n.id}`} onClick={(e) => { e.preventDefault(); setMenuOpen(false); goToSection(n.id); }}
                                                className={`flex items-center gap-2.5 px-3.5 py-3 rounded-xl text-[13px] font-black transition-colors ${on ? 'bg-gold/[0.13] text-gold-light' : 'text-white/65 hover:bg-white/[0.06] hover:text-white'}`}>
                                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${on ? 'bg-gold shadow-[0_0_8px_#E3B341]' : 'bg-white/20'}`} />
                                                {lang === 'en' ? n.en : n.ar}
                                            </a>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                        {/* mobile: status strip */}
                        <div className="sm:hidden mt-2 rounded-2xl p-[1px] bg-gradient-to-b from-white/15 via-white/[0.06] to-transparent">
                            <div className="rounded-[15px] bg-black/70 overflow-hidden">
                                <div className={`h-[2px] ${streamInfo.isLive ? 'bg-gradient-to-l from-[#E3B341] via-[#E3B341]/40 to-transparent' : 'bg-gradient-to-l from-white/25 via-white/10 to-transparent'}`} />
                                <div className="px-4 py-2.5 flex items-center justify-center gap-2">
                                    <span className={`w-2 h-2 rounded-full shrink-0 ${streamInfo.isLive ? 'bg-[#E3B341] animate-pulse shadow-[0_0_10px_#E3B341]' : 'bg-white/30'}`} />
                                    <p className={`text-[11px] font-black ${streamInfo.isLive ? 'text-[#E3B341]' : 'text-white/60'}`}>
                                        {streamInfo.isLive ? `${t.status}${streamInfo.viewers > 0 ? ` • ${streamInfo.viewers.toLocaleString()} ${t.viewers}` : ''}` : t.statusOffline}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </header>

                    {/* ===== HERO ===== */}
                    <section id="top" className="pt-6 md:pt-10 pb-6 md:pb-8 overflow-clip">
                        <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-8 lg:gap-10 items-center justify-items-center lg:justify-items-stretch">
                            <div className="animate-fade-in-up w-full max-w-xl text-center lg:text-start order-2 lg:order-1">
                                <h1 className="wm-mark relative font-gaming leading-none tracking-wide select-none text-[clamp(96px,24vw,180px)] lg:text-[180px]" dir="ltr" aria-label="xlxwi">
                                    <span aria-hidden="true" className="wm-depth wm-depth-2 font-gaming leading-none tracking-wide">XLXWI</span>
                                    <span aria-hidden="true" className="wm-depth wm-depth-1 font-gaming leading-none tracking-wide">XLXWI</span>
                                    <span aria-hidden="true" className="relative z-10">
                                        <span className="wm-letter wm-stroke">X</span><span className="wm-letter wm-stroke">L</span><span className="wm-letter wm-stroke">X</span><span className="wm-letter wm-stroke">W</span><span className="wm-letter wm-stroke">I</span>
                                    </span>
                                    <span aria-hidden="true" className="wm-sheen font-gaming leading-none tracking-wide z-20">XLXWI</span>
                                </h1>
                                <p className="font-gaming text-xl sm:text-2xl md:text-4xl text-stroke mt-1 tracking-wide" dir="ltr" aria-hidden="true">STAY ONE</p>
                                {/* Clan Level One — درع الكلان: هو الزر الوحيد القابل للضغط هنا */}
                                <div className="mt-3 inline-flex flex-wrap items-center justify-center lg:justify-start gap-2.5">
                                    <a href="https://x.com/level_one" target="_blank" rel="noopener noreferrer"
                                        className="clan-crest card-sheen" dir="ltr"
                                        title={lang === 'ar' ? 'كلان لفل ون على إكس' : 'Clan Level One on X'}
                                        aria-label={lang === 'ar' ? 'كلان لفل ون على إكس' : 'Clan Level One on X'}>
                                        <span className="clan-crest-shield" aria-hidden="true">
                                            <img src="level-one-mark.webp" alt="" width={271} height={330} />
                                            <b>01</b>
                                        </span>
                                        <span className="clan-crest-txt">
                                            <i>CLAN</i>
                                            <em>LEVEL ONE</em>
                                        </span>
                                        <span className="clan-crest-go" aria-hidden="true">
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round"><path d="M7 17 17 7M9 7h8v8" /></svg>
                                        </span>
                                    </a>
                                    {/* الوسم زينة هوية — بلا رابط ولا تفاعل */}
                                    <span className="clan-tag" dir="ltr">{CLAN.tag}</span>
                                    <span className="clan-ar">{CLAN.ar}</span>
                                </div>
                                <p className="text-white/65 text-[15px] md:text-lg leading-relaxed max-w-xl mt-4 md:mt-5 font-medium mx-auto lg:mx-0">{t.bio}</p>
                                <div className="flex flex-wrap justify-center lg:justify-start gap-2 sm:gap-2.5 mt-4 md:mt-5">
                                    {t.tags.map((tag: string, i: number) => (
                                        <span key={i} className="px-3.5 sm:px-4 py-1.5 rounded-full bg-white/[0.05] border border-gold/15 text-[11px] sm:text-xs font-bold text-white/75">#{tag}</span>
                                    ))}
                                </div>
                                <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3 mt-6 md:mt-7">
                                    <a href="https://kick.com/xlxwi" target="_blank" rel="noopener noreferrer"
                                        className="btn-arena inline-flex items-center justify-center gap-2.5 px-7 py-4 sm:py-3.5 rounded-2xl bg-gradient-to-b from-gold-light to-gold text-wine-950 font-black text-[15px] md:text-base shadow-[0_0_35px_rgba(227,179,65,0.45)] active:scale-[0.98]">
                                        <svg className="w-5 h-5 fill-current shrink-0" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                                        {t.watchLive}
                                    </a>
                                    <a href="https://www.whatsapp.com/channel/0029VadcjLc4Y9lnhHoOAw0a" target="_blank" rel="noopener noreferrer"
                                        className="btn-arena inline-flex items-center justify-center gap-2.5 px-7 py-4 sm:py-3.5 rounded-2xl bg-white/[0.06] border border-gold/25 text-white font-black text-[15px] md:text-base hover:bg-gold/[0.12] hover:border-gold/60 hover:shadow-[0_0_28px_rgba(227,179,65,0.35)] active:scale-[0.98] transition-all duration-300">
                                        <WhatsAppIcon className="w-5 h-5 shrink-0 text-gold-light" />
                                        {t.joinWhatsapp}
                                    </a>
                                </div>
                                <div className="grid grid-cols-3 w-full gap-2 sm:gap-3 mt-6 md:mt-8">
                                    {[
                                        { v: formatFollowerCount(totalFollowers) || '—', l: t.statsTotal, hot: true },
                                        { v: clanHours > 0 ? formatFollowerCount(clanHours) : '—', l: t.statsHours },
                                        { v: String(platformTotal), l: t.statsPlatforms },
                                    ].map((s, i) => (
                                        <div key={i} className={`stat-tile ${s.hot ? 'stat-tile-hot' : ''}`}>
                                            <span className="stat-tile-line" aria-hidden="true" />
                                            <p className="stat-tile-v font-gaming truncate" dir="ltr">{s.v}</p>
                                            <p className="stat-tile-l truncate">{s.l}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Profile visual — first on mobile only */}
                            <div className="flex justify-center lg:justify-start animate-fade-in w-full order-1 lg:order-2" style={{ animationDelay: '150ms' }}>
                                <div className="relative mx-6 sm:mx-8" onMouseEnter={() => setIsHoveringProfile(true)} onMouseLeave={() => setIsHoveringProfile(false)}>
                                    <div className="profile-3d-ring" />
                                    <div className="profile-3d-ring-inner" />
                                    <div className="tech-corner tech-corner-tl" /><div className="tech-corner tech-corner-tr" />
                                    <div className="tech-corner tech-corner-bl" /><div className="tech-corner tech-corner-br" />
                                    <div className="relative w-48 h-48 sm:w-64 sm:h-64 md:w-72 md:h-72 rounded-full overflow-hidden border-2 border-gold/30 shadow-[0_0_70px_rgba(227,179,65,0.28)] bg-wine-950 transition-transform duration-500 hover:scale-[1.03]">
                                        <div className="profile-scanner" />
                                        <img src={branding.profileImage} alt="xlxwi — علي الهاشمي" className={`w-full h-full object-cover transition-transform duration-700 ${isHoveringProfile ? 'scale-110 rotate-1' : ''}`} loading="eager" />
                                        <div className="absolute inset-0 shadow-[inset_0_0_40px_rgba(0,0,0,0.75)] pointer-events-none" />
                                    </div>
                                    <div className="absolute -bottom-2 -end-1 z-20">
                                        <div className="relative w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center">
                                            <div className="absolute inset-0 bg-[#E3B341] rounded-2xl blur-lg opacity-40 animate-pulse" />
                                            <div className="relative w-full h-full bg-wine-950 rounded-2xl border border-[#E3B341]/60 flex items-center justify-center rotate-6">
                                                <KickIcon className="w-6 h-6 sm:w-7 sm:h-7 text-gold -rotate-6" />
                                            </div>
                                        </div>
                                    </div>
                                    <div className={`absolute -top-2 -start-2 sm:-start-4 glass border rounded-2xl px-3 py-2 shadow-xl animate-float-soft max-w-[150px] ${streamInfo.isLive ? 'border-[#E3B341]/40' : 'border-gold/15'}`}>
                                        <p className="text-[8px] sm:text-[9px] font-black tracking-widest text-white/40 uppercase">{streamInfo.isLive ? (lang === 'en' ? 'WATCHING' : 'مشاهد') : (lang === 'en' ? 'STATUS' : 'الحالة')}</p>
                                        <p className={`text-xs sm:text-sm font-black truncate ${streamInfo.isLive ? 'text-[#E3B341]' : 'text-white/70'}`} dir="ltr">
                                            {streamInfo.isLive ? streamInfo.viewers.toLocaleString() : t.statusOffline}
                                        </p>
                                    </div>
                                    <div className="absolute top-1/3 -end-2 md:-end-10 glass border border-gold/30 rounded-2xl px-3 py-2 shadow-xl animate-float hidden min-[420px]:block" style={{ animationDelay: '-2s' }}>
                                        <p className="text-[8px] sm:text-[9px] font-black tracking-widest text-gold uppercase" dir="ltr">KICK</p>
                                        <p className="text-xs sm:text-sm font-black text-white" dir="ltr">{socialStats['KICK']}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    <Marquee lang={lang} />

                    {/* ===== SOCIALS BENTO ===== */}
                    <section id="socials" className="pt-12 md:pt-16 scroll-mt-28">
                        <Reveal><SectionHeading no="01" title={t.socialsTitle} sub={t.socialsSub} en="SOCIAL ARENA" /></Reveal>
                        {/* كيك = عمود طولي ياخذ ثلاثة أدوار، وبقية المنصات تملأ الصفوف بجانبها.
                            السناب آخر بطاقة (سطر 6) عشان عدّاده مغّب ولا ينافس المباشر. */}
                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5 md:gap-4 lg:auto-rows-[1fr]">
                            {kickCard && (
                                <Reveal delay={0} className="col-span-2 lg:col-span-1 lg:row-span-3">
                                    <SocialCard social={kickCard} index={0} featured live={streamInfo.isLive} lang={lang} />
                                </Reveal>
                            )}
                            {restSocials.map((s, i) => (
                                <Reveal key={s.name} delay={Math.min(i * 60, 300)}>
                                    <SocialCard social={s} index={i + 2} lang={lang} />
                                </Reveal>
                            ))}
                            {snapCard && (
                                <Reveal delay={330}>
                                    <SocialCard social={snapCard} index={restSocials.length + 2} lang={lang} />
                                </Reveal>
                            )}
                        </div>
                    </section>

                    {/* ===== 02 مسرح البث — أثناء الحي فقط، ويختفي كلياً عند الإغلاق ===== */}
                    {showTheater && (
                        <section id="live" className="relative pt-12 md:pt-16 scroll-mt-28 animate-slide-down">
                            {/* ambient stage glow (تدرّج شعاعي بدون فلتر) */}
                            <div className="pointer-events-none absolute -top-10 right-[8%] w-[420px] h-[220px] rounded-full"
                                style={{ background: 'radial-gradient(ellipse, rgba(227,179,65,0.13) 0%, transparent 68%)' }} />
                            <div className="pointer-events-none absolute bottom-0 left-[5%] w-[320px] h-[190px] rounded-full"
                                style={{ background: 'radial-gradient(ellipse, rgba(110,27,43,0.30) 0%, transparent 68%)' }} />
                            <Reveal><SectionHeading no="02" title={t.theaterTitle} sub={`${streamInfo.viewers.toLocaleString()} ${t.viewers}`} en="LIVE THEATER" /></Reveal>
                            <Suspense fallback={<div className="w-full h-[520px] rounded-[32px] border border-gold/15 bg-white/[0.02] animate-pulse" />}>
                                <LiveTheater lang={lang} stream={streamInfo} channelSlug={CHANNEL_SLUG}
                                    updatedAt={streamUpdatedAt} onRefresh={fetchKickStatus} onShare={handleShare} />
                            </Suspense>
                        </section>
                    )}

                    {/* ===== SUPPORT ===== */}
                    <section id="support" className="pt-12 md:pt-16 scroll-mt-28">
                        <Reveal><SectionHeading no={showTheater ? '03' : '02'} title={t.supportTitle} sub={t.supportSub} en="SUPPORT" /></Reveal>
                        <Reveal delay={80}><SupportArena lang={lang} supporters={supporters} /></Reveal>
                    </section>

                    {/* ===== MODERATORS ===== */}
                    <section id="moderators" className="pt-12 md:pt-16 scroll-mt-28">
                        <Reveal><SectionHeading no={showTheater ? '04' : '03'} title={t.modsTitle} en="MODERATORS" /></Reveal>
                        <Reveal delay={80}>
                            <Suspense fallback={<div className="w-full h-64 rounded-[26px] border border-gold/15 bg-white/[0.02] animate-pulse" />}>
                                <DeferredMount minHeight={280}>
                                    <ModeratorsSection lang={lang} />
                                </DeferredMount>
                            </Suspense>
                        </Reveal>
                    </section>

                    {/* ===== 04 خلاصة المهمة — تُعرض بعد المشرفين، وتختفي كلياً أثناء البث ===== */}
                    {showDebrief && (
                        <section id="report" className="relative pt-12 md:pt-16 scroll-mt-28">
                            <div className="pointer-events-none absolute -top-8 left-[6%] w-[380px] h-[200px] rounded-full"
                                style={{ background: 'radial-gradient(ellipse, rgba(227,179,65,0.10) 0%, transparent 68%)' }} />
                            <Reveal><SectionHeading no="04" title={t.debriefTitle} sub={t.debriefSub} en="MISSION DEBRIEF" /></Reveal>
                            <LastSessionReport lang={lang} data={lastSession} clips={clips} past={pastSessions} onPlay={setMedia} />
                        </section>
                    )}

                    {/* ===== POLL ===== */}
                    {activePoll && (
                        <section className="pt-12 md:pt-16">
                            <Reveal>
                                <div className="relative overflow-hidden rounded-[28px] border border-gold/15 bg-wine-950/92 p-6 md:p-9 shadow-2xl">
                                    <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-l from-transparent via-[#C21E3A] to-transparent" />
                                    <div className="flex items-center justify-center gap-3 mb-7">
                                        <span className="w-2 h-2 rounded-full bg-[#C21E3A] shadow-[0_0_10px_#C21E3A] animate-pulse" />
                                        <h3 className="text-lg md:text-2xl font-black text-white text-center">{activePoll.question}</h3>
                                        <span className="w-2 h-2 rounded-full bg-[#C21E3A] shadow-[0_0_10px_#C21E3A] animate-pulse" />
                                    </div>
                                    <div className="flex flex-col gap-3 max-w-2xl mx-auto">
                                        {activePoll.options.map((opt: any) => {
                                            const total = activePoll.options.reduce((s: number, o: any) => s + o.votes, 0);
                                            const pct = total === 0 ? 0 : Math.round((opt.votes / total) * 100);
                                            const voted = !!localStorage.getItem(`voted_${activePoll.id}`);
                                            return (
                                                <button key={opt.id} onClick={() => handleVote(opt.id)} disabled={voted}
                                                    className={`relative overflow-hidden rounded-2xl border p-4 md:p-5 transition-all duration-300 text-start ${voted ? 'border-white/[0.07] bg-white/[0.03] cursor-default' : 'border-gold/15 bg-black/40 hover:border-[#C21E3A]/50 hover:-translate-y-0.5'}`}>
                                                    {voted && <span className="absolute top-0 bottom-0 end-0 bg-gradient-to-l from-[#C21E3A]/25 to-transparent transition-all duration-1000" style={{ width: `${pct}%` }} />}
                                                    <span className="relative z-10 flex justify-between items-center gap-3">
                                                        <span className="font-black text-white">{opt.text}</span>
                                                        {voted && <span className="text-sm font-black text-white/60" dir="ltr">{pct}% ({opt.votes})</span>}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <p className="text-center text-[10px] text-white/30 mt-6 font-black tracking-[0.3em] uppercase">{t.pollLive}</p>
                                </div>
                            </Reveal>
                        </section>
                    )}

                    {/* ===== DYNAMIC: SPONSORS + CLIPS ===== */}
                    <section className="pt-12 md:pt-16 grid lg:grid-cols-2 gap-8 items-start">
                        <Reveal><SponsorsSection sponsors={sponsors} /></Reveal>
                        <Reveal delay={100}><ClipsSection clips={clipsList} /></Reveal>
                    </section>

                    <div id="schedule" className="pt-4 scroll-mt-28">
                        {isScheduleActive && <Reveal><ScheduleSection schedule={schedule} /></Reveal>}
                        {isFaqActive && <Reveal><FAQSection faqs={faqs} /></Reveal>}
                    </div>

                    <section className="pt-12 md:pt-16">
                        <Reveal><Suspense fallback={<div className="w-full h-40 rounded-[26px] border border-gold/15 bg-white/[0.02] animate-pulse" />}>
                            <DeferredMount minHeight={180}>
                                <StatsSection lang={lang} onPlay={setMedia} />
                            </DeferredMount>
                        </Suspense></Reveal>
                    </section>

                    {/* ===== FOOTER ===== */}
                    <footer className="mt-16 md:mt-24 rounded-[28px] border border-gold/15 bg-black/85 overflow-hidden relative">
                        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-l from-transparent via-[#C21E3A]/70 to-transparent" />
                        <div className="p-8 md:p-12 text-center relative">
                            <p className="font-gaming text-[18vw] md:text-[120px] leading-none text-stroke opacity-40 select-none" dir="ltr" aria-hidden="true">XLXWI</p>
                            <div className="flex flex-wrap justify-center gap-2.5 -mt-4 md:-mt-8 relative">
                                {socials.slice(0, 6).map(s => (
                                    <a key={s.name} href={s.url} target="_blank" rel="noopener noreferrer" aria-label={s.name}
                                        className="btn-arena w-11 h-11 rounded-xl bg-white/[0.05] border border-gold/15 flex items-center justify-center text-white/60 hover:text-white hover:border-[#C21E3A]/50">
                                        <span className="scale-[0.8] block">{s.icon}</span>
                                    </a>
                                ))}
                            </div>
                            {EMAIL_ADDRESS && (
                                <a href={`mailto:${EMAIL_ADDRESS}`} className="inline-flex items-center gap-2 mt-6 text-white/40 hover:text-white text-xs font-bold transition-colors">
                                    <MailIcon className="w-4 h-4" /> {t.contact}: {EMAIL_ADDRESS}
                                </a>
                            )}
                            <p className="text-[11px] font-black tracking-[0.3em] text-white/50 mt-6 uppercase">{t.poweredBy}</p>
                            <a href={OWN_SITE_URL} target="_blank" rel="noopener noreferrer"
                                className="group mt-3 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-[3px] text-[9.5px] font-bold text-white/45 transition-all duration-300 hover:text-white/85 hover:border-gold/30">
                                <img src={OWN_SITE_ICON} alt="" aria-hidden="true" loading="lazy" className="w-3.5 h-3.5 rounded-[4px] object-cover ring-1 ring-white/10" />
                                <span>{t.ownSite}</span>
                                <span className="text-white/25 group-hover:text-gold/70 transition-colors">· {t.ownSiteBtn}</span>
                            </a>
                            <p className="text-[11px] text-white/35 mt-1">{t.footer}</p>
                        </div>
                    </footer>
                </div>

                {media && (
                    <Suspense fallback={null}>
                        <MediaModal target={media} onClose={() => setMedia(null)} channelSlug={CHANNEL_SLUG} lang={lang} />
                    </Suspense>
                )}
        </div>
    );
}

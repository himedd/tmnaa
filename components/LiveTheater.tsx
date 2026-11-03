import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Language, ChatMessage } from '../types';
import { chatService } from '../services/chatService';
import { StreamPlayer } from './StreamPlayer';
import { ChatWidget } from './Chat';

export interface StreamDetail {
    isLive: boolean;
    viewers: number;
    title: string;
    category: string;
    tags: string[];
    startedAt: number | null;
    language: string;
    isMature: boolean;
    categoryViewers: number;
    categoryTags: string[];
    followers: number;
    subTiers: number;
    verified: boolean;
    chatMode: string;
    slowMode: boolean;
    messageInterval: number;
    followersOnly: boolean;
    subsOnly: boolean;
    emotesOn: boolean;
}

interface LiveTheaterProps {
    lang: Language;
    stream: StreamDetail;
    channelSlug: string;
    updatedAt: number | null;
    onRefresh: () => void;
    onShare: () => void;
}

const AR_LANGS: Record<string, string> = {
    English: 'الإنجليزية', Arabic: 'العربية', Spanish: 'الإسبانية', Portuguese: 'البرتغالية',
    French: 'الفرنسية', German: 'الألمانية', Turkish: 'التركية', Russian: 'الروسية', Italian: 'الإيطالية',
};

/** مدة البث بصيغة HH:MM:SS — تُحسب من لحظة بدء الجلسة التي يرجعها كيك */
const formatUptime = (ms: number): string => {
    const total = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const compact = (n: number, lang: Language): string => {
    if (!n) return '—';
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}${lang === 'ar' ? 'م' : 'M'}`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toLocaleString();
};

const GOLD_FOIL = 'linear-gradient(150deg, #FFF3D6, #E3B341 58%, #B8860B)';

/** خط بياني مصغّر لتغيّر عدد المشاهدين — من العينات الحقيقية التي تجمعها الصفحة */
const Sparkline: React.FC<{ points: number[]; className?: string }> = ({ points, className }) => {
    if (points.length < 2) return null;
    const max = Math.max(...points);
    const min = Math.min(...points);
    const span = max - min || 1;
    const step = 100 / (points.length - 1);
    const d = points.map((v, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(2)},${(26 - ((v - min) / span) * 24).toFixed(2)}`).join(' ');
    return (
        <svg viewBox="0 0 100 28" preserveAspectRatio="none" className={className} aria-hidden="true">
            <path d={`${d} L100,28 L0,28 Z`} fill="url(#sparkFill)" />
            <path d={d} fill="none" stroke="#E3B341" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            <defs>
                <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#E3B341" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#E3B341" stopOpacity="0" />
                </linearGradient>
            </defs>
        </svg>
    );
};

export const LiveTheater: React.FC<LiveTheaterProps> = ({ lang, stream, channelSlug, updatedAt, onRefresh, onShare }) => {
    const tr = lang === 'ar'
        ? {
            live: 'مباشر', uptime: 'مدة البث', viewersNow: 'المشاهدون', catViewers: 'في الفئة',
            followers: 'المتابعون', chatRate: 'رسائل / دقيقة', language: 'لغة البث',
            chatters: 'الفاعلون', room: 'قواعد غرفة الشات', slow: 'وضع بطيء · رسالة كل {n} ث',
            followOnly: 'للمتابعين فقط', subOnly: 'للمشتركين فقط', publicOnly: 'مفتوح للجميع',
            emotes: 'الإيموتات مفعّلة', copy: 'نسخ الرابط', copied: 'تم النسخ', support: 'ادعم البث',
            subscribe: 'اشترك', share: 'مشاركة', tags: 'الوسوم', noTags: 'بلا وسوم',
            updated: 'آخر تحديث قبل {n} ث', never: 'بانتظار البيانات…', mature: '+18', verified: 'حساب موثّق',
            chatTitle: 'الشات الحي', since: 'منذ',
            chatSession: 'نبض الشات', msgsUnit: 'رسالة',
            peakShort: 'ذروة {n}/د', topChatter: 'الأكثر كلاماً', waitingChat: 'بانتظار أول رسالة…',
        }
        : {
            live: 'LIVE', uptime: 'UPTIME', viewersNow: 'VIEWERS', catViewers: 'IN CATEGORY',
            followers: 'FOLLOWERS', chatRate: 'CHAT / MIN', language: 'LANGUAGE',
            chatters: 'ACTIVE CHATTERS', room: 'CHAT ROOM RULES', slow: 'Slow mode · 1 msg / {n}s',
            followOnly: 'Followers only', subOnly: 'Subscribers only', publicOnly: 'Open to everyone',
            emotes: 'Emotes on', copy: 'Copy link', copied: 'Copied', support: 'Support',
            subscribe: 'Subscribe', share: 'Share', tags: 'Tags', noTags: 'No tags',
            updated: 'Updated {n}s ago', never: 'Waiting for data…', mature: '18+', verified: 'Verified',
            chatTitle: 'Live chat', since: 'since',
            chatSession: 'CHAT PULSE', msgsUnit: 'messages',
            peakShort: 'peak {n}/min', topChatter: 'Most talkative', waitingChat: 'Waiting for the first message…',
        };

    const ar = lang === 'ar';

    // نبضة كل ثانية لكل الأرقام الحيّة (مدة البث + عمر آخر جلب)
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, []);

    // مدة البث تعدّ من لحظة البدء التي يرجعها كيك
    const uptime = stream.startedAt ? formatUptime(now - stream.startedAt) : '--:--:--';
    const ageSec = updatedAt ? Math.max(0, Math.round((now - updatedAt) / 1000)) : null;

    // عيّنة كل 20 ثانية ترسم خط المشاهدون (من نفس الجلب الدوري في الصفحة)
    const [history, setHistory] = useState<number[]>([]);
    useEffect(() => {
        setHistory(prev => {
            if (prev[prev.length - 1] === stream.viewers) return prev;
            const next = [...prev, stream.viewers];
            return next.slice(-24);
        });
    }, [stream.viewers]);

    // إحصاءات الشات المحسوبة محلياً من الرسائل الواردة فعلياً
    const [chat, setChat] = useState<{ total: number; rate: number; peak: number; chatters: number; lastAt: number | null; top: string; topCount: number }>({ total: 0, rate: 0, peak: 0, chatters: 0, lastAt: null, top: '', topCount: 0 });
    const stampsRef = useRef<number[]>([]);
    const sendersRef = useRef<Set<string>>(new Set());
    const countsRef = useRef<Map<string, number>>(new Map());

    useEffect(() => {
        const off = chatService.onMessage((msg: ChatMessage) => {
            const nowMs = Date.now();
            const who = msg.user.id || msg.user.username;
            sendersRef.current.add(who);
            const spoken = (countsRef.current.get(who) || 0) + 1;
            countsRef.current.set(who, spoken);
            let top = '';
            let topCount = 0;
            countsRef.current.forEach((c, key) => {
                if (c > topCount) { topCount = c; top = key; }
            });
            const window_ = stampsRef.current.filter(t => nowMs - t <= 60_000);
            window_.push(nowMs);
            stampsRef.current = window_;
            const rate = window_.length;
            setChat(prev => ({
                total: prev.total + 1,
                rate,
                peak: Math.max(prev.peak, rate),
                chatters: sendersRef.current.size,
                lastAt: nowMs,
                top: top === who && spoken > prev.topCount ? msg.user.username : prev.top,
                topCount: spoken > prev.topCount ? spoken : prev.topCount,
            }));
        });
        return () => { off(); };
    }, []);

    useEffect(() => {
        const reset = () => {
            stampsRef.current = [];
            sendersRef.current = new Set();
            countsRef.current = new Map();
            setChat({ total: 0, rate: 0, peak: 0, chatters: 0, lastAt: null, top: '', topCount: 0 });
        };
        reset();
        return reset;
    }, [channelSlug]);

    const [copied, setCopied] = useState(false);
    const copyLink = useCallback(async () => {
        const url = `https://kick.com/${channelSlug}`;
        try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2200);
        } catch {
            onShare();
        }
    }, [channelSlug, onShare]);

    const roomRules = useMemo(() => {
        const list: { label: string; tone: 'gold' | 'navy' | 'muted' }[] = [];
        list.push({ label: stream.slowMode ? tr.slow.replace('{n}', String(stream.messageInterval || 15)) : tr.publicOnly, tone: stream.slowMode ? 'navy' : 'muted' });
        if (stream.subsOnly) list.push({ label: tr.subOnly, tone: 'navy' });
        else if (stream.followersOnly) list.push({ label: tr.followOnly, tone: 'navy' });
        if (stream.emotesOn) list.push({ label: tr.emotes, tone: 'gold' });
        if (stream.subTiers > 0) list.push({ label: `${stream.subTiers} ${ar ? 'مستوى اشتراك' : 'sub tiers'}`, tone: 'gold' });
        return list;
    }, [stream, tr, ar]);

    const lastMsgLabel = chat.lastAt ? `${Math.max(0, Math.round((now - chat.lastAt) / 1000))} ${tr.since}` : '—';

    const tiles: { label: string; value: string; icon: string; accent?: 'gold' }[] = [
        { label: tr.uptime, value: uptime, icon: 'clock', accent: 'gold' },
        { label: tr.viewersNow, value: stream.viewers ? stream.viewers.toLocaleString() : '—', icon: 'eye', accent: 'gold' },
        { label: tr.catViewers, value: compact(stream.categoryViewers, lang), icon: 'grid' },
        { label: tr.followers, value: compact(stream.followers, lang), icon: 'users' },
        { label: tr.chatRate, value: String(chat.rate), icon: 'pulse', accent: chat.rate > 0 ? 'gold' : undefined },
        { label: tr.chatters, value: String(chat.chatters), icon: 'hash' },
    ];

    const ICONS: Record<string, React.ReactNode> = {
        clock: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />,
        eye: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />,
        grid: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />,
        users: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4a3 3 0 01-3-3v-1a4 4 0 014-4h2m5-3a4 4 0 11-8 0 4 4 0 018 0zm4 6a4 4 0 10-8 0" />,
        pulse: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 2L4.09 12.11a1 1 0 00.77 1.64H11l-1 8.25 8.91-10.11a1 1 0 00-.77-1.64H12l1-8.25z" />,
        hash: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 3L8 21m6-18l-2 18M5 8h15M4 16h15" />,
    };

    const statCard = (tile: { label: string; value: string; icon: string; accent?: 'gold' }) => (
        <div key={tile.label}
            className={`relative overflow-hidden rounded-2xl border px-3 py-2.5 transition-colors ${tile.accent === 'gold' ? 'border-gold/30 bg-gold/[0.07]' : 'border-white/[0.07] bg-white/[0.035] hover:border-gold/25'}`}>
            <div className="flex items-center gap-1.5 mb-1">
                <svg className={`w-3.5 h-3.5 shrink-0 ${tile.accent === 'gold' ? 'text-gold-light' : 'text-gold/45'}`} fill="none" viewBox="0 0 24 24">{ICONS[tile.icon]}</svg>
                <p className="text-[8.5px] font-black tracking-[0.16em] uppercase text-white/40" dir={ar ? 'auto' : 'ltr'}>{tile.label}</p>
            </div>
            <p className={`text-[15px] sm:text-[17px] font-black leading-none ${tile.accent === 'gold' ? 'text-gold-light' : 'text-white/85'}`} dir="ltr">{tile.value}</p>
        </div>
    );

    return (
        <div className="relative rounded-[32px] p-[1.5px] bg-gradient-to-b from-gold/55 via-gold/[0.12] to-white/[0.07] shadow-[0_34px_100px_rgba(0,0,0,0.6)]">
            {/* توهّج المسرح — ذهب فوق، برجندوليت تحته */}
            <div className="absolute -inset-4 rounded-[40px] pointer-events-none"
                style={{ background: 'radial-gradient(ellipse 58% 44% at 50% 4%, rgba(227,179,65,0.14) 0%, transparent 70%)' }} />
            <div className="absolute -inset-4 rounded-[40px] pointer-events-none"
                style={{ background: 'radial-gradient(ellipse 46% 40% at 18% 100%, rgba(39,80,127,0.32) 0%, transparent 72%)' }} />

            <div className="relative rounded-[31px] overflow-hidden bg-gradient-to-b from-navy-950/[0.97] via-navy-900/[0.93] to-navy-950/[0.97]">
                {/* ===== شريط الحالة العلوي ===== */}
                <div className="flex items-center gap-2 px-3 md:px-5 py-3 border-b border-gold/[0.14] bg-gradient-to-b from-white/[0.07] to-transparent">
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-black px-3 py-1.5 rounded-full text-navy-950 tracking-[0.18em]"
                        style={{ background: GOLD_FOIL, boxShadow: '0 0 22px rgba(227,179,65,0.5), inset 0 1px 0 rgba(255,255,255,0.5)' }}>
                        <span className="w-1.5 h-1.5 rounded-full bg-navy-900 animate-pulse" />{tr.live}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-black px-3 py-1.5 rounded-full bg-white/[0.05] border border-gold/20 text-gold-light" dir="ltr">
                        <svg className="w-3.5 h-3.5 opacity-70" fill="none" viewBox="0 0 24 24">{ICONS.clock}</svg>
                        {uptime}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-black px-3 py-1.5 rounded-full bg-white/[0.05] border border-gold/15 text-white/80">
                        <svg className="w-3.5 h-3.5 text-gold" fill="none" viewBox="0 0 24 24">{ICONS.eye}</svg>
                        <span dir="ltr">{stream.viewers ? stream.viewers.toLocaleString() : '—'}</span>
                    </span>
                    {stream.isMature && (
                        <span className="hidden sm:inline-flex items-center text-[10px] font-black px-2.5 py-1.5 rounded-full border border-gold/20 text-white/50" dir="ltr">{tr.mature}</span>
                    )}
                    {stream.category && (
                        <span className="hidden md:inline text-[11px] font-bold text-white/40 truncate flex-1">{stream.category}</span>
                    )}
                    <button onClick={onRefresh} dir="ltr"
                        className="ms-auto inline-flex items-center gap-1.5 text-[10px] font-black px-3 py-1.5 rounded-full bg-white/[0.05] border border-white/[0.08] text-white/45 hover:text-gold-light hover:border-gold/40 transition-colors shrink-0">
                        <span className={`w-1 h-1 rounded-full ${ageSec !== null && ageSec < 70 ? 'bg-gold' : 'bg-white/30'} ${ageSec !== null && ageSec < 3 ? 'animate-pulse' : ''}`} />
                        {ageSec === null ? tr.never : tr.updated.replace('{n}', String(ageSec))}
                    </button>
                </div>

                <div className="flex flex-col xl:flex-row">
                    {/* ===== العمود الأيسر: الشاشة والبيانات (يتمدّد طبيعياً بلا قص) ===== */}
                    <div className="flex-1 min-w-0 p-3 md:p-4 flex flex-col">
                        <div className="relative rounded-[22px] p-[1.5px] bg-gradient-to-b from-gold/35 via-white/10 to-transparent shrink-0">
                            <div className="aspect-video rounded-[21px] overflow-hidden bg-black">
                                <StreamPlayer channelSlug={channelSlug} />
                            </div>
                            {/* شرائح عائمة فوق الشاشة */}
                            <div className="absolute top-3 start-3 flex items-center gap-2 pointer-events-none">
                                <span className="inline-flex items-center gap-1.5 text-[10px] font-black px-2.5 py-1 rounded-lg bg-black/65 backdrop-blur border border-gold/45 text-gold-light tracking-widest">
                                    <span className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse shadow-[0_0_10px_#E3B341]" />{tr.live}
                                </span>
                            </div>
                            <div className="absolute bottom-3 end-3 flex items-center gap-2 pointer-events-none">
                                <span className="text-[10px] font-black px-2.5 py-1 rounded-lg bg-black/65 backdrop-blur border border-white/10 text-white/75" dir="ltr">
                                    {stream.viewers ? stream.viewers.toLocaleString() : '—'}
                                </span>
                            </div>
                        </div>

                        {/* العنوان والهوية */}
                        <div className="px-1 md:px-2 pt-4 pb-1 flex flex-col gap-3">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                    <h3 className="text-[17px] md:text-2xl font-black text-white leading-tight" title={stream.title}>{stream.title || tr.never}</h3>
                                    <p className="text-[13px] md:text-sm font-bold mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                                        <span className="nav-wm font-gaming text-[15px] md:text-[17px] tracking-[0.05em]" dir="ltr">TMNAA</span>
                                        {stream.verified && (
                                            <span className="inline-flex items-center gap-1 text-[10px] font-black text-gold/70">
                                                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 1.5l2.5 2.1 3.3-.3.9 3.2 2.8 1.8-1.4 3 1.4 3-2.8 1.8-.9 3.2-3.3-.3L12 22.5l-2.5-2.1-3.3.3-.9-3.2L2.5 15.7l1.4-3-1.4-3 2.8-1.8.9-3.2 3.3.3L12 1.5zm4.1 8.6l-1.3-1.3-4 4-2.5-2.5-1.3 1.3 3.8 3.8 5.3-5.3z" /></svg>
                                                {tr.verified}
                                            </span>
                                        )}
                                        <span className="text-white/25">•</span>
                                        <span dir="auto" className="text-white/55">{stream.category}</span>
                                    </p>
                                </div>
                            </div>

                            {/* شبكة البيانات المحسوبة */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {tiles.map(statCard)}
                            </div>

                            {/* خط المشاهدون + نبض الشات للجلسة */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] px-3 py-2.5 flex items-center gap-3">
                                    <div className="min-w-0">
                                        <p className="text-[8.5px] font-black tracking-[0.16em] uppercase text-white/40">{tr.viewersNow}</p>
                                        <p className="text-[15px] font-black text-gold-light leading-tight mt-0.5" dir="ltr">
                                            {stream.viewers ? stream.viewers.toLocaleString() : '—'}
                                        </p>
                                    </div>
                                    <Sparkline points={history} className="flex-1 h-9 w-full opacity-90" />
                                </div>
                                <div className="rounded-2xl border border-gold/15 bg-gradient-to-br from-gold/[0.07] to-transparent px-3 py-2.5">
                                    <p className="text-[8.5px] font-black tracking-[0.16em] uppercase text-white/40">{tr.chatSession}</p>
                                    <p className="text-[15px] font-black text-gold-light leading-tight mt-0.5" dir="ltr">
                                        {chat.total}
                                        <span className="text-white/35 text-[10px] font-bold ms-1.5">{tr.msgsUnit}</span>
                                        <span className="text-white/30 text-[10px] font-bold ms-2">· {tr.peakShort.replace('{n}', String(chat.peak))}</span>
                                    </p>
                                    <p className="text-[10.5px] font-black text-white/55 mt-1 truncate">
                                        {chat.top
                                            ? <>{tr.topChatter}: <span className="text-gold-light" dir="ltr">{chat.top}</span> <span className="text-white/30" dir="ltr">×{chat.topCount}</span></>
                                            : tr.waitingChat}
                                    </p>
                                </div>
                            </div>

                            {/* أزرار الإجراءات */}
                            <div className="flex flex-wrap items-center gap-2">
                                <a href={`https://kick.com/${channelSlug}`} target="_blank" rel="noopener noreferrer"
                                    className="btn-arena inline-flex items-center gap-2 h-11 px-5 rounded-2xl text-navy-950 text-[13px] font-black"
                                    style={{ background: GOLD_FOIL, boxShadow: '0 14px 30px -12px rgba(227,179,65,0.85), inset 0 1px 0 rgba(255,255,255,0.5)' }}>
                                    <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                                    {ar ? 'شاهد على كيك' : 'Watch on Kick'}
                                </a>
                                <a href="https://kick.com/tmnaa/subscribe" target="_blank" rel="noopener noreferrer"
                                    className="btn-arena inline-flex items-center gap-2 h-11 px-4 rounded-2xl border border-gold/45 text-gold-light text-[13px] font-black hover:bg-gold/10 transition-colors">
                                    <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M12 2.6l2.6 5.5 6 .8-4.4 4.2 1.1 6L12 16.1 6.7 19.1l1.1-6L3.4 8.9l6-.8L12 2.6z" /></svg>
                                    {tr.subscribe}
                                </a>
                                <a href="https://tip.dokan.sa/tmnaa" target="_blank" rel="noopener noreferrer"
                                    className="btn-arena inline-flex items-center gap-2 h-11 px-4 rounded-2xl border border-white/[0.09] bg-white/[0.05] text-white/80 text-[13px] font-black hover:border-gold/40 hover:text-white transition-colors">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                                    {tr.support}
                                </a>
                                <button onClick={copyLink}
                                    className="btn-arena w-11 h-11 rounded-2xl bg-white/[0.05] border border-white/[0.09] text-white/60 hover:text-gold-light hover:border-gold/40 flex items-center justify-center shrink-0 transition-colors"
                                    title={copied ? tr.copied : tr.copy} aria-label={tr.copy}>
                                    {copied
                                        ? <svg className="w-5 h-5 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                        : <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>}
                                </button>
                                <button onClick={onShare}
                                    className="btn-arena w-11 h-11 rounded-2xl bg-white/[0.05] border border-white/[0.09] text-white/60 hover:text-gold-light hover:border-gold/40 flex items-center justify-center shrink-0 transition-colors"
                                    title={tr.share} aria-label={tr.share}>
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 24l-4-4 10-10 4 4L7 24zM17 14l4-4-10-10-4 4 10 10zM3 21l3-3M21 3l-3 3" /></svg>
                                </button>
                            </div>

                            {/* الوسوم + قواعد الشات */}
                            <div className="flex flex-col gap-2.5 pt-3 mt-1 border-t border-white/[0.07]">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-[9px] font-black tracking-[0.18em] uppercase text-gold/50 me-1">{tr.tags}</span>
                                    {(stream.tags.length ? stream.tags : stream.categoryTags).slice(0, 8).map((tag, i) => (
                                        <span key={`${tag}-${i}`} dir="auto"
                                            className="px-2.5 py-1 rounded-lg bg-white/[0.05] border border-white/[0.07] text-white/60 text-[11px] font-bold hover:border-gold/45 hover:text-gold-light transition-colors">
                                            #{tag}
                                        </span>
                                    ))}
                                    {(stream.tags.length ? stream.tags : stream.categoryTags).length === 0 && (
                                        <span className="text-white/30 text-xs italic">{tr.noTags}</span>
                                    )}
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-[9px] font-black tracking-[0.18em] uppercase text-gold/50 me-1">{tr.room}</span>
                                    {roomRules.map(r => (
                                        <span key={r.label} dir="auto"
                                            className={`px-2.5 py-1 rounded-lg text-[11px] font-black border ${r.tone === 'gold' ? 'bg-gold/10 border-gold/35 text-gold-light' : r.tone === 'navy' ? 'bg-navy-800/60 border-white/10 text-white/70' : 'bg-white/[0.04] border-white/[0.07] text-white/45'}`}>
                                            {r.label}
                                        </span>
                                    ))}
                                    {stream.language && (
                                        <span className="px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.07] text-white/55 text-[11px] font-bold">
                                            {tr.language}: {ar ? (AR_LANGS[stream.language] || stream.language) : stream.language}
                                        </span>
                                    )}
                                    {chat.lastAt && (
                                        <span className="px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.07] text-white/55 text-[11px] font-bold" dir="ltr">
                                            {lastMsgLabel}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ===== العمود الأيمن: الشات الحي (ارتفاع محسوم + يلتصق بالمشاهدة) ===== */}
                    <div className="w-full xl:w-[400px] shrink-0 self-start xl:sticky xl:top-[104px] p-3 md:p-4 xl:ps-0">
                        <div className="h-[520px] md:h-[600px] xl:h-[calc(100vh-136px)] xl:min-h-[600px] xl:max-h-[880px] rounded-[22px] overflow-hidden border border-gold/20 bg-navy-950 shadow-[0_24px_70px_rgba(0,0,0,0.55)] flex flex-col min-h-0">
                            <ChatWidget lang={lang} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

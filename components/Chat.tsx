import React, { useState, useEffect, useRef } from 'react';
import { Language, ChatMessage, ChatBadge } from '../types';
import { chatService } from '../services/chatService';

interface ChatWidgetProps {
  lang: Language;
}

// --- شارات الهوية بأيقوناتها، بالأنواع التي تُعرّفها كيك نفسها ---
type BadgeStyle = { ar: string; en: string; cls: string; glyph: React.ReactNode; numbered?: boolean };

/** أيقونات مرسومة بمسار واحد حتى تبقى حادّة عند ١٥ بكسل */
const Glyph: React.FC<{ d: string; stroke?: boolean }> = ({ d, stroke }) => (
  <svg viewBox="0 0 24 24" className="w-[10px] h-[10px]" aria-hidden="true"
    fill={stroke ? 'none' : 'currentColor'} stroke={stroke ? 'currentColor' : 'none'}
    strokeWidth={stroke ? 2.6 : 0} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const G = {
  crown: 'M3 7.2l4.3 3.3L12 4.4l4.7 6.1L21 7.2l-1.6 10.3H4.6L3 7.2zM4.9 19.4h14.2v1.9H4.9v-1.9z',
  hammer: 'M13.7 2.6l7.7 5.6-2.5 3.3-1.9-1.4-7.4 8.2a1.9 1.9 0 01-2.7.2l-1.6-1.4a1.9 1.9 0 01-.2-2.7l7.6-8.3-1.9-1.4 2.9-3.7z',
  shield: 'M12 2.6l7.4 2.9v5.4c0 4.5-3 8-7.4 9.4-4.4-1.4-7.4-4.9-7.4-9.4V5.5L12 2.6z',
  diamond: 'M7.4 3.4h9.2L21 9.2 12 21 3 9.2l4.4-5.8z',
  star: 'M12 3.2l2.7 5.5 6 .9-4.3 4.2 1 6-5.4-2.8-5.4 2.8 1-6L2.3 9.6l6-.9L12 3.2z',
  gift: 'M4 10h16v3.2H4z M5.6 13.2h12.8v7.4H5.6z M12 10v10.6 M12 10C8.8 10 7.4 6.4 9.7 5.1 11.4 4.2 12 6.7 12 10z M12 10c3.2 0 4.6-3.6 2.3-4.9C12.6 4.2 12 6.7 12 10z',
  bolt: 'M13.5 2.4L5 13.8h5.4l-.5 7.8L19 10.2h-5.5z',
  flag: 'M6 3.2v17.6 M6 4.8h12.4l-2.6 4 2.6 4H6',
  user: 'M12 12.4a4.2 4.2 0 100-8.4 4.2 4.2 0 000 8.4z M3.8 20.6a8.2 8.2 0 0116.4 0',
};

const BADGE_STYLES: Record<string, BadgeStyle> = {
  broadcaster: {
    ar: 'المالك', en: 'OWNER', numbered: false,
    cls: 'text-navy-950 border-transparent bg-gradient-to-b from-[#FFF3D6] via-[#E3B341] to-[#B8860B] shadow-[0_0_10px_rgba(227,179,65,0.45)]',
    glyph: <Glyph d={G.crown} />,
  },
  moderator: {
    ar: 'مشرف', en: 'MOD',
    cls: 'text-[#DFF1FF] border-[#5AA9FF]/55 bg-gradient-to-b from-[#5AA9FF]/45 to-[#1C63A8]/55 shadow-[0_0_10px_rgba(90,169,255,0.35)]',
    glyph: <Glyph d={G.hammer} />,
  },
  staff: {
    ar: 'فريق كيك', en: 'STAFF',
    cls: 'text-[#EAF6FF] border-[#4FC3F7]/55 bg-gradient-to-b from-[#4FC3F7]/40 to-[#0B72A8]/55',
    glyph: <Glyph d={G.shield} />,
  },
  op: {
    ar: 'مشرف عام', en: 'OP',
    cls: 'text-[#F0E8FF] border-[#A78BFA]/55 bg-gradient-to-b from-[#A78BFA]/40 to-[#5B34A8]/55',
    glyph: <Glyph d={G.diamond} />,
  },
  vip: {
    ar: 'VIP', en: 'VIP',
    cls: 'text-[#FFE6F3] border-[#F542A8]/60 bg-gradient-to-b from-[#F542A8]/45 to-[#8E0F55]/55 shadow-[0_0_10px_rgba(245,66,168,0.3)]',
    glyph: <Glyph d={G.diamond} />,
  },
  og: {
    ar: 'OG', en: 'OG',
    cls: 'text-gold-pale border-gold/60 bg-gradient-to-b from-gold/40 to-[#7A5405]/60 shadow-[0_0_10px_rgba(227,179,65,0.3)]',
    glyph: <Glyph d={G.star} />,
  },
  founder: {
    ar: 'مؤسس', en: 'FOUNDER',
    cls: 'text-gold-pale border-gold-deep/65 bg-gradient-to-b from-[#C9A227]/45 to-[#5C3D05]/60',
    glyph: <Glyph d={G.shield} />,
  },
  kick_founder22: {
    ar: 'مؤسس ٢٢', en: 'FOUNDER 22',
    cls: 'text-gold-pale border-gold-deep/65 bg-gradient-to-b from-[#C9A227]/45 to-[#5C3D05]/60',
    glyph: <Glyph d={G.crown} />,
  },
  kick_whale: {
    ar: 'حوت', en: 'WHALE',
    cls: 'text-[#D6F5FF] border-[#38BDF8]/50 bg-gradient-to-b from-[#38BDF8]/35 to-[#0C4A6E]/55',
    glyph: <Glyph d={G.diamond} />,
  },
  sidekick: {
    ar: 'مساعد مجتمع', en: 'SIDEKICK',
    cls: 'text-[#DCFCE7] border-emerald-300/50 bg-gradient-to-b from-emerald-400/35 to-emerald-800/55',
    glyph: <Glyph d={G.shield} />,
  },
  sub_gifter: {
    ar: 'هدية اشتراك', en: 'GIFTER',
    cls: 'text-gold-light border-gold/45 bg-gradient-to-b from-gold/25 to-navy-800/70',
    glyph: <Glyph d={G.gift} stroke />,
  },
  kicks_gifter: {
    ar: 'هدية كيكس', en: 'KICKS GIFTER',
    cls: 'text-gold-light border-gold/45 bg-gradient-to-b from-gold/25 to-navy-800/70',
    glyph: <Glyph d={G.gift} stroke />,
  },
  subscriber: {
    ar: 'مشترك', en: 'SUB', numbered: true,
    cls: 'text-navy-950 border-transparent bg-gradient-to-b from-[#F7E3AE] via-[#E3B341] to-[#B8860B]',
    glyph: <Glyph d={G.diamond} />,
  },
  verified: {
    ar: 'موثّق', en: 'VERIFIED',
    cls: 'text-[#E7FFF1] border-emerald-300/60 bg-gradient-to-b from-[#34D399]/50 to-[#047857]/60 shadow-[0_0_10px_rgba(52,211,153,0.35)]',
    glyph: <Glyph d="M4.5 12.8l5 5L19.5 6.6" stroke />,
  },
  bot: {
    ar: 'بوت', en: 'BOT',
    cls: 'text-[#DFF1FF] border-[#3FA9FF]/55 bg-gradient-to-b from-[#3FA9FF]/40 to-[#0F4C7F]/60',
    glyph: <Glyph d={G.bolt} />,
  },
  level: {
    ar: 'المستوى', en: 'LEVEL', numbered: true,
    cls: 'text-gold-light border-gold/35 bg-navy-800/80',
    glyph: <Glyph d={G.star} />,
  },
  early_follower: {
    ar: 'متابع مبكر', en: 'EARLY',
    cls: 'text-white/80 border-white/25 bg-white/[0.09]',
    glyph: <Glyph d={G.flag} stroke />,
  },
  chat_identity: {
    ar: 'هوية الدردشة', en: 'IDENTITY',
    cls: 'text-white/70 border-white/20 bg-white/[0.07]',
    glyph: <Glyph d={G.user} stroke />,
  },
};

/** أي نوع جديد يرسله كيك يظهر كنجمة بدل ما يضيع */
const FALLBACK_BADGE: BadgeStyle = {
  ar: 'شارة', en: 'BADGE',
  cls: 'text-white/60 border-white/15 bg-white/[0.06]',
  glyph: <Glyph d={G.star} />,
};

const BOT_COLOR = '#3FA9FF';
const isBotMessage = (msg: ChatMessage): boolean => !!msg.badges?.some(b => b.type === 'bot');

const INITIAL_MESSAGES: ChatMessage[] = [];

/** سقف الصيانة داخل الذاكرة — الأقدم يخرج أولاً حتى يبقى الصندوق خفيفاً وثابت الارتفاع */
const MAX_MESSAGES = 50;

const initialOf = (name: string): string => {
  const trimmed = (name || '').trim();
  return trimmed ? [...trimmed][0].toUpperCase() : '؟';
};

const MONOGRAM_BG: Record<string, string> = {
  owner: 'linear-gradient(150deg, #FFF3D6, #E3B341 58%, #B8860B)',
  moderator: 'linear-gradient(150deg, #D1FAE5, #34D399 58%, #059669)',
  vip: 'linear-gradient(150deg, #FFD9EC, #F542A8 60%, #B3146F)',
  bot: 'linear-gradient(150deg, #CFEBFF, #3FA9FF 55%, #0F6FBF)',
  user: 'linear-gradient(150deg, #142C4C, #071120)',
};

const ROW_STYLE: Record<string, string> = {
  owner: 'bg-gold/[0.09] border-gold/30 hover:bg-gold/[0.13]',
  moderator: 'bg-emerald-400/[0.055] border-emerald-300/20 hover:bg-emerald-400/[0.09]',
  vip: 'bg-[#F542A8]/[0.06] border-[#F542A8]/25 hover:bg-[#F542A8]/[0.1]',
  user: 'bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.06]',
};

/** البوت يستحق تمييزاً بارداً حتى لا يُخلط مع جمهور القناة */
const BOT_ROW = 'bg-[#3FA9FF]/[0.07] border-[#3FA9FF]/25 hover:bg-[#3FA9FF]/[0.11]';

export const ChatWidget: React.FC<ChatWidgetProps> = ({ lang }) => {
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(false);
  const [statusText, setStatusText] = useState('');
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);

  const t = {
    title: lang === 'en' ? 'Live Chat' : 'شات البث المباشر',
    online: lang === 'en' ? 'LIVE NOW' : 'مباشر الآن',
    connecting: lang === 'en' ? 'Connecting...' : 'جارِ الاتصال...',
    connected: lang === 'en' ? 'Live' : 'متصل',
    waitingMsgs: lang === 'en' ? 'waiting for messages' : 'بانتظار الرسائل',
    error: lang === 'en' ? 'Connection Issue' : 'مشكلة اتصال',
    retry: lang === 'en' ? 'Retry' : 'إعادة المحاولة',
    empty: lang === 'en' ? 'Chat is warming up… be the first to hype!' : 'الشات يسخن… كن أول من يولع الأجواء!',
    join: lang === 'en' ? 'Join chat on Kick' : 'شارك في الشات على Kick',
    scrollDown: lang === 'en' ? 'New messages' : 'رسائل جديدة',
    msgs: lang === 'en' ? 'MESSAGES' : 'الرسائل',
    perMin: lang === 'en' ? 'PER MIN' : 'في الدقيقة',
    active: lang === 'en' ? 'ACTIVE' : 'فاعلون',
    downTitle: lang === 'en' ? 'Kick chat is unreachable right now' : 'شات كيك غير متاح حالياً',
    downHint: lang === 'en' ? 'The realtime chat server refused the handshake. You can still chat on Kick — the widget retries by itself.' : 'سيرفر الشات الحي رفض الاتصال. تقدر تتشاتب على كيك مباشرة، والودجت يعيد المحاولة لحاله.',
    autoRetry: lang === 'en' ? `auto-retry in ${'{n}'}s` : `إعادة تلقائية بعد {n} ث`,
    openChat: lang === 'en' ? 'Open chat on Kick' : 'افتح الشات على كيك',
    now: lang === 'en' ? 'now' : 'الآن',
    secsAgo: lang === 'en' ? '{n}s ago' : 'قبل {n} ث',
    minsAgo: lang === 'en' ? '{n}m ago' : 'قبل {n} د',
  };

  const [showJump, setShowJump] = useState(false);
  const [errorSeq, setErrorSeq] = useState(0);
  const [retryIn, setRetryIn] = useState<number | null>(null);

  // عدّاد الجلسة: يواصل الجمع حتى بعد قصّ القائمة عند 50 — الأرقام لا تتجمّد
  const stampsRef = useRef<number[]>([]);
  const sendersRef = useRef<Set<string>>(new Set());
  const [session, setSession] = useState({ total: 0, perMin: 0, senders: 0 });

  useEffect(() => {
    // 1. Listen for new messages
    const unbindMessage = chatService.onMessage((msg) => {
      const nowMs = Date.now();
      sendersRef.current.add(msg.user.id || msg.user.username);
      stampsRef.current = [...stampsRef.current.filter(s => nowMs - s <= 60_000), nowMs];
      setSession(prev => ({
        total: prev.total + 1,
        perMin: stampsRef.current.length,
        senders: sendersRef.current.size,
      }));

      setMessages(prev => {
        if (prev.some(m => m.id === msg.id)) return prev;
        const next = [...prev, msg];
        return next.length > MAX_MESSAGES ? next.slice(-MAX_MESSAGES) : next;
      });
    });

    // 2. Listen for deleted messages
    const unbindDelete = chatService.onDeleteMessage((msgId) => {
      setMessages(prev => prev.filter(m => m.id !== msgId));
    });

    // 3. Listen for status changes
    const unbindStatus = chatService.onStatusChange((connected, error, details) => {
      setIsConnected(connected);
      setConnectionError(error);
      setStatusText(details || '');
      if (error) setErrorSeq(n => n + 1);
    });

    // 4. Connect to the channel
    chatService.connect('tmnaa');

    // 5. Cleanup
    return () => {
      unbindMessage();
      unbindDelete();
      unbindStatus();
      chatService.disconnect();
    };
  }, []);

  // إعادة المحاولة تلقائياً بدل ما يعلق القسم على خطأ واحد
  useEffect(() => {
    if (!connectionError) { setRetryIn(null); return; }
    let seconds = 12;
    setRetryIn(seconds);
    const tick = setInterval(() => {
      seconds -= 1;
      setRetryIn(seconds);
      if (seconds <= 0) { clearInterval(tick); chatService.connect('tmnaa'); }
    }, 1000);
    return () => clearInterval(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionError, errorSeq]);

  // Auto-scroll — locked inside the box only, instant (no smooth freeze on flood)
  const handleScroll = () => {
    const el = chatContainerRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    stickToBottomRef.current = nearBottom;
    setShowJump(!nearBottom && messages.length > 3);
  };

  useEffect(() => {
    const el = chatContainerRef.current;
    if (!el) return;
    if (stickToBottomRef.current || messages.length <= 5) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  const jumpToBottom = () => {
    const el = chatContainerRef.current;
    if (!el) return;
    stickToBottomRef.current = true;
    setShowJump(false);
    el.scrollTop = el.scrollHeight;
  };

  const renderBadges = (badges?: ChatBadge[]) => {
    if (!badges?.length) return null;
    return badges.map((b, i) => {
      const style = BADGE_STYLES[b.type] || FALLBACK_BADGE;
      const name = lang === 'ar' ? style.ar : style.en;
      const months = b.version || b.text;
      const tip = style.numbered && months ? `${name} · ${months}` : name;
      return (
        <span key={`${b.type}-${i}`} title={tip} aria-label={tip}
          className={`inline-flex items-center justify-center shrink-0 w-[15px] h-[15px] rounded-[5px] border leading-none ${style.cls}`}>
          {style.numbered && months ? <span className="text-[8px] font-black" dir="ltr">{months}</span> : style.glyph}
        </span>
      );
    });
  };

  const renderMessage = (content: string) => {
    if (!content) return null;

    // Regex to match Kick emotes: [emote:ID:NAME]
    const emoteRegex = /\[emote:(\d+):([\w\s\-]+)\]/gi;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = emoteRegex.exec(content)) !== null) {
      // Add text before the emote
      if (match.index > lastIndex) {
        parts.push(content.substring(lastIndex, match.index));
      }

      const emoteId = match[1];
      const emoteName = match[2];
      const emoteUrl = `https://files.kick.com/emotes/${emoteId}/fullsize`;

      parts.push(
        <img
          key={`${match.index}-${emoteId}`}
          src={emoteUrl}
          alt={emoteName}
          title={emoteName}
          loading="lazy"
          className="inline-block w-7 h-7 md:w-8 md:h-8 mx-0.5 -mt-1 align-middle object-contain"
        />
      );

      lastIndex = emoteRegex.lastIndex;
    }

    // Add remaining text
    if (lastIndex < content.length) {
      parts.push(content.substring(lastIndex));
    }

    return parts.length > 0 ? parts : content;
  };

  // مؤشرات الجلسة — تتحدّث كل 5 ثواني، ونافذة الدقيقة تتآكل حتى بلا رسائل جديدة
  const [tick, setTick] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => {
      const nowMs = Date.now();
      setTick(nowMs);
      const live = stampsRef.current.filter(s => nowMs - s <= 60_000);
      stampsRef.current = live;
      setSession(prev => (prev.perMin === live.length ? prev : { ...prev, perMin: live.length }));
    }, 5000);
    return () => clearInterval(id);
  }, []);
  const metrics = session;
  const agoLabel = (ts?: number): string => {
    if (!ts) return '';
    const s = Math.max(0, Math.round((tick - ts) / 1000));
    if (s < 10) return t.now;
    if (s < 60) return t.secsAgo.replace('{n}', String(s));
    return t.minsAgo.replace('{n}', String(Math.floor(s / 60)));
  };

  const metricCells = [
    { label: t.msgs, value: `${metrics.total}` },
    { label: t.perMin, value: metrics.perMin },
    { label: t.active, value: metrics.senders },
  ];

  return (
    <div className="flex flex-col h-full max-h-full min-h-0 w-full bg-gradient-to-b from-navy-900 via-navy-950 to-navy-900 overflow-hidden relative isolate">
      {/* top red energy line */}
      <div className="absolute top-0 inset-x-8 h-[2px] rounded-full bg-gradient-to-l from-transparent via-[#E3B341] to-transparent shadow-[0_0_12px_#E3B341] z-30 pointer-events-none" />
      {/* ambient glow */}
      <div className="absolute -top-16 -end-16 w-48 h-48 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(227,179,65,0.11) 0%, transparent 68%)' }} />
      <div className="absolute -bottom-20 -start-16 w-48 h-48 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(39,80,127,0.45) 0%, transparent 68%)' }} />

      {/* --- Premium Header --- */}
      <div className="shrink-0 z-20 bg-gradient-to-b from-white/[0.07] to-white/[0.02] border-b border-white/[0.07] backdrop-blur-md">
        <div className="flex items-center gap-3 px-4 pt-3.5 pb-3">
          <div className="relative shrink-0">
            <div className="flex items-center justify-center w-10 h-10 rounded-2xl bg-gradient-to-b from-[#FFF3D6] via-[#E3B341] to-[#B8860B] text-navy-950 shadow-[0_0_20px_rgba(227,179,65,0.45)]">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <span className={`absolute -bottom-0.5 -end-0.5 w-3 h-3 rounded-full border-2 border-navy-950 ${isConnected ? 'bg-gold live-dot' : connectionError ? 'bg-red-500' : 'bg-yellow-400 animate-pulse'}`} />
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className={`text-white font-black tracking-tight text-[15px] ${lang === 'ar' ? 'font-arabic' : ''}`}>{t.title}</span>
              {isConnected && (
                <span className="inline-flex items-center gap-1 text-[9px] font-black px-2 py-[3px] rounded-full bg-gold/15 border border-gold/45 text-gold-light tracking-[0.14em]">
                  <span className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse" />{t.online}
                </span>
              )}
            </div>
            <span className="text-[11px] text-white/40 font-bold">
              {isConnected
                ? (metrics.total ? `${metrics.total} • ${t.connected}` : `${t.connected} • ${t.waitingMsgs}`)
                : connectionError
                  ? `${t.error}${retryIn !== null ? ` • ${retryIn}s` : ''}`
                  : (statusText || t.connecting)}
            </span>
          </div>
          {connectionError ? (
            <button
              onClick={() => chatService.connect('tmnaa')}
              className="shrink-0 px-3 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-gold/15 text-white/70 hover:text-white transition-colors text-xs font-black flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              {t.retry}
            </button>
          ) : (
            <a
              href="https://kick.com/tmnaa/chatroom"
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 w-9 h-9 rounded-xl bg-white/[0.05] border border-gold/15 text-white/50 hover:text-white hover:border-[#E3B341]/50 hover:bg-[#E3B341]/10 transition-all flex items-center justify-center"
              title="Kick"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
            </a>
          )}
        </div>
      </div>

      {/* --- شريط المؤشرات المحسوبة --- */}
      <div className="shrink-0 z-10 grid grid-cols-3 gap-px bg-white/[0.07] border-b border-white/[0.07]">
        {metricCells.map(cell => (
          <div key={cell.label} className="bg-navy-950/75 px-2 py-2 text-center">
            <p className="text-[8px] font-black tracking-[0.14em] uppercase text-white/35">{cell.label}</p>
            <p className="text-[13px] font-black text-gold-light leading-tight mt-0.5" dir="ltr">{cell.value}</p>
          </div>
        ))}
      </div>

      {/* --- Chat List (fixed height, internal scroll only, beautiful bar) --- */}
      <div className="relative flex-1 min-h-0 flex flex-col">
        <div
          ref={chatContainerRef}
          onScroll={handleScroll}
          className="theater-scroll flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 py-3 space-y-2 [overflow-anchor:none]"
        >
          {messages.length === 0 && connectionError ? (
            <div className="h-full min-h-[280px] flex flex-col items-center justify-center text-center gap-4 px-6">
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl bg-gold/[0.08] border border-gold/30 flex items-center justify-center">
                  <svg className="w-8 h-8 text-gold/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.111 14.048a9.94 9.94 0 01-1.117-3.989m-1.404 7.405a12.045 12.045 0 01-1.516-6.677m14.55 11.573a10.041 10.041 0 01-3.774.944m5.076-7.216a12.045 12.045 0 00-2.721-6.484M12 3a9 9 0 100 18 9 9 0 000-18z" />
                    <path strokeLinecap="round" d="M4 4l16 16" />
                  </svg>
                </div>
                <span className="absolute -bottom-1 -end-1 w-5 h-5 rounded-full bg-navy-950 border border-gold/40 flex items-center justify-center">
                  <span className="w-2 h-2 rounded-full bg-gold animate-pulse" />
                </span>
              </div>
              <div>
                <p className={`text-[13.5px] font-black text-white/80 ${lang === 'ar' ? 'font-arabic' : ''}`}>{t.downTitle}</p>
                <p className={`text-[11.5px] font-bold text-white/40 leading-relaxed mt-1.5 max-w-[240px] mx-auto ${lang === 'ar' ? 'font-arabic' : ''}`}>{t.downHint}</p>
              </div>
              <a href="https://kick.com/tmnaa/chatroom" target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-[12px] font-black px-4 py-2.5 rounded-xl text-navy-950 hover:brightness-110 active:scale-[0.98] transition-all"
                style={{ background: 'linear-gradient(150deg, #FFF3D6, #E3B341 58%, #B8860B)', boxShadow: '0 10px 24px -10px rgba(227,179,65,0.8)' }}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                {t.openChat}
              </a>
              {retryIn !== null && (
                <p className="text-[10.5px] font-black text-gold/60 tracking-wide" dir="ltr">
                  {t.autoRetry.replace('{n}', String(Math.max(0, retryIn)))}
                </p>
              )}
            </div>
          ) : messages.length === 0 ? (
            <div className="h-full min-h-[280px] flex flex-col items-center justify-center text-center gap-3 px-6">
              <div className="w-14 h-14 rounded-2xl bg-white/[0.05] border border-gold/15 flex items-center justify-center">
                <svg className="w-7 h-7 text-white/25" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <p className={`text-[13px] font-bold text-white/40 leading-relaxed ${lang === 'ar' ? 'font-arabic' : ''}`}>{t.empty}</p>
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#E3B341]/70 animate-bounce" />
                <span className="w-1.5 h-1.5 rounded-full bg-[#E3B341]/70 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-[#E3B341]/70 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          ) : (
            messages.map((msg) => {
              const bot = isBotMessage(msg);
              const nameColor = bot ? BOT_COLOR : (msg.user.color || '#F7E3AE');
              return (
                <div key={msg.id}
                  className={`chat-msg group flex items-start gap-2 py-2 px-2.5 rounded-2xl border min-w-0 overflow-hidden transition-colors ${bot ? BOT_ROW : ROW_STYLE[msg.role] || ROW_STYLE.user}`}>
                  <span
                    className="shrink-0 mt-0.5 w-[26px] h-[26px] rounded-xl border border-white/10 flex items-center justify-center text-[11px] font-black leading-none shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]"
                    style={{
                      background: MONOGRAM_BG[bot ? 'bot' : msg.role] || MONOGRAM_BG.user,
                      color: msg.role === 'owner' && !bot ? '#071120' : '#FFFFFF',
                    }}
                  >
                    {initialOf(msg.user.username)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {renderBadges(msg.badges)}
                      <span className="font-black text-[12.5px] truncate min-w-0 hover:underline cursor-pointer"
                        style={{ color: nameColor }} dir="ltr" title={msg.user.username}>
                        {msg.user.username}
                      </span>
                      <span className="ms-auto shrink-0 text-[9px] font-bold text-white/25 opacity-0 group-hover:opacity-100 transition-opacity">
                        {agoLabel(msg.timestamp)}
                      </span>
                    </div>
                    <p className={`leading-relaxed text-[13px] md:text-[13.5px] break-words [overflow-wrap:anywhere] text-white/75 font-medium mt-0.5 ${lang === 'ar' ? 'font-arabic' : ''}`}>
                      {renderMessage(msg.content)}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* jump to latest */}
        {showJump && (
          <button
            onClick={jumpToBottom}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 inline-flex items-center gap-1.5 text-[11px] font-black px-3.5 py-2 rounded-full bg-[#E3B341] text-black shadow-[0_8px_24px_rgba(227,179,65,0.5)] hover:brightness-110 active:scale-95 transition-all animate-fade-in-up"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
            {t.scrollDown}
          </button>
        )}

        {/* fade masks */}
        <div className="absolute top-0 inset-x-0 h-6 bg-gradient-to-b from-navy-950 to-transparent pointer-events-none" />
        <div className="absolute bottom-0 inset-x-0 h-6 bg-gradient-to-t from-navy-950 to-transparent pointer-events-none" />
      </div>

      {/* --- Beautiful bottom action bar --- */}
      <div className="shrink-0 z-20 p-3 bg-gradient-to-t from-black/60 to-transparent border-t border-white/[0.06]">
        <a
          href="https://kick.com/tmnaa"
          target="_blank"
          rel="noopener noreferrer"
          className="group relative flex items-center justify-center gap-2 w-full py-3 rounded-2xl bg-gradient-to-b from-[#FFF3D6] via-[#E3B341] to-[#B8860B] text-navy-950 font-black text-[13px] shadow-[0_10px_28px_-8px_rgba(227,179,65,0.7)] hover:brightness-110 hover:-translate-y-px active:translate-y-0 active:scale-[0.99] transition-all overflow-hidden"
        >
          <span className="absolute inset-0 bg-gradient-to-l from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 pointer-events-none" />
          <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
          <span className={lang === 'ar' ? 'font-arabic' : ''}>{t.join}</span>
        </a>
      </div>
    </div>
  );
};

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BotrixLeaderboard } from '@/components/sections/BotrixLeaderboardSection';
import { ClipModal } from '@/components/sections/ClipModal';
import { VodModal } from '@/components/sections/VodModal';
import { kickFetch } from '@/lib/kickApi';
import { ModeratorsSection } from '@/components/sections/ModeratorsSection';
import type { ChannelInfo, LeaderboardData, LeaderboardEntry, Clip, Video } from '@/lib/types';

const easeOut = [0.22, 1, 0.36, 1] as const;
const CHANNEL_SLUG = 'tmnaa';
const FALLBACK_IMAGE = 'https://files.kick.com/images/user/1106194/profile_image/conversion/140c7236-24f9-4267-b318-6be659f6035e-fullsize.webp';

const formatNumber = (num: number) =>
  new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(num || 0);

function Skeleton({ className }: { className: string }) {
  return <div className={`bg-white/5 animate-pulse rounded-xl ${className}`} />;
}

function DiamondIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} strokeWidth="0">
      <defs>
        <linearGradient id="diamondGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FDE68A" />
          <stop offset="100%" stopColor="#D97706" />
        </linearGradient>
      </defs>
      <path stroke="url(#diamondGrad)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
      <path fill="url(#diamondGrad)" fillOpacity="0.15" d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
    </svg>
  );
}

function FlameIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} strokeWidth="0">
      <defs>
        <linearGradient id="flameGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FDA4AF" />
          <stop offset="100%" stopColor="#E11D48" />
        </linearGradient>
      </defs>
      <path stroke="url(#flameGrad)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
      <path stroke="url(#flameGrad)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1.001A3.75 3.75 0 0012 18z" />
      <path fill="url(#flameGrad)" fillOpacity="0.1" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
    </svg>
  );
}

function StarIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} strokeWidth="0">
      <defs>
        <linearGradient id="starGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#67E8F9" />
          <stop offset="100%" stopColor="#06B6D4" />
        </linearGradient>
      </defs>
      <path stroke="url(#starGrad)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
      <path fill="url(#starGrad)" fillOpacity="0.1" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
    </svg>
  );
}

interface CardConfig {
  glow: string;
  text: string;
  bgIcon: string;
  gradient: string;
  subText: string;
  border: string;
  line: string;
}

const configs: Record<string, CardConfig> = {
  yellow: {
    glow: 'shadow-[0_0_60px_-15px_rgba(234,179,8,0.2)]',
    text: 'text-yellow-400',
    bgIcon: 'bg-yellow-500/10',
    gradient: 'from-yellow-400 to-amber-600',
    subText: 'text-yellow-200/50',
    border: 'border-yellow-500/20',
    line: 'bg-yellow-400/80',
  },
  rose: {
    glow: 'shadow-[0_0_60px_-15px_rgba(225,29,72,0.2)]',
    text: 'text-rose-400',
    bgIcon: 'bg-rose-500/10',
    gradient: 'from-rose-400 to-red-600',
    subText: 'text-rose-200/50',
    border: 'border-rose-500/20',
    line: 'bg-rose-400/80',
  },
  cyan: {
    glow: 'shadow-[0_0_60px_-15px_rgba(6,182,212,0.2)]',
    text: 'text-cyan-400',
    bgIcon: 'bg-cyan-500/10',
    gradient: 'from-cyan-400 to-blue-600',
    subText: 'text-cyan-200/50',
    border: 'border-cyan-500/20',
    line: 'bg-cyan-400/80',
  },
};

function LeaderboardCard({ title, subtitle, data, icon, accentColor, isMain, delay, emptyLabel }: {
  title: string; subtitle: string; data: LeaderboardEntry[]; icon: React.ReactNode;
  accentColor: 'yellow' | 'rose' | 'cyan'; isMain?: boolean; delay: number; emptyLabel: string;
}) {
  const config = configs[accentColor];

  const renderRank = (rank: number) => {
    if (rank === 1) return <div className="w-8 h-8 rounded-full flex items-center justify-center bg-gradient-to-br from-[#FFD700] to-[#FDB931] shadow-[0_0_20px_rgba(255,215,0,0.6)] border-2 border-[#FFFACD]/60 text-black font-black text-sm shrink-0">1</div>;
    if (rank === 2) return <div className="w-7 h-7 rounded-full flex items-center justify-center bg-gradient-to-br from-[#E0E0E0] to-[#BDBDBD] shadow-[0_0_15px_rgba(192,192,192,0.4)] border-2 border-white/60 text-black font-black text-xs shrink-0">2</div>;
    if (rank === 3) return <div className="w-6 h-6 rounded-full flex items-center justify-center bg-gradient-to-br from-[#E6A373] to-[#8B4513] shadow-[0_0_15px_rgba(205,127,50,0.4)] border-2 border-[#FFDAB9]/40 text-white font-black text-[10px] shrink-0">3</div>;
    return <span className="w-6 text-center text-xs font-bold text-white/25 font-mono shrink-0">{rank < 10 ? `0${rank}` : rank}</span>;
  };

  if (!data || data.length === 0) {
    return (
      <motion.div initial={{ y: 40, opacity: 0 }} whileInView={{ y: 0, opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.7, delay: delay * 0.001 }}
        className={`relative flex flex-col items-center justify-center p-8 text-center rounded-[32px] overflow-hidden bg-black/60 backdrop-blur-lg border ${config.border} min-h-[250px] md:min-h-[380px] ${isMain ? 'md:-mt-8 z-10 md:min-h-[440px]' : ''}`}>
        <div className={`p-4 rounded-full ${config.bgIcon} mb-4 ring-1 ring-white/5`}>
          {icon}
        </div>
        <h3 className={`text-sm font-bold text-white/60 mb-1 uppercase tracking-[0.2em]`}>{title}</h3>
        <p className={`text-[10px] ${config.subText} font-medium`}>{emptyLabel}</p>
      </motion.div>
    );
  }

  const sorted = [...data].sort((a, b) => b.quantity - a.quantity).slice(0, 10);

  return (
    <motion.div initial={{ y: 40, opacity: 0 }} whileInView={{ y: 0, opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.7, delay: delay * 0.001 }}
      className={`group relative flex flex-col rounded-[24px] md:rounded-[32px] overflow-hidden transition-all duration-700 bg-[#050505]/80 backdrop-blur-lg border ${config.border} ${config.glow} hover:border-white/20 ${isMain ? 'md:-mt-8 z-20 md:scale-105 shadow-2xl ring-1 ring-white/10' : 'shadow-xl'}`}>
      <div className={`absolute top-0 left-0 right-0 h-24 md:h-32 bg-gradient-to-b ${config.bgIcon.replace('bg-', 'from-').replace('/10', '/20')} to-transparent pointer-events-none opacity-40 blur-3xl`} />
      <div className={`absolute top-0 left-0 right-0 h-0.5 ${config.line}`} />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[300px] h-[150px] bg-white/5 blur-[100px] pointer-events-none rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />

      <div className={`relative p-4 md:p-6 flex flex-col items-center justify-center text-center border-b ${config.border} z-10`}>
        <div className={`w-10 h-10 md:w-14 md:h-14 mb-2 md:mb-3 rounded-2xl flex items-center justify-center bg-gradient-to-br from-white/10 to-transparent border border-white/10 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.5)] group-hover:scale-110 transition-transform duration-500`}>
          {icon}
        </div>
        <div>
          <h3 className="text-base md:text-2xl font-black text-white tracking-tight leading-none mb-0.5 md:mb-1">{title}</h3>
          <span className={`text-[8px] md:text-[10px] font-bold uppercase tracking-[0.2em] md:tracking-[0.3em] bg-gradient-to-r ${config.gradient} bg-clip-text text-transparent opacity-80`}>{subtitle}</span>
        </div>
      </div>

      <div className={`flex-1 p-2 md:p-3 space-y-1.5 md:space-y-2 relative overflow-y-auto overflow-x-hidden max-h-[300px] md:max-h-[400px] premium-scroll`}
        style={{
          '--scr-from': accentColor === 'yellow' ? 'rgba(234,179,8,0.4)' : accentColor === 'rose' ? 'rgba(225,29,72,0.4)' : 'rgba(6,182,212,0.4)',
          '--scr-to': accentColor === 'yellow' ? 'rgba(234,179,8,0.15)' : accentColor === 'rose' ? 'rgba(225,29,72,0.15)' : 'rgba(6,182,212,0.15)',
        } as React.CSSProperties}>
        {sorted.map((entry, idx) => {
          const isTop3 = idx < 3;
          return (
            <div key={idx} className={`relative flex items-center justify-between p-2 md:p-3.5 rounded-xl md:rounded-2xl transition-all duration-300 group/row ${isTop3 ? 'bg-gradient-to-r from-white/[0.04] to-transparent border border-white/5' : 'hover:bg-white/[0.02] border border-transparent'}`}>
              <div className="flex items-center gap-2 md:gap-4 min-w-0">
                <div className="shrink-0 flex justify-center w-6 md:w-8">{renderRank(idx + 1)}</div>
                <div className="flex flex-col min-w-0">
                  <span className={`text-sm md:text-base font-bold truncate transition-colors ${idx === 0 ? 'text-white drop-shadow-lg' : 'text-white/95 group-hover/row:text-white'} leading-tight`}>{entry.username}</span>
                  {isTop3 && <div className="hidden md:block h-0.5 w-10 rounded-full bg-gradient-to-r from-white/20 to-transparent mt-0.5" />}
                </div>
              </div>
              <div className="flex items-center gap-1.5 md:gap-2 pl-2.5 md:pl-3 bg-black/40 rounded-lg px-2.5 md:px-3 py-1.5 border border-white/[0.06] group-hover/row:border-white/[0.15] transition-all duration-300 group-hover/row:scale-105">
                {idx === 0 ? (
                  <DiamondIcon className="w-3.5 h-3.5 md:w-4 md:h-4 drop-shadow-[0_0_6px_rgba(253,230,138,0.5)]" />
                ) : (
                  <svg className={`w-3 h-3 ${config.text}`} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
                )}
                <span className={`text-sm md:text-base font-black tracking-wide leading-none ${idx === 0 ? 'text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]' : config.text} group-hover/row:scale-105 transition-all`}>{formatNumber(entry.quantity)}</span>
                {idx === 0 && (
                  <span className="relative flex h-1.5 w-1.5 md:h-2 md:w-2 ml-0.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 md:h-2 md:w-2 bg-white" />
                  </span>
                )}
              </div>
            </div>
          );
        })}
        <div className="h-4" />
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-12 md:h-16 bg-gradient-to-t from-black via-black/80 to-transparent pointer-events-none z-20" />
    </motion.div>
  );
}

function SubInfoModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-xl" />

      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 40 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 40 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-xl bg-[#0a0a0a] rounded-[32px] overflow-hidden border border-white/10 shadow-2xl shadow-black/60 max-h-[90vh] overflow-y-auto premium-scroll"
      >
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#D4A84A]/40 to-transparent" />

        <div className="p-5 md:p-7 space-y-5" dir="rtl">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#111] border border-white/10 flex items-center justify-center text-[#D4A84A] shadow-lg">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <circle cx="12" cy="12" r="9" />
                  <path strokeLinecap="round" d="M12 11v5" />
                  <path strokeLinecap="round" d="M12 8h.01" />
                </svg>
              </div>
              <h3 className="text-lg md:text-xl font-black text-white tracking-tight">SUB BADGES</h3>
            </div>

            <button
              onClick={onClose}
              className="relative w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all duration-300 flex items-center justify-center group/btn shrink-0"
            >
              <svg className="w-4 h-4 text-white/60 group-hover/btn:text-white/90 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <p className="text-[15px] leading-8 text-white/85 font-medium">
            دام كثير ناس يواجهون مشكلة إن بطاقة الراجحي ما تشتغل في اشتراك Kick، فهذا الحل اللي نجح مع كثير: 👇
          </p>

          <div className="space-y-4">
            {[
              { n: 1, title: 'ادخل على البطاقات', desc: 'من تطبيق برق، افتح قسم البطاقات ثم اختر إصدار بطاقة جديدة.' },
              { n: 2, title: 'أصدر بطاقة برق الرقمية', desc: 'اختر بطاقة رمز الريال السعودي وأكمل خطوات الإصدار، وبعدها وثّق البطاقة إذا تواصل معك التطبيق.' },
              { n: 3, title: 'اشحن البطاقة', desc: 'بعد تفعيل البطاقة، أضف فيها الرصيد اللي تبي تستخدمه للاشتراك.' },
              { n: 4, title: 'اختر Apple Pay', desc: 'وقت الاشتراك في Kick، لا تدفع مباشرة بالبطاقة، اختر Apple Pay كطريقة للدفع.' },
              { n: 5, title: 'غيّر وسيلة الدفع إلى بطاقة برق', desc: 'داخل Apple Pay اختر بطاقة برق بدل أي بطاقة ثانية، ثم أكمل عملية الدفع.' },
            ].map((step) => (
              <div key={step.n} className="flex gap-3 items-start">
                <div className="relative shrink-0 mt-0.5">
                  <div className="absolute inset-0 bg-[#D4A84A] blur-md opacity-30 rounded-full" />
                  <div className="relative w-8 h-8 rounded-full bg-gradient-to-br from-[#F5D489] via-[#D4A84A] to-[#8a6a1f] flex items-center justify-center text-sm font-black text-black shadow-lg">
                    {step.n}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-[15px] font-bold text-white leading-snug">{step.title}</h4>
                  <p className="text-[13px] leading-7 text-white/65 mt-1">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl bg-gradient-to-r from-[#D4A84A]/10 via-[#D4A84A]/5 to-transparent border border-[#D4A84A]/20 p-4">
            <p className="text-[14px] leading-7 text-white/90 font-medium">
              ✅ وبكذا يتم الاشتراك في Kick بدون مشاكل بإذن الله.
            </p>
            <p className="text-[12px] leading-6 text-white/50 mt-1">
              الصور فوق توضح كل خطوة بالترتيب، فقط اتبعها من 1 إلى 5.
            </p>
          </div>

          <div className="space-y-4 pt-1">
            <div className="rounded-2xl overflow-hidden border border-[#D4A84A]/20 bg-gradient-to-b from-white/[0.04] to-transparent p-1.5 shadow-lg">
              <img src="/assets/IMG_3191.webp" alt="شرح الاشتراك - الخطوة" className="w-full rounded-xl" loading="lazy" />
            </div>
            <div className="rounded-2xl overflow-hidden border border-[#D4A84A]/20 bg-gradient-to-b from-white/[0.04] to-transparent p-1.5 shadow-lg">
              <img src="/assets/IMG_3192.webp" alt="شرح الاشتراك - الخطوة" className="w-full rounded-xl" loading="lazy" />
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function StatsSection() {
  const [channelInfo, setChannelInfo] = useState<ChannelInfo | null>(null);
  const [leaderboards, setLeaderboards] = useState<LeaderboardData | null>(null);
  const [clips, setClips] = useState<Clip[] | null>(null);
  const [videos, setVideos] = useState<Video[] | null>(null);
  const [selectedClip, setSelectedClip] = useState<Clip | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<{ source?: string; title?: string; session_title?: string; views?: number; view_count?: number; uuid?: string } | null>(null);
  const [showSubInfo, setShowSubInfo] = useState(false);

  useEffect(() => {
    const fetchAll = () => {
      kickFetch(`https://kick.com/api/v2/channels/${CHANNEL_SLUG}`).then((raw) => {
        const data = raw?.data || raw;
        if (data) setChannelInfo({ followers_count: data.followers_count || 0, subscriber_badges: data.subscriber_badges || [] });
      }).catch(() => setChannelInfo({ followers_count: 0, subscriber_badges: [] }));

      kickFetch(`https://kick.com/api/v2/channels/${CHANNEL_SLUG}/leaderboards`).then((raw) => {
        const data = raw?.data || raw;
        if (data) setLeaderboards({ gifts: data.gifts || [], gifts_week: data.gifts_week || [], gifts_month: data.gifts_month || [] });
      }).catch(() => setLeaderboards({ gifts: [], gifts_week: [], gifts_month: [] }));

      kickFetch(`https://kick.com/api/v2/channels/${CHANNEL_SLUG}/clips`).then((raw) => {
        const data = raw?.data || raw;
        const arr = data?.clips || (Array.isArray(data) ? data : data?.data && Array.isArray(data.data) ? data.data : []);
        setClips([...arr].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 4));
      }).catch(() => setClips([]));

      kickFetch(`https://kick.com/api/v2/channels/${CHANNEL_SLUG}/videos`).then((raw) => {
        const data = raw?.data || raw;
        const arr = data?.videos || (Array.isArray(data) ? data : []);
        setVideos(arr.slice(0, 3));
      }).catch(() => setVideos([]));
    };

    fetchAll();
    const interval = setInterval(fetchAll, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div id="stats" className="py-20 md:py-28 px-6 space-y-16 relative">
      <div className="max-w-6xl mx-auto space-y-16">
        {/* Followers + Sub Badges */}
        {channelInfo ? (
          <motion.div initial={{ y: 30, opacity: 0 }} whileInView={{ y: 0, opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.8, ease: easeOut }}
            className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-[#D4A84A]/0 via-[#D4A84A]/5 to-[#D4A84A]/0 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
            <div className="relative flex flex-col md:flex-row items-center justify-between bg-[#080808]/60 backdrop-blur-md border border-white/5 p-6 md:p-8 rounded-[30px] shadow-2xl overflow-hidden hover:border-white/10 transition-all duration-500 gap-6 md:gap-0">
              <div className="flex items-center gap-6 relative z-10">
                <div className="relative">
                  <div className="absolute inset-0 bg-[#D4A84A] blur-xl opacity-20 animate-pulse" />
                  <div className="p-4 bg-[#111] rounded-2xl border border-white/10 shadow-lg relative">
                    <svg className="w-10 h-10 text-[#53FC18]" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" /></svg>
                  </div>
                </div>
                <div>
                  <h3 className="text-4xl md:text-5xl font-black text-white tracking-tighter flex items-center gap-3">
                    {formatNumber(channelInfo.followers_count)}
                    <img src="/assets/kick-logo.png" alt="Kick" className="w-8 h-8 md:w-10 md:h-10 object-contain drop-shadow-[0_0_12px_rgba(83,252,24,0.3)]" />
                  </h3>
                  <p className="text-xs uppercase tracking-[0.2em] font-bold mt-1 pl-1" style={{ color: 'rgba(247,243,238,0.4)' }}>FOLLOWERS</p>
                </div>
              </div>

              <div className="flex flex-col md:flex-row items-center gap-3 relative z-10">
                {channelInfo.subscriber_badges && channelInfo.subscriber_badges.length > 0 && (
                  <>
                    <div className="flex flex-col items-center md:items-end">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setShowSubInfo(true)}
                          aria-label="لماذا لا أستطيع الاشتراك؟"
                          title="لماذا لا أستطيع الاشتراك؟"
                          className="w-4 h-4 rounded-full border border-[#D4A84A]/40 bg-[#D4A84A]/10 hover:bg-[#D4A84A]/30 hover:border-[#D4A84A] hover:scale-110 shadow-[0_0_10px_rgba(212,168,74,0.15)] transition-all duration-300 flex items-center justify-center cursor-pointer shrink-0 group/info"
                        >
                          <span className="text-[9px] font-black text-[#D4A84A] group-hover/info:text-black leading-none">i</span>
                        </button>
                        <span className="text-[10px] uppercase tracking-[0.25em] font-bold" style={{ color: 'rgba(247,243,238,0.3)' }}>SUB BADGES</span>
                      </div>
                      <div className="h-0.5 w-8 bg-[#D4A84A]/50 rounded-full mt-1 hidden md:block" />
                    </div>
                    <div className="flex flex-wrap justify-center md:justify-end gap-2">
                      {channelInfo.subscriber_badges.sort((a, b) => a.months - b.months).map((badge) => (
                        <div key={badge.id} className="relative group/badge transition-transform duration-300 hover:-translate-y-2">
                          <div className="absolute -inset-2 bg-white/10 blur-md rounded-full opacity-0 group-hover/badge:opacity-100 transition-opacity" />
                          <img src={badge.badge_image.src} alt={`${badge.months} months`} className="w-12 h-12 object-contain drop-shadow-xl relative z-10" title={`${badge.months} Months`} />
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        ) : <Skeleton className="h-32 w-full rounded-[30px]" />}

        {/* Top Gifters */}
        <div id="gifters" className="relative space-y-12">
          <motion.div initial={{ y: 20, opacity: 0 }} whileInView={{ y: 0, opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.7, ease: easeOut }}
            className="flex flex-col items-center justify-center gap-2 text-center relative z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#111] border border-white/10 flex items-center justify-center shadow-lg">
                <svg className="w-5 h-5 text-[#D4A84A]" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
              </div>
              <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight">Top Gifters</h2>
            </div>
            <p className="text-sm text-white/40 font-medium">Most generous supporters across all time</p>
            <div className="relative">
              <div className="h-px w-24 bg-gradient-to-r from-transparent via-[#D4A84A]/60 to-transparent" />
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-1 rounded-full bg-gradient-to-r from-[#D4A84A]/80 via-[#D4A84A] to-[#D4A84A]/80 blur-[2px]" />
            </div>
          </motion.div>

          {leaderboards ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-8 items-start relative px-1 pt-6 md:pt-8">
              <div className="col-span-2 md:col-span-1 order-1 md:order-2">
                <LeaderboardCard title="All Time" subtitle="Legends" data={leaderboards.gifts} icon={<DiamondIcon className="w-5 h-5 md:w-7 md:h-7" />} accentColor="yellow" isMain delay={0} emptyLabel="No records found" />
              </div>
              <div className="order-2 md:order-1">
                <LeaderboardCard title="Weekly" subtitle="This Week" data={leaderboards.gifts_week} icon={<FlameIcon className="w-5 h-5 md:w-7 md:h-7" />} accentColor="rose" delay={100} emptyLabel="No active gifters this week" />
              </div>
              <div className="order-3">
                <LeaderboardCard title="Monthly" subtitle="This Month" data={leaderboards.gifts_month} icon={<StarIcon className="w-5 h-5 md:w-7 md:h-7" />} accentColor="cyan" delay={200} emptyLabel="No active gifters this month" />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-6 items-start relative px-1 pt-6 md:pt-8">
              <div className="col-span-2 md:col-span-1 order-1 md:order-2">
                <Skeleton className="h-80 md:h-[480px] rounded-3xl" />
              </div>
              <div className="order-2 md:order-1">
                <Skeleton className="h-64 md:h-96 rounded-3xl" />
              </div>
              <div className="order-3">
                <Skeleton className="h-64 md:h-96 rounded-3xl" />
              </div>
            </div>
          )}
        </div>

        {/* Botrix Leaderboard */}
        <div className="pt-8">
          <BotrixLeaderboard />
        </div>

        {/* Moderators */}
        <ModeratorsSection />

        {/* Clips & VODs */}
        <div id="clips" className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 pt-8 border-t border-white/5">
          <div className="space-y-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#111] border border-white/10 flex items-center justify-center text-[#D4A84A] shadow-lg">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
              </div>
              <span className="text-2xl font-bold text-white tracking-tight">Recent Clips</span>
            </div>
            {clips ? clips.length > 0 ? (
              <div className="grid grid-cols-2 gap-4">
                {clips.map((clip) => (
                  <button key={clip.id} onClick={() => setSelectedClip(clip)}
                    className="group relative aspect-video rounded-2xl overflow-hidden border border-white/10 bg-[#050505] shadow-lg hover:shadow-[#D4A84A]/10 hover:border-[#D4A84A]/30 transition-all duration-500 text-left w-full cursor-pointer">
                    <img src={clip.thumbnail_url || FALLBACK_IMAGE} alt={clip.title} onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMAGE; }} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 opacity-80 group-hover:opacity-100" />
                    <div className="absolute inset-0 bg-black/40 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 duration-300">
                      <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <svg className="w-5 h-5 fill-white ml-0.5" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                      </div>
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-90" />
                    <div className="absolute bottom-0 inset-x-0 p-3">
                      <p className="text-xs font-bold text-white truncate drop-shadow-md">{clip.title}</p>
                      <div className="flex items-center gap-1 mt-1">
                        <span className="text-[10px] text-white/70">{formatNumber(clip.view_count)} views</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : <div className="p-8 rounded-2xl bg-white/5 border border-white/5 text-center text-white/30 text-sm italic">No clips</div> : (
              <div className="grid grid-cols-2 gap-4">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="aspect-video rounded-2xl" />)}</div>
            )}
          </div>

          <div className="space-y-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#111] border border-white/10 flex items-center justify-center text-white shadow-lg">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <span className="text-2xl font-bold text-white tracking-tight">Past Streams</span>
            </div>
            {videos ? videos.length > 0 ? (
              <div className="space-y-4">
                {videos.map((video) => {
                  return (
                    <button key={video.id} onClick={() => setSelectedVideo({ source: video.source, title: video.title, session_title: video.session_title, views: video.views, view_count: video.view_count, uuid: video.uuid || video.video?.uuid })}
                      className="flex gap-4 p-3 rounded-2xl bg-[#080808] hover:bg-[#111] border border-white/5 hover:border-white/10 transition-all group cursor-pointer shadow-lg hover:shadow-xl text-left w-full">
                      <div className="relative w-36 aspect-video rounded-xl overflow-hidden shrink-0 bg-black shadow-inner">
                        <img src={video.thumbnail?.url || video.thumbnail?.src || (typeof video.thumbnail === 'string' ? video.thumbnail : '') || FALLBACK_IMAGE}
                          alt={video.session_title || video.title} onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMAGE; }}
                          className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" loading="lazy" />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-transparent transition-colors">
                          <div className="w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center border border-white/20 group-hover:scale-110 transition-transform">
                            <svg className="w-4 h-4 text-white ml-0.5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                          </div>
                        </div>
                      </div>
                      <div className="min-w-0 flex-1 flex flex-col justify-center gap-1">
                        <h4 className="text-sm font-bold text-white truncate group-hover:text-[#D4A84A] transition-colors">{video.session_title || video.title || 'Past Stream'}</h4>
                        <div className="flex items-center gap-3 text-[11px] text-white/40 font-medium">
                          <span>{video.created_at ? new Date(video.created_at).toLocaleDateString() : 'Recent'}</span>
                          <span className="w-1 h-1 rounded-full bg-white/20" />
                          <span>{formatNumber(video.views || video.view_count || 0)} views</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : <div className="p-8 rounded-2xl bg-white/5 border border-white/5 text-center text-white/30 text-sm italic">No VODs</div> : (
              <div className="space-y-4">{[1, 2, 3].map(i => <div key={i} className="flex gap-4"><Skeleton className="w-32 aspect-video shrink-0 rounded-xl" /><div className="flex-1 space-y-2 py-2"><Skeleton className="w-full h-4 rounded-md" /><Skeleton className="w-2/3 h-3 rounded-md" /></div></div>)}</div>
            )}
          </div>
        </div>
      </div>
      <AnimatePresence>
        {selectedClip && <ClipModal clip={selectedClip} onClose={() => setSelectedClip(null)} />}
        {selectedVideo && <VodModal video={selectedVideo} onClose={() => setSelectedVideo(null)} />}
        {showSubInfo && <SubInfoModal onClose={() => setShowSubInfo(false)} />}
      </AnimatePresence>
    </div>
  );
}

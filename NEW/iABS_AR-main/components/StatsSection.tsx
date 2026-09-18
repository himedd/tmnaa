import React, { useEffect, useState, useRef } from 'react';
import Hls from 'hls.js';
import { Language, LeaderboardData, Clip, Video, ChannelInfo, LeaderboardEntry } from '../types';
import { KickIcon } from './Icons';
import BotrixLeaderboard from './BotrixLeaderboard';
import { kickFetch } from '../utils/kickApi';

interface StatsSectionProps {
  lang: Language;
}

const FALLBACK_IMAGE = "https://files.kick.com/images/user/1106194/profile_image/conversion/140c7236-24f9-4267-b318-6be659f6035e-fullsize.webp";

const formatNumber = (num: number) => {
  return new Intl.NumberFormat('en-US', { notation: "compact", maximumFractionDigits: 1 }).format(num || 0);
};

// Skeleton Primitive
const Skeleton: React.FC<{ className: string }> = ({ className }) => (
  <div className={`bg-white/5 animate-pulse rounded-xl ${className}`}></div>
);

// --- NEW GRADIENT ICONS ---

const DiamondIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} strokeWidth="0">
    <defs>
      <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FDE68A" />
        <stop offset="100%" stopColor="#D97706" />
      </linearGradient>
    </defs>
    <path stroke="url(#goldGradient)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
    <path fill="url(#goldGradient)" fillOpacity="0.1" d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
  </svg>
);

const FlameIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} strokeWidth="0">
    <defs>
      <linearGradient id="roseGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FDA4AF" />
        <stop offset="100%" stopColor="#E11D48" />
      </linearGradient>
    </defs>
    <path stroke="url(#roseGradient)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
    <path stroke="url(#roseGradient)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1.001A3.75 3.75 0 0012 18z" />
    <path fill="url(#roseGradient)" fillOpacity="0.1" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
  </svg>
);

const StarIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} strokeWidth="0">
    <defs>
      <linearGradient id="cyanGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#67E8F9" />
        <stop offset="100%" stopColor="#06B6D4" />
      </linearGradient>
    </defs>
    <path stroke="url(#cyanGradient)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
    <path fill="url(#cyanGradient)" fillOpacity="0.1" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
  </svg>
);

interface LeaderboardCardProps {
  title: string;
  subtitle: string;
  data: LeaderboardEntry[];
  icon: React.ReactNode;
  accentColor: 'yellow' | 'rose' | 'cyan';
  isMain?: boolean;
  lang: Language;
  t: any;
  delay: number;
  emptyLabel?: string;
  className?: string;
}

const LeaderboardCard: React.FC<LeaderboardCardProps> = ({ title, subtitle, data, icon, accentColor, isMain, lang, t, delay, emptyLabel, className }) => {

  // Config based on accent color
  const config = {
    yellow: {
      border: 'border-yellow-500/20',
      glow: 'shadow-[0_0_40px_-10px_rgba(234,179,8,0.15)]',
      text: 'text-yellow-400',
      bgIcon: 'bg-yellow-500/10',
      gradient: 'from-yellow-400 to-amber-600',
      subText: 'text-yellow-200/50'
    },
    rose: {
      border: 'border-[#FF2D2D]/20',
      glow: 'shadow-[0_0_40px_-10px_rgba(255,45,45,0.15)]',
      text: 'text-[#FF2D2D]',
      bgIcon: 'bg-[#FF2D2D]/10',
      gradient: 'from-[#FF2D2D] to-red-800',
      subText: 'text-red-200/50'
    },
    cyan: {
      border: 'border-cyan-500/20',
      glow: 'shadow-[0_0_40px_-10px_rgba(6,182,212,0.15)]',
      text: 'text-cyan-400',
      bgIcon: 'bg-cyan-500/10',
      gradient: 'from-cyan-400 to-blue-600',
      subText: 'text-cyan-200/50'
    }
  }[accentColor];

  // Helper for Rank Badges
  const renderRankBadge = (rank: number) => {
    if (rank === 1) return (
      <div className="w-8 h-8 rounded-full flex items-center justify-center bg-gradient-to-br from-[#FFD700] to-[#FDB931] shadow-[0_0_15px_rgba(255,215,0,0.5)] border border-[#FFFACD]/50 text-black font-black text-sm shrink-0">
        1
      </div>
    );
    if (rank === 2) return (
      <div className="w-7 h-7 rounded-full flex items-center justify-center bg-gradient-to-br from-[#E0E0E0] to-[#BDBDBD] shadow-[0_0_10px_rgba(192,192,192,0.3)] border border-white/50 text-black font-black text-xs shrink-0">
        2
      </div>
    );
    if (rank === 3) return (
      <div className="w-6 h-6 rounded-full flex items-center justify-center bg-gradient-to-br from-[#E6A373] to-[#8B4513] shadow-[0_0_10px_rgba(205,127,50,0.3)] border border-[#FFDAB9]/30 text-white font-black text-[10px] shrink-0">
        3
      </div>
    );
    return (
      <span className="w-6 text-center text-xs font-bold text-white/30 font-mono shrink-0">
        {rank < 10 ? `0${rank}` : rank}
      </span>
    );
  };

  // Render Empty State
  if (!data || data.length === 0) {
    return (
      <div className={`
                 relative flex flex-col items-center justify-center p-6 text-center rounded-[32px] overflow-hidden
                 bg-black/60 backdrop-blur-lg border border-white/5
                 transition-all duration-700 hover:border-white/10 group
                 ${isMain ? 'lg:-mt-4 z-10 min-h-[300px] md:min-h-[440px]' : 'min-h-[250px] md:min-h-[380px]'}
                 ${className}
             `}
        style={{ animationDelay: `${delay}ms` }}>
        {/* Background Noise & Sheen */}


        <div className={`p-4 md:p-5 rounded-full ${config.bgIcon} mb-4 md:mb-5 opacity-50 group-hover:opacity-100 transition-opacity duration-500 ring-1 ring-white/5`}>
          {React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: `w-6 h-6 md:w-8 md:h-8 ${config.text} drop-shadow-lg` })}
        </div>
        <h3 className={`text-sm md:text-base font-bold text-white/60 mb-1 uppercase tracking-[0.2em]`}>{title}</h3>
        <p className={`text-[10px] md:text-xs ${config.subText} font-medium`}>{emptyLabel || t.noData}</p>
      </div>
    );
  }

  const sorted = [...data].sort((a, b) => b.quantity - a.quantity).slice(0, 10);

  return (
    <div
      className={`
                group relative flex flex-col rounded-[24px] md:rounded-[32px] overflow-hidden transition-all duration-700
                bg-[#050505]/80 backdrop-blur-lg border border-white/5
                ${config.glow} hover:border-white/20
                ${isMain ? 'md:-mt-8 z-20 md:scale-105 shadow-2xl ring-1 ring-white/10' : 'shadow-xl'}
                ${className}
            `}
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Deep Gradient Background Effect */}
      <div className={`absolute top-0 left-0 right-0 h-24 md:h-32 bg-gradient-to-b ${config.bgIcon.replace('bg-', 'from-').replace('/10', '/20')} to-transparent pointer-events-none opacity-40 blur-2xl`}></div>

      {/* Noise Texture */}


      {/* Header */}
      <div className="relative p-4 md:p-6 flex flex-col items-center justify-center text-center border-b border-white/5 z-10">
        <div className={`
                    w-10 h-10 md:w-14 md:h-14 mb-2 md:mb-3 rounded-2xl flex items-center justify-center 
                    bg-gradient-to-br from-white/10 to-transparent border border-white/10 
                    shadow-[0_10px_30px_-10px_rgba(0,0,0,0.5)] group-hover:scale-110 transition-transform duration-500
                 `}>
          {React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: "w-5 h-5 md:w-7 md:h-7 filter drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]" }) : icon}
        </div>
        <div>
          <h3 className={`text-base md:text-2xl font-black text-white tracking-tight leading-none mb-0.5 md:mb-1 ${lang === 'ar' ? 'font-arabic' : ''}`}>{title}</h3>
          <span className={`text-[8px] md:text-[10px] font-bold uppercase tracking-[0.2em] md:tracking-[0.3em] bg-gradient-to-r ${config.gradient} bg-clip-text text-transparent opacity-80`}>{subtitle}</span>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 p-2 md:p-3 space-y-1.5 md:space-y-2 relative overflow-y-auto max-h-[300px] md:max-h-[400px] scrollbar-hide">
        {sorted.map((entry, idx) => {
          const isTop3 = idx < 3;
          return (
            <div
              key={idx}
              className={`
                                relative flex items-center justify-between p-2 md:p-3.5 rounded-xl md:rounded-2xl transition-all duration-300 group/row
                                ${isTop3 ? 'bg-gradient-to-r from-white/[0.03] to-transparent border border-white/5' : 'hover:bg-white/[0.02]'}
                            `}
            >
              <div className="flex items-center gap-2 md:gap-4 min-w-0">
                {/* Rank Badge */}
                <div className="shrink-0 flex justify-center w-6 md:w-8">
                  {renderRankBadge(idx + 1)}
                </div>

                {/* User Info */}
                <div className="flex flex-col min-w-0 flex-1">
                  <span className={`
                                         text-sm md:text-base font-bold truncate transition-colors pr-2
                                         ${idx === 0 ? 'text-white drop-shadow-lg' : 'text-white/95 drop-shadow-md'}
                                         group-hover/row:text-white
                                         leading-tight
                                     `}>
                    {entry.username}
                  </span>
                  {isTop3 && (
                    <div className="hidden md:block h-0.5 w-12 rounded-full bg-gradient-to-r from-white/30 to-transparent mt-1"></div>
                  )}
                </div>
              </div>

              {/* Amount */}
              <div className="flex items-center gap-2 pl-3 bg-black/30 rounded-lg px-3 py-1.5 border border-white/10">
                <span className={`
                                         text-sm md:text-base font-black tracking-wide 
                                         ${idx === 0 ? 'text-white drop-shadow-lg' : config.text}
                                         group-hover/row:scale-105 transition-all
                                         leading-none
                                     `}>
                  {formatNumber(entry.quantity)}
                </span>
                {idx === 0 && (
                  <div className="w-1 h-1 md:w-1.5 md:h-1.5 rounded-full bg-white animate-pulse shadow-[0_0_10px_white]"></div>
                )}
              </div>
            </div>
          );
        })}

        {/* Decorative spacer at bottom */}
        <div className="h-4"></div>
      </div>

      {/* Bottom Fade Mask */}
      <div className="absolute bottom-0 left-0 right-0 h-12 md:h-16 bg-gradient-to-t from-black via-black/80 to-transparent pointer-events-none z-20"></div>
    </div>
  );
};


export const StatsSection: React.FC<StatsSectionProps> = ({ lang }) => {
  // Initialize as null to indicate "loading"
  const [leaderboards, setLeaderboards] = useState<LeaderboardData | null>(null);
  const [clips, setClips] = useState<Clip[] | null>(null);
  const [videos, setVideos] = useState<Video[] | null>(null);
  const [channelInfo, setChannelInfo] = useState<ChannelInfo | null>(null);


  const t = {
    followers: lang === 'en' ? 'Followers' : 'متابع',
    topGifters: lang === 'en' ? 'Top Gifters' : 'كبار الداعمين',
    allTime: lang === 'en' ? 'All Time' : 'الأفضل',
    monthly: lang === 'en' ? 'Monthly' : 'شهرياً',
    weekly: lang === 'en' ? 'Weekly' : 'أسبوعياً',
    recentClips: lang === 'en' ? 'Recent Clips' : 'آخر اللقطات',
    recentVods: lang === 'en' ? 'Past Streams' : 'البثوث السابقة',
    views: lang === 'en' ? 'Views' : 'مشاهدة',
    gift: lang === 'en' ? 'Gifts' : 'هدية',
    subBadges: lang === 'en' ? 'Sub Badges' : 'شارات المشتركين',
    noData: lang === 'en' ? 'No Data' : 'لا يوجد بيانات',
    watching: lang === 'en' ? 'Now Playing' : 'جاري المشاهدة',

    // Custom Empty States
    noDataWeekly: lang === 'en' ? 'No active gifters this week' : 'لا يوجد داعمين هذا الأسبوع',
    noDataMonthly: lang === 'en' ? 'No active gifters this month' : 'لا يوجد داعمين لهذا الشهر',
    noDataAllTime: lang === 'en' ? 'No records found' : 'لا يوجد سجلات بعد',
  };

  useEffect(() => {
    const channelSlug = 'iabs';
    
    const endpoints = {
      leaderboard: `https://kick.com/api/v2/channels/${channelSlug}/leaderboards`,
      clips: `https://kick.com/api/v2/channels/${channelSlug}/clips`,
      videos: `https://kick.com/api/v2/channels/${channelSlug}/videos`,
      channel: `https://kick.com/api/v2/channels/${channelSlug}`
    };

    // جلب معلومات القناة (المتابعين)
    kickFetch(endpoints.channel).then(rawData => {
        const data = rawData?.data || rawData; // فك التغليف إن وجد
        if (data) {
            setChannelInfo({
                followers_count: data.followers_count || 0,
                subscriber_badges: data.subscriber_badges || []
            });
        }
    }).catch(() => setChannelInfo({ followers_count: 0, subscriber_badges: [] }));

    // جلب الداعمين
    kickFetch(endpoints.leaderboard).then(rawData => {
        const data = rawData?.data || rawData; // فك التغليف
        if (data) {
            setLeaderboards({
                gifts: data.gifts || [],
                gifts_week: data.gifts_week || [],
                gifts_month: data.gifts_month || [] 
            });
        }
    }).catch(() => setLeaderboards({ gifts: [], gifts_week: [], gifts_month: [] }));

    // جلب اللقطات (آخر اللقطات مع منطق استخراج قوي لضمان ظهور البيانات)
    kickFetch(endpoints.clips).then(rawData => {
        // فك التغليف لجميع الهياكل المحتملة من Kick API
        const data = rawData?.data || rawData; 
        const clipsArray = data?.clips || (Array.isArray(data) ? data : (data?.data && Array.isArray(data.data) ? data.data : []));
        
        // ترتيب تنازلي حسب التاريخ (الأحدث أولاً)
        const sortedClips = [...clipsArray].sort((a: any, b: any) => 
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        setClips(sortedClips.slice(0, 4));
    }).catch(() => setClips([]));

    // جلب الفيديوهات
    kickFetch(endpoints.videos).then(rawData => {
        const data = rawData?.data || rawData; // فك التغليف
        const videosArray = data?.videos || (Array.isArray(data) ? data : []);
        setVideos(videosArray.slice(0, 3));
    }).catch(() => setVideos([]));

  }, []);

  return (
    <>
      <div className="w-full space-y-16 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>

        {/* --- CHANNEL STATS BAR --- */}
        {channelInfo ? (
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-kick/0 via-kick/5 to-kick/0 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>
            <div className="relative flex flex-col md:flex-row items-center justify-between bg-[#080808]/60 backdrop-blur-md border border-white/5 p-6 md:p-8 rounded-[30px] shadow-2xl overflow-hidden hover:border-white/10 transition-all gap-6 md:gap-0">

              {/* Background Noise */}


              <div className="flex items-center gap-6 relative z-10">
                <div className="relative">
                  <div className="absolute inset-0 bg-[#FF2D2D] blur-xl opacity-20 animate-pulse"></div>
                  <div className="p-4 bg-[#111] text-white rounded-2xl border border-white/10 shadow-lg relative">
                    <KickIcon className="w-10 h-10 text-[#53FC18]" />
                  </div>
                </div>
                <div>
                  <h3 className="text-4xl md:text-5xl font-black text-white tracking-tighter drop-shadow-lg">{formatNumber(channelInfo.followers_count)}</h3>
                  <p className="text-xs text-white/40 uppercase tracking-[0.2em] font-bold mt-1 pl-1">{t.followers}</p>
                </div>
              </div>

              <div className="flex flex-col md:flex-row items-center gap-3 relative z-10">
                {channelInfo.subscriber_badges && channelInfo.subscriber_badges.length > 0 && (
                  <>
                    <div className="flex flex-col items-center md:items-end">
                      <span className="text-[10px] text-white/30 font-bold uppercase tracking-[0.25em]">{t.subBadges}</span>
                      <div className="h-0.5 w-8 bg-[#FF2D2D]/50 rounded-full mt-1 hidden md:block"></div>
                    </div>
                    <div className="flex flex-wrap justify-center md:justify-end gap-2">
                      {channelInfo.subscriber_badges.sort((a, b) => a.months - b.months).map((badge) => (
                        <div key={badge.id} className="relative group/badge transition-transform duration-300 hover:-translate-y-2">
                          <div className="absolute -inset-2 bg-white/20 blur-md rounded-full opacity-0 group-hover/badge:opacity-100 transition-opacity"></div>
                          <img
                            src={badge.badge_image.src}
                            alt={`${badge.months} months`}
                            className="w-12 h-12 object-contain drop-shadow-xl relative z-10"
                            title={`${badge.months} Months`}
                          />
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        ) : (
          <Skeleton className="h-32 w-full rounded-[30px]" />
        )}

        {/* --- LEADERBOARDS --- */}
        <div className="relative space-y-12">

          {/* Minimal Header */}
          <div className="flex flex-col items-center justify-center gap-2 text-center relative z-10">
            <h2 className={`text-3xl md:text-5xl font-black text-white tracking-tight drop-shadow-xl ${lang === 'ar' ? 'font-arabic' : ''}`}>
              {t.topGifters}
            </h2>
            <div className="h-px w-20 bg-gradient-to-r from-transparent via-white/30 to-transparent"></div>
          </div>

          {leaderboards ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-8 items-start relative px-1">

              {/* All Time (Center on Desktop, Top Full on Mobile) - Gold/Yellow Theme */}
              <LeaderboardCard
                title={t.allTime}
                subtitle="Legends"
                data={leaderboards.gifts}
                icon={<DiamondIcon />}
                accentColor="yellow"
                isMain={true}
                lang={lang}
                t={t}
                delay={0}
                emptyLabel={t.noDataAllTime}
                className="col-span-2 md:col-span-1 order-1 md:order-2"
              />

              {/* Weekly (Left on Desktop, Side-by-side on Mobile) - Rose Theme */}
              <LeaderboardCard
                title={t.weekly}
                subtitle="Active"
                data={leaderboards.gifts_week}
                icon={<FlameIcon />}
                accentColor="rose"
                lang={lang}
                t={t}
                delay={100}
                emptyLabel={t.noDataWeekly}
                className="col-span-1 md:col-span-1 order-2 md:order-1"
              />

              {/* Monthly (Right on Desktop, Side-by-side on Mobile) - Cyan/Blue Theme */}
              <LeaderboardCard
                title={t.monthly}
                subtitle="Stars"
                data={leaderboards.gifts_month}
                icon={<StarIcon />}
                accentColor="cyan"
                lang={lang}
                t={t}
                delay={200}
                emptyLabel={t.noDataMonthly}
                className="col-span-1 md:col-span-1 order-3 md:order-3"
              />

            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-6">
              <Skeleton className="col-span-2 md:col-span-1 order-1 md:order-2 h-80 md:h-[480px] w-full rounded-3xl -mt-0 md:-mt-8" />
              <Skeleton className="col-span-1 order-2 md:order-1 h-64 md:h-96 w-full rounded-3xl" />
              <Skeleton className="col-span-1 order-3 md:order-3 h-64 md:h-96 w-full rounded-3xl" />
            </div>
          )}
        </div>

        {/* --- BOTRIX LEADERBOARD (Most Active Across Streams) --- */}
        <div className="pt-8 border-t border-white/5">
          <BotrixLeaderboard lang={lang} />
        </div>

        {/* --- CLIPS & VODS GRID --- */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 pt-8 border-t border-white/5">

          {/* CLIPS */}
          <div className="space-y-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#111] border border-white/10 flex items-center justify-center text-[#FF2D2D] shadow-lg">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
              </div>
              <span className="text-2xl font-bold text-white tracking-tight">{t.recentClips}</span>
            </div>

            {clips ? (
              clips.length > 0 ? (
                <div className="grid grid-cols-2 gap-4">
                  {clips.map((clip) => (
                    <a
                      key={clip.id}
                      href={`https://kick.com/iabs?clip=${clip.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="group relative aspect-video rounded-2xl overflow-hidden border border-white/10 bg-[#050505] cursor-pointer shadow-lg hover:shadow-[#FF2D2D]/10 hover:border-[#FF2D2D]/30 transition-all duration-500"
                    >
                      <img
                        src={clip.thumbnail_url || FALLBACK_IMAGE}
                        alt={clip.title}
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = FALLBACK_IMAGE;
                        }}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 opacity-80 group-hover:opacity-100"
                      />
                      {/* Play overlay */}
                      <div className="absolute inset-0 bg-black/40 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 duration-300">
                        <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                          <svg className="w-5 h-5 fill-white ml-0.5" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                        </div>
                      </div>

                      {/* Content gradient */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-90"></div>

                      <div className="absolute bottom-0 inset-x-0 p-3">
                        <p className="text-xs font-bold text-white truncate drop-shadow-md">{clip.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex items-center gap-1 text-[10px] text-white/70">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                            <span>{formatNumber(clip.view_count)}</span>
                          </div>
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              ) : (
                <div className="p-8 rounded-2xl bg-white/5 border border-white/5 text-center text-white/30 text-sm italic">{t.noData}</div>
              )
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {[1, 2, 3, 4].map(i => <Skeleton key={i} className="aspect-video w-full rounded-2xl" />)}
              </div>
            )}
          </div>

          {/* VIDEOS (DIRECT LINKS) */}
          <div className="space-y-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#111] border border-white/10 flex items-center justify-center text-white shadow-lg">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <span className="text-2xl font-bold text-white tracking-tight">{t.recentVods}</span>
            </div>

            {videos ? (
              videos.length > 0 ? (
                <div className="space-y-4">
                  {videos.map((video) => {
                    // Kick UUID is usually at root or nested in video.video for V2
                    const videoUUID = video.uuid || video.video?.uuid || video.id;
                    return (
                      <a
                        key={video.id}
                        href={`https://kick.com/iabs/videos/${videoUUID}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex gap-4 p-3 rounded-2xl bg-[#080808] hover:bg-[#111] border border-white/5 hover:border-white/10 transition-all group cursor-pointer shadow-lg hover:shadow-xl animate-fade-in-up"
                      >
                        <div className="relative w-36 aspect-video rounded-xl overflow-hidden shrink-0 bg-black shadow-inner">
                          <img
                            src={video.thumbnail?.url || video.thumbnail?.src || (typeof video.thumbnail === 'string' ? video.thumbnail : '') || FALLBACK_IMAGE}
                            alt={video.session_title || video.title}
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = FALLBACK_IMAGE;
                            }}
                            className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-transparent transition-colors">
                            <div className="w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center border border-white/20 group-hover:scale-110 transition-transform">
                              <svg className="w-4 h-4 text-white ml-0.5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                            </div>
                          </div>
                        </div>
                        <div className="min-w-0 flex-1 flex flex-col justify-center gap-1">
                          <h4 className="text-sm font-bold text-white truncate group-hover:text-[#FF2D2D] transition-colors">
                            {video.session_title || video.title || 'Past Stream'}
                          </h4>
                          <div className="flex items-center gap-3 text-[11px] text-white/40 font-medium">
                            <span>{video.created_at ? new Date(video.created_at).toLocaleDateString() : 'Recent'}</span>
                            <span className="w-1 h-1 rounded-full bg-white/20"></span>
                            <span className="flex items-center gap-1">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                              {formatNumber(video.views || video.view_count || 0)}
                            </span>
                          </div>
                        </div>
                      </a>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 rounded-2xl bg-white/5 border border-white/5 text-center text-white/30 text-sm italic">{t.noData}</div>
              )
            ) : (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex gap-4">
                    <Skeleton className="w-32 aspect-video shrink-0 rounded-xl" />
                    <div className="flex-1 space-y-2 py-2">
                      <Skeleton className="w-full h-4 rounded-md" />
                      <Skeleton className="w-2/3 h-3 rounded-md" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
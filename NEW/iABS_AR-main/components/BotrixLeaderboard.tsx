import React, { useEffect, useState, useMemo, useRef } from 'react';

interface BotrixEntry {
  level: number;
  watchtime: number;
  xp: number;
  points: number;
  name: string;
}

interface BotrixLeaderboardProps {
  lang: 'en' | 'ar';
}

const API_URL = '/api/kick?endpoint=' + encodeURIComponent('https://botrix.live/api/public/leaderboard?platform=kick&user=iabs');

const formatDuration = (seconds: number) => {
  const days = Math.floor(seconds / 86400);
  const hrs = Math.floor((seconds % 86400) / 3600);
  if (days > 0) return `${days}d ${hrs}h`;
  return `${hrs}h`;
};

const formatNum = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
};

const SkeletonRow: React.FC<{ delay: number }> = ({ delay }) => (
  <div className="flex items-center gap-3 p-3 md:p-4 rounded-2xl bg-white/[0.02] animate-pulse" style={{ animationDelay: `${delay}ms` }}>
    <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-white/[0.04]"></div>
    <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-white/[0.04]"></div>
    <div className="flex-1 space-y-2">
      <div className="h-3 w-28 bg-white/[0.04] rounded-lg"></div>
      <div className="h-2 w-36 bg-white/[0.02] rounded-lg"></div>
    </div>
    <div className="w-16 h-5 bg-white/[0.04] rounded-lg"></div>
  </div>
);

const AVATAR_CACHE = new Map<string, string>();

const BotrixLeaderboard: React.FC<BotrixLeaderboardProps> = ({ lang }) => {
  const [data, setData] = useState<BotrixEntry[] | null>(null);
  const [avatars, setAvatars] = useState<Record<string, string>>({});
  const [loadingAvatars, setLoadingAvatars] = useState<Record<string, boolean>>({});
  const fetchedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    fetch(API_URL)
      .then(r => r.json())
      .then((json: BotrixEntry[]) => {
        if (!cancelled) setData(json);
      })
      .catch((err) => {
        console.error('[BotrixLeaderboard] Fetch error:', err);
        if (!cancelled) setData([]);
      });
    return () => { cancelled = true; };
  }, []);

  const sorted = useMemo(() => {
    if (!data) return [];
    return [...data].slice(0, 50);
  }, [data]);

  const allNames = useMemo(() => {
    return sorted.map(e => e.name);
  }, [sorted]);

  useEffect(() => {
    if (!allNames.length) return;
    const toFetch = allNames.filter(n => !fetchedRef.current.has(n));
    if (!toFetch.length) return;
    toFetch.forEach(n => fetchedRef.current.add(n));

    let cancelled = false;
    const results: Record<string, string> = {};
    const loading: Record<string, boolean> = {};
    toFetch.forEach(n => { loading[n] = true; });
    if (!cancelled) setLoadingAvatars(prev => ({ ...prev, ...loading }));

    const fetchOne = async (name: string) => {
      try {
        const res = await fetch('/api/kick?endpoint=' + encodeURIComponent(`https://kick.com/api/v2/channels/${name}`));
        if (!res.ok) return;
        const json = await res.json();
        const avatar = json?.user?.profile_pic || json?.profile_pic || '';
        if (avatar) {
          AVATAR_CACHE.set(name, avatar);
          results[name] = avatar;
        }
      } catch { }
    };

    (async () => {
      const batchSize = 5;
      for (let i = 0; i < toFetch.length; i += batchSize) {
        const batch = toFetch.slice(i, i + batchSize);
        await Promise.all(batch.map(fetchOne));
        if (cancelled) return;
      }
      if (!cancelled) {
        setAvatars(prev => ({ ...prev, ...results }));
        const done: Record<string, boolean> = {};
        toFetch.forEach(n => { done[n] = false; });
        setLoadingAvatars(prev => {
          const next = { ...prev };
          toFetch.forEach(n => { next[n] = false; });
          return next;
        });
      }
    })();

    return () => { cancelled = true; };
  }, [allNames]);

  const getAvatar = (name: string) => avatars[name] || AVATAR_CACHE.get(name) || '';
  const isAvatarLoading = (name: string) => loadingAvatars[name] !== false;

  const renderRankBadge = (rank: number) => {
    if (rank === 1) return (
      <div className="w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center bg-gradient-to-br from-[#FFD700] to-[#FFA500] shadow-[0_0_20px_rgba(255,215,0,0.5)] border-2 border-[#FFF8DC] text-black font-black text-xs md:text-sm shrink-0">
        <svg className="w-3.5 h-3.5 md:w-4 md:h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
      </div>
    );
    if (rank === 2) return (
      <div className="w-7 h-7 md:w-9 md:h-9 rounded-full flex items-center justify-center bg-gradient-to-br from-[#E8E8E8] to-[#B0B0B0] shadow-[0_0_15px_rgba(192,192,192,0.3)] border-2 border-white/60 text-black font-black text-[10px] md:text-xs shrink-0">
        <svg className="w-3 h-3 md:w-3.5 md:h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
      </div>
    );
    if (rank === 3) return (
      <div className="w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center bg-gradient-to-br from-[#E6A373] to-[#8B4513] shadow-[0_0_15px_rgba(205,127,50,0.3)] border-2 border-[#FFDAB9]/50 text-white font-black text-[10px] md:text-xs shrink-0">
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
      </div>
    );
    return (
      <span className="w-5 md:w-6 text-center text-[10px] md:text-xs font-bold text-white/15 font-mono shrink-0">
        {rank < 10 ? `0${rank}` : rank}
      </span>
    );
  };

  const t = {
    title: lang === 'ar' ? 'متداولين البثوث' : 'Stream Regulars',
    subtitle: lang === 'ar' ? 'الأكثر تفاعلاً في جميع البثوث' : 'Most active across all streams',
    empty: lang === 'ar' ? 'لا توجد بيانات حالياً' : 'No data available',
    powered: lang === 'ar' ? 'مدعوم من Botrix' : 'Powered by Botrix',
    level: lang === 'ar' ? 'المستوى' : 'Level',
    watchtime: lang === 'ar' ? 'وقت المشاهدة' : 'Watch Time',
    xp: 'XP',
    points: lang === 'ar' ? 'النقاط' : 'Points',
  };

  return (
    <div className="w-full animate-fade-in-up">
      <div className="group relative flex flex-col rounded-[28px] md:rounded-[36px] overflow-hidden transition-all duration-700 bg-[#070707] backdrop-blur-lg border border-white/[0.06] shadow-[0_0_80px_-20px_rgba(83,252,24,0.06)] hover:border-white/[0.12] hover:shadow-[0_0_100px_-15px_rgba(83,252,24,0.1)]">

        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[#53FC18] opacity-[0.03] blur-[40px] md:blur-[120px] pointer-events-none rounded-full"></div>
        <div className="absolute bottom-0 right-0 w-[300px] h-[200px] bg-[#FF2D2D] opacity-[0.02] blur-[40px] md:blur-[100px] pointer-events-none rounded-full"></div>

        <div className="relative p-5 md:p-8 z-10">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 bg-[#53FC18]/20 blur-xl rounded-2xl"></div>
              <div className="relative w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center bg-gradient-to-br from-[#53FC18]/15 to-black border border-[#53FC18]/20 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.6)]">
                <svg className="w-6 h-6 md:w-7 md:h-7 text-[#53FC18] drop-shadow-[0_0_10px_rgba(83,252,24,0.3)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
                </svg>
              </div>
            </div>
            <div>
              <h3 className="text-xl md:text-2xl font-black text-white tracking-tight leading-none mb-0.5">{t.title}</h3>
              <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-[0.25em] bg-gradient-to-r from-[#53FC18] to-emerald-500 bg-clip-text text-transparent">{t.subtitle}</span>
            </div>
          </div>
        </div>

        <div className="relative px-4 md:px-8 pb-4 z-10">
          {!data && (
            <div className="space-y-1.5">
              {Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} delay={i * 60} />)}
            </div>
          )}

          {data && data.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-white/[0.03] flex items-center justify-center mb-4 border border-white/[0.05]">
                <svg className="w-7 h-7 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m6 4.125l2.25 2.25m0 0l2.25 2.25M12 13.875l2.25-2.25M12 13.875l-2.25 2.25M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                </svg>
              </div>
              <p className="text-sm text-white/30 font-medium">{t.empty}</p>
            </div>
          )}

          {data && data.length > 0 && (
            <div className="space-y-1 max-h-[500px] md:max-h-[600px] overflow-y-auto scrollbar-hide">
              {sorted.map((entry, idx) => {
                const isTop3 = idx < 3;
                const avatarUrl = getAvatar(entry.name);
                const avatarLoading = isAvatarLoading(entry.name);
                return (
                  <div
                    key={entry.name}
                    className={`relative flex items-center justify-between p-2.5 md:p-3 rounded-xl md:rounded-2xl transition-all duration-300 group/row ${
                      isTop3
                        ? 'bg-gradient-to-r from-white/[0.03] via-white/[0.01] to-transparent border border-white/[0.06]'
                        : 'hover:bg-white/[0.02] border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 md:gap-3 min-w-0 flex-1">
                      <div className="shrink-0 flex justify-center w-6 md:w-8">
                        {renderRankBadge(idx + 1)}
                      </div>

                      <div className="shrink-0 w-8 h-8 md:w-10 md:h-10 rounded-full overflow-hidden bg-white/[0.04] border border-white/[0.06] shadow-lg">
                        {avatarUrl ? (
                          <img src={avatarUrl} alt={entry.name} className="w-full h-full object-cover" loading="lazy" />
                        ) : (
                          <div className={`w-full h-full flex items-center justify-center ${avatarLoading ? 'animate-pulse bg-white/[0.04]' : 'bg-gradient-to-br from-[#53FC18]/10 to-white/[0.02]'}`}>
                            {!avatarLoading && (
                              <span className="text-xs md:text-sm font-bold text-white/30">{entry.name.charAt(0).toUpperCase()}</span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col min-w-0 flex-1">
                        <span className={`text-sm md:text-[15px] font-bold truncate leading-tight ${
                          idx === 0 ? 'text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.15)]' : 'text-white/80 group-hover/row:text-white'
                        }`}>
                          {entry.name}
                        </span>
                        <div className="flex items-center gap-2 text-[9px] md:text-[10px] text-white/25 font-medium mt-0.5 flex-wrap">
                          <span className="inline-flex items-center gap-1">
                            <span className="text-yellow-400/60">⭐</span> Lv.{entry.level}
                          </span>
                          <span className="w-1 h-1 rounded-full bg-white/[0.08]"></span>
                          <span className="inline-flex items-center gap-1">
                            <span className="text-[#53FC18]/60">⏱</span> {formatNum(entry.watchtime)}h
                          </span>
                          <span className="w-1 h-1 rounded-full bg-white/[0.08]"></span>
                          <span className="inline-flex items-center gap-1">
                            <span className="text-blue-400/60">⚡</span> {formatNum(entry.xp)} XP
                          </span>
                          <span className="w-1 h-1 rounded-full bg-white/[0.08]"></span>
                          <span className="inline-flex items-center gap-1">
                            <span className="text-purple-400/60">💎</span> {formatNum(entry.points)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className={`flex items-center gap-2 pl-3 rounded-xl px-2.5 md:px-3 py-2 border transition-all duration-300 shrink-0 ${
                      idx === 0
                        ? 'bg-[#53FC18]/10 border-[#53FC18]/20 shadow-[0_0_20px_rgba(83,252,24,0.1)]'
                        : 'bg-black/40 border-white/[0.04] group-hover/row:border-white/[0.08]'
                    }`}>
                      <span className={`text-[10px] md:text-xs font-black tracking-wide leading-none ${
                        idx === 0 ? 'text-[#53FC18] drop-shadow-[0_0_8px_rgba(83,252,24,0.3)]' : 'text-white/50'
                      }`}>
                        {formatNum(entry.watchtime)}h
                      </span>
                      {idx === 0 && (
                        <span className="relative flex h-1.5 w-1.5 md:h-2 md:w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#53FC18] opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 md:h-2 md:w-2 bg-[#53FC18]"></span>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
              <div className="h-6"></div>
            </div>
          )}
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-[#070707] via-[#070707]/90 to-transparent pointer-events-none z-20"></div>

        <div className="relative px-5 md:px-8 pb-5 md:pb-6 flex items-center justify-center gap-3 z-10">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent"></div>
          <a href="https://botrix.live" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-[8px] md:text-[9px] font-bold uppercase tracking-[0.3em] text-white/15 hover:text-[#53FC18]/50 transition-all duration-300 hover:tracking-[0.35em]">
            <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
            {t.powered}
          </a>
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent"></div>
        </div>
      </div>
    </div>
  );
};

export default BotrixLeaderboard;

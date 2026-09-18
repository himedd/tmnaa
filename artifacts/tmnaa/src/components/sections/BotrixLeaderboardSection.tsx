import { useEffect, useState, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { apiUrl } from '@/lib/apiBase';

const easeOut = [0.22, 1, 0.36, 1] as const;

interface BotrixEntry {
  level: number;
  watchtime: number;
  xp: number;
  points: number;
  name: string;
}

const API_URL = apiUrl('/api/kick?endpoint=' + encodeURIComponent('https://botrix.live/api/public/leaderboard?platform=kick&user=tmnaa'));

const formatNum = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
};

const formatDuration = (minutes: number) => {
  const d = Math.floor(minutes / 1440);
  const h = Math.floor((minutes % 1440) / 60);
  const m = Math.floor(minutes % 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

const SkeletonRow = ({ delay }: { delay: number }) => (
  <div className="flex items-center gap-3 p-3 md:p-4 rounded-2xl bg-white/[0.02] animate-pulse" style={{ animationDelay: `${delay}ms` }}>
    <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-white/[0.04]" />
    <div className="flex-1 space-y-2">
      <div className="h-3 w-28 bg-white/[0.04] rounded-lg" />
      <div className="h-2 w-36 bg-white/[0.02] rounded-lg" />
    </div>
    <div className="w-16 h-5 bg-white/[0.04] rounded-lg" />
  </div>
);

const AVATAR_CACHE = new Map<string, string>();

function CrownIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

export function BotrixLeaderboard() {
  const [data, setData] = useState<BotrixEntry[] | null>(null);
  const [avatars, setAvatars] = useState<Record<string, string>>({});
  const [loadingAvatars, setLoadingAvatars] = useState<Record<string, boolean>>({});
  const fetchedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    fetch(API_URL)
      .then((r) => r.json())
      .then((json: BotrixEntry[]) => { if (!cancelled) setData(json); })
      .catch(() => { if (!cancelled) setData([]); });
    return () => { cancelled = true; };
  }, []);

  const sorted = useMemo(() => (data ? [...data].slice(0, 50) : []), [data]);
  const allNames = useMemo(() => sorted.map((e) => e.name), [sorted]);

  useEffect(() => {
    if (!allNames.length) return;
    const toFetch = allNames.filter((n) => !fetchedRef.current.has(n));
    if (!toFetch.length) return;
    toFetch.forEach((n) => fetchedRef.current.add(n));

    let cancelled = false;
    const results: Record<string, string> = {};
    const loading: Record<string, boolean> = {};
    toFetch.forEach((n) => { loading[n] = true; });
    if (!cancelled) setLoadingAvatars((prev) => ({ ...prev, ...loading }));

    const fetchOne = async (name: string) => {
      try {
        const res = await fetch(apiUrl('/api/kick?endpoint=' + encodeURIComponent(`https://kick.com/api/v2/channels/${name}`)));
        if (!res.ok) return;
        const json = await res.json();
        const avatar = json?.user?.profile_pic || json?.profile_pic || '';
        if (avatar) { AVATAR_CACHE.set(name, avatar); results[name] = avatar; }
      } catch {}
    };

    (async () => {
      for (let i = 0; i < toFetch.length; i += 5) {
        const batch = toFetch.slice(i, i + 5);
        await Promise.all(batch.map(fetchOne));
        if (cancelled) return;
      }
      if (!cancelled) {
        setAvatars((prev) => ({ ...prev, ...results }));
        setLoadingAvatars((prev) => {
          const next = { ...prev };
          toFetch.forEach((n) => { next[n] = false; });
          return next;
        });
      }
    })();

    return () => { cancelled = true; };
  }, [allNames]);

  const getAvatar = (name: string) => avatars[name] || AVATAR_CACHE.get(name) || '';
  const isAvatarLoading = (name: string) => loadingAvatars[name] !== false;

  const renderRank = (rank: number) => {
    if (rank === 1) return (
      <div className="w-9 h-9 md:w-11 md:h-11 rounded-full flex items-center justify-center bg-gradient-to-br from-[#FFD700] to-[#FF8C00] shadow-[0_0_30px_rgba(255,215,0,0.6)] border-2 border-[#FFF5CC] text-black relative">
        <CrownIcon className="w-4 h-4 md:w-5 md:h-5 drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]" />
        <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-[#FFD700] rounded-full flex items-center justify-center shadow-[0_0_10px_rgba(255,215,0,0.8)] border border-[#FFF5CC]">
          <span className="text-[7px] font-black text-black">1</span>
        </div>
      </div>
    );
    if (rank === 2) return (
      <div className="w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center bg-gradient-to-br from-[#E8E8E8] to-[#A0A0A0] shadow-[0_0_20px_rgba(192,192,192,0.3)] border-2 border-white/70 text-black">
        <CrownIcon className="w-3 h-3 md:w-4 md:h-4 text-white/80" />
        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-[#E0E0E0] rounded-full flex items-center justify-center border border-white/60">
          <span className="text-[6px] font-black text-black">2</span>
        </span>
      </div>
    );
    if (rank === 3) return (
      <div className="w-7 h-7 md:w-9 md:h-9 rounded-full flex items-center justify-center bg-gradient-to-br from-[#E6A373] to-[#7B3F00] shadow-[0_0_20px_rgba(205,127,50,0.3)] border-2 border-[#FFDAB9]/60 text-white">
        <CrownIcon className="w-2.5 h-2.5 md:w-3.5 md:h-3.5 text-amber-200" />
        <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-[#CD7F32] rounded-full flex items-center justify-center border border-[#FFDAB9]/50">
          <span className="text-[5px] font-black text-white">3</span>
        </span>
      </div>
    );
    return (
      <div className="w-6 md:w-7 text-center shrink-0 relative">
        <span className="text-[11px] md:text-xs font-black text-white/[0.12] font-mono tracking-tight">{rank < 10 ? `0${rank}` : rank}</span>
      </div>
    );
  };

  return (
    <motion.div initial={{ y: 40, opacity: 0 }} whileInView={{ y: 0, opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.8, ease: easeOut }}
      className="w-full">
      <div className="group relative flex flex-col rounded-[32px] md:rounded-[40px] overflow-hidden transition-all duration-700 bg-gradient-to-b from-[#070707] via-[#090807] to-[#070707] backdrop-blur-lg border border-white/[0.06] shadow-[0_0_80px_-20px_rgba(83,252,24,0.06)] hover:border-white/[0.12] hover:shadow-[0_0_100px_-15px_rgba(83,252,24,0.1)]">

        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#53FC18] opacity-[0.04] blur-[150px] pointer-events-none rounded-full" />
        <div className="absolute top-20 right-0 w-[200px] h-[200px] bg-[#D4A84A] opacity-[0.03] blur-[120px] pointer-events-none rounded-full" />
        <div className="absolute bottom-0 left-0 w-[300px] h-[200px] bg-[#FF2D2D] opacity-[0.02] blur-[100px] pointer-events-none rounded-full" />

        <div className="relative p-6 md:p-10 z-10">
          <div className="flex items-center gap-5">
            <div className="relative">
              <div className="absolute inset-0 bg-[#53FC18] blur-2xl opacity-30 rounded-2xl" />
              <div className="relative w-14 h-14 md:w-16 md:h-16 rounded-2xl flex items-center justify-center bg-gradient-to-br from-[#53FC18]/20 to-black border border-[#53FC18]/30 shadow-[0_10px_50px_-10px_rgba(0,0,0,0.6)] group-hover:scale-110 transition-transform duration-500">
                <svg className="w-7 h-7 md:w-8 md:h-8 text-[#53FC18] drop-shadow-[0_0_15px_rgba(83,252,24,0.5)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
                </svg>
              </div>
            </div>
            <div>
              <h3 className="text-2xl md:text-3xl font-black text-white tracking-tight leading-none mb-1">Stream Regulars</h3>
              <span className="text-[10px] md:text-[11px] font-bold uppercase tracking-[0.3em] bg-gradient-to-r from-[#53FC18] via-emerald-400 to-cyan-300 bg-clip-text text-transparent">Most active across all streams</span>
            </div>
          </div>
        </div>

        <div className="relative px-4 md:px-8 pb-4 z-10">
          {!data && <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} delay={i * 60} />)}</div>}

          {data && data.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-20 h-20 rounded-full bg-white/[0.03] flex items-center justify-center mb-5 border border-white/[0.05]">
                <svg className="w-9 h-9 text-white/15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m6 4.125l2.25 2.25m0 0l2.25 2.25M12 13.875l2.25-2.25M12 13.875l-2.25 2.25M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                </svg>
              </div>
              <p className="text-sm text-white/25 font-medium">No data available</p>
            </div>
          )}

          {data && data.length > 0 && (
            <div className="space-y-2 max-h-[600px] overflow-y-auto overflow-x-hidden premium-scroll">
              {sorted.map((entry, idx) => {
                const isTop3 = idx < 3;
                const avatarUrl = getAvatar(entry.name);
                const avatarLoading = isAvatarLoading(entry.name);
                const hasLevel = entry.level > 0;
                const hasXp = entry.xp > 0;
                return (
                  <motion.div
                    key={entry.name}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: idx * 0.03, ease: easeOut }}
                    className={`relative flex items-center gap-3 md:gap-4 p-3 md:p-4 rounded-2xl md:rounded-3xl transition-all duration-500 group/row ${
                      isTop3
                        ? 'bg-gradient-to-r from-white/[0.04] via-white/[0.01] to-transparent border border-white/[0.08] shadow-[0_0_30px_-5px_rgba(83,252,24,0.05)]'
                        : 'hover:bg-white/[0.02] border border-transparent'
                    }`}
                  >
                    <div className="shrink-0 flex justify-center w-7 md:w-9">
                      {renderRank(idx + 1)}
                    </div>

                    <div className="shrink-0 relative">
                      <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full overflow-hidden ${
                        isTop3
                          ? 'ring-2 ring-[#53FC18]/40 ring-offset-2 ring-offset-[#070707] shadow-[0_0_25px_rgba(83,252,24,0.2)]'
                          : 'ring-1 ring-white/[0.08]'
                      }`}>
                        {avatarUrl ? (
                          <img src={avatarUrl} alt={entry.name} className="w-full h-full object-cover" loading="lazy" />
                        ) : (
                          <div className={`w-full h-full flex items-center justify-center ${avatarLoading ? 'animate-pulse bg-white/[0.04]' : 'bg-gradient-to-br from-[#53FC18]/15 to-white/[0.02]'}`}>
                            {!avatarLoading && (
                              <span className="text-sm md:text-base font-black text-white/25">{entry.name.charAt(0).toUpperCase()}</span>
                            )}
                          </div>
                        )}
                      </div>
                      {isTop3 && (
                        <div className="absolute -inset-1 rounded-full bg-gradient-to-br from-[#53FC18]/30 to-transparent blur-sm -z-10 animate-pulse" />
                      )}
                    </div>

                    <div className="flex flex-col min-w-0 flex-1 gap-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-sm md:text-base font-black truncate leading-tight ${
                          idx === 0
                            ? 'text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.15)]'
                            : isTop3
                              ? 'text-white/95'
                              : 'text-white/70 group-hover/row:text-white/90'
                        }`}>
                          {entry.name}
                        </span>
                        <div className="flex items-center gap-1.5 text-[9px] md:text-[10px] font-bold text-white/25">
                          <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <path d="M12 6v6l4 2" />
                          </svg>
                          <span>{formatDuration(entry.watchtime)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-1 text-[11px] md:text-xs font-black text-[#D4A84A]/70">
                          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                          </svg>
                          <span>{formatNum(entry.points)} pts</span>
                        </div>
                        {hasLevel && (
                          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-white/[0.04] text-white/40 border border-white/[0.06]">
                            Lv.{entry.level}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className={`shrink-0 flex items-center gap-2 md:gap-2.5 rounded-lg md:rounded-xl px-2.5 md:px-3.5 py-2 md:py-2.5 border transition-all duration-300 ${
                      idx === 0
                        ? 'bg-gradient-to-r from-[#53FC18]/12 to-[#53FC18]/5 border-[#53FC18]/30 shadow-[0_0_25px_rgba(83,252,24,0.1)]'
                        : isTop3
                          ? 'bg-white/[0.04] border-white/[0.1] group-hover/row:border-white/[0.15]'
                          : 'bg-black/40 border-white/[0.05] group-hover/row:border-white/[0.1]'
                    }`}>
                      <svg className={`w-3.5 h-3.5 md:w-4 md:h-4 ${
                        idx === 0 ? 'text-[#53FC18] drop-shadow-[0_0_8px_rgba(83,252,24,0.3)]' : 'text-white/25'
                      }`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 6v6l4 2" />
                      </svg>
                      <span className={`text-xs md:text-sm font-black tracking-tight leading-none ${
                        idx === 0 ? 'text-[#53FC18] drop-shadow-[0_0_10px_rgba(83,252,24,0.3)]' : 'text-white/60'
                      }`}>
                        {formatDuration(entry.watchtime)}
                      </span>
                      {idx === 0 && (
                        <span className="relative flex h-1.5 w-1.5 md:h-2 md:w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#53FC18] opacity-75" />
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 md:h-2 md:w-2 bg-[#53FC18]" />
                        </span>
                      )}
                    </div>
                  </motion.div>
                );
              })}
              <div className="h-6" />
            </div>
          )}
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[#070707] via-[#070707]/90 to-transparent pointer-events-none z-20" />

        <div className="relative px-6 md:px-10 pb-6 md:pb-8 flex items-center justify-center gap-4 z-10">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent" />
          <a href="https://botrix.live" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2.5 text-[8px] md:text-[9px] font-black uppercase tracking-[0.35em] text-white/10 hover:text-[#53FC18]/50 transition-all duration-500 hover:tracking-[0.4em]">
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
            Powered by Botrix
          </a>
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent" />
        </div>
      </div>
    </motion.div>
  );
}

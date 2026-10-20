import React, { useState, useEffect, useRef } from 'react';
import { DiscordIcon, YoutubeIcon } from './Icons';
import { Language } from '../types';
import { getYouTubeSubscribers, formatFollowerCount, FALLBACK } from '../utils/socialMediaApi';

interface DiscordData {
   name: string;
   instant_invite: string;
   presence_count: number;
   members: Array<{
      username: string;
      avatar_url: string;
      status: string;
      game?: {
         name: string;
      };
   }>;
   channels: Array<{
      id: string;
      name: string;
   }>;
}

interface YoutubeData {
   title: string;
   link: string;
   date: string;
   thumbnail: string;
}

interface CommunityWidgetsProps {
   lang: Language;
}

/* ============ 3D tilt engine (pointer-fine only, GPU transforms) ============ */
function useTilt(max = 9) {
   const ref = useRef<HTMLDivElement>(null);
   const fine = useRef(false);
   const [tilt, setTilt] = useState({ rx: 0, ry: 0, gx: 50, gy: 20, on: false });
   useEffect(() => {
      fine.current =
         window.matchMedia('(pointer: fine)').matches &&
         !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
   }, []);
   const move = (e: React.PointerEvent) => {
      if (!fine.current || !ref.current) return;
      const r = ref.current.getBoundingClientRect();
      const px = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
      const py = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
      setTilt({ ry: (px - 0.5) * max * 2, rx: (0.5 - py) * max * 2, gx: px * 100, gy: py * 100, on: true });
   };
   const leave = () => setTilt((s) => ({ ...s, rx: 0, ry: 0, on: false }));
   return { ref, tilt, move, leave };
}

const tiltStyle = (tilt: { rx: number; ry: number; on: boolean }): React.CSSProperties => ({
   transform: `perspective(1100px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) scale(${tilt.on ? 1.015 : 1})`,
   transition: tilt.on ? 'transform 0.12s ease-out' : 'transform 0.6s cubic-bezier(0.16,1,0.3,1)',
   transformStyle: 'preserve-3d',
   willChange: 'transform',
});

const CardSkeleton: React.FC<{ glow: string }> = ({ glow }) => (
   <div className="w-full rounded-[26px] border border-white/10 bg-[#0a0a0a]/80 backdrop-blur-xl p-5 animate-pulse" aria-hidden="true">
      <div className="h-20 rounded-2xl bg-white/[0.06]" />
      <div className="flex items-center gap-3 mt-4">
         <div className="w-14 h-14 rounded-2xl" style={{ background: glow }} />
         <div className="flex-1">
            <div className="h-4 rounded-lg bg-white/10 w-2/3" />
            <div className="h-3 rounded-lg bg-white/[0.07] w-1/3 mt-2" />
         </div>
      </div>
      <div className="h-12 rounded-2xl bg-white/[0.06] mt-4" />
   </div>
);

/* ============================ DISCORD ============================ */
export const DiscordWidget: React.FC<CommunityWidgetsProps> = ({ lang }) => {
   const [data, setData] = useState<DiscordData | null>(null);
   const [loading, setLoading] = useState(true);
   const { ref, tilt, move, leave } = useTilt(9);
   const isRTL = lang === 'ar';

   useEffect(() => {
      const fetchDiscord = async () => {
         try {
            const response = await fetch('https://discord.com/api/guilds/882327352858783765/widget.json');
            const json = await response.json();
            setData(json);
         } catch (err) {
            console.error('Discord fetch error:', err);
         } finally {
            setLoading(false);
         }
      };
       fetchDiscord();
       // يتوقف التحديث والتبويب مخفي
       let interval: ReturnType<typeof setInterval> | null = null;
       const start = () => { if (!interval) interval = setInterval(fetchDiscord, 60000); };
       const stop = () => { if (interval) { clearInterval(interval); interval = null; } };
       const onVis = () => { if (document.visibilityState === 'visible') start(); else stop(); };
       start();
       document.addEventListener('visibilitychange', onVis);
       return () => { stop(); document.removeEventListener('visibilitychange', onVis); };
    }, []);

   if (loading || !data) return <CardSkeleton glow="rgba(88,101,242,0.25)" />;

   const activeMembers = (data as any).members.filter((m: any) => m.game);
   const squad = data.members.slice(0, 6);
   const extra = Math.max(0, data.presence_count - squad.length);

    return (
       <div className="perspective-1000 h-full">
          <div
             ref={ref}
             onPointerMove={move}
             onPointerLeave={leave}
             style={tiltStyle(tilt)}
             className="group relative h-full rounded-[26px] p-[1.5px] bg-gradient-to-b from-[#5865F2]/70 via-[#5865F2]/15 to-white/[0.06] shadow-[0_24px_70px_-20px_rgba(88,101,242,0.45)]"
          >
             <div className="relative h-full rounded-[24.5px] bg-[#0a0b16]/95 overflow-hidden flex flex-col">
                <div
                   className="absolute inset-0 pointer-events-none transition-opacity duration-300 z-10"
                   style={{
                      opacity: tilt.on ? 1 : 0,
                      background: `radial-gradient(420px circle at ${tilt.gx}% ${tilt.gy}%, rgba(88,101,242,0.22), transparent 65%)`,
                   }}
                />
                {/* توهّج علوي بنفسجي بدل البانر الطويل */}
                <div className="absolute -top-28 start-1/4 w-72 h-56 rounded-full animate-aurora pointer-events-none"
                   style={{ background: 'radial-gradient(circle, rgba(88,101,242,0.26) 0%, rgba(88,101,242,0.11) 40%, transparent 68%)' }} />
                <div className="absolute top-0 inset-x-16 h-px bg-gradient-to-l from-transparent via-[#5865F2]/60 to-transparent pointer-events-none" />

                {/* ===== ترويسة مضغوطة: السيرفر + المتصلين ===== */}
                <div className="relative px-5 pt-5 pb-4 flex items-center gap-3.5 shrink-0">
                   <div className="relative shrink-0">
                      <div className="absolute -inset-2 rounded-full opacity-40 group-hover:opacity-80 transition-opacity duration-500"
                         style={{ background: 'radial-gradient(circle, rgba(88,101,242,0.55) 0%, rgba(88,101,242,0.2) 55%, transparent 72%)' }} />
                      <div className="relative w-12 h-12 rounded-2xl overflow-hidden border border-[#5865F2]/60 bg-[#0a0b16] shadow-[0_10px_28px_rgba(0,0,0,0.6)] flex items-center justify-center">
                         <DiscordIcon className="w-6 h-6 text-[#5865F2]" />
                      </div>
                      <span className="absolute -bottom-1 -end-1 w-5 h-5 rounded-full bg-green-400 border-[3px] border-[#0a0b16] animate-pulse" />
                   </div>
                   <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                         <h3 className="text-base sm:text-lg font-black text-white tracking-tight leading-none truncate" dir="ltr">ABS COMMUNITY</h3>
                         <span className="inline-flex items-center gap-1 text-[8px] font-black tracking-[0.18em] px-2 py-[3px] rounded-full bg-[#5865F2]/15 border border-[#5865F2]/40 text-[#9aa5ff] shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" /> ELITE
                         </span>
                      </div>
                      <p className="text-[11px] text-white/45 font-bold mt-1 truncate">{lang === 'en' ? 'Legends hangout' : 'أكبر تجمع للأساطير'}</p>
                   </div>
                   <p className="ms-auto text-end shrink-0">
                      <span className="block text-lg sm:text-xl font-black text-white leading-none" dir="ltr">{data.presence_count}</span>
                      <span className="block text-[8px] font-black tracking-[0.2em] text-[#8b96ff] uppercase mt-0.5">{lang === 'en' ? 'online' : 'متصل'}</span>
                   </p>
                </div>

                {/* ===== بانر السيرفر: العنصر البصري البطل (يقابل الفيديو) ===== */}
                <div className="px-5 relative">
                   <div className="group/banner relative block rounded-2xl overflow-hidden border border-white/10 bg-black shadow-[0_18px_44px_-16px_rgba(88,101,242,0.35)]">
                      <div className="relative aspect-[21/9]">
                         <img
                            src="discord-banner.jpg"
                            alt="ABS Community Discord server"
                            loading="lazy"
                            decoding="async"
                            width={640}
                            height={274}
                            className="w-full h-full object-cover opacity-90 group-hover:scale-105 transition-transform duration-[2.5s] ease-out"
                         />
                         <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/20" />
                         <span className="absolute top-2.5 start-2.5 inline-flex items-center gap-1 text-[8px] font-black tracking-[0.2em] px-2 py-1 rounded-lg bg-[#5865F2] text-white shadow-[0_0_16px_rgba(88,101,242,0.6)]">
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                            {lang === 'en' ? 'LIVE SERVER' : 'سيرفر نشط'}
                         </span>
                         <span className="absolute bottom-2.5 start-2.5 end-2.5 text-[11px] sm:text-xs font-black text-white leading-snug truncate text-start drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]" dir="ltr">ABS COMMUNITY</span>
                      </div>
                   </div>
                </div>

                {/* ===== الفرقة ===== */}
                <div className="px-5 mt-3 relative">
                   <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] p-3.5 flex items-center gap-3">
                      <div className="flex -space-x-2.5 rtl:space-x-reverse shrink-0">
                         {squad.map((m: any, i: number) => (
                            <img
                               key={i}
                               src={m.avatar_url}
                               alt={m.username}
                               loading="lazy"
                               decoding="async"
                               width={72}
                               height={72}
                               className="w-9 h-9 rounded-full border-2 border-[#0a0b16] bg-white/10 object-cover transition-transform duration-300 hover:scale-125 hover:-translate-y-1 hover:z-10 relative"
                               style={{ zIndex: squad.length - i }}
                            />
                         ))}
                         {extra > 0 && (
                            <span className="w-9 h-9 rounded-full border-2 border-[#0a0b16] bg-[#5865F2] flex items-center justify-center text-[10px] font-black text-white" dir="ltr">+{extra}</span>
                         )}
                      </div>
                      <div className="min-w-0 flex-1">
                         {activeMembers.length > 0 ? (
                            <>
                               <p className="text-[9px] font-black tracking-[0.25em] text-green-400 uppercase flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                                  {lang === 'en' ? 'now playing' : 'يلعب الآن'}
                               </p>
                               <p className="text-[13px] font-black text-white truncate mt-0.5">
                                  {activeMembers[0].username} <span className="text-white/35 font-bold">• {activeMembers[0].game.name}</span>
                               </p>
                            </>
                         ) : (
                            <>
                               <p className="text-[9px] font-black tracking-[0.25em] text-white/35 uppercase">{lang === 'en' ? 'squad standby' : 'الفرقة في الانتظار'}</p>
                               <p className="text-[13px] font-bold text-white/60 truncate mt-0.5">{lang === 'en' ? 'Be the first to deploy' : 'كن أول المنضمين'}</p>
                            </>
                         )}
                      </div>
                   </div>
                </div>

                {/* ===== زر الانضمام ===== */}
                <div className="px-5 pb-5 mt-3.5 flex-1 flex flex-col justify-end gap-3">
                   <p className="flex items-center gap-1.5 text-[10px] font-bold text-white/35">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      {data.name || (lang === 'en' ? 'Official server' : 'السيرفر الرسمي')}
                   </p>
                   <a
                      href={data.instant_invite}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={lang === 'en' ? 'Join Discord server' : 'انضم لسيرفر الديسكورد'}
                      className="btn-arena card-sheen relative w-full min-h-[52px] inline-flex items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-b from-[#7b86ff] to-[#5865F2] text-white font-black text-sm shadow-[0_14px_36px_-10px_rgba(88,101,242,0.7)] overflow-hidden"
                   >
                      <DiscordIcon className="w-5 h-5 shrink-0" />
                      {lang === 'en' ? 'JOIN THE SQUAD' : 'انضم للفرقة الآن'}
                      <svg className={`w-4 h-4 shrink-0 ${isRTL ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                   </a>
                </div>
             </div>
          </div>
       </div>
    );
};

/* ============================ YOUTUBE ============================ */
export const YoutubeWidget: React.FC<CommunityWidgetsProps> = ({ lang }) => {
   const [video, setVideo] = useState<YoutubeData | null>(null);
   const [subs, setSubs] = useState<string>(formatFollowerCount(FALLBACK.youtube));
   const [loading, setLoading] = useState(true);
   const { ref, tilt, move, leave } = useTilt(9);
   const isRTL = lang === 'ar';
   const channelId = 'UCdIM7MB-8G-FgE7ld3XAQ8w';
   const channelUrl = 'https://www.youtube.com/@ABS11';

   // Live subscriber count — shared pipeline (server API → LemnosLife → Mixerno → Piped mirrors → fallback)
   useEffect(() => {
      let alive = true;
      const loadSubs = async () => {
         try {
            const count = await getYouTubeSubscribers(channelId);
            if (alive && count > 0) setSubs(formatFollowerCount(count));
         } catch {
            /* keep last shown value */
         }
      };
       loadSubs();
       let interval: ReturnType<typeof setInterval> | null = null;
       const start = () => { if (!interval) interval = setInterval(loadSubs, 5 * 60 * 1000); };
       const stop = () => { if (interval) { clearInterval(interval); interval = null; } };
       const onVis = () => { if (document.visibilityState === 'visible') start(); else stop(); };
       start();
       document.addEventListener('visibilitychange', onVis);
       return () => { alive = false; stop(); document.removeEventListener('visibilitychange', onVis); };
    }, []);

   useEffect(() => {
      const fetchVideo = async () => {
         try {
            const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
            const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`;
            const response = await fetch(apiUrl);
            const data = await response.json();

            if (data.items && data.items.length > 0) {
               const latest = data.items[0];
               setVideo({
                  title: latest.title,
                  link: latest.link,
                  date: new Date(latest.pubDate).toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
                   thumbnail: latest.thumbnail.replace(/maxresdefault\.jpg.*$/, 'hqdefault.jpg')
               });
            } else {
               throw new Error('No items');
            }
         } catch (err) {
            console.error('YouTube fetch error:', err);
            setVideo({
               title: lang === 'en' ? 'ULTRA ELITE GAMING CONTENT' : 'أقـوى مـحـتوى ألعاب - iABS',
               link: channelUrl,
               date: 'CHANNELS',
               thumbnail: 'channels4_banner.jpg'
            });
         } finally {
            setLoading(false);
         }
      };
      fetchVideo();
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [lang]);

    if (loading && !video) return <CardSkeleton glow="rgba(255,0,0,0.25)" />;

    return (
       <div className="perspective-1000 h-full">
          <div
             ref={ref}
             onPointerMove={move}
             onPointerLeave={leave}
             style={tiltStyle(tilt)}
             className="group relative h-full rounded-[26px] p-[1.5px] bg-gradient-to-b from-[#FF2D2D]/70 via-[#FF2D2D]/15 to-white/[0.06] shadow-[0_24px_70px_-20px_rgba(255,45,45,0.45)]"
          >
             <div className="relative h-full rounded-[24.5px] bg-[#0d0505]/95 overflow-hidden flex flex-col">
                <div
                   className="absolute inset-0 pointer-events-none transition-opacity duration-300 z-10"
                   style={{
                      opacity: tilt.on ? 1 : 0,
                      background: `radial-gradient(420px circle at ${tilt.gx}% ${tilt.gy}%, rgba(255,45,45,0.2), transparent 65%)`,
                   }}
                />
                {/* توهّج علوي أحمر بدل البانر الطويل */}
                <div className="absolute -top-28 start-1/4 w-72 h-56 rounded-full animate-aurora pointer-events-none"
                   style={{ background: 'radial-gradient(circle, rgba(255,45,45,0.24) 0%, rgba(255,45,45,0.10) 40%, transparent 68%)' }} />
                <div className="absolute top-0 inset-x-16 h-px bg-gradient-to-l from-transparent via-[#FF2D2D]/60 to-transparent pointer-events-none" />

                {/* ===== ترويسة مضغوطة: القناة + المشتركين ===== */}
                <div className="relative px-5 pt-5 pb-4 flex items-center gap-3.5 shrink-0">
                   <div className="relative shrink-0">
                      <div className="absolute -inset-2 bg-[#FF2D2D]/50 blur-xl opacity-40 group-hover:opacity-80 transition-opacity duration-500 rounded-full" />
                      <div className="relative w-12 h-12 rounded-2xl overflow-hidden border border-[#FF2D2D]/60 bg-[#0d0505] shadow-[0_10px_28px_rgba(0,0,0,0.6)] flex items-center justify-center">
                         <YoutubeIcon className="w-6 h-6 text-[#FF2D2D]" />
                      </div>
                      <span className="absolute -bottom-1 -end-1 w-5 h-5 rounded-full bg-[#FF2D2D] border-[3px] border-[#0d0505] flex items-center justify-center">
                         <svg className="w-2 h-2 text-white fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                      </span>
                   </div>
                   <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                         <h3 className="text-base sm:text-lg font-black text-white tracking-tight leading-none truncate">{lang === 'en' ? 'iABS CHANNEL' : 'قناة iABS'}</h3>
                         <span className="inline-flex items-center gap-1 text-[8px] font-black tracking-[0.18em] px-2 py-[3px] rounded-full bg-[#FF2D2D]/15 border border-[#FF2D2D]/40 text-[#ff8080] shrink-0">
                            <YoutubeIcon className="w-2.5 h-2.5" /> YT
                         </span>
                      </div>
                      <p className="text-[11px] text-white/45 font-bold mt-1 truncate">{lang === 'en' ? 'VODs & best moments' : 'أرشيف البثوث وأجمل اللقطات'}</p>
                   </div>
                   <p className="ms-auto text-end shrink-0">
                      <span className="block text-lg sm:text-xl font-black text-white leading-none" dir="ltr">{subs}</span>
                      <span className="block text-[8px] font-black tracking-[0.2em] text-[#ff6b6b] uppercase mt-0.5">{lang === 'en' ? 'subs' : 'مشترك'}</span>
                   </p>
                </div>

                {/* ===== الفيديو: مستطيل 16:9 هو بطل البطاقة ===== */}
                <div className="px-5 relative">
                   <a
                      href={video?.link || channelUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={video?.title || 'Latest video'}
                      className="group/vid relative block rounded-2xl overflow-hidden border border-white/10 bg-black shadow-[0_18px_44px_-16px_rgba(255,45,45,0.35)]"
                   >
                      <div className="relative aspect-video">
                         <img
                            src={video?.thumbnail || 'channels4_banner.jpg'}
                            alt={video?.title || 'Latest video'}
                            loading="lazy"
                            decoding="async"
                            width={480}
                            height={360}
                            className="w-full h-full object-cover opacity-90 group-hover/vid:opacity-100 group-hover/vid:scale-105 transition-all duration-700"
                            onError={(e) => {
                               const target = e.target as HTMLImageElement;
                               if (target.src.includes('maxresdefault')) target.src = target.src.replace('maxresdefault', 'hqdefault');
                               else target.src = 'channels4_banner.jpg';
                            }}
                         />
                         <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/15 to-black/10" />
                         <span className="absolute top-2.5 start-2.5 inline-flex items-center gap-1 text-[8px] font-black tracking-[0.2em] px-2 py-1 rounded-lg bg-[#FF2D2D] text-white shadow-[0_0_16px_rgba(255,45,45,0.6)]">
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                            {lang === 'en' ? 'LATEST' : 'الأحدث'}
                         </span>
                         <span className="absolute inset-0 m-auto w-12 h-12 rounded-full bg-black/45 backdrop-blur-md border border-white/40 flex items-center justify-center transition-transform duration-300 group-hover/vid:scale-125 shadow-[0_0_28px_rgba(255,45,45,0.5)]">
                            <svg className="w-5 h-5 text-white fill-current translate-x-[1px] rtl:-translate-x-[1px] rtl:rotate-180" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                         </span>
                         <span className="absolute bottom-2.5 start-2.5 end-2.5 text-[11px] sm:text-xs font-black text-white leading-snug line-clamp-2 text-start drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">{video?.title}</span>
                      </div>
                   </a>
                </div>

                {/* ===== تاريخ النشر + زر الاشتراك ===== */}
                <div className="px-5 pb-5 mt-3.5 flex-1 flex flex-col justify-end gap-3">
                   {video?.date && (
                      <p className="flex items-center gap-1.5 text-[10px] font-bold text-white/35">
                         <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                         {video.date}
                      </p>
                   )}
                   <a
                      href={channelUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={lang === 'en' ? 'Visit YouTube channel' : 'زيارة قناة اليوتيوب'}
                      className="btn-arena card-sheen relative w-full min-h-[52px] inline-flex items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-b from-[#ff4d4d] to-[#cc0000] text-white font-black text-sm shadow-[0_14px_36px_-10px_rgba(255,0,0,0.7)] overflow-hidden"
                   >
                      <YoutubeIcon className="w-5 h-5 shrink-0" />
                      {lang === 'en' ? 'SUBSCRIBE NOW' : 'اشترك الآن'}
                      <svg className={`w-4 h-4 shrink-0 ${isRTL ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                   </a>
                </div>
             </div>
          </div>
       </div>
    );
};

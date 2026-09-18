import React, { useState, useEffect } from 'react';
import { DiscordIcon, YoutubeIcon } from './Icons';
import { Language } from '../types';

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

export const DiscordWidget: React.FC<CommunityWidgetsProps> = ({ lang }) => {
   const [data, setData] = useState<DiscordData | null>(null);
   const [loading, setLoading] = useState(true);

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
      const interval = setInterval(fetchDiscord, 60000);
      return () => clearInterval(interval);
   }, []);

   if (loading || !data) {
      return (
         <div className="aspect-square w-full bg-[#0a0b14] rounded-[48px] animate-pulse border-8 border-white/5" />
      );
   }

   const isRTL = lang === 'ar';
   const activeMembers = (data as any).members.filter((m: any) => m.game);
   const squadAvatars = data.members.slice(0, 12);

   return (
    <div className="group relative flex flex-col h-auto min-h-[350px] sm:min-h-[380px] md:min-h-[500px] w-full bg-[#0a0b14] border-[4px] sm:border-[6px] md:border-[10px] border-[#5865F2]/20 rounded-[24px] sm:rounded-[32px] md:rounded-[56px] overflow-hidden transition-all duration-700 hover:border-[#5865F2]/40 hover:shadow-[0_0_100px_rgba(88,101,242,0.15)] hover:-translate-y-2 pb-3 sm:pb-4 md:pb-10">
         {/* BACKGROUND LINK */}
         <a
            href={data.instant_invite}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute inset-0 z-40"
            aria-label="Join Discord"
         />

         {/* Background Ambience */}
         <div className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-[#5865F2] to-transparent animate-plasma-flow z-20"></div>
         <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(88,101,242,0.1),transparent_50%)]"></div>
         <div className="absolute inset-0 opacity-5 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:30px_30px]"></div>

         {/* 0. TOP BANNER - RECLAIMED SPACE FOR MOBILE ACTION */}
         <div className="relative h-16 md:h-[25%] w-full overflow-hidden shrink-0 z-0">
            <img src="/12ab6917-943c-4013-a96f-18156e8ed881.png" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-[5000ms]" />
            <div className="absolute inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-[#5865F2] to-transparent animate-plasma-flow z-20 top-0"></div>
            <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-[#0a0b14] to-95%"></div>
         </div>

         {/* 2. LAYERED PROFILE LOGO - OPTIMIZED ANCHOR */}
         <div className="absolute top-[35px] md:top-[25%] left-1/2 -translate-x-1/2 md:-translate-y-1/2 z-30 flex flex-col items-center pointer-events-none">
            <div className="relative">
               <div className="absolute -inset-10 bg-[#5865F2] blur-3xl opacity-0 group-hover:opacity-40 transition-opacity duration-700"></div>
               <div className="relative w-16 h-16 md:w-28 md:h-28 rounded-[12px] md:rounded-[42px] p-0.5 md:p-1.5 bg-[#0a0b14] border-[2px] md:border-[3px] border-white/10 shadow-2xl overflow-hidden transform group-hover:rotate-[6deg] transition-all duration-700">
                  <img src="/favicon.png" className="w-full h-full object-cover rounded-[10px] md:rounded-[34px]" />
               </div>
            </div>
         </div>

         <div className="relative z-10 p-4 md:p-5 flex-1 flex flex-col items-center">

            {/* HEADER: PUSHED DOWN FOR LOGO */}
            <div className="text-center mt-8 md:mt-14 mb-2 md:mb-2 w-full">
               <h2 className="text-xl md:text-2xl lg:text-3xl font-black text-white tracking-widest leading-none mb-1 md:mb-2 uppercase drop-shadow-md">
                  ABS COMMUNITY
               </h2>
               <div className="flex items-center justify-center gap-1 md:gap-2">
                  <div className="px-2 py-0.5 md:px-3 md:py-1 bg-[#5865F2]/20 border border-[#5865F2]/30 rounded-md text-[8px] md:text-[10px] font-black text-white/70 uppercase tracking-[0.1em] md:tracking-[0.2em] flex items-center gap-1 md:gap-2 backdrop-blur-xl">
                     <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                     ELITE
                  </div>
               </div>
            </div>

            {/* CONTENT CENTER: SQUAD PREVIEW & LIVE ACTIVITY */}
            <div className="flex flex-col items-center justify-center pointer-events-none p-2 md:p-4 w-full flex-1">
               <div className="flex flex-col items-center gap-3 md:gap-6">
                  {/* Squad Avatars */}
                  <div className="flex -space-x-2 md:-space-x-3">
                     {squadAvatars.slice(0, 4).map((m: any, i: number) => (
                        <img key={i} src={m.avatar_url} className="w-6 h-6 md:w-10 md:h-10 rounded-full border-2 border-[#0a0b14] bg-white/5 shadow-xl" />
                     ))}
                     <div className="w-6 h-6 md:w-10 md:h-10 rounded-full border-2 border-[#0a0b14] bg-[#5865F2] flex items-center justify-center text-[7px] md:text-[10px] font-black text-white shadow-xl">
                        +{data.presence_count - 4}
                     </div>
                  </div>

                  {/* LIVE ACTIVITY - FILLS THE SPACE PROFESSIONALLY */}
                  <div className="md:flex hidden flex-col items-center text-center">
                     <div className="w-8 h-px bg-white/10 mb-2 opacity-30"></div>
                     <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em] mb-2">SQUAD ACTIVE</p>
                     {activeMembers.length > 0 ? (
                        <div className="flex flex-col gap-1 items-center bg-white/[0.02] border border-white/5 rounded-xl px-4 py-2 backdrop-blur-sm">
                           <span className="text-xs md:text-sm font-black text-white/90 tracking-wide line-clamp-1">
                              {activeMembers[0].username}
                           </span>
                           <span className="text-[10px] md:text-xs font-bold text-[#5865F2] italic opacity-80 uppercase tracking-widest line-clamp-1">
                              {activeMembers[0].game.name}
                           </span>
                        </div>
                     ) : (
                        <p className="text-[10px] font-black text-white/10 uppercase tracking-[0.2em]">SQUAD STANDBY</p>
                     )}
                  </div>

                  <div className="md:hidden flex items-center gap-2">
                     <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                     <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">SQUAD ACTIVE</span>
                  </div>
               </div>
            </div>

        {/* FOOTER AREA: ACTION & STATS - ANCHORED TO BOTTOM */}
        <div className="mt-auto w-full flex flex-col items-center gap-0.5 md:gap-1.5 pt-1 border-t border-white/[0.03]">
               <div className="flex items-center gap-2 md:gap-4 mb-0.5 md:mb-0">
                  <span className="text-[8px] md:text-lg font-black text-white italic leading-none">{data.presence_count} LIVE</span>
                  <div className="w-px h-2 md:h-4 bg-white/10"></div>
                  <span className="text-[5px] md:text-[9px] font-black text-[#5865F2] tracking-widest uppercase">8.6K TOTAL</span>
               </div>

               {/* ACTION BUTTON: LARGE CENTERED - NOW VISIBLE */}
               <div className="group/btn relative w-full flex justify-center pointer-events-auto z-50 mb-0.5 md:mb-0">
                  <div className="relative w-full px-4 py-1 md:px-12 md:py-3.5 bg-[#5865F2] rounded-[10px] md:rounded-[24px] shadow-[0_10px_30px_rgba(88,101,242,0.3)] hover:scale-[1.03] active:scale-95 transition-all duration-500 cursor-pointer overflow-hidden flex items-center justify-center gap-2 md:gap-3">
                     <div className="absolute inset-x-0 -bottom-10 h-20 bg-white blur-[80px] opacity-0 group-hover/btn:opacity-10 transition-opacity"></div>
                     <span className="text-[6px] md:text-xs font-black text-white uppercase tracking-[0.05em] md:tracking-[0.1em] leading-none">
                        {lang === 'en' ? 'DEPLOY NOW' : 'انـضـم الآن'}
                     </span>
                     <svg className={`w-3 h-3 md:w-5 md:h-5 ${isRTL ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                  </div>
               </div>
            </div>

         </div>
      </div>
   );
};

export const YoutubeWidget: React.FC<CommunityWidgetsProps> = ({ lang }) => {
   const [video, setVideo] = useState<YoutubeData | null>(null);
   const [subs, setSubs] = useState<string>('74.8K');
   const [loading, setLoading] = useState(true);
   const channelId = 'UCdIM7MB-8G-FgE7ld3XAQ8w';
   const channelUrl = 'https://www.youtube.com/@ABS11';

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
                  thumbnail: latest.thumbnail.replace('hqdefault.jpg', 'maxresdefault.jpg')
               });
            } else {
               throw new Error('No items');
            }

            // --- FETCH REAL SUBSCRIBER COUNT ---
            try {
               const statsRes = await fetch(`https://pipedapi.kavin.rocks/channel/${channelId}`);
               const statsData = await statsRes.json();
               if (statsData.subscriberCount) {
                  const count = statsData.subscriberCount;
                  if (count >= 1000) {
                     setSubs(`${(count / 1000).toFixed(1)}K+`);
                  } else {
                     setSubs(`${count}`);
                  }
               }
            } catch (err) {
               console.warn("Subscriber fetch failed, using fallback:", err);
            }
         } catch (err) {
            console.error('YouTube fetch error:', err);
            setVideo({
               title: lang === 'en' ? 'ULTRA ELITE GAMING CONTENT' : 'أقـوى مـحـتوى ألعاب - iABS',
               link: channelUrl,
               date: 'CHANNELS',
               thumbnail: '/channels4_banner.jpg'
            });
         } finally {
            setLoading(false);
         }
      };
      fetchVideo();
   }, [lang]);

   if (loading && !video) {
      return (
         <div className="aspect-square w-full bg-[#050000] rounded-[48px] animate-pulse border-8 border-white/5" />
      );
   }

   const isRTL = lang === 'ar';

   return (
    <div className="group relative flex flex-col h-auto min-h-[350px] sm:min-h-[380px] md:min-h-[500px] w-full bg-[#050000] border-[4px] sm:border-[6px] md:border-[10px] border-[#FF0000]/20 rounded-[24px] sm:rounded-[32px] md:rounded-[56px] overflow-hidden transition-all duration-700 hover:border-[#FF0000]/40 hover:shadow-[0_0_100px_rgba(255,0,0,0.15)] hover:-translate-y-2 pb-3 sm:pb-4 md:pb-10">
         {/* BACKGROUND LINK */}
         <a
            href={channelUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute inset-0 z-10"
            aria-label="Visit Channel"
         />

         {/* 1. TOP BANNER - RECLAIMED SPACE FOR MOBILE ACTION */}
         <div className="relative h-16 md:h-[25%] w-full overflow-hidden shrink-0 z-0">
            <img src="/channels4_banner.jpg" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-[5000ms]" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-[#050000]"></div>
            <div className="absolute inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-[#FF0000] to-transparent animate-plasma-flow z-20 top-0"></div>
         </div>

         {/* 2. LAYERED PROFILE LOGO - OPTIMIZED ANCHOR */}
         <div className="absolute top-[35px] md:top-[25%] left-1/2 -translate-x-1/2 md:-translate-y-1/2 z-30 flex flex-col items-center pointer-events-none">
            <div className="relative">
               <div className="absolute -inset-10 bg-[#FF0000] blur-3xl opacity-0 group-hover:opacity-40 transition-opacity duration-700"></div>
               <div className="relative w-16 h-16 md:w-28 md:h-28 rounded-[12px] md:rounded-[42px] p-0.5 md:p-1.5 bg-[#050000] border-[2px] md:border-[3px] border-white/10 shadow-2xl overflow-hidden transform group-hover:rotate-[-6deg] transition-all duration-700">
                  <img src="/favicon.png" className="w-full h-full object-cover rounded-[10px] md:rounded-[34px]" />
               </div>
            </div>
         </div>

         <div className="relative z-10 p-4 lg:p-6 flex-1 flex flex-col items-center">

            {/* 3. CHANNEL INFO & SPACER - RESTORED GAP */}
            <div className="text-center mt-8 md:mt-14 mb-2 lg:mb-2 w-full">
               <h2 className="text-2xl md:text-3xl lg:text-4xl font-black text-white tracking-widest leading-none mb-1 md:mb-2 uppercase drop-shadow-md">
                  {lang === 'en' ? 'ABS' : 'قـناة iABS'}
               </h2>
               <div className="flex items-center justify-center gap-1 md:gap-2">
                  <div className="px-2 py-0.5 md:px-3 md:py-1 bg-white/[0.03] border border-white/5 rounded-md text-[8px] md:text-[10px] font-black text-white/40 uppercase tracking-[0.1em] md:tracking-[0.2em] flex items-center gap-1 md:gap-2 backdrop-blur-xl">
                     <span className="w-1.5 h-1.5 rounded-full bg-[#FF0000] animate-pulse"></span>
                     ELITE
                  </div>
               </div>
            </div>

            {/* 4. CONTENT CENTER: DYNAMIC THUMBNAIL */}
            <div className="w-full flex flex-col items-center justify-center gap-2 md:gap-3 pointer-events-none px-4 mb-2 md:mb-4">

               {/* Professional Video Preview Frame */}
               <div className="relative w-full max-w-[150px] md:max-w-[180px] aspect-video rounded-xl md:rounded-2xl overflow-hidden border border-white/10 shadow-2xl group/thumb">
                  <img
                     src={video?.thumbnail || "/channels4_banner.jpg"}
                     className="w-full h-full object-cover opacity-80 group-hover:scale-110 transition-all duration-700"
                     alt="Latest Video Preview"
                     onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        if (target.src.includes('maxresdefault')) {
                           target.src = target.src.replace('maxresdefault', 'hqdefault');
                        } else {
                           target.src = "/channels4_banner.jpg";
                        }
                     }}
                  />

                  {/* Play Button Icon Overlay */}
                  <div className="absolute inset-0 flex items-center justify-center">
                     <div className="w-10 h-10 rounded-full bg-[#FF0000]/20 backdrop-blur-md border border-white/30 flex items-center justify-center group-hover:scale-110 transition-transform shadow-[0_0_20px_rgba(255,0,0,0.4)]">
                        <svg className="w-4 h-4 text-white fill-current" viewBox="0 0 24 24">
                           <path d="M8 5v14l11-7z" />
                        </svg>
                     </div>
                  </div>
               </div>

               <h3 className="text-[11px] md:text-sm lg:text-base font-black text-white/95 leading-tight text-center line-clamp-2 drop-shadow-2xl">
                  {video?.title}
               </h3>
            </div>

        {/* 5. FOOTER AREA: ACTION & STATS - ANCHORED TO BOTTOM */}
        <div className="mt-auto w-full flex flex-col items-center gap-0.5 md:gap-3 pt-1 border-t border-white/[0.03]">
               <div className="flex items-center gap-3 md:gap-5 mb-0.5 md:mb-0">
                  <span className="text-[9px] md:text-2xl font-black text-white italic leading-none drop-shadow-md">{subs}</span>
                  <div className="w-px h-2 md:h-5 bg-white/10"></div>
                  <span className="text-[7px] md:text-[11px] font-black text-[#FF0000] tracking-widest uppercase">4K-HDR</span>
               </div>

               {/* ACTION BUTTON: SPECIFIC VIDEO LINK */}
               <div className="group/btn relative w-full flex justify-center pointer-events-auto z-50 mb-0.5 md:mb-1">
                  <a
                     href={video?.link || channelUrl}
                     target="_blank"
                     rel="noopener noreferrer"
                     className="relative w-full px-4 py-1 md:px-14 md:py-3 bg-[#FF0000] rounded-[10px] md:rounded-[28px] shadow-[0_10px_30px_rgba(255,0,0,0.3)] hover:scale-[1.05] active:scale-95 transition-all duration-500 cursor-pointer overflow-hidden flex items-center justify-center gap-2 md:gap-3"
                  >
                     <div className="absolute inset-x-0 -bottom-10 h-20 bg-white blur-[80px] opacity-0 group-hover/btn:opacity-20 transition-opacity"></div>
                     <span className="text-[7px] md:text-sm font-black text-white uppercase tracking-[0.05em] md:tracking-[0.1em] leading-none">
                        {lang === 'en' ? 'WATCH NOW' : 'شـاهـد الآن'}
                     </span>
                     <div className="w-4 h-4 md:w-8 md:h-8 rounded-full bg-white/10 backdrop-blur-md text-white flex items-center justify-center shrink-0 border border-white/20">
                        <svg className={`w-2.5 h-2.5 md:w-4.5 md:h-4.5 ${isRTL ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                     </div>
                  </a>
               </div>
            </div>

         </div>
      </div>
   );
};




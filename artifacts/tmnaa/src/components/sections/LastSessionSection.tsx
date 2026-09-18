import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { kickFetch } from '@/lib/kickApi';
import type { LastSession } from '@/lib/types';

const easeOut = [0.22, 1, 0.36, 1] as const;
const CHANNEL_SLUG = 'tmnaa';
const DEFAULT_THUMB = '/src/assets/TMNAA_website_UI_header_2K_202607271838_1785166733964.jpeg';

function timeAgo(date: string) {
  if (!date) return '---';
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function formatDuration(val: number) {
  if (!val) return '0h 0m';
  const totalSeconds = val > 1000000 ? Math.floor(val / 1000) : val;
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  return `${h}h ${m}m`;
}

export function LastSessionSection() {
  const [session, setSession] = useState<LastSession | null>(null);
  const [clips, setClips] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = () => {
      kickFetch(`https://kick.com/api/v2/channels/${CHANNEL_SLUG}`).then((data) => {
        if (!data) return;
        kickFetch(`https://kick.com/api/v2/channels/${CHANNEL_SLUG}/videos`).then((raw) => {
          const videos = raw?.videos || (Array.isArray(raw) ? raw : []);
          if (videos.length > 0) setSession(videos[0]);
          else {
            const streams = data.previous_livestreams || data.recent_streams || [];
            if (streams.length > 0) setSession(streams[0]);
          }
        });
        kickFetch(`https://kick.com/api/v2/channels/${CHANNEL_SLUG}/clips?limit=5`).then((clipRaw) => {
          const clipData = clipRaw?.data || clipRaw;
          const arr = clipData?.clips || (Array.isArray(clipData) ? clipData : clipData?.data && Array.isArray(clipData.data) ? clipData.data : []);
          setClips(arr.slice(0, 3));
        });
      });
    };

    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  if (!session && clips.length === 0) return null;

  const thumbnail = session?.thumbnail?.url || session?.thumbnail?.src || (typeof session?.thumbnail === 'string' ? session.thumbnail : '') || `https://image.kick.com/image-v2/stream/${session?.id || 'fallback'}/desktop.webp` || DEFAULT_THUMB;

  return (
    <section className="py-20 md:py-28 px-6 relative">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: easeOut }}
          className="bg-[rgba(9,8,7,0.6)] backdrop-blur-lg border border-white/5 rounded-[40px] p-8 md:p-12 relative overflow-hidden"
        >
          {/* Glow */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#D4A84A]/5 blur-[120px] -translate-y-1/2 translate-x-1/2 opacity-50 pointer-events-none" />

          <div className="relative z-10">
            {/* Header */}
            <div className="flex items-center gap-3 mb-8">
              <div className="w-2.5 h-2.5 rounded-full bg-[#D4A84A] shadow-[0_0_15px_#D4A84A] animate-pulse" />
              <span className="text-[11px] font-black tracking-[0.4em] uppercase" style={{ color: 'rgba(247,243,238,0.4)' }}>LAST SESSION REPORT</span>
            </div>

            {/* Main Content */}
            <div className="flex flex-col lg:flex-row gap-8 items-start">
              {/* Thumbnail */}
              <div className="w-full lg:w-[320px] shrink-0 aspect-video rounded-3xl overflow-hidden border border-white/10 shadow-2xl">
                <img src={thumbnail} alt="Last Session" loading="lazy" className="w-full h-full object-cover" />
              </div>

              {/* Info */}
              <div className="flex-1 flex flex-col w-full min-w-0">
                <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight leading-tight mb-8">
                  {session?.session_title || session?.title || 'Last Stream'}
                </h2>
                <div className="flex flex-wrap gap-4">
                  <div className="flex-1 min-w-[140px] bg-white/5 border border-white/10 rounded-3xl px-6 py-5 text-center backdrop-blur-md">
                    <p className="text-[10px] font-bold uppercase mb-2 tracking-widest" style={{ color: 'rgba(247,243,238,0.3)' }}>AGO</p>
                    <p className="text-xl md:text-2xl font-black text-white">{timeAgo(session?.created_at || '')}</p>
                  </div>
                  <div className="flex-1 min-w-[140px] bg-white/5 border border-white/10 rounded-3xl px-6 py-5 text-center backdrop-blur-md">
                    <p className="text-[10px] font-bold uppercase mb-2 tracking-widest" style={{ color: 'rgba(247,243,238,0.3)' }}>DURATION</p>
                    <p className="text-xl md:text-2xl font-black text-[#D4A84A]">{formatDuration(session?.duration || 0)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Categories */}
            {session?.categories && session.categories.length > 0 && (
              <div className="mt-8 pt-6 border-t border-white/5">
                <p className="text-[10px] font-black tracking-[0.2em] uppercase mb-4" style={{ color: 'rgba(247,243,238,0.3)' }}>CATEGORIES SPENT IN STREAM</p>
                <div className="flex flex-wrap gap-3">
                  {session.categories.map((cat: any, i: number) => {
                    const catName = cat.name || cat.category?.name || 'Just Chatting';
                    const slug = cat.slug || cat.category?.slug || catName.toLowerCase().replace(/\s+/g, '-');
                    const catImg = cat.banner?.url || cat.category?.banner?.url || cat.thumbnail?.url || `https://files.kick.com/categories/${slug}/fullsize.png`;
                    return (
                      <div key={i} className="flex items-center gap-2 bg-white/5 border border-white/5 rounded-full pl-1 pr-3 py-1">
                        <div className="w-8 h-8 rounded-full overflow-hidden border border-white/10 bg-[#111]">
                          <img src={catImg} alt={catName} loading="lazy" className="w-full h-full object-cover"
                            onError={(e) => { (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${slug}/200/200`; }} />
                        </div>
                        <span className="text-[10px] font-bold" style={{ color: 'rgba(247,243,238,0.7)' }}>{catName}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Highlights Clips */}
            {clips.length > 0 && (
              <div className="mt-12 pt-8 border-t border-white/5">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-2 h-2 rounded-full bg-[#53FC18] shadow-[0_0_10px_#53FC18]" />
                  <span className="text-[12px] font-black tracking-[0.2em] uppercase" style={{ color: 'rgba(247,243,238,0.4)' }}>STREAM HIGHLIGHTS</span>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  {clips.map((clip: any, i: number) => (
                    <a key={clip.id || i} href={`https://kick.com/${CHANNEL_SLUG}?clip=${clip.id}`} target="_blank" rel="noopener noreferrer"
                      className="group relative aspect-video rounded-2xl overflow-hidden border border-white/5 bg-black/40 hover:border-[#D4A84A]/50 transition-all duration-500 shadow-lg">
                      <img src={clip.thumbnail_url || thumbnail} alt={clip.title} loading="lazy" className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-transform duration-700 group-hover:scale-110" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/20 to-transparent" />
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <div className="w-10 h-10 rounded-full bg-[#53FC18]/20 backdrop-blur-md border border-[#53FC18]/50 flex items-center justify-center">
                          <svg className="w-5 h-5 text-[#53FC18] fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                        </div>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 p-3">
                        <p className="text-[11px] font-bold text-white truncate drop-shadow-md">{clip.title}</p>
                        <span className="text-[9px] text-white/40">{clip.view_count || 0} views</span>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

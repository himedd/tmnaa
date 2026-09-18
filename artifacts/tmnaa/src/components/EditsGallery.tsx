import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Play, ExternalLink, X, Link2, Image as ImageIcon, Film } from 'lucide-react';
import {
  hostOf,
  tiktokEmbedUrl,
  timeAgo,
  type WallItem,
} from '@/lib/wallApi';

const easeOut = [0.22, 1, 0.36, 1] as const;

function Thumb({ sub, className }: { sub: WallItem; className?: string }) {
  if (sub.posterUrl) {
    return <img src={sub.posterUrl} alt={sub.caption || sub.name} loading="lazy" className={`w-full h-full object-cover ${className || ''}`} />;
  }
  return (
    <div
      className={`w-full h-full flex flex-col items-center justify-center gap-2 ${className || ''}`}
      style={{ background: 'linear-gradient(135deg, rgba(45,27,20,0.9), rgba(14,10,8,0.95))' }}
    >
      <Link2 className="w-6 h-6 text-[#D9A441]/70" />
      <span className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: 'rgba(217,164,65,0.6)' }}>
        {hostOf(sub.url)}
      </span>
    </div>
  );
}

function Lightbox({ sub, onClose }: { sub: WallItem; onClose: () => void }) {
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

  const embed = sub.mediaType === 'link' && sub.url ? tiktokEmbedUrl(sub.url) : null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-[300] flex items-center justify-center p-4 md:p-8"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/85 backdrop-blur-xl" />

      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 40 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0, y: 40 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-4xl bg-[#0a0a0a] rounded-[32px] overflow-hidden border border-white/10 shadow-2xl shadow-black/60"
        style={{ boxShadow: '0 25px 80px rgba(0,0,0,0.7), 0 0 60px rgba(217,164,65,0.06)' }}
      >
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#D4A84A]/40 to-transparent" />

        <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
          {sub.mediaType === 'video' && sub.mediaUrl ? (
            <video src={sub.mediaUrl} className="w-full h-full object-contain" controls autoPlay playsInline preload="metadata" />
          ) : sub.mediaType === 'video' ? (
            <div className="relative w-full h-full">
              {sub.posterUrl && <img src={sub.posterUrl} alt={sub.name} className="w-full h-full object-contain opacity-40" />}
              <Film className="absolute inset-0 m-auto w-9 h-9 text-[#D9A441]/70" />
            </div>
          ) : embed ? (
            <iframe
              src={embed}
              title={sub.caption || sub.name}
              className="w-full h-full"
              allow="encrypted-media; fullscreen; picture-in-picture"
              allowFullScreen
            />
          ) : sub.mediaType === 'link' ? (
            <div className="relative w-full h-full flex flex-col items-center justify-center gap-4 px-6 text-center">
              <>
                <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: 'rgba(217,164,65,0.08)', border: '1px solid rgba(217,164,65,0.3)' }}>
                  <Link2 className="w-7 h-7 text-[#D9A441]" />
                </div>
                <span className="text-sm font-bold text-white/70">Hosted on {hostOf(sub.url)}</span>
              </>
            </div>
          ) : sub.posterUrl ? (
            <img src={sub.posterUrl} alt={sub.caption || sub.name} className="w-full h-full object-contain" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ImageIcon className="w-9 h-9 text-white/30" />
            </div>
          )}
          <div className="absolute inset-0 pointer-events-none ring-1 ring-white/5" />
        </div>

        <div className="flex items-start justify-between gap-4 p-4 md:p-5 bg-gradient-to-b from-[#0d0d0d] to-[#080808]">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm md:text-lg font-bold text-white truncate">{sub.caption || 'Untitled Edit'}</h3>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-xs font-bold" style={{ color: '#D9A441' }}>@{sub.name}</span>
              <span className="w-1 h-1 rounded-full bg-white/20" />
              <span className="text-[11px] text-white/40">{timeAgo(sub.createdAt)}</span>
              <span className="w-1 h-1 rounded-full bg-white/20" />
              <span className="text-[11px] text-white/40 inline-flex items-center gap-1">
                <Heart className="w-3 h-3 text-[#D94A2B]" /> {sub.likes}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {sub.mediaType === 'link' && sub.url && (
              <a
                href={sub.url}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:inline-flex items-center gap-2 h-10 px-4 rounded-full text-[12px] font-bold transition-all duration-300 hover:scale-105"
                style={{ border: '1px solid rgba(217,164,65,0.35)', color: '#D9A441', background: 'rgba(217,164,65,0.06)' }}
              >
                <ExternalLink className="w-3.5 h-3.5" /> Open
              </a>
            )}
            <button
              onClick={onClose}
              className="relative w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all duration-300 flex items-center justify-center group/btn shrink-0"
              aria-label="Close"
            >
              <X className="w-4 h-4 text-white/60 group-hover/btn:text-white/90 transition-colors" />
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function EditsGallery({ submissions }: { submissions: WallItem[] }) {
  const [sort, setSort] = useState<'newest' | 'top'>('newest');
  const [selected, setSelected] = useState<WallItem | null>(null);

  const visible = useMemo(() => {
    if (sort === 'newest') {
      return [...submissions].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    }
    return [...submissions].sort((a, b) => b.likes - a.likes);
  }, [submissions, sort]);

  const onClose = useCallback(() => setSelected(null), []);

  const sortBtn = (value: 'newest' | 'top', label: string) => {
    const active = sort === value;
    return (
      <button
        onClick={() => setSort(value)}
        className="px-4 h-9 rounded-full text-[12px] font-bold tracking-wide transition-all duration-300"
        style={{
          fontFamily: 'Cairo, sans-serif',
          color: active ? '#0d0906' : 'rgba(247,243,238,0.6)',
          background: active ? 'linear-gradient(135deg, #E8B45C, #D9A441)' : 'rgba(217,164,65,0.06)',
          border: active ? '1px solid transparent' : '1px solid rgba(217,164,65,0.15)',
          boxShadow: active ? '0 0 18px rgba(217,164,65,0.3)' : 'none',
        }}
      >
        {label}
      </button>
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div className="flex items-baseline gap-3">
          <h2 className="text-2xl md:text-3xl font-black tracking-tight" style={{ fontFamily: 'Cairo, sans-serif', color: '#F7F3EE' }}>
            The Wall
          </h2>
          <span className="text-sm font-bold" style={{ color: 'rgba(217,164,65,0.7)' }}>
            {visible.length} {visible.length === 1 ? 'edit' : 'edits'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {sortBtn('newest', 'Newest')}
          {sortBtn('top', 'Most Liked')}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-[28px] py-16 text-center" style={{ background: 'rgba(9,8,7,0.6)', border: '1px solid rgba(217,164,65,0.12)' }}>
          <p className="text-sm font-bold" style={{ color: 'rgba(247,243,238,0.5)' }}>No edits yet — be the first to submit.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {visible.map((sub, i) => (
            <motion.button
              key={sub.id}
              type="button"
              onClick={() => setSelected(sub)}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.55, delay: Math.min(i, 6) * 0.05, ease: easeOut }}
              className="group relative text-left w-full rounded-[22px] overflow-hidden transition-all duration-500 hover:-translate-y-1.5 border border-[rgba(217,164,65,0.14)] hover:border-[#D9A441]/50"
              style={{
                background: 'linear-gradient(160deg, rgba(26,18,13,0.95), rgba(16,11,8,0.92))',
                boxShadow: '0 6px 22px rgba(0,0,0,0.4)',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.boxShadow = '0 14px 45px rgba(255,122,24,0.18), 0 0 60px rgba(217,164,65,0.08)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 22px rgba(0,0,0,0.4)';
              }}
            >
              <div className="relative aspect-video overflow-hidden bg-black/50">
                <Thumb sub={sub} className="transition-transform duration-700 group-hover:scale-110" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
                {(sub.mediaType === 'video' || sub.mediaType === 'link') && (
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-md border border-[#D9A441]/50 flex items-center justify-center group-hover:scale-110 transition-transform">
                      {sub.mediaType === 'link' ? (
                        <ExternalLink className="w-5 h-5 text-[#D9A441]" />
                      ) : (
                        <Play className="w-5 h-5 text-[#D9A441] fill-[#D9A441] ml-0.5" />
                      )}
                    </div>
                  </div>
                )}
                <div className="absolute top-3 right-3 flex items-center gap-1 px-2.5 h-7 rounded-full bg-black/50 backdrop-blur-md border border-white/10">
                  <Heart className="w-3 h-3 text-[#D94A2B]" />
                  <span className="text-[11px] font-bold text-white/80">{sub.likes}</span>
                </div>
                {sub.kind === 'link' && (
                  <div className="absolute top-3 left-3 px-2.5 h-7 rounded-full bg-black/50 backdrop-blur-md border border-[#D9A441]/30 flex items-center gap-1">
                    <Link2 className="w-3 h-3 text-[#D9A441]" />
                    <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: '#D9A441' }}>Link</span>
                  </div>
                )}
              </div>
              <div className="p-4">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] mb-1" style={{ color: '#D9A441' }}>
                  @{sub.name}
                </p>
                <p className="text-[13.5px] leading-relaxed line-clamp-2" style={{ color: 'rgba(247,243,238,0.7)', minHeight: '2.6em' }}>
                  {sub.caption || '300K celebration edit'}
                </p>
                <p className="mt-2 text-[10.5px] uppercase tracking-[0.15em]" style={{ color: 'rgba(247,243,238,0.25)' }}>
                  {timeAgo(sub.createdAt)}
                </p>
              </div>
            </motion.button>
          ))}
        </div>
      )}

      <AnimatePresence>
        {selected && <Lightbox sub={selected} onClose={onClose} />}
      </AnimatePresence>
    </div>
  );
}
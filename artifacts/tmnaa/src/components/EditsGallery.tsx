import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Play, ExternalLink, X, Link2, Image as ImageIcon, Film, Volume2, VolumeX, Loader2, Flag, Download } from 'lucide-react';
import {
  hostOf,
  tiktokEmbedUrl,
  timeAgo,
  fetchLikedIds,
  toggleLike,
  reportSubmission,
  type WallItem,
} from '@/lib/wallApi';
import { REPORT_REASONS } from '@/lib/moderation';

const easeOut = [0.22, 1, 0.36, 1] as const;
const MIN_RATIO = 0.5625; // 9:16
const MAX_RATIO = 1.85;

type SortMode = 'shuffle' | 'newest' | 'top';

function mediaRatio(sub: WallItem): number {
  if (sub.width && sub.height) {
    const r = sub.width / sub.height;
    return Math.min(MAX_RATIO, Math.max(MIN_RATIO, r));
  }
  return 16 / 9;
}

function mediaCost(sub: WallItem): number {
  return 1 / mediaRatio(sub);
}

function orientationOf(sub: WallItem): 'portrait' | 'landscape' | 'square' {
  if (!sub.width || !sub.height) return 'square';
  const r = sub.width / sub.height;
  if (r > 1.05) return 'landscape';
  if (r < 0.95) return 'portrait';
  return 'square';
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function packColumns(items: WallItem[], n: number): WallItem[][] {
  const cols: WallItem[][] = Array.from({ length: n }, () => []);
  const heights = new Array(n).fill(0);
  const lastOrient = new Array(n).fill(null as 'portrait' | 'landscape' | 'square' | null);

  for (const item of items) {
    const o = orientationOf(item);
    let best = 0;
    let bestScore = Infinity;
    for (let c = 0; c < n; c++) {
      const score = heights[c] + (lastOrient[c] === o ? 0.55 : 0);
      if (score < bestScore) {
        bestScore = score;
        best = c;
      }
    }
    cols[best].push(item);
    heights[best] += mediaCost(item);
    lastOrient[best] = o;
  }
  return cols;
}

function useColumnCount(): number {
  const [count, setCount] = useState(() => {
    if (typeof window === 'undefined') return 3;
    const w = window.innerWidth;
    if (w >= 1440) return 4;
    if (w >= 1024) return 3;
    if (w >= 768) return 2;
    if (w >= 420) return 2;
    return 1;
  });

  useEffect(() => {
    const compute = () => {
      const w = window.innerWidth;
      setCount(w >= 1440 ? 4 : w >= 1024 ? 3 : w >= 768 ? 2 : w >= 420 ? 2 : 1);
    };
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, []);

  return count;
}

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

const hoverCapable = () =>
  typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

/** Card media that plays inline (muted loop) on hover for desktop, poster otherwise. */
function CardMedia({ sub }: { sub: WallItem }) {
  const [showVideo, setShowVideo] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [broken, setBroken] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const isVideo = sub.mediaType === 'video' && !!sub.mediaUrl && !broken;

  const start = useCallback(() => {
    if (!hoverCapable() || !isVideo) return;
    setShowVideo(true);
    requestAnimationFrame(() => {
      videoRef.current?.play().catch(() => {});
    });
  }, [isVideo]);

  const stop = useCallback(() => {
    videoRef.current?.pause();
  }, []);

  return (
    <div
      className="relative w-full overflow-hidden bg-black/50"
      style={{ aspectRatio: `${mediaRatio(sub)}` }}
      onMouseEnter={start}
      onMouseLeave={stop}
      onTouchStart={() => setShowVideo(false)}
    >
      {isVideo && showVideo ? (
        <video
          ref={videoRef}
          src={sub.mediaUrl ?? undefined}
          muted
          loop
          playsInline
          preload="metadata"
          poster={sub.posterUrl ?? undefined}
          onWaiting={() => setBuffering(true)}
          onPlaying={() => setBuffering(false)}
          onError={() => setBroken(true)}
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <Thumb sub={sub} className="transition-transform duration-700 group-hover:scale-110" />
      )}
      {buffering && isVideo && showVideo && (
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
          <Loader2 className="w-7 h-7 text-[#D9A441] animate-spin" />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent pointer-events-none" />
      {(sub.mediaType === 'video' || sub.mediaType === 'link') && (
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
          <div className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-md border border-[#D9A441]/50 flex items-center justify-center group-hover:scale-110 transition-transform">
            {sub.mediaType === 'link' ? (
              <ExternalLink className="w-5 h-5 text-[#D9A441]" />
            ) : (
              <Play className="w-5 h-5 text-[#D9A441] fill-[#D9A441] ml-0.5" />
            )}
          </div>
        </div>
      )}
      {sub.kind === 'link' && (
        <div className="absolute top-3 left-3 px-2.5 h-7 rounded-full bg-black/50 backdrop-blur-md border border-[#D9A441]/30 flex items-center gap-1 pointer-events-none">
          <Link2 className="w-3 h-3 text-[#D9A441]" />
          <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: '#D9A441' }}>Link</span>
        </div>
      )}
    </div>
  );
}

interface CardProps {
  sub: WallItem;
  liked: boolean;
  likesOverride: number | null;
  index: number;
  reported: boolean;
  onOpen: () => void;
  onToggleLike: (sub: WallItem) => void;
  onReport: (sub: WallItem) => void;
}

function WallCard({ sub, liked, likesOverride, index, reported, onOpen, onToggleLike, onReport }: CardProps) {
  const likeCount = likesOverride ?? sub.likes;
  return (
    <motion.div
      key={sub.id}
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.55, delay: Math.min(index, 6) * 0.05, ease: easeOut }}
      className="group relative text-left w-full rounded-[22px] overflow-hidden transition-all duration-500 hover:-translate-y-1.5 border border-[rgba(217,164,65,0.14)] hover:border-[#D9A441]/50 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#D9A441]/60"
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
      <CardMedia sub={sub} />
      <div className="absolute top-3 right-3">
        <button
          type="button"
          aria-label={liked ? 'Remove like' : 'Like'}
          onClick={(e) => {
            e.stopPropagation();
            onToggleLike(sub);
          }}
          className="flex items-center gap-1 px-2.5 h-7 rounded-full bg-black/50 backdrop-blur-md border transition-all duration-300 hover:scale-105"
          style={{
            borderColor: liked ? 'rgba(217,73,43,0.6)' : 'rgba(255,255,255,0.1)',
            boxShadow: liked ? '0 0 14px rgba(217,73,43,0.35)' : 'none',
          }}
        >
          <Heart
            className={`w-3 h-3 transition-colors ${liked ? 'text-[#FF5C3D]' : 'text-white/80'}`}
            fill={liked ? '#FF5C3D' : 'transparent'}
          />
          <span className="text-[11px] font-bold text-white/80">{likeCount}</span>
        </button>
      </div>
      <button
        type="button"
        aria-label="Report this edit"
        title={reported ? 'Reported' : 'Report'}
        onClick={(e) => {
          e.stopPropagation();
          onReport(sub);
        }}
        className={`absolute top-3 left-3 w-7 h-7 rounded-full bg-black/50 backdrop-blur-md border flex items-center justify-center transition-all duration-300 hover:scale-105 z-10 ${
          sub.kind === 'link' ? 'top-12' : ''
        }`}
        style={{
          borderColor: reported ? 'rgba(255,140,60,0.6)' : 'rgba(255,255,255,0.1)',
        }}
      >
        <Flag className={`w-3 h-3 ${reported ? 'text-[#FF9A3C] fill-[#FF9A3C]' : 'text-white/60'}`} />
      </button>
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
    </motion.div>
  );
}

function Lightbox({
  sub,
  liked,
  likesOverride,
  reported,
  onClose,
  onToggleLike,
  onReport,
}: {
  sub: WallItem;
  liked: boolean;
  likesOverride: number | null;
  reported: boolean;
  onClose: () => void;
  onToggleLike: (sub: WallItem) => void;
  onReport: (sub: WallItem) => void;
}) {
  const [muted, setMuted] = useState(true);
  const [buffering, setBuffering] = useState(false);
  const [broken, setBroken] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

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
  const likeCount = likesOverride ?? sub.likes;

  const toggleMute = () => {
    setMuted((m) => !m);
    const v = videoRef.current;
    if (v) v.muted = !v.muted;
  };

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

        <div className="relative h-[min(70vh,680px)] bg-black flex flex-col items-center justify-center overflow-hidden">
          {sub.mediaType === 'video' && sub.mediaUrl && !broken ? (
            <>
              <video
                ref={videoRef}
                src={sub.mediaUrl}
                className="w-full h-full object-contain"
                autoPlay
                loop
                playsInline
                muted
                preload="auto"
                onWaiting={() => setBuffering(true)}
                onPlaying={() => setBuffering(false)}
                onCanPlay={() => setBuffering(false)}
                onError={() => setBroken(true)}
              />
              <button
                type="button"
                onClick={toggleMute}
                aria-label={muted ? 'Unmute' : 'Mute'}
                className="absolute top-3 left-3 w-10 h-10 rounded-full bg-black/50 backdrop-blur-md border border-white/10 flex items-center justify-center transition-all duration-300 hover:scale-105 hover:bg-black/70"
              >
                {muted ? <VolumeX className="w-4 h-4 text-white/70" /> : <Volume2 className="w-4 h-4 text-[#D9A441]" />}
              </button>
            </>
          ) : sub.mediaType === 'video' && sub.posterUrl ? (
            <>
              <img src={sub.posterUrl} alt={sub.name} className="w-full h-full object-contain opacity-40" />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
                <Film className="w-9 h-9 text-[#D9A441]/70" />
                <span className="text-[12px] font-bold" style={{ color: 'rgba(247,243,238,0.6)' }}>
                  This video can&apos;t be played on your device.
                </span>
              </div>
            </>
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
              <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: 'rgba(217,164,65,0.08)', border: '1px solid rgba(217,164,65,0.3)' }}>
                <Link2 className="w-7 h-7 text-[#D9A441]" />
              </div>
              <span className="text-sm font-bold text-white/70">Hosted on {hostOf(sub.url)}</span>
            </div>
          ) : sub.posterUrl ? (
            <img src={sub.posterUrl} alt={sub.caption || sub.name} className="w-full h-full object-contain" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ImageIcon className="w-9 h-9 text-white/30" />
            </div>
          )}
          {buffering && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(217,164,65,0.35)' }}
              >
                <Loader2 className="w-7 h-7 text-[#D9A441] animate-spin" />
              </div>
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
              <button
                type="button"
                onClick={() => onToggleLike(sub)}
                className="text-[11px] text-white/40 inline-flex items-center gap-1.5 transition-colors hover:text-white"
              >
                <Heart
                  className={`w-3 h-3 ${liked ? 'text-[#FF5C3D]' : 'text-[#D94A2B]'}`}
                  fill={liked ? '#FF5C3D' : 'transparent'}
                />
                <span>{likeCount}</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onReport(sub)}
              disabled={reported}
              className="hidden sm:inline-flex items-center gap-2 h-10 px-4 rounded-full text-[12px] font-bold transition-all duration-300 hover:scale-105 disabled:opacity-60 disabled:pointer-events-none"
              style={{
                border: `1px solid ${reported ? 'rgba(255,140,60,0.6)' : 'rgba(255,255,255,0.15)'}`,
                color: reported ? '#FF9A3C' : 'rgba(247,243,238,0.6)',
                background: reported ? 'rgba(255,140,60,0.08)' : 'rgba(255,255,255,0.03)',
              }}
            >
              <Flag className={`w-3.5 h-3.5 ${reported ? 'fill-[#FF9A3C]' : ''}`} />
              {reported ? 'Reported' : 'Report'}
            </button>
            {sub.mediaType === 'video' && sub.mediaUrl && (
              <a
                href={sub.mediaUrl}
                download={`tmnaa-${(sub.name || 'edit').replace(/[^a-z0-9_-]+/gi, '-').slice(0, 40)}.mp4`}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:inline-flex items-center gap-2 h-10 px-4 rounded-full text-[12px] font-bold transition-all duration-300 hover:scale-105"
                style={{ border: '1px solid rgba(217,164,65,0.35)', color: '#D9A441', background: 'rgba(217,164,65,0.06)' }}
              >
                <Download className="w-3.5 h-3.5" /> Download
              </a>
            )}
            {sub.mediaType === 'link' && sub.url && (
              <a
                href={sub.url}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:inline-flex items-center gap-2 h-10 px-4 rounded-full text-[12px] font-bold transition-all duration-300 hover:scale-105"
                style={{ border: '1px solid rgba(217,164,65,0.35)', color: '#D9A441', background: 'rgba(217,164,65,0.06)' }}
              >
                <Download className="w-3.5 h-3.5" /> Download
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

const LIKED_STORAGE = 'tmnaa_liked_ids';

function ReportModal({
  sub,
  busy,
  status,
  onPick,
  onClose,
}: {
  sub: WallItem;
  busy: boolean;
  status: string;
  onPick: (reason: string) => void;
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[400] flex items-center justify-center p-4"
      style={{ background: 'rgba(5,4,3,0.8)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ duration: 0.3, ease: easeOut }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-[26px] p-6"
        style={{
          background: 'linear-gradient(160deg, rgba(26,18,13,0.98), rgba(16,11,8,0.96))',
          border: '1.5px solid rgba(217,164,65,0.35)',
          boxShadow: '0 24px 70px rgba(0,0,0,0.6)',
        }}
      >
        {status === 'done' ? (
          <div className="text-center py-3">
            <Flag className="mx-auto mb-3 w-8 h-8 text-[#FF9A3C] fill-[#FF9A3C]" />
            <h3 className="text-lg font-black" style={{ fontFamily: 'Cairo, sans-serif', color: '#F7F3EE' }}>
              Reported
            </h3>
            <p className="mt-1 text-[12.5px]" style={{ color: 'rgba(247,243,238,0.5)' }}>
              Thanks — the mods will take a look.
            </p>
            <button
              onClick={onClose}
              className="mt-5 px-6 h-11 rounded-full text-[13px] font-black"
              style={{ color: '#0d0906', background: 'linear-gradient(135deg, #E8B45C, #D9A441)', fontFamily: 'Cairo, sans-serif' }}
            >
              Close
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-4">
              <Flag className="w-4 h-4 text-[#D9A441]" />
              <h3 className="text-lg font-black" style={{ fontFamily: 'Cairo, sans-serif', color: '#F7F3EE' }}>
                Report this edit
              </h3>
            </div>
            <p className="text-[12px] leading-relaxed" style={{ color: 'rgba(247,243,238,0.5)' }}>
              Why are you flagging <b style={{ color: '#D9A441' }}>@{sub.name}</b>? Your report goes straight to the moderators.
            </p>
            <div className="mt-4 space-y-2">
              {REPORT_REASONS.map((r) => (
                <button
                  key={r}
                  onClick={() => !busy && onPick(r)}
                  disabled={busy}
                  className="w-full h-10 rounded-xl text-[13px] font-bold transition-all duration-300 hover:scale-[1.02] disabled:opacity-50"
                  style={{ border: '1px solid rgba(217,164,65,0.25)', color: 'rgba(247,243,238,0.75)', background: 'rgba(217,164,65,0.06)' }}
                >
                  {r}
                </button>
              ))}
            </div>
            {status === 'err' && (
              <p className="mt-3 text-[12px] font-medium" style={{ color: '#FF8A8A' }}>
                Could not send the report. Try again in a moment.
              </p>
            )}
            <button
              onClick={onClose}
              className="mt-4 w-full text-[12px] font-bold hover:opacity-70"
              style={{ color: 'rgba(247,243,238,0.45)' }}
            >
              Cancel
            </button>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

export function EditsGallery({ submissions }: { submissions: WallItem[] }) {
  const [sort, setSort] = useState<SortMode>('shuffle');
  const [selected, setSelected] = useState<WallItem | null>(null);
  const [likedIds, setLikedIds] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(LIKED_STORAGE);
      if (raw) return new Set(JSON.parse(raw) as string[]);
    } catch {
      /* ignore */
    }
    return new Set();
  });
  const [likesOverrides, setLikesOverrides] = useState<Record<string, number>>({});
  const [reporting, setReporting] = useState<WallItem | null>(null);
  const [reportBusy, setReportBusy] = useState(false);
  const [reportStatus, setReportStatus] = useState<'idle' | 'done' | 'err'>('idle');
  const [reportedIds, setReportedIds] = useState<Set<string>>(new Set());
  const columns = useColumnCount();

  const ordered = useMemo(() => {
    if (sort === 'newest') {
      return [...submissions].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    }
    if (sort === 'top') {
      return [...submissions].sort((a, b) => b.likes - a.likes);
    }
    // balanced shuffle: deterministic random order, reseeded when the wall changes
    let seed = 7;
    for (let i = 0; i < submissions.length; i++) {
      seed = (seed * 31 + submissions[i].id.length) | 0;
    }
    const rnd = mulberry32(seed);
    const arr = [...submissions];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissions, sort]);

  const packed = useMemo(() => packColumns(ordered, columns), [ordered, columns]);

  useEffect(() => {
    fetchLikedIds().then((ids) => {
      setLikedIds(new Set(ids));
      try {
        localStorage.setItem(LIKED_STORAGE, JSON.stringify(ids));
      } catch {
        /* ignore */
      }
    }).catch(() => {
      /* offline — keep cached state */
    });
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(LIKED_STORAGE, JSON.stringify([...likedIds]));
    } catch {
      /* ignore */
    }
  }, [likedIds]);

  const onClose = useCallback(() => setSelected(null), []);

  const openReport = useCallback((sub: WallItem) => {
    setReporting(sub);
    setReportStatus('idle');
    setReportBusy(false);
  }, []);

  const closeReport = useCallback(() => setReporting(null), []);

  const doReport = useCallback(async (reason: string) => {
    if (!reporting) return;
    setReportBusy(true);
    setReportStatus('idle');
    try {
      await reportSubmission({ submissionId: reporting.id, reason });
      setReportedIds((prev) => {
        const next = new Set(prev);
        next.add(reporting.id);
        return next;
      });
      setReportStatus('done');
    } catch {
      setReportStatus('err');
    } finally {
      setReportBusy(false);
    }
  }, [reporting]);

  const onToggleLike = useCallback(async (sub: WallItem) => {
    const target = likedIds.has(sub.id) ? false : true;
    setLikedIds((prev) => {
      const next = new Set(prev);
      if (target) next.add(sub.id);
      else next.delete(sub.id);
      return next;
    });
    setLikesOverrides((prev) => ({
      ...prev,
      [sub.id]: Math.max(0, (prev[sub.id] ?? sub.likes) + (target ? 1 : -1)),
    }));
    try {
      const result = await toggleLike(sub.id, target);
      setLikesOverrides((prev) => ({ ...prev, [sub.id]: result.likes }));
    } catch {
      // revert optimistic state
      setLikedIds((prev) => {
        const next = new Set(prev);
        if (target) next.delete(sub.id);
        else next.add(sub.id);
        return next;
      });
      setLikesOverrides((prev) => ({
        ...prev,
        [sub.id]: Math.max(0, (prev[sub.id] ?? sub.likes) + (target ? -1 : 1)),
      }));
    }
  }, [likedIds]);

  const sortBtn = (value: SortMode, label: string) => {
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
            {ordered.length} {ordered.length === 1 ? 'edit' : 'edits'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {sortBtn('shuffle', 'Balanced')}
          {sortBtn('newest', 'Newest')}
          {sortBtn('top', 'Most Liked')}
        </div>
      </div>

      {ordered.length === 0 ? (
        <div className="rounded-[28px] py-16 text-center" style={{ background: 'rgba(9,8,7,0.6)', border: '1px solid rgba(217,164,65,0.12)' }}>
          <p className="text-sm font-bold" style={{ color: 'rgba(247,243,238,0.5)' }}>No edits yet — be the first to submit.</p>
        </div>
      ) : (
        <div className="flex items-start gap-3">
          {packed.map((col, ci) => (
            <div key={ci} className="flex-1 min-w-0 flex flex-col gap-3">
              {col.map((sub, i) => (
                <WallCard
                  key={sub.id}
                  sub={sub}
                  index={i * columns + ci}
                  liked={likedIds.has(sub.id)}
                  likesOverride={likesOverrides[sub.id] ?? null}
                  reported={reportedIds.has(sub.id)}
                  onOpen={() => setSelected(sub)}
                  onToggleLike={onToggleLike}
                  onReport={openReport}
                />
              ))}
            </div>
          ))}
        </div>
      )}

      <p className="mt-8 text-center text-[11px] tracking-[0.15em]" style={{ color: 'rgba(247,243,238,0.3)' }}>
        Like once per device — one like per edit, keep it fair. ♥
      </p>

      <AnimatePresence>
        {selected && (
          <Lightbox
            sub={selected}
            liked={likedIds.has(selected.id)}
            likesOverride={likesOverrides[selected.id] ?? null}
            reported={reportedIds.has(selected.id)}
            onClose={onClose}
            onToggleLike={onToggleLike}
            onReport={openReport}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {reporting && (
          <ReportModal
            sub={reporting}
            busy={reportBusy}
            status={reportStatus}
            onPick={doReport}
            onClose={closeReport}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
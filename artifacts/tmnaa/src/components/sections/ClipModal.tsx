import { useEffect, useRef, useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import Hls from 'hls.js';
import { apiUrl } from '@/lib/apiBase';

interface ClipModalProps {
  clip: { id: string; title: string; view_count: number; thumbnail_url?: string } | null;
  onClose: () => void;
}

export function ClipModal({ clip, onClose }: ClipModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [src, setSrc] = useState<string | null>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (clip) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [clip, handleKeyDown]);

  useEffect(() => {
    if (!clip) return;
    setReady(false);
    setError(false);
    setSrc(null);

    const fromThumb = clip.thumbnail_url?.replace(/thumbnail\.webp$/, 'playlist.m3u8');
    if (fromThumb) { setSrc(fromThumb); return; }

    setFetching(true);
    const proxyUrl = apiUrl(`/api/kick?endpoint=${encodeURIComponent(`https://kick.com/api/v2/clips/${clip.id}`)}`);
    fetch(proxyUrl, { headers: { Accept: 'application/json' } })
      .then((r) => r.json())
      .then((d) => {
        const srcUrl = d?.clip?.video_url || d?.video_url || d?.data?.clip?.video_url;
        if (srcUrl) setSrc(srcUrl);
        else setError(true);
      })
      .catch(() => setError(true))
      .finally(() => setFetching(false));
  }, [clip]);

  useEffect(() => {
    if (!src || !videoRef.current) return;
    setReady(false);

    const v = videoRef.current;

    if (Hls.isSupported()) {
      const hls = new Hls({ enableWorker: false });
      hls.loadSource(src);
      hls.attachMedia(v);
      hls.on(Hls.Events.MANIFEST_PARSED, () => { setReady(true); v.play().catch(() => {}); });
      hls.on(Hls.Events.ERROR, (_, data) => { if (data.fatal) setError(true); });
      return () => hls.destroy();
    } else if (v.canPlayType('application/vnd.apple.mpegurl')) {
      v.src = src;
      v.addEventListener('loadedmetadata', () => { setReady(true); v.play().catch(() => {}); });
      v.addEventListener('error', () => setError(true));
      return () => { v.src = ''; };
    } else {
      setError(true);
    }
  }, [src]);

  if (!clip) return null;

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
        className="relative w-full max-w-4xl bg-[#0a0a0a] rounded-[32px] overflow-hidden border border-white/10 shadow-2xl shadow-black/60"
      >
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#D4A84A]/40 to-transparent" />

        <div className="relative aspect-video bg-black flex items-center justify-center">
          {fetching && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10">
              <div className="w-10 h-10 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
              <span className="text-[11px] text-white/40 font-medium">Loading clip...</span>
            </div>
          )}
          {!fetching && !ready && !error && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <div className="w-10 h-10 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
            </div>
          )}
          {error ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/40">
              <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
              </svg>
              <span className="text-sm font-medium">Could not load clip</span>
              <button onClick={onClose} className="text-xs text-[#D4A84A] hover:underline">Close</button>
            </div>
          ) : (
            <video
              ref={videoRef}
              className="w-full h-full object-contain"
              controls
              playsInline
              autoPlay
            />
          )}
          <div className="absolute inset-0 pointer-events-none ring-1 ring-white/5" />
        </div>

        <div className="flex items-center justify-between p-4 md:p-5 bg-gradient-to-b from-[#0d0d0d] to-[#080808]">
          <div className="min-w-0 flex-1 mr-4">
            <h3 className="text-sm md:text-lg font-bold text-white truncate drop-shadow-sm">{clip.title}</h3>
            <div className="flex items-center gap-2 mt-1">
              <svg className="w-3.5 h-3.5 text-white/40 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
              </svg>
              <span className="text-xs text-white/50 font-medium">
                {new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(clip.view_count)} views
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="relative w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all duration-300 flex items-center justify-center group/btn shrink-0"
          >
            <svg className="w-4 h-4 text-white/60 group-hover/btn:text-white/90 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

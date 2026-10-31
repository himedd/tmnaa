import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { Language } from '../types';

/* ============================================================
   MediaModal — مشغّل داخلي: يشغّل رابط الـ m3u8 حق كيك مباشرة
   داخل الموقع (hls.js) بدل iframe كيك اللي يظل يلف.
   ============================================================ */

export interface MediaTarget {
  kind: 'vod' | 'clip';
  id: string;
  title?: string;
  src?: string;      // رابط الـ m3u8 المباشر من Kick API
  poster?: string;
  slug?: string;     // slug التسجيل لصفحة كيك
}

interface MediaModalProps {
  target: MediaTarget | null;
  onClose: () => void;
  channelSlug: string;
  lang: Language;
}

const nativeHls = (video: HTMLVideoElement) =>
  video.canPlayType('application/vnd.apple.mpegurl') !== '' || video.canPlayType('application/x-mpegURL') !== '';

export const MediaModal: React.FC<MediaModalProps> = ({ target, onClose, channelSlug, lang }) => {
  const closeRef = useRef<HTMLButtonElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stage, setStage] = useState<'loading' | 'ready' | 'failed'>('loading');

  const canStream = !!(target && target.src);

  useEffect(() => {
    if (!target) return;
    setStage(target.src ? 'loading' : 'failed');
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [target, onClose]);

  // تشغيل الـ HLS داخل الموقع
  useEffect(() => {
    if (!target?.src) return;
    const video = videoRef.current;
    if (!video) return;

    let hls: Hls | null = null;
    if (Hls.isSupported()) {
      hls = new Hls({ enableWorker: true, lowLatencyMode: false, backBufferLength: 90 });
      hls.loadSource(target.src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setStage('ready');
        video.play().catch(() => undefined);
      });
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (data.fatal) setStage('failed');
      });
    } else if (nativeHls(video)) {
      video.src = target.src;
      const onReady = () => { setStage('ready'); video.play().catch(() => undefined); };
      video.addEventListener('loadedmetadata', onReady, { once: true });
      video.addEventListener('error', () => setStage('failed'), { once: true });
    } else {
      setStage('failed');
    }

    return () => { if (hls) hls.destroy(); };
  }, [target?.src]);

  if (!target) return null;

  const kickUrl = `https://kick.com/${channelSlug}${target.kind === 'clip' ? `?clip=${target.id}` : `/videos/${target.slug || target.id}`}`;
  const L = (ar: string, en: string) => (lang === 'ar' ? ar : en);

  return (
    <div
      className="modal-backdrop fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={target.title || L('مشغّل الفيديو', 'Video player')}
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/85 backdrop-blur-md" aria-hidden="true" />
      <div
        className="modal-sheet relative w-full max-w-5xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* gold hairline frame */}
        <div className="absolute -inset-[1px] rounded-[26px] bg-gradient-to-b from-gold/70 via-gold/10 to-wine-600/40 pointer-events-none" aria-hidden="true" />
        <div className="relative rounded-[25px] bg-wine-950/95 overflow-hidden shadow-[0_40px_120px_-20px_rgba(0,0,0,0.9)]">
          {/* chrome */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-gold/15 bg-gradient-to-b from-white/[0.05] to-transparent">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-black px-2.5 py-1.5 rounded-full bg-gold/15 border border-gold/40 text-gold tracking-[0.18em] uppercase">
              {target.kind === 'clip' ? L('لقطة', 'CLIP') : L('تسجيل', 'VOD')}
            </span>
            <p className="flex-1 min-w-0 text-[13px] sm:text-sm font-bold text-[#fff7ec]/80 truncate" dir="auto">
              {target.title || L('مشغّل كيك', 'Kick player')}
            </p>
            <a
              href={kickUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-black px-3 py-1.5 rounded-full border border-white/10 text-white/60 hover:text-gold hover:border-gold/40 transition-colors shrink-0"
            >
              Kick
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
            </a>
            <button
              ref={closeRef}
              onClick={onClose}
              aria-label={L('إغلاق', 'Close')}
              className="w-9 h-9 rounded-xl bg-white/[0.06] border border-white/10 text-white/70 hover:text-black hover:bg-gold hover:border-gold flex items-center justify-center shrink-0 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          {/* player */}
          <div className="relative aspect-video bg-black">
            {canStream && (
              <video
                key={target.src}
                ref={videoRef}
                poster={target.poster}
                controls
                playsInline
                preload="metadata"
                className={`w-full h-full bg-black transition-opacity duration-500 ${stage === 'ready' ? 'opacity-100' : 'opacity-0'}`}
                onError={() => setStage('failed')}
              />
            )}

            {stage === 'loading' && canStream && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none">
                <span className="w-10 h-10 rounded-full border-2 border-gold/20 border-t-gold animate-spin" />
                <span className="text-[11px] font-bold tracking-[0.25em] text-white/35 uppercase">{L('تحميل', 'LOADING')}</span>
              </div>
            )}

            {stage === 'failed' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center">
                {target.poster && <img src={target.poster} alt="" className="absolute inset-0 w-full h-full object-cover opacity-25" />}
                <div className="relative flex flex-col items-center gap-3">
                  <span className="w-12 h-12 rounded-2xl bg-gold/15 border border-gold/40 flex items-center justify-center text-gold text-xl font-gaming">!</span>
                  <p className="text-[13px] font-bold text-white/70">{L('البث هذا ما اشتغل داخل الموقع', "This stream wouldn't play in-site")}</p>
                  <a href={kickUrl} target="_blank" rel="noopener noreferrer"
                    className="btn-arena inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-b from-gold-light to-gold text-wine-950 text-[13px] font-black shadow-[0_0_28px_rgba(227,179,65,0.35)]">
                    {L('مشاهدة على كيك', 'WATCH ON KICK')}
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* footer strip */}
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-t border-gold/10 bg-gradient-to-b from-transparent to-wine-950">
            <p className="text-[10px] font-bold tracking-[0.2em] text-white/30 uppercase" dir="ltr">XLXWI · CLAN LEVEL ONE</p>
            <a href={kickUrl} target="_blank" rel="noopener noreferrer" className="sm:hidden text-[11px] font-black text-gold/70 hover:text-gold">
              {L('افتح في كيك', 'Open on Kick')}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MediaModal;

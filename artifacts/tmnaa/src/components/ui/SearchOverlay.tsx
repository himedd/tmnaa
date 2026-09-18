import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { kickFetch } from '@/lib/kickApi';

interface SearchClip {
  id: string;
  title: string;
  thumbnail_url: string;
  view_count: number;
  created_at: string;
}

interface SearchOverlayProps {
  open: boolean;
  onClose: () => void;
}

export function SearchOverlay({ open, onClose }: SearchOverlayProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [clips, setClips] = useState<SearchClip[]>([]);
  const [results, setResults] = useState<SearchClip[]>([]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setResults([]);
      setTimeout(() => inputRef.current?.focus(), 100);
      kickFetch(`https://kick.com/api/v2/channels/tmnaa/clips`).then((raw) => {
        const data = raw?.data || raw;
        const arr = data?.clips || (Array.isArray(data) ? data : data?.data && Array.isArray(data.data) ? data.data : []);
        setClips(arr);
      }).catch(() => {});
    }
  }, [open]);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const q = query.toLowerCase();
    const filtered = clips.filter(
      (c) => c.title?.toLowerCase().includes(q)
    );
    setResults(filtered.slice(0, 8));
  }, [query, clips]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (open) document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, handleKeyDown]);

  const handlePlay = (clip: SearchClip) => {
    window.dispatchEvent(new CustomEvent('play-clip', { detail: clip }));
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh] md:pt-[12vh] p-4"
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-black/85 backdrop-blur-2xl" />

          <motion.div
            initial={{ y: -30, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -30, opacity: 0, scale: 0.97 }}
            transition={{ type: 'spring', damping: 30, stiffness: 350 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-xl"
          >
            <div
              className="flex items-center gap-3 px-5 h-[60px] rounded-2xl"
              style={{
                background: 'rgba(18, 12, 10, 0.9)',
                border: '1.5px solid rgba(217, 164, 65, 0.2)',
                boxShadow: '0 8px 40px rgba(0,0,0,0.6), 0 0 60px rgba(217,164,65,0.05)',
              }}
            >
              <svg className="w-5 h-5 text-[#D9A441]/60 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search clips..."
                className="flex-1 bg-transparent text-white text-[15px] outline-none placeholder:text-white/20 font-medium"
              />
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/5 transition-colors"
              >
                <svg className="w-4 h-4 text-white/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {results.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-3 rounded-2xl overflow-hidden"
                style={{
                  background: 'rgba(18, 12, 10, 0.9)',
                  border: '1px solid rgba(217, 164, 65, 0.12)',
                  boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
                }}
              >
                <div className="p-2 space-y-1">
                  {results.map((clip) => (
                    <button
                      key={clip.id}
                      onClick={() => handlePlay(clip)}
                      className="flex items-center gap-3 w-full p-2.5 rounded-xl hover:bg-white/5 transition-all text-left group"
                    >
                      <div className="w-16 aspect-video rounded-lg overflow-hidden shrink-0 bg-black/60">
                        <img
                          src={clip.thumbnail_url}
                          alt={clip.title}
                          className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity"
                          loading="lazy"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-white/80 group-hover:text-white truncate transition-colors">{clip.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px] text-white/30">
                            {new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(clip.view_count)} views
                          </span>
                          <span className="text-white/10 text-[10px]">•</span>
                          <span className="text-[11px] text-white/20">{clip.created_at ? new Date(clip.created_at).toLocaleDateString() : ''}</span>
                        </div>
                      </div>
                      <svg className="w-4 h-4 text-white/20 group-hover:text-[#D9A441] transition-colors shrink-0" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {query.trim() && results.length === 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-3 py-8 text-center text-sm text-white/20 font-medium rounded-2xl"
                style={{
                  background: 'rgba(18, 12, 10, 0.9)',
                  border: '1px solid rgba(217, 164, 65, 0.08)',
                }}
              >
                No clips found for "{query}"
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaMagnifyingGlass, FaBell, FaBars, FaXmark } from 'react-icons/fa6';
import { useNotifications } from '@/hooks/useNotifications';
import { NotificationPanel } from '@/components/ui/NotificationPanel';
import { kickFetch } from '@/lib/kickApi';
import { ClipModal } from '@/components/sections/ClipModal';
import { VodModal } from '@/components/sections/VodModal';
import { useLocation } from 'wouter';
import { apiUrl } from '@/lib/apiBase';
const logoImg = '/assets/IMG_3093_1785158973333.WEBP';

// Survives a route change so a section link clicked on another page can
// scroll once the homepage (and its sections) have mounted.
let pendingSectionTarget: string | null = null;

const navLinks = [
  { href: '#home', label: 'HOME' },
  { href: '#support', label: 'SUPPORT' },
  { href: '/300k', label: '300K' },
  { href: '#stats', label: 'STATS' },
  { href: '#clips', label: 'CLIPS' },
  { href: '#moderators', label: 'MODS' },
];

export function Header() {
  const [location, navigate] = useLocation();
  const [activeSection, setActiveSection] = useState('home');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [isLive, setIsLive] = useState<boolean | null>(null);
  const [streamTitle, setStreamTitle] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [allClips, setAllClips] = useState<any[]>([]);
  const [selectedClip, setSelectedClip] = useState<any>(null);
  const [selectedVideo, setSelectedVideo] = useState<any>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const pollTimerRef = useRef<number | null>(null);
  const settleTimersRef = useRef<number[]>([]);
  const suppressObserverUntilRef = useRef(0);

  const { notifications, unreadCount, markAllRead, markRead } = useNotifications();

  useEffect(() => {
    const checkLive = async () => {
      try {
        const res = await fetch(apiUrl('/api/kick?endpoint=' + encodeURIComponent('https://kick.com/api/v2/channels/tmnaa')));
        if (!res.ok) return;
        const data = await res.json();
        const live = data?.livestream !== null && data?.livestream !== undefined;
        setIsLive(live);
        setStreamTitle(live ? (data?.livestream?.session_title || 'Live') : '');
      } catch { setIsLive(false); }
    };
    checkLive();
    const interval = setInterval(checkLive, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => { setSearchOpen(false); setNotifOpen(false); }, [scrolled]);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (Date.now() < suppressObserverUntilRef.current) return;
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { threshold: 0.3 }
    );

    navLinks.forEach(({ href }) => {
      if (!href.startsWith('#')) return;
      const el = document.querySelector(href);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  // Fetch clips and videos for search
  const [clipsLoading, setClipsLoading] = useState(true);
  useEffect(() => {
    setClipsLoading(true);
    Promise.all([
      kickFetch(`https://kick.com/api/v2/channels/tmnaa/clips?limit=20`),
      kickFetch(`https://kick.com/api/v2/channels/tmnaa/videos`)
    ]).then(([clipsRaw, videosRaw]) => {
      // Parse clips
      const clipsData = clipsRaw?.data || clipsRaw;
      const clipsArr = clipsData?.clips || (Array.isArray(clipsData) ? clipsData : clipsData?.data && Array.isArray(clipsData.data) ? clipsData.data : []);
      const mappedClips = clipsArr.map((c: any) => ({
        id: c.id,
        type: 'clip',
        title: c.title,
        thumbnail_url: c.thumbnail_url,
        view_count: c.view_count || 0,
        duration: c.duration,
        creator: c.creator?.username || '',
        category: c.category?.name || '',
        url: `https://kick.com/tmnaa?clip=${c.id}`
      }));

      // Parse videos
      const videosArr = videosRaw?.videos || (Array.isArray(videosRaw) ? videosRaw : []);
      const mappedVideos = videosArr.map((v: any) => ({
        id: v.id,
        type: 'video',
        title: v.session_title || v.title || 'Past Stream',
        thumbnail_url: v.thumbnail?.url || v.thumbnail?.src || (typeof v.thumbnail === 'string' ? v.thumbnail : '') || `https://image.kick.com/image-v2/stream/${v.id}/desktop.webp`,
        view_count: v.viewer_count || v.views || 0,
        duration: v.duration,
        creator: 'tmnaa',
        category: v.categories?.[0]?.category?.name || v.categories?.[0]?.name || '',
        url: `https://kick.com/video/${v.id}`,
        uuid: v.video?.uuid || v.uuid
      }));

      setAllClips([...mappedClips, ...mappedVideos]);
      setClipsLoading(false);
    }).catch(() => { setClipsLoading(false); });
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    const q = searchQuery.toLowerCase();
    setSearchResults(allClips.filter((c: any) =>
      c.title?.toLowerCase().includes(q) ||
      c.creator?.toLowerCase().includes(q) ||
      c.category?.toLowerCase().includes(q)
    ).slice(0, 8));
  }, [searchQuery, allClips]);

  // Close search on outside click
  useEffect(() => {
    if (!searchOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [searchOpen]);

  const handleSearchResult = useCallback((item: any) => {
    if (item.type === 'video') {
      setSelectedVideo({ uuid: item.uuid, title: item.title, view_count: item.view_count });
    } else {
      setSelectedClip({ id: item.id, title: item.title, view_count: item.view_count, thumbnail_url: item.thumbnail_url });
    }
    setSearchOpen(false);
    setSearchQuery('');
  }, []);

  const clearPoll = useCallback(() => {
    if (pollTimerRef.current != null) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const clearSettle = useCallback(() => {
    settleTimersRef.current.forEach((t) => clearTimeout(t));
    settleTimersRef.current = [];
  }, []);

  const performSectionScroll = useCallback((el: HTMLElement, id: string) => {
    const headerOffset = 120;
    const scrollToEl = (behavior: ScrollBehavior) => {
      const target = document.getElementById(id) as HTMLElement | null;
      const node = target || el;
      const top = node.getBoundingClientRect().top + window.scrollY - headerOffset;
      window.scrollTo({ top, behavior });
    };

    scrollToEl('smooth');
    setActiveSection(id);
    // Keep the clicked section highlighted while the programmatic scroll
    // settles; the observer can't mark very tall sections as active.
    suppressObserverUntilRef.current = Date.now() + 3200;

    el.style.transition = 'box-shadow 0.9s ease';
    el.style.boxShadow = '0 0 0px rgba(217,164,65,0)';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.style.boxShadow = '0 0 60px rgba(217,164,65,0.25)';
        setTimeout(() => { el.style.boxShadow = '0 0 0px rgba(217,164,65,0)'; }, 900);
      });
    });

    // Content above the target (images, iframes) can load after the first
    // scroll and shift it down, so re-anchor briefly while the page settles.
    clearSettle();
    [400, 900, 1600, 2400].forEach((delay) => {
      const timer = window.setTimeout(() => { scrollToEl('smooth'); setActiveSection(id); }, delay);
      settleTimersRef.current.push(timer);
    });

    history.replaceState(null, '', '/#' + id);
  }, [clearSettle]);

  const startPolling = useCallback((id: string) => {
    clearPoll();
    pendingSectionTarget = id;
    let attempts = 0;
    pollTimerRef.current = window.setInterval(() => {
      attempts += 1;
      const el = document.getElementById(id);
      if (el) {
        clearPoll();
        pendingSectionTarget = null;
        performSectionScroll(el, id);
        return;
      }
      if (attempts > 100) {
        clearPoll();
        pendingSectionTarget = null;
      }
    }, 120);
  }, [clearPoll, performSectionScroll]);

  // Resume a pending cross-page scroll once the destination page (and its
  // sections) have mounted — this Header may be a fresh instance after the route change.
  useEffect(() => {
    if (pendingSectionTarget) startPolling(pendingSectionTarget);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => { clearPoll(); clearSettle(); }, [clearPoll, clearSettle]);

  useEffect(() => {
    if (location !== '/') {
      pendingSectionTarget = null;
      clearPoll();
      clearSettle();
    }
  }, [location, clearPoll, clearSettle]);

  const scrollToSection = useCallback((e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    if (href.startsWith('/')) {
      setActiveSection('');
      pendingSectionTarget = null;
      clearPoll();
      navigate(href);
      return;
    }
    const id = href.replace('#', '');
    const el = document.querySelector(href);
    if (el) {
      clearPoll();
      pendingSectionTarget = null;
      performSectionScroll(el as HTMLElement, id);
      return;
    }
    setActiveSection('');
    if (location !== '/') navigate('/');
    startPolling(id);
  }, [navigate, location, clearPoll, performSectionScroll, startPolling]);

  const isLinkActive = (href: string) => {
    if (href.startsWith('/')) {
      return location === href || location.startsWith(href + '/');
    }
    return location === '/' && activeSection === href.replace('#', '');
  };

  const NavLink = ({ href, label, layoutId }: { href: string; label: string; layoutId: string }) => {
    const isActive = isLinkActive(href);
    return (
      <motion.a
        href={href}
        onClick={(e) => scrollToSection(e, href)}
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.94 }}
        className="relative px-6 py-2 text-[13px] font-bold tracking-[0.08em] transition-all duration-400 group/nav"
        style={{
          color: isActive ? '#D9A441' : 'rgba(247, 243, 238, 0.7)',
          fontFamily: 'Tajawal, sans-serif',
          letterSpacing: '0.08em',
        }}
      >
        <span className="relative z-10 group-hover/nav:text-[#D9A441] transition-colors duration-300">
          {label}
        </span>
        {isActive && (
          <motion.div
            layoutId={layoutId}
            className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-[2.5px] rounded-full"
            style={{
              width: '36px',
              background: 'linear-gradient(90deg, transparent, #D9A441, #FF7A18, #D9A441, transparent)',
              boxShadow: '0 0 10px rgba(217, 164, 65, 0.5)',
            }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          />
        )}
        <span className="absolute inset-0 rounded-xl opacity-0 group-hover/nav:opacity-100 transition-opacity duration-300"
          style={{ background: 'linear-gradient(135deg, rgba(217, 164, 65, 0.04), rgba(255, 122, 24, 0.02))' }}
        />
      </motion.a>
    );
  };

  return (
    <>
      <motion.header
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 1, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="fixed top-3 left-0 right-0 z-[100] px-[2.5%]"
      >
        <nav
          className={`glass-nav ${scrolled ? 'scrolled' : ''} rounded-[40px] mx-auto h-[72px] flex items-center justify-between px-[30px] relative`}
        >
          {/* Section 1: LIVE NOW / OFFLINE */}
          <div className="hidden lg:flex items-center gap-3.5 min-w-[220px]">
            <div className="relative flex-shrink-0">
              {isLive === null ? (
                <div className="w-3 h-3 rounded-full bg-white/10 animate-pulse" />
              ) : isLive ? (
                <div className="w-3 h-3 rounded-full"
                  style={{
                    background: 'radial-gradient(circle, #53FC18, #1EAE0A)',
                    boxShadow: '0 0 8px rgba(83,252,24,0.8), 0 0 20px rgba(83,252,24,0.4)',
                    animation: 'live-pulse 2s ease-in-out infinite',
                  }}
                />
              ) : (
                <div className="w-3 h-3 rounded-full bg-white/15" />
              )}
            </div>
            <div className="flex flex-col">
              {isLive === null ? (
                <>
                  <span className="font-bold text-[13px] tracking-[0.12em] leading-tight text-white/30"
                    style={{ fontFamily: 'Cairo, sans-serif' }}>---</span>
                  <span className="text-[11px] leading-tight text-white/15">Checking...</span>
                </>
              ) : isLive ? (
                <>
                  <span className="font-bold text-[13px] tracking-[0.12em] leading-tight"
                    style={{
                      fontFamily: 'Cairo, sans-serif',
                      background: 'linear-gradient(135deg, #53FC18, #26D60A)',
                      WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent',
                    }}
                  >LIVE NOW</span>
                  <span className="text-[11px] leading-tight truncate max-w-[160px] text-white/40">
                    {streamTitle || 'Live'}
                  </span>
                </>
              ) : (
                <>
                  <span className="font-bold text-[13px] tracking-[0.12em] leading-tight text-white/25"
                    style={{ fontFamily: 'Cairo, sans-serif' }}>OFFLINE</span>
                  <span className="text-[11px] leading-tight text-white/15">Stream offline</span>
                </>
              )}
            </div>
          </div>

          {/* Left Menu */}
          <div className="hidden lg:flex items-center gap-0.5">
            {navLinks.slice(0, 3).map(({ href, label }) => (
              <NavLink key={href} href={href} label={label} layoutId="navActiveLine" />
            ))}
          </div>

          {/* Logo Circle (Center) */}
          <div className="absolute left-1/2 -translate-x-1/2 lg:-bottom-[18px] z-[110]">
            <motion.div whileHover={{ scale: 1.06 }} className="relative">
              <div
                className="absolute -inset-3 rounded-full pointer-events-none"
                style={{
                  background: 'conic-gradient(from 0deg, transparent, rgba(217, 164, 65, 0.2), transparent, rgba(255, 122, 24, 0.15), transparent)',
                  filter: 'blur(6px)',
                  animation: 'border-glow-rotate 10s linear infinite',
                }}
              />
              <div
                className="w-[92px] h-[92px] rounded-full overflow-hidden flex items-center justify-center relative"
                style={{
                  background: 'radial-gradient(circle, rgba(255, 122, 24, 0.25) 0%, rgba(18, 12, 10, 0.95) 60%)',
                  border: '2px solid rgba(217, 164, 65, 0.6)',
                  boxShadow: `
                    0 0 25px rgba(255, 122, 24, 0.25),
                    0 0 50px rgba(217, 164, 65, 0.12),
                    0 8px 32px rgba(0, 0, 0, 0.5),
                    inset 0 0 20px rgba(255, 122, 24, 0.08),
                    inset 0 2px 4px rgba(217, 164, 65, 0.1)
                  `,
                }}
              >
                <img
                  src={logoImg}
                  alt="TMNAA"
                  className="w-[72px] h-[72px] object-cover rounded-full"
                  style={{ filter: 'drop-shadow(0 0 10px rgba(255, 122, 24, 0.3))' }}
                />
              </div>
            </motion.div>
          </div>

          {/* Right Menu */}
          <div className="hidden lg:flex items-center gap-0.5 lg:mr-64">
            {navLinks.slice(3).map(({ href, label }) => (
              <NavLink key={href} href={href} label={label} layoutId="navActiveLine2" />
            ))}
          </div>

          {/* Search + Bell + Profile */}
          <div className="hidden lg:flex items-center gap-3 min-w-[220px] justify-end">
            {/* Search */}
            <div className="relative" ref={searchRef}>
              <div
                className={`flex items-center gap-2.5 px-4 h-[42px] rounded-[25px] transition-all duration-400 ${searchOpen ? 'ring-1 ring-[#D9A441]/30' : ''}`}
                style={{
                  width: '180px',
                  background: 'rgba(26, 18, 13, 0.6)',
                  border: '1px solid rgba(217, 164, 65, 0.12)',
                  boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.2), inset 0 -1px 0 rgba(217, 164, 65, 0.04)',
                }}
              >
                <FaMagnifyingGlass size={12} className={`transition-colors flex-shrink-0 ${searchOpen ? 'text-[#D9A441]' : 'text-[#D9A441]/40'}`} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => { setSearchOpen(true); setSearchQuery(e.target.value); }}
                  onFocus={() => setSearchOpen(true)}
                  placeholder="Search..."
                  className="bg-transparent text-[#F7F3EE] text-[13px] outline-none w-full placeholder:text-[rgba(247,243,238,0.2)] font-medium"
                />
                {searchQuery && (
                  <button onClick={() => { setSearchQuery(''); setSearchResults([]); }} className="text-white/20 hover:text-white/50 transition-colors">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Search Results Dropdown */}
              <AnimatePresence>
                {searchOpen && searchQuery.trim() && (
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.97 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                    className="absolute top-full right-0 mt-2 w-[360px] rounded-2xl overflow-hidden z-50"
                    style={{
                      background: 'rgba(14, 10, 8, 0.97)',
                      backdropFilter: 'blur(30px)',
                      WebkitBackdropFilter: 'blur(30px)',
                      border: '1.5px solid rgba(217, 164, 65, 0.15)',
                      boxShadow: '0 20px 60px rgba(0,0,0,0.7), 0 0 40px rgba(217,164,65,0.06)',
                    }}
                  >
                    {/* Header */}
                    <div className="px-4 pt-3 pb-2 border-b border-white/5">
                      <p className="text-[11px] font-bold tracking-[0.15em] uppercase" style={{ color: 'rgba(217, 164, 65, 0.5)' }}>
                        🔍 نتائج البحث — اللقطات والبثوث السابقة
                      </p>
                    </div>

                    <div className="p-2 space-y-0.5 max-h-[400px] overflow-y-auto">
                      {clipsLoading ? (
                        <div className="flex items-center justify-center py-8 gap-3">
                          <div className="w-4 h-4 border-2 border-[#D9A441]/30 border-t-[#D9A441] rounded-full animate-spin" />
                          <span className="text-[13px] text-white/40">جاري التحميل...</span>
                        </div>
                      ) : searchResults.length > 0 ? (
                        searchResults.map((clip: any) => (
                          <button
                            key={clip.id}
                            onClick={() => handleSearchResult(clip)}
                            className="flex items-center gap-3 w-full p-2.5 rounded-xl hover:bg-white/5 transition-all text-left group"
                          >
                            <div className="w-16 aspect-video rounded-lg overflow-hidden shrink-0 bg-black/60 relative">
                              <img src={clip.thumbnail_url} alt={clip.title} className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity" loading="lazy" />
                              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <div className="w-6 h-6 rounded-full bg-[#D9A441]/80 flex items-center justify-center">
                                  <svg className="w-3 h-3 text-white ml-0.5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                                </div>
                              </div>
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-[8px] font-bold px-1.5 py-0.5 rounded uppercase" 
                                  style={{
                                    background: clip.type === 'video' ? 'rgba(217, 164, 65, 0.2)' : 'rgba(255, 122, 24, 0.2)',
                                    color: clip.type === 'video' ? '#D9A441' : '#FF7A18'
                                  }}>
                                  {clip.type === 'video' ? 'VOD' : 'CLIP'}
                                </span>
                                <p className="text-[13px] font-bold text-white/80 group-hover:text-white truncate transition-colors">{clip.title}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-white/30">
                                  {new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(clip.view_count)} views
                                </span>
                                {clip.duration && (
                                  <span className="text-[10px] text-white/20">
                                    {Math.floor(clip.duration / 3600) > 0 
                                      ? `${Math.floor(clip.duration / 3600)}:${String(Math.floor((clip.duration % 3600) / 60)).padStart(2, '0')}:${String(clip.duration % 60).padStart(2, '0')}`
                                      : `${Math.floor(clip.duration / 60)}:${String(clip.duration % 60).padStart(2, '0')}`
                                    }
                                  </span>
                                )}
                              </div>
                            </div>
                            <svg className="w-3.5 h-3.5 text-white/20 group-hover:text-[#D9A441] transition-colors shrink-0" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M8 5v14l11-7z" />
                            </svg>
                          </button>
                        ))
                      ) : (
                        <div className="flex flex-col items-center justify-center py-8 gap-2">
                          <svg className="w-8 h-8 text-white/10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                          </svg>
                          <span className="text-[13px] text-white/30">ما لقيت نتائج لـ "{searchQuery}"</span>
                          <span className="text-[11px] text-white/15">جرب كلمات ثانية</span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Bell */}
            <div className="relative">
              <button
                onClick={() => setNotifOpen((p) => !p)}
                className="w-[42px] h-[42px] rounded-full flex items-center justify-center transition-all duration-300 hover:bg-[rgba(217,164,65,0.06)]"
                style={{
                  border: '1px solid rgba(217, 164, 65, 0.1)',
                  boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.15)',
                }}
              >
                <FaBell size={15} className="text-[rgba(247,243,238,0.45)] hover:text-[#D9A441] transition-colors duration-300" />
              </button>
              {unreadCount > 0 && (
                <div
                  className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1"
                  style={{
                    background: 'linear-gradient(135deg, #D94A2B, #FF4A1C)',
                    boxShadow: '0 0 8px rgba(217, 74, 43, 0.6)',
                  }}
                >
                  <span className="text-[8px] text-white font-bold">{unreadCount > 9 ? '9+' : unreadCount}</span>
                </div>
              )}
              <NotificationPanel
                open={notifOpen}
                onClose={() => setNotifOpen(false)}
                notifications={notifications}
                unreadCount={unreadCount}
                onMarkAllRead={markAllRead}
                onMarkRead={markRead}
                alignRight={false}
              />
            </div>

            {/* Profile */}
            <div className="flex items-center gap-2.5 cursor-pointer group/profile">
              <div
                className="w-[42px] h-[42px] rounded-full overflow-hidden flex-shrink-0 transition-all duration-400 group-hover/profile:shadow-[0_0_20px_rgba(255,122,24,0.25)]"
                style={{ border: '1.5px solid rgba(217, 164, 65, 0.35)' }}
              >
                <img src={logoImg} alt="TMNAA" className="w-full h-full object-cover" />
              </div>
              <div className="flex flex-col">
                <span className="text-[13px] font-bold leading-tight" style={{ fontFamily: 'Cairo, sans-serif', color: '#F7F3EE' }}>
                  TMNAA
                </span>
                <span className="text-[10px] font-bold leading-tight" style={{ color: isLive ? '#53FC18' : 'rgba(247,243,238,0.3)' }}>
                  {isLive ? '● Live' : '● Offline'}
                </span>
              </div>
            </div>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="lg:hidden w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300"
            style={{
              color: 'rgba(247, 243, 238, 0.6)',
              border: '1px solid rgba(217, 164, 65, 0.15)',
            }}
          >
            {mobileOpen ? <FaXmark size={16} /> : <FaBars size={16} />}
          </button>
        </nav>
      </motion.header>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="fixed top-[80px] left-[2.5%] right-[2.5%] z-[99] lg:hidden"
          >
            <div
              className="rounded-[24px] overflow-hidden"
              style={{
                background: 'rgba(18, 12, 10, 0.95)',
                backdropFilter: 'blur(35px)',
                WebkitBackdropFilter: 'blur(35px)',
                border: '1.5px solid rgba(217, 164, 65, 0.15)',
                boxShadow: '0 20px 60px rgba(0,0,0,0.7), 0 0 40px rgba(255, 122, 24, 0.06), inset 0 1px 0 rgba(217, 164, 65, 0.06)',
              }}
            >
              <div className="p-5 flex flex-col gap-1">
                {/* Live Status */}
                <div className="flex items-center gap-3 px-4 py-3 mb-2">
                  {isLive ? (
                    <div className="w-2.5 h-2.5 rounded-full animate-pulse"
                      style={{ background: 'radial-gradient(circle, #53FC18, #1EAE0A)', boxShadow: '0 0 8px rgba(83,252,24,0.8)' }}
                    />
                  ) : (
                    <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
                  )}
                  <div className="flex flex-col">
                    <span className="font-bold text-xs tracking-[0.12em]"
                      style={{ fontFamily: 'Cairo, sans-serif', color: isLive ? '#53FC18' : 'rgba(247,243,238,0.3)' }}
                    >{isLive ? 'LIVE NOW' : 'OFFLINE'}</span>
                    <span className="text-[10px]" style={{ color: 'rgba(247, 243, 238, 0.35)' }}>
                      {isLive ? (streamTitle || 'Live') : 'Stream offline'}
                    </span>
                  </div>
                </div>
                <div className="h-px mx-3" style={{ background: 'linear-gradient(90deg, transparent, rgba(217, 164, 65, 0.1), transparent)' }} />

                {navLinks.map(({ href, label }, i) => {
                  const isActive = isLinkActive(href);
                  return (
                    <motion.a
                      key={href}
                      href={href}
                      onClick={(e) => { e.preventDefault(); setMobileOpen(false); setTimeout(() => scrollToSection(e, href), 250); }}
                      initial={{ opacity: 0, x: -15 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="px-4 py-3.5 rounded-xl text-sm font-bold tracking-wider transition-all"
                      style={{
                        color: isActive ? '#D9A441' : 'rgba(247, 243, 238, 0.7)',
                        background: isActive ? 'rgba(217, 164, 65, 0.06)' : 'transparent',
                        fontFamily: 'Tajawal, sans-serif',
                      }}
                    >
                      {label}
                    </motion.a>
                  );
                })}

                <div className="h-px mx-3 mt-2" style={{ background: 'linear-gradient(90deg, transparent, rgba(217, 164, 65, 0.1), transparent)' }} />

                {/* Profile in mobile */}
                <div className="flex items-center gap-3 px-4 py-3 mt-2">
                  <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0"
                    style={{ border: '1.5px solid rgba(217, 164, 65, 0.3)' }}
                  >
                    <img src={logoImg} alt="TMNAA" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold" style={{ fontFamily: 'Cairo, sans-serif', color: '#F7F3EE' }}>TMNAA</span>
                    <span className="text-[10px] font-bold" style={{ color: isLive ? '#53FC18' : 'rgba(247,243,238,0.3)' }}>{isLive ? '● Live' : '● Offline'}</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedClip && <ClipModal clip={selectedClip} onClose={() => setSelectedClip(null)} />}
        {selectedVideo && <VodModal video={selectedVideo} onClose={() => setSelectedVideo(null)} />}
      </AnimatePresence>
    </>  
  );
}

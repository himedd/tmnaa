import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Notification } from '@/hooks/useNotifications';

interface NotificationPanelProps {
  open: boolean;
  onClose: () => void;
  notifications: Notification[];
  unreadCount: number;
  onMarkAllRead: () => void;
  onMarkRead: (id: string) => void;
  alignRight?: boolean;
}

function timeAgo(ts: number) {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function NotificationPanel({
  open, onClose, notifications, unreadCount, onMarkAllRead, onMarkRead, alignRight = true,
}: NotificationPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={panelRef}
          initial={{ opacity: 0, y: -10, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.97 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          className={`absolute top-full mt-3 w-[360px] max-h-[480px] rounded-2xl overflow-hidden z-50 ${alignRight ? 'right-0' : 'left-0'}`}
          style={{
            background: 'rgba(14, 10, 8, 0.97)',
            backdropFilter: 'blur(30px)',
            WebkitBackdropFilter: 'blur(30px)',
            border: '1.5px solid rgba(217, 164, 65, 0.15)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.7), 0 0 40px rgba(217,164,65,0.06)',
          }}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
            <span className="text-sm font-bold text-white tracking-wide">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={onMarkAllRead}
                className="text-[11px] font-bold text-[#D9A441]/70 hover:text-[#D9A441] transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="overflow-y-auto max-h-[400px] premium-scroll"
            style={{
              '--scr-from': 'rgba(217,164,65,0.3)',
              '--scr-to': 'rgba(217,164,65,0.1)',
            } as React.CSSProperties}
          >
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <svg className="w-8 h-8 text-white/10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                </svg>
                <span className="text-sm text-white/20 font-medium">No notifications yet</span>
              </div>
            ) : (
              <div className="py-1">
                {notifications.map((n, i) => (
                  <motion.button
                    key={n.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    onClick={() => onMarkRead(n.id)}
                    className={`flex items-start gap-3 w-full text-left px-5 py-3.5 transition-all hover:bg-white/[0.03] ${
                      !n.read ? 'bg-white/[0.02]' : ''
                    }`}
                  >
                    {n.image ? (
                      <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 bg-black/60 border border-white/5">
                        <img src={n.image} alt="" className="w-full h-full object-cover" loading="lazy" />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-[16px]" style={{
                        background: n.type === 'live'
                          ? 'linear-gradient(135deg, rgba(83,252,24,0.15), rgba(83,252,24,0.05))'
                          : 'linear-gradient(135deg, rgba(217,164,65,0.15), rgba(217,164,65,0.05))',
                        border: n.type === 'live'
                          ? '1px solid rgba(83,252,24,0.2)'
                          : '1px solid rgba(217,164,65,0.2)',
                      }}>
                        {n.title.split(' ')[0]}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-bold text-white truncate">{n.title}</span>
                        {!n.read && (
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{
                            background: 'radial-gradient(circle, #D9A441, #FF7A18)',
                            boxShadow: '0 0 6px rgba(217,164,65,0.6)',
                          }} />
                        )}
                      </div>
                      <p className="text-[12px] text-white/50 mt-0.5 line-clamp-2">{n.body}</p>
                      <span className="text-[10px] text-white/20 mt-1 block">{timeAgo(n.timestamp)}</span>
                    </div>
                  </motion.button>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

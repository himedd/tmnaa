import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ScrollText, Search, X, ShieldCheck } from 'lucide-react';
import type { AdminAction } from '@/lib/wallApi';
import { timeAgo } from '@/lib/wallApi';

const GOLD = '#D9A441';
const easeOut = [0.22, 1, 0.36, 1] as const;

const ACTION_META: Record<string, { label: string; c: string; bg: string; border: string }> = {
  approve: { label: 'approved', c: '#7FE08B', bg: 'rgba(80,200,120,0.12)', border: 'rgba(80,200,120,0.32)' },
  reject: { label: 'rejected', c: '#FF8A8A', bg: 'rgba(255,80,80,0.12)', border: 'rgba(255,80,80,0.32)' },
  unpublish: { label: 'took down', c: '#FF8A8A', bg: 'rgba(255,80,80,0.12)', border: 'rgba(255,80,80,0.32)' },
  undo: { label: 'undid', c: '#E2C48F', bg: 'rgba(217,182,122,0.12)', border: 'rgba(217,182,122,0.32)' },
  update: { label: 'edited', c: '#8AB4FF', bg: 'rgba(138,180,255,0.12)', border: 'rgba(138,180,255,0.32)' },
  note: { label: 'noted', c: '#8AB4FF', bg: 'rgba(138,180,255,0.12)', border: 'rgba(138,180,255,0.32)' },
  clear_reports: { label: 'cleared flags', c: '#FF9A3C', bg: 'rgba(255,140,60,0.12)', border: 'rgba(255,140,60,0.32)' },
  report: { label: 'flagged (public)', c: '#FF9A3C', bg: 'rgba(255,140,60,0.12)', border: 'rgba(255,140,60,0.32)' },
};

interface Props {
  actions: AdminAction[];
  itemNames: Map<string, string>;
}

export function AdminAuditLog({ actions, itemNames }: Props) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return actions;
    return actions.filter(
      (a) =>
        (a.admin ?? '').toLowerCase().includes(q) ||
        (a.action ?? '').toLowerCase().includes(q) ||
        (a.reason ?? '').toLowerCase().includes(q) ||
        (a.note ?? '').toLowerCase().includes(q) ||
        (a.meta ? JSON.stringify(a.meta) : '').toLowerCase().includes(q) ||
        (itemNames.get(a.submission_id) ?? '')
          .toLowerCase()
          .includes(q),
    );
  }, [actions, query, itemNames]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: easeOut }}
      className="rounded-[24px] p-5 md:p-6 relative overflow-hidden"
      style={{ background: 'linear-gradient(160deg, rgba(26,18,12,0.9), rgba(12,9,6,0.92))', border: '1px solid rgba(217,164,65,0.14)', boxShadow: '0 12px 34px rgba(0,0,0,0.4)' }}
    >
      <div className="absolute top-0 left-[15%] right-[15%] h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(217,164,65,0.4), transparent)' }} />
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <span className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(145deg, rgba(232,180,92,0.18), rgba(0,0,0,0.3))', border: '1px solid rgba(217,164,65,0.35)', boxShadow: '0 0 18px rgba(217,164,65,0.2)' }}>
          <ScrollText className="w-5 h-5 text-[#E8B45C]" />
        </span>
        <div className="min-w-0">
          <h3 className="text-[14px] font-black tracking-wide" style={{ fontFamily: 'Cairo, sans-serif', color: '#F7F3EE' }}>
            Full audit log
          </h3>
          <p className="text-[11px] font-medium" style={{ color: 'rgba(247,243,238,0.42)' }}>Every moderation action, in order · {actions.length} total</p>
        </div>
        <div className="ml-auto flex items-center gap-2 h-11 px-4 rounded-2xl min-w-[220px] flex-1 sm:flex-none transition-all focus-within:border-[#D9A441]/50 focus-within:shadow-[0_0_20px_rgba(217,164,65,0.15)]" style={{ border: '1px solid rgba(217,164,65,0.2)', background: 'rgba(5,4,3,0.6)' }}>
          <Search className="w-4 h-4 text-[#D9A441]/60 shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by name, action, reason…"
            className="flex-1 min-w-0 bg-transparent h-full text-[12.5px] outline-none font-medium placeholder:text-[rgba(247,243,238,0.28)]"
            style={{ color: '#F7F3EE', fontFamily: 'Tajawal, sans-serif' }}
          />
          {query && <button onClick={() => setQuery('')} className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-white/10 shrink-0 transition-colors"><X className="w-3.5 h-3.5 text-white/50" /></button>}
        </div>
      </div>
      <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1 premium-scroll" style={{ ['--scr-from' as string]: 'rgba(217,164,65,0.4)', ['--scr-to' as string]: 'rgba(217,164,65,0.1)' } as React.CSSProperties}>
        <AnimatePresence initial={false}>
          {filtered.map((act, i) => {
            const meta = ACTION_META[act.action] ?? { label: act.action, c: '#ccc', bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.1)' };
            const by = act.admin ? String(act.admin) : 'system';
            const byShort = by.split('@')[0] || by;
            const subName = itemNames.get(act.submission_id);
            return (
              <motion.div
                key={act.id}
                layout
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4, ease: easeOut, delay: Math.min(i * 0.02, 0.25) }}
                whileHover={{ x: 4 }}
                className="group flex items-center gap-3 px-4 py-3 rounded-2xl transition-colors hover:bg-white/[0.03]"
                style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)' }}
              >
                <span className="px-2.5 py-1 rounded-full text-[9.5px] font-black uppercase tracking-[0.12em] shrink-0 w-[118px] text-center tabular-nums" style={{ background: meta.bg, color: meta.c, border: `1px solid ${meta.border}` }}>
                  {meta.label}
                </span>
                <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium" style={{ color: 'rgba(247,243,238,0.75)' }}>
                  {subName ? (
                    <>@<b style={{ color: '#F7F3EE' }}>{subName}</b></>
                  ) : (
                    <span className="uppercase text-[10px] font-mono" style={{ color: 'rgba(247,243,238,0.4)' }}>#{act.submission_id.slice(0, 8)}</span>
                  )}
                  {(act.reason || act.note) && (
                    <span className="ml-1.5 font-medium" style={{ color: 'rgba(247,243,238,0.45)' }}>
                      — {act.reason ? act.reason : act.note}
                    </span>
                  )}
                </span>
                <span className="shrink-0 hidden sm:inline-flex items-center gap-1.5 text-[10.5px] font-bold tabular-nums px-2.5 py-1 rounded-full" style={{ color: 'rgba(247,243,238,0.42)', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <ShieldCheck className="w-3 h-3 text-[#D9A441]/50" /> {byShort} · {timeAgo(act.created_at)}
                </span>
                <span className="shrink-0 sm:hidden text-[10.5px] tabular-nums" style={{ color: 'rgba(247,243,238,0.35)' }}>
                  {timeAgo(act.created_at)}
                </span>
              </motion.div>
            );
          })}
        </AnimatePresence>
        {filtered.length === 0 && (
          <motion.p initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="py-12 text-center text-[13px] font-bold" style={{ color: 'rgba(247,243,238,0.4)' }}>
            {query ? 'No matching actions. Try another filter.' : 'The audit log is empty for now.'}
          </motion.p>
        )}
      </div>
    </motion.div>
  );
}

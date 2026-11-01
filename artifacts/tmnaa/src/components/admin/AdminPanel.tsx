import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck,
  RefreshCw,
  Loader2,
  Link2,
  Play,
  ExternalLink,
  EyeOff,
  Clock,
  ThumbsUp,
  ThumbsDown,
  Flag,
  Copy,
  Zap,
  X,
  Lock,
  LogOut,
  Undo2,
  CheckSquare,
  Square,
  Trash2,
  Search,
  Inbox,
  CheckCircle2,
  AlertTriangle,
  Ban,
  ScrollText,
  LayoutDashboard,
  Sparkles,
  ChevronRight,
  Eye,
} from 'lucide-react';
import {
  adminAll,
  adminApprove,
  adminAudit,
  adminBeginReview,
  adminBulk,
  adminClearReports,
  adminEndReview,
  adminFlagged,
  adminList,
  adminReject,
  adminStatus,
  adminUndo,
  adminUnpublish,
  adminWhoami,
  clearAdminToken,
  hostOf,
  timeAgo,
  type AdminAction,
  type AdminStatus,
  type WallItem,
  type WallStatus,
} from '@/lib/wallApi';
import { decorateItems, isReviewLocked, type BadgeMap } from '@/lib/moderation';
import { ReviewModal } from './ReviewModal';
import { AdminDashboard } from './AdminDashboard';
import { AdminAuditLog } from './AdminAuditLog';

const easeOut = [0.22, 1, 0.36, 1] as const;
const GOLD = '#D9A441';

export type AdminTab = 'queue' | 'approved' | 'flagged' | 'rejected' | 'audit' | 'dashboard';

type ConfirmState = {
  kind: 'approve' | 'reject' | 'unpublish';
  ids: string[];
} | null;

type UndoState = { ids: string[]; label: string } | null;

const STATUS_ORDER = { pending: 0, approved: 1, rejected: 2 } as const;

function statusChip(status: string | undefined) {
  const map: Record<string, { label: string; c: string; bg: string; dot: string }> = {
    pending: { label: 'Pending', c: '#E8B45C', bg: 'rgba(217,164,65,0.1)', dot: '#E8B45C' },
    approved: { label: 'Approved', c: '#7FE08B', bg: 'rgba(80,200,120,0.12)', dot: '#7FE08B' },
    rejected: { label: 'Rejected', c: '#FF7A7A', bg: 'rgba(255,80,80,0.12)', dot: '#FF7A7A' },
  };
  return map[status ?? ''] ?? { label: status ?? '', c: '#ccc', bg: 'rgba(255,255,255,0.05)', dot: '#ccc' };
}

function MediaThumb({ item }: { item: WallItem }) {
  if (item.posterUrl) {
    return <img src={item.posterUrl} alt="" className="w-full h-full object-cover" loading="lazy" />;
  }
  if (item.mediaType === 'link') {
    return (
      <div className="w-full h-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(217,164,65,0.08), rgba(0,0,0,0.4))' }}>
        <Link2 className="w-5 h-5 text-[#D9A441]/60" />
      </div>
    );
  }
  return (
    <div className="w-full h-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(217,164,65,0.08), rgba(0,0,0,0.4))' }}>
      <Play className="w-5 h-5 text-[#D9A441]/60" />
    </div>
  );
}

const REJECT_REASON_LABELS: Record<string, string> = {};

function defaultReasonLabel(reason: string) {
  return REJECT_REASON_LABELS[reason] ?? reason ?? 'Other';
}

export function AdminPanel() {
  const [tab, setTab] = useState<AdminTab>('queue');
  const [counts, setCounts] = useState<AdminStatus>({ pending: 0, approved: 0, rejected: 0 });
  const [items, setItems] = useState<WallItem[]>([]);
  const [flagged, setFlagged] = useState<WallItem[]>([]);
  const [actions, setActions] = useState<AdminAction[]>([]);
  const [who, setWho] = useState('');
  const [badges, setBadges] = useState<BadgeMap>(new Map());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'image' | 'video' | 'link'>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'hour' | 'day' | 'week'>('all');
  const [sort, setSort] = useState<'newest' | 'oldest' | 'likes'>('newest');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [modalId, setModalId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [confirmReason, setConfirmReason] = useState('');
  const [undo, setUndo] = useState<UndoState>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [c, all, fl, act, me] = await Promise.all([
        adminStatus(),
        adminAll(),
        adminFlagged(),
        adminAudit(),
        adminWhoami(),
      ]);
      setCounts(c);
      setItems(all);
      setFlagged(fl.items);
      setActions(act);
      setWho(me);
      setBadges(decorateItems(all));
    } catch (e) {
      if (String((e as Error).message) === 'unauthorized') {
        clearAdminToken();
        window.location.reload();
        return;
      }
      setError('Failed to load submissions.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // auto-dismiss undo toast after 10s
  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(() => setUndo(null), 10000);
    return () => clearTimeout(t);
  }, [undo]);

  const filtered = useMemo(() => {
    let list: WallItem[];
    if (tab === 'approved') list = items.filter((i) => i.status === 'approved');
    else if (tab === 'rejected') list = items.filter((i) => i.status === 'rejected');
    else list = items.filter((i) => i.status === 'pending');

    if (tab === 'queue' || tab === 'approved' || tab === 'rejected') {
      const q = query.trim().toLowerCase();
      if (q) {
        list = list.filter(
          (i) => i.name.toLowerCase().includes(q) || i.caption.toLowerCase().includes(q),
        );
      }
      if (typeFilter !== 'all') list = list.filter((i) => i.mediaType === typeFilter);
      const now = Date.now();
      if (dateFilter !== 'all') {
        const cutoff = dateFilter === 'hour' ? 3600_000 : dateFilter === 'day' ? 86_400_000 : 7 * 86_400_000;
        list = list.filter((i) => now - new Date(i.createdAt).getTime() <= cutoff);
      }
      if (sort === 'newest') list = [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      else if (sort === 'oldest') list = [...list].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      else list = [...list].sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0));
    } else {
      list = [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    return list;
  }, [items, tab, query, typeFilter, dateFilter, sort]);

  const pool = tab === 'flagged' ? flagged : filtered;
  const modalIndex = modalId ? pool.findIndex((i) => i.id === modalId) : -1;

  const allNames = useMemo(() => {
    const m = new Map<string, string>();
    for (const it of items) m.set(it.id, it.name);
    return m;
  }, [items]);

  const notify = (msg: string, isErr = false) => {
    if (isErr) {
      setError(msg);
      setTimeout(() => setError(''), 5000);
    } else {
      setNotice(msg);
      setTimeout(() => setNotice(''), 5000);
    }
  };

  /** approve/reject/unpublish for one or many ids; returns count performed. */
  const runAction = async (kind: 'approve' | 'reject' | 'unpublish', ids: string[], reason?: string) => {
    setBusy(true);
    setError('');
    try {
      const single = ids.length === 1;
      if (single) {
        const id = ids[0];
        if (kind === 'approve') await adminApprove(id);
        else if (kind === 'reject') await adminReject(id, reason ?? 'Other');
        else await adminUnpublish(id, reason ?? 'Other');
      } else {
        const op =
          kind === 'approve' ? 'approve' : kind === 'reject' ? 'reject' : 'unpublish';
        const results = await adminBulk(op, ids, reason);
        const failed = results.filter((r) => r.state === 'failed').length;
        const skipped = results.filter((r) => r.state === 'skipped').length;
        if (failed > 0) notify(`${failed} item${failed > 1 ? 's' : ''} failed to ${kind}.`, true);
        else if (skipped > 0) {
          notify(
            skipped === results.length
              ? `Nothing changed — ${kind} already applied to ${results.length === 1 ? 'that item' : 'all of them'}.`
              : `${skipped} item${skipped > 1 ? 's' : ''} were already in that state and were skipped.`,
            true,
          );
        }
      }
      const label =
        kind === 'approve'
          ? `Approved ${single ? '1 edit' : `${ids.length} edits`}`
          : kind === 'reject'
            ? `Rejected ${single ? '1 edit' : `${ids.length} edits`}`
            : `Unpublished ${single ? '1 edit' : `${ids.length} edits`}`;
      setUndo({ ids, label });
      if (single && modalId && modalId === ids[0]) setModalId(null);
      await load();
    } catch (e) {
      const msg = String((e as Error).message);
      if (msg === 'unauthorized') {
        clearAdminToken();
        window.location.reload();
        return;
      }
      notify('The action failed. Try again.', true);
    } finally {
      setBusy(false);
      setSelected(new Set());
      setConfirm(null);
    }
  };

  const doUndo = async () => {
    if (!undo) return;
    setBusy(true);
    try {
      for (const id of undo.ids) {
        try {
          await adminUndo(id);
        } catch (e) {
          if (String((e as Error).message) === 'undo_window_expired') {
            notify('Undo window closed.', true);
            break;
          }
        }
      }
      setUndo(null);
      await load();
    } catch {
      notify('Undo failed.', true);
    } finally {
      setBusy(false);
    }
  };

  const openItem = async (item: WallItem) => {
    setModalId(item.id);
    if (item.status === 'pending' || item.status === 'approved') {
      await adminBeginReview(item.id).catch(() => {});
    }
  };

  const closeItem = async (id: string) => {
    setModalId(null);
    await adminEndReview(id).catch(() => {});
  };

  const goNext = async () => {
    if (modalIndex < 0) return;
    const next = pool[modalIndex + 1];
    if (!next) {
      await closeItem(pool[modalIndex].id);
      return;
    }
    await adminEndReview(pool[modalIndex].id).catch(() => {});
    setModalId(next.id);
    await adminBeginReview(next.id).catch(() => {});
  };

  const goPrev = async () => {
    if (modalIndex <= 0) return;
    const prev = pool[modalIndex - 1];
    await adminEndReview(pool[modalIndex].id).catch(() => {});
    setModalId(prev.id);
    await adminBeginReview(prev.id).catch(() => {});
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const TABS: { value: AdminTab; label: string; count: number; color: string; icon: any }[] = [
    { value: 'queue', label: 'Queue', count: counts.pending, color: '#E8B45C', icon: Inbox },
    { value: 'approved', label: 'Approved', count: counts.approved, color: '#7FE08B', icon: CheckCircle2 },
    { value: 'flagged', label: 'Flagged', count: flagged.length, color: '#FF9A3C', icon: Flag },
    { value: 'rejected', label: 'Rejected', count: counts.rejected, color: '#FF7A7A', icon: Ban },
    { value: 'audit', label: 'Audit Log', count: actions.length, color: '#8AB4FF', icon: ScrollText },
    { value: 'dashboard', label: 'Dashboard', count: 0, color: '#D9A441', icon: LayoutDashboard },
  ];

  const totalAll = counts.pending + counts.approved + counts.rejected;
  const statCards = [
    { key: 'pending', value: counts.pending, label: 'Awaiting review', c: '#E8B45C', bg: 'rgba(217,164,65,0.12)', icon: Clock, pct: totalAll ? Math.round((counts.pending / Math.max(1, totalAll)) * 100) : 0 },
    { key: 'approved', value: counts.approved, label: 'Live on wall', c: '#7FE08B', bg: 'rgba(80,200,120,0.1)', icon: CheckCircle2, pct: totalAll ? Math.round((counts.approved / Math.max(1, totalAll)) * 100) : 0 },
    { key: 'rejected', value: counts.rejected, label: 'Hidden', c: '#FF7A7A', bg: 'rgba(255,80,80,0.1)', icon: Ban, pct: totalAll ? Math.round((counts.rejected / Math.max(1, totalAll)) * 100) : 0 },
    { key: 'flagged', value: flagged.length, label: 'Needs attention', c: '#FF9A3C', bg: 'rgba(255,140,60,0.1)', icon: AlertTriangle, pct: flagged.length ? Math.min(100, flagged.length * 10) : 0 },
  ] as const;

  const filterChip = <T extends string>(
    value: T,
    current: T,
    label: string,
    onChange: (v: T) => void,
  ) => {
    const active = value === current;
    return (
      <motion.button
        key={String(value) + label}
        onClick={() => onChange(value)}
        whileHover={{ scale: 1.05, y: -1 }}
        whileTap={{ scale: 0.95 }}
        className="px-3.5 h-8 rounded-full text-[11px] font-bold tracking-wide transition-all duration-300 relative overflow-hidden"
        style={{
          fontFamily: 'Cairo, sans-serif',
          color: active ? '#0d0906' : 'rgba(247,243,238,0.6)',
          background: active ? 'linear-gradient(135deg, #F4C876, #D9A441)' : 'rgba(255,255,255,0.035)',
          border: `1px solid ${active ? 'transparent' : 'rgba(255,255,255,0.09)'}`,
          boxShadow: active ? '0 0 16px rgba(217,164,65,0.35)' : 'none',
        }}
      >
        {label}
      </motion.button>
    );
  };

  const itemById = (id: string) => items.find((i) => i.id === id);

  return (
    <div className="w-full max-w-6xl relative">
      {/* ambient glows */}
      <div className="absolute -top-20 left-1/4 w-[420px] h-[220px] pointer-events-none" style={{ background: 'radial-gradient(ellipse, rgba(255,122,24,0.08) 0%, transparent 70%)', filter: 'blur(30px)' }} />

      {/* header */}
      <motion.div
        initial={{ opacity: 0, y: -18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.65, ease: easeOut }}
        className="relative rounded-[26px] p-5 md:p-6 mb-6 overflow-hidden"
        style={{
          background: 'linear-gradient(160deg, rgba(30,20,12,0.9) 0%, rgba(14,10,7,0.92) 60%)',
          border: '1px solid rgba(217,164,65,0.18)',
          boxShadow: '0 18px 50px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)',
          backdropFilter: 'blur(20px)',
        }}
      >
        <div className="absolute top-0 left-[15%] right-[15%] h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(232,180,92,0.6), transparent)' }} />
        <div className="absolute -top-24 -right-16 w-72 h-72 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(255,122,24,0.1) 0%, transparent 65%)', filter: 'blur(24px)' }} />
        <div className="flex items-center justify-between gap-4 flex-wrap relative">
          <div className="flex items-center gap-4">
            <div className="relative">
              <motion.div animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.7, 0.4] }} transition={{ duration: 2.8, repeat: Infinity }} className="absolute -inset-2.5 rounded-[20px]" style={{ background: 'radial-gradient(circle, rgba(217,164,65,0.3) 0%, transparent 70%)', filter: 'blur(8px)' }} />
              <div className="relative w-[54px] h-[54px] rounded-[18px] flex items-center justify-center overflow-hidden" style={{ background: 'linear-gradient(145deg, rgba(232,180,92,0.22), rgba(18,12,8,0.9))', border: '1.5px solid rgba(217,164,65,0.5)', boxShadow: '0 0 22px rgba(217,164,65,0.3), inset 0 1px 0 rgba(255,255,255,0.12)' }}>
                <div className="absolute inset-0 shimmer opacity-60" />
                <ShieldCheck className="w-7 h-7 text-[#E8B45C] relative" />
              </div>
              <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#7FE08B] opacity-60" />
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-[#7FE08B] border-2 border-[#14100b]" />
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-[22px] md:text-[26px] font-black tracking-tight leading-none" style={{ fontFamily: 'Cairo, sans-serif', color: '#F7F3EE' }}>
                  Moderation <span className="metal-shine">Console</span>
                </h1>
                <span className="inline-flex items-center gap-1 px-2.5 h-6 rounded-full text-[10px] font-black uppercase tracking-[0.18em]" style={{ background: 'rgba(127,224,139,0.1)', border: '1px solid rgba(127,224,139,0.3)', color: '#7FE08B' }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#7FE08B] animate-pulse" /> Live
                </span>
              </div>
              <p className="text-[12.5px] mt-1.5 flex items-center gap-1.5 flex-wrap" style={{ color: 'rgba(247,243,238,0.45)' }}>
                Every submission is reviewed by hand.
                {who ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold" style={{ background: 'rgba(217,164,65,0.08)', border: '1px solid rgba(217,164,65,0.22)', color: '#E8B45C' }}>
                    <Sparkles className="w-3 h-3" /> {who}
                  </span>
                ) : null}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <motion.button
              onClick={load}
              whileHover={{ scale: 1.06, rotate: -8 }}
              whileTap={{ scale: 0.92 }}
              className="group w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-300"
              style={{ border: '1px solid rgba(217,164,65,0.3)', background: 'linear-gradient(145deg, rgba(217,164,65,0.12), rgba(217,164,65,0.04))', boxShadow: '0 4px 16px rgba(0,0,0,0.3)' }}
              aria-label="Refresh"
            >
              <RefreshCw className={`w-[18px] h-[18px] text-[#E8B45C] transition-transform duration-700 ${loading ? 'animate-spin' : 'group-hover:rotate-180'}`} />
            </motion.button>
            <motion.button
              onClick={() => { clearAdminToken(); window.location.reload(); }}
              whileHover={{ scale: 1.04, y: -1 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-2 h-11 px-5 rounded-2xl text-[12.5px] font-bold transition-all duration-300"
              style={{ border: '1px solid rgba(255,122,122,0.25)', color: 'rgba(247,243,238,0.75)', background: 'rgba(255,80,80,0.05)' }}
            >
              <LogOut className="w-4 h-4" /> Lock
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 md:gap-4 mb-6">
        {statCards.map((s, idx) => (
          <motion.div
            key={s.key}
            initial={{ opacity: 0, y: 22, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.6, ease: easeOut, delay: idx * 0.08 }}
            whileHover={{ y: -5, scale: 1.02 }}
            className="group relative rounded-[22px] p-5 overflow-hidden cursor-default"
            style={{ background: 'linear-gradient(160deg, rgba(26,18,12,0.92), rgba(12,9,6,0.94))', border: `1px solid ${s.c}30`, boxShadow: '0 12px 34px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)' }}
          >
            <div className="absolute -top-12 -right-8 w-32 h-32 rounded-full opacity-50 pointer-events-none group-hover:scale-125 transition-transform duration-700" style={{ background: `radial-gradient(circle, ${s.bg} 0%, transparent 70%)`, filter: 'blur(12px)' }} />
            <div className="absolute bottom-0 left-0 right-0 h-[3px] overflow-hidden rounded-b-[22px]">
              <motion.div initial={{ width: 0 }} animate={{ width: `${s.pct}%` }} transition={{ duration: 1.1, ease: easeOut, delay: 0.3 + idx * 0.1 }} className="h-full rounded-full" style={{ background: `linear-gradient(90deg, ${s.c}66, ${s.c})`, boxShadow: `0 0 12px ${s.c}` }} />
            </div>
            <div className="flex items-start justify-between relative">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.26em]" style={{ color: s.c }}>{s.key}</p>
                <motion.p key={String(s.value)} initial={{ scale: 1.25, opacity: 0.4 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.45, ease: easeOut }} className="mt-1.5 text-[34px] leading-none font-black tabular-nums" style={{ fontFamily: 'Cairo, sans-serif', color: '#F7F3EE' }}>
                  {s.value}
                </motion.p>
                <p className="mt-1.5 text-[11px] font-medium" style={{ color: 'rgba(247,243,238,0.38)' }}>{s.label}</p>
              </div>
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 group-hover:rotate-6 group-hover:scale-110 transition-transform duration-500" style={{ background: s.bg, border: `1px solid ${s.c}40`, boxShadow: `0 0 18px ${s.c}22` }}>
                <s.icon className="w-5 h-5" style={{ color: s.c }} />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* errors + notice */}
      <AnimatePresence>
        {(error || notice) && (
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.4, ease: easeOut }}
            className="mb-5 rounded-2xl px-5 py-3.5 text-[13px] font-bold flex items-center gap-2.5"
            style={{
              background: notice ? 'rgba(80,200,120,0.07)' : 'rgba(255,80,80,0.07)',
              border: `1px solid ${notice ? 'rgba(80,200,120,0.28)' : 'rgba(255,80,80,0.28)'}`,
              color: notice ? '#7FE08B' : '#FF8A8A',
              boxShadow: notice ? '0 0 24px rgba(80,200,120,0.1)' : '0 0 24px rgba(255,80,80,0.12)',
            }}
          >
            <span className="w-2 h-2 rounded-full animate-pulse shrink-0" style={{ background: notice ? '#7FE08B' : '#FF6B6B', boxShadow: notice ? '0 0 10px #7FE08B' : '0 0 10px #FF6B6B' }} />
            {notice || error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* tabs */}
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: easeOut, delay: 0.1 }} className="flex items-center gap-2 mb-5 flex-wrap p-2 rounded-[22px]" style={{ background: 'rgba(10,8,6,0.7)', border: '1px solid rgba(217,164,65,0.12)', backdropFilter: 'blur(16px)' }}>
        {TABS.map((t) => {
          const active = tab === t.value;
          const Icon = t.icon;
          return (
            <button
              key={t.value}
              onClick={() => { setTab(t.value); setSelected(new Set()); }}
              className="relative px-4 md:px-5 h-11 rounded-2xl text-[12.5px] font-black tracking-wide transition-all duration-300 flex items-center gap-2"
              style={{ fontFamily: 'Cairo, sans-serif', color: active ? '#0d0906' : 'rgba(247,243,238,0.6)' }}
            >
              {active && (
                <motion.span layoutId="admin-tab-pill" transition={{ duration: 0.45, ease: easeOut }} className="absolute inset-0 rounded-2xl" style={{ background: `linear-gradient(135deg, #F4C876, ${t.color})`, boxShadow: `0 0 22px ${t.color}55, inset 0 1px 0 rgba(255,255,255,0.4)` }} />
              )}
              {!active && <span className="absolute inset-0 rounded-2xl hover:bg-white/[0.04] transition-colors" style={{ border: `1px solid ${t.color}22` }} />}
              <Icon className="w-4 h-4 relative z-10" style={{ color: active ? '#0d0906' : t.color }} />
              <span className="relative z-10">{t.label}</span>
              <span className="relative z-10 px-2 h-5 min-w-[22px] rounded-full inline-flex items-center justify-center text-[10.5px] font-black tabular-nums" style={{ background: active ? 'rgba(0,0,0,0.22)' : `${t.color}18`, color: active ? '#0d0906' : t.color, border: active ? 'none' : `1px solid ${t.color}30` }}>
                {t.value === 'dashboard' ? <ChevronRight className="w-3 h-3" /> : t.count}
              </span>
            </button>
          );
        })}
      </motion.div>

      {/* toolbar for list tabs */}
      {(tab === 'queue' || tab === 'approved' || tab === 'rejected') && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: easeOut }} className="mb-5 rounded-[22px] p-4 md:p-5 relative overflow-hidden" style={{ background: 'linear-gradient(160deg, rgba(22,16,10,0.85), rgba(12,9,6,0.88))', border: '1px solid rgba(217,164,65,0.14)', boxShadow: '0 10px 30px rgba(0,0,0,0.35)' }}>
          <div className="absolute top-0 left-[20%] right-[20%] h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(217,164,65,0.4), transparent)' }} />
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2.5 h-11 px-4 rounded-2xl flex-1 min-w-[190px] transition-all focus-within:border-[#D9A441]/50 focus-within:shadow-[0_0_20px_rgba(217,164,65,0.15)]" style={{ border: '1px solid rgba(217,164,65,0.2)', background: 'rgba(5,4,3,0.6)' }}>
              <Search className="w-4 h-4 text-[#D9A441]/60 shrink-0" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name or caption…"
                className="h-full flex-1 min-w-0 bg-transparent text-[13px] outline-none font-medium placeholder:text-[rgba(247,243,238,0.25)]"
                style={{ color: '#F7F3EE', fontFamily: 'Tajawal, sans-serif' }}
              />
              {query && <button onClick={() => setQuery('')} className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-white/10 shrink-0"><X className="w-3.5 h-3.5 text-white/50" /></button>}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {filterChip<'all' | 'image' | 'video' | 'link'>('all', typeFilter, 'All types', setTypeFilter)}
              {filterChip('image', typeFilter, 'Images', setTypeFilter)}
              {filterChip('video', typeFilter, 'Videos', setTypeFilter)}
              {filterChip('link', typeFilter, 'Links', setTypeFilter)}
            </div>
          </div>
          <div className="flex items-center gap-2.5 mt-3 flex-wrap">
            <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value as typeof dateFilter)} className="h-10 px-4 rounded-2xl text-[12px] font-bold outline-none bg-transparent cursor-pointer hover:border-[#D9A441]/40 transition-colors" style={{ border: '1px solid rgba(217,164,65,0.18)', color: 'rgba(247,243,238,0.75)', fontFamily: 'Cairo, sans-serif', background: 'rgba(5,4,3,0.5)' }}>
              <option value="all" style={{ color: '#000' }}>Any time</option>
              <option value="hour" style={{ color: '#000' }}>Last hour</option>
              <option value="day" style={{ color: '#000' }}>Last 24h</option>
              <option value="week" style={{ color: '#000' }}>Last 7 days</option>
            </select>
            <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="h-10 px-4 rounded-2xl text-[12px] font-bold outline-none bg-transparent cursor-pointer hover:border-[#D9A441]/40 transition-colors" style={{ border: '1px solid rgba(217,164,65,0.18)', color: 'rgba(247,243,238,0.75)', fontFamily: 'Cairo, sans-serif', background: 'rgba(5,4,3,0.5)' }}>
              <option value="newest" style={{ color: '#000' }}>Newest first</option>
              <option value="oldest" style={{ color: '#000' }}>Oldest first</option>
              {tab === 'approved' && <option value="likes" style={{ color: '#000' }}>Most liked</option>}
            </select>
            <span className="ml-auto text-[11.5px] font-bold tabular-nums px-3 h-8 rounded-full inline-flex items-center" style={{ color: 'rgba(247,243,238,0.4)', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              {pool.length} item{pool.length === 1 ? '' : 's'}
            </span>
          </div>
        </motion.div>
      )}

      {/* bulk bar */}
      <AnimatePresence>
        {selected.size > 0 && (tab === 'queue' || tab === 'flagged' || tab === 'approved') && (
          <motion.div
            initial={{ opacity: 0, y: -14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            className="mb-5 flex items-center gap-3 flex-wrap rounded-[20px] px-5 py-4 relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg, rgba(217,164,65,0.12), rgba(255,122,24,0.06))', border: '1.5px solid rgba(217,164,65,0.4)', boxShadow: '0 0 30px rgba(217,164,65,0.15), 0 10px 30px rgba(0,0,0,0.35)', backdropFilter: 'blur(12px)' }}
          >
            <div className="absolute inset-0 shimmer opacity-40 pointer-events-none" />
            <motion.span animate={{ rotate: [0, 12, -12, 0] }} transition={{ duration: 2, repeat: Infinity }} className="relative w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg, #E8B45C, #b3421f)', boxShadow: '0 0 16px rgba(217,164,65,0.45)' }}>
              <CheckSquare className="w-[18px] h-[18px] text-[#0d0906]" />
            </motion.span>
            <span className="relative text-[13.5px] font-black tabular-nums" style={{ color: '#F7F3EE', fontFamily: 'Cairo, sans-serif' }}>{selected.size} selected</span>
            {(tab === 'queue' || tab === 'flagged') && (
              <motion.button whileHover={{ scale: 1.06, y: -1 }} whileTap={{ scale: 0.94 }} onClick={() => setConfirm({ kind: 'approve', ids: [...selected] })} disabled={busy} className="premium-btn relative inline-flex items-center gap-2 h-10 px-5 rounded-2xl text-[12.5px] font-black disabled:opacity-50 overflow-hidden" style={{ color: '#0d0906', background: 'linear-gradient(135deg, #F4C876, #D9A441)', boxShadow: '0 0 18px rgba(217,164,65,0.4), inset 0 1px 0 rgba(255,255,255,0.4)', fontFamily: 'Cairo, sans-serif' }}>
                <span className="absolute inset-0" style={{ background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.4) 50%, transparent 60%)', backgroundSize: '250% 100%', animation: 'shimmer 2.5s infinite' }} />
                <ThumbsUp className="w-3.5 h-3.5 relative" /> <span className="relative">Approve all</span>
              </motion.button>
            )}
            {(tab === 'queue' || tab === 'approved') && (
              <motion.button whileHover={{ scale: 1.06, y: -1 }} whileTap={{ scale: 0.94 }} onClick={() => setConfirm({ kind: tab === 'approved' ? 'unpublish' : 'reject', ids: [...selected] })} disabled={busy} className="inline-flex items-center gap-2 h-10 px-5 rounded-2xl text-[12.5px] font-bold disabled:opacity-50 hover:bg-[rgba(255,80,80,0.14)] transition-colors" style={{ border: '1px solid rgba(255,122,122,0.45)', color: '#FF8A8A', background: 'rgba(255,80,80,0.08)' }}>
                <Trash2 className="w-3.5 h-3.5" /> {tab === 'approved' ? 'Take Down' : 'Reject all'}
              </motion.button>
            )}
            <button onClick={() => setSelected(new Set())} className="relative ml-auto text-[12px] font-bold hover:opacity-70 px-3 h-8 rounded-full hover:bg-white/5 transition-all" style={{ color: 'rgba(247,243,238,0.6)' }}>
              Clear
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* body */}
      {tab === 'dashboard' ? (
        <AdminDashboard items={items} actions={actions} who={who} itemNames={allNames} />
      ) : tab === 'audit' ? (
        <AdminAuditLog actions={actions} itemNames={allNames} />
      ) : loading ? (
        <div className="rounded-[26px] py-24 flex flex-col items-center justify-center gap-4 relative overflow-hidden" style={{ background: 'linear-gradient(160deg, rgba(22,16,10,0.8), rgba(12,9,6,0.85))', border: '1px solid rgba(217,164,65,0.12)' }}>
          <div className="relative">
            <div className="absolute -inset-5 rounded-full" style={{ background: 'radial-gradient(circle, rgba(217,164,65,0.25) 0%, transparent 70%)', filter: 'blur(12px)' }} />
            <Loader2 className="relative w-9 h-9 text-[#E8B45C] animate-spin" />
          </div>
          <p className="text-[13px] font-bold" style={{ color: 'rgba(247,243,238,0.45)' }}>Loading submissions…</p>
          <div className="w-44 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <motion.div className="h-full rounded-full" style={{ background: 'linear-gradient(90deg, #E8B45C, #b3421f)' }} animate={{ x: ['-100%', '220%'] }} transition={{ duration: 1.3, repeat: Infinity, ease: 'easeInOut' }} />
          </div>
        </div>
      ) : (
        <ListView
          tab={tab}
          items={pool}
          badges={badges}
          selected={selected}
          busy={busy}
          who={who}
          onSelect={toggleSelect}
          onOpen={openItem}
          onApprove={(id) => runAction('approve', [id])}
          onReject={(id) => setConfirm({ kind: 'reject', ids: [id] })}
          onUnpublish={(id) => setConfirm({ kind: 'unpublish', ids: [id] })}
          onClearFlags={(id) => {
            adminClearReports(id)
              .catch(() => notify('Could not clear flags.', true))
              .then(() => load());
          }}
        />
      )}

      {/* review modal */}
      <AnimatePresence>
        {modalId && modalIndex >= 0 && (
          <ReviewModal
            item={pool[modalIndex]}
            who={who}
            badge={badges.get(modalId)}
            position={{ index: modalIndex, total: pool.length }}
            busy={busy}
            onApprove={() => runAction('approve', [modalId])}
            onReject={(reason) => runAction('reject', [modalId], reason)}
            onUnpublish={(reason) => runAction('unpublish', [modalId], reason)}
            onUpdate={() => load()}
            onClose={() => closeItem(modalId)}
            onNext={() => goNext()}
            onPrev={() => goPrev()}
          />
        )}
      </AnimatePresence>

      {/* confirm dialog */}
      <AnimatePresence>
        {confirm && (
          <ConfirmDialog
            confirm={confirm}
            reason={confirmReason}
            setReason={setConfirmReason}
            busy={busy}
            onCancel={() => { setConfirm(null); setConfirmReason(''); }}
            onConfirm={() => runAction(confirm.kind, confirm.ids, confirmReason || undefined)}
          />
        )}
      </AnimatePresence>

      {/* undo toast */}
      <AnimatePresence>
        {undo && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.94 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[90] flex items-center gap-3 pl-4 pr-2 py-2 rounded-[20px] overflow-hidden"
            style={{
              background: 'rgba(20,14,9,0.96)',
              border: '1px solid rgba(217,164,65,0.45)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.65), 0 0 40px rgba(217,164,65,0.18)',
              backdropFilter: 'blur(20px)',
              minWidth: 'min(420px, calc(100vw - 40px))',
            }}
          >
            <span className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg, #E8B45C, #b3421f)', boxShadow: '0 0 16px rgba(217,164,65,0.5)' }}>
              <Undo2 className="w-5 h-5 text-[#0d0906]" />
            </span>
            <span className="text-[13px] font-black flex-1 truncate" style={{ color: '#F7F3EE', fontFamily: 'Cairo, sans-serif' }}>
              {undo.label}
            </span>
            <button onClick={doUndo} disabled={busy} className="px-5 h-10 rounded-2xl text-[12.5px] font-black transition-transform hover:scale-105 disabled:opacity-50 shrink-0" style={{ color: '#0d0906', background: 'linear-gradient(135deg, #F4C876, #D9A441)', fontFamily: 'Cairo, sans-serif', boxShadow: '0 0 16px rgba(217,164,65,0.35)' }}>
              Undo
            </button>
            <button onClick={() => setUndo(null)} className="w-9 h-9 rounded-xl flex items-center justify-center text-white/40 hover:text-white/80 hover:bg-white/5 transition-all shrink-0">
              <X className="w-4 h-4" />
            </button>
            <motion.div initial={{ scaleX: 1 }} animate={{ scaleX: 0 }} transition={{ duration: 10, ease: 'linear' }} className="absolute bottom-0 left-0 right-0 h-[2.5px] origin-left" style={{ background: 'linear-gradient(90deg, #E8B45C, #b3421f)' }} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// list view
// ---------------------------------------------------------------------------

interface ListProps {
  tab: AdminTab;
  items: WallItem[];
  badges: BadgeMap;
  selected: Set<string>;
  busy: boolean;
  who: string;
  onSelect: (id: string) => void;
  onOpen: (item: WallItem) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onUnpublish: (id: string) => void;
  onClearFlags: (id: string) => void;
}

function ListView({ tab, items, badges, selected, busy, who, onSelect, onOpen, onApprove, onReject, onUnpublish, onClearFlags }: ListProps) {
  const selectable = tab === 'queue' || tab === 'flagged' || tab === 'approved';

  if (items.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.55, ease: easeOut }}
        className="rounded-[26px] py-20 px-6 text-center relative overflow-hidden"
        style={{ background: 'linear-gradient(160deg, rgba(22,16,10,0.8), rgba(12,9,6,0.85))', border: '1px dashed rgba(217,164,65,0.25)' }}
      >
        <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut' }} className="mx-auto mb-5 w-[68px] h-[68px] rounded-[22px] flex items-center justify-center relative" style={{ background: 'linear-gradient(145deg, rgba(217,164,65,0.12), rgba(0,0,0,0.3))', border: '1px solid rgba(217,164,65,0.3)', boxShadow: '0 0 30px rgba(217,164,65,0.15)' }}>
          <EyeOff className="w-7 h-7 text-[#D9A441]/60" />
        </motion.div>
        <p className="text-[15px] font-black" style={{ color: '#F7F3EE', fontFamily: 'Cairo, sans-serif' }}>
          {tab === 'flagged' ? 'No flagged submissions.' : 'Nothing here yet.'}
        </p>
        <p className="text-[12.5px] mt-1.5 font-medium" style={{ color: 'rgba(247,243,238,0.4)' }}>
          {tab === 'queue' ? 'The queue is clear. Take a breath — new edits will land here.' : 'Items matching this view will appear here.'}
        </p>
      </motion.div>
    );
  }

  const accentOf = (item: WallItem) => {
    if (tab === 'flagged') return '#FF9A3C';
    if (item.status === 'pending') return '#E8B45C';
    if (item.status === 'rejected') return '#FF6B6B';
    return '#7FE08B';
  };

  return (
    <div className="space-y-3.5">
      <AnimatePresence initial={false}>
        {items.map((item, idx) => {
          const chip = statusChip(tab === 'flagged' ? 'approved' : item.status ?? '');
          const badge = badges.get(item.id);
          const locked = isReviewLocked(item, who);
          const isSelected = selected.has(item.id);
          const accent = accentOf(item);
          return (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, y: 26, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.25 } }}
              transition={{ duration: 0.55, ease: easeOut, delay: Math.min(idx * 0.04, 0.3) }}
              whileHover={{ y: -3 }}
              className="group rounded-[22px] overflow-hidden relative"
              style={{
                background: 'linear-gradient(160deg, rgba(30,21,13,0.95), rgba(15,10,7,0.94))',
                border: `1px solid ${isSelected ? 'rgba(217,164,65,0.6)' : `${accent}2e`}`,
                boxShadow: isSelected ? '0 0 0 1px rgba(217,164,65,0.4), 0 16px 44px rgba(0,0,0,0.5), 0 0 34px rgba(217,164,65,0.12)' : '0 12px 36px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.04)',
              }}
            >
              {/* left accent */}
              <div className="absolute left-0 top-0 bottom-0 w-[3.5px]" style={{ background: `linear-gradient(180deg, ${accent}, transparent)`, boxShadow: `0 0 14px ${accent}` }} />
              {/* hover glow */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" style={{ background: `radial-gradient(ellipse 55% 80% at 18% 50%, ${accent}12 0%, transparent 70%)` }} />

              <div className="relative flex items-start gap-3.5 md:gap-4 p-4 md:p-5 flex-wrap">
                {selectable && (
                  <motion.button
                    onClick={() => onSelect(item.id)}
                    whileHover={{ scale: 1.15 }}
                    whileTap={{ scale: 0.85 }}
                    className="mt-3 shrink-0 transition-colors"
                    aria-label="Select"
                    style={{ color: isSelected ? '#E8B45C' : 'rgba(255,255,255,0.25)', filter: isSelected ? 'drop-shadow(0 0 8px rgba(217,164,65,0.7))' : 'none' }}
                  >
                    {isSelected ? <CheckSquare className="w-[22px] h-[22px]" /> : <Square className="w-[22px] h-[22px]" />}
                  </motion.button>
                )}

                <button
                  onClick={() => onOpen(item)}
                  className="relative shrink-0 w-[118px] aspect-video rounded-2xl overflow-hidden bg-black/60 transition-all duration-400 hover:scale-[1.04] hover:shadow-[0_0_24px_rgba(217,164,65,0.25)] group/thumb"
                  style={{ border: '1px solid rgba(217,164,65,0.22)' }}
                >
                  <div className="absolute inset-0 transition-transform duration-500 group-hover/thumb:scale-110">
                    <MediaThumb item={item} />
                  </div>
                  <div className="absolute inset-0 opacity-0 group-hover/thumb:opacity-100 transition-opacity duration-300 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(1px)' }}>
                    <span className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: 'rgba(13,9,6,0.8)', border: '1px solid rgba(217,164,65,0.5)' }}>
                      <Eye className="w-4 h-4 text-[#E8B45C]" />
                    </span>
                  </div>
                  {(item.mediaType === 'video' || item.mediaType === 'link') && (
                    <div className="absolute bottom-1.5 right-1.5 flex items-center justify-center">
                      <div className="w-7 h-7 rounded-full bg-black/65 backdrop-blur-sm border border-[#D9A441]/50 flex items-center justify-center">
                        {item.mediaType === 'link' ? (
                          <ExternalLink className="w-3 h-3 text-[#E8B45C]" />
                        ) : (
                          <Play className="w-3 h-3 text-[#E8B45C] fill-[#E8B45C] ml-0.5" />
                        )}
                      </div>
                    </div>
                  )}
                </button>

                <div className="min-w-0 flex-1 basis-[220px]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[15px] font-black tracking-tight" style={{ fontFamily: 'Cairo, sans-serif', color: GOLD }}>
                      @{item.name}
                    </span>
                    <span className="px-2.5 h-6 rounded-full text-[10px] font-black uppercase tracking-[0.12em] inline-flex items-center gap-1.5" style={{ background: chip.bg, color: chip.c, border: `1px solid ${chip.c}44` }}>
                      <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: chip.dot, boxShadow: `0 0 8px ${chip.dot}` }} />
                      {chip.label}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium tabular-nums" style={{ color: 'rgba(247,243,238,0.38)' }}>
                      <Clock className="inline w-3 h-3" />
                      {timeAgo(item.createdAt)}
                    </span>
                    {locked && (
                      <motion.span initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="px-2.5 h-6 rounded-full text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1" style={{ background: 'rgba(255,140,60,0.12)', color: '#FF9A3C', border: '1px solid rgba(255,140,60,0.4)' }}>
                        <Lock className="w-3 h-3" /> {item.reviewingBy}
                      </motion.span>
                    )}
                  </div>
                  <p className="mt-1.5 text-[13.5px] leading-relaxed line-clamp-2 font-medium" style={{ color: 'rgba(247,243,238,0.72)' }}>
                    {item.caption || 'No caption'}
                  </p>

                  {(badge?.dupOf || badge?.frequentSubmitter || (tab === 'flagged' && (item.flagCount ?? 0) > 0) || item.rejectReason) && (
                    <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                      {badge?.dupOf && (
                        <span className="px-2.5 h-6 rounded-full text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1" style={{ background: 'rgba(138,107,60,0.14)', color: '#E2C48F', border: '1px solid rgba(217,182,122,0.35)' }}>
                          <Copy className="w-3 h-3" /> Duplicate{badge.dupOfName ? ` · @${badge.dupOfName}` : ''}
                        </span>
                      )}
                      {badge?.frequentSubmitter && (
                        <span className="px-2.5 h-6 rounded-full text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1" style={{ background: 'rgba(255,122,24,0.12)', color: '#FF9A3C', border: '1px solid rgba(255,122,24,0.35)' }}>
                          <Zap className="w-3 h-3" /> Frequent
                        </span>
                      )}
                      {(item.flagCount ?? 0) > 0 && (
                        <motion.span animate={{ scale: [1, 1.06, 1] }} transition={{ duration: 2, repeat: Infinity }} className="px-2.5 h-6 rounded-full text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1" style={{ background: 'rgba(255,80,80,0.12)', color: '#FF8A8A', border: '1px solid rgba(255,80,80,0.35)' }}>
                          <Flag className="w-3 h-3" /> ×{item.flagCount} {item.flagReasons?.[0]}
                        </motion.span>
                      )}
                      {item.rejectReason && tab === 'rejected' && (
                        <span className="px-2.5 h-6 rounded-full text-[10px] font-bold" style={{ background: 'rgba(255,80,80,0.07)', color: 'rgba(255,138,138,0.9)', border: '1px solid rgba(255,80,80,0.22)' }}>
                          {defaultReasonLabel(item.rejectReason)}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="mt-2 flex items-center gap-2 flex-wrap text-[11px] font-medium" style={{ color: 'rgba(247,243,238,0.35)' }}>
                    <span className="uppercase tracking-[0.16em] font-black px-2 py-0.5 rounded-md" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                      {item.mediaType}{item.kind === 'link' ? ' · link' : ''}
                    </span>
                    {item.likes > 0 && (
                      <span className="font-black tabular-nums" style={{ color: 'rgba(127,224,139,0.85)' }}>{item.likes} ♥</span>
                    )}
                    {item.url && (
                      <span className="truncate max-w-[220px] font-mono text-[10.5px]" dir="ltr" style={{ color: 'rgba(138,180,255,0.6)' }}>{item.url}</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto sm:ml-auto">
                  <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.94 }} onClick={() => onOpen(item)} className="flex-1 sm:flex-none items-center justify-center inline-flex gap-2 h-10 px-4 rounded-2xl text-[12px] font-bold transition-all duration-300 hover:border-[#D9A441]/60 hover:shadow-[0_0_18px_rgba(217,164,65,0.2)]" style={{ border: '1px solid rgba(217,164,65,0.28)', color: 'rgba(247,243,238,0.8)', background: 'rgba(217,164,65,0.05)' }}>
                    <Eye className="w-3.5 h-3.5 text-[#E8B45C]" /> Review
                  </motion.button>
                  {tab === 'flagged' && (
                    <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.94 }} onClick={() => onClearFlags(item.id)} disabled={busy} className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 h-10 px-4 rounded-2xl text-[12px] font-bold transition-all hover:shadow-[0_0_18px_rgba(138,180,255,0.25)] disabled:opacity-50" style={{ border: '1px solid rgba(138,180,255,0.4)', color: '#9ABBFF', background: 'rgba(138,180,255,0.06)' }}>
                      Clear flags
                    </motion.button>
                  )}
                  {tab === 'queue' && (
                    <>
                      <motion.button whileHover={{ scale: 1.06, y: -1 }} whileTap={{ scale: 0.93 }} onClick={() => onApprove(item.id)} disabled={busy} className="premium-btn flex-1 sm:flex-none inline-flex items-center justify-center gap-2 h-10 px-4 rounded-2xl text-[12px] font-black disabled:opacity-50 overflow-hidden" style={{ color: '#0d0906', background: 'linear-gradient(135deg, #F4C876, #D9A441)', boxShadow: '0 0 18px rgba(217,164,65,0.35), inset 0 1px 0 rgba(255,255,255,0.4)', fontFamily: 'Cairo, sans-serif' }}>
                        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ThumbsUp className="w-3.5 h-3.5" />}
                        Approve
                      </motion.button>
                      <motion.button whileHover={{ scale: 1.06, y: -1 }} whileTap={{ scale: 0.93 }} onClick={() => onReject(item.id)} disabled={busy} className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 h-10 px-4 rounded-2xl text-[12px] font-bold disabled:opacity-50 hover:shadow-[0_0_18px_rgba(255,80,80,0.3)] transition-shadow" style={{ border: '1px solid rgba(255,122,122,0.4)', color: '#FF8A8A', background: 'rgba(255,80,80,0.08)' }}>
                        <ThumbsDown className="w-3.5 h-3.5" /> Reject
                      </motion.button>
                    </>
                  )}
                  {tab === 'approved' && (
                    <motion.button whileHover={{ scale: 1.06, y: -1 }} whileTap={{ scale: 0.93 }} onClick={() => onUnpublish(item.id)} disabled={busy} className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 h-10 px-4 rounded-2xl text-[12px] font-bold disabled:opacity-50 hover:shadow-[0_0_18px_rgba(255,80,80,0.3)] transition-shadow" style={{ border: '1px solid rgba(255,122,122,0.4)', color: '#FF8A8A', background: 'rgba(255,80,80,0.08)' }}>
                      <Trash2 className="w-3.5 h-3.5" /> Take Down
                    </motion.button>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// confirm dialog
// ---------------------------------------------------------------------------

interface ConfirmProps {
  confirm: NonNullable<ConfirmState>;
  reason: string;
  setReason: (v: string) => void;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

const CONFIRM_REASONS = [
  'Inappropriate / Offensive',
  'Spam or Duplicate',
  'Low Quality',
  'Unrelated to Milestone',
  'Copyright Concern',
  'Other',
];

function ConfirmDialog({ confirm, reason, setReason, busy, onCancel, onConfirm }: ConfirmProps) {
  const needsReason = confirm.kind === 'reject' || confirm.kind === 'unpublish';
  const isBulk = confirm.ids.length > 1;
  const [freeText, setFreeText] = useState('');
  const isApprove = confirm.kind === 'approve';
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(4,3,2,0.78)', backdropFilter: 'blur(10px)' }}
      onClick={onCancel}
    >
      <motion.div
        initial={{ opacity: 0, y: 36, scale: 0.93 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 340, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-[28px] p-6 md:p-7 relative overflow-hidden"
        style={{
          background: 'linear-gradient(165deg, rgba(32,22,14,0.99), rgba(15,10,7,0.98))',
          border: `1.5px solid ${isApprove ? 'rgba(217,164,65,0.45)' : 'rgba(255,107,107,0.4)'}`,
          boxShadow: isApprove ? '0 30px 80px rgba(0,0,0,0.65), 0 0 60px rgba(217,164,65,0.15)' : '0 30px 80px rgba(0,0,0,0.65), 0 0 60px rgba(255,80,80,0.14)',
        }}
      >
        <div className="absolute top-0 left-[12%] right-[12%] h-px" style={{ background: isApprove ? 'linear-gradient(90deg, transparent, rgba(232,180,92,0.8), transparent)' : 'linear-gradient(90deg, transparent, rgba(255,107,107,0.8), transparent)' }} />
        <div className="w-14 h-14 rounded-[18px] flex items-center justify-center mb-4" style={{ background: isApprove ? 'linear-gradient(135deg, rgba(232,180,92,0.25), rgba(0,0,0,0.3))' : 'linear-gradient(135deg, rgba(255,107,107,0.22), rgba(0,0,0,0.3))', border: isApprove ? '1.5px solid rgba(217,164,65,0.5)' : '1.5px solid rgba(255,107,107,0.5)', boxShadow: isApprove ? '0 0 24px rgba(217,164,65,0.3)' : '0 0 24px rgba(255,107,107,0.3)' }}>
          {isApprove ? <ThumbsUp className="w-6 h-6 text-[#E8B45C]" /> : <AlertTriangle className="w-6 h-6 text-[#FF8A8A]" />}
        </div>
        <h3 className="text-[19px] font-black tracking-tight" style={{ fontFamily: 'Cairo, sans-serif', color: '#F7F3EE' }}>
          {confirm.kind === 'approve'
            ? `Approve ${isBulk ? `${confirm.ids.length} edits` : 'this edit'}?`
            : confirm.kind === 'reject'
              ? `Reject ${isBulk ? `${confirm.ids.length} edits` : 'this edit'}?`
              : `Take down ${isBulk ? `${confirm.ids.length} edits` : 'this edit'}?`}
        </h3>
        <p className="mt-1.5 text-[12.5px] leading-relaxed font-medium" style={{ color: 'rgba(247,243,238,0.5)' }}>
          {confirm.kind === 'approve'
            ? isBulk
              ? 'These edits will go live on the wall immediately. This is reversible via Undo.'
              : 'This edit will go live on the wall immediately. Reversible via Undo.'
            : confirm.kind === 'reject'
              ? isBulk
                ? 'These edits will be hidden from the public wall. Reversible for 10 seconds via Undo.'
                : 'This edit will be hidden from the public wall. Reversible for 10 seconds via Undo.'
              : 'This edit will be immediately hidden from the public wall. Reversible for 10 seconds via Undo.'}
        </p>

        {needsReason && (
          <div className="mt-5">
            <label className="flex items-center gap-2 text-[10.5px] font-black uppercase tracking-[0.22em] mb-2.5" style={{ color: 'rgba(255,138,138,0.9)' }}>
              <Flag className="w-3.5 h-3.5" /> Reason (required)
            </label>
            <div className="flex flex-wrap gap-2">
              {CONFIRM_REASONS.map((r) => {
                const active = reason === r;
                return (
                  <motion.button
                    key={r}
                    onClick={() => setReason(r)}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.93 }}
                    className="px-3.5 h-9 rounded-full text-[11.5px] font-bold transition-all duration-300"
                    style={{
                      fontFamily: 'Cairo, sans-serif',
                      color: active ? '#0d0906' : 'rgba(247,243,238,0.62)',
                      background: active ? 'linear-gradient(135deg, #ffb199, #ff6b6b)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${active ? 'transparent' : 'rgba(255,255,255,0.1)'}`,
                      boxShadow: active ? '0 0 16px rgba(255,107,107,0.35)' : 'none',
                    }}
                  >
                    {r}
                  </motion.button>
                );
              })}
            </div>
            {reason === 'Other' && (
              <motion.input
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                value={freeText}
                onChange={(e) => { setFreeText(e.target.value); setReason(e.target.value || 'Other'); }}
                placeholder="Describe the reason…"
                className="mt-3 w-full h-11 px-4 rounded-2xl text-[13px] outline-none bg-transparent font-medium"
                style={{ border: '1px solid rgba(255,122,122,0.3)', color: '#F7F3EE', background: 'rgba(0,0,0,0.35)' }}
              />
            )}
          </div>
        )}

        <div className="mt-6 flex items-center gap-2.5">
          <button onClick={onCancel} disabled={busy} className="flex-1 h-12 rounded-2xl text-[13px] font-bold hover:bg-white/[0.06] transition-colors disabled:opacity-50" style={{ border: '1px solid rgba(255,255,255,0.14)', color: 'rgba(247,243,238,0.7)' }}>
            Cancel
          </button>
          <motion.button
            onClick={onConfirm}
            disabled={busy || (needsReason && !reason)}
            whileHover={!busy && !(needsReason && !reason) ? { scale: 1.03, y: -1 } : {}}
            whileTap={{ scale: 0.96 }}
            className="premium-btn flex-1 h-12 rounded-2xl text-[13px] font-black disabled:opacity-40 overflow-hidden"
            style={{
              fontFamily: 'Cairo, sans-serif',
              color: '#0d0906',
              background: confirm.kind === 'approve' ? 'linear-gradient(135deg, #F4C876, #D9A441)' : 'linear-gradient(135deg, #ff8080, #c0392b)',
              boxShadow: confirm.kind === 'approve' ? '0 0 22px rgba(217,164,65,0.4)' : '0 0 22px rgba(255,80,80,0.35)',
            }}
          >
            {busy ? <Loader2 className="mx-auto w-4 h-4 animate-spin" /> : confirm.kind === 'approve' ? 'Approve now' : confirm.kind === 'reject' ? 'Reject now' : 'Take Down'}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

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
  const map: Record<string, { label: string; c: string; bg: string }> = {
    pending: { label: 'Pending', c: '#E8B45C', bg: 'rgba(217,164,65,0.1)' },
    approved: { label: 'Approved', c: '#7FE08B', bg: 'rgba(80,200,120,0.12)' },
    rejected: { label: 'Rejected', c: '#FF7A7A', bg: 'rgba(255,80,80,0.12)' },
  };
  return map[status ?? ''] ?? { label: status ?? '', c: '#ccc', bg: 'rgba(255,255,255,0.05)' };
}

function MediaThumb({ item }: { item: WallItem }) {
  if (item.posterUrl) {
    return <img src={item.posterUrl} alt="" className="w-full h-full object-cover" />;
  }
  if (item.mediaType === 'link') {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <Link2 className="w-5 h-5 text-[#D9A441]/60" />
      </div>
    );
  }
  return (
    <div className="w-full h-full flex items-center justify-center">
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

  const modalIndex = modalId ? filtered.findIndex((i) => i.id === modalId) : -1;

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
        const results = await adminBulk(kind === 'reject' ? 'reject' : 'approve', ids, reason);
        const failed = results.filter((r) => r.state === 'failed').length;
        if (failed > 0) notify(`${failed} item${failed > 1 ? 's' : ''} failed to ${kind}.`, true);
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
    const next = filtered[modalIndex + 1];
    if (!next) {
      await closeItem(filtered[modalIndex].id);
      return;
    }
    await adminEndReview(filtered[modalIndex].id).catch(() => {});
    setModalId(next.id);
    await adminBeginReview(next.id).catch(() => {});
  };

  const goPrev = async () => {
    if (modalIndex <= 0) return;
    const prev = filtered[modalIndex - 1];
    await adminEndReview(filtered[modalIndex].id).catch(() => {});
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

  const tabBtn = (value: AdminTab, label: string, count: number, color: string) => {
    const active = tab === value;
    return (
      <button
        onClick={() => {
          setTab(value);
          setSelected(new Set());
        }}
        className="relative px-3.5 md:px-5 h-10 rounded-full text-[12px] font-bold tracking-wide transition-all duration-300 flex items-center gap-2"
        style={{
          fontFamily: 'Cairo, sans-serif',
          color: active ? '#0d0906' : 'rgba(247,243,238,0.65)',
          background: active ? 'linear-gradient(135deg, #E8B45C, #D9A441)' : 'rgba(217,164,65,0.06)',
          border: active ? '1px solid transparent' : `1px solid ${color}33`,
          boxShadow: active ? '0 0 18px rgba(217,164,65,0.3)' : 'none',
        }}
      >
        {label}
        <span
          className="px-2 h-5 min-w-[20px] rounded-full inline-flex items-center justify-center text-[10.5px] font-black"
          style={{
            background: active ? 'rgba(0,0,0,0.22)' : 'rgba(0,0,0,0.4)',
            color: active ? '#0d0906' : color,
          }}
        >
          {count}
        </span>
      </button>
    );
  };

  const filterChip = <T extends string>(
    value: T,
    current: T,
    label: string,
    onChange: (v: T) => void,
  ) => {
    const active = value === current;
    return (
      <button
        onClick={() => onChange(value)}
        className="px-3 h-8 rounded-full text-[11px] font-bold tracking-wide transition-all duration-300"
        style={{
          fontFamily: 'Cairo, sans-serif',
          color: active ? '#0d0906' : 'rgba(247,243,238,0.55)',
          background: active ? 'linear-gradient(135deg, #E8B45C, #D9A441)' : 'rgba(255,255,255,0.04)',
          border: `1px solid ${active ? 'transparent' : 'rgba(255,255,255,0.08)'}`,
        }}
      >
        {label}
      </button>
    );
  };

  const itemById = (id: string) => items.find((i) => i.id === id);

  return (
    <div className="w-full max-w-5xl">
      {/* header */}
      <div className="flex items-center justify-between gap-4 mb-8 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(217,164,65,0.08)', border: '1px solid rgba(217,164,65,0.25)' }}
          >
            <ShieldCheck className="w-6 h-6 text-[#D9A441]" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black tracking-tight" style={{ fontFamily: 'Cairo, sans-serif', color: '#F7F3EE' }}>
              Moderation Console
            </h1>
            <p className="text-[12px]" style={{ color: 'rgba(247,243,238,0.4)' }}>
              Every submission is reviewed by hand. {who ? `Signed in as ${who}.` : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 hover:rotate-180"
            style={{ border: '1px solid rgba(217,164,65,0.25)', background: 'rgba(217,164,65,0.06)' }}
            aria-label="Refresh"
          >
            <RefreshCw className={`w-4 h-4 text-[#D9A441] ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => { clearAdminToken(); window.location.reload(); }}
            className="flex items-center gap-2 h-10 px-4 rounded-full text-[12px] font-bold transition-all duration-300 hover:bg-white/5"
            style={{ border: '1px solid rgba(217,164,65,0.25)', color: 'rgba(247,243,238,0.7)' }}
          >
            <LogOut className="w-3.5 h-3.5" /> Lock
          </button>
        </div>
      </div>

      {/* stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {(
          [
            ['pending', counts.pending, 'rgba(217,164,65,0.12)', '#E8B45C'],
            ['approved', counts.approved, 'rgba(80,200,120,0.1)', '#7FE08B'],
            ['rejected', counts.rejected, 'rgba(255,80,80,0.1)', '#FF7A7A'],
            ['flagged', flagged.length, 'rgba(255,140,60,0.1)', '#FF9A3C'],
          ] as const
        ).map(([key, value, bg, c]) => (
          <div
            key={key}
            className="relative rounded-[20px] p-5 overflow-hidden"
            style={{ background: 'rgba(9,8,7,0.6)', border: `1px solid ${bg}`, boxShadow: '0 10px 30px rgba(0,0,0,0.35)' }}
          >
            <div className="absolute -top-10 -right-6 w-28 h-28 rounded-full opacity-40 pointer-events-none"
              style={{ background: `radial-gradient(circle, ${bg} 0%, transparent 70%)`, filter: 'blur(10px)' }}
            />
            <p className="text-[10px] font-black uppercase tracking-[0.25em]" style={{ color: c }}>
              {key}
            </p>
            <p className="mt-1 text-3xl font-black" style={{ fontFamily: 'Cairo, sans-serif', color: '#F7F3EE' }}>
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* errors + notice */}
      <AnimatePresence>
        {(error || notice) && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mb-5 rounded-2xl px-5 py-3.5 text-[13px] font-medium"
            style={{
              background: notice ? 'rgba(80,200,120,0.08)' : 'rgba(255,80,80,0.08)',
              border: `1px solid ${notice ? 'rgba(80,200,120,0.25)' : 'rgba(255,80,80,0.25)'}`,
              color: notice ? '#7FE08B' : '#FF8A8A',
            }}
          >
            {notice || error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* tabs */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        {tabBtn('queue', 'Queue', counts.pending, '#E8B45C')}
        {tabBtn('approved', 'Approved', counts.approved, '#7FE08B')}
        {tabBtn('flagged', 'Flagged', flagged.length, '#FF9A3C')}
        {tabBtn('rejected', 'Rejected', counts.rejected, '#FF7A7A')}
        {tabBtn('audit', 'Audit Log', actions.length, '#8AB4FF')}
        {tabBtn('dashboard', 'Dashboard', 0, '#D9A441')}
      </div>

      {/* toolbar for list tabs */}
      {(tab === 'queue' || tab === 'approved' || tab === 'rejected') && (
        <div className="mb-6 flex items-center gap-3 flex-wrap rounded-[20px] p-4"
          style={{ background: 'rgba(9,8,7,0.6)', border: '1px solid rgba(217,164,65,0.14)' }}
        >
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name or caption…"
            className="h-9 px-4 rounded-full text-[12.5px] outline-none flex-1 min-w-[160px] bg-transparent focus:ring-1 focus:ring-[#D9A441]/40"
            style={{ border: '1px solid rgba(217,164,65,0.18)', color: '#F7F3EE', fontFamily: 'Tajawal, sans-serif' }}
          />
          <div className="flex items-center gap-2 flex-wrap">
            {filterChip<'all' | 'image' | 'video' | 'link'>('all', typeFilter, 'All types', setTypeFilter)}
            {filterChip('image', typeFilter, 'Images', setTypeFilter)}
            {filterChip('video', typeFilter, 'Videos', setTypeFilter)}
            {filterChip('link', typeFilter, 'Links', setTypeFilter)}
          </div>
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value as typeof dateFilter)}
            className="h-9 px-3 rounded-full text-[12px] outline-none bg-transparent cursor-pointer"
            style={{ border: '1px solid rgba(217,164,65,0.18)', color: 'rgba(247,243,238,0.7)', fontFamily: 'Cairo, sans-serif' }}
          >
            <option value="all" style={{ color: '#000' }}>Any time</option>
            <option value="hour" style={{ color: '#000' }}>Last hour</option>
            <option value="day" style={{ color: '#000' }}>Last 24h</option>
            <option value="week" style={{ color: '#000' }}>Last 7 days</option>
          </select>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
            className="h-9 px-3 rounded-full text-[12px] outline-none bg-transparent cursor-pointer"
            style={{ border: '1px solid rgba(217,164,65,0.18)', color: 'rgba(247,243,238,0.7)', fontFamily: 'Cairo, sans-serif' }}
          >
            <option value="newest" style={{ color: '#000' }}>Newest first</option>
            <option value="oldest" style={{ color: '#000' }}>Oldest first</option>
            {tab === 'approved' && <option value="likes" style={{ color: '#000' }}>Most liked</option>}
          </select>
        </div>
      )}

      {/* bulk bar */}
      {selected.size > 0 && (tab === 'queue' || tab === 'flagged' || tab === 'approved') && (
        <div className="mb-5 flex items-center gap-3 flex-wrap rounded-[20px] px-5 py-3.5"
          style={{ background: 'rgba(217,164,65,0.07)', border: '1.5px solid rgba(217,164,65,0.35)' }}
        >
          <CheckSquare className="w-4 h-4 text-[#D9A441]" />
          <span className="text-[13px] font-bold" style={{ color: '#F7F3EE' }}>{selected.size} selected</span>
          {(tab === 'queue' || tab === 'flagged') && (
            <button
              onClick={() => setConfirm({ kind: 'approve', ids: [...selected] })}
              disabled={busy}
              className="inline-flex items-center gap-2 h-9 px-4 rounded-full text-[12px] font-black transition-all duration-300 hover:scale-105 disabled:opacity-50"
              style={{ color: '#0d0906', background: 'linear-gradient(135deg, #E8B45C, #D9A441)', boxShadow: '0 0 14px rgba(217,164,65,0.3)', fontFamily: 'Cairo, sans-serif' }}
            >
              <ThumbsUp className="w-3.5 h-3.5" /> Approve
            </button>
          )}
          {(tab === 'queue' || tab === 'approved') && (
            <button
              onClick={() => setConfirm({ kind: 'reject', ids: [...selected] })}
              disabled={busy}
              className="inline-flex items-center gap-2 h-9 px-4 rounded-full text-[12px] font-bold transition-all duration-300 hover:scale-105 disabled:opacity-50"
              style={{ border: '1px solid rgba(255,122,122,0.4)', color: '#FF8A8A', background: 'rgba(255,80,80,0.08)' }}
            >
              <Trash2 className="w-3.5 h-3.5" /> Reject
            </button>
          )}
          <button
            onClick={() => setSelected(new Set())}
            className="ml-auto text-[12px] font-bold hover:opacity-70"
            style={{ color: 'rgba(247,243,238,0.6)' }}
          >
            Clear
          </button>
        </div>
      )}

      {/* body */}
      {tab === 'dashboard' ? (
        <AdminDashboard items={items} actions={actions} who={who} itemNames={allNames} />
      ) : tab === 'audit' ? (
        <AdminAuditLog actions={actions} itemNames={allNames} />
      ) : loading ? (
        <div className="rounded-[24px] py-20 flex items-center justify-center" style={{ background: 'rgba(9,8,7,0.6)', border: '1px solid rgba(217,164,65,0.1)' }}>
          <Loader2 className="w-7 h-7 text-[#D9A441] animate-spin" />
        </div>
      ) : (
        <ListView
          tab={tab}
          items={tab === 'flagged' ? flagged : filtered}
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
            item={filtered[modalIndex]}
            who={who}
            badge={badges.get(modalId)}
            position={{ index: modalIndex, total: filtered.length }}
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
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[90] flex items-center gap-3 px-5 py-3 rounded-full"
            style={{
              background: 'rgba(26,18,13,0.95)',
              border: '1px solid rgba(217,164,65,0.4)',
              boxShadow: '0 14px 40px rgba(0,0,0,0.6)',
            }}
          >
            <Undo2 className="w-4 h-4 text-[#D9A441]" />
            <span className="text-[13px] font-bold" style={{ color: '#F7F3EE', fontFamily: 'Cairo, sans-serif' }}>
              {undo.label}
            </span>
            <button
              onClick={doUndo}
              disabled={busy}
              className="px-4 h-8 rounded-full text-[12px] font-black transition-transform hover:scale-105 disabled:opacity-50"
              style={{ color: '#0d0906', background: 'linear-gradient(135deg, #E8B45C, #D9A441)', fontFamily: 'Cairo, sans-serif' }}
            >
              Undo
            </button>
            <button onClick={() => setUndo(null)} className="text-white/40 hover:text-white/80">
              <X className="w-4 h-4" />
            </button>
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
      <div className="rounded-[24px] py-20 text-center" style={{ background: 'rgba(9,8,7,0.6)', border: '1px solid rgba(217,164,65,0.1)' }}>
        <div className="mx-auto mb-4 w-14 h-14 rounded-full flex items-center justify-center" style={{ background: 'rgba(217,164,65,0.06)', border: '1px solid rgba(217,164,65,0.2)' }}>
          <EyeOff className="w-6 h-6 text-[#D9A441]/50" />
        </div>
        <p className="text-sm font-bold" style={{ color: 'rgba(247,243,238,0.5)' }}>
          {tab === 'flagged' ? 'No flagged submissions. ' : 'Nothing here yet. '}
          {tab === 'queue' ? 'The queue is clear.' : ''}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((item) => {
        const chip = statusChip(tab === 'flagged' ? 'approved' : item.status ?? '');
        const badge = badges.get(item.id);
        const locked = isReviewLocked(item, who);
        const isSelected = selected.has(item.id);
        return (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: easeOut }}
            className="rounded-[22px] overflow-hidden"
            style={{
              background: 'linear-gradient(160deg, rgba(26,18,13,0.96), rgba(16,11,8,0.93))',
              border: `1px solid ${tab === 'flagged' ? 'rgba(255,140,60,0.35)' : item.status === 'pending' ? 'rgba(217,164,65,0.3)' : item.status === 'rejected' ? 'rgba(255,80,80,0.22)' : 'rgba(255,255,255,0.08)'}`,
              boxShadow: '0 10px 34px rgba(0,0,0,0.4)',
            }}
          >
            <div className="flex items-start gap-4 p-4 md:p-5 flex-wrap">
              {selectable && (
                <button
                  onClick={() => onSelect(item.id)}
                  className="mt-2 shrink-0 text-white/40 hover:text-[#D9A441] transition-colors"
                  aria-label="Select"
                >
                  {isSelected ? <CheckSquare className="w-5 h-5 text-[#D9A441]" /> : <Square className="w-5 h-5" />}
                </button>
              )}

              <button
                onClick={() => onOpen(item)}
                className="relative shrink-0 w-28 aspect-video rounded-xl overflow-hidden bg-black/60 transition-transform duration-300 hover:scale-[1.03]"
                style={{ border: '1px solid rgba(217,164,65,0.18)' }}
              >
                <MediaThumb item={item} />
                {(item.mediaType === 'video' || item.mediaType === 'link') && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm border border-[#D9A441]/40 flex items-center justify-center">
                      {item.mediaType === 'link' ? (
                        <ExternalLink className="w-3.5 h-3.5 text-[#D9A441]" />
                      ) : (
                        <Play className="w-3.5 h-3.5 text-[#D9A441] fill-[#D9A441] ml-0.5" />
                      )}
                    </div>
                  </div>
                )}
              </button>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[15px] font-black" style={{ fontFamily: 'Cairo, sans-serif', color: GOLD }}>
                    @{item.name}
                  </span>
                  <span
                    className="px-2.5 h-6 rounded-full text-[10px] font-black uppercase tracking-wider inline-flex items-center"
                    style={{ background: chip.bg, color: chip.c, border: `1px solid ${chip.c}33` }}
                  >
                    {chip.label}
                  </span>
                  <span className="text-[11px]" style={{ color: 'rgba(247,243,238,0.3)' }}>
                    <Clock className="inline w-3 h-3 mr-1" />
                    {timeAgo(item.createdAt)}
                  </span>
                  {locked && (
                    <span className="px-2.5 h-6 rounded-full text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1"
                      style={{ background: 'rgba(255,140,60,0.1)', color: '#FF9A3C', border: '1px solid rgba(255,140,60,0.35)' }}
                    >
                      <Lock className="w-3 h-3" /> Reviewing by {item.reviewingBy}
                    </span>
                  )}
                </div>
                <p className="mt-1.5 text-[13.5px] leading-relaxed line-clamp-2" style={{ color: 'rgba(247,243,238,0.75)' }}>
                  {item.caption || 'No caption'}
                </p>

                {(badge?.dupOf || badge?.frequentSubmitter || (tab === 'flagged' && (item.flagCount ?? 0) > 0) || item.rejectReason) && (
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    {badge?.dupOf && (
                      <span className="px-2.5 h-6 rounded-full text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1"
                        style={{ background: 'rgba(138,107,60,0.12)', color: '#D9B67A', border: '1px solid rgba(217,182,122,0.3)' }}
                      >
                        <Copy className="w-3 h-3" /> Possible duplicate{badge.dupOfName ? ` — @${badge.dupOfName}` : ''}
                      </span>
                    )}
                    {badge?.frequentSubmitter && (
                      <span className="px-2.5 h-6 rounded-full text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1"
                        style={{ background: 'rgba(255,122,24,0.1)', color: '#FF9A3C', border: '1px solid rgba(255,122,24,0.3)' }}
                      >
                        <Zap className="w-3 h-3" /> Frequent submitter
                      </span>
                    )}
                    {(item.flagCount ?? 0) > 0 && (
                      <span className="px-2.5 h-6 rounded-full text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1"
                        style={{ background: 'rgba(255,80,80,0.1)', color: '#FF8A8A', border: '1px solid rgba(255,80,80,0.3)' }}
                      >
                        <Flag className="w-3 h-3" /> Flagged ×{item.flagCount} {item.flagReasons?.[0]}
                      </span>
                    )}
                    {item.rejectReason && tab === 'rejected' && (
                      <span className="px-2.5 h-6 rounded-full text-[10px] font-black uppercase tracking-wider"
                        style={{ background: 'rgba(255,80,80,0.08)', color: 'rgba(255,138,138,0.85)', border: '1px solid rgba(255,80,80,0.2)' }}
                      >
                        {defaultReasonLabel(item.rejectReason)}
                      </span>
                    )}
                  </div>
                )}

                <div className="mt-2 flex items-center gap-2 flex-wrap text-[11px]" style={{ color: 'rgba(247,243,238,0.35)' }}>
                  <span className="uppercase tracking-[0.15em] font-bold">
                    {item.mediaType} {item.kind === 'link' ? '• link' : ''}
                  </span>
                  {item.likes > 0 && (
                    <>
                      <span className="w-1 h-1 rounded-full bg-white/20" />
                      <span className="font-bold" style={{ color: 'rgba(127,224,139,0.8)' }}>{item.likes} ♥</span>
                    </>
                  )}
                  {item.url && (
                    <>
                      <span className="w-1 h-1 rounded-full bg-white/20" />
                      <span className="truncate max-w-[220px]" dir="ltr">{item.url}</span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                <button
                  onClick={() => onOpen(item)}
                  className="flex-1 sm:flex-none items-center justify-center inline-flex gap-2 h-10 px-4 rounded-full text-[12px] font-bold transition-all duration-300 hover:bg-white/5"
                  style={{ border: '1px solid rgba(217,164,65,0.25)', color: 'rgba(247,243,238,0.75)' }}
                >
                  <EyeOff className="w-3.5 h-3.5" /> Review
                </button>
                {tab === 'flagged' && (
                  <button
                    onClick={() => onClearFlags(item.id)}
                    disabled={busy}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 h-10 px-4 rounded-full text-[12px] font-bold transition-all hover:bg-white/5 disabled:opacity-50"
                    style={{ border: '1px solid rgba(138,180,255,0.35)', color: '#9ABBFF' }}
                  >
                    Clear flags
                  </button>
                )}
                {tab === 'queue' && (
                  <>
                    <button
                      onClick={() => onApprove(item.id)}
                      disabled={busy}
                      className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 h-10 px-4 rounded-full text-[12px] font-black transition-all duration-300 hover:scale-105 disabled:opacity-50"
                      style={{ color: '#0d0906', background: 'linear-gradient(135deg, #E8B45C, #D9A441)', boxShadow: '0 0 18px rgba(217,164,65,0.35)', fontFamily: 'Cairo, sans-serif' }}
                    >
                      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ThumbsUp className="w-3.5 h-3.5" />}
                      Approve
                    </button>
                    <button
                      onClick={() => onReject(item.id)}
                      disabled={busy}
                      className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 h-10 px-4 rounded-full text-[12px] font-bold transition-all duration-300 hover:scale-105 disabled:opacity-50"
                      style={{ border: '1px solid rgba(255,122,122,0.35)', color: '#FF8A8A', background: 'rgba(255,80,80,0.08)' }}
                    >
                      <ThumbsDown className="w-3.5 h-3.5" /> Reject
                    </button>
                  </>
                )}
                {tab === 'approved' && (
                  <button
                    onClick={() => onUnpublish(item.id)}
                    disabled={busy}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 h-10 px-4 rounded-full text-[12px] font-bold transition-all duration-300 hover:scale-105 disabled:opacity-50"
                    style={{ border: '1px solid rgba(255,122,122,0.35)', color: '#FF8A8A', background: 'rgba(255,80,80,0.08)' }}
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Take Down
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        );
      })}
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
  const needsReason = confirm.kind !== 'approve';
  const isBulk = confirm.ids.length > 1;
  const [freeText, setFreeText] = useState('');
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(5,4,3,0.8)', backdropFilter: 'blur(6px)' }}
      onClick={onCancel}
    >
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ duration: 0.3, ease: easeOut }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-[26px] p-6"
        style={{
          background: 'linear-gradient(160deg, rgba(26,18,13,0.98), rgba(16,11,8,0.96))',
          border: '1.5px solid rgba(217,164,65,0.35)',
          boxShadow: '0 24px 70px rgba(0,0,0,0.6)',
        }}
      >
        <h3 className="text-lg font-black" style={{ fontFamily: 'Cairo, sans-serif', color: '#F7F3EE' }}>
          {confirm.kind === 'approve'
            ? `Approve ${isBulk ? `${confirm.ids.length} edits` : 'this edit'}?`
            : confirm.kind === 'reject'
              ? `Reject ${isBulk ? `${confirm.ids.length} edits` : 'this edit'}?`
              : `Take down this edit?`}
        </h3>
        <p className="mt-1 text-[12.5px]" style={{ color: 'rgba(247,243,238,0.5)' }}>
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
            <label className="block text-[11px] font-bold uppercase tracking-[0.2em] mb-2" style={{ color: 'rgba(217,164,65,0.7)' }}>
              Reason (required)
            </label>
            <div className="flex flex-wrap gap-2">
              {CONFIRM_REASONS.map((r) => {
                const active = reason === r;
                const isOther = r === 'Other';
                return (
                  <button
                    key={r}
                    onClick={() => setReason(r)}
                    className="px-3 h-8 rounded-full text-[11px] font-bold transition-all duration-300"
                    style={{
                      fontFamily: 'Cairo, sans-serif',
                      color: active ? '#0d0906' : 'rgba(247,243,238,0.6)',
                      background: active ? 'linear-gradient(135deg, #E8B45C, #D9A441)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${active ? 'transparent' : 'rgba(255,255,255,0.1)'}`,
                      opacity: isOther ? 0.7 : 1,
                    }}
                  >
                    {r}
                  </button>
                );
              })}
            </div>
            {reason === 'Other' && (
              <input
                value={freeText}
                onChange={(e) => { setFreeText(e.target.value); setReason(e.target.value || 'Other'); }}
                placeholder="Describe the reason…"
                className="mt-3 w-full h-10 px-4 rounded-xl text-[13px] outline-none bg-transparent focus:ring-1 focus:ring-[#D9A441]/40"
                style={{ border: '1px solid rgba(217,164,65,0.2)', color: '#F7F3EE' }}
              />
            )}
          </div>
        )}

        <div className="mt-6 flex items-center gap-2">
          <button
            onClick={onCancel}
            disabled={busy}
            className="flex-1 h-11 rounded-full text-[13px] font-bold hover:bg-white/5 disabled:opacity-50"
            style={{ border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(247,243,238,0.7)' }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy || (needsReason && !reason)}
            className="flex-1 h-11 rounded-full text-[13px] font-black disabled:opacity-40 transition-transform hover:scale-[1.02]"
            style={{
              fontFamily: 'Cairo, sans-serif',
              color: '#0d0906',
              background: confirm.kind === 'approve'
                ? 'linear-gradient(135deg, #E8B45C, #D9A441)'
                : 'linear-gradient(135deg, #ff6b6b, #c0392b)',
              boxShadow: confirm.kind === 'approve' ? '0 0 18px rgba(217,164,65,0.3)' : '0 0 18px rgba(255,80,80,0.25)',
            }}
          >
            {busy ? <Loader2 className="mx-auto w-4 h-4 animate-spin" /> : confirm.kind === 'approve' ? 'Approve' : confirm.kind === 'reject' ? 'Reject' : 'Take Down'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
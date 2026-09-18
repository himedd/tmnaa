import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Lock,
  LogOut,
  ShieldCheck,
  ThumbsUp,
  ThumbsDown,
  RefreshCw,
  Loader2,
  Link2,
  Play,
  ExternalLink,
  X,
  EyeOff,
  Clock,
} from 'lucide-react';
import {
  adminApprove,
  adminList,
  adminLogin,
  adminReject,
  adminStatus,
  clearAdminToken,
  getAdminToken,
  hostOf,
  setAdminToken,
  tiktokEmbedUrl,
  timeAgo,
  type AdminStatus,
  type WallItem,
  type WallStatus,
} from '@/lib/wallApi';

const easeOut = [0.22, 1, 0.36, 1] as const;

const GOLD = '#D9A441';

function statusChip(status: string | undefined) {
  const map: Record<string, { label: string; c: string; bg: string }> = {
    pending: { label: 'Pending', c: '#E8B45C', bg: 'rgba(217,164,65,0.1)' },
    approved: { label: 'Approved', c: '#7FE08B', bg: 'rgba(80,200,120,0.12)' },
    rejected: { label: 'Rejected', c: '#FF7A7A', bg: 'rgba(255,80,80,0.12)' },
  };
  return map[status ?? ''] ?? { label: status ?? '', c: '#ccc', bg: 'rgba(255,255,255,0.05)' };
}

function PreviewCard({ item }: { item: WallItem }) {
  const [failedVideo, setFailedVideo] = useState(false);
  if (item.mediaType === 'video' && item.mediaUrl && !failedVideo) {
    return (
      <video
        src={item.mediaUrl}
        controls
        preload="metadata"
        playsInline
        onError={() => setFailedVideo(true)}
        className="w-full aspect-video bg-black object-contain rounded-xl"
      />
    );
  }
  if (item.posterUrl) {
    return <img src={item.posterUrl} alt={item.caption || item.name} className="w-full aspect-video object-cover rounded-xl" />;
  }
  if (item.mediaType === 'link' && item.url) {
    const embed = tiktokEmbedUrl(item.url);
    if (embed) {
      return (
        <div className="w-full aspect-video overflow-hidden rounded-xl bg-black">
          <iframe src={embed} title={`${item.caption || item.name} preview`} className="w-full h-full" allow="encrypted-media; fullscreen; picture-in-picture" allowFullScreen />
        </div>
      );
    }
  }
  return (
    <div className="w-full aspect-video rounded-xl flex flex-col items-center justify-center gap-2"
      style={{ background: 'linear-gradient(135deg, rgba(45,27,20,0.9), rgba(14,10,8,0.95))', border: '1px solid rgba(217,164,65,0.15)' }}
    >
      <Link2 className="w-6 h-6 text-[#D9A441]/60" />
      <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'rgba(217,164,65,0.6)' }}>
        {hostOf(item.url)}
      </span>
    </div>
  );
}

function LoginView({ onAuthed }: { onAuthed: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!password) return;
    setBusy(true);
    setError('');
    try {
      const { token } = await adminLogin(password);
      setAdminToken(token);
      onAuthed();
    } catch (e) {
      const msg = String((e as Error).message);
      if (msg === 'wrong_password') setError('Incorrect password. Try again.');
      else if (msg === 'rate_limited') setError('Too many failed attempts. Wait a few minutes.');
      else setError('Could not reach the admin server.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: easeOut }}
      className="w-full max-w-sm"
    >
      <div className="relative rounded-[28px] p-8"
        style={{
          background: 'linear-gradient(160deg, rgba(26,18,13,0.95), rgba(16,11,8,0.93))',
          border: '1.5px solid transparent',
          backgroundImage:
            'linear-gradient(160deg, rgba(26,18,13,0.95), rgba(16,11,8,0.93)), linear-gradient(135deg, rgba(217,164,65,0.45), rgba(255,122,24,0.2), rgba(217,164,65,0.45))',
          backgroundOrigin: 'border-box',
          backgroundClip: 'padding-box, border-box',
          boxShadow: '0 24px 70px rgba(0,0,0,0.55), 0 0 70px rgba(255,122,24,0.08)',
        }}
      >
        <div className="mx-auto mb-5 w-16 h-16 rounded-full flex items-center justify-center relative"
          style={{ background: 'radial-gradient(circle, rgba(255,122,24,0.25) 0%, rgba(18,12,10,0.95) 60%)', border: '2px solid rgba(217,164,65,0.6)', boxShadow: '0 0 26px rgba(217,164,65,0.3)' }}
        >
          <ShieldCheck className="w-7 h-7 text-[#D9A441]" />
        </div>
        <h2 className="text-xl font-black tracking-tight text-center mb-1" style={{ fontFamily: 'Cairo, sans-serif', color: '#F7F3EE' }}>
          300K Edits — Admin
        </h2>
        <p className="text-[12px] text-center mb-6" style={{ color: 'rgba(247,243,238,0.4)' }}>
          Restricted area. Authorized personnel only.
        </p>

        <div className="space-y-4">
          <div className="flex items-center gap-3 h-[52px] px-4 rounded-2xl focus-within:ring-1 focus-within:ring-[#D9A441]/40 transition-all duration-300"
            style={{ background: 'rgba(9,8,7,0.7)', border: '1px solid rgba(217,164,65,0.2)', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.3)' }}
          >
            <Lock className="w-4 h-4 text-[#D9A441]/70 shrink-0" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder="Admin password"
              autoFocus
              className="flex-1 bg-transparent text-[14px] outline-none placeholder:text-[rgba(247,243,238,0.2)]"
              style={{ color: '#F7F3EE' }}
            />
          </div>

          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-[12.5px] font-medium"
                style={{ color: '#FF8A8A' }}
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          <motion.button
            onClick={submit}
            disabled={busy}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            className="relative w-full h-[54px] rounded-full font-black tracking-wider disabled:opacity-60"
            style={{
              color: '#0d0906',
              background: 'linear-gradient(135deg, #E8B45C, #D9A441, #b3421f)',
              fontFamily: 'Cairo, sans-serif',
              boxShadow: '0 0 24px rgba(217,164,65,0.35), inset 0 1px 0 rgba(255,255,255,0.3)',
            }}
          >
            {busy ? <Loader2 className="mx-auto w-5 h-5 animate-spin" /> : 'Unlock'}
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

function AdminPanel() {
  const [tab, setTab] = useState<WallStatus>('pending');
  const [counts, setCounts] = useState<AdminStatus>({ pending: 0, approved: 0, rejected: 0 });
  const [items, setItems] = useState<WallItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [c, list] = await Promise.all([adminStatus(), adminList(tab)]);
      setCounts(c);
      setItems(list);
    } catch (e) {
      setError('Failed to load submissions.');
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const act = async (item: WallItem, approve: boolean) => {
    setBusy(item.id);
    try {
      if (approve) await adminApprove(item.id);
      else await adminReject(item.id);
      setNotice(approve ? `${item.name}'s edit approved — now live on the wall.` : `${item.name}'s edit rejected.`);
      setTimeout(() => setNotice(''), 4000);
      await load();
    } catch (e) {
      if (String((e as Error).message) === 'unauthorized') {
        clearAdminToken();
        window.location.reload();
        return;
      }
      setError('The action failed. Try again.');
    } finally {
      setBusy(null);
    }
  };

  const tabBtn = (value: WallStatus, label: string, count: number, color: string) => {
    const active = tab === value;
    return (
      <button
        onClick={() => setTab(value)}
        className="relative px-4 md:px-5 h-10 rounded-full text-[12px] font-bold tracking-wide transition-all duration-300 flex items-center gap-2"
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
              300K Edits — Review Queue
            </h1>
            <p className="text-[12px]" style={{ color: 'rgba(247,243,238,0.4)' }}>
              Every submission is reviewed by hand before the wall goes live.
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
            onClick={() => { clearAdminToken(); setAdminToken(''); window.location.reload(); }}
            className="flex items-center gap-2 h-10 px-4 rounded-full text-[12px] font-bold transition-all duration-300 hover:bg-white/5"
            style={{ border: '1px solid rgba(217,164,65,0.25)', color: 'rgba(247,243,238,0.7)' }}
          >
            <LogOut className="w-3.5 h-3.5" /> Lock
          </button>
        </div>
      </div>

      {/* stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {(
          [
            ['pending', counts.pending, 'rgba(217,164,65,0.12)', '#E8B45C'],
            ['approved', counts.approved, 'rgba(80,200,120,0.1)', '#7FE08B'],
            ['rejected', counts.rejected, 'rgba(255,80,80,0.1)', '#FF7A7A'],
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
            className={`mb-5 rounded-2xl px-5 py-3.5 text-[13px] font-medium ${notice ? '' : ''}`}
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
        {tabBtn('pending', 'Pending', counts.pending, '#E8B45C')}
        {tabBtn('approved', 'Approved', counts.approved, '#7FE08B')}
        {tabBtn('rejected', 'Rejected', counts.rejected, '#FF7A7A')}
      </div>

      {/* list */}
      {loading ? (
        <div className="rounded-[24px] py-20 flex items-center justify-center" style={{ background: 'rgba(9,8,7,0.6)', border: '1px solid rgba(217,164,65,0.1)' }}>
          <Loader2 className="w-7 h-7 text-[#D9A441] animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-[24px] py-20 text-center" style={{ background: 'rgba(9,8,7,0.6)', border: '1px solid rgba(217,164,65,0.1)' }}>
          <div className="mx-auto mb-4 w-14 h-14 rounded-full flex items-center justify-center" style={{ background: 'rgba(217,164,65,0.06)', border: '1px solid rgba(217,164,65,0.2)' }}>
            <EyeOff className="w-6 h-6 text-[#D9A441]/50" />
          </div>
          <p className="text-sm font-bold" style={{ color: 'rgba(247,243,238,0.5)' }}>
            {tab === 'pending' ? 'No pending submissions. ' : 'Nothing here yet. '}
            {tab === 'pending' ? 'The queue is clear.' : ''}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => {
            const chip = statusChip(item.status ?? '');
            const isOpen = expanded.has(item.id);
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: easeOut }}
                className="rounded-[22px] overflow-hidden"
                style={{
                  background: 'linear-gradient(160deg, rgba(26,18,13,0.96), rgba(16,11,8,0.93))',
                  border: `1px solid ${item.status === 'pending' ? 'rgba(217,164,65,0.3)' : 'rgba(255,255,255,0.08)'}`,
                  boxShadow: '0 10px 34px rgba(0,0,0,0.4)',
                }}
              >
                <div className="flex items-start gap-4 p-4 md:p-5 flex-wrap">
                  {/* miniature thumb on the left when video */}
                  <button
                    onClick={() => toggle(item.id)}
                    className="relative shrink-0 w-28 aspect-video rounded-xl overflow-hidden bg-black/60 transition-transform duration-300 hover:scale-[1.03]"
                    style={{ border: '1px solid rgba(217,164,65,0.18)' }}
                  >
                    {item.posterUrl ? (
                      <img src={item.posterUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Link2 className="w-5 h-5 text-[#D9A441]/60" />
                      </div>
                    )}
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
                    </div>
                    <p className="mt-1.5 text-[13.5px] leading-relaxed line-clamp-2" style={{ color: 'rgba(247,243,238,0.75)' }}>
                      {item.caption || 'No caption'}
                    </p>
                    <div className="mt-2 flex items-center gap-2 flex-wrap text-[11px]" style={{ color: 'rgba(247,243,238,0.35)' }}>
                      <span className="uppercase tracking-[0.15em] font-bold">
                        {item.mediaType} {item.kind === 'link' ? '• link' : ''}
                      </span>
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
                      onClick={() => toggle(item.id)}
                      className="flex-1 sm:flex-none items-center justify-center inline-flex gap-2 h-10 px-4 rounded-full text-[12px] font-bold transition-all duration-300 hover:bg-white/5"
                      style={{ border: '1px solid rgba(217,164,65,0.25)', color: 'rgba(247,243,238,0.75)' }}
                    >
                      <EyeOff className="w-3.5 h-3.5" /> Review
                    </button>
                    {tab === 'pending' && (
                      <>
                        <button
                          onClick={() => act(item, true)}
                          disabled={busy === item.id}
                          className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 h-10 px-4 rounded-full text-[12px] font-black transition-all duration-300 hover:scale-105 disabled:opacity-50"
                          style={{
                            color: '#0d0906',
                            background: 'linear-gradient(135deg, #E8B45C, #D9A441)',
                            boxShadow: '0 0 18px rgba(217,164,65,0.35)',
                            fontFamily: 'Cairo, sans-serif',
                          }}
                        >
                          {busy === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ThumbsUp className="w-3.5 h-3.5" />}
                          Approve
                        </button>
                        <button
                          onClick={() => act(item, false)}
                          disabled={busy === item.id}
                          className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 h-10 px-4 rounded-full text-[12px] font-bold transition-all duration-300 hover:scale-105 disabled:opacity-50"
                          style={{ border: '1px solid rgba(255,122,122,0.35)', color: '#FF8A8A', background: 'rgba(255,80,80,0.08)' }}
                        >
                          {busy === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ThumbsDown className="w-3.5 h-3.5" />}
                          Reject
                        </button>
                      </>
                    )}
                    {tab !== 'pending' && (
                      <button
                        onClick={() => toggle(item.id)}
                        className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/5"
                        style={{ border: '1px solid rgba(217,164,65,0.2)' }}
                        aria-label="Toggle review"
                      >
                        <X className="w-4 h-4 text-white/50" />
                      </button>
                    )}
                  </div>
                </div>

                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.4, ease: easeOut }}
                      className="overflow-hidden"
                    >
                      <div className="mx-4 md:mx-5 mb-4 md:mb-5 rounded-2xl p-3" style={{ background: 'rgba(9,8,7,0.6)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <PreviewCard item={item} />
                        {item.url && (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-3 inline-flex items-center gap-2 h-9 px-4 rounded-full text-[12px] font-bold hover:scale-105 transition-transform"
                            style={{ border: '1px solid rgba(217,164,65,0.3)', color: GOLD, background: 'rgba(217,164,65,0.05)' }}
                          >
                            <ExternalLink className="w-3.5 h-3.5" /> Open {hostOf(item.url)}
                          </a>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AdminPage() {
  const [authed, setAuthed] = useState(() => Boolean(getAdminToken()));

  return (
    <div className="min-h-screen bg-[#090807] text-white overflow-x-hidden">
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 0%, rgba(255,122,24,0.1) 0%, transparent 70%)' }} />
      <div className="absolute inset-0 pointer-events-none noise-overlay" />

      <main className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6 py-16">
        {authed ? <AdminPanel /> : <LoginView onAuthed={() => setAuthed(true)} />}
      </main>

      <footer className="relative pb-14 pt-10 text-center">
        <p className="text-[11px] font-black tracking-[0.3em] uppercase" style={{ color: 'rgba(247,243,238,0.25)' }}>
          TMNAA — Admin Console
        </p>
      </footer>
    </div>
  );
}

export default AdminPage;
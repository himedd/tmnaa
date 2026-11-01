import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  X,
  ThumbsUp,
  ThumbsDown,
  Loader2,
  Link2,
  ExternalLink,
  Lock,
  Trash2,
  Copy,
  Zap,
  Flag,
  Clock,
  Save,
  ChevronLeft,
  ChevronRight,
  PencilLine,
  StickyNote,
  Keyboard,
  Heart,
  BadgeCheck,
} from 'lucide-react';
import type { WallItem } from '@/lib/wallApi';
import { adminSetNote, adminUpdate, hostOf, timeAgo, tiktokEmbedUrl } from '@/lib/wallApi';
import { isReviewLocked, type BadgeInfo } from '@/lib/moderation';

const GOLD = '#D9A441';

const REJECT_REASONS = [
  'Inappropriate / Offensive',
  'Spam or Duplicate',
  'Low Quality',
  'Unrelated to Milestone',
  'Copyright Concern',
  'Other',
];

interface Props {
  item: WallItem;
  who: string;
  badge: BadgeInfo | undefined;
  position: { index: number; total: number };
  busy: boolean;
  onApprove: () => void;
  onReject: (reason: string) => void;
  onUnpublish: (reason: string) => void;
  onUpdate: () => void;
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
}

function BigPreview({ item }: { item: WallItem }) {
  const [failedVideo, setFailedVideo] = useState(false);
  if (item.mediaType === 'video' && item.mediaUrl && !failedVideo) {
    return (
      <div className="relative rounded-[20px] overflow-hidden group/vid" style={{ border: '1px solid rgba(217,164,65,0.28)', boxShadow: '0 18px 50px rgba(0,0,0,0.55), 0 0 40px rgba(217,164,65,0.1)' }}>
        <video
          src={item.mediaUrl}
          controls
          autoPlay
          muted
          playsInline
          onError={() => setFailedVideo(true)}
          className="w-full max-h-[58vh] bg-black object-contain"
        />
        <div className="absolute top-3 left-3 px-3 h-7 rounded-full text-[10px] font-black uppercase tracking-[0.18em] inline-flex items-center gap-1.5" style={{ background: 'rgba(0,0,0,0.65)', border: '1px solid rgba(217,164,65,0.35)', color: '#E8B45C', backdropFilter: 'blur(8px)' }}>
          <span className="w-1.5 h-1.5 rounded-full bg-[#E8B45C] animate-pulse" /> Video preview
        </div>
      </div>
    );
  }
  if (item.posterUrl && item.mediaType === 'image') {
    return (
      <div className="relative rounded-[20px] overflow-hidden group/img" style={{ border: '1px solid rgba(217,164,65,0.28)', boxShadow: '0 18px 50px rgba(0,0,0,0.55), 0 0 40px rgba(217,164,65,0.1)' }}>
        <img
          src={item.posterUrl}
          alt={item.caption || item.name}
          className="w-full max-h-[58vh] object-contain bg-black transition-transform duration-700 group-hover/img:scale-[1.02]"
        />
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(180deg, transparent 70%, rgba(0,0,0,0.35) 100%)' }} />
      </div>
    );
  }
  if (item.posterUrl) {
    return (
      <div className="relative rounded-[20px] overflow-hidden" style={{ border: '1px solid rgba(217,164,65,0.28)', boxShadow: '0 18px 50px rgba(0,0,0,0.55)' }}>
        <img
          src={item.posterUrl}
          alt={item.caption || item.name}
          className="w-full max-h-[58vh] object-contain bg-black"
        />
      </div>
    );
  }
  if (item.mediaType === 'link' && item.url) {
    const embed = tiktokEmbedUrl(item.url);
    if (embed) {
      return (
        <div className="w-full aspect-video max-h-[58vh] overflow-hidden rounded-[20px] bg-black relative" style={{ border: '1px solid rgba(217,164,65,0.28)', boxShadow: '0 18px 50px rgba(0,0,0,0.55)' }}>
          <iframe src={embed} title={`${item.caption || item.name} preview`} className="w-full h-full" allow="encrypted-media; fullscreen; picture-in-picture" allowFullScreen />
        </div>
      );
    }
  }
  return (
    <div className="w-full aspect-video rounded-[20px] flex flex-col items-center justify-center gap-3 relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, rgba(45,27,20,0.92), rgba(14,10,8,0.96))',
        border: '1.5px solid rgba(217,164,65,0.25)',
        boxShadow: '0 18px 50px rgba(0,0,0,0.5)',
      }}
    >
      <div className="absolute inset-0 shimmer opacity-50" />
      <span className="w-16 h-16 rounded-[20px] flex items-center justify-center relative" style={{ background: 'rgba(217,164,65,0.08)', border: '1px solid rgba(217,164,65,0.3)' }}>
        <Link2 className="w-7 h-7 text-[#D9A441]/70" />
      </span>
      <span className="text-sm font-black uppercase tracking-[0.22em] relative" style={{ color: 'rgba(217,164,65,0.7)' }}>
        {hostOf(item.url)}
      </span>
      {item.url && (
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="relative inline-flex items-center gap-2 h-10 px-5 rounded-2xl text-[12.5px] font-bold hover:scale-105 transition-transform"
          style={{ border: '1px solid rgba(217,164,65,0.4)', color: GOLD, background: 'rgba(217,164,65,0.07)' }}
        >
          <ExternalLink className="w-3.5 h-3.5" /> Open {hostOf(item.url)}
        </a>
      )}
    </div>
  );
}

export function ReviewModal(props: Props) {
  const { item, who, badge, position, busy, onApprove, onReject, onUnpublish, onUpdate, onClose, onNext, onPrev } = props;
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reasonSel, setReasonSel] = useState('');
  const [reasonFree, setReasonFree] = useState('');
  const [note, setNote] = useState(item.internalNote ?? '');
  const [name, setName] = useState(item.name);
  const [caption, setCaption] = useState(item.caption);
  const [saving, setSaving] = useState<'note' | 'edit' | null>(null);
  const [saveMsg, setSaveMsg] = useState('');
  const locked = isReviewLocked(item, who);

  useEffect(() => {
    setNote(item.internalNote ?? '');
    setName(item.name);
    setCaption(item.caption);
    setRejectOpen(false);
    setReasonSel('');
    setReasonFree('');
    setSaveMsg('');
  }, [item.id]);

  // keyboard shortcuts: Esc close, a approve, r reject, n/→ next, p/← prev
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA' || (e.target as HTMLElement)?.tagName === 'SELECT') {
        return;
      }
      if (e.key === 'Escape') onClose();
      else if (e.key === 'a' || e.key === 'A') onApprove();
      else if (e.key === 'r' || e.key === 'R') setRejectOpen(true);
      else if (e.key === 'ArrowRight' || e.key === 'n' || e.key === 'N') onNext();
      else if (e.key === 'ArrowLeft' || e.key === 'p' || e.key === 'P') onPrev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onApprove, onReject, onUnpublish, onClose, onNext, onPrev, item.id]);

  const submitReason = () => {
    const r = reasonSel === 'Other' ? (reasonFree.trim() || 'Other') : reasonSel;
    if (!r) return;
    if (item.status === 'approved') onUnpublish(r);
    else onReject(r);
    setRejectOpen(false);
  };

  const saveNote = async () => {
    setSaving('note');
    setSaveMsg('');
    try {
      await adminSetNote(item.id, note);
      setSaveMsg('Note saved.');
      onUpdate();
    } catch {
      setSaveMsg('Could not save note.');
    } finally {
      setSaving(null);
    }
  };

  const saveEdit = async () => {
    setSaving('edit');
    setSaveMsg('');
    try {
      await adminUpdate(item.id, { name: name.trim(), caption: caption.trim() });
      setSaveMsg('Saved — it now reflects live.');
      onUpdate();
    } catch {
      setSaveMsg('Could not save edits.');
    } finally {
      setSaving(null);
    }
  };

  const dirtyEdit =
    name.trim() !== (item.name ?? '') || caption.trim() !== (item.caption ?? '');

  const progress = position.total > 0 ? Math.round(((position.index + 1) / position.total) * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-[70] overflow-y-auto"
      style={{ background: 'rgba(4,3,2,0.86)', backdropFilter: 'blur(12px)' }}
      onClick={onClose}
    >
      <div className="min-h-full flex items-start sm:items-center justify-center p-3 md:p-6 py-8">
        <motion.div
          initial={{ opacity: 0, y: 44, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-4xl rounded-[30px] overflow-hidden relative"
          style={{
            background: 'linear-gradient(165deg, rgba(32,22,14,0.99), rgba(14,10,7,0.98))',
            border: '1.5px solid rgba(217,164,65,0.35)',
            boxShadow: '0 40px 120px rgba(0,0,0,0.7), 0 0 80px rgba(217,164,65,0.1)',
          }}
        >
          {/* progress top */}
          <div className="absolute top-0 left-0 right-0 h-[3px] z-20" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <motion.div className="h-full" style={{ background: 'linear-gradient(90deg, #F4C876, #b3421f)', boxShadow: '0 0 12px rgba(217,164,65,0.6)' }} initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }} />
          </div>
          <div className="absolute top-0 left-[15%] right-[15%] h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(232,180,92,0.7), transparent)' }} />

          {/* header row */}
          <div className="flex items-center gap-3 px-5 md:px-7 py-5 flex-wrap relative" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'linear-gradient(180deg, rgba(217,164,65,0.05), transparent)' }}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="w-9 h-9 rounded-xl flex items-center justify-center text-[15px] font-black shrink-0" style={{ background: 'linear-gradient(135deg, #F4C876, #b3421f)', color: '#0d0906', fontFamily: 'Cairo, sans-serif', boxShadow: '0 0 16px rgba(217,164,65,0.35)' }}>
                  {(item.name?.[0] ?? '@').toUpperCase()}
                </span>
                <span className="text-[16px] font-black tracking-tight" style={{ fontFamily: 'Cairo, sans-serif', color: GOLD }}>
                  @{item.name}
                </span>
                {item.status === 'pending' && (
                  <span className="px-2.5 h-6 rounded-full text-[10px] font-black uppercase tracking-[0.14em] inline-flex items-center gap-1.5" style={{ background: 'rgba(217,164,65,0.12)', color: '#E8B45C', border: '1px solid rgba(217,164,65,0.4)' }}>
                    <span className="w-1.5 h-1.5 rounded-full bg-[#E8B45C] animate-pulse" /> Pending
                  </span>
                )}
                {item.status === 'approved' && (
                  <span className="px-2.5 h-6 rounded-full text-[10px] font-black uppercase tracking-[0.14em] inline-flex items-center gap-1.5" style={{ background: 'rgba(80,200,120,0.12)', color: '#7FE08B', border: '1px solid rgba(80,200,120,0.4)' }}>
                    <BadgeCheck className="w-3 h-3" /> Approved
                  </span>
                )}
                <span className="inline-flex items-center gap-1 text-[11.5px] font-medium tabular-nums" style={{ color: 'rgba(247,243,238,0.4)' }}>
                  <Clock className="inline w-3 h-3" /> {timeAgo(item.createdAt)}
                </span>
                {locked && (
                  <span className="flex items-center gap-1 px-2.5 h-6 rounded-full text-[10px] font-black uppercase tracking-wider" style={{ background: 'rgba(255,140,60,0.14)', color: '#FF9A3C', border: '1px solid rgba(255,140,60,0.45)' }}>
                    <Lock className="w-3 h-3" /> {item.reviewingBy}
                  </span>
                )}
              </div>
              <p className="mt-1.5 text-[12px] font-medium flex items-center gap-2 flex-wrap" style={{ color: 'rgba(247,243,238,0.42)' }}>
                <span className="px-2 py-0.5 rounded-md font-mono text-[10.5px]" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>{item.mediaType}{item.kind === 'link' ? ' · link' : ''}</span>
                <span className="font-mono text-[10.5px]">{item.width && item.height ? `${item.width}×${item.height}` : 'no dims'}</span>
                {item.transcoded && <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase" style={{ background: 'rgba(138,180,255,0.1)', color: '#8AB4FF', border: '1px solid rgba(138,180,255,0.3)' }}>normalised</span>}
                {item.likes > 0 && <span className="font-black tabular-nums" style={{ color: 'rgba(127,224,139,0.85)' }}><Heart className="inline w-3 h-3 mr-1" />{item.likes}</span>}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="hidden md:flex items-center gap-1.5 px-3 h-9 rounded-full text-[11px] font-black tabular-nums mr-1" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(247,243,238,0.5)' }}>
                {position.index + 1} / {position.total}
              </div>
              <motion.button whileHover={{ scale: 1.1, x: -2 }} whileTap={{ scale: 0.9 }} onClick={onPrev} disabled={position.index <= 0} className="w-10 h-10 rounded-2xl flex items-center justify-center hover:bg-white/[0.06] disabled:opacity-25 transition-colors" style={{ border: '1px solid rgba(217,164,65,0.28)', background: 'rgba(217,164,65,0.05)' }} aria-label="Previous">
                <ChevronLeft className="w-[18px] h-[18px] text-[#E8B45C]" />
              </motion.button>
              <motion.button whileHover={{ scale: 1.1, x: 2 }} whileTap={{ scale: 0.9 }} onClick={onNext} disabled={position.index >= position.total - 1} className="w-10 h-10 rounded-2xl flex items-center justify-center hover:bg-white/[0.06] disabled:opacity-25 transition-colors" style={{ border: '1px solid rgba(217,164,65,0.28)', background: 'rgba(217,164,65,0.05)' }} aria-label="Next">
                <ChevronRight className="w-[18px] h-[18px] text-[#E8B45C]" />
              </motion.button>
              <motion.button whileHover={{ scale: 1.1, rotate: 90 }} whileTap={{ scale: 0.9 }} onClick={onClose} className="w-10 h-10 rounded-2xl flex items-center justify-center hover:bg-[rgba(255,80,80,0.12)] transition-colors" style={{ border: '1px solid rgba(255,122,122,0.3)', background: 'rgba(255,80,80,0.06)' }} aria-label="Close">
                <X className="w-[18px] h-[18px] text-[#FF9A9A]" />
              </motion.button>
            </div>
          </div>

          {/* preview */}
          <div className="px-5 md:px-7 pt-5">
            <BigPreview item={item} />
          </div>

          {/* badges */}
          {(badge?.dupOf || badge?.frequentSubmitter || (item.flagCount ?? 0) > 0 || item.rejectReason) && (
            <div className="px-5 md:px-7 pt-4 flex items-center gap-2 flex-wrap">
              {badge?.dupOf && (
                <motion.span initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="px-3 h-7 rounded-full text-[10.5px] font-black uppercase tracking-wider inline-flex items-center gap-1.5" style={{ background: 'rgba(138,107,60,0.14)', color: '#E2C48F', border: '1px solid rgba(217,182,122,0.35)' }}>
                  <Copy className="w-3.5 h-3.5" /> Duplicate{badge.dupOfName ? ` · @${badge.dupOfName}` : ''}
                </motion.span>
              )}
              {badge?.frequentSubmitter && (
                <motion.span initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.05 }} className="px-3 h-7 rounded-full text-[10.5px] font-black uppercase tracking-wider inline-flex items-center gap-1.5" style={{ background: 'rgba(255,122,24,0.12)', color: '#FF9A3C', border: '1px solid rgba(255,122,24,0.35)' }}>
                  <Zap className="w-3.5 h-3.5" /> Frequent ({badge.submissionsByDevice} subs)
                </motion.span>
              )}
              {(item.flagCount ?? 0) > 0 && (
                <motion.span animate={{ scale: [1, 1.04, 1] }} transition={{ duration: 2, repeat: Infinity }} className="px-3 h-7 rounded-full text-[10.5px] font-black uppercase tracking-wider inline-flex items-center gap-1.5" style={{ background: 'rgba(255,80,80,0.12)', color: '#FF8A8A', border: '1px solid rgba(255,80,80,0.35)' }}>
                  <Flag className="w-3.5 h-3.5" /> ×{item.flagCount} — {item.flagReasons?.join(', ')}
                </motion.span>
              )}
              {item.rejectReason && (
                <span className="px-3 h-7 rounded-full text-[10.5px] font-bold inline-flex items-center" style={{ background: 'rgba(255,80,80,0.07)', color: 'rgba(255,138,138,0.9)', border: '1px solid rgba(255,80,80,0.22)' }}>
                  {item.rejectReason}
                </span>
              )}
            </div>
          )}

          {/* edit name/caption */}
          <div className="px-5 md:px-7 pt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-2xl p-3.5 transition-colors focus-within:border-[#D9A441]/45" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(217,164,65,0.16)' }}>
              <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.22em] mb-2" style={{ color: 'rgba(217,164,65,0.75)' }}>
                <PencilLine className="w-3.5 h-3.5" /> Display name
              </label>
              <input
                value={name}
                maxLength={40}
                onChange={(e) => setName(e.target.value)}
                className="w-full h-10 px-3.5 rounded-xl text-[13.5px] outline-none bg-transparent font-bold"
                style={{ border: '1px solid rgba(255,255,255,0.08)', color: '#F7F3EE', background: 'rgba(255,255,255,0.02)' }}
              />
            </div>
            <div className="rounded-2xl p-3.5 transition-colors focus-within:border-[#D9A441]/45" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(217,164,65,0.16)' }}>
              <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.22em] mb-2" style={{ color: 'rgba(217,164,65,0.75)' }}>
                <PencilLine className="w-3.5 h-3.5" /> Caption
              </label>
              <input
                value={caption}
                maxLength={180}
                onChange={(e) => setCaption(e.target.value)}
                className="w-full h-10 px-3.5 rounded-xl text-[13.5px] outline-none bg-transparent font-medium"
                style={{ border: '1px solid rgba(255,255,255,0.08)', color: '#F7F3EE', background: 'rgba(255,255,255,0.02)' }}
              />
            </div>
          </div>
          {dirtyEdit && (
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="px-5 md:px-7 pt-2.5">
              <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.95 }} onClick={saveEdit} disabled={saving !== null} className="inline-flex items-center gap-2 h-10 px-5 rounded-2xl text-[12.5px] font-black hover:shadow-[0_0_20px_rgba(217,164,65,0.3)] transition-shadow disabled:opacity-50" style={{ border: '1px solid rgba(217,164,65,0.45)', color: GOLD, background: 'rgba(217,164,65,0.07)' }}>
                {saving === 'edit' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save name & caption
              </motion.button>
            </motion.div>
          )}

          {/* private note */}
          <div className="px-5 md:px-7 pt-3.5">
            <div className="rounded-2xl p-3.5" style={{ background: 'linear-gradient(160deg, rgba(138,180,255,0.05), rgba(0,0,0,0.3))', border: '1px solid rgba(138,180,255,0.16)' }}>
              <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.22em] mb-2" style={{ color: 'rgba(138,180,255,0.8)' }}>
                <StickyNote className="w-3.5 h-3.5" /> Private note <span className="normal-case font-medium tracking-normal" style={{ color: 'rgba(247,243,238,0.3)' }}>(only admins see this)</span>
              </label>
              <div className="flex items-stretch gap-2">
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  maxLength={2000}
                  placeholder="Internal context, reminder, check something…"
                  className="flex-1 px-3.5 py-3 rounded-xl text-[13px] outline-none resize-none bg-transparent font-medium"
                  style={{ border: '1px solid rgba(255,255,255,0.08)', color: '#F7F3EE', background: 'rgba(0,0,0,0.35)' }}
                />
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.93 }} onClick={saveNote} disabled={saving !== null} className="px-4 rounded-xl inline-flex flex-col items-center justify-center gap-1 text-[11.5px] font-black disabled:opacity-50 hover:shadow-[0_0_20px_rgba(217,164,65,0.3)] transition-shadow" style={{ border: '1px solid rgba(217,164,65,0.4)', color: GOLD, background: 'rgba(217,164,65,0.06)' }}>
                  {saving === 'note' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save
                </motion.button>
              </div>
              {saveMsg && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2 text-[11.5px] font-bold flex items-center gap-1.5" style={{ color: 'rgba(127,224,139,0.9)' }}>
                  <BadgeCheck className="w-3.5 h-3.5" />{saveMsg}
                </motion.p>
              )}
            </div>
          </div>

          {/* actions */}
          <div className="px-5 md:px-7 py-6 flex items-center gap-2.5 flex-wrap">
            {item.status === 'pending' ? (
              <>
                <motion.button
                  onClick={onApprove}
                  disabled={busy || locked}
                  whileHover={!busy && !locked ? { scale: 1.05, y: -2 } : {}}
                  whileTap={{ scale: 0.94 }}
                  className="premium-btn relative inline-flex items-center gap-2 h-12 px-7 rounded-2xl text-[13.5px] font-black disabled:opacity-45 overflow-hidden"
                  style={{ color: '#0d0906', background: 'linear-gradient(135deg, #F4C876, #D9A441 55%, #b3421f)', boxShadow: '0 0 26px rgba(217,164,65,0.4), inset 0 1px 0 rgba(255,255,255,0.4)', fontFamily: 'Cairo, sans-serif' }}
                >
                  <span className="absolute inset-0" style={{ background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.4) 50%, transparent 60%)', backgroundSize: '250% 100%', animation: 'shimmer 2.6s infinite' }} />
                  {busy ? <Loader2 className="w-4 h-4 animate-spin relative" /> : <ThumbsUp className="w-4 h-4 relative" />}
                  <span className="relative">Approve (A)</span>
                </motion.button>
                <motion.button
                  onClick={() => setRejectOpen(!rejectOpen)}
                  disabled={busy || locked}
                  whileHover={!busy && !locked ? { scale: 1.05, y: -2 } : {}}
                  whileTap={{ scale: 0.94 }}
                  className="inline-flex items-center gap-2 h-12 px-7 rounded-2xl text-[13.5px] font-black disabled:opacity-45 hover:shadow-[0_0_26px_rgba(255,80,80,0.35)] transition-shadow"
                  style={{ border: '1.5px solid rgba(255,122,122,0.45)', color: '#FF8A8A', background: 'rgba(255,80,80,0.08)', fontFamily: 'Cairo, sans-serif' }}
                >
                  <ThumbsDown className="w-4 h-4" /> Reject (R)
                </motion.button>
              </>
            ) : item.status === 'approved' ? (
              <motion.button
                onClick={() => setRejectOpen(!rejectOpen)}
                disabled={busy || locked}
                whileHover={!busy && !locked ? { scale: 1.05, y: -2 } : {}}
                whileTap={{ scale: 0.94 }}
                className="inline-flex items-center gap-2 h-12 px-7 rounded-2xl text-[13.5px] font-black disabled:opacity-45 hover:shadow-[0_0_26px_rgba(255,80,80,0.35)] transition-shadow"
                style={{ border: '1.5px solid rgba(255,122,122,0.45)', color: '#FF8A8A', background: 'rgba(255,80,80,0.08)', fontFamily: 'Cairo, sans-serif' }}
              >
                <Trash2 className="w-4 h-4" /> Take Down
              </motion.button>
            ) : (
              <span className="inline-flex items-center gap-2 text-[12.5px] font-bold px-4 h-11 rounded-2xl" style={{ color: 'rgba(247,243,238,0.5)', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                {item.reviewedAt ? `Actioned ${timeAgo(item.reviewedAt)} by ${item.reviewer ?? 'admin'}` : 'Waiting for undo window.'}
              </span>
            )}
            <span className="ml-auto hidden sm:inline-flex items-center gap-1.5 text-[10.5px] font-bold px-3 h-8 rounded-full" style={{ color: 'rgba(247,243,238,0.32)', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <Keyboard className="w-3.5 h-3.5" /> A · R · → · ← · Esc
            </span>
          </div>

          {/* reject reason picker */}
          {rejectOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="mx-5 md:mx-7 mb-6 rounded-[20px] p-4 md:p-5 overflow-hidden"
              style={{ background: 'linear-gradient(160deg, rgba(255,80,80,0.07), rgba(0,0,0,0.4))', border: '1.5px solid rgba(255,80,80,0.32)', boxShadow: '0 0 30px rgba(255,80,80,0.1)' }}
            >
              <label className="flex items-center gap-2 text-[10.5px] font-black uppercase tracking-[0.22em] mb-3" style={{ color: 'rgba(255,138,138,0.9)' }}>
                <Flag className="w-3.5 h-3.5" /> Choose a reason — stored internally
              </label>
              <div className="flex flex-wrap gap-2">
                {REJECT_REASONS.map((r, i) => (
                  <motion.button
                    key={r}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.04 }}
                    onClick={() => setReasonSel(r)}
                    whileHover={{ scale: 1.06 }}
                    whileTap={{ scale: 0.92 }}
                    className="px-3.5 h-9 rounded-full text-[11.5px] font-bold transition-all duration-300"
                    style={{
                      fontFamily: 'Cairo, sans-serif',
                      color: reasonSel === r ? '#0d0906' : 'rgba(247,243,238,0.62)',
                      background: reasonSel === r ? 'linear-gradient(135deg, #ffb199, #ff6b6b)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${reasonSel === r ? 'transparent' : 'rgba(255,255,255,0.1)'}`,
                      boxShadow: reasonSel === r ? '0 0 16px rgba(255,107,107,0.4)' : 'none',
                    }}
                  >
                    {r}
                  </motion.button>
                ))}
              </div>
              {reasonSel === 'Other' && (
                <motion.input
                  initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                  value={reasonFree}
                  onChange={(e) => setReasonFree(e.target.value)}
                  placeholder="Describe the reason…"
                  className="mt-3 w-full h-11 px-4 rounded-2xl text-[13px] outline-none bg-transparent font-medium"
                  style={{ border: '1px solid rgba(255,122,122,0.3)', color: '#F7F3EE', background: 'rgba(0,0,0,0.35)' }}
                />
              )}
              <div className="mt-4 flex items-center gap-2">
                <button onClick={() => setRejectOpen(false)} className="h-10 px-5 rounded-2xl text-[12.5px] font-bold hover:bg-white/[0.06] transition-colors" style={{ border: '1px solid rgba(255,255,255,0.14)', color: 'rgba(247,243,238,0.7)' }}>
                  Cancel
                </button>
                <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.95 }} onClick={submitReason} disabled={!reasonSel && !reasonFree} className="h-10 px-6 rounded-2xl text-[12.5px] font-black disabled:opacity-40" style={{ color: '#fff', background: 'linear-gradient(135deg, #ff6b6b, #a93226)', fontFamily: 'Cairo, sans-serif', boxShadow: '0 0 20px rgba(255,80,80,0.35)' }}>
                  Confirm {item.status === 'approved' ? 'Take Down' : 'Reject'}
                </motion.button>
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
}

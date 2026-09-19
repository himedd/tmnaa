import { useEffect, useMemo, useState } from 'react';
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
      <video
        src={item.mediaUrl}
        controls
        autoPlay
        muted
        playsInline
        onError={() => setFailedVideo(true)}
        className="w-full max-h-[60vh] bg-black object-contain rounded-2xl"
        style={{ border: '1px solid rgba(217,164,65,0.2)' }}
      />
    );
  }
  if (item.posterUrl && item.mediaType === 'image') {
    return (
      <img
        src={item.posterUrl}
        alt={item.caption || item.name}
        className="w-full max-h-[60vh] object-contain rounded-2xl"
        style={{ border: '1px solid rgba(217,164,65,0.2)' }}
      />
    );
  }
  if (item.posterUrl) {
    return (
      <img
        src={item.posterUrl}
        alt={item.caption || item.name}
        className="w-full max-h-[60vh] object-contain rounded-2xl"
        style={{ border: '1px solid rgba(217,164,65,0.2)' }}
      />
    );
  }
  if (item.mediaType === 'link' && item.url) {
    const embed = tiktokEmbedUrl(item.url);
    if (embed) {
      return (
        <div className="w-full aspect-video max-h-[60vh] overflow-hidden rounded-2xl bg-black"
          style={{ border: '1px solid rgba(217,164,65,0.2)' }}
        >
          <iframe src={embed} title={`${item.caption || item.name} preview`} className="w-full h-full" allow="encrypted-media; fullscreen; picture-in-picture" allowFullScreen />
        </div>
      );
    }
  }
  return (
    <div className="w-full aspect-video rounded-2xl flex flex-col items-center justify-center gap-3"
      style={{
        background: 'linear-gradient(135deg, rgba(45,27,20,0.9), rgba(14,10,8,0.95))',
        border: '1.5px solid rgba(217,164,65,0.2)',
      }}
    >
      <Link2 className="w-8 h-8 text-[#D9A441]/60" />
      <span className="text-sm font-bold uppercase tracking-widest" style={{ color: 'rgba(217,164,65,0.6)' }}>
        {hostOf(item.url)}
      </span>
      {item.url && (
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 h-9 px-4 rounded-full text-[12px] font-bold hover:scale-105 transition-transform"
          style={{ border: '1px solid rgba(217,164,65,0.35)', color: GOLD, background: 'rgba(217,164,65,0.05)' }}
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

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] overflow-y-auto"
      style={{ background: 'rgba(5,4,3,0.85)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div className="min-h-full flex items-start sm:items-center justify-center p-3 md:p-6">
        <motion.div
          initial={{ opacity: 0, y: 26, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-4xl rounded-[28px] overflow-hidden"
          style={{
            background: 'linear-gradient(160deg, rgba(26,18,13,0.98), rgba(16,11,8,0.96))',
            border: '1.5px solid rgba(217,164,65,0.35)',
            boxShadow: '0 30px 90px rgba(0,0,0,0.65)',
          }}
        >
          {/* header row */}
          <div className="flex items-center gap-3 px-5 md:px-6 py-4 flex-wrap"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[15px] font-black" style={{ fontFamily: 'Cairo, sans-serif', color: GOLD }}>
                  @{item.name}
                </span>
                {item.status === 'pending' && (
                  <span className="px-2.5 h-6 rounded-full text-[10px] font-black uppercase tracking-wider"
                    style={{ background: 'rgba(217,164,65,0.1)', color: '#E8B45C', border: '1px solid rgba(217,164,65,0.35)' }}
                  >
                    Pending
                  </span>
                )}
                <span className="text-[11px]" style={{ color: 'rgba(247,243,238,0.35)' }}>
                  <Clock className="inline w-3 h-3 mr-1" /> {timeAgo(item.createdAt)}
                </span>
                {locked && (
                  <span className="flex items-center gap-1 px-2.5 h-6 rounded-full text-[10px] font-black uppercase tracking-wider"
                    style={{ background: 'rgba(255,140,60,0.12)', color: '#FF9A3C', border: '1px solid rgba(255,140,60,0.4)' }}
                  >
                    <Lock className="w-3 h-3" /> Reviewing by {item.reviewingBy}
                  </span>
                )}
              </div>
              <p className="mt-1 text-[12.5px] truncate" style={{ color: 'rgba(247,243,238,0.45)' }}>
                {item.mediaType} {item.kind === 'link' ? '• link' : ''} • {
                  item.width && item.height ? `${item.width}×${item.height}` : 'no dims'
                } {item.transcoded ? '• normalised' : ''} {item.likes > 0 ? `• ${item.likes} ♥` : ''}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onPrev}
                disabled={position.index <= 0}
                className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-white/5 disabled:opacity-30"
                style={{ border: '1px solid rgba(217,164,65,0.25)' }}
                aria-label="Previous"
              >
                <ChevronLeft className="w-4 h-4 text-[#D9A441]" />
              </button>
              <button
                onClick={onNext}
                disabled={position.index >= position.total - 1}
                className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-white/5 disabled:opacity-30"
                style={{ border: '1px solid rgba(217,164,65,0.25)' }}
                aria-label="Next"
              >
                <ChevronRight className="w-4 h-4 text-[#D9A441]" />
              </button>
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-white/5"
                style={{ border: '1px solid rgba(217,164,65,0.25)' }}
                aria-label="Close"
              >
                <X className="w-4 h-4 text-white/60" />
              </button>
            </div>
          </div>

          {/* preview */}
          <div className="px-5 md:px-6 pt-5">
            <BigPreview item={item} />
          </div>

          {/* badges */}
          {(badge?.dupOf || badge?.frequentSubmitter || (item.flagCount ?? 0) > 0 || item.rejectReason) && (
            <div className="px-5 md:px-6 pt-4 flex items-center gap-2 flex-wrap">
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
                  <Zap className="w-3 h-3" /> Frequent submitter ({badge.submissionsByDevice} subs)
                </span>
              )}
              {(item.flagCount ?? 0) > 0 && (
                <span className="px-2.5 h-6 rounded-full text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1"
                  style={{ background: 'rgba(255,80,80,0.1)', color: '#FF8A8A', border: '1px solid rgba(255,80,80,0.3)' }}
                >
                  <Flag className="w-3 h-3" /> Flagged ×{item.flagCount} — {item.flagReasons?.join(', ')}
                </span>
              )}
              {item.rejectReason && (
                <span className="px-2.5 h-6 rounded-full text-[10px] font-black uppercase tracking-wider"
                  style={{ background: 'rgba(255,80,80,0.08)', color: 'rgba(255,138,138,0.85)', border: '1px solid rgba(255,80,80,0.2)' }}
                >
                  {item.rejectReason}
                </span>
              )}
            </div>
          )}

          {/* edit name/caption */}
          <div className="px-5 md:px-6 pt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10.5px] font-bold uppercase tracking-[0.2em] mb-1.5" style={{ color: 'rgba(217,164,65,0.7)' }}>
                Display name
              </label>
              <input
                value={name}
                maxLength={40}
                onChange={(e) => setName(e.target.value)}
                className="w-full h-10 px-4 rounded-xl text-[13px] outline-none bg-transparent focus:ring-1 focus:ring-[#D9A441]/40"
                style={{ border: '1px solid rgba(217,164,65,0.18)', color: '#F7F3EE' }}
              />
            </div>
            <div>
              <label className="block text-[10.5px] font-bold uppercase tracking-[0.2em] mb-1.5" style={{ color: 'rgba(217,164,65,0.7)' }}>
                Caption
              </label>
              <input
                value={caption}
                maxLength={180}
                onChange={(e) => setCaption(e.target.value)}
                className="w-full h-10 px-4 rounded-xl text-[13px] outline-none bg-transparent focus:ring-1 focus:ring-[#D9A441]/40"
                style={{ border: '1px solid rgba(217,164,65,0.18)', color: '#F7F3EE' }}
              />
            </div>
          </div>
          {dirtyEdit && (
            <div className="px-5 md:px-6 pt-2">
              <button
                onClick={saveEdit}
                disabled={saving !== null}
                className="inline-flex items-center gap-2 h-9 px-4 rounded-full text-[12px] font-bold hover:scale-105 transition-transform disabled:opacity-50"
                style={{ border: '1px solid rgba(217,164,65,0.35)', color: GOLD }}
              >
                {saving === 'edit' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Save name & caption
              </button>
            </div>
          )}

          {/* private note */}
          <div className="px-5 md:px-6 pt-4">
            <label className="block text-[10.5px] font-bold uppercase tracking-[0.2em] mb-1.5" style={{ color: 'rgba(217,164,65,0.7)' }}>
              Private note <span style={{ color: 'rgba(247,243,238,0.25)' }}>(only admins see this)</span>
            </label>
            <div className="flex items-stretch gap-2">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                maxLength={2000}
                placeholder="Internal context, reminder, check something…"
                className="flex-1 px-4 py-3 rounded-xl text-[13px] outline-none resize-none bg-transparent focus:ring-1 focus:ring-[#D9A441]/40"
                style={{ border: '1px solid rgba(217,164,65,0.18)', color: '#F7F3EE' }}
              />
              <button
                onClick={saveNote}
                disabled={saving !== null}
                className="px-4 h-full rounded-xl inline-flex items-center gap-2 text-[12px] font-bold hover:scale-105 transition-transform disabled:opacity-50"
                style={{ border: '1px solid rgba(217,164,65,0.35)', color: GOLD }}
              >
                {saving === 'note' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Save
              </button>
            </div>
            {saveMsg && (
              <p className="mt-1.5 text-[11px]" style={{ color: 'rgba(127,224,139,0.9)' }}>{saveMsg}</p>
            )}
          </div>

          {/* actions */}
          <div className="px-5 md:px-6 py-5 flex items-center gap-2 flex-wrap">
            {item.status === 'pending' ? (
              <>
                <button
                  onClick={onApprove}
                  disabled={busy || locked}
                  className="inline-flex items-center gap-2 h-11 px-6 rounded-full text-[13px] font-black transition-all duration-300 hover:scale-105 disabled:opacity-50"
                  style={{ color: '#0d0906', background: 'linear-gradient(135deg, #E8B45C, #D9A441)', boxShadow: '0 0 20px rgba(217,164,65,0.35)', fontFamily: 'Cairo, sans-serif' }}
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ThumbsUp className="w-4 h-4" />}
                  Approve (A)
                </button>
                <button
                  onClick={() => setRejectOpen(!rejectOpen)}
                  disabled={busy || locked}
                  className="inline-flex items-center gap-2 h-11 px-6 rounded-full text-[13px] font-bold transition-all duration-300 hover:scale-105 disabled:opacity-50"
                  style={{ border: '1px solid rgba(255,122,122,0.4)', color: '#FF8A8A', background: 'rgba(255,80,80,0.08)' }}
                >
                  <ThumbsDown className="w-4 h-4" /> Reject (R)
                </button>
              </>
            ) : item.status === 'approved' ? (
              <button
                onClick={() => setRejectOpen(!rejectOpen)}
                disabled={busy || locked}
                className="inline-flex items-center gap-2 h-11 px-6 rounded-full text-[13px] font-bold transition-all duration-300 hover:scale-105 disabled:opacity-50"
                style={{ border: '1px solid rgba(255,122,122,0.4)', color: '#FF8A8A', background: 'rgba(255,80,80,0.08)' }}
              >
                <Trash2 className="w-4 h-4" /> Take Down
              </button>
            ) : (
              <span className="text-[12px] font-bold" style={{ color: 'rgba(247,243,238,0.45)' }}>
                {item.reviewedAt ? `Actioned ${timeAgo(item.reviewedAt)} by ${item.reviewer ?? 'admin'}` : 'Waiting for undo window.'}
              </span>
            )}
            <span className="ml-auto text-[11px]" style={{ color: 'rgba(247,243,238,0.3)' }}>
              {position.index + 1} / {position.total} • keyboard: A R → ← Esc
            </span>
          </div>

          {/* reject reason picker */}
          {rejectOpen && (
            <div className="mx-5 md:mx-6 mb-5 rounded-2xl p-4"
              style={{ background: 'rgba(9,8,7,0.7)', border: '1px solid rgba(255,80,80,0.3)' }}
            >
              <label className="block text-[10.5px] font-bold uppercase tracking-[0.2em] mb-2" style={{ color: 'rgba(255,138,138,0.85)' }}>
                Choose a reason — stored internally
              </label>
              <div className="flex flex-wrap gap-2">
                {REJECT_REASONS.map((r) => (
                  <button
                    key={r}
                    onClick={() => setReasonSel(r)}
                    className="px-3 h-8 rounded-full text-[11px] font-bold transition-all duration-300"
                    style={{
                      fontFamily: 'Cairo, sans-serif',
                      color: reasonSel === r ? '#0d0906' : 'rgba(247,243,238,0.6)',
                      background: reasonSel === r ? 'linear-gradient(135deg, #ffb199, #ff6b6b)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${reasonSel === r ? 'transparent' : 'rgba(255,255,255,0.1)'}`,
                    }}
                  >
                    {r}
                  </button>
                ))}
              </div>
              {reasonSel === 'Other' && (
                <input
                  value={reasonFree}
                  onChange={(e) => setReasonFree(e.target.value)}
                  placeholder="Describe the reason…"
                  className="mt-3 w-full h-10 px-4 rounded-xl text-[13px] outline-none bg-transparent focus:ring-1 focus:ring-[#FF8A8A]/40"
                  style={{ border: '1px solid rgba(255,122,122,0.25)', color: '#F7F3EE' }}
                />
              )}
              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={() => setRejectOpen(false)}
                  className="h-9 px-4 rounded-full text-[12px] font-bold hover:bg-white/5"
                  style={{ border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(247,243,238,0.7)' }}
                >
                  Cancel
                </button>
                <button
                  onClick={submitReason}
                  disabled={!reasonSel && !reasonFree}
                  className="h-9 px-5 rounded-full text-[12px] font-black disabled:opacity-40"
                  style={{ color: '#0d0906', background: 'linear-gradient(135deg, #ff6b6b, #c0392b)', fontFamily: 'Cairo, sans-serif' }}
                >
                  Confirm {item.status === 'approved' ? 'Take Down' : 'Reject'}
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
}
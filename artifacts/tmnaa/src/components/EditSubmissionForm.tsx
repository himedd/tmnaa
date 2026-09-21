import { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UploadCloud, Check, X, Image as ImageIcon, Film, Loader2, Sparkles } from 'lucide-react';
import { compressImageFile } from '@/lib/submissionsStore';
import { probeVideoFile, shouldTranscode, transcodeVideo, captureVideoPoster } from '@/lib/videoNorm';
import { submitUpload, type WallItem } from '@/lib/wallApi';

const easeOut = [0.22, 1, 0.36, 1] as const;

interface Props {
  onSubmitted: () => void;
}

const uploadErrors: Record<string, string> = {
  storage_not_configured: 'Storage is not ready yet — try again in a moment.',
  storage_unavailable: 'We could not reach the storage right now. Please try again.',
  database_unavailable: 'We could not reach the wall database. Please try again.',
  too_many_uploads: 'You have submitted a lot recently. Wait a bit and try again.',
  queue_full: 'The wall is full right now — come back in a little while.',
  file_too_large: 'That file is too large. Videos up to 5GB, images up to 12MB.',
  image_too_large: 'That image is too large. Max 12MB.',
  unsupported_file: 'That file type is not supported. Use MP4, WEBM, JPG, PNG or GIF.',
  invalid_fields: 'Please check your name and caption.',
  missing_file: 'We could not find your file in storage. Please upload it again.',
  unauthorized: 'Your admin session expired — sign in again.',
  supabase_not_configured: 'The wall database is not configured yet on this server.',
};

export function EditSubmissionForm({ onSubmitted }: Props) {
  const [name, setName] = useState('');
  const [caption, setCaption] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [thumb, setThumb] = useState<string | null>(null);
  const [previewKind, setPreviewKind] = useState<'image' | 'video' | null>(null);
  const [processing, setProcessing] = useState(false);
  const [progressPct, setProgressPct] = useState<number | null>(null);
  const [mediaDims, setMediaDims] = useState<{ width: number; height: number } | null>(null);
  const [transcoded, setTranscoded] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<WallItem | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const processToken = useRef(0);

  const resetForm = () => {
    setName('');
    setCaption('');
    setFile(null);
    setThumb(null);
    setPreviewKind(null);
    setProgressPct(null);
    setMediaDims(null);
    setTranscoded(false);
    setError('');
    setProcessing(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const clearFile = () => {
    processToken.current++;
    setFile(null);
    setThumb(null);
    setPreviewKind(null);
    setProgressPct(null);
    setMediaDims(null);
    setTranscoded(false);
    setProcessing(false);
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFile = async (picked: File) => {
    setError('');
    const isImage = picked.type.startsWith('image/');
    const isVideo = picked.type.startsWith('video/');
    if (!isImage && !isVideo) {
      setError('Please choose an image or video file.');
      return;
    }
    const token = ++processToken.current;
    setProcessing(true);
    setProgressPct(null);
    setThumb(null);
    setMediaDims(null);
    setTranscoded(false);
    setFile(picked);
    setPreviewKind(isImage ? 'image' : 'video');

    try {
      if (isImage) {
        const result = await compressImageFile(picked);
        if (token !== processToken.current) return;
        setThumb(result.dataUrl);
        setMediaDims({ width: result.width, height: result.height });
        return;
      }

      // video: capture dims, normalise to H.264/AAC MP4 (≤1080p) when needed
      const meta = await probeVideoFile(picked);
      if (token !== processToken.current) return;
      setMediaDims({ width: meta.width, height: meta.height });

      let finalFile = picked;
      let finalDims = { width: meta.width, height: meta.height };
      let wasTranscoded = false;

      if (shouldTranscode(picked, meta)) {
        try {
          const result = await transcodeVideo(
            picked,
            meta,
            (pct) => {
              if (token === processToken.current) setProgressPct(pct);
            },
          );
          if (token !== processToken.current) return;
          finalFile = new File([result.blob], picked.name.replace(/\.[^.]+$/, '') + '.mp4', {
            type: 'video/mp4',
          });
          finalDims = { width: result.width, height: result.height };
          wasTranscoded = true;
        } catch {
          if (token !== processToken.current) return;
          finalFile = picked;
          wasTranscoded = false;
        }
      }

      if (token !== processToken.current) return;
      setFile(finalFile);
      setMediaDims(finalDims);
      setTranscoded(wasTranscoded);

      // poster frame ~2s in (best effort)
      try {
        const poster = await captureVideoPoster(finalFile, wasTranscoded ? 640 : 640);
        if (token === processToken.current) setThumb(poster);
      } catch {
        if (token === processToken.current) setThumb(null);
      }
    } catch {
      if (token !== processToken.current) return;
      setFile(picked);
      setThumb(null);
      setError('We could not read that file. Try another one.');
    } finally {
      if (token === processToken.current) setProcessing(false);
    }
  };

  const displayError = (code: unknown) => {
    const c = String(code ?? 'unknown');
    setError(uploadErrors[c] || (c === 'upload_failed' ? 'Something went wrong uploading. Please try again.' : 'Something went wrong. Please try again.'));
  };

  const handleSubmit = async () => {
    setError('');
    if (!name.trim()) {
      setError('Please add your name or username.');
      return;
    }

    if (!file) {
      setError('Choose a file to upload.');
      return;
    }
    if (!thumb && previewKind === 'image') {
      setError('Still processing your image, one moment.');
      return;
    }
    setSubmitting(true);
    try {
      const item = await submitUpload({
        file,
        name,
        caption,
        poster: thumb || undefined,
        width: mediaDims?.width,
        height: mediaDims?.height,
        transcoded,
      });
      setSuccess(item);
      onSubmitted();
      resetForm();
    } catch (e) {
      displayError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: easeOut }}
        className="relative rounded-[32px] overflow-hidden p-8 md:p-12 text-center"
        style={{
          background: 'linear-gradient(160deg, rgba(26,18,13,0.95), rgba(16,11,8,0.92))',
          border: '1.5px solid transparent',
          backgroundImage:
            'linear-gradient(160deg, rgba(26,18,13,0.95), rgba(16,11,8,0.92)), linear-gradient(135deg, rgba(217,164,65,0.45), rgba(255,122,24,0.2), rgba(217,164,65,0.45))',
          backgroundOrigin: 'border-box',
          backgroundClip: 'padding-box, border-box',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 60px rgba(255,122,24,0.08)',
        }}
      >
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[420px] h-[240px] pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(255,122,24,0.16) 0%, transparent 65%)', filter: 'blur(20px)' }}
        />
        <motion.div
          initial={{ scale: 0, rotate: -30 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 16, delay: 0.1 }}
          className="relative mx-auto mb-5 w-20 h-20 rounded-full flex items-center justify-center"
          style={{
            background: 'radial-gradient(circle, rgba(255,122,24,0.28) 0%, rgba(18,12,10,0.95) 65%)',
            border: '2px solid rgba(217,164,65,0.7)',
            boxShadow: '0 0 30px rgba(255,122,24,0.35), 0 0 60px rgba(217,164,65,0.15)',
          }}
        >
          <Check className="w-9 h-9 text-[#D9A441]" strokeWidth={2.6} />
        </motion.div>
        <h3 className="relative text-2xl md:text-3xl font-black tracking-tight" style={{ fontFamily: 'Cairo, sans-serif', color: '#F7F3EE' }}>
          Edit Submitted
        </h3>
        <p className="relative mt-2 text-sm md:text-base" style={{ color: 'rgba(247,243,238,0.5)' }}>
          Thanks <span style={{ color: '#D9A441' }}>{success.name}</span> — تم رفع الفيديو للادمن.
        </p>
        <p className="relative mt-1 text-sm md:text-base" style={{ color: 'rgba(247,243,238,0.55)' }}>
          Your edit will appear on the wall once approved. 🔥
        </p>
        <button
          onClick={() => setSuccess(null)}
          className="premium-btn group/sb relative mt-7 px-8 h-[52px] rounded-full"
          style={{
            background: 'linear-gradient(135deg, rgba(26,18,13,0.9), rgba(45,27,20,0.85))',
            border: '1.5px solid transparent',
            backgroundImage:
              'linear-gradient(rgba(26,18,13,0.9), rgba(45,27,20,0.85)), linear-gradient(135deg, rgba(217,164,65,0.5), rgba(255,122,24,0.25), rgba(217,164,65,0.5))',
            backgroundOrigin: 'border-box',
            backgroundClip: 'padding-box, border-box',
            boxShadow: '0 0 25px rgba(217,164,65,0.1), inset 0 1px 0 rgba(217,164,65,0.08)',
          }}
        >
          <span className="relative z-10 font-bold tracking-wider transition-colors duration-400 group-hover/sb:text-[#FF7A18]" style={{ fontFamily: 'Cairo, sans-serif', color: '#D9A441' }}>
            Submit Another
          </span>
        </button>
      </motion.div>
    );
  }

  return (
    <div
      className="relative rounded-[32px] overflow-hidden p-6 md:p-8"
      style={{
        background: 'linear-gradient(160deg, rgba(26,18,13,0.95), rgba(16,11,8,0.92))',
        border: '1.5px solid transparent',
        backgroundImage:
          'linear-gradient(160deg, rgba(26,18,13,0.95), rgba(16,11,8,0.92)), linear-gradient(135deg, rgba(217,164,65,0.4), rgba(255,122,24,0.15), rgba(217,164,65,0.4))',
        backgroundOrigin: 'border-box',
        backgroundClip: 'padding-box, border-box',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(217,164,65,0.06)',
      }}
    >
      <div className="absolute -top-20 right-0 w-72 h-72 pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(255,122,24,0.1) 0%, transparent 65%)', filter: 'blur(30px)' }}
      />

      <div className="relative flex items-center gap-3 mb-6">
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center"
          style={{ background: 'rgba(217,164,65,0.08)', border: '1px solid rgba(217,164,65,0.25)' }}
        >
          <Sparkles className="w-5 h-5 text-[#D9A441]" />
        </div>
        <div>
          <h3 className="text-lg md:text-xl font-black tracking-tight" style={{ fontFamily: 'Cairo, sans-serif', color: '#F7F3EE' }}>
            Submit Your Edit
          </h3>
          <p className="text-[12px]" style={{ color: 'rgba(247,243,238,0.4)' }}>
            Upload a clip or drop a direct video file.
          </p>
        </div>
      </div>

      <div className="relative space-y-5">
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-[0.2em] mb-2" style={{ color: 'rgba(217,164,65,0.7)' }}>
            Name / Username
          </label>
          <input
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. tmnaa_fan"
            className="w-full h-[50px] px-4 rounded-2xl text-[14px] outline-none transition-all duration-300 focus:ring-1 focus:ring-[#D9A441]/40 placeholder:text-[rgba(247,243,238,0.2)]"
            style={{
              background: 'rgba(9,8,7,0.7)',
              border: '1px solid rgba(217,164,65,0.16)',
              color: '#F7F3EE',
              fontFamily: 'Tajawal, sans-serif',
              boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.3)',
            }}
          />
        </div>

        <div>
          <label className="block text-[11px] font-bold uppercase tracking-[0.2em] mb-2" style={{ color: 'rgba(217,164,65,0.7)' }}>
            Your Edit
          </label>
          {!file ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const dropped = e.dataTransfer.files?.[0];
                if (dropped) handleFile(dropped);
              }}
              className="w-full rounded-2xl flex flex-col items-center justify-center gap-3 py-10 px-6 transition-all duration-300"
              style={{
                background: dragOver ? 'rgba(217,164,65,0.08)' : 'rgba(9,8,7,0.5)',
                border: `1.5px dashed ${dragOver ? 'rgba(217,164,65,0.6)' : 'rgba(217,164,65,0.25)'}`,
                boxShadow: dragOver ? '0 0 30px rgba(255,122,24,0.15)' : 'none',
              }}
            >
              <div className="w-14 h-14 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(217,164,65,0.08)', border: '1px solid rgba(217,164,65,0.25)' }}
              >
                <UploadCloud className="w-6 h-6 text-[#D9A441]" />
              </div>
              <span className="text-sm font-bold" style={{ color: 'rgba(247,243,238,0.7)' }}>
                Drag & drop or <span style={{ color: '#D9A441' }}>browse</span>
              </span>
              <span className="text-[11px]" style={{ color: 'rgba(247,243,238,0.3)' }}>
                Images or videos — MP4, WEBM, JPG, PNG · videos up to 5GB
              </span>
            </button>
          ) : (
            <div
              className="relative rounded-2xl overflow-hidden flex items-center gap-4 p-3"
              style={{ background: 'rgba(9,8,7,0.5)', border: '1px solid rgba(217,164,65,0.2)' }}
            >
              <div className="relative w-24 aspect-video rounded-xl overflow-hidden shrink-0 bg-black/60 flex items-center justify-center"
                style={{ border: '1px solid rgba(217,164,65,0.15)' }}
              >
                {thumb ? (
                  <img src={thumb} alt="preview" className="w-full h-full object-cover" />
                ) : processing ? (
                  <Loader2 className="w-5 h-5 text-[#D9A441] animate-spin" />
                ) : previewKind === 'video' ? (
                  <Film className="w-5 h-5 text-[#D9A441]" />
                ) : (
                  <ImageIcon className="w-5 h-5 text-[#D9A441]" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-bold truncate" style={{ color: '#F7F3EE' }}>{file.name}</p>
                <p className="text-[11px] mt-0.5" style={{ color: 'rgba(247,243,238,0.35)' }}>
                  {previewKind === 'video' ? 'Video' : 'Image'} • {(file.size / (1024 * 1024)).toFixed(1)} MB
                  {processing
                    ? progressPct != null
                      ? ` • normalising… ${progressPct}%`
                      : ' • normalising…'
                    : transcoded
                      ? ' • normalised (1080p max)'
                      : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={clearFile}
                className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-colors duration-300 hover:bg-white/10"
                style={{ border: '1px solid rgba(217,164,65,0.2)' }}
                aria-label="Remove file"
              >
                <X className="w-4 h-4 text-white/60" />
              </button>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={(e) => {
              const picked = e.target.files?.[0];
              if (picked) handleFile(picked);
            }}
          />
        </div>

        <div>
          <label className="block text-[11px] font-bold uppercase tracking-[0.2em] mb-2" style={{ color: 'rgba(217,164,65,0.7)' }}>
            Caption <span style={{ color: 'rgba(247,243,238,0.25)' }}>(optional)</span>
          </label>
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={3}
            maxLength={180}
            placeholder="Say something about your edit..."
            className="w-full px-4 py-3 rounded-2xl text-[14px] outline-none resize-none transition-all duration-300 focus:ring-1 focus:ring-[#D9A441]/40 placeholder:text-[rgba(247,243,238,0.2)]"
            style={{
              background: 'rgba(9,8,7,0.7)',
              border: '1px solid rgba(217,164,65,0.16)',
              color: '#F7F3EE',
              fontFamily: 'Tajawal, sans-serif',
              boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.3)',
            }}
          />
        </div>

        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-[12.5px] font-medium"
              style={{ color: '#E8A87C' }}
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        <motion.button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          whileHover={{ scale: 1.02, y: -2 }}
          whileTap={{ scale: 0.97 }}
          className="premium-btn group/sub relative w-full h-[58px] rounded-full disabled:opacity-60"
          style={{
            background: 'linear-gradient(135deg, rgba(26,18,13,0.9), rgba(45,27,20,0.85))',
            border: '1.5px solid transparent',
            backgroundImage:
              'linear-gradient(rgba(26,18,13,0.9), rgba(45,27,20,0.85)), linear-gradient(135deg, rgba(217,164,65,0.55), rgba(255,122,24,0.3), rgba(217,164,65,0.55))',
            backgroundOrigin: 'border-box',
            backgroundClip: 'padding-box, border-box',
            boxShadow: '0 0 25px rgba(217,164,65,0.12), 0 8px 25px rgba(0,0,0,0.4), inset 0 1px 0 rgba(217,164,65,0.08)',
          }}
        >
          <span className="relative z-10 flex items-center gap-2 font-bold text-lg tracking-wider transition-colors duration-400 group-hover/sub:text-[#FF7A18]" style={{ fontFamily: 'Cairo, sans-serif', color: '#D9A441' }}>
            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <UploadCloud className="w-5 h-5" />}
            {submitting ? 'Submitting…' : 'Submit Edit'}
          </span>
        </motion.button>
      </div>
    </div>
  );
}
// Client-side video normalisation via ffmpeg.wasm.
// Normalises uploads to H.264/AAC MP4 (capped at 1080p) for reliable playback
// everywhere, with graceful fallback to the original file when transcoding fails.

export interface VideoMeta {
  width: number;
  height: number;
  duration: number;
}

export const MAX_DIM = 1080;

export function probeVideoFile(file: File): Promise<VideoMeta> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      const w = video.videoWidth;
      const h = video.videoHeight;
      const d = video.duration;
      URL.revokeObjectURL(url);
      if (!w || !h) reject(new Error('Could not read video'));
      else resolve({ width: w, height: h, duration: Number.isFinite(d) ? d : 0 });
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read video'));
    };
    video.src = url;
    video.load();
  });
}

export function canPlayCompatibly(): boolean {
  try {
    const v = document.createElement('video');
    return v.canPlayType('video/mp4; codecs="avc1.42E01E, mp4a.40.2"') === 'probably';
  } catch {
    return false;
  }
}

export function shouldTranscode(file: File, meta: VideoMeta): boolean {
  if (file.type !== 'video/mp4') return true;
  if (meta.width > MAX_DIM || meta.height > MAX_DIM) return true;
  return !canPlayCompatibly();
}

export interface TranscodeResult {
  blob: Blob;
  width: number;
  height: number;
}

let corePromise: Promise<unknown> | null = null;

function coreBase(): string {
  const base = import.meta.env.BASE_URL || '/';
  return `${base.replace(/\/$/, '')}/ffmpeg`;
}

function loadCore(): Promise<unknown> {
  if (!corePromise) {
    corePromise = (async () => {
      const { FFmpeg } = await import('@ffmpeg/ffmpeg');
      const { toBlobURL } = await import('@ffmpeg/util');
      const base = coreBase();
      const ffmpeg = new FFmpeg();
      await ffmpeg.load({
        coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, 'application/wasm'),
      });
      return ffmpeg;
    })();
  }
  return corePromise;
}

/** Transcode to H.264/AAC MP4, capped at 1080p. Throws on failure/timeout. */
export async function transcodeVideo(
  file: File,
  meta: VideoMeta,
  onProgress?: (pct: number) => void,
  timeoutMs = 240000,
): Promise<TranscodeResult> {
  let ffmpeg: any = null;
  try {
    ffmpeg = await loadCore();
    const { fetchFile } = await import('@ffmpeg/util');

    const inputName = 'in.mp4';
    const outputName = 'out.mp4';

    await ffmpeg.writeFile(inputName, await fetchFile(file));

    const result = await new Promise<TranscodeResult>((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        void ffmpeg.terminate();
        reject(new Error('transcode_timeout'));
      }, timeoutMs);

      ffmpeg.on('progress', (e: { progress: number }) => {
        if (!settled && onProgress) onProgress(Math.round(e.progress * 100));
      });

      ffmpeg
        .exec(argsFor(meta))
        .then(async (code: unknown) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          if (Number(code ?? 0) !== 0) {
            reject(new Error('transcode_failed'));
            return;
          }
          const data: Uint8Array = await ffmpeg.readFile(outputName);
          const blob = new Blob([data.buffer as ArrayBuffer], { type: 'video/mp4' });
          const ratio = meta.width / Math.max(1, meta.height);
          const scale = Math.min(1, MAX_DIM / Math.max(meta.width, meta.height));
          resolve({
            blob,
            width: Math.round(meta.width * scale),
            height: Math.round(meta.height * scale),
          });
        })
        .catch((err: unknown) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          reject(err instanceof Error ? err : new Error('transcode_failed'));
        });
    });

    void ffmpeg.terminate();
    return result;
  } catch (err) {
    // Core may be in a bad state after a failure — force a fresh load next time.
    corePromise = null;
    if (err instanceof Error && (err.message === 'transcode_timeout' || err.message === 'transcode_failed')) {
      throw err;
    }
    throw err instanceof Error ? err : new Error('transcode_failed');
  }
}

function argsFor(meta: VideoMeta): string[] {
  const max = MAX_DIM;
  const needScale = meta.width > max || meta.height > max;
  const scaleArgs: string[] = [];
  if (needScale) {
    scaleArgs.push('-vf', `scale='if(gt(iw,${max}),${max},iw)':-2`);
  }
  return [
    '-i', 'in.mp4',
    '-map', '0:v:0',
    '-map', '0:a:0?',
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '23',
    ...scaleArgs,
    '-c:a', 'aac',
    '-b:a', '128k',
    '-movflags', '+faststart',
    '-f', 'mp4',
    'out.mp4',
  ];
}

/** Poster frame ~2s in, preserving the real aspect ratio (max 640 wide). */
export function captureVideoPoster(file: File, maxW = 640): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';
    const cleanup = () => URL.revokeObjectURL(url);

    video.onloadedmetadata = () => {
      const d = video.duration || 0;
      const t = d >= 4 ? 2 : d > 0 ? d * 0.5 : 1;
      video.currentTime = t;
    };
    video.onseeked = () => {
      try {
        const w = video.videoWidth || 16;
        const h = video.videoHeight || 9;
        const scale = Math.min(1, maxW / Math.max(w, h));
        const cw = Math.max(1, Math.round(w * scale));
        const ch = Math.max(1, Math.round(h * scale));
        const canvas = document.createElement('canvas');
        canvas.width = cw;
        canvas.height = ch;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          cleanup();
          reject(new Error('Could not capture frame'));
          return;
        }
        ctx.drawImage(video, 0, 0, cw, ch);
        cleanup();
        resolve(canvas.toDataURL('image/jpeg', 0.62));
      } catch {
        cleanup();
        reject(new Error('Could not capture frame'));
      }
    };
    video.onerror = () => {
      cleanup();
      reject(new Error('Could not read video'));
    };
    video.src = url;
    video.load();
  });
}
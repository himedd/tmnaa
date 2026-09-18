export type SubmissionMediaType = 'image' | 'video' | 'link';
export type SubmissionKind = 'upload' | 'link';

export interface EditSubmission {
  id: string;
  name: string;
  caption?: string;
  kind: SubmissionKind;
  mediaType: SubmissionMediaType;
  thumb?: string;
  url?: string;
  videoSrc?: string;
  createdAt: number;
  approved: boolean;
  likes: number;
}

const STORAGE_KEY = 'tmnaa_300k_submissions_v1';

const sessionVideos = new Map<string, string>();

function makeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `s_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

const seedSubmissions: EditSubmission[] = [
  {
    id: makeId(),
    name: 'YARAII',
    caption: '300K — the dragon only grows stronger.',
    kind: 'upload',
    mediaType: 'image',
    thumb: '/bg-dragon.jpeg',
    createdAt: Date.now() - 1000 * 60 * 60 * 26,
    approved: true,
    likes: 428,
  },
  {
    id: makeId(),
    name: 'uRaseel',
    caption: 'Forged in embers and fire.',
    kind: 'upload',
    mediaType: 'image',
    thumb: '/assets/Dragon_in_dark_volcanic_landscape_202607280213.jpeg',
    createdAt: Date.now() - 1000 * 60 * 60 * 22,
    approved: true,
    likes: 371,
  },
  {
    id: makeId(),
    name: 'Ilinay',
    caption: 'The beacon that lights the way to 300K.',
    kind: 'upload',
    mediaType: 'image',
    thumb: '/assets/og-banner.jpeg',
    createdAt: Date.now() - 1000 * 60 * 60 * 18,
    approved: true,
    likes: 264,
  },
  {
    id: makeId(),
    name: 'Thamer',
    caption: 'Everyone in the fire together.',
    kind: 'upload',
    mediaType: 'image',
    thumb: '/assets/tmnaa-logo.png',
    createdAt: Date.now() - 1000 * 60 * 60 * 14,
    approved: true,
    likes: 198,
  },
  {
    id: makeId(),
    name: 'Rawabi',
    caption: 'From the first stream to three hundred thousand.',
    kind: 'upload',
    mediaType: 'image',
    thumb: '/assets/IMG_3191.webp',
    createdAt: Date.now() - 1000 * 60 * 60 * 8,
    approved: true,
    likes: 152,
  },
  {
    id: makeId(),
    name: 'ILOJAIN',
    caption: 'Rise with fire — 300K celebration.',
    kind: 'upload',
    mediaType: 'image',
    thumb: '/assets/IMG_3192.webp',
    createdAt: Date.now() - 1000 * 60 * 60 * 3,
    approved: true,
    likes: 97,
  },
];

export function loadSubmissions(): EditSubmission[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seeds = [...seedSubmissions];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seeds));
      return seeds;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...seedSubmissions];
    return parsed as EditSubmission[];
  } catch {
    return [...seedSubmissions];
  }
}

function persist(list: EditSubmission[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // Storage full — keep submissions for the session only.
  }
}

export function registerVideoSrc(id: string, src: string) {
  sessionVideos.set(id, src);
}

export function getRegisteredVideoSrc(id: string): string | undefined {
  return sessionVideos.get(id);
}

export function resolveSrc(sub: EditSubmission): string | undefined {
  return sub.videoSrc || getRegisteredVideoSrc(sub.id);
}

export interface AddSubmissionInput {
  name: string;
  caption?: string;
  kind: SubmissionKind;
  mediaType: SubmissionMediaType;
  thumb?: string;
  url?: string;
  videoBlob?: Blob;
}

export function addSubmission(input: AddSubmissionInput): EditSubmission {
  const sub: EditSubmission = {
    id: makeId(),
    name: input.name.trim(),
    caption: input.caption?.trim() || undefined,
    kind: input.kind,
    mediaType: input.mediaType,
    thumb: input.thumb,
    url: input.url,
    createdAt: Date.now(),
    approved: true,
    likes: 0,
  };

  if (input.videoBlob) {
    const objectUrl = URL.createObjectURL(input.videoBlob);
    registerVideoSrc(sub.id, objectUrl);
    sub.videoSrc = objectUrl;
  }

  const list = loadSubmissions();
  list.unshift(sub);
  persist(list);
  return sub;
}

export function compressImageFile(file: File, maxDim = 1600, quality = 0.72): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('Could not process image'));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read image'));
    };
    img.src = url;
  });
}

export function videoToPoster(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';
    const cleanup = () => URL.revokeObjectURL(url);
    video.onloadedmetadata = () => {
      video.currentTime = Math.min(0.5, (video.duration || 1) * 0.25);
    };
    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 360;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          cleanup();
          reject(new Error('Could not capture frame'));
          return;
        }
        ctx.drawImage(video, 0, 0, 640, 360);
        cleanup();
        resolve(canvas.toDataURL('image/jpeg', 0.6));
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

export function isValidHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}
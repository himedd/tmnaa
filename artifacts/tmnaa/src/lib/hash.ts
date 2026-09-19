export async function sha256Buffer(buf: ArrayBuffer): Promise<string> {
  const hash = await globalThis.crypto.subtle.digest('SHA-256', buf as BufferSource);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function sha256File(blob: Blob): Promise<string> {
  return sha256Buffer(await blob.arrayBuffer());
}

export async function sha256Text(text: string): Promise<string> {
  return sha256Buffer(new TextEncoder().encode(text).buffer);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image_load_failed'));
    img.src = src;
  });
}

/** 64-bit dHash hex fingerprint of an image (data URL). Returns null on failure. */
export async function dhashFromDataUrl(dataUrl: string, size = 8): Promise<string | null> {
  try {
    const img = await loadImage(dataUrl);
    const s = size + 1;
    const canvas = document.createElement('canvas');
    canvas.width = s;
    canvas.height = s;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, s, s);
    const data = ctx.getImageData(0, 0, s, s).data;
    const gray = new Array<number>(s * s);
    for (let i = 0; i < data.length; i += 4) {
      gray[i / 4] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }
    let bits = '';
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        bits += gray[y * s + x] >= gray[y * s + x + 1] ? '1' : '0';
      }
    }
    let hex = '';
    for (let i = 0; i < bits.length; i += 4) {
      hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
    }
    return hex;
  } catch {
    return null;
  }
}

function hexToBits(hex: string): string {
  let bits = '';
  for (const ch of hex) {
    const v = parseInt(ch, 16);
    if (!Number.isFinite(v)) continue;
    bits += ((v >> 3) & 1).toString() + ((v >> 2) & 1).toString() + ((v >> 1) & 1).toString() + (v & 1).toString();
  }
  return bits;
}

/** Hamming distance between two hex bitstrings (used for near-duplicate images). */
export function hamming(a: string, b: string): number {
  const ab = hexToBits(a);
  const bb = hexToBits(b);
  let d = 0;
  const len = Math.max(ab.length, bb.length);
  for (let i = 0; i < len; i++) {
    if ((ab[i] ?? '0') !== (bb[i] ?? '0')) d++;
  }
  return d;
}
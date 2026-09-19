import type { WallItem } from './wallApi';
import { hamming } from './hash';

export const REJECT_REASONS = [
  'Inappropriate / Offensive',
  'Spam or Duplicate',
  'Low Quality',
  'Unrelated to Milestone',
  'Copyright Concern',
  'Other',
] as const;

export const REPORT_REASONS = [
  'Inappropriate',
  'Spam',
  'Offensive',
  'Copyright Concern',
  'Other',
] as const;

export const NEAR_DUP_HAMMING = 6;
export const FREQ_SUBMITTER_MIN = 3;

export interface BadgeInfo {
  dupOf: string | null;
  dupOfName: string | null;
  dupKind: 'exact' | 'near' | null;
  frequentSubmitter: boolean;
  submissionsByDevice: number;
}

export type BadgeMap = Map<string, BadgeInfo>;

function blank(): BadgeInfo {
  return { dupOf: null, dupOfName: null, dupKind: null, frequentSubmitter: false, submissionsByDevice: 0 };
}

/**
 * Decorates every submission with duplicate / frequent-submitter flags.
 * Exact dup: identical file_hash (non-empty). Near dup: image phash within
 * hamming distance. Building on the oldest item in each group as "original".
 */
export function decorateItems(items: WallItem[]): BadgeMap {
  const map: BadgeMap = new Map();
  for (const it of items) map.set(it.id, blank());

  const list = [...items].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  // exact duplicates by file_hash
  const hashGroups = new Map<string, WallItem[]>();
  for (const it of list) {
    const h = (it.fileHash ?? '').trim().toLowerCase();
    if (!h || h.length < 16) continue;
    const g = hashGroups.get(h) ?? [];
    g.push(it);
    hashGroups.set(h, g);
  }
  for (const g of hashGroups.values()) {
    if (g.length < 2) continue;
    const orig = g[0];
    for (let i = 1; i < g.length; i++) {
      const info = map.get(g[i].id) ?? blank();
      info.dupOf = orig.id;
      info.dupOfName = orig.name;
      info.dupKind = 'exact';
      map.set(g[i].id, info);
    }
  }

  // near duplicates by phash (images only, cheap quadratic on small lists)
  const phashItems = items.filter((it) => /^[0-9a-f]{16,64}$/i.test(it.phash ?? ''));
  for (let i = 0; i < phashItems.length; i++) {
    const a = phashItems[i];
    for (let j = i + 1; j < phashItems.length; j++) {
      const b = phashItems[j];
      if (hamming(a.phash as string, b.phash as string) <= NEAR_DUP_HAMMING) {
        const later = new Date(a.createdAt).getTime() >= new Date(b.createdAt).getTime() ? a : b;
        const orig = later === a ? b : a;
        const info = map.get(later.id) ?? blank();
        if (!info.dupOf) {
          info.dupOf = orig.id;
          info.dupOfName = orig.name;
          info.dupKind = 'near';
          map.set(later.id, info);
        }
      }
    }
  }

  // frequent submitter: same device, >=3 submissions (any status)
  const deviceGroups = new Map<string, WallItem[]>();
  for (const it of items) {
    const d = (it.deviceId ?? '').trim();
    if (!d) continue;
    const g = deviceGroups.get(d) ?? [];
    g.push(it);
    deviceGroups.set(d, g);
  }
  for (const g of deviceGroups.values()) {
    if (g.length < FREQ_SUBMITTER_MIN) continue;
    for (const it of g) {
      const info = map.get(it.id) ?? blank();
      info.frequentSubmitter = true;
      info.submissionsByDevice = g.length;
      map.set(it.id, info);
    }
  }

  return map;
}

export function isReviewLocked(item: WallItem, me: string, now = Date.now()): boolean {
  return Boolean(
    item.reviewingBy &&
      String(item.reviewingBy) !== me &&
      item.reviewingAt &&
      now - new Date(item.reviewingAt).getTime() < 120_000,
  );
}

export function fmtDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}
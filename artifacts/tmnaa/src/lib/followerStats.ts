/**
 * Client-side mirror of the api-server's follower-stats math (see
 * artifacts/api-server/src/lib/statMath.ts). Used by the temporary 300K
 * countdown section to compute the growth/ETA/peak stats locally from its own
 * poll history when the SSE server is unreachable, so the panel stays alive
 * and honest even in fallback mode.
 *
 * TEMPORARY: delete with the <FollowerCountdownSection /> component.
 */

export interface Sample {
  t: number;
  c: number;
}

export interface PeakSurge {
  max: number;
  atTs: number | null;
}

export interface FollowerStats {
  todayGained: number | null;
  growthPerHour: number | null;
  etaHours: number | null;
  peak: PeakSurge | null;
  launchCount: number | null;
}

const MINUTE = 60_000;
const GROWTH_WINDOW_MS = 5 * MINUTE;
const MIN_HISTORY_MS = 4 * MINUTE;

export function startOfToday(now: number): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function dayBaseline(samples: Sample[], now: number): { t: number; c: number } | null {
  const start = startOfToday(now);
  for (const s of samples) {
    if (s.t >= start) return { t: s.t, c: s.c };
  }
  return null;
}

function newestBefore(samples: Sample[], cut: number): Sample | null {
  for (let i = samples.length - 1; i >= 0; i--) {
    if (samples[i].t <= cut) return samples[i];
  }
  return null;
}

function growthPerHour(samples: Sample[], now: number): number | null {
  const cur = samples.length ? samples[samples.length - 1] : null;
  if (!cur) return null;
  const older = newestBefore(samples, now - GROWTH_WINDOW_MS);
  if (!older) return null;
  const span = now - older.t;
  if (span < MIN_HISTORY_MS) return null;
  const gained = Math.max(0, cur.c - older.c);
  return gained / (span / 3_600_000);
}

function peakSurge(samples: Sample[], dayStart: number): PeakSurge | null {
  const buckets = new Map<number, number>();
  for (const s of samples) {
    if (s.t < dayStart) continue;
    buckets.set(Math.floor(s.t / MINUTE), s.c);
  }
  const mins = [...buckets.keys()].sort((a, b) => a - b);
  let best: PeakSurge | null = null;
  for (let i = 1; i < mins.length; i++) {
    const delta = (buckets.get(mins[i]) ?? 0) - (buckets.get(mins[i - 1]) ?? 0);
    if (delta > 0 && (best === null || delta > best.max)) {
      best = { max: delta, atTs: (mins[i] + 1) * MINUTE };
    }
  }
  return best;
}

export function computeFollowerStats(
  samples: Sample[],
  now: number,
  target: number,
  currentCount: number | null,
  launchCount: number | null,
): FollowerStats {
  const baseline = dayBaseline(samples, now);

  const growth = growthPerHour(samples, now);

  let todayGained: number | null = null;
  if (baseline && currentCount !== null) {
    todayGained = Math.max(0, currentCount - baseline.c);
  }

  let etaHours: number | null = null;
  if (growth !== null && currentCount !== null && currentCount < target && growth > 0) {
    etaHours = (target - currentCount) / growth;
  }

  return {
    todayGained,
    growthPerHour: growth,
    etaHours,
    peak: baseline ? peakSurge(samples, baseline.t) : null,
    launchCount,
  };
}

/* ---------- display formatters (pure, locale-aware) ---------- */

const commaFmt = new Intl.NumberFormat('en-US');

export function fmtInt(n: number): string {
  return commaFmt.format(Math.round(n));
}

/** 97.7864 -> "97.79%", with 0/negative guarded. */
export function fmtPercent(n: number): string {
  const safe = Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0;
  return `${safe.toFixed(2)}%`;
}

/** "≈ 84/hr" style growth. */
export function fmtPerHour(n: number | null): string | null {
  if (n === null || !Number.isFinite(n)) return null;
  return `≈ ${Math.round(n).toLocaleString('en-US')}/hr`;
}

/** etaHours (a fractional number of hours) -> "≈ 3h 20m" / "≈ 1d 4h" / "≈ 54m". */
export function fmtEta(hours: number | null): string | null {
  if (hours === null || !Number.isFinite(hours) || hours <= 0) return null;
  const totalMin = Math.max(1, Math.round(hours * 60));
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0 || d === 0) parts.push(`${h}h`);
  if (d === 0 && m > 0) parts.push(`${m}m`);
  const label = parts.length ? parts.join(' ') : '1m';
  return `≈ ${label}`;
}

export function fmtClock(ts: number | null): string | null {
  if (ts === null || !Number.isFinite(ts)) return null;
  return new Date(ts).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function fmtSigned(n: number): string {
  return `+${commaFmt.format(Math.round(n))}`;
}
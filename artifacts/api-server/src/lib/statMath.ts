/**
 * Pure math for the temporary "300K countdown" stats panel.
 *
 * All six campaign stats derive from a time-series of follower-count samples
 * (Kick exposes only the *current* count, so every stat is computed from the
 * rolling history the server collects). Everything here is side-effect free so
 * it can live server-side (authoritative, on a 1-minute cadence) and
 * client-side (fallback polling when the SSE server is unreachable).
 *
 * TEMPORARY: delete with the 300K section and the follower-count routes.
 */

export interface Sample {
  /** epoch ms of the poll */
  t: number;
  /** follower count observed at that poll */
  c: number;
}

export interface PeakSurge {
  /** most followers gained inside any 1-minute bucket today */
  max: number;
  /** epoch ms of the minute that bucket ended */
  atTs: number | null;
}

export interface FollowerStats {
  /** new followers since the start of the current local day */
  todayGained: number | null;
  /** avg followers/hour over the trailing 5-minute window, or null pre-data */
  growthPerHour: number | null;
  /** hours remaining at current pace, or null when growth is 0/unknown */
  etaHours: number | null;
  /** biggest 1-minute surge so far today */
  peak: PeakSurge | null;
  /** count recorded once when the campaign went live (for since-launch) */
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

/**
 * The first sample of the current local day. If the server was already
 * polling before midnight this lands on the midnight count; if it booted
 * mid-day (no midnight sample available) it is the boot sample instead,
 * which gives "followers since stream/server start today" — the fallback the
 * campaign spec allows.
 */
export function dayBaseline(
  samples: Sample[],
  now: number,
): { t: number; c: number } | null {
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
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { logger } from "./logger";
import {
  computeFollowerStats,
  type FollowerStats,
  type Sample,
} from "./statMath";

/**
 * Real-time follower counter for the temporary "300K countdown" homepage
 * section.
 *
 * Source of truth: Kick's public channel API (`followers_count`, returned as a
 * numeric string). Kick exposes no public "follow" webhook, so the server
 * polls the API on a short interval and fans the updated count out to every
 * connected SSE client the moment it changes.
 *
 * On top of the live counter this module maintains the 6-stat panel data:
 * a rolling history of poll samples backs the growth rate / ETA / peak-surge
 * stats, which are recalculated together on a fixed 1-minute cadence (stats
 * #2 #3 #5 per the campaign spec). The cheap derived stats (#4 completion
 * percent, #6 since-launch) are computed client-side from the broadcast
 * `launchCount` + `followers`, so they update on every tick for free.
 *
 * TEMPORARY: exists only for the 300K celebration event. Delete this file,
 * the follower-count routes, and the <FollowerCountdownSection /> component
 * when it's over.
 */

const CHANNEL_ENDPOINT =
  process.env["FOLLOWER_ENDPOINT"] ||
  "https://kick.com/api/v2/channels/tmnaa";

const POLL_INTERVAL_MS = Number(process.env["FOLLOWER_POLL_MS"] || "3000");
const STATS_INTERVAL_MS = Number(process.env["FOLLOWER_STATS_MS"] || "60000");
/** keep ~2 days of samples in memory; each poll is ~11 bytes */
const MAX_SAMPLE_AGE_MS = 2 * 24 * 60 * 60_000;

/**
 * Optional override for demoing/testing the celebration moment before the real
 * 300K is reached, e.g. `FOLLOWER_OVERRIDE=300000`. When set, the reported
 * count is this exact value instead of the live Kick value.
 */
const OVERRIDE = process.env["FOLLOWER_OVERRIDE"];

const STATE_PATH = join(
  process.cwd(),
  ".data",
  "follower-state.json",
);

export const FOLLOWER_TARGET = 300000;

export interface FollowerPayload {
  followers: number | null;
  target: number;
  updatedAt: string;
  stats: FollowerStats;
}

type Listener = (payload: FollowerPayload) => void;

let currentCount: number | null = null;
let lastEmittedCount: number | null = null;
let launchCount: number | null = null;
let statsCache: FollowerStats = emptyStats();
const samples: Sample[] = [];
const listeners = new Set<Listener>();
let statsTimer: NodeJS.Timeout | null = null;
let statsInitialized = false;

function emptyStats(): FollowerStats {
  return {
    todayGained: null,
    growthPerHour: null,
    etaHours: null,
    peak: null,
    launchCount: null,
  };
}

function getPayload(): FollowerPayload {
  return {
    followers: currentCount,
    target: FOLLOWER_TARGET,
    updatedAt: new Date().toISOString(),
    stats: statsCache,
  };
}

function tryPersist(base: { launchCount: number; launchedAt: string }): void {
  try {
    mkdirSync(dirname(STATE_PATH), { recursive: true });
    writeFileSync(STATE_PATH, JSON.stringify(base, null, 2));
  } catch (err) {
    logger.error({ err }, "Failed to persist follower launch state");
  }
}

function loadLaunch(): number | null {
  try {
    if (!existsSync(STATE_PATH)) return null;
    const parsed = JSON.parse(readFileSync(STATE_PATH, "utf8"));
    const n = Number(parsed?.launchCount);
    return Number.isFinite(n) && n >= 0 ? n : null;
  } catch (err) {
    logger.warn({ err }, "Failed to read follower launch state");
    return null;
  }
}

async function fetchCount(): Promise<number | null> {
  if (OVERRIDE !== undefined && OVERRIDE.trim() !== "") {
    const n = Number(OVERRIDE);
    return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
  }

  try {
    const res = await fetch(CHANNEL_ENDPOINT, {
      headers: {
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    if (!res.ok) {
      throw new Error(`Kick API responded with ${res.status}`);
    }
    const data: any = await res.json();
    const n = Number(data?.followers_count);
    return Number.isFinite(n) && n >= 0 ? n : null;
  } catch (err) {
    logger.warn({ err }, "Failed to fetch follower count");
    return null;
  }
}

function pruneSamples(now: number): void {
  const cutoff = now - MAX_SAMPLE_AGE_MS;
  while (samples.length && samples[0].t < cutoff) samples.shift();
}

function refreshStats(now: number): void {
  statsCache = computeFollowerStats(
    samples,
    now,
    FOLLOWER_TARGET,
    currentCount,
    launchCount,
  );
  statsInitialized = true;
}

function broadcast(): void {
  const payload = getPayload();
  for (const fn of listeners) {
    try {
      fn(payload);
    } catch (err) {
      logger.error({ err }, "Follower listener threw");
    }
  }
}

async function ensureLaunchBaseline(count: number): Promise<void> {
  if (launchCount === null) {
    launchCount = loadLaunch();
    // First deploy: record this count as the campaign baseline once, then
    // persist it so restarts don't reset "since launch".
    if (launchCount === null) {
      launchCount = count;
      tryPersist({ launchCount, launchedAt: new Date().toISOString() });
    }
  }
}

async function poll(): Promise<void> {
  const next = await fetchCount();
  if (next === null) return;

  const now = Date.now();
  const firstSample = currentCount === null;
  await ensureLaunchBaseline(next);

  samples.push({ t: now, c: next });
  pruneSamples(now);
  currentCount = next;

  const changed = firstSample || next !== lastEmittedCount;
  lastEmittedCount = next;
  if (!changed) return;

  // Stats stay cached between 1-minute ticks; on a count change just re-attach
  // the cached snapshot. The first sample forces an initial computation.
  if (!statsInitialized) {
    refreshStats(now);
  }
  broadcast();
}

export function startPolling(): void {
  void poll();
  setInterval(() => void poll(), POLL_INTERVAL_MS);

  statsTimer = setInterval(() => {
    refreshStats(Date.now());
    broadcast();
  }, STATS_INTERVAL_MS);
  statsTimer.unref?.();
}

export function getCurrentCount(): number | null {
  return currentCount;
}

export function getPayloadSnapshot(): FollowerPayload {
  return getPayload();
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);

  const snapshot = getPayload();
  setTimeout(() => listener(snapshot), 0);

  return () => {
    listeners.delete(listener);
  };
}
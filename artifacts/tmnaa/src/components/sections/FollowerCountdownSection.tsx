import { useEffect, useRef, useState, type ReactNode } from 'react';
import { MotionConfig, motion } from 'framer-motion';
import {
  Flame,
  Hourglass,
  Rocket,
  Target,
  TrendingUp,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { Confetti } from '@/components/Confetti';
import { kickFetch } from '@/lib/kickApi';
import { apiUrl } from '@/lib/apiBase';
import {
  computeFollowerStats,
  fmtClock,
  fmtEta,
  fmtInt,
  fmtPercent,
  fmtPerHour,
  fmtSigned,
  type FollowerStats,
  type Sample,
} from '@/lib/followerStats';

// =============================================================================
// TEMPORARY "300K Countdown" section — comes down after the milestone event.
// Delete this whole file (and its <FollowerCountdownSection /> usage in
// Home.tsx) once the celebration is over. Everything this section needs is
// contained here (or in lib/followerStats.ts): its data source, its stats
// math, its animations, its celebration state.
// =============================================================================

const TARGET = 300000;
// Same-origin SSE stream (vite proxies /api/follower-count -> api-server).
// The api-server polls Kick every ~3s and pushes every change to all clients.
const SSE_PATH = apiUrl('/api/follower-count/stream');
// Fallback polling cadence if the SSE stream can't connect (uses the same
// Kick channel endpoint the rest of the site uses).
const POLL_MS = 4000;

const EASE = [0.22, 1, 0.36, 1] as const;
const RING_R = 105;
const RING_CIRC = 2 * Math.PI * RING_R;

const EMPTY_STATS: FollowerStats = {
  todayGained: null,
  growthPerHour: null,
  etaHours: null,
  peak: null,
  launchCount: null,
};

interface LiveState {
  count: number | null;
  stats: FollowerStats;
  mode: 'server' | 'local' | null;
}

const SAMPLE_CAP = 600;
const MAX_KEEP_MS = 2 * 24 * 60 * 60_000;
const HISTORY_KEY = 'tmnaa_follower_history_v1';

interface PersistedHistory {
  samples: Sample[];
  launchCount: number | null;
}

function loadHistory(): PersistedHistory {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return { samples: [], launchCount: null };
    const p = JSON.parse(raw) as Partial<PersistedHistory>;
    const samples = Array.isArray(p.samples)
      ? p.samples.filter((s) => Number.isFinite(s.t) && Number.isFinite(s.c))
      : [];
    const launchCount = typeof p.launchCount === 'number' ? p.launchCount : null;
    return { samples, launchCount };
  } catch {
    return { samples: [], launchCount: null };
  }
}

function saveHistory(history: PersistedHistory): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {
    // storage unavailable — ignore
  }
}

function useLiveFollowerCount(): LiveState {
  // Seed instantly from the last known count in localStorage so the counter is
  // never blank (or waiting on the network) — live data stream overrides
  // within a second or two.
  const [count, setCount] = useState<number | null>(() => {
    const h = loadHistory();
    const samples = [...h.samples].sort((a, b) => a.t - b.t);
    const latest = samples[samples.length - 1];
    return latest && Number.isFinite(latest.c) ? latest.c : null;
  });
  const [stats, setStats] = useState<FollowerStats>(() => {
    const h = loadHistory();
    const samples = [...h.samples].sort((a, b) => a.t - b.t);
    const latest = samples[samples.length - 1];
    if (!latest) return EMPTY_STATS;
    return computeFollowerStats(samples, Date.now(), TARGET, latest.c, h.launchCount);
  });
  const [mode, setMode] = useState<'server' | 'local' | null>(null);
  const samplesRef = useRef<Sample[]>([]);
  const launchCountRef = useRef<number | null>(null);

  useEffect(() => {
    let disposed = false;
    let es: EventSource | null = null;
    let pollTimer: number | null = null;
    let gotData = false;
    let errCount = 0;

    // Rehydrate the rolling history from localStorage so a page refresh doesn't
    // wipe the sample window (growth/ETA/today/peak stay warm) and the
    // campaign-launch baseline survives across visits.
    const initial = loadHistory();
    const keepFrom = Date.now() - MAX_KEEP_MS;
    samplesRef.current = initial.samples.filter((s) => s.t >= keepFrom);
    launchCountRef.current = initial.launchCount;

    const persist = () => {
      saveHistory({ samples: samplesRef.current, launchCount: launchCountRef.current });
    };

    // Kicks in when the SSE stream is unreachable or keeps dropping. Every
    // visitor polls independently, so the number still updates live for all —
    // and the poll history lets us recompute the growth/ETA/peak stats locally.
    const startPolling = () => {
      if (disposed || pollTimer !== null) return;
      if (es) {
        es.close();
        es = null;
      }
      const load = () => {
        if (disposed) return;
        kickFetch('https://kick.com/api/v2/channels/tmnaa').then((raw) => {
          if (disposed) return;
          const data = raw?.data || raw;
          const n = Number(data?.followers_count);
          if (!Number.isFinite(n) || n < 0) return;
          const now = Date.now();
          samplesRef.current.push({ t: now, c: n });
          if (samplesRef.current.length > SAMPLE_CAP) samplesRef.current.shift();
          // First ever-observed count doubles as the campaign baseline while the
          // server (which owns the authoritative one) is unreachable.
          if (launchCountRef.current === null) launchCountRef.current = n;
          persist();
          setMode('local');
          setCount(n);
          setStats(
            computeFollowerStats(
              samplesRef.current,
              now,
              TARGET,
              n,
              launchCountRef.current,
            ),
          );
        });
      };
      load();
      pollTimer = window.setInterval(load, POLL_MS);
    };

    es = new EventSource(SSE_PATH);

    es.addEventListener('count', (ev) => {
      try {
        const j = JSON.parse((ev as MessageEvent).data);
        const n = Number(j?.followers);
        if (!Number.isFinite(n) || n < 0) return;
        gotData = true;
        setMode('server');
        setCount(n);
        const s = (j?.stats ?? null) === null ? null : (j.stats as FollowerStats);
        if (s) setStats(s);
        // Server is authoritative; local samples are only a fallback.
        samplesRef.current = [];
        persist();
      } catch {
        // ignore malformed frame
      }
    });

    es.onerror = () => {
      // EventSource auto-reconnects on its own for transient drops; once the
      // stream looks dead we degrade gracefully to polling.
      errCount += 1;
      if (!gotData || errCount >= 3) startPolling();
    };

    // Safety net: if no value arrived and the stream never opened, poll.
    const connectTimeout = window.setTimeout(() => {
      if (!gotData) startPolling();
    }, 6000);

    return () => {
      disposed = true;
      window.clearTimeout(connectTimeout);
      if (pollTimer !== null) window.clearInterval(pollTimer);
      es?.close();
    };
  }, []);

  return { count, stats, mode };
}

// -----------------------------------------------------------------------------
// Odometer / slot-machine digit roll
//
// Every live number in this section renders as a set of per-digit reels. Each
// reel stacks the digits 0-9 in a single strip that is translated (CSS
// transform only — GPU friendly) so exactly one digit is visible. When a digit
// changes, the strip animates from the old digit to the new one and the
// intermediate digits that slide past produce the mechanical odometer feel.
// The roll direction is automatic: greater digit => strip moves further up,
// smaller digit => it comes back down, so increases and decreases always read
// visually. Only touched digit columns animate/glow — unchanged columns stay
// perfectly still, and commas/units are static text that never rolls.
// -----------------------------------------------------------------------------

type Token =
  | { kind: 'text'; text: string }
  | { kind: 'digits'; digits: string };

/** Split formatted text into digit-runs (which roll) and static text. */
function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  const re = /\d+/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      tokens.push({ kind: 'text', text: text.slice(last, m.index) });
    }
    tokens.push({ kind: 'digits', digits: m[0] });
    last = m.index + m[0].length;
  }
  if (last < text.length) tokens.push({ kind: 'text', text: text.slice(last) });
  return tokens;
}

/** One mechanical reel column showing a single digit (0-9 strip). */
function DigitColumn({ digit, prev }: { digit: number; prev: number | null }) {
  const reelRef = useRef<HTMLSpanElement>(null);
  const [glow, setGlow] = useState(false);
  const glowTimer = useRef<number | null>(null);

  useEffect(() => {
    const reel = reelRef.current;
    if (!reel) return;
    if (prev === null || prev === digit) {
      // First render or unchanged digit: snap into place, no roll, no flash.
      reel.style.transition = 'none';
      reel.style.transform = `translateY(-${digit * 10}%)`;
      return;
    }
    // Digit changed: jump (without transition) to the old digit's position,
    // force a style flush so the browser records it, then animate to the new.
    reel.style.transition = 'none';
    reel.style.transform = `translateY(-${prev * 10}%)`;
    void reel.offsetHeight;
    reel.style.transition = 'transform 460ms cubic-bezier(0.22, 1, 0.36, 1)';
    reel.style.transform = `translateY(-${digit * 10}%)`;
    setGlow(true);
    if (glowTimer.current) window.clearTimeout(glowTimer.current);
    glowTimer.current = window.setTimeout(() => setGlow(false), 520);
  }, [digit, prev]);

  useEffect(
    () => () => {
      if (glowTimer.current) window.clearTimeout(glowTimer.current);
    },
    [],
  );

  return (
    <span className={`fcs-od-col${glow ? ' fcs-od-flash' : ''}`}>
      <span ref={reelRef} className="fcs-od-reel">
        {[...Array(10)].map((_, d) => (
          <span key={d} className="fcs-od-cell" aria-hidden="true">
            {d}
          </span>
        ))}
      </span>
      <span className="fcs-od-glow" />
    </span>
  );
}

/** A contiguous run of digits (e.g. "371"). Columns are keyed from the right
 * (units place first) so carries like 99->100 roll the existing digits in
 * place instead of remounting them. */
function DigitRun({ digits }: { digits: string }) {
  const prevRef = useRef('');
  const chars = [...digits];
  const prevChars = [...prevRef.current];

  useEffect(() => {
    prevRef.current = digits;
  }, [digits]);

  return (
    <span className="fcs-od-run">
      {chars.map((ch, i) => {
        const pos = chars.length - 1 - i;
        const prevCh = prevChars.length
          ? prevChars[prevChars.length - 1 - pos]
          : null;
        return (
          <DigitColumn
            key={pos}
            digit={Number(ch)}
            prev={prevCh === null ? null : Number(prevCh)}
          />
        );
      })}
    </span>
  );
}

/** Renders `text`, rolling every digit portion odometer-style when it changes. */
function Odometer({ text }: { text: string }) {
  const tokens = tokenize(text);
  return (
    <span className="fcs-od" aria-label={text} role="text">
      {tokens.map((tok, i) =>
        tok.kind === 'text' ? (
          <span key={i} className="fcs-od-static">
            {tok.text}
          </span>
        ) : (
          <DigitRun key={`r${i}`} digits={tok.digits} />
        ),
      )}
    </span>
  );
}

// -----------------------------------------------------------------------------
// Continuous reel counter (the big number in the ring)
//
// The poll cadence (~3s) delivers a new follower count roughly every 3 seconds
// during a push. Instead of just snapping/rolling once per arrival, this
// counter CONTINUOUSLY animates from the previous value to the new one across
// the whole 3-second window (ROLL_MS), easing out. The units reel slips at
// fractional positions (sub-digit transforms), so digits visibly spin up from
// the bottom like a slot machine reel — the bigger the follower batch, the more
// the reels spin. Only the units column carries the sub-digit fraction; higher
// columns tick mechanically at carry points, exactly like a real odometer.
// -----------------------------------------------------------------------------

const ROLL_MS = 2850;

/** One reel column driven by a continuous (fractional) offset, no snap/glow —
 * smoothness comes from the counter tween in ReelCounter. */
function ReelColumn({ offset }: { offset: number }) {
  return (
    <span className="fcs-od-col">
      <span
        className="fcs-od-reel"
        style={{ transform: `translateY(${-offset * 10}%)` }}
      >
        {[...Array(10)].map((_, d) => (
          <span key={d} className="fcs-od-cell" aria-hidden="true">
            {d}
          </span>
        ))}
      </span>
    </span>
  );
}

function ReelRun({ digits, fraction }: { digits: string; fraction: number }) {
  const chars = [...digits];
  return (
    <span className="fcs-od-run">
      {chars.map((ch, i) => {
        const pos = chars.length - 1 - i;
        const offset = pos === 0 ? Number(ch) + fraction : Number(ch);
        return <ReelColumn key={pos} offset={offset} />;
      })}
    </span>
  );
}

/** Counter that glides from previous value to `value` over ROLL_MS on every
 *  change, then settles exactly on the target. Fractional frames give the
 *  units reel its continuous upward spin. Pass cap={null} to count freely
 *  without clamping (used once the 300K goal is reached). */
function ReelCounter({ value, cap }: { value: number; cap: number | null }) {
  const [disp, setDisp] = useState<number | null>(null);
  const dispRef = useRef(0);
  const targetRef = useRef(cap === null ? value : Math.min(value, cap));

  useEffect(() => {
    if (disp !== null) return;
    const to = cap === null ? value : Math.min(value, cap);
    dispRef.current = to;
    targetRef.current = to;
    setDisp(to);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // On every value/cap change, glide to the new count over ROLL_MS. Works
  // only off [value, cap] so the rAF loop keeps scheduling frames without
  // being cancelled by its own setDisp re-renders.
  useEffect(() => {
    const to = cap === null ? value : Math.min(value, cap);
    if (dispRef.current === to) {
      targetRef.current = to;
      return;
    }
    targetRef.current = to;
    const from = dispRef.current;
    const start = performance.now();
    let id = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / ROLL_MS);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = from + (to - from) * eased;
      dispRef.current = next;
      setDisp(next);
      if (t < 1) id = requestAnimationFrame(step);
    };
    id = requestAnimationFrame(step);
    return () => cancelAnimationFrame(id);
  }, [value, cap]);

  if (disp === null) return null;

  const finalText = new Intl.NumberFormat('en-US').format(Math.floor(disp));
  const fraction = disp - Math.floor(disp);
  const tokens = tokenize(finalText);
  const lastDigitIdx = tokens.reduce(
    (idx, tok, i) => (tok.kind === 'digits' ? i : idx),
    -1,
  );
  const label = new Intl.NumberFormat('en-US').format(
    cap === null ? value : Math.min(value, cap),
  );

  return (
    <span
      className="fcs-od"
      role="text"
      aria-label={label}
      style={{ direction: 'ltr', unicodeBidi: 'isolate' }}
    >
      {tokens.map((tok, i) =>
        tok.kind === 'text' ? (
          <span key={i} className="fcs-od-static">
            {tok.text}
          </span>
        ) : (
          <ReelRun
            key={`r${i}`}
            digits={tok.digits}
            fraction={i === lastDigitIdx ? fraction : 0}
          />
        ),
      )}
    </span>
  );
}

/** A live stat value: odometer digit-roll whenever the number changes. */
function StatNumber({
  raw,
  formatter,
  fallback = '—',
}: {
  raw: number | null;
  formatter: (n: number) => string | null;
  fallback?: string;
}) {
  if (raw === null) {
    return <span className="fcs-value fcs-fallback">{fallback}</span>;
  }
  const text = formatter(raw);
  if (text === null) {
    return <span className="fcs-value fcs-fallback">{fallback}</span>;
  }
  return (
    <span className="fcs-value">
      <Odometer text={text} />
    </span>
  );
}

function StatCard({
  icon: Icon,
  label,
  sub,
  children,
  delay,
}: {
  icon: LucideIcon;
  label: string;
  sub?: string;
  children: ReactNode;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay, ease: EASE }}
      whileHover={{ scale: 1.03 }}
      className="fcs-card"
    >
      <div className="flex items-start gap-3">
        <div className="fcs-ico">
          <Icon size={17} strokeWidth={1.6} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="fcs-label">{label}</div>
          <div className="mt-1 text-[19px] leading-tight">{children}</div>
          {sub && <div className="fcs-sub">{sub}</div>}
        </div>
      </div>
    </motion.div>
  );
}

export function FollowerCountdownSection() {
  const { count, stats, mode } = useLiveFollowerCount();
  const [goalHit, setGoalHit] = useState(false);
  const [pulseKey, setPulseKey] = useState(0);
  const prevCountRef = useRef<number | null>(null);

  const clamped = count == null ? 0 : Math.min(count, TARGET);
  const pct = count == null ? null : (clamped / TARGET) * 100;
  const pctLive = count == null ? null : (count / TARGET) * 100;
  const remaining = Math.max(0, TARGET - clamped);
  const pastGoal = count == null ? 0 : Math.max(0, count - TARGET);
  const fmt = (n: number) => new Intl.NumberFormat('en-US').format(n);
  const dashOffset = RING_CIRC * (1 - clamped / TARGET);

  const sinceLaunch =
    count != null && stats.launchCount != null
      ? Math.max(0, count - stats.launchCount)
      : null;
  const peakAt = stats.peak?.atTs ?? null;

  useEffect(() => {
    if (count == null || goalHit) return;
    if (count >= TARGET) {
      setGoalHit(true);
      return;
    }
    if (count !== prevCountRef.current) setPulseKey((k) => k + 1);
    prevCountRef.current = count;
  }, [count, goalHit]);

  // Deterministic floating ember sparks — denser here to make the section feel
  // special against the rest of the page.
  const sparks = Array.from({ length: 26 }, (_, i) => ({
    left: ((i * 137.5 + 11) % 100).toFixed(1),
    delay: (i % 7) * 0.9,
    duration: 5 + (i % 5) * 0.8,
    size: 1.5 + (i % 3) * 1.3,
  }));

  const EYEBROW = goalHit ? 'The 300K Milestone' : 'The Countdown to 300K';

  interface CardDef {
    key: string;
    label: string;
    sub?: string;
    icon: LucideIcon;
    raw: number | null;
    fmt: (n: number) => string | null;
    fallback: string;
  }

  const cards: CardDef[] = [
    {
      key: 'today',
      label: 'Followers Gained Today',
      sub: mode === 'server' ? 'since midnight' : 'this session',
      icon: TrendingUp,
      raw: stats.todayGained,
      fmt: fmtInt,
      fallback: '—',
    },
    {
      key: 'growth',
      label: 'Live Growth Rate',
      sub: 'avg · trailing 5 min',
      icon: Flame,
      raw: stats.growthPerHour,
      fmt: fmtPerHour,
      fallback: 'Calculating…',
    },
    {
      key: 'eta',
      label: goalHit ? 'Past the Goal' : 'ETA to 300K',
      sub: goalHit ? 'followers over 300K' : 'at current pace',
      icon: goalHit ? Rocket : Hourglass,
      raw: goalHit ? pastGoal : stats.etaHours,
      fmt: goalHit ? fmtSigned : fmtEta,
      fallback: '—',
    },
    {
      key: 'pct',
      label: 'Completion',
      sub: 'of the goal',
      icon: Target,
      raw: goalHit ? pctLive : pct,
      fmt: goalHit
        ? (n: number) => `${n.toFixed(2)}%`
        : fmtPercent,
      fallback: '—',
    },
    {
      key: 'peak',
      label: "Today's Peak Surge",
      sub: peakAt
        ? `busiest minute · ${fmtClock(peakAt)}`
        : 'busiest minute',
      icon: Zap,
      raw: stats.peak?.max ?? null,
      fmt: (n: number) => `${fmtInt(n)} in 1 min`,
      fallback: '—',
    },
    {
      key: 'launch',
      label: 'Followers Since Launch',
      sub: 'campaign milestone',
      icon: Rocket,
      raw: sinceLaunch,
      fmt: fmtSigned,
      fallback: '—',
    },
  ];

  return (
    <MotionConfig reducedMotion="user">
      <section
        id="follower-countdown"
        className="relative py-16 md:py-32 px-5 md:px-6 overflow-hidden border-t border-white/5"
        aria-label="300K follower countdown"
      >
        <style>{`
          #follower-countdown .fcs-glow {
            background: radial-gradient(ellipse 64% 58% at 50% 52%, rgba(255,122,24,0.16) 0%, rgba(217,74,43,0.07) 45%, rgba(9,8,7,0) 76%);
          }
          #follower-countdown .fcs-hoverglow {
            background: radial-gradient(ellipse 60% 55% at 50% 52%, rgba(255,122,24,0.22) 0%, rgba(217,74,43,0.1) 45%, transparent 76%);
            opacity: 0;
            transition: opacity 0.6s ease;
          }
          #follower-countdown:hover .fcs-hoverglow { opacity: 1; }
          #follower-countdown .fcs-ember {
            background: radial-gradient(circle at 50% 62%, rgba(138,47,20,0.5), rgba(9,8,7,0) 68%);
            animation: fcs-flicker 6s ease-in-out infinite alternate;
          }
          @keyframes fcs-flicker { from { opacity: 0.5; } to { opacity: 0.85; } }

          #follower-countdown .fcs-spark {
            position: absolute;
            bottom: 10%;
            border-radius: 9999px;
            background: #FFB347;
            box-shadow: 0 0 6px #FF7A18;
            opacity: 0;
            animation: fcs-rise linear infinite;
          }
          @keyframes fcs-rise {
            0%   { transform: translateY(0); opacity: 0; }
            8%   { opacity: 0.9; }
            85%  { opacity: 0.25; }
            100% { transform: translateY(-46vh); opacity: 0; }
          }

          #follower-countdown .fcs-pulse {
            animation: fcs-pulse 0.9s ease-out forwards;
            opacity: 0;
          }
          @keyframes fcs-pulse {
            0%   { transform: scale(0.35); opacity: 0.85; }
            100% { transform: scale(1.35); opacity: 0; }
          }

          #follower-countdown .fcs-fill {
            background: linear-gradient(90deg, #8A2F14, #D94A2B, #FF7A18, #D9A441);
            box-shadow: 0 0 14px rgba(255,122,24,0.55), 0 0 30px rgba(217,164,65,0.3);
          }
          #follower-countdown .fcs-sheen {
            animation: fcs-sheen 2.8s ease-in-out infinite;
          }
          @keyframes fcs-sheen {
            0%        { transform: translateX(-120%); }
            60%, 100% { transform: translateX(320%); }
          }

          #follower-countdown .fcs-goal-pulse {
            animation: fcs-goal 1.7s ease-in-out 4;
          }
          @keyframes fcs-goal {
            0%, 100% { filter: drop-shadow(0 0 8px rgba(232,180,92,0.7)); }
            50%      { filter: drop-shadow(0 0 28px rgba(255,122,24,1)); }
          }

          /* ---------- two-column layout ---------- */
          #follower-countdown .fcs-grid {
            display: grid;
            grid-template-columns: 1fr;
            gap: 3rem 2.5rem;
            align-items: center;
          }
          @media (min-width: 1024px) {
            #follower-countdown .fcs-grid {
              grid-template-columns: minmax(0, 0.94fr) minmax(0, 1.06fr);
            }
          }

          /* ---------- background depth: side glows + halo ---------- */
          #follower-countdown .fcs-ring-glow {
            background: radial-gradient(ellipse closest-side at 50% 50%, rgba(255,122,24,0.22) 0%, rgba(217,74,43,0.1) 48%, transparent 76%);
          }
          #follower-countdown .fcs-halo {
            position: absolute;
            inset: -16%;
            border-radius: 9999px;
            background: radial-gradient(circle, rgba(255,122,24,0.28) 0%, rgba(217,74,43,0.13) 44%, transparent 70%);
            animation: fcs-halo 5.5s ease-in-out infinite;
            pointer-events: none;
          }
          @keyframes fcs-halo {
            0%, 100% { transform: scale(1); opacity: 0.8; }
            50%      { transform: scale(1.07); opacity: 1; }
          }
          #follower-countdown .fcs-panel-glow {
            background: radial-gradient(ellipse 95% 75% at 50% 45%, rgba(255,122,24,0.1) 0%, rgba(217,74,43,0.05) 55%, transparent 78%);
          }

          /* ---------- rim shimmer (light catching molten metal) ---------- */
          #follower-countdown .fcs-rim-sheen {
            position: absolute;
            inset: 0;
          }
          #follower-countdown .fcs-rim-sheen g {
            animation: fcs-rim 8s linear infinite;
          }
          @keyframes fcs-rim {
            from { stroke-dashoffset: -46; }
            to   { stroke-dashoffset: -146; }
          }

          /* ---------- glowing big number ---------- */
          #follower-countdown .fcs-num-glow {
            position: absolute;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            width: 160%;
            height: 110%;
            border-radius: 9999px;
            background: radial-gradient(closest-side, rgba(232,180,92,0.45) 0%, rgba(255,122,24,0.22) 45%, transparent 72%);
            filter: blur(16px);
            animation: fcs-numglow 4s ease-in-out infinite;
            pointer-events: none;
            z-index: 0;
          }
          @keyframes fcs-numglow {
            0%, 100% { opacity: 0.5; }
            50%      { opacity: 1; }
          }

          /* ---------- stat panel + cards ---------- */
          #follower-countdown .fcs-panel {
            position: relative;
            border-radius: 24px;
            padding: 20px;
            background: linear-gradient(180deg, rgba(26,19,12,0.55), rgba(14,10,7,0.6));
            border: 1px solid rgba(217,164,65,0.1);
            box-shadow: inset 0 1px 0 rgba(255,255,255,0.03);
          }
          #follower-countdown .fcs-cards {
            display: grid;
            grid-template-columns: 1fr;
            gap: 12px;
          }
          @media (min-width: 480px) {
            #follower-countdown .fcs-cards { grid-template-columns: 1fr 1fr; }
          }
          #follower-countdown .fcs-card {
            position: relative;
            overflow: hidden;
            border-radius: 16px;
            padding: 14px 14px 13px;
            background: linear-gradient(180deg, rgba(28,20,13,0.9), rgba(13,10,7,0.92));
            border: 1px solid rgba(217,164,65,0.14);
            box-shadow: inset 0 1px 0 rgba(255,255,255,0.04), 0 10px 24px -18px rgba(0,0,0,0.7);
            transition: border-color 0.35s ease, box-shadow 0.35s ease, background 0.35s ease;
          }
          #follower-countdown .fcs-card::before {
            content: "";
            position: absolute;
            top: 0; left: 14%; right: 14%;
            height: 1px;
            background: linear-gradient(90deg, transparent, rgba(232,180,92,0.75), transparent);
            opacity: 0.55;
          }
          #follower-countdown .fcs-card:hover {
            border-color: rgba(217,164,65,0.42);
            background: linear-gradient(180deg, rgba(38,27,17,0.95), rgba(18,13,9,0.95));
            box-shadow: inset 0 1px 0 rgba(255,255,255,0.06), 0 0 26px -6px rgba(255,122,24,0.35), 0 14px 30px -20px rgba(0,0,0,0.8);
          }
          #follower-countdown .fcs-ico {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 34px; height: 34px;
            border-radius: 10px;
            flex: none;
            background: rgba(217,164,65,0.07);
            border: 1px solid rgba(217,164,65,0.18);
            color: #E8B45C;
            box-shadow: inset 0 0 10px rgba(217,164,65,0.05), 0 0 12px -4px rgba(255,122,24,0.35);
            transition: background 0.35s ease, border-color 0.35s ease, color 0.35s ease, box-shadow 0.35s ease;
          }
          #follower-countdown .fcs-card:hover .fcs-ico {
            background: rgba(217,164,65,0.13);
            border-color: rgba(232,180,92,0.4);
            box-shadow: inset 0 0 12px rgba(217,164,65,0.1), 0 0 16px -2px rgba(255,122,24,0.6);
          }
          #follower-countdown .fcs-label {
            color: rgba(247,243,238,0.45);
            font-size: 10px;
            letter-spacing: 0.14em;
            font-weight: 800;
            text-transform: uppercase;
            font-family: 'Cairo', sans-serif;
          }
          #follower-countdown .fcs-value {
            display: inline-block;
            color: #F0D9A6;
            font-family: 'Cairo', sans-serif;
            font-weight: 900;
            font-size: 20px;
            line-height: 1.15;
            font-feature-settings: 'tnum';
            text-shadow: 0 0 16px rgba(217,164,65,0.35);
            transition: color 0.4s ease, text-shadow 0.4s ease;
            will-change: filter, transform;
          }
          #follower-countdown .fcs-card:hover .fcs-value {
            color: #FFF3D6;
            text-shadow: 0 0 18px rgba(232,180,92,0.55);
          }
          #follower-countdown .fcs-fallback {
            color: rgba(247,243,238,0.38);
            text-shadow: none;
          }
          #follower-countdown .fcs-sub {
            margin-top: 3px;
            color: rgba(247,243,238,0.34);
            font-size: 10.5px;
            font-weight: 600;
          }
          @keyframes fcs-value-flash {
            0%   { filter: brightness(1.85) drop-shadow(0 0 14px rgba(255,199,120,0.95)); transform: scale(1.07); }
            100% { filter: brightness(1) drop-shadow(0 0 0 rgba(0,0,0,0)); transform: scale(1); }
          }

          /* ---------- odometer digit roll ---------- */
          #follower-countdown .fcs-od {
            display: inline-flex;
            align-items: center;
            direction: ltr;
            unicode-bidi: isolate;
          }
          #follower-countdown .fcs-od-static {
            white-space: pre;
          }
          #follower-countdown .fcs-od-run {
            display: inline-flex;
          }
          #follower-countdown .fcs-od-col {
            position: relative;
            display: inline-block;
            height: 1.05em;
            width: 1ch;
            overflow: hidden;
            text-align: center;
            vertical-align: -0.05em;
            line-height: 1;
            font-variant-numeric: tabular-nums;
          }
          #follower-countdown .fcs-od-reel {
            position: absolute;
            top: 0;
            left: 0;
            display: flex;
            flex-direction: column;
            will-change: transform;
            transform: translateZ(0);
          }
          #follower-countdown .fcs-od-cell {
            display: block;
            width: 100%;
            height: 1.05em;
            line-height: 1.05;
            text-align: center;
            font-variant-numeric: tabular-nums;
            user-select: none;
          }
          #follower-countdown .fcs-od-glow {
            position: absolute;
            inset: 0;
            pointer-events: none;
            border-radius: 0.22em;
            opacity: 0;
            transition: opacity 0.3s ease;
            background: radial-gradient(ellipse 100% 85% at 50% 50%, rgba(255,190,110,0.5) 0%, rgba(255,122,24,0.16) 55%, transparent 82%);
          }
          #follower-countdown .fcs-od-flash .fcs-od-glow {
            opacity: 1;
          }

          /* ---------- bottom fade into the footer ---------- */
          #follower-countdown .fcs-bottom-fade {
            position: absolute;
            left: 0; right: 0; bottom: 0;
            height: 130px;
            background: linear-gradient(to top, #090807, transparent);
            pointer-events: none;
          }

          @media (prefers-reduced-motion: reduce) {
            #follower-countdown .fcs-spark,
            #follower-countdown .fcs-sheen,
            #follower-countdown .fcs-goal-pulse,
            #follower-countdown .fcs-halo,
            #follower-countdown .fcs-num-glow,
            #follower-countdown .fcs-ember { animation: none; }
            #follower-countdown .fcs-rim-sheen g { animation-duration: 30s; }
            #follower-countdown .fcs-hoverglow { transition: none; }
            #follower-countdown .fcs-od-reel { transition: none !important; }
            #follower-countdown .fcs-od-glow { display: none; }
          }
        `}</style>

        {/* Ember background */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 fcs-glow" />
          <div className="absolute inset-0 fcs-hoverglow" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[85%] blur-[110px] opacity-70 pointer-events-none fcs-ember" />
          {sparks.map((s, i) => (
            <span
              key={i}
              className="fcs-spark"
              style={{
                left: `${s.left}%`,
                width: `${s.size}px`,
                height: `${s.size}px`,
                animationDelay: `${s.delay}s`,
                animationDuration: `${s.duration}s`,
              }}
            />
          ))}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#D9A441]/25 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[#D9A441]/25 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 fcs-bottom-fade" />
        </div>

        <div className="relative z-10 max-w-5xl mx-auto">
          {/* Eyebrow divider ("small-caps-with-side-lines" tagline pattern) */}
          <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: EASE }}
              className="flex items-center justify-center gap-4 mb-5"
            >
            <span className="h-px w-10 md:w-16 bg-gradient-to-r from-transparent to-[#D9A441]/60" />
            <span
              className="text-[11px] md:text-xs font-bold tracking-[0.34em] uppercase whitespace-nowrap"
              style={{ color: '#D9A441', fontFamily: 'Cairo, sans-serif' }}
            >
              {EYEBROW}
            </span>
            <span className="h-px w-10 md:w-16 bg-gradient-to-l from-transparent to-[#D9A441]/60" />
          </motion.div>

          {/* Headline */}
          <motion.h2
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease: EASE }}
            className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-center"
            style={{ fontFamily: 'Cairo, sans-serif', color: '#F7F3EE' }}
          >
            {goalHit ? (
              <span className="metal-shine drop-shadow-[0_3px_16px_rgba(255,122,24,0.4)]">
                300,000 Strong — We Did It!
              </span>
            ) : (
              <span className="metal-shine">We&apos;re Almost There</span>
            )}
          </motion.h2>

          {goalHit && (
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.2, ease: EASE }}
              className="text-center mt-3 text-[13px] md:text-sm font-bold tracking-wide"
              style={{ color: 'rgba(232,180,92,0.85)', fontFamily: 'Cairo, sans-serif' }}
            >
              Officially 300,000 followers — and the number keeps climbing. 🎉
            </motion.p>
          )}

          <div className="fcs-grid mt-10 md:mt-12">
            {/* Ring column — first on mobile, right on desktop */}
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.9, delay: 0.2, ease: EASE }}
              className="fcs-ring-glow relative rounded-[9999px] px-4 py-2 order-1 lg:order-2 flex flex-col items-center"
            >
              <div className="fcs-halo" />
              <div className="relative w-[min(82vw,360px)]">
                <svg
                  viewBox="0 0 260 260"
                  className="w-full h-auto block"
                  aria-hidden
                >
                  <circle
                    cx="130"
                    cy="130"
                    r={RING_R}
                    fill="none"
                    stroke="rgba(217,164,65,0.09)"
                    strokeWidth="10"
                  />
                  <circle
                    cx="130"
                    cy="130"
                    r={RING_R}
                    fill="none"
                    stroke="rgba(255,122,24,0.05)"
                    strokeWidth="10"
                    strokeDasharray={RING_CIRC}
                    strokeDashoffset={RING_CIRC}
                    transform="rotate(-90 130 130)"
                  />
                  <circle
                    className={goalHit ? 'fcs-goal-pulse' : undefined}
                    cx="130"
                    cy="130"
                    r={RING_R}
                    fill="none"
                    stroke="url(#fcsRingGrad)"
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={RING_CIRC}
                    strokeDashoffset={dashOffset}
                    transform="rotate(-90 130 130)"
                    style={{
                      transition: 'stroke-dashoffset 900ms cubic-bezier(0.22,1,0.36,1)',
                      filter: 'drop-shadow(0 0 10px rgba(232,180,92,0.65))',
                    }}
                  />
                  <defs>
                    <linearGradient id="fcsRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#E8B45C" />
                      <stop offset="50%" stopColor="#D9A441" />
                      <stop offset="100%" stopColor="#FF7A18" />
                    </linearGradient>
                    <linearGradient id="fcsTrailGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#FFD9A8" stopOpacity="0.9" />
                      <stop offset="100%" stopColor="#FF7A18" stopOpacity="0.35" />
                    </linearGradient>
                  </defs>
                </svg>

                {/* Rim shimmer — a soft trail with a bright head sliding around */}
                <svg
                  viewBox="0 0 260 260"
                  className="fcs-rim-sheen"
                  aria-hidden
                  style={{
                    width: '100%',
                    height: '100%',
                  }}
                >
                  <g>
                    <circle
                      cx="130"
                      cy="130"
                      r={RING_R}
                      fill="none"
                      stroke="url(#fcsTrailGrad)"
                      strokeWidth="8"
                      strokeDasharray="46 100"
                      pathLength={100}
                      strokeDashoffset={-46}
                      opacity="0.32"
                    />
                    <circle
                      cx="130"
                      cy="130"
                      r={RING_R}
                      fill="none"
                      stroke="#FFE1B0"
                      strokeWidth="9"
                      strokeLinecap="round"
                      strokeDasharray="12 100"
                      pathLength={100}
                      strokeDashoffset={-46}
                      opacity="0.85"
                      style={{ filter: 'drop-shadow(0 0 5px rgba(255,199,120,0.9))' }}
                    />
                  </g>
                </svg>

                <div className="absolute inset-0 flex flex-col items-center justify-center px-10">
                  <div className="relative">
                    {count != null && !goalHit && (
                      <span
                        key={pulseKey}
                        className="fcs-pulse absolute inset-0 rounded-full border-2 border-[#D9A441] pointer-events-none"
                      />
                    )}
                    <span className="fcs-num-glow" aria-hidden />
                    <span
                      className={`relative block z-[1] text-[44px] sm:text-5xl md:text-6xl font-black tabular-nums leading-none`}
                      style={{
                        fontFamily: 'Cairo, sans-serif',
                        color: goalHit ? '#FFE1B0' : '#E8B45C',
                        textShadow: 'none',
                        transition: 'color 600ms ease',
                      }}
                    >
                      {count == null ? '—' : (
                        <ReelCounter
                          value={goalHit ? count : clamped}
                          cap={goalHit ? null : TARGET}
                        />
                      )}
                    </span>
                  </div>
                  <span
                    className="mt-2 text-[11px] sm:text-xs font-bold tracking-[0.3em] uppercase"
                    style={{ color: 'rgba(247,243,238,0.4)' }}
                  >
                    {goalHit ? 'and still counting' : `of ${fmt(TARGET)}`}
                  </span>
                </div>
              </div>

              {/* Progress bar + remaining */}
              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.35, ease: EASE }}
                className="mt-7 w-full flex items-center justify-center gap-4"
              >
                <span
                  className="relative overflow-hidden rounded-full h-[6px] w-full max-w-[280px]"
                  style={{
                    background: 'rgba(217,164,65,0.08)',
                    border: '1px solid rgba(217,164,65,0.15)',
                    boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.4)',
                  }}
                >
                  <span
                    className="fcs-fill absolute inset-y-0 left-0 rounded-full"
                    style={{ width: `${(clamped / TARGET) * 100}%`, transition: 'width 900ms cubic-bezier(0.22,1,0.36,1)' }}
                  >
                    <span className="fcs-sheen absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/55 to-transparent" />
                  </span>
                </span>
                <span
                  className="text-[13px] font-black whitespace-nowrap tabular-nums"
                  style={{ color: '#D9A441' }}
                >
                  {count == null ? (
                  '—'
                ) : goalHit ? (
                  <Odometer text={`+${fmt(pastGoal)} past 300K`} />
                ) : (
                  <Odometer text={`${fmt(remaining)} to go`} />
                )}
                </span>
              </motion.div>

              {/* Goal reached badge */}
              {goalHit && (
                <motion.div
                  initial={{ scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 14 }}
                  className="relative mt-8 flex items-center gap-2.5 rounded-full px-5 py-2 overflow-hidden"
                  style={{
                    border: '1px solid rgba(217,164,65,0.4)',
                    background: 'linear-gradient(135deg, rgba(217,164,65,0.14), rgba(255,122,24,0.08))',
                    boxShadow: '0 0 24px rgba(217,164,65,0.3), inset 0 0 14px rgba(217,164,65,0.08)',
                  }}
                >
                  <span className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-[#F5D489]/80 to-transparent" />
                  <Flame size={17} className="text-[#FF7A18] drop-shadow-[0_0_6px_rgba(255,122,24,0.8)]" />
                  <span
                    className="text-xs font-black tracking-[0.2em] uppercase metal-shine"
                    style={{ color: '#F5D489', fontFamily: 'Cairo, sans-serif' }}
                  >
                    Goal Reached 🔥
                  </span>
                </motion.div>
              )}
            </motion.div>

            {/* Stats panel — second on mobile, left on desktop */}
            <motion.div
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.18, ease: EASE }}
              className="fcs-panel-glow relative order-2 lg:order-1"
            >
              <div className="fcs-panel">
                <div className="fcs-cards">
                  {cards.map((card, i) => (
                    <StatCard
                      key={card.key}
                      icon={card.icon}
                      label={card.label}
                      sub={card.sub}
                      delay={0.2 + i * 0.07}
                    >
                      <StatNumber
                        raw={card.raw}
                        formatter={card.fmt}
                        fallback={card.fallback}
                      />
                    </StatCard>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </div>

        {goalHit && <Confetti />}
      </section>
    </MotionConfig>
  );
}
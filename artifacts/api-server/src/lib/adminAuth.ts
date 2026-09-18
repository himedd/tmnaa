import { createHmac, scryptSync, timingSafeEqual } from "node:crypto";
import type { Request } from "express";
import { fetchAdminCredentials } from "./supabase";
import { logger } from "./logger";

/**
 * Admin authentication — deliberately strict:
 *  - login is a single strong password, compared in constant time
 *  - per-IP brute-force protection (5 failures per 15 minutes)
 *  - sessions are HMAC-signed tokens with an expiry, nothing stored server-side
 */

const ENV_PASSWORD = process.env["ADMIN_PASSWORD"] ?? "";
const JWT_SECRET = process.env["ADMIN_JWT_SECRET"] ?? "";
const TOKEN_TTL_HOURS = Number(process.env["ADMIN_TOKEN_HOURS"] || "12");

const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60 * 1000;

interface FailWindow {
  count: number;
  firstFail: number;
  lockedUntil: number;
}

const failWindows = new Map<string, FailWindow>();

function safeEqual(a: string, b: string): boolean {
  const ha = createHmac("sha256", "pw-compare").update(a).digest();
  const hb = createHmac("sha256", "pw-compare").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function clientIp(req: Request): string {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd) return fwd.split(",")[0].trim();
  return req.socket?.remoteAddress ?? "unknown";
}

function getWindow(ip: string): FailWindow {
  let window = failWindows.get(ip);
  const now = Date.now();
  if (!window || now - window.firstFail > WINDOW_MS) {
    window = { count: 0, firstFail: now, lockedUntil: 0 };
    failWindows.set(ip, window);
  }
  return window;
}

export function loginAvailable(ip: string): { allowed: true } | { allowed: false; retryAfterSeconds: number } {
  const window = getWindow(ip);
  const now = Date.now();
  if (window.lockedUntil > now) {
    return { allowed: false, retryAfterSeconds: Math.ceil((window.lockedUntil - now) / 1000) };
  }
  if (window.count >= MAX_FAILURES) {
    window.lockedUntil = now + WINDOW_MS;
    window.count = 0;
    window.firstFail = now;
    return { allowed: false, retryAfterSeconds: Math.ceil(WINDOW_MS / 1000) };
  }
  return { allowed: true };
}

export function recordFailure(ip: string): void {
  const window = getWindow(ip);
  window.count += 1;
  if (window.count >= MAX_FAILURES) {
    window.lockedUntil = Date.now() + WINDOW_MS;
    window.count = 0;
    window.firstFail = Date.now();
  }
}

export function clearFailures(ip: string): void {
  failWindows.delete(ip);
}

/**
 * Admin credentials live in the database (`admin_credentials` table, scrypt
 * hash), so a leaked `.env` file is no longer enough to log into /admin.
 * The env `ADMIN_PASSWORD` is only a fallback when no DB row exists yet.
 */

interface ScryptParams {
  N: number;
  r: number;
  p: number;
  salt: Buffer;
  key: Buffer;
}

function parseScrypt(encoded: string): ScryptParams | null {
  const parts = encoded.split(":");
  if (parts.length !== 6 || parts[0] !== "s") return null;
  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return null;
  if (N < 2 || r < 1 || p < 1) return null;
  const salt = Buffer.from(parts[4], "base64");
  const key = Buffer.from(parts[5], "base64");
  if (!salt.length || key.length === 0) return null;
  return { N, r, p, salt, key };
}

function verifyScrypt(candidate: string, encoded: string): boolean {
  const parsed = parseScrypt(encoded);
  if (!parsed) return false;
  try {
    const derived = scryptSync(candidate, parsed.salt, parsed.key.length, {
      N: parsed.N,
      r: parsed.r,
      p: parsed.p,
    });
    return derived.length === parsed.key.length && timingSafeEqual(derived, parsed.key);
  } catch (err) {
    logger.warn({ err }, "scrypt verify failed");
    return false;
  }
}

const scryptCache = { hash: "", fetchedAt: 0, present: false };
const SCRYPT_PRESENT_TTL_MS = 30_000;
const SCRYPT_ABSENT_TTL_MS = 2_000;

/** Cached fetch of the stored admin hash. Throws if Supabase is unreachable. */
async function currentAdminHash(): Promise<string | null> {
  const age = Date.now() - scryptCache.fetchedAt;
  const ttl = scryptCache.present ? SCRYPT_PRESENT_TTL_MS : SCRYPT_ABSENT_TTL_MS;
  if (age < ttl) {
    return scryptCache.present ? scryptCache.hash : null;
  }
  const hash = await fetchAdminCredentials();
  scryptCache.hash = hash ?? "";
  scryptCache.present = Boolean(hash);
  scryptCache.fetchedAt = Date.now();
  return hash;
}

export async function passwordMatches(candidate: string): Promise<boolean> {
  const stored = await currentAdminHash();
  if (stored) {
    return verifyScrypt(String(candidate), stored);
  }
  // No DB row yet: admin password comes from the environment (migration state).
  if (!ENV_PASSWORD) {
    logger.error("admin_credentials missing AND no ADMIN_PASSWORD env set — admin login disabled");
    return false;
  }
  return safeEqual(String(candidate), ENV_PASSWORD);
}

/** Sign an expiring session token. */
export function signToken(): { token: string; expiresAt: string } {
  const exp = Math.floor(Date.now() / 1000) + TOKEN_TTL_HOURS * 3600;
  const payload = Buffer.from(JSON.stringify({ sub: "admin", exp }), "utf8");
  const sig = createHmac("sha256", JWT_SECRET).update(payload).digest("base64url");
  const token = `${payload.toString("base64url")}.${sig}`;
  return { token, expiresAt: new Date(exp * 1000).toISOString() };
}

export function verifyToken(token: string | undefined): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [payloadB64, sigB64] = parts;
  try {
    const expected = createHmac("sha256", JWT_SECRET)
      .update(Buffer.from(payloadB64, "base64url"))
      .digest("base64url");
    if (!safeEqual(sigB64, expected)) return false;
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
    if (payload.sub !== "admin") return false;
    return Number(payload.exp) > Math.floor(Date.now() / 1000);
  } catch (err) {
    logger.warn({ err }, "admin token failed to parse");
    return false;
  }
}

/** Express middleware: require a valid Bearer admin token. */
export function requireAdmin(req: Request, _res: unknown, next: (err?: unknown) => void): void {
  const auth = req.headers["authorization"];
  const token = typeof auth === "string" ? auth.replace(/^Bearer\s+/i, "") : undefined;
  if (!verifyToken(token)) {
    const err = new Error("UNAUTHORIZED") as Error & { status?: number };
    err.status = 401;
    next(err);
    return;
  }
  next();
}

const WALL_UPLOAD_MAX_PER_HOUR = Number(process.env["UPLOAD_MAX_PER_HOUR"] || "6");
const uploadWindows = new Map<string, { count: number; first: number }>();

/** Coarse per-IP upload throttling (best effort, in-memory). */
export function canUpload(ip: string): { ok: boolean } {
  const now = Date.now();
  const entry = uploadWindows.get(ip);
  if (!entry || now - entry.first > 3600 * 1000) {
    uploadWindows.set(ip, { count: 1, first: now });
    return { ok: true };
  }
  if (entry.count >= WALL_UPLOAD_MAX_PER_HOUR) {
    return { ok: false };
  }
  entry.count += 1;
  return { ok: true };
}
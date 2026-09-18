import { logger } from "./logger";

/**
 * Thin Supabase client over the PostgREST API. All calls run with the
 * service_role key (server-only) so RLS is bypassed — reads/writes are fully
 * controlled by the api-server, never by the browser.
 */

const BASE = process.env["SUPABASE_URL"]?.replace(/\/+$/, "");
const KEY = process.env["SUPABASE_SERVICE_ROLE"] ?? "";

export const supabaseConfigured = Boolean(BASE && KEY);

function resource(path: string): string {
  return `${BASE}/rest/v1/${path}`;
}

function authHeaders(json = true): Record<string, string> {
  const headers: Record<string, string> = {
    apikey: KEY,
    Authorization: `Bearer ${KEY}`,
  };
  if (json) headers["Content-Type"] = "application/json";
  return headers;
}

async function supabaseFetch(
  path: string,
  init: RequestInit,
  timeoutMs = 30000,
): Promise<{ status: number; body: any }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(resource(path), { ...init, signal: controller.signal });
    const text = await res.text();
    let body: any = null;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
    }
    return { status: res.status, body };
  } catch (err) {
    logger.error({ err, path }, "supabase request failed");
    throw new Error("SUPABASE_UNAVAILABLE");
  } finally {
    clearTimeout(timer);
  }
}

export interface WallRow {
  id: string;
  name: string;
  caption: string | null;
  kind: "upload" | "link";
  media_type: "image" | "video" | "link";
  status: "pending" | "approved" | "rejected";
  provider: number | null;
  bucket: string | null;
  media_key: string | null;
  poster_key: string | null;
  link_url: string | null;
  size_bytes: number | null;
  likes: number | null;
  created_at: string;
  reviewed_at: string | null;
  reviewer: string | null;
}

export async function queryWall(
  select: string,
  filters: Record<string, string>,
  order: string,
): Promise<WallRow[]> {
  const params = new URLSearchParams({ select, order });
  for (const [column, value] of Object.entries(filters)) {
    params.append(column, value);
  }
  const { status, body } = await supabaseFetch(`wall_submissions?${params.toString()}`, {
    method: "GET",
    headers: authHeaders(),
  });
  if (status !== 200) {
    logger.warn({ status, body }, "supabase select failed");
    throw new Error("SUPABASE_QUERY_FAILED");
  }
  return (body as WallRow[]) ?? [];
}

export async function insertWallRow(
  row: Record<string, unknown>,
): Promise<WallRow> {
  const { status, body } = await supabaseFetch("wall_submissions", {
    method: "POST",
    headers: { ...authHeaders(), Prefer: "return=representation" },
    body: JSON.stringify(row),
  });
  if (status < 200 || status >= 300) {
    logger.warn({ status, body }, "supabase insert failed");
    throw new Error("SUPABASE_INSERT_FAILED");
  }
  return (Array.isArray(body) ? body[0] : body) as WallRow;
}

export async function patchWallRow(
  id: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const { status, body } = await supabaseFetch(
    `wall_submissions?id=eq.${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify(patch),
    },
  );
  if (status < 200 || status >= 300) {
    logger.warn({ status, body }, "supabase update failed");
    throw new Error("SUPABASE_UPDATE_FAILED");
  }
}

export async function fetchWallRow(id: string): Promise<WallRow | null> {
  const rows = await queryWall("*", { "id": `eq.${id}` }, `created_at.desc`);
  return rows[0] ?? null;
}

/** Return the stored admin password hash (scrypt-encoded), or null if no row. */
export async function fetchAdminCredentials(): Promise<string | null> {
  const params = new URLSearchParams({
    select: "id,password_hash",
    id: "eq.1",
    limit: "1",
  });
  const { status, body } = await supabaseFetch(`admin_credentials?${params.toString()}`, {
    method: "GET",
    headers: authHeaders(),
  });
  if (status === 404 || status === 400) {
    return null;
  }
  if (status !== 200) {
    logger.warn({ status, body }, "supabase admin_credentials select failed");
    throw new Error("SUPABASE_QUERY_FAILED");
  }
  const rows = Array.isArray(body) ? (body as Array<{ password_hash: string }>) : [];
  return rows[0]?.password_hash ?? null;
}
import { Router, type NextFunction, type Request, type Response } from "express";
import {
  clientIp,
  clearFailures,
  loginAvailable,
  passwordMatches,
  recordFailure,
  requireAdmin,
  signToken,
} from "../lib/adminAuth";
import { issueMediaTicket } from "./wall";
import { logger } from "../lib/logger";
import {
  fetchWallRow,
  patchWallRow,
  queryWall,
  type WallRow,
} from "../lib/supabase";
import { deleteMedia } from "../lib/storj";

export const adminRouter = Router();

interface AdminListItem {
  id: string;
  name: string;
  caption: string;
  kind: WallRow["kind"];
  mediaType: WallRow["media_type"];
  status: WallRow["status"];
  url: string | null;
  likes: number;
  createdAt: string;
  reviewedAt: string | null;
  sizeBytes: number | null;
  posterUrl: string | null;
  mediaUrl: string | null;
}

function mapForAdmin(row: WallRow): AdminListItem {
  const ticket = issueMediaTicket(row.id);
  const qs = `exp=${ticket.exp}&sig=${ticket.sig}`;
  const hasStored =
    row.media_type === "link" ? false : Boolean(row.poster_key || row.media_key);
  return {
    id: row.id,
    name: row.name,
    caption: row.caption ?? "",
    kind: row.kind,
    mediaType: row.media_type,
    status: row.status,
    url: row.link_url,
    likes: row.likes ?? 0,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at,
    sizeBytes: row.size_bytes,
    posterUrl:
      hasStored && row.poster_key
        ? `/api/wall/media/${row.id}/poster?${qs}`
        : hasStored && row.media_type === "image"
          ? `/api/wall/media/${row.id}/poster?${qs}`
          : null,
    mediaUrl:
      row.media_type === "video" && row.media_key
        ? `/api/wall/media/${row.id}/video?${qs}`
        : null,
  };
}

// ---------------------------------------------------------------------------
// login (unprotected)
// ---------------------------------------------------------------------------

adminRouter.post("/admin/login",
  async (req: Request, res: Response) => {
    const ip = clientIp(req);
    const availability = loginAvailable(ip);
    if (!availability.allowed) {
      res
        .status(429)
        .setHeader("Retry-After", String(availability.retryAfterSeconds))
        .json({ error: "rate_limited", retryAfterSeconds: availability.retryAfterSeconds });
      return;
    }
    const password = String(req.body?.["password"] ?? "");
    let ok: boolean;
    try {
      ok = await passwordMatches(password);
    } catch (err) {
      logger.error({ err }, "admin login: credential check unavailable");
      res.status(503).json({ error: "auth_unavailable" });
      return;
    }
    if (!ok) {
      recordFailure(ip);
      logger.warn({ ip }, "admin login failed");
      res.status(401).json({ error: "wrong_password" });
      return;
    }
    clearFailures(ip);
    const { token, expiresAt } = signToken();
    logger.info("admin login success");
    res.json({ token, expiresAt });
  },
);

// everything below requires a valid token
adminRouter.use("/admin", (req: Request, res: Response, next: NextFunction) => {
  requireAdmin(req, res, (err?: unknown) => {
    if (err) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    next();
  });
});

adminRouter.get("/admin/status", async (_req: Request, res: Response) => {
  const [pending, approved, rejected] = await Promise.all([
    queryWall("id", { status: "eq.pending" }, "created_at.desc"),
    queryWall("id", { status: "eq.approved" }, "created_at.desc"),
    queryWall("id", { status: "eq.rejected" }, "created_at.desc"),
  ]);
  res.json({ pending: pending.length, approved: approved.length, rejected: rejected.length });
});

adminRouter.get("/admin/wall", async (req: Request, res: Response) => {
  const status = String(req.query["status"] ?? "pending");
  const valid = new Set(["pending", "approved", "rejected"]);
  const rows = await queryWall(
    "*",
    valid.has(status) ? { status: `eq.${status}` } : {},
    "created_at.desc",
  );
  res.json({ items: rows.map(mapForAdmin) });
});

adminRouter.post("/admin/wall/:id/approve", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await fetchWallRow(String(req.params["id"]));
    if (!row) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    await patchWallRow(row.id, {
      status: "approved",
      reviewed_at: new Date().toISOString(),
      reviewer: "admin",
    });
    res.json({ ok: true, item: mapForAdmin({ ...row, status: "approved" }) });
  } catch (e) {
    next(e);
  }
});

adminRouter.post("/admin/wall/:id/reject", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await fetchWallRow(String(req.params["id"]));
    if (!row) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    await patchWallRow(row.id, {
      status: "rejected",
      reviewed_at: new Date().toISOString(),
      reviewer: "admin",
    });
    // remove stored media; keep the row as audit trail
    await deleteMedia({
      provider: row.provider,
      bucket: row.bucket,
      key: row.poster_key,
    });
    await deleteMedia({
      provider: row.provider,
      bucket: row.bucket,
      key: row.media_key,
    });
    res.json({ ok: true, item: mapForAdmin({ ...row, status: "rejected" }) });
  } catch (e) {
    next(e);
  }
});
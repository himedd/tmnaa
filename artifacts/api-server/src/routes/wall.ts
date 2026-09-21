import { Router, type Request, type Response } from "express";
import multer from "multer";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { canUpload, clientIp } from "../lib/adminAuth";
import { logger } from "../lib/logger";
import {
  fetchWallRow,
  insertWallRow,
  queryWall,
  type WallRow,
} from "../lib/supabase";
import {
  deleteMedia,
  downloadMedia,
  getAccount,
  uploadMedia,
} from "../lib/storj";

export const wallRouter = Router();

const MAX_IMAGE_MB = Number(process.env["MAX_IMAGE_MB"] || "12");
const MAX_VIDEO_MB = Number(process.env["MAX_VIDEO_MB"] || "5000");
const MAX_POSTER_BYTES = 4 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_VIDEO_MB * 1024 * 1024 },
});

const NAME_MAX = 40;
const CAPTION_MAX = 180;

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function mapToPublic(row: WallRow) {
  const signed = row.status === "approved";
  return {
    id: row.id,
    name: row.name,
    caption: row.caption ?? "",
    kind: row.kind,
    mediaType: row.media_type,
    likes: row.likes ?? 0,
    createdAt: row.created_at,
    url: row.link_url,
    posterUrl: signed
      ? (row.media_type === "link"
          ? null
          : `/api/wall/media/${row.id}/poster`)
      : null,
    mediaUrl:
      signed && row.media_type === "video"
        ? `/api/wall/media/${row.id}/video`
        : null,
  };
}

function magicOk(buffer: Buffer, mime: string | undefined): boolean {
  if (!mime) return false;
  if (mime.startsWith("image/")) {
    const b = buffer;
    if (mime === "image/jpeg") return b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
    if (mime === "image/png") return b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
    if (mime === "image/webp") return b.length > 12 && b.toString("latin1", 0, 4) === "RIFF" && b.toString("latin1", 8, 12) === "WEBP";
    if (mime === "image/gif") return b.length > 4 && b.toString("latin1", 0, 4) === "GIF8";
    return false;
  }
  if (mime.startsWith("video/")) {
    const b = buffer;
    if (mime === "video/mp4" || mime === "video/quicktime")
      return b.length > 12 && b.toString("latin1", 4, 8) === "ftyp";
    if (mime === "video/webm")
      return b.length > 4 && b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3;
    return false;
  }
  return false;
}

function dataUrlToBuffer(dataUrl: string): Buffer | null {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,(.*)$/s.exec(dataUrl);
  if (!m) return null;
  try {
    const buf = Buffer.from(m[2], "base64");
    if (buf.length > MAX_POSTER_BYTES) return null;
    return buf;
  } catch {
    return null;
  }
}

// Media tickets: pending/rejected items' media is streamed only by someone
// holding a short-lived HMAC ticket (issued to the logged-in admin).
const SIGN_SECRET = process.env["ADMIN_JWT_SECRET"] ?? "";

export function issueMediaTicket(id: string): { exp: number; sig: string } {
  const exp = Math.floor(Date.now() / 1000) + 60 * 60;
  const sig = createHmac("sha256", SIGN_SECRET)
    .update(`media:${id}:${exp}`)
    .digest("hex");
  return { exp, sig };
}

function verifyMediaTicket(
  id: string,
  exp: number,
  sig: string,
): boolean {
  if (!SIGN_SECRET || !Number.isFinite(exp)) return false;
  if (exp < Math.floor(Date.now() / 1000)) return false;
  const expected = createHmac("sha256", SIGN_SECRET)
    .update(`media:${id}:${exp}`)
    .digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(sig, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function mediaAccess(req: Request, row: WallRow): boolean {
  if (row.status === "approved") return true;
  const exp = Number(req.query["exp"]);
  const sig = String(req.query["sig"] ?? "");
  return verifyMediaTicket(row.id, exp, sig);
}

function streamStored(
  res: Response,
  stored: { provider: number | null; bucket: string | null; key: string | null },
  rangeHeader: string | undefined,
  defaultContentType: string,
): void {
  if (!stored.provider || !stored.bucket || !stored.key) {
    res.status(404).json({ error: "media_not_found" });
    return;
  }
  const provider = stored.provider;
  const bucket = stored.bucket;
  const key = stored.key;
  void (async () => {
    const obj = await downloadMedia(
      { provider, bucket, key },
      rangeHeader,
    );
    if (!obj || !obj.stream) {
      res.status(404).json({ error: "media_unavailable" });
      return;
    }
    const type = obj.contentType || defaultContentType;
    if (rangeHeader && obj.contentRange) {
      res.status(206);
      res.setHeader("Content-Range", obj.contentRange);
      if (obj.contentLength != null) res.setHeader("Content-Length", String(obj.contentLength));
    } else {
      res.status(200);
      if (obj.contentLength != null) res.setHeader("Content-Length", String(obj.contentLength));
    }
    res.setHeader("Content-Type", type);
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    const stream = obj.stream as import("node:stream").Readable;
    stream.on("error", () => res.destroy());
    stream.pipe(res);
  })();
}

// ---------------------------------------------------------------------------
// public wall (approved only)
// ---------------------------------------------------------------------------

wallRouter.get("/wall", async (_req, res) => {
  const rows = await queryWall(
    "*",
    { status: "eq.approved" },
    "created_at.desc",
  );
  res.json({ items: rows.map(mapToPublic) });
});

// ---------------------------------------------------------------------------
// submissions
// ---------------------------------------------------------------------------

function prepareRequest(
  name: unknown,
  caption: unknown,
): { name: string; caption: string } | null {
  const n = String(name ?? "").trim();
  const c = String(caption ?? "").trim();
  if (!n || n.length > NAME_MAX) return null;
  if (c.length > CAPTION_MAX) return null;
  return { name: n, caption: c };
}

wallRouter.post("/wall/upload", (req, res, next) => {
  upload.single("file")(req, res, async (err: unknown) => {
    if (err) {
      logger.warn({ err }, "multer rejected upload");
      next(err as Error);
      return;
    }
    const ip = clientIp(req);
    const throttle = canUpload(ip);
    if (!throttle.ok) {
      res.status(429).json({ error: "too_many_uploads" });
      return;
    }
    try {
      const file = req.file as Express.Multer.File | undefined;
      if (!file) {
        res.status(400).json({ error: "missing_file" });
        return;
      }
      const req2 = prepareRequest(req.body["name"], req.body["caption"]);
      if (!req2) {
        res.status(400).json({ error: "invalid_fields" });
        return;
      }
      const mime = file.mimetype;
      if (!magicOk(file.buffer, mime)) {
        res.status(400).json({ error: "unsupported_file" });
        return;
      }
      const isImage = mime.startsWith("image/");
      const isVideo = mime.startsWith("video/");
      if (isImage && file.size > MAX_IMAGE_MB * 1024 * 1024) {
        res.status(413).json({ error: "image_too_large" });
        return;
      }

      const id = randomUUID();
      const poster = isVideo
        ? dataUrlToBuffer(String(req.body["poster"] ?? ""))
        : null;

      // Store the media first, then the poster, then the DB row. On any
      // failure, clean up whatever got stored.
      const storedMedia = await uploadMedia(file.buffer, mime, `${id}/media`);
      let storedPoster: Awaited<ReturnType<typeof uploadMedia>> | null = null;
      try {
        if (poster) {
          storedPoster = await uploadMedia(poster, "image/jpeg", `${id}/poster`);
        }
        const row = await insertWallRow({
          id,
          name: req2.name,
          caption: req2.caption,
          kind: "upload",
          media_type: isVideo ? "video" : "image",
          status: "pending",
          provider: storedMedia.provider,
          bucket: storedMedia.bucket,
          media_key: storedMedia.key,
          poster_key: storedPoster?.key ?? null,
          size_bytes: file.size,
        });
        res.status(201).json({ item: mapToPublic(row) });
      } catch (inner) {
        void deleteMedia(storedMedia);
        if (storedPoster) void deleteMedia(storedPoster);
        throw inner;
      }
    } catch (e) {
      next(e as Error);
    }
  });
});

wallRouter.post("/wall/link", async (req, res, next) => {
  try {
    const ip = clientIp(req);
    if (!canUpload(ip).ok) {
      res.status(429).json({ error: "too_many_uploads" });
      return;
    }
    const req2 = prepareRequest(req.body["name"], req.body["caption"]);
    const url = String(req.body["url"] ?? "").trim();
    if (!req2 || !url || !/^https?:\/\/.+/i.test(url) || url.length > 500) {
      res.status(400).json({ error: "invalid_fields" });
      return;
    }
    const row = await insertWallRow({
      id: randomUUID(),
      name: req2.name,
      caption: req2.caption,
      kind: "link",
      media_type: "link",
      status: "pending",
      link_url: url,
      size_bytes: 0,
    });
    res.status(201).json({ item: mapToPublic(row) });
  } catch (e) {
    next(e as Error);
  }
});

// ---------------------------------------------------------------------------
// media proxy
// ---------------------------------------------------------------------------

wallRouter.get("/wall/media/:id/poster", async (req, res, next) => {
  try {
    const row = await fetchWallRow(req.params["id"]);
    if (!row || row.media_type === "link") {
      res.status(404).json({ error: "not_found" });
      return;
    }
    if (!mediaAccess(req, row)) {
      res.status(403).json({ error: "locked" });
      return;
    }
    const key = row.poster_key ?? (row.media_type === "image" ? row.media_key : null);
    const provider = row.poster_key ? row.provider : row.provider;
    streamStored(
      res,
      { provider, bucket: row.bucket, key },
      undefined,
      "image/jpeg",
    );
  } catch (e) {
    next(e as Error);
  }
});

wallRouter.get("/wall/media/:id/video", (req, res, next) => {
  void (async () => {
    const row = await fetchWallRow(req.params["id"]);
    if (!row || row.media_type !== "video" || !row.media_key) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    if (!mediaAccess(req, row)) {
      res.status(403).json({ error: "locked" });
      return;
    }
    streamStored(
      res,
      { provider: row.provider, bucket: row.bucket, key: row.media_key },
      req.headers["range"],
      "video/mp4",
    );
  })().catch((e) => next(e as Error));
});

// ---------------------------------------------------------------------------
// error handling for this router
// ---------------------------------------------------------------------------

export function wallErrorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  next: (err?: unknown) => void,
): void {
  const e = err as { code?: string; message?: string; status?: number };
  if (e?.code === "LIMIT_FILE_SIZE") {
    res.status(413).json({ error: "file_too_large" });
    return;
  }
  const msg = e?.message ?? "unknown";
  if (msg === "STORJ_UPLOAD_FAILED") {
    res.status(502).json({ error: "storage_unavailable" });
    return;
  }
  if (msg === "STORJ_NOT_CONFIGURED") {
    res.status(503).json({ error: "storage_not_configured" });
    return;
  }
  if (msg === "SUPABASE_UNAVAILABLE" || msg === "SUPABASE_INSERT_FAILED") {
    res.status(502).json({ error: "database_unavailable" });
    return;
  }
  next(err);
}

// keep getAccount referenced (public type surface for admin route checks)
void getAccount;
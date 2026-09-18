import { Router, type IRouter, type Request, type Response } from "express";
import {
  getPayloadSnapshot,
  subscribe,
  type FollowerPayload,
} from "../lib/followerCounter";

const HEARTBEAT_MS = 20000;

const router: IRouter = Router();

function toPayload(payload: FollowerPayload): string {
  return JSON.stringify(payload);
}

router.get("/follower-count", (_req, res) => {
  res.json(getPayloadSnapshot());
});

router.get("/follower-count/stream", (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const send = (payload: FollowerPayload) => {
    res.write(`event: count\ndata: ${toPayload(payload)}\n\n`);
  };

  const unsubscribe = subscribe(send);

  const heartbeat = setInterval(() => {
    res.write(": ping\n\n");
  }, HEARTBEAT_MS);

  const cleanup = () => {
    clearInterval(heartbeat);
    unsubscribe();
    res.end();
  };

  req.on("close", cleanup);
  res.on("close", cleanup);
});

export default router;
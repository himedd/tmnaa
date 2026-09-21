import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();

/**
 * Server-side Kick API proxy for browsers that can't call kick.com directly
 * (e.g. when the site is served from a non-listed origin, or Kick's CORS
 * allowlist changes). Mirrors api/kick.ts so the 300K countdown's polling
 * fallback keeps working on this server too.
 */
router.get("/kick", async (req: Request, res: Response) => {
  const endpoint = String(req.query["endpoint"] ?? "");

  if (!endpoint) {
    res.status(400).json({ error: "Endpoint is required" });
    return;
  }

  try {
    const apiResponse = await fetch(endpoint, {
      headers: {
        "Accept": "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      res
        .status(apiResponse.status)
        .json({ error: `Kick API request failed: ${errorText}` });
      return;
    }

    const data = await apiResponse.json();
    res.setHeader("Cache-Control", "no-store");
    res.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: `Internal Server Error: ${message}` });
  }
});

export default router;
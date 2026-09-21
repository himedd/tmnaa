import { apiUrl } from '@/lib/apiBase';

/**
 * Fetches a Kick channel endpoint as JSON. Tries the direct browser call first
 * (Kick's public API reflects the request origin via CORS, so it works from
 * the site), then falls back to the serverless/same-app `/api/kick` proxy for
 * environments where direct access is blocked. Never throws — returns null on
 * total failure so callers can degrade gracefully.
 */
export async function kickFetch(endpoint: string, cacheBust = true): Promise<any> {
  const attempts = [
    endpoint,
    apiUrl(
      `/api/kick?endpoint=${encodeURIComponent(endpoint)}` +
        (cacheBust ? `&cb=${Date.now()}` : ''),
    ),
  ];

  for (const url of attempts) {
    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) {
        throw new Error(`Kick fetch failed with status ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error(`[kickFetch] Failed for ${url}:`, error);
    }
  }
  return null;
}

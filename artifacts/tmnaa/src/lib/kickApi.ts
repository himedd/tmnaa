import { apiUrl } from '@/lib/apiBase';

export async function kickFetch(endpoint: string, cacheBust = true): Promise<any> {
  const proxyUrl = apiUrl(`/api/kick?endpoint=${encodeURIComponent(endpoint)}`);

  try {
    const response = await fetch(proxyUrl, {
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`Proxy failed with status ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`[kickFetch] Failed for ${endpoint}:`, error);
    return null;
  }
}

interface SocialMediaStats {
  instagram?: number;
  tiktok?: number;
  twitter?: number;
  youtube?: number;
  whatsapp?: number;
}

const FALLBACK = {
  instagram: 21300,
  tiktok: 42300,
  twitter: 57200,
  youtube: 74800,
  whatsapp: 9100,
};

async function fetchJson(url: string): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

export async function getInstagramFollowers(username: string): Promise<number> {
  try {
    const data = await fetchJson(`https://api.socialcounts.io/instagram/user/${username}`);
    const count = data?.followers || data?.follower_count || data?.count;
    if (count) return parseInt(String(count).replace(/,/g, '')) || FALLBACK.instagram;
  } catch {}
  return FALLBACK.instagram;
}

export async function getTikTokFollowers(username: string): Promise<number> {
  try {
    const data = await fetchJson(`https://countik.com/api/tiktok/@${username}`);
    const count = data?.followerCount || data?.followers || data?.follower_count;
    if (count) return parseInt(String(count)) || FALLBACK.tiktok;
  } catch {}
  try {
    const data = await fetchJson(`https://api.socialcounts.io/tiktok/user/${username}`);
    const count = data?.followers || data?.follower_count || data?.count;
    if (count) return parseInt(String(count).replace(/,/g, '')) || FALLBACK.tiktok;
  } catch {}
  return FALLBACK.tiktok;
}

export async function getTwitterFollowers(username: string): Promise<number> {
  try {
    const data = await fetchJson(`https://api.socialcounts.io/twitter/user/${username}`);
    const count = data?.followers || data?.follower_count || data?.count;
    if (count) return parseInt(String(count).replace(/,/g, '')) || FALLBACK.twitter;
  } catch {}
  return FALLBACK.twitter;
}

export async function getYouTubeSubscribers(channelId: string): Promise<number> {
  try {
    const data = await fetchJson(`https://pipedapi.kavin.rocks/channel/${channelId}`);
    const count = data?.subscriberCount;
    if (count) return parseInt(String(count)) || FALLBACK.youtube;
  } catch {}
  return FALLBACK.youtube;
}

export async function getWhatsAppSubscribers(): Promise<number> {
  return FALLBACK.whatsapp;
}

export async function getAllSocialMediaStats(): Promise<SocialMediaStats> {
  const [instagram, tiktok, twitter, youtube] = await Promise.all([
    getInstagramFollowers('absq'),
    getTikTokFollowers('iabsq'),
    getTwitterFollowers('iABSq'),
    getYouTubeSubscribers('UCdIM7MB-8G-FgE7ld3XAQ8w'),
  ]);
  return {
    instagram,
    tiktok,
    twitter,
    youtube,
    whatsapp: FALLBACK.whatsapp,
  };
}

export function formatFollowerCount(count: number): string {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M+`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K+`;
  return count.toString();
}

export async function getCachedSocialMediaStats(): Promise<SocialMediaStats> {
  return getAllSocialMediaStats();
}

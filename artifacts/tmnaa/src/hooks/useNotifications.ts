import { useState, useEffect, useCallback, useRef } from 'react';
import { kickFetch } from '@/lib/kickApi';
import { apiUrl } from '@/lib/apiBase';

export interface Notification {
  id: string;
  type: 'live' | 'clip' | 'milestone';
  title: string;
  body: string;
  timestamp: number;
  read: boolean;
  image?: string;
}

const STORAGE_KEY = 'tmnaa_notifications';
const SEEN_CLIPS_KEY = 'tmnaa_seen_clips';

function loadNotifications(): Notification[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>(loadNotifications);
  const wasLiveRef = useRef<boolean | null>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const addNotification = useCallback((n: Notification) => {
    setNotifications((prev) => {
      const next = [n, ...prev].slice(0, 50);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* */ }
      return next;
    });
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => {
      const next = prev.map((n) => ({ ...n, read: true }));
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* */ }
      return next;
    });
  }, []);

  const markRead = useCallback((id: string) => {
    setNotifications((prev) => {
      const next = prev.map((n) => (n.id === id ? { ...n, read: true } : n));
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* */ }
      return next;
    });
  }, []);

  // Live status changes
  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch(apiUrl('/api/kick?endpoint=' + encodeURIComponent('https://kick.com/api/v2/channels/tmnaa')));
        if (!res.ok) return;
        const data = await res.json();
        const isLive = data?.livestream !== null && data?.livestream !== undefined;

        if (wasLiveRef.current === false && isLive) {
          addNotification({
            id: `live-${Date.now()}`,
            type: 'live',
            title: '🔴 LIVE NOW',
            body: data?.livestream?.session_title || 'Stream is live!',
            timestamp: Date.now(),
            read: false,
          });
        }
        wasLiveRef.current = isLive;
      } catch { /* */ }
    };
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, [addNotification]);

  // New clips
  useEffect(() => {
    let seen: Set<string>;
    try {
      const raw = localStorage.getItem(SEEN_CLIPS_KEY);
      seen = new Set(raw ? JSON.parse(raw) : []);
    } catch { seen = new Set(); }

    const checkClips = async () => {
      try {
        const raw = await kickFetch(`https://kick.com/api/v2/channels/tmnaa/clips`);
        if (!raw) return;
        const data = raw?.data || raw;
        const arr: any[] = data?.clips || (Array.isArray(data) ? data : data?.data && Array.isArray(data.data) ? data.data : []);

        for (const clip of arr.slice(0, 3)) {
          if (!seen.has(clip.id)) {
            seen.add(clip.id);
            addNotification({
              id: `clip-${clip.id}`,
              type: 'clip',
              title: '🎬 New Clip',
              body: clip.title || 'New clip published',
              timestamp: Date.now(),
              read: false,
              image: clip.thumbnail_url,
            });
          }
        }
        try { localStorage.setItem(SEEN_CLIPS_KEY, JSON.stringify([...seen])); } catch { /* */ }
      } catch { /* */ }
    };

    checkClips();
    const interval = setInterval(checkClips, 60000);
    return () => clearInterval(interval);
  }, [addNotification]);

  return { notifications, unreadCount, addNotification, markAllRead, markRead };
}

import Pusher from 'pusher-js';
import { ChatMessage } from '@/lib/types';

type MessageCallback = (message: ChatMessage) => void;
type StatusCallback = (isConnected: boolean, error?: boolean, details?: string) => void;

const getRoleFromIdentity = (identity: any): 'owner' | 'moderator' | 'vip' | 'user' => {
  if (!identity || !identity.badges) return 'user';
  const badges = identity.badges;
  if (badges.some((b: any) => b.type === 'broadcaster')) return 'owner';
  if (badges.some((b: any) => b.type === 'moderator')) return 'moderator';
  if (badges.some((b: any) => b.type === 'vip')) return 'vip';
  return 'user';
};

class ChatService {
  private isConnected = false;
  private listeners: MessageCallback[] = [];
  private deleteListeners: ((id: string) => void)[] = [];
  private statusListeners: StatusCallback[] = [];
  private pusher: any = null;
  private channel: any = null;
  private connectionId = 0;

  private KNOWN_CHATROOM_IDS: Record<string, number> = {};

  async getChatroomId(channelSlug: string): Promise<number | null> {
    const slug = channelSlug.toLowerCase().trim();
    if (this.KNOWN_CHATROOM_IDS[slug]) return this.KNOWN_CHATROOM_IDS[slug];

    const cachedId = localStorage.getItem(`kick_chatroom_id_${slug}`);
    if (cachedId) return parseInt(cachedId);

    const proxies = [
      `https://kick.com/api/v1/channels/${slug}`,
      `https://api.allorigins.win/get?url=${encodeURIComponent(`https://kick.com/api/v2/channels/${slug}`)}`,
      `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(`https://kick.com/api/v2/channels/${slug}`)}`,
    ];

    try {
      const result = await Promise.any(
        proxies.map(async (proxyUrl) => {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 8000);
          const response = await fetch(proxyUrl, { signal: controller.signal });
          if (!response.ok) {
            clearTimeout(timeoutId);
            throw new Error(`Failed with status ${response.status}`);
          }
          const rawData = await response.json();
          clearTimeout(timeoutId);
          const data = proxyUrl.includes('allorigins') ? JSON.parse(rawData.contents) : rawData;
          let foundId = data?.chatroom?.id || data?.id;
          if (foundId) {
            localStorage.setItem(`kick_chatroom_id_${slug}`, foundId.toString());
            return foundId;
          }
          throw new Error('No ID found');
        })
      );
      if (result) return result;
    } catch {
      console.warn(`[ChatService] All proxies failed for ${slug}.`);
    }
    return null;
  }

  async connect(channelSlug: string = 'tmnaa') {
    const slug = channelSlug.toLowerCase().trim();
    this.disconnect();
    const myConnectionId = this.connectionId;
    this.notifyStatus(false, false, 'Connecting...');

    try {
      const chatroomId = await this.getChatroomId(slug);
      if (this.connectionId !== myConnectionId) return;
      if (!chatroomId) throw new Error('Channel not found');

      const PusherClient = (Pusher as any).default || Pusher;
      this.pusher = new PusherClient('32cbd69e4b950bf97679', {
        cluster: 'us2',
        forceTLS: true,
        enabledTransports: ['ws', 'wss'],
      });

      this.channel = this.pusher.subscribe(`chatrooms.${chatroomId}.v2`);

      this.channel.bind('App\\Events\\ChatMessageEvent', (data: any) => {
        const message: ChatMessage = {
          id: data.id || Math.random().toString(36).substr(2, 9),
          user: {
            id: data.sender?.id || '0',
            username: data.sender?.username || 'Unknown',
            color: data.sender?.identity?.color || '#31d6d6',
            avatar: data.sender?.profile_pic || '',
          },
          content: data.content || '',
          role: getRoleFromIdentity(data.sender?.identity),
          timestamp: Date.now(),
        };
        this.listeners.forEach((cb) => {
          try { cb(message); } catch {}
        });
      });

      this.channel.bind('App\\Events\\MessageDeletedEvent', (data: any) => {
        const messageId = data.message?.id;
        if (messageId) this.deleteListeners.forEach((cb) => cb(messageId));
      });

      this.pusher.connection.bind('connected', () => {
        if (this.connectionId !== myConnectionId) return;
        this.isConnected = true;
        this.notifyStatus(true, false, 'Connected');
      });

      this.pusher.connection.bind('error', () => {
        if (this.connectionId !== myConnectionId) return;
        this.notifyStatus(false, true, 'Connection error');
      });

      this.pusher.connection.bind('state_change', (states: any) => {
        console.log('[ChatService] Connection State:', states.current);
      });
    } catch (error: any) {
      if (this.connectionId !== myConnectionId) return;
      this.notifyStatus(false, true, error.message);
    }
  }

  onMessage(callback: MessageCallback) {
    this.listeners.push(callback);
    return () => { this.listeners = this.listeners.filter((cb) => cb !== callback); };
  }

  onDeleteMessage(callback: (id: string) => void) {
    this.deleteListeners.push(callback);
    return () => { this.deleteListeners = this.deleteListeners.filter((cb) => cb !== callback); };
  }

  clearListeners() {
    this.listeners = [];
    this.deleteListeners = [];
  }

  onStatusChange(callback: StatusCallback) {
    this.statusListeners.push(callback);
    return () => { this.statusListeners = this.statusListeners.filter((cb) => cb !== callback); };
  }

  private notifyStatus(connected: boolean, error: boolean, details: string) {
    this.statusListeners.forEach((cb) => cb(connected, error, details));
  }

  async fetchKickAvatar(username: string): Promise<string> {
    try {
      const slug = username.toLowerCase().trim().replace('@', '');
      const proxies = [
        `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(`https://kick.com/api/v2/channels/${slug}`)}`,
        `https://api.allorigins.win/get?url=${encodeURIComponent(`https://kick.com/api/v2/channels/${slug}`)}`,
      ];
      const result = await Promise.any(
        proxies.map(async (proxyUrl) => {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 8000);
          const response = await fetch(proxyUrl, { cache: 'no-store', signal: controller.signal });
          if (!response.ok) { clearTimeout(timeoutId); throw new Error(`HTTP ${response.status}`); }
          const rawData = await response.json();
          clearTimeout(timeoutId);
          const data = proxyUrl.includes('allorigins') ? JSON.parse(rawData.contents) : rawData;
          const avatar = data.user?.profile_pic || data.profile_pic || data.user?.profilepic || '';
          if (avatar && avatar.includes('http')) return avatar;
          throw new Error('No avatar found');
        })
      );
      if (result) return result;
    } catch {}
    return '';
  }

  disconnect() {
    this.connectionId++;
    if (this.channel) { this.channel.unbind_all(); this.channel.unsubscribe(); this.channel = null; }
    if (this.pusher) { this.pusher.unbind_all(); this.pusher.disconnect(); this.pusher = null; }
    this.isConnected = false;
  }
}

export const chatService = new ChatService();

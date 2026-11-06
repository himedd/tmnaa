
import Pusher from 'pusher-js';
import { ChatBadge, ChatMessage } from '../types';

type MessageCallback = (message: ChatMessage) => void;
type StatusCallback = (isConnected: boolean, error?: boolean, details?: string) => void;

/** بيانات اعتماد Pusher قد تتغيّر من كيك، لذا تُجلب ديناميكياً وتُخزَّن 6 ساعات */
const REALTIME_CONNECTION_URL = 'https://web.kick.com/api/v1/realtime/connection';
const CREDENTIALS_CACHE_KEY = 'kick_pusher_credentials';
const CREDENTIALS_TTL_MS = 6 * 3600_000;
const PUSHER_FALLBACK = { key: '34bf7a0ff419a2a775b9', cluster: 'us2' };
/** المفتاح المرفوض يردّ بهذه الأكواد — عندها يجب مسح الكاش وجلب مفتاح جديد */
const INVALID_KEY_CODES = [4001, 4000];

/** رقم غرفة الشات يُتحقّق منه عند كيك أولاً؛ الكاش صالح 12 ساعة ثم يُعاد تأكيده */
const CHATROOM_CACHE_PREFIX = 'kick_chatroom_v2_';
const CHATROOM_TTL_MS = 12 * 3600_000;

/**
 * أنواع الشارات كما تُعرّفها كيك نفسها (مأخوذة من حزمة نصوص الهوية في موقعها):
 * broadcaster / moderator / staff / vip / og / founder / kick_founder22 / kick_whale /
 * sidekick / early_follower / sub_gifter / kicks_gifter / subscriber / verified / bot / level
 */
const BADGE_ALIASES: Record<string, string> = {
  mod: 'moderator', mods: 'moderator', executor: 'moderator', channel_mod: 'moderator',
  owner: 'broadcaster', channel_owner: 'broadcaster', caster: 'broadcaster',
  admin: 'staff', team: 'staff',
  sub: 'subscriber', subscriber_badge: 'subscriber',
  gifter: 'sub_gifter', gifted_sub: 'sub_gifter', gifted_subs: 'sub_gifter',
  og_kick: 'og', early: 'early_follower', founder_22: 'kick_founder22', whale: 'kick_whale',
  verified_account: 'verified', trust: 'verified',
  botrix: 'bot', assistant: 'bot', xp: 'level', chat_level: 'level',
};

/** أدوار عامة تصل مع الحدث وليست شارة تُعرض */
const BADGE_NOISE = new Set(['member', 'viewer', 'user', 'public', 'default', 'none', 'registered', 'follower']);

/** ترتيب العرض: الأدوار الثقيلة أولاً حتى تُقرأ الهوية في لمحة */
const BADGE_ORDER = ['broadcaster', 'op', 'staff', 'moderator', 'founder', 'kick_founder22', 'vip', 'og', 'sidekick',
  'kicks_gifter', 'sub_gifter', 'kick_whale', 'subscriber', 'verified', 'bot', 'level', 'early_follower', 'chat_identity'];

/** الأنواع التي للواجهة رسمٌ معروف بها — ما عداها من الشارات الدعائية لا يُعرض */
const DRAWN_BADGES = new Set(BADGE_ORDER);

const normType = (raw: unknown): string => {
  const key = String(raw ?? '').toLowerCase().trim().replace(/[\s-]+/g, '_');
  if (!key || BADGE_NOISE.has(key)) return '';
  return BADGE_ALIASES[key] || key;
};

const isBotAccount = (username: string): boolean => /^(botrix|kickassistant|nightbot|moobot)/i.test(username.trim());

const getRoleFromBadges = (types: Set<string>): 'owner' | 'moderator' | 'vip' | 'user' => {
  if (types.has('broadcaster')) return 'owner';
  if (types.has('moderator') || types.has('staff') || types.has('op')) return 'moderator';
  if (types.has('vip')) return 'vip';
  return 'user';
};

/**
 * كيك يرسل الشارات في قائمتين داخل `sender.identity`:
 * `badges` القديمة للأدوار ({type, text, count}) و`badges_v2` الجديدة ({name, metadata})
 * وفيها مستوى الدردشة وشعارات عالمية لا تعرف الواجهة رسمها فتُتجاهل.
 * تُجمع الاثنتان في قائمة واحدة بلا تكرار.
 */
const collectBadges = (sender: any, data: any, username: string): ChatBadge[] => {
  const identity = sender?.identity || data?.identity || {};
  const found = new Map<string, ChatBadge>();
  const push = (rawType: unknown, rawVersion?: unknown) => {
    const type = normType(rawType);
    if (!type) return;
    const version = String(rawVersion ?? '').replace(/[^0-9]/g, '').replace(/^0+(?=\d)/, '');
    const prev = found.get(type);
    if (!prev || (version && !(prev.version || ''))) found.set(type, { type, version: version || undefined });
  };

  const arrays = [identity?.badges, sender?.badges, data?.badges, data?.message?.sender?.badges, data?.sender?.identity?.badges];
  for (const arr of arrays) {
    if (!Array.isArray(arr)) continue;
    for (const b of arr) {
      if (typeof b === 'string') push(b);
      else push(b?.type ?? b?.name ?? b?.slug, b?.count ?? b?.version ?? b?.text);
    }
  }

  for (const b of Array.isArray(identity?.badges_v2) ? identity.badges_v2 : []) {
    const type = normType(b?.name);
    if (!DRAWN_BADGES.has(type)) continue;
    push(type, b?.metadata?.level ?? b?.count);
  }

  const single = identity?.badge ?? sender?.badge ?? data?.badge;
  if (typeof single === 'string' && single.trim()) for (const part of single.split(/[,+|/]/)) push(part);
  else if (single && typeof single === 'object') push(single.type ?? single.name, single.count ?? single.version);

  for (const role of [sender?.role?.type, sender?.role, ...(Array.isArray(sender?.roles) ? sender.roles.map((r: any) => r?.type ?? r) : [])]) push(role);

  if (identity?.is_vip || sender?.is_vip || data?.is_vip) push('vip');
  if (identity?.verified || sender?.verified || sender?.is_verified) push('verified');

  const months = Number(sender?.subscription?.months ?? identity?.subscription?.months ?? data?.subscription?.months ?? 0);
  if (months > 0) push('subscriber', String(months));
  else if (identity?.is_subscriber || sender?.is_subscriber) push('subscriber');

  if (isBotAccount(username)) push('bot');

  const ordered = [...found.values()].sort((a, b) => {
    const ia = BADGE_ORDER.indexOf(a.type);
    const ib = BADGE_ORDER.indexOf(b.type);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  const capped = ordered.slice(0, 5);
  // مستوى الدردشة لا يسقط أمام زحمة الشارات: يعود مكان آخر خانة إن كان السقف قد امتلأ
  const level = ordered.find(b => b.type === 'level');
  if (level && capped.length === 5 && !capped.includes(level)) capped[4] = level;
  return capped;
};

const normalizeUrl = (value: string): string => {  if (value.startsWith('//')) return `https:${value}`;
  if (value.startsWith('/')) return `https://kick.com${value}`;
  if (!/^https?:\/\//i.test(value)) return `https://kick.com/${value}`;
  return value;
};

const pickAvatar = (sender: any): string => {
  const candidates = [
    sender?.profilepic, sender?.profile_pic, sender?.profile_pic_url,
    sender?.profilePic, sender?.avatar?.url, sender?.avatar_url,
    sender?.user?.profilepic, sender?.user?.profile_pic,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.includes('http')) return c;
  }
  const anyUrl = Object.values(sender || {}).find(
    (v): v is string => typeof v === 'string' && /^https?:\/\/.+\.(jpg|jpeg|png|webp)/i.test(v)
  );
  return anyUrl || '';
};

/** fetch بمهلة — بلا بروكسي يعني طلب معلق يوقف سلسلة إعادة الاتصال */
const fetchWithTimeout = (url: string, init: RequestInit = {}, ms = 8000): Promise<Response> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
};

const parseProxyPayload = (rawUrl: string, json: any): any => {
  if (rawUrl.includes('allorigins')) {
    return typeof json?.contents === 'string' ? JSON.parse(json.contents) : json?.contents || json;
  }
  return json;
};

class ChatService {
  private isConnected: boolean = false;
  private listeners: MessageCallback[] = [];
  private deleteListeners: ((id: string) => void)[] = [];
  private statusListeners: StatusCallback[] = [];
  private pusher: any = null;
  private channel: any = null;

  private KNOWN_CHATROOM_IDS: Record<string, number> = {
    // احتياط عند تعذّر الطلب من كيك — المرجع هو الـ API أولاً حتى لا يبقى رقم خاطئ حيّاً للأبد
    'tmnaa': 5634197,
    'xeid': 5945902,
  };

  private connectionId = 0;
  private isConnecting = false;
  private autoReconnect = true;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private safetyTimer: ReturnType<typeof setTimeout> | null = null;
  private healthTimer: ReturnType<typeof setInterval> | null = null;
  private currentChatroomId: number | null = null;
  private credentials: { key: string; cluster: string } | null = null;
  private seenMessageIds = new Set<string>();

  /** الكاش القديم كان يُقرأ بلا طابع زمني، فيبقي رقماً خاطئاً إلى الأبد */
  private dropLegacyCache(slug: string) {
    try { localStorage.removeItem(`kick_chatroom_id_${slug}`); } catch { /* التخزين محظور */ }
  }

  private readCache(slug: string): { id: number; ts: number } | null {
    try {
      const raw = localStorage.getItem(CHATROOM_CACHE_PREFIX + slug);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return Number.isInteger(parsed?.id) && parsed.id > 0 ? { id: parsed.id, ts: parsed.ts || 0 } : null;
    } catch { return null; }
  }

  private writeCache(slug: string, id: number) {
    try { localStorage.setItem(CHATROOM_CACHE_PREFIX + slug, JSON.stringify({ id, ts: Date.now() })); } catch { /* التخزين محظور */ }
  }

  async getChatroomId(channelSlug: string): Promise<number | null> {
    const slug = channelSlug.toLowerCase().trim();
    this.dropLegacyCache(slug);

    const chatroomUrl = `https://kick.com/api/v2/channels/${slug}/chatroom`;
    const channelUrl = `https://kick.com/api/v2/channels/${slug}`;
    const attempts = [
      // كيك يفتح القراءة للمتصفح عبر CORS — المباشر أولاً وأسرع وسيط داخلي بعدها
      { url: chatroomUrl, shape: 'chatroom' as const, wrapped: false },
      { url: `/api/kick?endpoint=${encodeURIComponent(chatroomUrl)}`, shape: 'chatroom' as const, wrapped: false },
      // بيانات القناة تحمل الرقم داخل chatroom.id — مخرج لو كيك أقفلت مسار الغرفة
      { url: channelUrl, shape: 'channel' as const, wrapped: false },
      { url: `/api/kick?endpoint=${encodeURIComponent(channelUrl)}`, shape: 'channel' as const, wrapped: false },
      { url: `https://api.allorigins.win/raw?url=${encodeURIComponent(chatroomUrl)}`, shape: 'chatroom' as const, wrapped: true },
      { url: `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(chatroomUrl)}`, shape: 'chatroom' as const, wrapped: true },
    ];

    try {
      const found = await Promise.any(attempts.map(async ({ url, shape, wrapped }) => {
        const res = await fetchWithTimeout(url, { headers: { Accept: 'application/json' } }, 6000);
        if (!res.ok) throw new Error(`status ${res.status}`);
        const json = await res.json();
        const data = wrapped ? parseProxyPayload(url, json) : json;
        // مسار القناة يُرجع id = معرّف القناة نفسه؛ أخذه يفتح غرفة وهمية صامتة إلى الأبد
        const rawId = shape === 'channel'
          ? (data?.chatroom?.id ?? data?.data?.chatroom?.id)
          : (data?.chatroom?.id ?? data?.id ?? data?.data?.chatroom?.id ?? data?.data?.id);
        const id = Number(rawId);
        if (!Number.isInteger(id) || id <= 0) throw new Error('no chatroom id');
        this.writeCache(slug, id);
        return id;
      }));
      return found;
    } catch {
      console.warn(`[ChatService] Live chatroom lookup failed for ${slug}; falling back to cache/table.`);
    }

    // لا شبكة: الكاش الصالح، ثم الجدول الثابت، ثم أي كاش قديم
    const cached = this.readCache(slug);
    if (cached && Date.now() - cached.ts < CHATROOM_TTL_MS) return cached.id;
    if (this.KNOWN_CHATROOM_IDS[slug]) return this.KNOWN_CHATROOM_IDS[slug];
    return cached?.id ?? null;
  }

  /** الجلب من web.kick.com يعكس Origin في CORS، فلا يحتاج وسيطاً */
  private async fetchCredentials(forceRefresh = false): Promise<{ key: string; cluster: string }> {
    if (!forceRefresh) {
      if (this.credentials) return this.credentials;
      try {
        const raw = localStorage.getItem(CREDENTIALS_CACHE_KEY);
        if (raw) {
          const cached = JSON.parse(raw);
          if (cached?.app_key && cached.cluster && Date.now() - (cached.ts || 0) < CREDENTIALS_TTL_MS) {
            this.credentials = { key: cached.app_key, cluster: cached.cluster };
            return this.credentials;
          }
        }
      } catch { /* كاش تالف */ }
    }

    try {
      const res = await fetchWithTimeout(REALTIME_CONNECTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'x-app-platform': 'web',
        },
        body: JSON.stringify({
          client: { id: crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`, type: 'web' },
          capabilities: { accepted_providers: [{ provider: 'pusher' }] },
        }),
      }, 6000);
      if (!res.ok) throw new Error(`status ${res.status}`);
      const json = await res.json();
      const pusherConn = json?.data?.connections?.find((c: any) => c?.provider === 'pusher');
      const app_key = pusherConn?.credentials?.app_key;
      const cluster = pusherConn?.credentials?.cluster || PUSHER_FALLBACK.cluster;
      if (!app_key) throw new Error('no pusher credentials');
      this.credentials = { key: app_key, cluster };
      localStorage.setItem(CREDENTIALS_CACHE_KEY, JSON.stringify({ app_key, cluster, ts: Date.now() }));
      return this.credentials;
    } catch (e) {
      console.warn('[ChatService] Credential fetch failed, using fallback key.', e);
      this.credentials = PUSHER_FALLBACK;
      return PUSHER_FALLBACK;
    }
  }

  /** مفتاح مرفوض (4001/4000) = الكاش صار قديماً — امسحه ليُجلب جديد في المحاولة التالية */
  private invalidateCredentials() {
    this.credentials = null;
    try { localStorage.removeItem(CREDENTIALS_CACHE_KEY); } catch { /* التخزين محظور */ }
  }

  private clearTimers() {
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    if (this.safetyTimer) { clearTimeout(this.safetyTimer); this.safetyTimer = null; }
    if (this.healthTimer) { clearInterval(this.healthTimer); this.healthTimer = null; }
  }

  private scheduleReconnect(myConnectionId: number) {
    if (!this.autoReconnect || this.connectionId !== myConnectionId) return;
    if (this.reconnectTimer) return;
    const delay = Math.min(1500 * Math.pow(1.5, this.reconnectAttempts), 15000);
    this.reconnectAttempts++;
    this.notifyStatus(false, false, `إعادة المحاولة بعد ${Math.round(delay / 1000)} ث`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.connectionId === myConnectionId) this.openPusher(myConnectionId, true);
    }, delay);
  }

  private startHealthCheck(myConnectionId: number) {
    if (this.healthTimer) clearInterval(this.healthTimer);
    // حالة اتصال كاذبة (كيبل مقطوع، تبويب معلّق) تُكشف هنا لا بالرسائل
    this.healthTimer = setInterval(() => {
      if (this.connectionId !== myConnectionId) return;
      const state = this.pusher?.connection?.state;
      if (state && state !== 'connected') {
        console.warn(`[ChatService] Health check found state=${state}; reconnecting.`);
        this.openPusher(myConnectionId, true);
      }
    }, 10_000);
  }

  private openPusher(myConnectionId: number, forceCredentialRefresh = false) {
    if (this.connectionId !== myConnectionId || !this.currentChatroomId) return;

    this.cleanupPusher();
    void (async () => {
      const creds = await this.fetchCredentials(forceCredentialRefresh);
      if (this.connectionId !== myConnectionId) return;

      const PusherClient = (Pusher as any).default || Pusher;
      this.pusher = new PusherClient(creds.key, {
        cluster: creds.cluster,
        forceTLS: true,
        enabledTransports: ['ws', 'wss'],
        disabledTransports: ['xhr_polling', 'xhr_streaming'],
        statsTimeout: 0,
        pongTimeout: 30000,
        wsTimeout: 30000,
        maxRetries: 9999,
        loopBackTimer: 2000,
      });

      this.channel = this.pusher.subscribe(`chatrooms.${this.currentChatroomId}.v2`);

      this.channel.bind('App\\Events\\ChatMessageEvent', (data: any) => {
        if (this.connectionId !== myConnectionId) return;
        const id = data?.id || Math.random().toString(36).slice(2, 11);
        if (this.seenMessageIds.has(id)) return;
        this.seenMessageIds.add(id);
        if (this.seenMessageIds.size > 500) {
          this.seenMessageIds = new Set([...this.seenMessageIds].slice(-250));
        }

        const sender = data?.sender || data?.user || {};
        const username = sender?.username || 'Unknown';
        const identity = sender?.identity || data?.identity || {};
        const badges = collectBadges(sender, data, username);
        const isBot = badges.some(b => b.type === 'bot');
        // وقت كيك هو المرجع: وقت المتصفح يتقدّم ويتأخّر مع إعادة الاتصال
        const sentAt = Date.parse(String(data?.created_at ?? ''));

        const message: ChatMessage = {
          id,
          user: {
            id: String(sender?.id || '0'),
            username,
            color: isBot ? '#3FA9FF' : (identity?.color || '#E3B341'),
            avatar: pickAvatar(sender),
          },
          content: data?.content || '',
          role: getRoleFromBadges(new Set(badges.map(b => b.type))),
          badges,
          timestamp: Number.isFinite(sentAt) ? sentAt : Date.now()
        };

        this.listeners.forEach(cb => {
          try {
            cb(message);
          } catch (e) {
            console.error('[ChatService] Listener error:', e);
          }
        });
      });

      this.channel.bind('App\\Events\\MessageDeletedEvent', (data: any) => {
        const messageId = data?.message?.id ?? data?.message_id;
        if (messageId) this.deleteListeners.forEach(cb => cb(messageId));
      });

      this.pusher.connection.bind('connected', () => {
        if (this.connectionId !== myConnectionId) return;
        this.isConnected = true;
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        if (this.safetyTimer) { clearTimeout(this.safetyTimer); this.safetyTimer = null; }
        this.startHealthCheck(myConnectionId);
        this.notifyStatus(true, false, `متصل (ID: ${this.currentChatroomId})`);
      });

      this.pusher.connection.bind('disconnected', () => {
        if (this.connectionId !== myConnectionId) return;
        this.isConnected = false;
        this.scheduleReconnect(myConnectionId);
      });

      this.pusher.connection.bind('error', (err: any) => {
        if (this.connectionId !== myConnectionId) return;
        const code = err?.error?.code ?? err?.code;
        console.error('[ChatService] Pusher Error:', err);
        if (INVALID_KEY_CODES.includes(Number(code))) {
          this.invalidateCredentials();
          this.scheduleReconnect(myConnectionId);
          return;
        }
        this.notifyStatus(false, true, 'خطأ في الاتصال بسيرفر الشات');
      });
    })();
  }

  private cleanupPusher() {
    if (this.channel) {
      this.channel.unbind_all();
      this.channel.unsubscribe();
      this.channel = null;
    }
    if (this.pusher) {
      this.pusher.unbind_all();
      this.pusher.disconnect();
      this.pusher = null;
    }
    this.isConnected = false;
  }

  async connect(channelSlug: string = 'tmnaa') {
    const slug = channelSlug.toLowerCase().trim();
    this.connectionId++;
    const myConnectionId = this.connectionId;

    this.clearTimers();
    this.cleanupPusher();
    this.seenMessageIds.clear();
    this.reconnectAttempts = 0;
    this.autoReconnect = true;
    this.isConnecting = true;
    this.currentChatroomId = null;

    this.notifyStatus(false, false, `جاري البحث عن قناة ${slug}...`);

    try {
      const chatroomId = await this.getChatroomId(slug);
      if (this.connectionId !== myConnectionId) return;

      if (!chatroomId) {
        this.isConnecting = false;
        throw new Error(`لم يتم العثور على القناة: ${slug}`);
      }

      this.currentChatroomId = chatroomId;
      this.openPusher(myConnectionId);

      // مهلة أمان: الاتصال معلق بلا events = تعامل للمحاولة التالية
      this.safetyTimer = setTimeout(() => {
        if (this.connectionId !== myConnectionId || this.isConnected) return;
        console.warn('[ChatService] Connection timeout; retrying.');
        this.openPusher(myConnectionId, true);
      }, 15_000);
    } catch (error: any) {
      if (this.connectionId !== myConnectionId) return;
      this.isConnecting = false;
      console.error('[ChatService] Fatal Error:', error);
      this.notifyStatus(false, true, error?.message || String(error));
    }
  }

  onMessage(callback: MessageCallback) {
    this.listeners.push(callback);
    return () => { this.listeners = this.listeners.filter(cb => cb !== callback); };
  }

  onDeleteMessage(callback: (id: string) => void) {
    this.deleteListeners.push(callback);
    return () => { this.deleteListeners = this.deleteListeners.filter(cb => cb !== callback); };
  }

  // Remove all listeners (useful when switching games)
  clearListeners() {
    this.listeners = [];
    this.deleteListeners = [];
  }

  onStatusChange(callback: StatusCallback) {
    this.statusListeners.push(callback);
    return () => { this.statusListeners = this.statusListeners.filter(cb => cb !== callback); };
  }

  private notifyStatus(connected: boolean, error: boolean, details: string) {
    this.statusListeners.forEach(cb => cb(connected, error, details));
  }

  async fetchKickAvatar(username: string): Promise<string> {
    try {
      const slug = username.toLowerCase().trim().replace('@', '');
      const kickUrl = `https://kick.com/api/v1/users/${slug}`;

      const attempts = [
        { url: kickUrl, wrapped: false },
        { url: `/api/kick?endpoint=${encodeURIComponent(kickUrl)}`, wrapped: false },
        { url: `https://api.allorigins.win/raw?url=${encodeURIComponent(kickUrl)}&disableCache=true`, wrapped: true },
        { url: `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(kickUrl)}`, wrapped: true },
      ];

      const result = await Promise.any(attempts.map(async ({ url, wrapped }) => {
        const res = await fetchWithTimeout(url, { headers: { Accept: 'application/json' }, cache: 'no-store' });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const json = await res.json();
        const data = wrapped ? parseProxyPayload(url, json) : json;
        const avatar = pickAvatar(data?.user || data?.data || data);
        if (!avatar) throw new Error('no avatar');
        return normalizeUrl(avatar);
      }));
      return result;
    } catch {
      return '';
    }
  }

  disconnect() {
    this.autoReconnect = false;
    this.connectionId++;
    this.isConnecting = false;
    this.clearTimers();
    this.cleanupPusher();
    this.currentChatroomId = null;
  }
}

export const chatService = new ChatService();

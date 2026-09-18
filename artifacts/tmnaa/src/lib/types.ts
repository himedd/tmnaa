export type Language = 'en' | 'ar';

export interface LeaderboardEntry {
  user_id: number;
  username: string;
  quantity: number;
}

export interface LeaderboardData {
  gifts: LeaderboardEntry[];
  gifts_week: LeaderboardEntry[];
  gifts_month: LeaderboardEntry[];
}

export interface Clip {
  id: string;
  title: string;
  thumbnail_url: string;
  view_count: number;
  created_at: string;
  url: string;
}

export interface Video {
  id: number;
  session_title: string;
  title?: string;
  thumbnail: {
    url?: string;
    src?: string;
  } | null;
  views: number;
  view_count?: number;
  created_at: string;
  duration: number;
  slug: string;
  uuid?: string;
  video?: { uuid?: string };
  source?: string;
}

export interface SubscriberBadge {
  id: number;
  months: number;
  badge_image: {
    src: string;
  };
}

export interface ChannelInfo {
  followers_count: number;
  subscriber_badges: SubscriberBadge[];
}

export interface ChatMessage {
  id: string;
  content: string;
  user: {
    id: string;
    username: string;
    color: string;
    avatar: string;
  };
  role: 'owner' | 'moderator' | 'vip' | 'user';
  timestamp?: number;
}

export interface StreamInfo {
  isLive: boolean;
  viewers: number;
  title: string;
  category: string;
  tags: string[];
}

export interface KicksLeaderboardEntry {
  gifted_amount: number;
  rank: number;
  user_id: number;
  username: string;
}

export interface KicksLeaderboardData {
  lifetime: KicksLeaderboardEntry[];
  month: KicksLeaderboardEntry[];
  week: KicksLeaderboardEntry[];
}

export interface LastSession {
  session_title?: string;
  title?: string;
  thumbnail?: any;
  created_at?: string;
  duration?: number;
  categories?: any[];
}

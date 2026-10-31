import React from 'react';

export type Language = 'en' | 'ar';

export interface SocialLink {
  name: string;
  url: string;
  icon: React.ReactNode;
  color: string;
  username?: string;
  hex?: string;
  subtitle?: string;
  followerCount?: string;
  specialDetail?: string;
}

export interface ChatBadge {
  /** نوع الشارة كما يرسلها كيك: broadcaster / moderator / staff / vip / og / founder / subscriber / verified … */
  type: string;
  /** رقم الشارة: شهور الاشتراك أو مستوى الخبرة */
  version?: string;
  text?: string;
}

export interface ChatMessage {
  id: string;
  username?: string; // Legacy support
  message?: string;  // Legacy support
  content: string;   // New field
  user: {
    id: string;
    username: string;
    color: string;
    avatar: string;
  };
  role: 'owner' | 'moderator' | 'vip' | 'user';
  badges?: ChatBadge[];
  color?: string; // Legacy support
  timestamp?: number;
}

export interface KickDonation {
  id: string;
  username: string;
  amount: number;
}

// --- New Types for Stats & Content ---

export interface LeaderboardEntry {
  user_id: number;
  username: string;
  quantity: number;
}

export interface LeaderboardData {
  gifts: LeaderboardEntry[];       // All Time
  gifts_week: LeaderboardEntry[];  // Weekly
  gifts_month: LeaderboardEntry[]; // Monthly
}

export interface Clip {
  id: string;
  title: string;
  thumbnail_url: string;
  view_count: number;
  created_at: string;
  url: string;
  clip_url?: string;   // رابط الـ m3u8 المباشر للقطه
  video_url?: string;
  creator: {
    username: string;
  };
}

export interface Video {
  id: number;
  uuid?: string;
  title?: string;
  video?: any;
  session_title: string;
  thumbnail: {
    url?: string;
    src?: string;
  } | null;
  views: number;
  created_at: string;
  duration: number; // in milliseconds usually
  slug: string;
  source: string; // The m3u8 url
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
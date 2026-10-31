import React from 'react';

interface StreamPlayerProps {
  channelSlug: string;
}

/** مشغّل المسرح — يُركَّب فقط أثناء البث الحي، فيفتح iframe كيك مباشرة */
export const StreamPlayer: React.FC<StreamPlayerProps> = ({ channelSlug }) => (
  <iframe
    src={`https://player.kick.com/${channelSlug}?autoplay=true&muted=true`}
    className="w-full h-full border-0 bg-black"
    allow="autoplay; fullscreen; picture-in-picture"
    allowFullScreen
    title="Kick Stream"
  />
);

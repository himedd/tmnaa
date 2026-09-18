import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { kickFetch } from '@/lib/kickApi';
import { chatService } from '@/services/chatService';
import type { ChatMessage } from '@/lib/types';

const easeOut = [0.22, 1, 0.36, 1] as const;
const CHANNEL_SLUG = 'tmnaa';

function OwnerBadge() {
  return (
    <div className="flex items-center justify-center w-4 h-4 rounded-sm bg-gradient-to-br from-[#D4A84A] to-[#B8922F] text-black shrink-0 shadow-[0_0_12px_rgba(212,168,74,0.5)]">
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3"><path d="M12 2L2 19h20L12 2zm0 3.5L18.5 17H5.5L12 5.5z" /></svg>
    </div>
  );
}
function ModBadge() {
  return (
    <div className="flex items-center justify-center w-4 h-4 rounded-sm bg-gradient-to-br from-[#8B2500] to-[#5C1A00] text-white shrink-0 shadow-[0_0_12px_rgba(139,37,0,0.5)]">
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3"><path d="M18.828 2.343a3.001 3.001 0 00-4.243 0l-5.071 5.071-3.657-3.657a1 1 0 00-1.414 0l-1.414 1.414a1 1 0 000 1.414l3.657 3.657-5.071 5.071a1 1 0 000 1.414l2.828 2.828a1 1 0 001.414 0l5.071-5.071 3.657 3.657a1 1 0 001.414 0l1.414-1.414a1 1 0 000-1.414l-3.657-3.657 5.071-5.071a3.001 3.001 0 000-4.243z" /></svg>
    </div>
  );
}
function VipBadge() {
  return (
    <div className="flex items-center justify-center w-4 h-4 rounded-sm bg-gradient-to-br from-[#F542A8] to-[#C4247E] text-white shrink-0 shadow-[0_0_12px_rgba(245,66,168,0.5)]">
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3"><path d="M12 2L2 9l10 13 10-13-10-7z" /></svg>
    </div>
  );
}

function renderMessage(content: string) {
  if (!content) return null;
  const emoteRegex = /\[emote:(\d+):([\w\s\-]+)\]/gi;
  const parts: any[] = [];
  let lastIndex = 0;
  let match;
  while ((match = emoteRegex.exec(content)) !== null) {
    if (match.index > lastIndex) parts.push(content.substring(lastIndex, match.index));
    parts.push(<img key={`${match.index}-${match[1]}`} src={`https://files.kick.com/emotes/${match[1]}/fullsize`} alt={match[2]} className="inline-block w-5 h-5 mx-0.5 align-middle object-contain" />);
    lastIndex = emoteRegex.lastIndex;
  }
  if (lastIndex < content.length) parts.push(content.substring(lastIndex));
  return parts.length > 0 ? parts : content;
}

export function StreamAndChatSection() {
  const [isLive, setIsLive] = useState(false);
  const [viewers, setViewers] = useState(0);
  const [streamTitle, setStreamTitle] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(false);
  const [connectionDetails, setConnectionDetails] = useState('');
  const chatRef = useRef<HTMLDivElement>(null);

  const checkLiveStatus = () => {
    kickFetch(`https://kick.com/api/v2/channels/${CHANNEL_SLUG}`).then((data) => {
      if (!data) return;
      const live = data.livestream || data.live_stream;
      const liveBool = live && (live.is_live === true || live.is_live === 1);
      setIsLive(liveBool);
      if (liveBool) {
        setViewers(live.viewer_count || 0);
        setStreamTitle(live.session_title || live.title || 'Live Stream');
      }
    });
  };

  useEffect(() => {
    checkLiveStatus();
    const interval = setInterval(checkLiveStatus, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!isLive) return;
    const unbind1 = chatService.onMessage((msg) => {
      setMessages((prev) => [...prev, msg].slice(-50));
    });
    const unbind2 = chatService.onDeleteMessage((id) => {
      setMessages((prev) => prev.filter((m) => m.id !== id));
    });
    const unbind3 = chatService.onStatusChange((connected, error, details) => {
      setIsConnected(connected);
      setConnectionError(error || false);
      setConnectionDetails(details || '');
    });
    chatService.connect(CHANNEL_SLUG);
    return () => { unbind1(); unbind2(); unbind3(); chatService.clearListeners(); chatService.disconnect(); };
  }, [isLive]);

  const handleRetry = () => {
    setConnectionError(false);
    chatService.disconnect();
    chatService.connect(CHANNEL_SLUG);
  };

  useEffect(() => {
    if (chatRef.current) {
      const el = chatRef.current;
      requestAnimationFrame(() => {
        el.scrollTo({ top: el.scrollHeight, behavior: 'instant' as ScrollBehavior });
      });
    }
  }, [messages]);

  if (!isLive) return null;

  const getBadge = (role: string) => {
    if (role === 'owner') return <OwnerBadge />;
    if (role === 'moderator') return <ModBadge />;
    if (role === 'vip') return <VipBadge />;
    return null;
  };

  return (
    <section id="stream" className="py-20 md:py-28 px-6 relative overflow-hidden">
      {/* Warm vignette overlay */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse at 50% 0%, rgba(139,37,0,0.08) 0%, transparent 70%), radial-gradient(ellipse at 50% 100%, rgba(212,168,74,0.05) 0%, transparent 60%)'
      }} />

      <div className="max-w-6xl mx-auto relative z-10">
        {/* Header - Redesigned LIVE NOW badge */}
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: easeOut }}
          className="flex items-center gap-4 mb-10"
        >
          <div className="h-[1px] flex-1" style={{ background: 'linear-gradient(90deg, transparent, rgba(139,37,0,0.4), transparent)' }} />
          <div className="flex items-center gap-4 px-6 py-3 rounded-full" style={{
            background: 'linear-gradient(135deg, rgba(139,37,0,0.2), rgba(90,20,0,0.15))',
            border: '1px solid rgba(139,37,0,0.3)',
            boxShadow: '0 0 30px rgba(139,37,0,0.15), inset 0 1px 0 rgba(212,168,74,0.1)'
          }}>
            <div className="relative">
              <div className="w-3 h-3 rounded-full bg-[#FF4A1C]" style={{ boxShadow: '0 0 14px rgba(255,74,28,0.9), 0 0 30px rgba(255,74,28,0.4)' }} />
              <div className="absolute -inset-1 rounded-full bg-[#FF4A1C] animate-ping opacity-30" style={{ animationDuration: '2.5s' }} />
            </div>
            <h2 className="text-xs md:text-sm font-black uppercase tracking-[0.25em]" style={{
              background: 'linear-gradient(135deg, #D4A84A, #FFD98A, #D4A84A)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              fontFamily: 'Cairo, sans-serif'
            }}>
              LIVE NOW
            </h2>
            <div className="w-px h-4" style={{ background: 'rgba(212,168,74,0.3)' }} />
            <span className="text-[11px] font-bold tracking-wider" style={{ color: 'rgba(212,168,74,0.8)' }}>
              {viewers} watching
            </span>
          </div>
          <div className="h-[1px] flex-1" style={{ background: 'linear-gradient(90deg, transparent, rgba(139,37,0,0.4), transparent)' }} />
        </motion.div>

        {/* Stream + Chat */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Player */}
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.1, ease: easeOut }}
            className="flex-1 aspect-video rounded-2xl overflow-hidden shadow-2xl bg-black relative"
            style={{
              border: '1px solid rgba(139,37,0,0.3)',
              boxShadow: '0 0 40px rgba(139,37,0,0.2), 0 0 80px rgba(139,37,0,0.1)'
            }}
          >
            <iframe
              src={`https://player.kick.com/${CHANNEL_SLUG}?autoplay=true&muted=true`}
              className="w-full h-full border-0"
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
              title="Kick Stream"
            />
          </motion.div>

          {/* Chat */}
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.2, ease: easeOut }}
            className="w-full lg:w-[380px] h-[520px] rounded-2xl overflow-hidden flex flex-col shrink-0"
            style={{
              background: 'linear-gradient(160deg, rgba(13,4,4,0.95), rgba(20,8,8,0.92))',
              border: '1px solid rgba(139,37,0,0.25)',
              boxShadow: '0 0 40px rgba(139,37,0,0.15), inset 0 0 60px rgba(0,0,0,0.5)'
            }}
          >
            {/* Chat Header */}
            <div className="h-14 shrink-0 flex items-center px-5 gap-3" style={{
              background: 'linear-gradient(90deg, rgba(139,37,0,0.15), rgba(90,20,0,0.1), rgba(139,37,0,0.05))',
              borderBottom: '1px solid rgba(139,37,0,0.2)'
            }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{
                background: 'rgba(139,37,0,0.2)',
                border: '1px solid rgba(139,37,0,0.3)'
              }}>
                <svg className="w-4 h-4" style={{ color: '#D4A84A' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <div className="flex flex-col">
                <span className="text-white font-bold text-sm tracking-wide" style={{ fontFamily: 'Cairo, sans-serif' }}>Live Chat</span>
                <div className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-[#53FC18]' : connectionError ? 'bg-red-500' : 'bg-yellow-500 animate-pulse'}`} style={{
                    boxShadow: isConnected ? '0 0 8px rgba(83,252,24,0.8)' : connectionError ? '0 0 8px rgba(239,68,68,0.8)' : 'none'
                  }} />
                  <span className="text-[10px] font-mono uppercase" style={{ color: isConnected ? 'rgba(83,252,24,0.6)' : connectionError ? 'rgba(239,68,68,0.6)' : 'rgba(212,168,74,0.5)' }}>
                    {isConnected ? 'Live' : connectionError ? 'Error' : 'Connecting...'}
                  </span>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div ref={chatRef} className="flex-1 overflow-y-auto p-3 space-y-1 scrollbar-thin" style={{
              scrollbarColor: 'rgba(139,37,0,0.3) transparent',
              background: 'linear-gradient(180deg, rgba(0,0,0,0.3), transparent 20px)'
            }}>
              {messages.length === 0 && !connectionError && (
                <div className="flex items-center justify-center h-full">
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex gap-1.5">
                      <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: '#8B2500', animationDelay: '0ms' }} />
                      <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: '#8B2500', animationDelay: '150ms' }} />
                      <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: '#8B2500', animationDelay: '300ms' }} />
                    </div>
                    <span className="text-xs" style={{ color: 'rgba(212,168,74,0.4)' }}>Waiting for messages...</span>
                  </div>
                </div>
              )}
              {connectionError && (
                <div className="flex flex-col items-center justify-center h-full gap-4 px-6">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{
                    background: 'rgba(239,68,68,0.1)',
                    border: '1px solid rgba(239,68,68,0.2)'
                  }}>
                    <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <span className="text-xs text-center leading-relaxed" style={{ color: 'rgba(239,68,68,0.6)' }}>
                    {connectionDetails || 'Chat connection lost'}
                  </span>
                  <button onClick={handleRetry} className="px-5 py-2 rounded-lg text-xs font-bold tracking-wide transition-all duration-300" style={{
                    background: 'linear-gradient(135deg, rgba(139,37,0,0.3), rgba(90,20,0,0.2))',
                    border: '1px solid rgba(139,37,0,0.4)',
                    color: '#D4A84A',
                    boxShadow: '0 0 20px rgba(139,37,0,0.15)'
                  }}>
                    Reconnect
                  </button>
                </div>
              )}
              {messages.map((msg) => (
                <div key={msg.id} className="group flex items-start gap-2.5 py-2 px-3 rounded-lg transition-all duration-200" style={{
                  border: '1px solid transparent',
                  background: 'transparent'
                }}>
                  {(msg.role === 'owner' || msg.role === 'moderator' || msg.role === 'vip') && (
                    <div className="mt-0.5 shrink-0">{getBadge(msg.role)}</div>
                  )}
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-xs font-bold leading-none mb-1" style={{ color: msg.user.color || 'rgba(212,168,74,0.9)' }}>
                      {msg.user.username}
                    </span>
                    <span className="text-sm leading-snug text-white/75 font-medium line-clamp-2" style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>
                      {renderMessage(msg.content)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

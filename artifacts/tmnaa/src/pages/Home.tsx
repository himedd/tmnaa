import { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import { apiUrl } from '@/lib/apiBase';
import { HeroSection } from '@/components/sections/HeroSection';
import { StreamAndChatSection } from '@/components/sections/StreamAndChatSection';
import { SupportSection } from '@/components/sections/SupportSection';
import { LastSessionSection } from '@/components/sections/LastSessionSection';
import { StatsSection } from '@/components/sections/StatsSection';
import { CelebrationTeaserSection } from '@/components/sections/CelebrationTeaserSection';
import { FollowerCountdownSection } from '@/components/sections/FollowerCountdownSection';

export default function Home() {
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch(apiUrl('/api/kick?endpoint=' + encodeURIComponent('https://kick.com/api/v2/channels/tmnaa')));
        if (!res.ok) return;
        const data = await res.json();
        const live = data?.livestream || data?.live_stream;
        const liveBool = live && (live.is_live === true || live.is_live === 1);
        setIsLive(liveBool);
      } catch { setIsLive(false); }
    };
    check();
    const interval = setInterval(check, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-[#090807] text-white overflow-x-hidden">
      <Header />

      <main>
        <HeroSection />
        <StreamAndChatSection />
        <SupportSection />
        {!isLive && <LastSessionSection />}
        <StatsSection />
        <CelebrationTeaserSection />
        <FollowerCountdownSection />
      </main>

      {/* Footer */}
      <footer className="pt-20 pb-16 px-6 border-t border-white/5 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-gradient-to-b from-[#D4A84A]/5 via-transparent to-transparent blur-[120px]" />
        </div>
        <div className="max-w-5xl mx-auto flex flex-col items-center gap-6 relative z-10">
          <p className="text-sm font-black tracking-[0.25em] uppercase mb-2" style={{ color: 'rgba(247,243,238,0.5)' }}>
            POWERED BY HSG
          </p>
          <div className="w-16 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
          <p className="text-[11px] font-bold tracking-[0.3em] uppercase" style={{ color: 'rgba(247,243,238,0.3)' }}>
            &copy; 2026 TMNAA All Rights Reserved
          </p>

          <p className="text-[11px] tracking-[0.2em] font-medium" style={{ color: 'rgba(247,243,238,0.12)' }}>
            RISE WITH FIRE
          </p>
        </div>
      </footer>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Header } from '@/components/Header';
import { EmberCanvas } from '@/components/EmberCanvas';
import { Confetti } from '@/components/Confetti';
import { EditSubmissionForm } from '@/components/EditSubmissionForm';
import { EditsGallery } from '@/components/EditsGallery';
import { kickFetch } from '@/lib/kickApi';
import { fetchWall, type WallItem } from '@/lib/wallApi';

const easeOut = [0.22, 1, 0.36, 1] as const;
const GOAL = 300000;

function FollowerProgress() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      kickFetch('https://kick.com/api/v2/channels/tmnaa').then((raw) => {
        if (cancelled) return;
        const data = raw?.data || raw;
        const f = Number(data?.followers_count);
        setCount(Number.isFinite(f) && f > 0 ? f : null);
      });
    };
    load();
    const interval = setInterval(load, 60000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const pct = count != null ? Math.min(100, (count / GOAL) * 100) : 0;
  const fmt = (n: number) => new Intl.NumberFormat('en-US').format(n);

  return (
    <div className="mx-auto mt-9 w-full max-w-xl">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-black uppercase tracking-[0.3em]" style={{ color: 'rgba(247,243,238,0.4)' }}>
          Followers
        </span>
        <span className="text-[13px] font-black tracking-wide" style={{ color: '#D9A441' }}>
          {count != null ? fmt(count) : '—'} <span style={{ color: 'rgba(247,243,238,0.3)' }}>/ {fmt(GOAL)}</span>
        </span>
      </div>
      <div
        className="relative h-[10px] rounded-full overflow-hidden"
        style={{ background: 'rgba(217,164,65,0.1)', border: '1px solid rgba(217,164,65,0.15)', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.4)' }}
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${count != null ? Math.max(2, pct) : 0}%` }}
          transition={{ duration: 1.4, ease: easeOut, delay: 0.4 }}
          className="h-full rounded-full"
          style={{
            background: 'linear-gradient(90deg, #8A2F14, #D94A2B, #FF7A18, #D9A441, #F7E6B8)',
            boxShadow: '0 0 16px rgba(255,122,24,0.6), 0 0 30px rgba(217,164,65,0.35)',
          }}
        />
      </div>
      <p className="mt-3 text-[11px] tracking-[0.15em] text-center" style={{ color: 'rgba(247,243,238,0.3)' }}>
        {count != null ? `${pct.toFixed(1)}% of the way to 300K` : 'Climbing to 300,000 together'}
      </p>
    </div>
  );
}

const guidelines = [
  'Original edits, posters and clips only.',
  'Keep it respectful — no hate or inappropriate content.',
  'Upload a file (videos up to 5GB) to share your edit.',
  'Submissions are reviewed by the admins before they appear on the wall.',
];

export default function CelebrationPage() {
  const [submissions, setSubmissions] = useState<WallItem[]>([]);
  const [celebrate, setCelebrate] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetchWall()
        .then((items) => {
          if (cancelled) return;
          setSubmissions(items);
        })
        .catch(() => {
          /* wall down — keep whatever we have */
        });
    };
    load();
    const interval = setInterval(load, 45000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const handleSubmitted = () => {
    fetchWall().then((items) => {
      setSubmissions(items);
      setCelebrate(true);
    });
  };

  return (
    <div className="min-h-screen bg-[#090807] text-white overflow-x-hidden">
      <Header />

      <main>
        <section className="relative pt-36 md:pt-44 pb-14 md:pb-20 px-6 overflow-hidden">
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 65% 55% at 50% 20%, rgba(255,122,24,0.12) 0%, rgba(217,74,43,0.05) 40%, transparent 72%)' }} />
          <div className="absolute inset-0 pointer-events-none noise-overlay" />
          <div
            className="absolute bottom-0 left-0 right-0 h-40 pointer-events-none"
            style={{ background: 'linear-gradient(to top, #090807 0%, rgba(9,8,7,0.7) 40%, transparent 100%)' }}
          />
          <EmberCanvas />

          <div className="relative z-20 max-w-4xl mx-auto flex flex-col items-center text-center">
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 1.1, delay: 0.2, ease: easeOut }}
              className="relative mb-7"
            >
              <div
                className="absolute -inset-4 rounded-full pointer-events-none"
                style={{
                  background: 'conic-gradient(from 0deg, transparent, rgba(217,164,65,0.25), transparent, rgba(255,122,24,0.18), transparent)',
                  filter: 'blur(8px)',
                  animation: 'border-glow-rotate 12s linear infinite',
                }}
              />
              <div
                className="w-[104px] h-[104px] rounded-full overflow-hidden flex items-center justify-center relative"
                style={{
                  background: 'radial-gradient(circle, rgba(255,122,24,0.25) 0%, rgba(18,12,10,0.95) 60%)',
                  border: '2px solid rgba(217,164,65,0.6)',
                  boxShadow: '0 0 30px rgba(255,122,24,0.3), 0 0 60px rgba(217,164,65,0.15), inset 0 0 20px rgba(255,122,24,0.08)',
                }}
              >
                <img src="/assets/tmnaa-logo.png" alt="TMNAA" className="w-[82px] h-[82px] object-cover rounded-full" style={{ filter: 'drop-shadow(0 0 10px rgba(255,122,24,0.35))' }} />
              </div>
            </motion.div>

            <motion.div
              initial={{ y: 25, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.9, delay: 0.5, ease: easeOut }}
              className="flex items-center gap-4 md:gap-5 mb-4"
            >
              <div className="h-[1px] w-12 md:w-20" style={{ background: 'linear-gradient(90deg, transparent, rgba(217,164,65,0.5))' }} />
              <span
                className="text-[12px] md:text-sm tracking-[0.3em] font-bold"
                style={{
                  fontFamily: 'Cairo, sans-serif',
                  background: 'linear-gradient(135deg, rgba(217,164,65,0.9), rgba(255,122,24,0.75))',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                300K CELEBRATION
              </span>
              <div className="h-[1px] w-12 md:w-20" style={{ background: 'linear-gradient(270deg, transparent, rgba(217,164,65,0.5))' }} />
            </motion.div>

            <motion.h1
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 1, delay: 0.65, ease: easeOut }}
              className="text-4xl md:text-6xl font-black tracking-tight mb-4"
              style={{ fontFamily: 'Cairo, sans-serif', color: '#F7F3EE' }}
            >
              <span className="metal-shine">300K</span> Edits Wall
            </motion.h1>

            <motion.p
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.9, delay: 0.8, ease: easeOut }}
              className="max-w-2xl text-sm md:text-base leading-relaxed"
              style={{ color: 'rgba(247,243,238,0.45)' }}
            >
              The community is about to reach 300,000 followers. Submit your own edit, poster or clip celebrating the
              milestone and watch the wall fill up with everyone&apos;s creations.
            </motion.p>

            <FollowerProgress />
          </div>
        </section>

        <section id="submit" className="relative py-14 md:py-20 px-6">
          <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-6 lg:gap-8 items-start">
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.8, ease: easeOut }}
            >
              <EditSubmissionForm onSubmitted={handleSubmitted} />
            </motion.div>

            <motion.div
              initial={{ y: 40, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.8, delay: 0.12, ease: easeOut }}
              className="relative rounded-[32px] p-6 md:p-8"
              style={{
                background: 'rgba(9,8,7,0.55)',
                border: '1px solid rgba(217,164,65,0.12)',
                boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
              }}
            >
              <div className="flex items-center gap-3 mb-5">
                <div className="w-2 h-2 rounded-full bg-[#D9A441]" style={{ boxShadow: '0 0 12px #D9A441' }} />
                <span className="text-[11px] font-black uppercase tracking-[0.3em]" style={{ color: 'rgba(247,243,238,0.45)' }}>
                  How It Works
                </span>
              </div>
              <ul className="space-y-4">
                {guidelines.map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span
                      className="mt-0.5 w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[11px] font-black"
                      style={{
                        background: 'linear-gradient(135deg, #F5D489, #D9A441, #8a6a1f)',
                        color: '#1a1208',
                        boxShadow: '0 0 12px rgba(217,164,65,0.35)',
                      }}
                    >
                      {i + 1}
                    </span>
                    <span className="text-[13.5px] leading-relaxed" style={{ color: 'rgba(247,243,238,0.65)' }}>
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
              <div
                className="mt-6 rounded-2xl p-4"
                style={{ background: 'linear-gradient(90deg, rgba(217,164,65,0.1), rgba(217,164,65,0.03), transparent)', border: '1px solid rgba(217,164,65,0.18)' }}
              >
                <p className="text-[13px] leading-relaxed" style={{ color: 'rgba(247,243,238,0.7)' }}>
                  Once you submit, your edit joins the gallery below and the celebration fires up. 🔥
                </p>
              </div>
            </motion.div>
          </div>
        </section>

        <section id="wall" className="relative py-14 md:py-20 px-6">
          <div className="max-w-6xl mx-auto">
            <EditsGallery submissions={submissions} />
          </div>
        </section>
      </main>

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

      {celebrate && <Confetti onDone={() => setCelebrate(false)} />}
    </div>
  );
}
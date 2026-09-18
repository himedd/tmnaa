import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useLocation } from 'wouter';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { loadSubmissions, type EditSubmission } from '@/lib/submissionsStore';

const easeOut = [0.22, 1, 0.36, 1] as const;

export function CelebrationTeaserSection() {
  const [, navigate] = useLocation();
  const [previews, setPreviews] = useState<EditSubmission[]>([]);

  useEffect(() => {
    const approved = loadSubmissions()
      .filter((s) => s.approved)
      .sort((a, b) => b.createdAt - a.createdAt);
    setPreviews(approved.slice(0, 4));
  }, []);

  const go = () => navigate('/300k');

  return (
    <section id="celebration" className="relative py-20 md:py-28 px-6 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[820px] h-[460px]"
          style={{
            background: 'radial-gradient(ellipse 60% 50% at center, rgba(255,122,24,0.09) 0%, rgba(217,164,65,0.04) 40%, transparent 72%)',
            filter: 'blur(40px)',
          }}
        />
      </div>

      <div className="max-w-5xl mx-auto relative z-10">
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.8, ease: easeOut }}
          className="flex flex-col items-center text-center"
        >
          <div className="flex items-center gap-4 md:gap-5 mb-5">
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
          </div>

          <div className="relative mb-5">
            <div
              className="absolute -inset-6 pointer-events-none"
              style={{ background: 'radial-gradient(circle, rgba(217,164,65,0.12) 0%, transparent 65%)', filter: 'blur(20px)' }}
            />
            <h2 className="relative text-3xl md:text-5xl font-black tracking-tight" style={{ fontFamily: 'Cairo, sans-serif', color: '#F7F3EE' }}>
              Celebrate <span className="metal-shine">300,000</span> Strong
            </h2>
          </div>

          <p className="max-w-2xl text-sm md:text-base leading-relaxed mb-10" style={{ color: 'rgba(247,243,238,0.45)' }}>
            The community is about to hit 300K followers. Make your own edit, poster or clip to mark the milestone —
            then see everyone&apos;s creations in one place.
          </p>
        </motion.div>

        {previews.length > 0 && (
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.8, delay: 0.15, ease: easeOut }}
            className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-10"
          >
            {previews.map((sub, i) => (
              <motion.button
                key={sub.id}
                type="button"
                onClick={go}
                whileHover={{ y: -6, scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                transition={{ duration: 0.3 }}
                className="group relative aspect-video rounded-[18px] overflow-hidden border border-[rgba(217,164,65,0.15)] hover:border-[#D9A441]/50 transition-colors duration-400"
                style={{ background: 'rgba(9,8,7,0.7)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}
              >
                {sub.thumb ? (
                  <img src={sub.thumb} alt={sub.caption || sub.name} loading="lazy" className="w-full h-full object-cover opacity-75 group-hover:opacity-100 transition-all duration-500 group-hover:scale-110" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(45,27,20,0.9), rgba(14,10,8,0.95))' }}>
                    <Sparkles className="w-5 h-5 text-[#D9A441]/70" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent" />
                <div className="absolute bottom-0 inset-x-0 p-2.5 text-right">
                  <span className="text-[10px] font-black uppercase tracking-[0.15em] truncate block" style={{ color: '#D9A441' }}>
                    @{sub.name}
                  </span>
                </div>
                <span className="absolute top-2 left-2 text-[10px] font-black" style={{ color: 'rgba(217,164,65,0.45)' }}>
                  0{i + 1}
                </span>
              </motion.button>
            ))}
          </motion.div>
        )}

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.8, delay: 0.25, ease: easeOut }}
          className="flex justify-center"
        >
          <motion.button
            type="button"
            onClick={go}
            whileHover={{ scale: 1.04, y: -2 }}
            whileTap={{ scale: 0.97 }}
            className="premium-btn group/cta flex items-center gap-2.5 px-9 h-[58px] rounded-full"
            style={{
              background: 'linear-gradient(135deg, rgba(26,18,13,0.9), rgba(45,27,20,0.85))',
              border: '1.5px solid transparent',
              backgroundImage:
                'linear-gradient(rgba(26,18,13,0.9), rgba(45,27,20,0.85)), linear-gradient(135deg, rgba(217,164,65,0.55), rgba(255,122,24,0.3), rgba(217,164,65,0.55))',
              backgroundOrigin: 'border-box',
              backgroundClip: 'padding-box, border-box',
              boxShadow: '0 0 25px rgba(217,164,65,0.12), 0 8px 25px rgba(0,0,0,0.4), inset 0 1px 0 rgba(217,164,65,0.08)',
            }}
          >
            <span
              className="relative z-10 font-bold text-lg tracking-wider transition-colors duration-400 group-hover/cta:text-[#FF7A18]"
              style={{ fontFamily: 'Cairo, sans-serif', color: '#D9A441' }}
            >
              View All Edits
            </span>
            <ArrowLeft className="relative z-10 w-5 h-5 transition-all duration-400 group-hover/cta:text-[#FF7A18] group-hover/cta:-translate-x-1" style={{ color: '#D9A441' }} />
          </motion.button>
        </motion.div>
      </div>
    </section>
  );
}
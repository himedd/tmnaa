import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';
import { EmberCanvas } from '@/components/EmberCanvas';
const heroBgImg = '/bg-dragon.jpeg';
const logoGlowImg = '/assets/tmnaa-logo.png';
const tiktokImg = '/assets/Tiktok.webp';
const youtubeImg = '/assets/youtube.webp';
const xImg = '/assets/x.webp';
const instagramImg = '/assets/instagram.png';

const socialCards = [
  { img: tiktokImg, name: 'TikTok', link: 'https://www.tiktok.com/@tmnaa0' },
  { img: youtubeImg, name: 'YouTube', link: 'https://www.youtube.com/@tmnaa1' },
  { img: xImg, name: 'X', link: 'https://x.com/tmnaa16' },
  { img: instagramImg, name: 'Instagram', link: 'https://www.instagram.com/tmnaa16' },
];

const badges = [
  { label: 'Live Streams', color: '#D94A2B', glow: 'rgba(217, 74, 43, 0.4)' },
  { label: 'Daily Content', color: '#D9A441', glow: 'rgba(217, 164, 65, 0.4)' },
  { label: 'Community First', color: '#FF7A18', glow: 'rgba(255, 122, 24, 0.4)' },
];

const easeOut = [0.22, 1, 0.36, 1] as const;

export function HeroSection() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start'],
  });

  const bgY = useTransform(scrollYProgress, [0, 1], ['0%', '15%']);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.35], [1, 0]);
  const contentY = useTransform(scrollYProgress, [0, 0.35], [0, -80]);

  return (
    <section
      id="home"
      ref={ref}
      className="relative min-h-[100svh] w-full overflow-hidden"
      style={{ background: '#090807' }}
    >
      {/* ============ BACKGROUND LAYERS ============ */}

      {/* Layer 1: Hero Background Image with Parallax */}
      <motion.div style={{ y: bgY }} className="absolute inset-0 w-full h-[115vh]">
        <img
          src={heroBgImg}
          alt=""
          className="w-full h-full object-cover object-center"
          style={{ filter: 'contrast(1.08) brightness(0.95) saturate(1.1)' }}
        />
      </motion.div>

      {/* Layer 2: Dark Overlay (cinematic contrast) */}
      <div className="absolute inset-0" style={{ background: 'rgba(0, 0, 0, 0.25)' }} />

      {/* Layer 3: Color Grading (warm cinematic tint) */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'linear-gradient(180deg, rgba(255, 122, 24, 0.03) 0%, transparent 40%, rgba(217, 74, 43, 0.02) 100%)' }}
      />

      {/* Layer 4: Noise Overlay */}
      <div className="absolute inset-0 noise-overlay pointer-events-none" />

      {/* Layer 5: Vignette (strong cinematic) */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 70% 65% at center, transparent 30%, rgba(9, 8, 7, 0.5) 60%, rgba(9, 8, 7, 0.92) 100%)',
        }}
      />

      {/* Layer 6: Top gradient for navbar */}
      <div
        className="absolute inset-x-0 top-0 h-56 pointer-events-none z-10"
        style={{ background: 'linear-gradient(to bottom, rgba(9, 8, 7, 0.85) 0%, rgba(9, 8, 7, 0.4) 40%, transparent 100%)' }}
      />

      {/* Layer 7: Bottom gradient fade */}
      <div
        className="absolute bottom-0 left-0 right-0 h-48 z-10 pointer-events-none"
        style={{ background: 'linear-gradient(to top, #090807 0%, rgba(9, 8, 7, 0.85) 30%, transparent 100%)' }}
      />

      {/* ============ LIGHTING EFFECTS ============ */}

      {/* Volumetric Light from bottom center */}
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] pointer-events-none z-[5]"
        style={{
          background: 'radial-gradient(ellipse 60% 50% at center bottom, rgba(255, 122, 24, 0.1) 0%, rgba(217, 74, 43, 0.05) 35%, transparent 70%)',
          filter: 'blur(30px)',
          animation: 'volumetric-light 8s ease-in-out infinite',
        }}
      />

      {/* Side glow - left */}
      <div
        className="absolute bottom-0 left-[10%] w-[400px] h-[500px] pointer-events-none z-[5]"
        style={{
          background: 'radial-gradient(ellipse at center bottom, rgba(255, 122, 24, 0.04) 0%, transparent 70%)',
          filter: 'blur(50px)',
        }}
      />

      {/* Side glow - right */}
      <div
        className="absolute bottom-0 right-[10%] w-[400px] h-[500px] pointer-events-none z-[5]"
        style={{
          background: 'radial-gradient(ellipse at center bottom, rgba(217, 74, 43, 0.04) 0%, transparent 70%)',
          filter: 'blur(50px)',
        }}
      />

      {/* Lava reflection on ground */}
      <div
        className="absolute bottom-0 left-0 right-0 h-[200px] pointer-events-none z-[4]"
        style={{
          background: 'linear-gradient(to top, rgba(255, 122, 24, 0.06), transparent)',
          filter: 'blur(20px)',
        }}
      />

      {/* Fog Layer 1 */}
      <div
        className="absolute bottom-[10%] left-0 right-0 h-[250px] pointer-events-none z-[6] fog-layer"
        style={{
          background: 'linear-gradient(to top, rgba(255, 122, 24, 0.03), transparent)',
          filter: 'blur(25px)',
        }}
      />

      {/* Fog Layer 2 (slower, higher) */}
      <div
        className="absolute bottom-[20%] left-0 right-0 h-[200px] pointer-events-none z-[6]"
        style={{
          background: 'linear-gradient(to top, rgba(217, 164, 65, 0.015), transparent)',
          filter: 'blur(40px)',
          animation: 'fog-drift 35s ease-in-out infinite alternate-reverse',
        }}
      />

      {/* Ember Particles */}
      <EmberCanvas />

      {/* ============ CONTENT ============ */}
      <motion.div
        style={{ opacity: contentOpacity, y: contentY }}
        className="relative z-20 h-full flex flex-col items-center justify-start md:justify-center pt-28 md:pt-0 px-6 pb-20 md:pb-0"
      >
        {/* Spacing push-down for navbar */}
        <div className="h-0 md:h-20 flex-shrink-0" />

        {/* Logo + TMNAA combined image */}
        <motion.div
          initial={{ scale: 0.6, opacity: 0, filter: 'blur(10px)' }}
          animate={{ scale: 1, opacity: 1, filter: 'blur(0px)' }}
          transition={{ duration: 1.4, delay: 0.3, ease: easeOut }}
          className="mb-3 md:mb-8 relative"
        >
          {/* Outer bloom glow */}
          <div
            className="absolute -inset-24 pointer-events-none"
            style={{
              background: 'radial-gradient(circle, rgba(255, 122, 24, 0.15) 0%, rgba(217, 164, 65, 0.06) 35%, transparent 65%)',
              filter: 'blur(30px)',
              animation: 'glow-pulse 5s ease-in-out infinite',
            }}
          />
          <img
            src={logoGlowImg}
            alt="TMNAA"
            className="relative w-[160px] md:w-[220px] lg:w-[280px] h-auto pulse-glow"
            style={{
              filter: 'drop-shadow(0 0 35px rgba(255, 122, 24, 0.35)) drop-shadow(0 0 70px rgba(217, 164, 65, 0.15)) drop-shadow(0 4px 8px rgba(0, 0, 0, 0.8))',
            }}
          />
        </motion.div>

        {/* RISE WITH FIRE - with decorative lines */}
        <motion.div
          initial={{ y: 35, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.9, delay: 0.9, ease: easeOut }}
          className="flex items-center gap-5 mb-3"
        >
          <div className="h-[1px] w-16"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(217, 164, 65, 0.5))' }}
          />
          <span
            className="text-sm md:text-base tracking-[0.35em] font-bold"
            style={{
              fontFamily: 'Cairo, sans-serif',
              background: 'linear-gradient(135deg, rgba(217, 164, 65, 0.8), rgba(255, 122, 24, 0.7))',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            RISE WITH FIRE
          </span>
          <div className="h-[1px] w-16"
            style={{ background: 'linear-gradient(270deg, transparent, rgba(217, 164, 65, 0.5))' }}
          />
        </motion.div>

        {/* Decorative line */}
        <motion.div
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ duration: 1.2, delay: 1.1, ease: easeOut }}
          className="w-[200px] md:w-[240px] h-[1.5px] mb-4 md:mb-8"
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(217, 164, 65, 0.6), rgba(255, 122, 24, 0.4), rgba(217, 164, 65, 0.6), transparent)',
          }}
        />

        {/* Content Creator & Streamer - Luxury Serif */}
        <motion.p
          initial={{ y: 25, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.9, delay: 1.2, ease: easeOut }}
          className="text-xl md:text-2xl lg:text-[28px] font-semibold mb-3"
          style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            color: '#F7F3EE',
            letterSpacing: '0.04em',
          }}
        >
          Content Creator & Streamer
        </motion.p>

        {/* Subtitle */}
        <motion.p
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.9, delay: 1.3, ease: easeOut }}
          className="text-sm md:text-lg mb-6 md:mb-12 text-center"
          style={{
            fontFamily: 'Tajawal, sans-serif',
            color: 'rgba(247, 243, 238, 0.45)',
            letterSpacing: '0.02em',
            lineHeight: 1.6,
          }}
        >
          Gaming, Reactions, Challenges and more!
        </motion.p>

        {/* 3 Premium Badges */}
        <motion.div
          initial={{ y: 25, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.9, delay: 1.4, ease: easeOut }}
          className="flex flex-wrap justify-center gap-3 md:gap-4 mb-8 md:mb-14"
        >
          {badges.map((badge, i) => (
            <motion.div
              key={badge.label}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 1.5 + i * 0.1, type: 'spring', damping: 14 }}
              className="premium-badge px-4 py-2 md:px-5 md:py-2.5 rounded-full cursor-default"
              style={{
                '--badge-gold': `${badge.color}40`,
                '--badge-orange': `${badge.color}20`,
              } as React.CSSProperties}
            >
              <span
                className="relative z-10 text-[11px] md:text-[13px] font-bold tracking-wider"
                style={{ color: badge.color, fontFamily: 'Cairo, sans-serif' }}
              >
                {badge.label}
              </span>
            </motion.div>
          ))}
        </motion.div>

        {/* Social Buttons - Grid on Mobile, Flex on Desktop */}
        <motion.div
          initial={{ y: 35, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.9, delay: 1.6, ease: easeOut }}
          className="grid grid-cols-2 md:flex md:flex-wrap justify-center items-center gap-4 md:gap-8 mb-8 md:mb-12 w-full max-w-sm md:max-w-none mx-auto"
        >
          {socialCards.map((card, i) => (
            <motion.a
              key={card.name}
              href={card.link}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ y: 25, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 1.7 + i * 0.08, ease: easeOut }}
              whileHover={{ scale: 1.08, y: -5 }}
              whileTap={{ scale: 0.95 }}
              className="block cursor-pointer"
              style={{ background: 'transparent' }}
            >
              <img
                src={card.img}
                alt={card.name}
                className="h-auto w-full md:h-[90px] md:w-auto mx-auto object-contain"
                style={{ display: 'block', maxHeight: '70px' }}
              />
            </motion.a>
          ))}
        </motion.div>

        {/* Action Buttons - Premium */}
        <motion.div
          initial={{ y: 35, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.9, delay: 1.9, ease: easeOut }}
          className="flex flex-col sm:flex-row gap-5"
        >
          {/* Watch Live - Red Glowing Premium */}
          <motion.a
            href="https://kick.com/tmnaa"
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ scale: 1.04, y: -2 }}
            whileTap={{ scale: 0.97 }}
            className="premium-btn group/btn"
            style={{
              width: '300px',
              height: '68px',
              borderRadius: '35px',
              background: 'linear-gradient(135deg, #8A1A05, #D94A2B, #FF7A18, #D94A2B, #8A1A05)',
              boxShadow: '0 0 35px rgba(217, 74, 43, 0.35), 0 0 70px rgba(217, 74, 43, 0.15), 0 8px 25px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.12), inset 0 -2px 4px rgba(0, 0, 0, 0.3)',
            }}
          >
            <span
              className="relative z-10 font-bold text-lg tracking-wider"
              style={{ fontFamily: 'Cairo, sans-serif', color: '#FFFFFF', textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}
            >
              Watch Live
            </span>
            <div
              className="absolute inset-0 rounded-[35px] opacity-0 group-hover/btn:opacity-100 transition-opacity duration-500"
              style={{
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 2.5s infinite',
              }}
            />
          </motion.a>

          {/* Join Community - Premium Glass with Metallic Border */}
          <motion.a
            href="https://discord.gg/tmfx"
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ scale: 1.04, y: -2 }}
            whileTap={{ scale: 0.97 }}
            className="premium-btn group/btn"
            style={{
              width: '300px',
              height: '68px',
              borderRadius: '35px',
              background: 'linear-gradient(135deg, rgba(26, 18, 13, 0.9), rgba(45, 27, 20, 0.85))',
              border: '1.5px solid transparent',
              backgroundImage: 'linear-gradient(rgba(26, 18, 13, 0.9), rgba(45, 27, 20, 0.85)), linear-gradient(135deg, rgba(217, 164, 65, 0.5), rgba(255, 122, 24, 0.25), rgba(217, 164, 65, 0.5))',
              backgroundOrigin: 'border-box',
              backgroundClip: 'padding-box, border-box',
              boxShadow: '0 0 25px rgba(217, 164, 65, 0.1), 0 8px 25px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(217, 164, 65, 0.08), inset 0 -2px 4px rgba(0, 0, 0, 0.2)',
            }}
          >
            <span
              className="relative z-10 font-bold text-lg tracking-wider transition-colors duration-400 group-hover/btn:text-[#FF7A18]"
              style={{ fontFamily: 'Cairo, sans-serif', color: '#D9A441', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
            >
              Join Community
            </span>
          </motion.a>
        </motion.div>
      </motion.div>
    </section>
  );
}

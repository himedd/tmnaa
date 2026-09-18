import { useState } from 'react';
import { motion } from 'framer-motion';

const easeOut = [0.22, 1, 0.36, 1] as const;

const moderators = [
  { name: 'YARAII', kick: '7YARAll', avatar: 'https://files.kick.com/images/user/37363145/profile_image/conversion/3633013f-a1f1-4206-a341-65f38a375b02-fullsize.webp' },
  { name: 'Ilinay', kick: 'llinay', avatar: 'https://files.kick.com/images/user/52612635/profile_image/conversion/84197bbd-2aca-4f0f-87b4-f94cf1a54600-fullsize.webp' },
  { name: 'uRaseel', kick: 'uRaseel', avatar: 'https://files.kick.com/images/user/31153941/profile_image/conversion/e5c02131-0460-45aa-9197-84b6b0b7cfdb-fullsize.webp' },
  { name: 'Danah_ah', kick: '', avatar: '' },
  { name: 'Misk_ry', kick: '', avatar: '' },
  { name: 'rema', kick: 'rema', avatar: '' },
  { name: 'Thamer', kick: '0Thamer', avatar: 'https://files.kick.com/images/user/34415053/profile_image/conversion/4dd489bf-d27f-49f8-8c47-18072ab57d7b-fullsize.webp' },
  { name: 'Rawabi', kick: 'Rawabi', avatar: 'https://files.kick.com/images/user/5834467/profile_image/conversion/56a26c88-7bb6-4d23-9bc7-e59745323c3c-fullsize.webp' },
  { name: 'Shatha', kick: 'Shatha', avatar: 'https://files.kick.com/images/user/1130827/profile_image/conversion/7681f6b8-0695-49d8-a859-e419737e1d57-fullsize.webp' },
  { name: 'JANAxx', kick: 'JANAxx', avatar: 'https://files.kick.com/images/user/5783941/profile_image/conversion/eb7e2e29-3a03-4356-b9cd-d1a4143b008d-fullsize.webp' },
  { name: 'Smok', kick: 'smok', avatar: '' },
  { name: 'ILOJAIN', kick: 'LOJJEN', avatar: 'https://files.kick.com/images/user/19449861/profile_image/conversion/5cf22d53-aca6-4246-becc-f0f52e9286ef-fullsize.webp' },
];

const palettes = [
  { ring: 'linear-gradient(135deg, #F7E6B8, #D9A441, #8B6914)', glow: 'rgba(217, 164, 65, 0.35)', to: '#D9A441' },
  { ring: 'linear-gradient(135deg, #FFC68F, #FF7A18, #D94A2B)', glow: 'rgba(255, 122, 24, 0.35)', to: '#FF7A18' },
  { ring: 'linear-gradient(135deg, #FFB3A1, #E34A2B, #7E1608)', glow: 'rgba(217, 74, 43, 0.35)', to: '#E34A2B' },
  { ring: 'linear-gradient(135deg, #FFF3C4, #E9C45C, #A67C1E)', glow: 'rgba(233, 196, 92, 0.35)', to: '#E9C45C' },
];

function initials(name: string) {
  return name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase();
}

function CrownIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 7l4 4 5-6 5 6 4-4-2 12H5L3 7z" />
      <path d="M5 21h14v1.5H5z" fillOpacity="0.4" />
    </svg>
  );
}

function ModAvatar({ src, fallback, ring, glow, featured }: { src: string; fallback: string; ring: string; glow: string; featured: boolean }) {
  const [failed, setFailed] = useState(false);
  const showImg = src && !failed;

  return (
    <div className={`relative rounded-full p-[2px] transition-transform duration-500 group-hover:scale-105 ${featured ? 'w-16 h-16 md:w-[72px] md:h-[72px]' : 'w-14 h-14 md:w-16 md:h-16'}`}
      style={{ background: ring, boxShadow: featured ? '0 0 18px rgba(217,164,65,0.4)' : `0 0 14px ${glow}` }}
    >
      <div className="w-full h-full rounded-full flex items-center justify-center overflow-hidden" style={{ background: 'radial-gradient(circle at 35% 30%, #241a12, #0c0806 75%)' }}>
        {showImg ? (
          <img
            src={src}
            alt={fallback}
            loading="lazy"
            onError={() => setFailed(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className={`font-black metal-shine ${featured ? 'text-xl md:text-2xl' : 'text-base md:text-lg'}`} style={{ fontFamily: 'Cairo, sans-serif' }}>
            {fallback}
          </span>
        )}
      </div>
    </div>
  );
}

export function ModeratorsSection() {
  return (
    <section id="moderators" className="relative py-16 md:py-20 px-0 overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[220px] pointer-events-none" style={{ background: 'radial-gradient(ellipse at center top, rgba(217, 164, 65, 0.05), transparent 65%)', filter: 'blur(30px)' }} />

      <div className="max-w-6xl mx-auto relative z-10">
        {/* ============ HEADER ============ */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: easeOut }}
          className="flex flex-col items-center text-center mb-10 md:mb-12"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="h-px w-10 md:w-16" style={{ background: 'linear-gradient(90deg, transparent, rgba(217,164,65,0.5))' }} />
            <span className="text-[10px] md:text-[11px] font-bold tracking-[0.3em] uppercase" style={{ fontFamily: 'Cairo, sans-serif', color: 'rgba(217, 164, 65, 0.65)' }}>
              The Guardians
            </span>
            <div className="h-px w-10 md:w-16" style={{ background: 'linear-gradient(270deg, transparent, rgba(217,164,65,0.5))' }} />
          </div>

          <h2 className="text-4xl md:text-5xl font-black mb-3" style={{ fontFamily: 'Cairo, sans-serif' }}>
            <span className="metal-shine drop-shadow-[0_3px_10px_rgba(0,0,0,0.8)]">MODERATORS</span>
          </h2>

          <p className="text-sm md:text-[15px] font-medium leading-7 max-w-md" style={{ fontFamily: 'Tajawal, sans-serif', color: 'rgba(247,243,238,0.45)' }}>
            Guardians of the TMNAA community — a strong team serving the audience and protecting the stream
          </p>
        </motion.div>

        {/* ============ GRID ============ */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-5 items-stretch">
          {moderators.map((mod, index) => {
            const p = palettes[index % palettes.length];
            const isFeatured = index === 0;

            return (
              <motion.div
                key={mod.name}
                initial={{ opacity: 0, y: 24, scale: 0.95 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.6, delay: 0, ease: easeOut }}
                whileHover={{ y: -6 }}
                className="group relative"
                style={isFeatured ? { zIndex: 2 } : undefined}
              >
                {/* Card */}
                <motion.div
                  className={`relative h-full rounded-2xl p-[1.5px] transition-shadow duration-500 ${isFeatured ? 'md:rounded-[22px]' : ''}`}
                  style={{
                    background: isFeatured
                      ? 'linear-gradient(160deg, rgba(247,230,184,0.5), rgba(217,164,65,0.15) 40%, rgba(255,255,255,0.06) 60%, rgba(217,164,65,0.35))'
                      : 'linear-gradient(160deg, rgba(217,164,65,0.3), rgba(255,122,24,0.07) 40%, rgba(255,255,255,0.05) 60%, rgba(217,164,65,0.2))',
                    boxShadow: isFeatured ? '0 0 22px rgba(217,164,65,0.15), 0 10px 28px rgba(0,0,0,0.55)' : '0 8px 24px rgba(0,0,0,0.5)',
                  }}
                >
                  <div
                    className="relative h-full flex flex-col items-center text-center overflow-hidden px-3 py-5 md:px-4 md:py-6 justify-center rounded-[15px] md:rounded-[21px] transition-colors duration-500"
                    style={{ background: 'linear-gradient(160deg, rgba(22,14,9,0.98), rgba(12,9,7,0.98))' }}
                  >
                    {/* Soft top glow on hover */}
                    <div
                      className="absolute -top-12 left-1/2 -translate-x-1/2 w-28 h-28 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                      style={{ background: `radial-gradient(circle, ${p.glow.replace('0.35', '0.18')}, transparent 70%)`, filter: 'blur(16px)' }}
                    />

                    {/* Featured crown */}
                    {isFeatured && (
                      <motion.div
                        initial={{ y: -14, opacity: 0, rotate: -12 }}
                        whileInView={{ y: 0, opacity: 1, rotate: 0 }}
                        viewport={{ once: true }}
                        transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.3 }}
                        className="absolute top-2.5 left-1/2 -translate-x-1/2 z-10"
                      >
                        <div className="relative">
                          <div className="absolute inset-0 blur-md" style={{ background: 'radial-gradient(circle, rgba(247,230,184,0.8), transparent 70%)' }} />
                          <span className="relative block" style={{ color: '#D9A441', filter: 'drop-shadow(0 0 8px rgba(217,164,65,0.7))' }}>
                            <CrownIcon size={16} />
                          </span>
                        </div>
                      </motion.div>
                    )}

                    {/* Index */}
                    <span className="absolute top-2.5 right-3 text-[9px] font-bold tracking-widest font-mono" style={{ color: 'rgba(247,243,238,0.14)' }}>
                      {String(index + 1).padStart(2, '0')}
                    </span>

                    {/* Avatar */}
                    <div className={`relative mb-3 ${isFeatured ? 'mt-1' : ''}`}>
                      <div className="absolute inset-0 rounded-full opacity-50 group-hover:opacity-100 transition-opacity duration-500" style={{ background: `radial-gradient(circle, ${p.glow}, transparent 70%)`, filter: 'blur(8px)' }} />
                      <ModAvatar src={mod.avatar} fallback={initials(mod.name)} ring={p.ring} glow={p.glow} featured={isFeatured} />
                      <span className="absolute bottom-0.5 right-0.5 w-3 h-3 rounded-full border-2 border-[#120b07]" style={{ background: 'radial-gradient(circle, #53FC18, #1EAE0A)' }} />
                    </div>

                    {/* Username */}
                    <h3 className="text-sm md:text-[15px] font-bold mb-1 truncate max-w-full" style={{ fontFamily: 'Cairo, sans-serif', color: '#F7F3EE' }}>
                      {mod.name}
                    </h3>

                    {/* Kick handle */}
                    {mod.kick && (
                      <a
                        href={`https://kick.com/${mod.kick}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mb-2 text-[9px] md:text-[10px] font-semibold truncate max-w-full transition-colors duration-300 hover:text-[#53FC18]"
                        style={{ fontFamily: 'Tajawal, sans-serif', color: 'rgba(83,252,24,0.5)' }}
                      >
                        @{mod.kick}
                      </a>
                    )}

                    {/* Badge */}
                    <div
                      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full transition-all duration-500 group-hover:shadow-[0_0_12px_rgba(217,164,65,0.25)]"
                      style={{
                        background: isFeatured
                          ? 'linear-gradient(135deg, rgba(217,164,65,0.28), rgba(255,122,24,0.12))'
                          : 'linear-gradient(135deg, rgba(217,164,65,0.14), rgba(255,122,24,0.06))',
                        border: isFeatured ? '1px solid rgba(247,230,184,0.6)' : '1px solid rgba(217,164,65,0.3)',
                      }}
                    >
                      {isFeatured && <CrownIcon size={9} />}
                      <svg width={9} height={9} viewBox="0 0 24 24" fill="none" stroke="#D9A441" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 22s8-3.5 8-10V5l-8-3-8 3v7c0 6.5 8 10 8 10z" />
                        <path d="M9 12l2 2 4-4" />
                      </svg>
                      <span className="text-[9px] font-bold tracking-[0.12em]" style={{ fontFamily: 'Cairo, sans-serif', color: isFeatured ? '#F7E6B8' : '#D9A441' }}>
                        MOD
                      </span>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

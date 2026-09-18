import { useState } from 'react';
import { motion } from 'framer-motion';

const easeOut = [0.22, 1, 0.36, 1] as const;

interface PaymentCardProps {
  title: string;
  url: string;
  color: string;
  label: string;
  iconImg?: string;
  delay?: number;
}

function PaymentCard({ title, url, color, label, iconImg, delay = 0 }: PaymentCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ y: 30, opacity: 0 }}
      whileInView={{ y: 0, opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.7, delay, ease: easeOut }}
      whileHover={{ scale: 1.03, y: -4 }}
      whileTap={{ scale: 0.97 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="group relative block w-full rounded-[24px] overflow-hidden border transition-all duration-500"
      style={{
        background: 'rgba(9, 8, 7, 0.8)',
        borderColor: isHovered ? `${color}60` : 'rgba(255,255,255,0.06)',
        boxShadow: isHovered ? `0 20px 50px -15px ${color}25` : '0 4px 20px rgba(0,0,0,0.3)',
      }}
    >
      <div
        className="absolute inset-0 transition-opacity duration-500"
        style={{
          background: `linear-gradient(135deg, ${color}15 0%, transparent 60%)`,
          opacity: isHovered ? 1 : 0.3,
        }}
      />
      <div className="relative z-10 p-5 md:p-6 flex flex-col justify-between h-full min-h-[130px]">
        <div className="flex items-center justify-between">
          <div className="p-3 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10">
            {iconImg ? (
              <img src={iconImg} alt={title} className="w-6 h-6 object-contain" />
            ) : (
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </div>
          <div className="w-8 h-8 rounded-full border flex items-center justify-center transition-all duration-300"
            style={{
              borderColor: isHovered ? color : 'rgba(255,255,255,0.2)',
              background: isHovered ? color : 'transparent',
              color: isHovered ? '#000' : 'rgba(255,255,255,0.5)',
            }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
        <div className="mt-4">
          <p className="text-[10px] font-bold tracking-[0.2em] uppercase mb-1 opacity-70" style={{ color }}>
            {label}
          </p>
          <h3 className="text-xl md:text-2xl font-black text-white tracking-tight">
            {title}
          </h3>
        </div>
      </div>
    </motion.a>
  );
}

export function SupportSection() {
  const alertTiers = [
    { amount: '20$', bg: 'from-[#CD7F32]/20 to-[#CD7F32]/5', border: 'border-[#CD7F32]/30', text: 'from-[#CD7F32] to-[#FFE0C2]', glow: 'hover:shadow-[0_0_15px_rgba(205,127,50,0.4)]' },
    { amount: '50$', bg: 'from-[#C0C0C0]/20 to-[#C0C0C0]/5', border: 'border-[#C0C0C0]/30', text: 'from-[#C0C0C0] to-[#FFFFFF]', glow: 'hover:shadow-[0_0_15px_rgba(192,192,192,0.4)]' },
    { amount: '100$', bg: 'from-[#FFD700]/20 to-[#FFD700]/5', border: 'border-[#FFD700]/30', text: 'from-[#FFD700] to-[#FFF8DC]', glow: 'hover:shadow-[0_0_15px_rgba(255,215,0,0.4)]' },
    { amount: '500$', bg: 'from-[#00BFFF]/20 to-[#00BFFF]/5', border: 'border-[#00BFFF]/30', text: 'from-[#00BFFF] to-[#E0FFFF]', glow: 'hover:shadow-[0_0_15px_rgba(0,191,255,0.4)]' },
    { amount: '1000$', bg: 'from-[#D4A84A]/30 to-[#D4A84A]/10', border: 'border-[#D4A84A]/50', text: 'from-[#D4A84A] to-[#FFF8DC]', glow: 'hover:shadow-[0_0_20px_rgba(212,168,74,0.6)]' },
  ];

  return (
    <section id="support" className="py-20 md:py-28 px-6 relative">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: easeOut }}
          className="flex items-center gap-4 mb-10"
        >
          <div className="h-[1px] flex-1" style={{ background: 'linear-gradient(90deg, transparent, rgba(217, 164, 65, 0.3), transparent)' }} />
          <h2 className="text-xs md:text-sm font-bold uppercase tracking-[0.3em]" style={{ color: 'rgba(247, 243, 238, 0.6)', fontFamily: 'Cairo, sans-serif' }}>
            SUPPORT & DONATION
          </h2>
          <div className="h-[1px] flex-1" style={{ background: 'linear-gradient(90deg, transparent, rgba(217, 164, 65, 0.3), transparent)' }} />
        </motion.div>

        {/* Payment Cards */}
        <div className="grid grid-cols-2 gap-4 mb-10">
          <PaymentCard title="PAYPAL" url="https://creators.sa/tmnaa" color="#0070BA" label="SUPPORT" delay={0.1} />
          <PaymentCard title="DOKAN" url="https://tip.dokan.sa/tmnaa" color="#FDE047" label="SEND TIP" iconImg="https://i.postimg.cc/Y0pfrW58/dokan-logo-white.png" delay={0.2} />
        </div>

        {/* Alert Tiers */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="flex flex-col items-center"
        >
          <div className="flex items-center gap-3 mb-5">
            <div className="w-1.5 h-1.5 rounded-full bg-white/40" />
            <h3 className="text-[10px] md:text-xs font-black tracking-[0.3em] uppercase" style={{ color: 'rgba(247, 243, 238, 0.5)' }}>
              Special Alerts
            </h3>
            <div className="w-1.5 h-1.5 rounded-full bg-white/40" />
          </div>

          <div className="flex flex-wrap justify-center gap-3">
            {alertTiers.map((item, idx) => (
              <div key={idx} className="relative group cursor-default">
                <div className={`absolute inset-0 rounded-xl bg-gradient-to-br ${item.bg} blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                <div className={`relative px-5 py-2.5 bg-[#050505]/90 backdrop-blur-md border ${item.border} rounded-xl transition-all duration-300 transform group-hover:-translate-y-1 ${item.glow} overflow-hidden`}>
                  <div className="absolute inset-0 -translate-x-[150%] group-hover:translate-x-[150%] transition-transform duration-700 ease-in-out bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-12" />
                  <span className={`relative z-10 text-sm font-black bg-clip-text text-transparent bg-gradient-to-b ${item.text} tracking-widest`}>
                    {item.amount}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        <p className="mt-6 text-center text-[9px] uppercase tracking-[0.2em]" style={{ color: 'rgba(247, 243, 238, 0.25)' }}>
          Donations are non-refundable
        </p>
      </div>
    </section>
  );
}

import { motion } from 'framer-motion';
import { Users, Eye, MessageCircle } from 'lucide-react';

interface StatCard {
  icon: any;
  value: string;
  label: string;
  color: string;
}

const stats: StatCard[] = [
  {
    icon: Users,
    value: '50,000+',
    label: 'مشترك',
    color: '#FF4A1C',
  },
  {
    icon: Eye,
    value: '120,000+',
    label: 'متابع',
    color: '#FFD98A',
  },
  {
    icon: MessageCircle,
    value: '15,000+',
    label: 'عضو في المجتمع',
    color: '#CFA347',
  },
];

export function CommunitySection() {
  return (
    <section id="community" className="py-24 px-6 bg-gradient-to-b from-[#050505] via-[#0a0a0a] to-[#050505]">
      <div className="max-w-[1400px] mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-5xl md:text-6xl font-black text-[#FFD98A] mb-4">
            المجتمع
          </h2>
          <p className="text-xl text-[#888888]">
            انضم إلى آلاف المتابعين حول العالم
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              whileHover={{ scale: 1.05, y: -5 }}
              className="relative group"
            >
              <div
                className="p-12 rounded-sm text-center transition-all duration-300"
                style={{
                  background: 'linear-gradient(135deg, rgba(20,10,5,0.95), rgba(30,15,5,0.9))',
                  border: '1px solid rgba(207, 163, 71, 0.4)',
                  boxShadow: '0 0 30px rgba(207, 163, 71, 0.1), inset 0 0 20px rgba(0,0,0,0.5)',
                }}
              >
                {/* Icon */}
                <div className="flex justify-center mb-6">
                  <div
                    className="p-6 rounded-full transition-all duration-300 group-hover:scale-110"
                    style={{
                      background: `linear-gradient(135deg, ${stat.color}20, ${stat.color}10)`,
                      border: `2px solid ${stat.color}40`,
                    }}
                  >
                    <stat.icon size={48} style={{ color: stat.color }} />
                  </div>
                </div>

                {/* Value - Animated Counter */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.8, delay: index * 0.1 + 0.3 }}
                  className="text-5xl md:text-6xl font-black mb-4"
                  style={{ color: stat.color }}
                >
                  {stat.value}
                </motion.div>

                {/* Label */}
                <p className="text-2xl text-white font-bold">
                  {stat.label}
                </p>

                {/* Hover Glow */}
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-sm"
                  style={{
                    boxShadow: `0 0 40px ${stat.color}40`,
                    border: `1px solid ${stat.color}60`,
                  }}
                />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

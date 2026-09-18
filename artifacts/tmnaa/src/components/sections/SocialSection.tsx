import { motion } from 'framer-motion';
import { FaYoutube, FaTiktok, FaInstagram, FaXTwitter } from 'react-icons/fa6';

interface SocialCard {
  platform: string;
  arabicName: string;
  description: string;
  icon: any;
  color: string;
  url: string;
}

const socialCards: SocialCard[] = [
  {
    platform: 'YouTube',
    arabicName: 'يوتيوب',
    description: 'شاهد البثوث المباشرة والمقاطع الحصرية',
    icon: FaYoutube,
    color: '#FF0000',
    url: 'https://www.youtube.com/@tmnaa1',
  },
  {
    platform: 'TikTok',
    arabicName: 'تيك توك',
    description: 'تابع المحتوى القصير والممتع',
    icon: FaTiktok,
    color: '#FFFFFF',
    url: 'https://www.tiktok.com/@tmnaa0',
  },
  {
    platform: 'Instagram',
    arabicName: 'إنستغرام',
    description: 'صور وقصص من وراء الكواليس',
    icon: FaInstagram,
    color: '#E4405F',
    url: 'https://www.instagram.com/tmnaa16',
  },
  {
    platform: 'X',
    arabicName: 'إكس',
    description: 'آخر الأخبار والتحديثات',
    icon: FaXTwitter,
    color: '#FFFFFF',
    url: 'https://x.com/tmnaa16',
  },
];

export function SocialSection() {
  return (
    <section className="py-24 px-6 bg-gradient-to-b from-[#050505] via-[#090909] to-[#050505]">
      <div className="max-w-[1400px] mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-5xl md:text-6xl font-black text-[#FFD98A] mb-4">
            تابعني على
          </h2>
          <p className="text-xl text-[#888888]">
            انضم إلى المجتمع على جميع المنصات
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {socialCards.map((card, index) => (
            <motion.a
              key={card.platform}
              href={card.url}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              whileHover={{ y: -8, scale: 1.02 }}
              className="relative group"
            >
              <div
                className="relative p-8 rounded-sm overflow-hidden transition-all duration-300"
                style={{
                  background: 'linear-gradient(135deg, rgba(20,10,5,0.95), rgba(30,15,5,0.9))',
                  border: '1px solid rgba(207, 163, 71, 0.4)',
                  boxShadow: '0 0 30px rgba(207, 163, 71, 0.1), inset 0 0 20px rgba(0,0,0,0.5)',
                }}
              >
                {/* Icon */}
                <div className="flex justify-center mb-6">
                  <div
                    className="transition-all duration-300 group-hover:scale-110"
                    style={{ fontSize: '64px', color: card.color }}
                  >
                    <card.icon />
                  </div>
                </div>

                {/* Platform Name */}
                <h3 className="text-2xl font-bold text-white text-center mb-2">
                  {card.arabicName}
                </h3>

                {/* Description */}
                <p className="text-[#888888] text-center text-sm mb-6">
                  {card.description}
                </p>

                {/* Follow Button */}
                <div className="flex justify-center">
                  <button
                    className="px-6 py-2 text-sm font-bold text-[#FFD98A] border border-[#CFA347] rounded-sm
                      transition-all duration-300 hover:bg-[#CFA347] hover:text-black"
                    style={{
                      background: 'linear-gradient(135deg, rgba(13,13,13,0.9), rgba(27,27,27,0.8))',
                      boxShadow: '0 0 15px rgba(207, 163, 71, 0.2)',
                    }}
                  >
                    تابعنا
                  </button>
                </div>

                {/* Hover Glow Effect */}
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                  style={{
                    boxShadow: `0 0 40px rgba(255, 217, 138, 0.3)`,
                    border: '1px solid rgba(255, 217, 138, 0.6)',
                  }}
                />
              </div>
            </motion.a>
          ))}
        </div>
      </div>
    </section>
  );
}

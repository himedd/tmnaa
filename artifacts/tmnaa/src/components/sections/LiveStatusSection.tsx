import { motion } from 'framer-motion';
import { Play } from 'lucide-react';

export function LiveStatusSection() {
  // Mock live status - in real app would come from API
  const isLive = false;

  return (
    <section className="py-16 px-6 bg-[#090909]">
      <div className="max-w-[1000px] mx-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="relative p-12 rounded-sm overflow-hidden"
          style={{
            background: isLive
              ? 'linear-gradient(135deg, rgba(154,30,5,0.3), rgba(255,74,28,0.2))'
              : 'linear-gradient(135deg, rgba(20,10,5,0.95), rgba(30,15,5,0.9))',
            border: isLive
              ? '2px solid rgba(255, 74, 28, 0.8)'
              : '1px solid rgba(207, 163, 71, 0.4)',
            boxShadow: isLive
              ? '0 0 40px rgba(255, 74, 28, 0.4), inset 0 0 30px rgba(255, 74, 28, 0.1)'
              : '0 0 30px rgba(207, 163, 71, 0.1), inset 0 0 20px rgba(0,0,0,0.5)',
          }}
        >
          <div className="text-center">
            {/* Status Badge */}
            <div className="flex justify-center mb-6">
              {isLive ? (
                <div className="flex items-center gap-3 px-6 py-3 bg-[#FF4A1C] rounded-sm">
                  <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
                  <span className="text-white font-bold text-lg">
                    مباشر الآن
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-3 px-6 py-3 bg-[#1b1b1b] border border-[#CFA347] rounded-sm">
                  <Play size={20} className="text-[#888888]" />
                  <span className="text-[#888888] font-bold text-lg">
                    غير متصل
                  </span>
                </div>
              )}
            </div>

            {/* Title */}
            <h2 className="text-4xl md:text-5xl font-black text-white mb-4">
              البث المباشر
            </h2>

            {/* Message */}
            <p className="text-xl text-[#D7D7D7] mb-8">
              {isLive
                ? 'انضم الآن إلى البث المباشر وشاهد أفضل المحتوى!'
                : 'البث غير متاح حاليًا. تابعنا لمعرفة مواعيد البث القادمة!'}
            </p>

            {/* Button */}
            {isLive && (
              <motion.a
                href="https://www.youtube.com/@tmnaa1"
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="inline-block px-10 py-4 bg-gradient-to-br from-[#9A1E05] via-[#FF4A1C] to-[#9A1E05]
                  border border-[#FFD98A] text-white font-bold text-lg rounded-sm
                  shadow-[0_0_20px_rgba(255,74,28,0.5)] hover:shadow-[0_0_30px_rgba(255,74,28,0.8)]
                  transition-all duration-300"
              >
                شاهد الآن 🔥
              </motion.a>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

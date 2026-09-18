import { motion } from 'framer-motion';
import { Calendar, Clock } from 'lucide-react';

interface ScheduleDay {
  day: string;
  time: string;
  game: string;
  status: 'live' | 'upcoming' | 'past';
}

const schedule: ScheduleDay[] = [
  {
    day: 'الأحد',
    time: '8:00 مساءً',
    game: 'فورت نايت - تحديات البقاء',
    status: 'upcoming',
  },
  {
    day: 'الإثنين',
    time: '9:00 مساءً',
    game: 'كول أوف ديوتي - معارك فرق',
    status: 'upcoming',
  },
  {
    day: 'الثلاثاء',
    time: '8:30 مساءً',
    game: 'فالورانت - تصنيفي',
    status: 'upcoming',
  },
  {
    day: 'الأربعاء',
    time: '9:00 مساءً',
    game: 'أبيكس ليجندز - مع المتابعين',
    status: 'upcoming',
  },
  {
    day: 'الخميس',
    time: '8:00 مساءً',
    game: 'محتوى متنوع - اختيار الجمهور',
    status: 'upcoming',
  },
];

export function ScheduleSection() {
  return (
    <section id="schedule" className="py-24 px-6 bg-gradient-to-b from-[#050505] via-[#0a0a0a] to-[#050505]">
      <div className="max-w-[1200px] mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-5xl md:text-6xl font-black text-[#FFD98A] mb-4">
            جدول البث
          </h2>
          <p className="text-xl text-[#888888]">
            لا تفوت أي بث مباشر - تابع الجدول الأسبوعي
          </p>
        </motion.div>

        <div className="space-y-4">
          {schedule.map((item, index) => (
            <motion.div
              key={item.day}
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.05 }}
              whileHover={{ x: 10, scale: 1.02 }}
              className="relative group"
            >
              <div
                className="p-6 rounded-sm transition-all duration-300"
                style={{
                  background: item.status === 'live'
                    ? 'linear-gradient(135deg, rgba(154,30,5,0.3), rgba(255,74,28,0.2))'
                    : 'linear-gradient(135deg, rgba(20,10,5,0.95), rgba(30,15,5,0.9))',
                  border: item.status === 'live'
                    ? '2px solid rgba(255, 74, 28, 0.8)'
                    : '1px solid rgba(207, 163, 71, 0.4)',
                  boxShadow: item.status === 'live'
                    ? '0 0 30px rgba(255, 74, 28, 0.3)'
                    : '0 0 20px rgba(207, 163, 71, 0.1), inset 0 0 15px rgba(0,0,0,0.5)',
                }}
              >
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  {/* Right: Day & Time */}
                  <div className="flex items-center gap-6">
                    {/* Day */}
                    <div className="flex items-center gap-3">
                      <Calendar size={24} className="text-[#FFD98A]" />
                      <span className="text-2xl font-bold text-white min-w-[80px]">
                        {item.day}
                      </span>
                    </div>

                    {/* Time */}
                    <div className="flex items-center gap-3">
                      <Clock size={24} className="text-[#CFA347]" />
                      <span className="text-xl text-[#D7D7D7]">
                        {item.time}
                      </span>
                    </div>
                  </div>

                  {/* Center: Game */}
                  <div className="flex-1">
                    <p className="text-xl text-white font-medium">
                      {item.game}
                    </p>
                  </div>

                  {/* Left: Status */}
                  <div>
                    {item.status === 'live' && (
                      <div className="flex items-center gap-2 px-4 py-2 bg-[#FF4A1C] rounded-sm">
                        <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                        <span className="text-white font-bold text-sm">
                          مباشر الآن
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Hover Effect */}
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-sm"
                  style={{
                    boxShadow: '0 0 40px rgba(255, 217, 138, 0.3)',
                    border: '1px solid rgba(255, 217, 138, 0.6)',
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

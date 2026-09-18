import { motion } from 'framer-motion';
import { Gamepad2, Trophy, Sparkles } from 'lucide-react';
import logoImg from '@assets/IMG_3093_1785158973333.WEBP';

export function AboutSection() {
  const features = [
    {
      icon: Gamepad2,
      title: 'ألعاب متنوعة',
      description: 'محتوى متنوع من مختلف الألعاب والتحديات',
    },
    {
      icon: Trophy,
      title: 'احترافية عالية',
      description: 'بثوث مباشرة ومقاطع بأعلى جودة',
    },
    {
      icon: Sparkles,
      title: 'محتوى حصري',
      description: 'تجربة فريدة ومميزة لا تُنسى',
    },
  ];

  return (
    <section id="about" className="py-24 px-6 bg-gradient-to-b from-[#050505] via-[#111111] to-[#050505]">
      <div className="max-w-[1400px] mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Left: Logo Image */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="flex justify-center"
          >
            <div className="relative">
              <img
                src={logoImg}
                alt="TMNAA"
                className="w-full max-w-[400px] h-auto pulse-glow"
              />
              {/* Decorative Glow */}
              <div
                className="absolute inset-0 blur-3xl opacity-50"
                style={{
                  background: 'radial-gradient(circle, rgba(255, 217, 138, 0.3), transparent)',
                }}
              />
            </div>
          </motion.div>

          {/* Right: Content */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-5xl md:text-6xl font-black text-[#FFD98A] mb-6">
              من أنا
            </h2>

            <p className="text-xl text-[#D7D7D7] leading-relaxed mb-12">
              صانع محتوى وبثوث مباشرة يقدم الألعاب، التحديات، والمحتوى الترفيهي بأعلى جودة.
              يسعى دائماً لتقديم تجربة فريدة ومميزة لجمهوره.
            </p>

            {/* Features */}
            <div className="space-y-6">
              {features.map((feature, index) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  className="flex items-start gap-4 p-6 rounded-sm"
                  style={{
                    background: 'linear-gradient(135deg, rgba(20,10,5,0.6), rgba(30,15,5,0.4))',
                    border: '1px solid rgba(207, 163, 71, 0.3)',
                  }}
                >
                  <div
                    className="p-4 rounded-sm"
                    style={{
                      background: 'linear-gradient(135deg, rgba(255, 74, 28, 0.2), rgba(255, 92, 33, 0.1))',
                      border: '1px solid rgba(255, 74, 28, 0.4)',
                    }}
                  >
                    <feature.icon size={32} className="text-[#FF4A1C]" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white mb-2">
                      {feature.title}
                    </h3>
                    <p className="text-[#888888]">
                      {feature.description}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

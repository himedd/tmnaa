import { motion } from 'framer-motion';
import { useState } from 'react';
import galleryImg1 from '@assets/Put_emoji_like_second_image_202607270556_1785158973332.jpeg';
import galleryImg2 from '@assets/Put_emoji_like_second_image_202607270556_(1)_1785158973332.jpeg';
import galleryImg3 from '@assets/Dragon_banner_with_red_sparks_202607270531_1785158973332.jpeg';
import galleryImg4 from '@assets/IMG_3092_1785158973333.PNG';
import galleryImg5 from '@assets/IMG_3094_1785158973332.PNG';
import bannerImg from '@assets/IMG_3092_1785158973333.PNG';

const galleryItems = [
  { id: 1, img: galleryImg1, title: 'معركة التنين' },
  { id: 2, img: galleryImg2, title: 'قوة النار' },
  { id: 3, img: galleryImg3, title: 'شرارة المجد' },
  { id: 4, img: galleryImg4, title: 'الشعار المضيء' },
  { id: 5, img: galleryImg5, title: 'جمرات النصر' },
  { id: 6, img: bannerImg, title: 'راية TMNAA' },
];

export function GallerySection() {
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  return (
    <section id="gallery" className="py-24 px-6 bg-gradient-to-b from-[#050505] via-[#0a0a0a] to-[#050505]">
      <div className="max-w-[1400px] mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-5xl md:text-6xl font-black text-[#FFD98A] mb-4">
            المعرض
          </h2>
          <p className="text-xl text-[#888888]">
            لحظات ملحمية من عالم TMNAA
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {galleryItems.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              onMouseEnter={() => setHoveredId(item.id)}
              onMouseLeave={() => setHoveredId(null)}
              className="relative group cursor-pointer"
              style={{
                perspective: '1000px',
              }}
            >
              <motion.div
                whileHover={{ rotateY: 5, rotateX: 5, scale: 1.05 }}
                transition={{ duration: 0.3 }}
                className="relative overflow-hidden rounded-sm"
                style={{
                  transformStyle: 'preserve-3d',
                  border: '2px solid rgba(207, 163, 71, 0.4)',
                  boxShadow: '0 0 30px rgba(207, 163, 71, 0.1)',
                }}
              >
                {/* Image */}
                <div className="aspect-video overflow-hidden">
                  <motion.img
                    src={item.img}
                    alt={item.title}
                    className="w-full h-full object-cover"
                    whileHover={{ scale: 1.1 }}
                    transition={{ duration: 0.5 }}
                  />
                </div>

                {/* Overlay */}
                <div
                  className={`absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent
                    transition-opacity duration-300 flex items-end p-6
                    ${hoveredId === item.id ? 'opacity-100' : 'opacity-70'}`}
                >
                  <h3 className="text-2xl font-bold text-[#FFD98A]">
                    {item.title}
                  </h3>
                </div>

                {/* Golden Frame Effect on Hover */}
                <div
                  className={`absolute inset-0 pointer-events-none transition-opacity duration-300
                    ${hoveredId === item.id ? 'opacity-100' : 'opacity-0'}`}
                  style={{
                    boxShadow: '0 0 40px rgba(255, 217, 138, 0.6), inset 0 0 30px rgba(255, 217, 138, 0.1)',
                    border: '2px solid rgba(255, 217, 138, 0.8)',
                  }}
                />
              </motion.div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

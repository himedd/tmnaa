import { FaYoutube, FaTiktok, FaInstagram, FaXTwitter } from 'react-icons/fa6';

export function Footer() {
  const quickLinks = [
    { href: '#home', label: 'الرئيسية' },
    { href: '#about', label: 'من أنا' },
    { href: '#gallery', label: 'المعرض' },
    { href: '#schedule', label: 'الجدول' },
    { href: '#support', label: 'الدعم' },
  ];

  const socialLinks = [
    { href: 'https://www.youtube.com/@tmnaa1', icon: FaYoutube, color: '#FF0000' },
    { href: 'https://www.tiktok.com/@tmnaa0', icon: FaTiktok, color: '#FFFFFF' },
    { href: 'https://www.instagram.com/tmnaa16', icon: FaInstagram, color: '#E4405F' },
    { href: 'https://x.com/tmnaa16', icon: FaXTwitter, color: '#FFFFFF' },
  ];

  return (
    <footer className="bg-[#030303] border-t border-[rgba(207,163,71,0.2)] py-16">
      <div className="max-w-[1400px] mx-auto px-6">


        {/* Quick Links */}
        <div className="flex flex-wrap justify-center gap-8 mb-12">
          {quickLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-[#D7D7D7] hover:text-[#FFD98A] transition-colors text-lg"
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* Social Icons */}
        <div className="flex justify-center gap-8 mb-12">
          {socialLinks.map((social) => (
            <a
              key={social.href}
              href={social.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#888888] hover:text-white transition-all transform hover:scale-110"
              style={{ fontSize: '32px' }}
            >
              <social.icon />
            </a>
          ))}
        </div>

        {/* Copyright */}
        <div className="text-center text-[#888888] text-sm">
          <p>© 2025 TMNAA — جميع الحقوق محفوظة</p>
        </div>
      </div>
    </footer>
  );
}

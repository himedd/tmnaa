import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface ForgedButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'fire' | 'metal';
  href?: string;
}

const ForgedButton = forwardRef<HTMLButtonElement, ForgedButtonProps>(
  ({ className, variant = 'fire', children, href, ...props }, ref) => {
    const baseStyles = `
      relative px-8 py-4 font-bold text-lg transition-all duration-300
      overflow-hidden group cursor-pointer
    `;

    const fireStyles = `
      bg-gradient-to-br from-[#9A1E05] via-[#FF4A1C] to-[#9A1E05]
      border border-[#FFD98A]
      text-white
      shadow-[0_0_20px_rgba(255,74,28,0.5),inset_0_0_10px_rgba(255,217,138,0.1)]
      hover:shadow-[0_0_30px_rgba(255,74,28,0.8),inset_0_0_15px_rgba(255,217,138,0.2)]
      hover:scale-105
      active:scale-95
    `;

    const metalStyles = `
      bg-gradient-to-br from-[#0d0d0d] via-[#1b1b1b] to-[#0d0d0d]
      border border-[#CFA347]
      text-[#FFD98A]
      shadow-[0_0_15px_rgba(207,163,71,0.3),inset_0_0_10px_rgba(207,163,71,0.05)]
      hover:shadow-[0_0_25px_rgba(207,163,71,0.5),inset_0_0_15px_rgba(207,163,71,0.1)]
      hover:scale-105
      active:scale-95
    `;

    const clipPathStyle = {
      clipPath: 'polygon(10px 0%, calc(100% - 10px) 0%, 100% 10px, 100% calc(100% - 10px), calc(100% - 10px) 100%, 10px 100%, 0% calc(100% - 10px), 0% 10px)',
    };

    const content = (
      <button
        ref={ref}
        className={cn(
          baseStyles,
          variant === 'fire' ? fireStyles : metalStyles,
          className
        )}
        style={clipPathStyle}
        {...props}
      >
        <span className="relative z-10">{children}</span>
        <div className="absolute inset-0 shimmer opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </button>
    );

    if (href) {
      return (
        <a href={href} target="_blank" rel="noopener noreferrer" className="inline-block">
          {content}
        </a>
      );
    }

    return content;
  }
);

ForgedButton.displayName = 'ForgedButton';

export { ForgedButton };

import { useEffect, useRef } from 'react';

interface Ember {
  x: number;
  y: number;
  size: number;
  speedY: number;
  speedX: number;
  opacity: number;
  maxOpacity: number;
  color: string;
  life: number;
  maxLife: number;
  flickerSpeed: number;
  flickerOffset: number;
  wobbleAmp: number;
  wobbleSpeed: number;
  wobblePhase: number;
}

export function EmberCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const embers: Ember[] = [];
    const emberCount = 70;
    const colors = [
      { r: 217, g: 164, b: 65 },   // Gold
      { r: 255, g: 122, b: 24 },    // Orange
      { r: 217, g: 74, b: 43 },     // Red
      { r: 247, g: 210, b: 130 },   // Light gold
      { r: 255, g: 160, b: 50 },    // Warm orange
      { r: 200, g: 80, b: 20 },     // Deep ember
    ];

    const initEmber = (ember: Ember, randomY = true) => {
      ember.x = Math.random() * canvas.width;
      ember.y = randomY
        ? Math.random() * canvas.height
        : canvas.height + Math.random() * 50;
      ember.size = Math.random() * 2.8 + 0.4;
      ember.speedY = Math.random() * 0.6 + 0.15;
      ember.speedX = (Math.random() - 0.5) * 0.3;
      ember.maxOpacity = Math.random() * 0.6 + 0.2;
      ember.opacity = 0;
      ember.color = JSON.stringify(colors[Math.floor(Math.random() * colors.length)]);
      ember.life = randomY ? Math.random() * 300 : 0;
      ember.maxLife = Math.random() * 400 + 200;
      ember.flickerSpeed = Math.random() * 0.08 + 0.02;
      ember.flickerOffset = Math.random() * Math.PI * 2;
      ember.wobbleAmp = Math.random() * 0.8 + 0.2;
      ember.wobbleSpeed = Math.random() * 0.02 + 0.005;
      ember.wobblePhase = Math.random() * Math.PI * 2;
    };

    for (let i = 0; i < emberCount; i++) {
      const ember = {} as Ember;
      initEmber(ember, true);
      ember.opacity = ember.maxOpacity;
      embers.push(ember);
    }

    let animationFrameId: number;
    let time = 0;

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      time += 1;

      embers.forEach((ember) => {
        ember.life += 1;

        // Update position with wobble
        ember.wobblePhase += ember.wobbleSpeed;
        ember.x += ember.speedX + Math.sin(ember.wobblePhase) * ember.wobbleAmp * 0.3;
        ember.y -= ember.speedY;

        // Subtle wind effect
        ember.speedX += (Math.random() - 0.5) * 0.02;
        ember.speedX *= 0.99;

        // Flicker
        const flicker = Math.sin(time * ember.flickerSpeed + ember.flickerOffset) * 0.3 + 0.7;

        // Life cycle fade
        const lifeProgress = ember.life / ember.maxLife;
        let lifeFade = 1;
        if (lifeProgress < 0.1) {
          lifeFade = lifeProgress / 0.1;
        } else if (lifeProgress > 0.7) {
          lifeFade = (1 - lifeProgress) / 0.3;
        }

        ember.opacity = ember.maxOpacity * flicker * lifeFade;

        // Reset when off screen or dead
        if (ember.y < -20 || ember.life > ember.maxLife || ember.opacity <= 0) {
          initEmber(ember, false);
          return;
        }

        const color = JSON.parse(ember.color);

        // Draw ember with trail and glow
        ctx.save();
        ctx.globalAlpha = ember.opacity;

        // Outer glow
        const gradient = ctx.createRadialGradient(
          ember.x, ember.y, 0,
          ember.x, ember.y, ember.size * 6
        );
        gradient.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, ${ember.opacity * 0.3})`);
        gradient.addColorStop(0.5, `rgba(${color.r}, ${color.g}, ${color.b}, ${ember.opacity * 0.08})`);
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(ember.x, ember.y, ember.size * 6, 0, Math.PI * 2);
        ctx.fill();

        // Core ember
        ctx.globalAlpha = ember.opacity * 0.9;
        ctx.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
        ctx.shadowBlur = ember.size * 4;
        ctx.shadowColor = `rgba(${color.r}, ${color.g}, ${color.b}, 0.8)`;
        ctx.beginPath();
        ctx.arc(ember.x, ember.y, ember.size, 0, Math.PI * 2);
        ctx.fill();

        // Bright center
        ctx.globalAlpha = ember.opacity * 0.6;
        ctx.fillStyle = '#FFF5E0';
        ctx.shadowBlur = ember.size * 2;
        ctx.shadowColor = '#FFF5E0';
        ctx.beginPath();
        ctx.arc(ember.x, ember.y, ember.size * 0.3, 0, Math.PI * 2);
        ctx.fill();

        // Vertical trail
        ctx.globalAlpha = ember.opacity * 0.15;
        ctx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, 0.4)`;
        ctx.lineWidth = ember.size * 0.4;
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.moveTo(ember.x, ember.y);
        ctx.lineTo(ember.x + ember.speedX * 3, ember.y + ember.speedY * 8);
        ctx.stroke();

        ctx.restore();
      });

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none z-10"
      style={{ mixBlendMode: 'screen' }}
    />
  );
}

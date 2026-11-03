import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Language } from '../types';

/* ============================================================
   SubscribeGuide — دليل «حل مشكلة الاشتراك»
   يُفتح من الزر الموجود عند مربع شارات المشتركين:
   اشتراك كيك ما يشتغل بالبطاقة المباشرة؟ الحل: بطاقة برق الرقمية + Apple Pay.
   ============================================================ */

interface GuideCopy {
  eyebrow: string;
  title: string;
  intro: string;
  steps: { t: string; d: string }[];
  shotsTitle: string;
  zoomHint: string;
  back: string;
  caption: [string, string];
  done: string;
  doneSub: string;
  cta: string;
  close: string;
  trigger: string;
}

const COPY: Record<'ar' | 'en', GuideCopy> = {
  ar: {
    eyebrow: 'بطاقة برق · Apple Pay',
    title: 'حل مشكلة الاشتراك',
    intro: 'كثير منكم تواجهه مشكلة: الاشتراك في Kick ما يشتغل بالبطاقة مباشرة. هذا الحل اللي نجح مع كثير 👌',
    steps: [
      { t: 'ادخل على البطاقات', d: 'من تطبيق برق — افتح قسم «البطاقات» ثم اختر «إصدار بطاقة جديدة».' },
      { t: 'أصدر بطاقة برق الرقمية', d: 'اختر «بطاقة رمز الريال السعودي» وأكمل خطوات الإصدار، وفعّلها لما يتواصل معك التطبيق.' },
      { t: 'اشحن البطاقة', d: 'بعد التفعيل أضِف الرصيد اللي بتستخدمه للاشتراك.' },
      { t: 'اختر Apple Pay', d: 'وقت الاشتراك في Kick لا تدفع بالبطاقة مباشرة — اختر Apple Pay كطريقة للدفع.' },
      { t: 'غيّر وسيلة الدفع إلى بطاقة برق', d: 'داخل Apple Pay اختر بطاقة برق (Riyal symbol) بدل أي بطاقة ثانية، ثم أكمل عملية الدفع.' },
    ],
    shotsTitle: 'الصور توضح كل خطوة بالترتيب',
    zoomHint: 'اضغط الصورة للتكبير',
    back: 'رجوع للخطوات',
    caption: ['الخطوتان ١ و ٢', 'الخطوات ٣ و ٤ و ٥'],
    done: 'وبكذا يتم الاشتراك في Kick بدون مشاكل بإذن الله ✅',
    doneSub: 'تابع الصور من ١ إلى ٥ وأنت تمام.',
    cta: 'اشترك على كيك',
    close: 'إغلاق',
    trigger: 'حل مشكلة الاشتراك',
  },
  en: {
    eyebrow: 'Birq card · Apple Pay',
    title: 'Fix the subscription',
    intro: 'A lot of you hit the same wall: the Kick subscription fails on a direct card payment. This is the fix that works 👌',
    steps: [
      { t: 'Open Cards', d: 'In the Birq app — go to the Cards tab, then choose "Issue new card".' },
      { t: 'Issue the digital Birq card', d: 'Pick the "Riyal symbol" digital card, finish issuing, and activate it when the app confirms.' },
      { t: 'Top up the card', d: 'After activation, add the balance you will subscribe with.' },
      { t: 'Choose Apple Pay', d: 'On Kick, do not pay by card directly — pick Apple Pay as the payment method.' },
      { t: 'Switch the payment to Birq', d: 'Inside Apple Pay select the Birq card (Riyal symbol) instead of any other card, then confirm.' },
    ],
    shotsTitle: 'The screenshots show every step in order',
    zoomHint: 'Tap to enlarge',
    back: 'Back to the steps',
    caption: ['Steps 1 & 2', 'Steps 3, 4 & 5'],
    done: 'That is it — the Kick subscription goes through, God willing ✅',
    doneSub: 'Follow the screenshots from 1 to 5.',
    cta: 'Subscribe on Kick',
    close: 'Close',
    trigger: 'Fix subscription',
  },
};

const SHOTS = [
  { src: 'guide/birq-1.webp', alt: 'Birq app: cards tab and issuing a new digital card' },
  { src: 'guide/birq-2.webp', alt: 'Birq balance, Apple Pay sheet and choosing the Birq card' },
];

export const SubscribeGuide: React.FC<{ lang: Language }> = ({ lang }) => {
  const c = COPY[lang === 'en' ? 'en' : 'ar'];
  const [open, setOpen] = useState(false);
  const [zoom, setZoom] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { if (zoom !== null) setZoom(null); else setOpen(false); }
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, zoom]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        className="group inline-flex items-center gap-1.5 text-[10px] font-black px-3 py-1.5 rounded-full border border-[#E3B341]/45 bg-[#E3B341]/10 text-[#F7E3AE] hover:bg-[#E3B341] hover:text-navy-950 hover:shadow-[0_0_22px_rgba(227,179,65,0.55)] active:scale-95 transition-all duration-300">
        <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.5a2.25 2.25 0 113.4 1.93c-.66.44-1.4.98-1.4 1.94v.63" />
          <circle cx="12" cy="17.25" r=".9" fill="currentColor" stroke="none" />
          <circle cx="12" cy="12" r="9.2" strokeWidth={1.6} />
        </svg>
        {c.trigger}
      </button>

      {open && createPortal(
        <div className="modal-backdrop fixed inset-0 z-[130] flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md"
          role="dialog" aria-modal="true" aria-label={c.title} onClick={() => setOpen(false)}>
          <div className="modal-sheet relative w-full max-w-[640px] max-h-[92vh] overflow-hidden rounded-[26px] border border-gold/25 bg-gradient-to-b from-navy-900 via-navy-950 to-black shadow-[0_40px_120px_-20px_rgba(0,0,0,0.95)]"
            onClick={(e) => e.stopPropagation()}>
            <div className="absolute top-0 inset-x-0 h-[3px] bg-gradient-to-l from-transparent via-gold to-transparent pointer-events-none" />

            {/* header */}
            <div className="relative flex items-center gap-3.5 px-5 sm:px-7 pt-6 pb-5 border-b border-gold/15 bg-[radial-gradient(130%_130%_at_50%_0%,rgba(227,179,65,0.16),transparent_68%)]">
              <span className="w-11 h-11 shrink-0 rounded-2xl flex items-center justify-center text-navy-950"
                style={{ background: 'linear-gradient(150deg, #FFF3D6, #E3B341 55%, #B8860B)', boxShadow: '0 10px 26px -8px rgba(227,179,65,0.8), inset 0 1px 0 rgba(255,255,255,0.6)' }}>
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
                  <path strokeLinecap="round" d="M2.5 9.75h19M6 14.5h4" />
                </svg>
              </span>
              <div className="min-w-0">
                <p className="text-[9px] font-black tracking-[0.3em] text-gold/55 uppercase">{c.eyebrow}</p>
                <h4 className="text-lg sm:text-2xl font-black text-white leading-tight">{c.title}</h4>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label={c.close}
                className="ms-auto w-9 h-9 shrink-0 rounded-xl grid place-items-center bg-white/[0.06] border border-gold/20 text-white/60 hover:text-navy-950 hover:bg-gold hover:border-gold transition-all duration-300">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.4}><path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            </div>

            <div className="px-5 sm:px-7 py-5 overflow-y-auto max-h-[calc(92vh-96px)]">
              {zoom !== null ? (
                /* ---- شاشة التكبير: الصورة وحدها حتى يظل زر الرجوع ظاهراً ---- */
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-gold shadow-[0_0_8px_#E3B341]" />
                    <p className="text-[10px] font-black tracking-[0.22em] text-gold/50 uppercase">{c.caption[zoom]}</p>
                    <div className="ms-auto flex items-center gap-1.5">
                      {SHOTS.map((_, i) => (
                        <button key={i} type="button" onClick={() => setZoom(i)} aria-label={c.caption[i]}
                          className={`h-1.5 rounded-full transition-all duration-300 ${i === zoom ? 'w-6 bg-gold' : 'w-1.5 bg-white/25 hover:bg-white/50'}`} />
                      ))}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-gold/25 bg-black/70 p-2 shadow-[0_0_50px_-18px_rgba(227,179,65,0.45)]">
                    <img src={SHOTS[zoom].src} alt={SHOTS[zoom].alt}
                      className="w-full max-h-[60vh] object-contain rounded-xl" />
                  </div>
                  <button type="button" onClick={() => setZoom(null)}
                    className={`self-center inline-flex items-center gap-2 text-[11px] font-black px-4 py-2 rounded-full bg-white/[0.07] border border-gold/30 text-white/75 hover:bg-gold hover:text-navy-950 hover:border-gold transition-all duration-300 ${lang === 'ar' ? 'flex-row-reverse' : ''}`}>
                    <svg className={`w-3.5 h-3.5 ${lang === 'ar' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.6}><path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                    {c.back}
                  </button>
                </div>
              ) : (
                <div className="space-y-5">
                  {/* intro */}
                  <p className="text-[12.5px] sm:text-[13.5px] font-bold leading-relaxed text-gold-light bg-gold/[0.08] border border-gold/25 rounded-2xl px-4 py-3">
                    {c.intro}
                  </p>

                  {/* steps timeline */}
                  <ol className="space-y-4">
                    {c.steps.map((s, i) => (
                      <li key={s.t} className="relative flex items-start gap-3.5">
                        {i < c.steps.length - 1 && (
                          <span className="absolute top-11 bottom-[-16px] start-[19px] w-px bg-gradient-to-b from-gold/45 to-gold/5" aria-hidden="true" />
                        )}
                        <span className="relative z-10 w-10 h-10 shrink-0 rounded-full grid place-items-center text-[13px] font-black text-navy-950"
                          style={{ background: 'linear-gradient(150deg, #FFF3D6, #E3B341 58%, #B8860B)', boxShadow: '0 8px 20px -8px rgba(227,179,65,0.85), inset 0 1px 0 rgba(255,255,255,0.55)' }}
                          dir="ltr">{i + 1}</span>
                        <div className="min-w-0 pt-0.5">
                          <p className="text-[13.5px] sm:text-[15px] font-black text-white leading-snug">{s.t}</p>
                          <p className="text-[11.5px] sm:text-[12.5px] font-medium text-white/50 leading-relaxed mt-0.5">{s.d}</p>
                        </div>
                      </li>
                    ))}
                  </ol>

                  {/* screenshots */}
                  <div>
                    <div className="flex items-center gap-2.5 mb-2.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-gold shadow-[0_0_8px_#E3B341]" />
                      <p className="text-[10px] font-black tracking-[0.22em] text-gold/50 uppercase">{c.shotsTitle}</p>
                      <span className="ms-auto text-[10px] font-bold text-white/30">{c.zoomHint}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {SHOTS.map((sh, i) => (
                        <button key={sh.src} type="button" onClick={() => setZoom(i)}
                          className="group block rounded-2xl border border-gold/20 bg-white/[0.04] p-1.5 hover:border-gold/60 hover:bg-gold/[0.06] transition-all duration-300">
                          <span className="block relative overflow-hidden rounded-xl bg-black">
                            <img src={sh.src} alt={sh.alt} loading="lazy"
                              className="w-full max-h-[300px] object-contain transition-transform duration-500 group-hover:scale-[1.04]" />
                            <span className="absolute inset-0 grid place-items-center opacity-0 group-hover:opacity-100 bg-black/45 transition-opacity duration-300">
                              <span className="w-9 h-9 rounded-full grid place-items-center bg-gold text-navy-950 shadow-[0_0_24px_rgba(227,179,65,0.75)]">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.4}><path strokeLinecap="round" d="M21 21l-4.35-4.35M16.5 10.5a6 6 0 11-12 0 6 6 0 0112 0zM10.5 7.5v6M7.5 10.5h6" /></svg>
                              </span>
                            </span>
                          </span>
                          <span className="block text-center text-[10px] font-black text-gold/70 mt-1.5 pb-0.5">{c.caption[i]}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* result + CTA */}
                  <div className="rounded-2xl border border-gold/30 bg-gradient-to-b from-gold/[0.14] to-transparent px-4 py-4 text-center">
                    <p className="text-[13px] sm:text-[14px] font-black text-gold-light leading-snug">{c.done}</p>
                    <p className="text-[11px] font-medium text-white/45 mt-1">{c.doneSub}</p>
                    <a href="https://kick.com/tmnaa/subscribe" target="_blank" rel="noopener noreferrer"
                      className="mt-3.5 inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-[12px] font-black text-navy-950"
                      style={{ background: 'linear-gradient(150deg, #FFF3D6, #E3B341 55%, #B8860B)', boxShadow: '0 12px 28px -10px rgba(227,179,65,0.85), inset 0 1px 0 rgba(255,255,255,0.55)' }}>
                      {c.cta}
                      <svg className={`w-3.5 h-3.5 ${lang === 'ar' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.6}><path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default SubscribeGuide;

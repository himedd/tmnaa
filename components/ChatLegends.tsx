import React, { useEffect, useMemo, useRef, useState } from 'react';
import { fetchBotrixLeaderboard } from '../utils/botrixApi';
import './ChatLegends.css';

/* ============================================================
   أساطير الشات — نفس تصميم وبرمجة 98765890.html حرفياً
   - الهيكل والـ CSS والمنطق (عدّاد، ذوبان، بوديوم، OG، احتفال) مطابقة للأصل
   - البيانات فقط حية من Botrix بدل الأسماء الوهمية (نفس الحقول: اسم/نقاط/لفل/ساعات)
   - --mp يُضبط على السكشن نفسه (الأصل كان يضعه على documentElement)
   ============================================================ */

const DAY1 = '2026-09-18T00:00:00+03:00'; // بداية تحدي الـ60 يوم (موحّد مع عدّاد الموقع)
const TOTAL = 60;
const MARKS = [33, 44, 55, 60];
const WINNER = '';
const DAY_MS = 864e5;

const FACES = ['fB', 'fL', 'fR', 'fD', 'fT', 'fF'];

/* طبقات السماكة ثلاثية الأبعاد — تصريحية (يملكها React فلا تُمسح عند إعادة العرض) */
const CONSOLE_LAYERS = (() => {
  const arr: React.ReactNode[] = [];
  const N = 20;
  for (let i = N; i >= 1; i--) {
    arr.push(
      <img
        key={`k${i}`}
        className="cs"
        src="/ps5-console.png"
        alt=""
        aria-hidden="true"
        style={{
          transform: `translateZ(${-i * 0.8}px)`,
          filter: `brightness(${(0.97 - 0.5 * Math.pow(i / N, 0.8)).toFixed(3)})` + (i === N ? ' drop-shadow(0 10px 12px #000b)' : ''),
        }}
      />,
    );
  }
  return arr;
})();

const PAD_LAYERS = (() => {
  const arr: React.ReactNode[] = [];
  const N = 13;
  for (let i = N; i >= 1; i--) {
    arr.push(
      <img
        key={`t${i}`}
        className="pd th"
        src="/ps5-dualsense.png"
        alt=""
        aria-hidden="true"
        style={{ '--tz': `${-i * 0.95}px`, '--bk': (0.95 - 0.55 * Math.pow(i / N, 0.8)).toFixed(3) } as React.CSSProperties}
      />,
    );
  }
  return arr;
})();
const TM_LABELS = ['يوم', 'ساعة', 'دقيقة', 'ثانية'];
const CONF_COLORS = ['#1f8bff', '#ffffff', '#53b1ff', '#2ee6ff', '#7aa8ff', '#b9dcff', '#ffc83d'];

interface Legend {
  n: string;
  x: number;
  l: number;
  h: number;
}

type Metric = 'hours' | 'level';

const METRICS: { id: Metric; ar: string; icon: string }[] = [
  { id: 'hours', ar: 'الأكثر ساعات', icon: '⏱' },
  { id: 'level', ar: 'الأعلى لفل', icon: '⭐' },
];

/* صور كيك — كاش مشترك على مستوى الموديول */
const AVATAR_CACHE = new Map<string, string>();
const KICK_CH = (name: string) =>
  '/api/kick?endpoint=' + encodeURIComponent(`https://kick.com/api/v2/channels/${name}`);

const K = (v: number) => (v >= 1e3 ? (v / 1e3).toFixed(1) + 'K' : `${v}`);
const hueOf = (name: string) => ([...name].reduce((a, ch) => a + ch.charCodeAt(0), 0) * 37) % 360;
const dayWord = (n: number) => (n === 1 ? 'يوم' : n === 2 ? 'يومين' : n <= 10 ? `${n} أيام` : `${n} يوماً`);

const dayNow = () => {
  const n = new Date();
  const todayMid = new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
  const startMid = new Date(2026, 8, 18).getTime();
  return Math.max(1, Math.min(TOTAL, Math.round((todayMid - startMid) / DAY_MS) + 1));
};
const progressNow = () => Math.min(100, (Date.now() - +new Date(DAY1)) / (TOTAL * DAY_MS) * 100);

const Avatar: React.FC<{ name: string; img?: string }> = ({ name, img }) => {
  const [failed, setFailed] = useState(false);
  return (
    <div className="av" style={{ '--h': hueOf(name) } as React.CSSProperties}>
      {img && !failed ? (
        <img src={img} alt={name} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
      ) : (
        name[0].toUpperCase()
      )}
    </div>
  );
};

export const ChatLegends: React.FC = () => {
  const [data, setData] = useState<Legend[] | null>(null);
  const [metric, setMetric] = useState<Metric>('hours');
  const [avatars, setAvatars] = useState<Record<string, string>>({});

  const rootRef = useRef<HTMLElement>(null);
  const tmRef = useRef<HTMLDivElement>(null);
  const pbRef = useRef<HTMLElement>(null);
  const noteRef = useRef<HTMLParagraphElement>(null);
  const dayRef = useRef<HTMLSpanElement>(null);
  const visRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const cbnRef = useRef<HTMLDivElement>(null);
  const dripsRef = useRef<HTMLDivElement>(null);
  const slotRefs = useRef<(HTMLDivElement | null)[]>([]);
  const timers = useRef<number[]>([]);
  const finDone = useRef(false);
  const burstTimer = useRef<number | null>(null);

  const later = (fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timers.current.push(id);
    return id;
  };

  /* ---------- البيانات الحية ---------- */
  useEffect(() => {
    let dead = false;
    fetchBotrixLeaderboard()
      .then((rows) => {
        if (dead) return;
        const sorted = [...rows].sort((a, b) => b.watchtime - a.watchtime || b.xp - a.xp);
        /* ملاحظة: watchtime من Botrix بالدقائق (1765 دقيقة ≈ 29.4 ساعة للمتصدر) — القسمة على 60 للتحويل لساعات */
        setData(sorted.map((e) => ({ n: e.name, x: e.xp, l: e.level, h: (e.watchtime || 0) / 60 })));
      })
      .catch(() => {
        if (!dead) setData([]);
      });
    return () => {
      dead = true;
    };
  }, []);

  const top = useMemo(() => (data && data.length > 0 ? data : null), [data]);

  /* الترتيب حسب التبويب المختار — الرئيسي دائماً الأكثر ساعات */
  const ranked = useMemo(() => {
    if (!top) return null;
    const arr = [...top];
    if (metric === 'level') arr.sort((a, b) => b.l - a.l || b.x - a.x);
    else arr.sort((a, b) => b.h - a.h || b.x - a.x);
    return arr;
  }, [top, metric]);

  const maxH = ranked ? Math.max(1, ranked[0].h) : 1;
  const imgOf = (name: string) => avatars[name.toLowerCase()] || AVATAR_CACHE.get(name.toLowerCase()) || '';

  /* صور كيك الحقيقية لأعلى 15 — والباقي حرف */
  useEffect(() => {
    if (!top) return;
    let dead = false;
    const names = top.slice(0, 15).map((e) => e.n).filter((n) => !AVATAR_CACHE.has(n.toLowerCase()));
    if (names.length === 0) {
      setAvatars(Object.fromEntries([...AVATAR_CACHE.entries()]));
      return;
    }
    (async () => {
      const out: Record<string, string> = {};
      for (let i = 0; i < names.length; i += 4) {
        const batch = await Promise.all(
          names.slice(i, i + 4).map(async (n) => {
            try {
              const r = await fetch(KICK_CH(n));
              if (!r.ok) return null;
              const d = await r.json();
              const url: string = d?.user?.profile_pic || '';
              return url ? { n, url } : null;
            } catch {
              return null;
            }
          }),
        );
        if (dead) return;
        batch.forEach((b) => {
          if (b) {
            AVATAR_CACHE.set(b.n.toLowerCase(), b.url);
            out[b.n.toLowerCase()] = b.url;
          }
        });
        setAvatars((prev) => ({ ...prev, ...out }));
      }
    })();
    return () => {
      dead = true;
    };
  }, [top]);

  /* ---------- منطق العدّاد والذوبان والنهاية (مطابق للأصل) ---------- */
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const t0 = +new Date(DAY1);

    /* v6: طبقات الثلج + القطرات (مرة واحدة) */
    root.querySelectorAll('.cube3d .f').forEach((f) => {
      f.insertAdjacentHTML('beforeend', '<b class="nz"></b><b class="bb"></b><b class="cr"></b><b class="wt"></b><b class="ed"></b>');
    });
    const dr = dripsRef.current;
    if (dr) {
      const N = 10;
      let h = '';
      for (let i = 0; i < N; i++) {
        const l = 30 + ((i * 37) % 41);
        const sz = (0.8 + ((i * 13) % 7) / 10).toFixed(2);
        const du = (2.3 + ((i * 17) % 13) / 10).toFixed(2);
        const dl = (-(i * 0.63) % (du as any)).toFixed(2);
        h += `<i class="drp" style="left:${l}%;--sz:${sz};--du:${du}s;--dl:${dl}s"></i><i class="rip" style="left:${l}%;--du:${du}s;--dl:${dl}s"></i>`;
      }
      dr.innerHTML = h;
    }
    const updDrips = () => {
      if (!dr) return;
      const mp = Math.min(1, Math.max(0, (Date.now() - t0) / (TOTAL * DAY_MS)));
      const on = 3 + Math.ceil(mp * 7);
      dr.querySelectorAll('.drp,.rip').forEach((e, i) => e.classList.toggle('off', Math.floor(i / 2) >= on));
    };
    updDrips();
    const dripsTimer = window.setInterval(updDrips, 60000);

    /* حفلة النهاية */
    const party = () => {
      const hero = heroRef.current;
      if (!hero || hero.querySelector('.conf')) return;
      const c = document.createElement('div');
      c.className = 'conf';
      let s = '';
      for (let i = 0; i < 90; i++) {
        const e = i % 9 === 0;
        s += `<i class="cf${e ? ' e' : ''}" style="--l:${Math.random() * 100}%;--w:${e ? 16 + Math.random() * 10 : 6 + Math.random() * 6}px;--hh:${8 + Math.random() * 9}px;--c:${CONF_COLORS[i % CONF_COLORS.length]};--d:${4 + Math.random() * 4}s;--dl:${1.5 + Math.random() * 5}s;--x:${(Math.random() - 0.5) * 180}px;--r:${360 + Math.random() * 720}deg">${e ? ['🎉', '🎊', '✨'][i % 3] : ''}</i>`;
      }
      c.innerHTML = s;
      hero.appendChild(c);
    };
    const burst = () => {
      const v = visRef.current;
      if (!v) return;
      v.querySelectorAll('.bs').forEach((x) => x.remove());
      let s = '';
      for (let i = 0; i < 46; i++) {
        const a = (Math.PI * 2 * i) / 46 + Math.random() * 0.3;
        const d = 110 + Math.random() * 170;
        s += `<i class="bs" style="--c:${CONF_COLORS[i % CONF_COLORS.length]};--bx:${Math.cos(a) * d}px;--by:${Math.sin(a) * d}px;--dl:${Math.random() * 0.25}s"></i>`;
      }
      v.insertAdjacentHTML('beforeend', s);
    };
    const showFinale = () => {
      const hero = heroRef.current;
      if (!hero || hero.querySelector('.fin')) return;
      const duo = hero.querySelector('.duo');
      if (!duo) return;
      const R = Math.random;
      const f = document.createElement('div');
      f.className = 'fin';
      let cf = '';
      for (let i = 0; i < 110; i++) {
        const e = i % 9 === 0;
        cf += `<i class="c2${e ? ' e' : ''}" style="--l:${R() * 100}%;--w:${e ? 18 + R() * 14 : 7 + R() * 7}px;--hh:${9 + R() * 10}px;--c:${CONF_COLORS[i % 7]};--d:${3.5 + R() * 3.5}s;--dl:${1.6 + R() * 5}s;--x:${(R() - 0.5) * 240}px;--r:${360 + R() * 720}deg">${e ? ['🎉', '🎊', '✨'][i % 3] : ''}</i>`;
      }
      let sh = '';
      for (let i = 0; i < 34; i++) {
        const a = (Math.PI * 2 * i) / 34 + R() * 0.4;
        const d = 35 + R() * 45;
        sh += `<i class="shd" style="--s:${14 + R() * 34}px;--x:${Math.cos(a) * d}vmax;--y:${Math.sin(a) * d * 0.8}vmin;--r:${(R() - 0.5) * 900}deg"></i>`;
      }
      f.innerHTML = `<div class="r2"></div><div class="gl"></div><div class="fstage"><div class="fl"><div class="spin"><div class="in3">${duo.outerHTML}</div></div></div></div>${sh}${cf}<div class="tt">🎉 مبروك${WINNER ? ' ' + WINNER : ''}! البلايستيشن صار جاهز 🎉<small>انتهى التحدي · 60 يوم</small></div><button class="x" type="button">إغلاق ✕</button><div class="flash"></div>`;
      hero.appendChild(f);
      const st = f.querySelector('.fstage') as HTMLElement | null;
      if (st) {
        const sc = Math.min(3.6, window.innerHeight * 0.6 / 200, window.innerWidth * 0.78 / 215);
        st.style.scale = `${sc}`;
      }
      const fwTimers: number[] = [];
      const fw = () => {
        if (!f.isConnected) return;
        const x = 8 + R() * 84;
        const y = 14 + R() * 52;
        const c = CONF_COLORS[Math.floor(R() * 7)];
        const ns: HTMLElement[] = [];
        for (let i = 0; i < 30; i++) {
          const a = (Math.PI * 2 * i) / 30;
          const d = 60 + R() * 90;
          const n = document.createElement('i');
          n.className = 'fwp';
          n.style.cssText = `left:${x}%;top:${y}%;--c:${c};--bx:${Math.cos(a) * d}px;--by:${Math.sin(a) * d}px`;
          f.appendChild(n);
          ns.push(n);
        }
        fwTimers.push(window.setTimeout(() => ns.forEach((n) => n.remove()), 1700));
      };
      const fwStart = window.setTimeout(() => {
        fw();
        const iv = window.setInterval(fw, 1100);
        fwTimers.push(iv as unknown as number);
      }, 1800);
      fwTimers.push(fwStart);
      const closeBtn = f.querySelector('.x');
      const close = () => {
        fwTimers.forEach((t) => {
          window.clearTimeout(t);
          window.clearInterval(t);
        });
        f.style.transition = 'opacity .6s';
        (f as HTMLElement).style.opacity = '0';
        window.setTimeout(() => f.remove(), 650);
      };
      closeBtn?.addEventListener('click', close);
      timers.current.push(...fwTimers);
    };
    (window as any).__clFinale = showFinale;

    const done = () => {
      stageRef.current?.classList.add('melted');
      visRef.current?.classList.add('done');
      if (noteRef.current) noteRef.current.textContent = '🎉 انتهى التحدي! مبروك، البلايستيشن صار جاهز';
      const bdg = root.querySelector('.bdg');
      if (bdg) bdg.textContent = '🎉 مبروك! انتهى التحدي';
      if (WINNER && cbnRef.current) cbnRef.current.textContent = `🎉 مبروك ${WINNER} 🎉`;
      if (finDone.current) return;
      finDone.current = true;
      party();
      later(() => (window as any).__clFinale?.(), 900);
      later(() => {
        burst();
        if (burstTimer.current) window.clearInterval(burstTimer.current);
        burstTimer.current = window.setInterval(burst, 7000);
      }, 2400);
    };

    const tick = () => {
      const now = Date.now();
      /* كشف OG */
      MARKS.forEach((d, i) => {
        const e = slotRefs.current[i];
        if (!e) return;
        const left = (t0 + d * DAY_MS - now) / DAY_MS;
        const k = left <= 0 ? 1 : Math.max(0, 1 - left / 12);
        e.style.setProperty('--bl', `${22 * (1 - k)}px`);
        e.style.setProperty('--a', `${0.65 * (1 - k)}`);
        const small = e.querySelector('small');
        if (small) small.textContent = left <= 0 ? '🏆 تم التسليم' : left < 1 ? 'اليوم!' : 'بعد ' + dayWord(Math.ceil(left));
      });
      /* العدّاد */
      const ms = window.location.hash === '#celebrate' ? 0 : Math.max(0, t0 + TOTAL * DAY_MS - now);
      const v = [ms / DAY_MS, (ms % DAY_MS) / 36e5, (ms % 36e5) / 6e4, (ms % 6e4) / 1e3];
      const nbs = tmRef.current?.querySelectorAll('b');
      nbs?.forEach((el, i) => {
        el.textContent = String(Math.floor(v[i])).padStart(2, '0');
      });
      if (dayRef.current) {
        const nd = new Date();
        const tMid = new Date(nd.getFullYear(), nd.getMonth(), nd.getDate()).getTime();
        const sMid = new Date(2026, 8, 18).getTime();
        dayRef.current.textContent = `يوم ${Math.max(1, Math.min(TOTAL, Math.round((tMid - sMid) / DAY_MS) + 1))} / ${TOTAL}`;
      }
      if (!(window as any).__mpLock) root.style.setProperty('--mp', `${Math.min(1, (now - t0) / (TOTAL * DAY_MS))}`);
      if (pbRef.current) pbRef.current.style.width = `${Math.min(100, ((now - t0) / (TOTAL * DAY_MS)) * 100)}%`;
      if (!ms) done();
    };

    /* v8: مقدمة الذوبان (على السكشن فقط) */
    const mp0 = Math.min(1, Math.max(0, (Date.now() - t0) / (TOTAL * DAY_MS)));
    if (mp0 < 1 && window.location.hash !== '#celebrate') {
      root.style.transition = 'none';
      root.style.setProperty('--mp', `${Math.max(0, mp0 - 0.14)}`);
      void (root as HTMLElement).offsetWidth;
      later(() => {
        root.style.transition = '--mp 6s cubic-bezier(.3,.6,.4,1)';
        root.style.setProperty('--mp', `${mp0}`);
        later(() => {
          root.style.transition = '--mp 2.5s linear';
        }, 6200);
      }, 700);
    }

    tick();
    const tickTimer = window.setInterval(tick, 1000);
    return () => {
      window.clearInterval(tickTimer);
      window.clearInterval(dripsTimer);
      if (burstTimer.current) window.clearInterval(burstTimer.current);
      timers.current.forEach((t) => {
        window.clearTimeout(t);
        window.clearInterval(t);
      });
      timers.current = [];
      delete (window as any).__clFinale;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const order = [1, 0, 2];

  return (
    <section className="cl" ref={rootRef as React.RefObject<HTMLElement>}>
      <div className="lg">
        <div className="hd">
          <div className="star">★</div>
          <div>
            <h2>أساطير الشات</h2>
            <div className="sub">الأكثر تفاعلاً في جميع البثوث</div>
          </div>
          <div className="pill">
            <span className="lv" ref={dayRef}>يوم {dayNow()} / {TOTAL}</span>
            <span>{top ? `${top.length} أسطورة` : '…'}</span>
          </div>
        </div>

        <div className="cl-ps">
          <div className="card hero" ref={heroRef as React.RefObject<HTMLDivElement>}>
            <div className="info">
              <span className="bdg">🎁 جيف أواي كبير</span>
              <h4>
                بلايستيشن 5 برو
                <br />
                الإصدار الرقمي
              </h4>
              <p>كمّل التحدي 60 يوم بدون انقطاع، والثلج يذوب وتبقى البلايستيشن الجائزة.</p>
            <div className="tm" ref={tmRef}>
              {TM_LABELS.map((l) => (
                <div key={l}>
                  <b>00</b>
                  <i>{l}</i>
                </div>
              ))}
            </div>
            <div className="pbar">
              <i ref={pbRef as React.RefObject<HTMLElement>} style={{ width: `${progressNow()}%` }} />
            </div>
            <p className="note" ref={noteRef}>
              الوقت المتبقي على نهاية اليوم 60
            </p>
          </div>
          <div className="vis" ref={visRef as React.RefObject<HTMLDivElement>}>
            <div className="rays"></div>
            <div className="halo"></div>
            <div className="stage" ref={stageRef as React.RefObject<HTMLDivElement>}>
              <div className="spin">
                <div className="in3">
                  <div className="duo">
                    {CONSOLE_LAYERS}
                    <img className="cs f0" src="/ps5-console.png" alt="PlayStation 5 Pro" />
                    <i className="pds"></i>
                    {PAD_LAYERS}
                    <img className="pd" src="/ps5-dualsense.png" alt="DualSense" />
                  </div>
                  <div className="cube3d">
                    {FACES.map((f) => (
                      <div key={f} className={`f ${f}`}></div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="pud"></div>
            <div className="drips" ref={dripsRef}></div>
            <div className="cbn" ref={cbnRef}>
              🎉 مبروك! البلايستيشن صار جاهز 🎉
            </div>
          </div>
        </div>
        </div>

        <div className="card ogc">
          <h3>جوائز الـ OG</h3>
          <p className="note" style={{ textAlign: 'start', margin: '-4px 0 14px' }}>
            كل 10 أيام تقريباً يستلم الـ OG أكثر واحد ساعات في البث. كل ما قرب اليوم يتضح صاحبه أكثر.
          </p>
          <div className="og4">
            {top &&
              MARKS.map((d, i) => {
                const p = top[i];
                if (!p) return null;
                return (
                  <div
                    key={d}
                    className="slot"
                    ref={(el) => {
                      slotRefs.current[i] = el;
                    }}
                  >
                    <div className="in">
                      <div className="ogw">
                        <img src="/og-badge.png" alt="OG" loading="lazy" />
                      </div>
                      <div className="who">
                        <Avatar name={p.n} img={imgOf(p.n)} />
                        {p.n}
                      </div>
                    </div>
                    <div className="veil"></div>
                    <div className="lab">
                      <span>
                        يوم {d}
                        {d === TOTAL ? ' 🏁' : ''}
                      </span>
                      <small></small>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {ranked && ranked.length >= 3 && (
          <>
            {/* ===== اختيار الترتيب ===== */}
            <div className="cl-tabs">
              {METRICS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMetric(m.id)}
                  className={`cl-tab${metric === m.id ? ' on' : ''}`}
                  aria-pressed={metric === m.id}
                >
                  <span>{m.icon}</span> {m.ar}
                </button>
              ))}
            </div>
            <p className="cl-sortnote">
              الترتيب حسب <b>{METRICS.find((m) => m.id === metric)?.ar}</b>
            </p>
            <div className="pod" key={`pod-${metric}`}>
              {order
                .filter((d) => ranked[d])
                .map((d) => {
                  const p = ranked[d];
                  return (
                    <div key={p.n} className={`pi p${d + 1}`}>
                      {d === 0 && <div className="crown">👑</div>}
                      <Avatar name={p.n} img={imgOf(p.n)} />
                      <b>{p.n}</b>
                      <small>
                        Lv.{p.l} · {K(p.x)} XP
                      </small>
                      <em>{Math.round(p.h)}h</em>
                      <div className="base">{d + 1}</div>
                    </div>
                  );
                })}
            </div>
          </>
        )}

        {ranked && ranked.length > 3 && (
          <div className="list" key={`list-${metric}`}>
            {ranked.slice(3).map((p, i) => (
              <div
                key={`${p.n}-${i}`}
                className="row"
                style={{ '--i': Math.min(i, 20), '--w': `${((p.h / maxH) * 100).toFixed(1)}%` } as React.CSSProperties}
              >
                <span className="rk">{String(i + 4).padStart(2, '0')}</span>
                <Avatar name={p.n} img={imgOf(p.n)} />
                <div className="nm">
                  <b>{p.n}</b>
                  <small>
                    Lv.{p.l} · {K(p.x)} XP · {Math.round(p.h)}h
                  </small>
                </div>
                <div className="st">
                  {metric === 'level' ? (
                    <>
                      <span className="h">Lv.{p.l}</span>
                      <span>{Math.round(p.h)}h</span>
                    </>
                  ) : (
                    <>
                      <span className="h">{Math.round(p.h)}h</span>
                      <span>{K(p.x)} XP</span>
                    </>
                  )}
                </div>
                <div className="bar">
                  <i></i>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default ChatLegends;

import React, { useEffect, useMemo, useState } from 'react';
import { fetchBotrixLeaderboard } from '../utils/botrixApi';
import './ChatLegends.css';

/* ============================================================
   أساطير الشات — القائمة مباشرة (بدون جيف أواي/تحدي)
   البيانات حية من Botrix: اسم / نقاط / ساعات مشاهدة
   (Botrix ما ينشر لفل ولا XP لهذي القناة — النقاط هي المقياس الحقيقي)
   ============================================================ */

interface Legend {
  n: string;
  p: number;
  h: number;
}

type Metric = 'hours' | 'points';

const METRICS: { id: Metric; ar: string; unit: string; icon: string }[] = [
  { id: 'hours', ar: 'الأكثر ساعات', unit: 'ساعة', icon: '⏱' },
  { id: 'points', ar: 'الأعلى نقاط', unit: 'نقطة', icon: '◆' },
];

/* صور كيك — كاش مشترك على مستوى الموديول */
const AVATAR_CACHE = new Map<string, string>();
const KICK_CH = (name: string) =>
  '/api/kick?endpoint=' + encodeURIComponent(`https://kick.com/api/v2/channels/${name}`);

/** أرقام مقروءة ولو وصلت لملايين: 63,175 → 1.24M */
const fmt = (v: number): string => {
  const n = Math.max(0, Math.round(v || 0));
  if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M`;
  return n.toLocaleString('en-US');
};
const hueOf = (name: string) => ([...name].reduce((a, ch) => a + ch.charCodeAt(0), 0) * 37) % 360;

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

  /* ---------- البيانات الحية ---------- */
  useEffect(() => {
    let dead = false;
    const load = () =>
      fetchBotrixLeaderboard()
        .then((rows) => {
          if (dead) return;
          const sorted = [...rows].sort((a, b) => b.watchtime - a.watchtime || b.points - a.points);
          /* watchtime من Botrix بالدقائق (يتطابق مع النقاط 1:1 عند أغلب الأسماء) */
          setData(sorted.map((e) => ({ n: e.name, p: e.points || 0, h: (e.watchtime || 0) / 60 })));
        })
        .catch(() => {
          if (!dead) setData([]);
        });
    load();
    /* محاولة أولى قد تسبق جهوزية البروكسي بعد النشر البارد */
    const retry = setTimeout(load, 6000);
    return () => {
      dead = true;
      clearTimeout(retry);
    };
  }, []);

  const top = useMemo(() => (data && data.length > 0 ? data : null), [data]);

  const valOf = (e: Legend) => (metric === 'points' ? e.p : e.h);
  const unitOf = (id: Metric) => METRICS.find((m) => m.id === id)!.unit;

  /* الترتيب حسب التبويب المختار — الرئيسي دائماً الأكثر ساعات */
  const ranked = useMemo(() => {
    if (!top) return null;
    const arr = [...top];
    if (metric === 'points') arr.sort((a, b) => b.p - a.p || b.h - a.h);
    else arr.sort((a, b) => b.h - a.h || b.p - a.p);
    return arr;
  }, [top, metric]);

  const maxV = ranked ? Math.max(1, ...ranked.map(valOf)) : 1;
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

  const order = [1, 0, 2];

  return (
    <section className="cl">
      <div className="lg">
        <div className="hd">
          <div className="star">★</div>
          <div>
            <h2>أساطير الشات</h2>
            <div className="sub">الأكثر تفاعلاً في جميع البثوث</div>
          </div>
          <div className="pill">
            <span className="lv">BOTRIX</span>
            <span>{top ? `${top.length} أسطورة` : '…'}</span>
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
                      <div className="mv">
                        <span className="n">{fmt(valOf(p))}</span>
                        <span className="u">{unitOf(metric)}</span>
                      </div>
                      <small>
                        {metric === 'hours' ? `${fmt(p.p)} نقطة` : `${fmt(p.h)} ساعة`}
                      </small>
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
                style={{ '--i': Math.min(i, 20), '--w': `${((valOf(p) / maxV) * 100).toFixed(1)}%` } as React.CSSProperties}
              >
                <span className="rk">{String(i + 4).padStart(2, '0')}</span>
                <Avatar name={p.n} img={imgOf(p.n)} />
                <div className="nm">
                  <b>{p.n}</b>
                  <small>
                    {metric === 'hours' ? `${fmt(p.p)} نقطة` : `${fmt(p.h)} ساعة`}
                  </small>
                </div>
                <div className="st">
                  <span className={metric === 'hours' ? 'h' : ''}>{fmt(p.h)} ساعة</span>
                  <span className={metric === 'points' ? 'h' : ''}>{fmt(p.p)} نقطة</span>
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

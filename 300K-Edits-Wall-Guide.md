# 300K Edits Wall — دليل بناء الترتيب القوي للصور والفيديوهات
> من أول سطر كود لآخر واحد — التصميم + القياسات + الفيزياء + طريقة العمل كاملة
> بدون أي تعديل على الكود الأصلي أو اللوجو — هذا ملف شرح فقط.

**المصدر الحقيقي للترتيب:**
- `artifacts/tmnaa/src/components/EditsGallery.tsx` — 893 سطر (كل السحر هنا)
- `artifacts/tmnaa/src/pages/CelebrationPage.tsx` — 284 سطر (العرض والدمج)
- `artifacts/tmnaa/src/lib/wallApi.ts` — 631 سطر (الداتا: width/height/poster/media)

---

## 1. الفكرة باختصار — ليش الترتيب طالع "خرافي"؟

هو مش `CSS columns` ولا `grid` عادي. هو **Masonry متوازن بالكود**:

1. كل صورة/فيديو إلها نسبة عرض/ارتفاع حقيقية `width / height` جاية من الداتا.
2. النسبة بتنحصر بين `0.5625 (9:16 طولي)` و `1.85 (عريض)` عشان لا عنصر يكسر العمود.
3. كل عنصر إلو `تكلفة ارتفاع = 1/ratio + 0.35` — الـ `0.35` هو ارتفاع جسم الكارد تحت الميديا (الاسم + الكابشن + الوقت).
4. العناصر بتنحط واحد واحد **بالعمود الأقصر حالياً** — مش بالدور.
5. زيادة ذكية: **عقوبة 0.55 لو العمود آخره نفس الاتجاه** (`portrait ورا portrait`) — عشان التنويع البصري. هاي هي الخدعة.
6. الترتيب الافتراضي `shuffle` ثابت deterministic — نفس الـ wall = نفس الترتيب، ما بيقفز كل re-render. بيتغير فقط لما يتغير المحتوى.
7. عدد الأعمدة متجاوب: `1 / 2 / 3 / 4` حسب عرض الشاشة.

النتيجة: لا عمود أطول من الثاني، ولا صورتين طوليات لازقات ببعض، ولا شريط رفيع عريض، ولا قفزات غريبة.

---

## 2. خريطة الملفات والسطور (بدون تعديل)

### `EditsGallery.tsx` — الملف الأم

| من سطر | إلى سطر | شو بيعمل |
|---|---|---|
| 15-17 | ثوابت | `easeOut`, `MIN_RATIO=0.5625`, `MAX_RATIO=1.85` |
| 21-29 | `mediaRatio()` | نسبة العرض/الارتفاع المحصورة |
| 31-35 | `mediaCost()` | تكلفة الارتفاع + 0.35 للجسم |
| 37-43 | `orientationOf()` | portrait / landscape / square |
| 45-54 | `hashIds()` | هاش حقيقي لمحتوى الـ ids |
| 56-65 | `mulberry32()` | مولد عشوائي ثابت seeded |
| 67-93 | `packColumns()` | **قلب الترتيب — Masonry متوازن + عقوبة الاتجاه** |
| 95-116 | `useColumnCount()` | 1/2/3/4 عمود حسب `640 / 1024 / 1440` |
| 118-142 | `Thumb()` | صورة البوستر `object-cover` أو fallback للينك |
| 144-145 | `hoverCapable()` | فحص هل الجهاز فيه hover حقيقي |
| 148-217 | `CardMedia()` | `aspect-ratio` + فيديو hover + overlays + شارات |
| 231-313 | `WallCard()` | تصميم الكارد الكامل `rounded-[22px]` |
| 315-549 | `Lightbox()` | العرض المكبر بعد الضغط |
| 553-646 | `ReportModal()` | نافذة البلاغ (مالهاش علاقة بالترتيب) |
| 648-693 | `EditsGallery()` state + `ordered` + `packed` | الفرز + التوزيع |
| 772-810 | `sortBtn() + videosBtn()` | أزرار Balanced / Newest / Most Liked |
| 812-860 | الرندر | الهيدر + `flex items-start gap-3` للأعمدة |
| 866-892 | `AnimatePresence` | Lightbox + Report |

### `CelebrationPage.tsx` — الدمج بالصفحة

| من سطر | إلى سطر | شو بيعمل |
|---|---|---|
| 77-99 | `submissions` + `fetchWall()` | جلب الجدار + تحديث كل 45 ثانية |
| 101-106 | `handleSubmitted()` | تحديث بعد النشر |
| 113-193 | Hero | العنوان + التقدم + اللوجو (سطر 137-146 للوجو — لم يُلمس) |
| 196-254 | Submit section | `grid lg:grid-cols-[1.15fr_0.85fr]` فورم + How It Works |
| 256-260 | Wall section | `<section id="wall">` + `<EditsGallery submissions={submissions} />` + `max-w-6xl` |
| 263-279 | Footer | POWERED BY HSG |

### `wallApi.ts` — الداتا اللي بيعتمد عليها الترتيب

| من سطر | إلى سطر | شو بيعمل |
|---|---|---|
| 9-38 | `WallItem` | `width: number \| null`, `height: number \| null`, `posterUrl`, `mediaUrl`, `mediaType: image/video/link` |
| 127-156 | `rowToItem()` | تحويل صف Supabase لـ WallItem |
| 162-170 | `fetchWall()` | جلب `approved` مرتب `created_at desc` |

---

## 3. القياسات والتصميم — Design Tokens بالأرقام

### 3.1 الشبكة (Layout)
```txt
الحاوية: max-w-6xl (1152px) — في CelebrationPage سطر 257
الشبكة: display:flex; align-items:flex-start; gap:12px (gap-3)
العمود: flex:1; min-width:0; display:flex; flex-direction:column; gap:12px
عدد الأعمدة:
  <640px   = 1 عمود (موبايل)
  640-1023 = 2 عمود
  1024-1439= 3 عمود
  >=1440   = 4 عمود
```

### 3.2 الكارد (WallCard سطر 249-253)
```txt
border-radius: 22px (rounded-[22px])
overflow: hidden
border: 1px solid rgba(217,164,65,0.14)
hover border: rgba(217,164,65,0.5) — #D9A441/50
background: linear-gradient(160deg, rgba(26,18,13,0.95), rgba(16,11,8,0.92))
box-shadow عادي: 0 6px 22px rgba(0,0,0,0.4)
box-shadow hover: 0 14px 45px rgba(255,122,24,0.18), 0 0 60px rgba(217,164,65,0.08)
hover translate: -6px (hover:-translate-y-1.5) + duration-500
دخول: opacity 0->1, y 30->0, duration 0.55, delay = min(index,6)*0.05, ease [0.22,1,0.36,1]
```

### 3.3 الميديا (CardMedia سطر 168-170)
```txt
wrapper: relative w-full overflow-hidden bg-black/50
aspect-ratio: ديناميكي من mediaRatio — مثال: style="aspect-ratio: 0.75" للطولي
img/video: absolute inset-0 w-full h-full object-cover
zoom hover على الصورة: scale 1 -> 1.10 خلال 700ms (group-hover:scale-110)
overlay سفلي: linear-gradient(to top, black/85, black/10, transparent)
زر Play بالوسط: 48px دائرة (w-12 h-12) bg-black/40 blur border #D9A441/50 — يظهر فقط على hover (opacity 0->100)
شارة Link فوق: top-3 left-3, height 28px, pill, bg-black/50 blur border #D9A441/30
```

### 3.4 جسم الكارد (سطر 300-310)
```txt
padding: 16px (p-4)
الاسم: 11px, font-black, uppercase, tracking 0.18em, color #D9A441 — "@name"
الكابشن: 13.5px, line-height relaxed, line-clamp-2, min-height 2.6em, color rgba(247,243,238,0.7)
الوقت: 10.5px, uppercase, tracking 0.15em, color rgba(247,243,238,0.25)
زر اللايك: top-3 right-3, pill h-7 px-2.5, bg-black/50 blur
زر البلاغ: top-3 left-3, 28px دائرة (w-7 h-7), bg-black/50 blur — لو kind=link بينزل لتحت top-12 عشان ما يلزق بشارة Link
```

### 3.5 الألوان
```txt
ذهبي: #D9A441 / #E8B45C / #F5D489 / #F7E6B8
برتقالي ناري: #FF7A18 / #D94A2B / #8A2F14
خلفية الصفحة: #090807
نص أساسي: #F7F3EE
أحمر لايك: #FF5C3D
```

---

## 4. الكود الكامل للترتيب — من أول سطر لآخر سطر (Core)

### 4.1 الثوابت والنسب (سطر 15-17)
```ts
const easeOut = [0.22, 1, 0.36, 1] as const;
const MIN_RATIO = 0.5625; // 9:16
const MAX_RATIO = 1.85;
```

### 4.2 نسبة الميديا الحقيقية (سطر 21-29)
```ts
function mediaRatio(sub: WallItem): number {
  // نسبة العرض/الارتفاع الحقيقية، محصورة بين 9:16 (طولي) و 1.85 (عريض)
  // عشان لا صورة طويلة تكسر العمود ولا صورة عريضة تصير شريط رفيع
  if (sub.width && sub.height) {
    const r = sub.width / sub.height;
    return Math.min(MAX_RATIO, Math.max(MIN_RATIO, r));
  }
  return 16 / 9;
}
```
**الفيزياء:** لو صورة `1080x1920` نسبتها `0.5625` بتنقبل كما هي. لو `1080x3000` نسبتها `0.36` بتنحصر لـ `0.5625` — يعني بتتقص بصرياً بـ `object-cover` بدل ما تعمل عمود طوله 3 أضعاف. لو بانوراما `3000x1000` نسبتها `3.0` بتنحصر لـ `1.85`.

### 4.3 تكلفة الارتفاع (سطر 31-35)
```ts
function mediaCost(sub: WallItem): number {
  // التكلفة = ارتفاع الميديا + ارتفاع جسم الكارد (الاسم + الكابشن + الوقت ≈ 0.35)
  // بدون الثابت: عمود مليان صور landscape بيبين أطول بصرياً من الحساب
  return 1 / mediaRatio(sub) + 0.35;
}
```
**مثال حسابي:**
- صورة طولية `ratio=0.5625` → `1/0.5625=1.777 +0.35 = 2.127`
- صورة مربعة `ratio=1` → `1+0.35=1.35`
- صورة عريضة `ratio=1.85` → `0.54+0.35=0.89`
يعني الطولية تكلف ~2.4 ضعف العريضة — الخوارزمية بتعرف هذا وبتوزع accordingly.

### 4.4 الاتجاه (سطر 37-43)
```ts
function orientationOf(sub: WallItem): 'portrait' | 'landscape' | 'square' {
  if (!sub.width || !sub.height) return 'square';
  const r = sub.width / sub.height;
  if (r > 1.05) return 'landscape';
  if (r < 0.95) return 'portrait';
  return 'square';
}
```

### 4.5 العشوائية الثابتة (سطر 45-65)
```ts
function hashIds(items: WallItem[]): number {
  // هاش حقيقي لمحتوى الـ ids (مو بس طولها) — wall مختلف = ترتيب مختلف
  let h = 7;
  for (const item of items) {
    for (let i = 0; i < item.id.length; i++) {
      h = (Math.imul(h, 31) + item.id.charCodeAt(i)) | 0;
    }
  }
  return h;
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

### 4.6 قلب الترتيب — packColumns (سطر 67-93)
```ts
const ORIENTATION_PENALTY = 0.55;

function packColumns(items: WallItem[], n: number): WallItem[][] {
  // Masonry متوازن: كل عنصر بينحط بالعمود الأقصر حالياً
  // + عقوبة لو العمود آخره نفس الاتجاه (portrait ورا portrait) عشان التنويع البصري
  // هاي هي الخدعة اللي مخلية الترتيب "خرافي" — لا عمود أطول من الثاني ولا صورتين طوليات لازقات ببعض
  const cols: WallItem[][] = Array.from({ length: n }, () => []);
  const heights = new Array(n).fill(0);
  const lastOrient = new Array(n).fill(null as 'portrait' | 'landscape' | 'square' | null);

  for (const item of items) {
    const o = orientationOf(item);
    let best = 0;
    let bestScore = Infinity;
    for (let c = 0; c < n; c++) {
      const score = heights[c] + (lastOrient[c] === o ? ORIENTATION_PENALTY : 0);
      if (score < bestScore) {
        bestScore = score;
        best = c;
      }
    }
    cols[best].push(item);
    heights[best] += mediaCost(item);
    lastOrient[best] = o;
  }
  return cols;
}
```
**شرح سطر بسطر:**
1. `cols` — مصفوفة أعمدة فاضية حسب `n`.
2. `heights` — ارتفاع متراكم لكل عمود (مو بالبكسل، بالوحدات النسبية من mediaCost).
3. `lastOrient` — آخر اتجاه بكل عمود.
4. لكل `item`: احسب اتجاهه `o`، بعدين لكل عمود احسب `score = heights[c] + (آخره نفس الاتجاه ؟ 0.55 : 0)`.
5. اختار العمود بأقل `score`، حط فيه العنصر، زيد ارتفاعه بـ `mediaCost`، وحدث `lastOrient`.
6. قيمة `0.55` مختارة بعناية: تقريباً 60% من تكلفة صورة عريضة (0.89) و40% من مربعة (1.35) — كافية تكسر التكرار بدون ما تخرب التوازن.

### 4.7 عدد الأعمدة المتجاوب (سطر 95-116)
```ts
function useColumnCount(): number {
  const [count, setCount] = useState(() => {
    if (typeof window === 'undefined') return 3;
    const w = window.innerWidth;
    if (w >= 1440) return 4;
    if (w >= 1024) return 3;
    if (w >= 640) return 2;
    return 1;
  });

  useEffect(() => {
    const compute = () => {
      const w = window.innerWidth;
      setCount(w >= 1440 ? 4 : w >= 1024 ? 3 : w >= 640 ? 2 : 1);
    };
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, []);

  return count;
}
```

### 4.8 الفرز + التوزيع (سطر 668-690)
```ts
const ordered = useMemo(() => {
  const src = videosOnly ? submissions.filter((s) => s.mediaType === 'video') : submissions;
  if (sort === 'newest') {
    return [...src].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }
  if (sort === 'top') {
    return [...src].sort((a, b) => b.likes - a.likes);
  }
  // balanced shuffle: ترتيب عشوائي ثابت (deterministic) — نفس الـ wall = نفس الترتيب
  // بيتغير فقط لما يتغير محتوى الـ wall، عشان الكروت ما تقفز كل re-render
  const rnd = mulberry32(hashIds(src));
  const arr = [...src];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}, [submissions, sort, videosOnly]);

const packed = useMemo(() => packColumns(ordered, columns), [ordered, columns]);
```

### 4.9 الرندر — Flex الأعمدة (سطر 840-859)
```tsx
<div className="flex items-start gap-3">
  {packed.map((col, ci) => (
    <div key={ci} className="flex-1 min-w-0 flex flex-col gap-3">
      {col.map((sub, i) => (
        <WallCard
          key={sub.id}
          sub={sub}
          index={i * columns + ci}
          priority={i * columns + ci < columns * 2 + 2}
          liked={likedIds.has(sub.id)}
          likesOverride={likesOverrides[sub.id] ?? null}
          reported={reportedIds.has(sub.id)}
          onOpen={() => setSelected(sub)}
          onToggleLike={onToggleLike}
          onReport={openReport}
        />
      ))}
    </div>
  ))}
</div>
```
**ملاحظات:**
- `items-start` ضروري عشان الأعمدة ما تتمدد لبعض.
- `min-w-0` ضروري عشان المحتوى الطويل ما يكسر العمود.
- `priority` لأول `columns*2+2` عناصر: `loading=eager + fetchPriority=high` — الباقي lazy.

---

## 5. تصميم الصورة والفيديو — الكود الكامل

### 5.1 Thumb (سطر 118-142)
```tsx
function Thumb({ sub, className, priority = false }: { sub: WallItem; className?: string; priority?: boolean }) {
  if (sub.posterUrl) {
    return (
      <img
        src={sub.posterUrl}
        alt={sub.caption || sub.name}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'low'}
        decoding="async"
        className={`w-full h-full object-cover ${className || ''}`}
      />
    );
  }
  return (
    <div
      className={`w-full h-full flex flex-col items-center justify-center gap-2 ${className || ''}`}
      style={{ background: 'linear-gradient(135deg, rgba(45,27,20,0.9), rgba(14,10,8,0.95))' }}
    >
      <Link2 className="w-6 h-6 text-[#D9A441]/70" />
      <span className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: 'rgba(217,164,65,0.6)' }}>
        {hostOf(sub.url)}
      </span>
    </div>
  );
}
```

### 5.2 CardMedia (سطر 148-217) — أهم قطعة بالتصميم
```tsx
function CardMedia({ sub, priority }: { sub: WallItem; priority?: boolean }) {
  const [showVideo, setShowVideo] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [broken, setBroken] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const isVideo = sub.mediaType === 'video' && !!sub.mediaUrl && !broken;

  const start = useCallback(() => {
    if (!hoverCapable() || !isVideo) return;
    setShowVideo(true);
    requestAnimationFrame(() => {
      videoRef.current?.play().catch(() => {});
    });
  }, [isVideo]);

  const stop = useCallback(() => {
    videoRef.current?.pause();
  }, []);

  return (
    <div
      className="relative w-full overflow-hidden bg-black/50"
      style={{ aspectRatio: `${mediaRatio(sub)}` }}  // ← السطر الذهبي: يحفظ شكل الصورة الأصلي
      onMouseEnter={start}
      onMouseLeave={stop}
      onTouchStart={() => setShowVideo(false)}
    >
      {isVideo && showVideo ? (
        <video
          ref={videoRef}
          src={sub.mediaUrl ?? undefined}
          muted loop playsInline preload="metadata"
          poster={sub.posterUrl ?? undefined}
          onWaiting={() => setBuffering(true)}
          onPlaying={() => setBuffering(false)}
          onError={() => setBroken(true)}
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <Thumb sub={sub} priority={priority} className="transition-transform duration-700 group-hover:scale-110" />
      )}
      {/* spinner أثناء التحميل */}
      {/* overlay سفلي + زر Play + شارة Link — نفس الأصلي سطر 197-214 */}
    </div>
  );
}
```
**الفيزياء:**
- `aspectRatio` ديناميكي = ارتفاع الحاوية بيتحدد قبل ما الصورة تحمل — ما في قفزة layout shift.
- الفيديو لا يشتغل إلا على `hover + pointer:fine` — الموبايل بيضل poster عشان البطارية.
- `muted + loop + playsInline` عشان المتصفح يسمح بالتشغيل بدون ضغطة.
- `onTouchStart → setShowVideo(false)` — يمنع فيديو عالق على الموبايل.

### 5.3 WallCard (سطر 231-260 — الغلاف)
```tsx
<motion.div
  initial={{ opacity: 0, y: 30 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true, margin: '-40px' }}
  transition={{ duration: 0.55, delay: Math.min(index, 6) * 0.05, ease: easeOut }}
  className="group relative text-left w-full rounded-[22px] overflow-hidden transition-all duration-500 hover:-translate-y-1.5 border border-[rgba(217,164,65,0.14)] hover:border-[#D9A441]/50 cursor-pointer"
  style={{
    background: 'linear-gradient(160deg, rgba(26,18,13,0.95), rgba(16,11,8,0.92))',
    boxShadow: '0 6px 22px rgba(0,0,0,0.4)',
  }}
>
  <CardMedia sub={sub} priority={priority} />
  {/* أزرار اللايك والبلاغ + جسم النص سطر 262-310 */}
</motion.div>
```

---

## 6. كيف تعيد بناءه من الصفر — خطوة بخطوة

1. **الداتا:** كل عنصر لازم يكون فيه `id, width, height, posterUrl, mediaUrl, mediaType`. بدون `width/height` الترتيب بيوقع لـ `16/9` افتراضي.
2. **الثوابت:** انسخ `MIN_RATIO, MAX_RATIO, ORIENTATION_PENALTY, easeOut` كما هي.
3. **الدوال الأربع:** انسخ `mediaRatio + mediaCost + orientationOf + packColumns` حرفياً — لا تغير `0.35` ولا `0.55` أول تجربة.
4. **الأعمدة:** انسخ `useColumnCount` بنفس الـ breakpoints `640/1024/1440`.
5. **الفرز:** ابدأ بـ `shuffle` الثابت بـ `hashIds + mulberry32` — لا تستخدم `Math.random()` مباشرة لأنه بيعمل قفز كل render.
6. **الحاوية:** `max-w-6xl mx-auto` + `flex items-start gap-3` + كل عمود `flex-1 min-w-0 flex flex-col gap-3`.
7. **الميديا:** `div relative overflow-hidden` بـ `aspect-ratio: mediaRatio` + `img object-cover` + `overlay gradient`.
8. **الكارد:** `rounded-[22px] border + gradient bg + shadow` كما بالأرقام فوق.
9. **الحركة:** `framer-motion whileInView y:30→0 opacity` + `hover -translate-y-1.5`.
10. **الفيديو:** poster دائماً، فيديو فقط على hover للديسكتوب، `muted loop playsInline`.
11. **الأولوية:** أول `columns*2+2` صور `eager/high` والباقي `lazy/low`.
12. **الاختبار:** جرب بـ 20 عنصر mixed (5 طولي + 5 عريض + 5 مربع + 5 بدون أبعاد) على `375px / 768px / 1280px / 1600px` — لازم لا عمود يفرق أكثر من كارد واحد بصرياً.

---

## 7. أخطاء بتخرب الشكل لو غيرتها

| التغيير الغلط | شو بيصير |
|---|---|
| تشيل `MAX/MIN clamp` | صورة بانوراما بتصير شريط رفيع، وصورة screenshot طويلة بتكسر العمود كله |
| تشيل `+0.35` | عمود مليان landscape بيبين أطول من الحسبة وبيختل التوازن |
| تشيل `ORIENTATION_PENALTY` | بتلاقي 3 صور طولية ورا بعض بنفس العمود — الشكل بيصير ممل |
| تستخدم `Math.random()` بدل `mulberry32(hash)` | الكروت بتقفز وبتتبدل أماكنها كل render/filter |
| تستخدم `grid` بدل `flex + packColumns` | الأعمدة بتصير بأطوال مختلفة كثير، خاصة مع صور مختلطة الأحجام |
| تنسى `min-w-0` | كابشن طويل أو اسم طويل بيكسر العمود وبيعمل scroll أفقي |
| تنسى `items-start` | الأعمدة القصيرة بتتمدد غصب لطول أطول عمود |
| تشغل الفيديو auto على الموبايل | البطارية والباقة بينذبحوا + المتصفح بيمنع الصوت |

---

## 8. Checklist القياسات النهائية (انسخ والصق للمراجعة)

```txt
[ ] MIN_RATIO 0.5625 / MAX_RATIO 1.85
[ ] mediaCost = 1/ratio + 0.35
[ ] penalty 0.55 لنفس الاتجاه المتكرر
[ ] columns: 1 (<640) / 2 (640+) / 3 (1024+) / 4 (1440+)
[ ] gap 12px بين الأعمدة وبين الكروت
[ ] radius 22px للكارد
[ ] border rgba(217,164,65,0.14) → hover 0.5
[ ] shadow 0 6px 22px → hover 0 14px 45px + glow
[ ] aspect-ratio ديناميكي + object-cover
[ ] overlay from-black/85 via-black/10
[ ] play button 48px يظهر على hover فقط
[ ] p-4 للجسم + 11px للاسم + 13.5px للكابشن clamp-2
[ ] دخول y30 opacity delay min(index,6)*0.05 duration 0.55 ease [0.22,1,0.36,1]
[ ] hover -translate-y-1.5 duration-500
```

> المرجع الكامل للكود: `EditsGallery.tsx سطر 1-893` — هذا الملف يشرح كل ما فوق حرفياً، وهذا الـ md مجرد خريطة له بدون أي تعديل على الأصل.

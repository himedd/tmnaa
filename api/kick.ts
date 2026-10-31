// Vercel Edge Function - هذا بروكسي سريع جداً وخاص بموقعك
export const config = {
  runtime: 'edge',
};

/**
 * البروكسي عام على الإنترنت، لذا يُسمح فقط بنطاقات البيانات التي يستهلكها الموقع.
 * بدونه يتحول إلى مفتاح تمرير مجاني لأي عنوان (استهلاك رصيد فيركل + SSRF).
 */
const ALLOWED_HOSTS = new Set([
  'kick.com', // يشمل web.kick.com و files.kick.com عبر فحص النطاق الفرعي
  'streamlabs.com',
  'api.creators.sa',
  'botrix.live', // أساطير الشات + ساعات مشاهدة الكلان
  'api.fxtwitter.com', // صور المشرفين من إكس
]);

const isAllowed = (raw: string): boolean => {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:') return false;
  return ALLOWED_HOSTS.has(url.hostname) || [...ALLOWED_HOSTS].some(h => url.hostname.endsWith(`.${h}`));
};

export default async function handler(request: Request) {
  const { searchParams } = new URL(request.url);
  const endpoint = searchParams.get('endpoint') || '';

  if (!endpoint) {
    return new Response(JSON.stringify({ error: 'Endpoint is required' }), { status: 400 });
  }
  if (!isAllowed(endpoint)) {
    return new Response(JSON.stringify({ error: 'Endpoint not allowed' }), { status: 403 });
  }

  try {
    // الخادم الخاص بك (Vercel) هو من سيقوم بالطلب الآن وليس المتصفح
    const apiResponse = await fetch(endpoint, {
      headers: {
        'Accept': 'application/json',
        // UA مختصر فقط — الـ UA الكامل يفعّل حظر Kick الأمني (403)
        'User-Agent': 'Mozilla/5.0',
      },
    });

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      return new Response(JSON.stringify({ error: `API request failed: ${errorText.slice(0, 200)}` }), { status: apiResponse.status });
    }

    const data = await apiResponse.json();

    // إرجاع البيانات الصافية للمتصفح مع تفعيل الكاش في سيرفرات Vercel
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 's-maxage=60, stale-while-revalidate=300' // كاش لمدة دقيقة
      },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: `Internal Server Error: ${error.message}` }), { status: 500 });
  }
}

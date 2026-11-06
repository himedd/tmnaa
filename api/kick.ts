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
  'api.creators.sa', // لوحة متصدرين دكان
  'botrix.live', // أساطير الشات + ساعات مشاهدة الكلان
]);

const isAllowed = (raw: string): URL | null => {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  return ALLOWED_HOSTS.has(url.hostname) || [...ALLOWED_HOSTS].some(h => url.hostname.endsWith(`.${h}`)) ? url : null;
};

/**
 * بيانات اعتماد Pusher تُطلب بـ POST، وكيك لا تُرجع ترويسة CORS لـ POST
 * (المفحوص: 200 بلا access-control-allow-origin، وOPTIONS يردّ 204 بلا ترويسات)،
 * فالمتصفح يحجبها ولا يبقى سوى المفتاح المثبّت. هذا المسار وحده يمرّ من هنا.
 */
const ALLOWED_POST_PATHS = new Set(['/api/v1/realtime/connection']);
const MAX_POST_BODY = 4096;

export default async function handler(request: Request) {
  const { searchParams } = new URL(request.url);
  const endpoint = searchParams.get('endpoint') || '';

  if (!endpoint) {
    return new Response(JSON.stringify({ error: 'Endpoint is required' }), { status: 400 });
  }
  const target = isAllowed(endpoint);
  if (!target) {
    return new Response(JSON.stringify({ error: 'Endpoint not allowed' }), { status: 403 });
  }

  const method = (request.method || 'GET').toUpperCase();
  if (method !== 'GET' && method !== 'HEAD') {
    if (method !== 'POST' || !ALLOWED_POST_PATHS.has(target.pathname)) {
      return new Response(JSON.stringify({ error: 'Method not allowed for this endpoint' }), { status: 405 });
    }
  }

  // بلا تمرير للترويسات الواردة: لا Authorization ولا cookies تصل إلى كيك
  const body = method === 'POST' ? (await request.text()).slice(0, MAX_POST_BODY) : undefined;

  try {
    // الخادم الخاص بك (Vercel) هو من سيقوم بالطلب الآن وليس المتصفح
    const apiResponse = await fetch(endpoint, {
      method,
      headers: {
        'Accept': 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        // UA مختصر فقط — الـ UA الكامل يفعّل حظر Kick الأمني (403)
        'User-Agent': 'Mozilla/5.0',
      },
      body,
    });

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      return new Response(JSON.stringify({ error: `API request failed: ${errorText.slice(0, 200)}` }), { status: apiResponse.status });
    }

    const data = await apiResponse.json();

    // إرجاع البيانات الصافية للمتصفح مع تفعيل الكاش في سيرفرات Vercel
    // بيانات الاعتماد لكل عميل جديد، فلا تُخزَّن مشتركة على CDN
    const cache = body ? 'no-store' : 's-maxage=60, stale-while-revalidate=300';
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': cache
      },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: `Internal Server Error: ${error.message}` }), { status: 500 });
  }
}

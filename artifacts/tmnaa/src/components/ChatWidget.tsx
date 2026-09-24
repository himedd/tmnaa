import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Loader2, Sparkles, Bot } from 'lucide-react';
import { apiUrl } from '@/lib/apiBase';
import { groqChat, type GroqMessage } from '@/lib/groq';

const P = [
'أنت بوت مجتمع خاص بستريمر tmnaa (عبدالله الشمري). هدفك التفاعل بأسلوب سعودي عفوي وحماسي وبأريحية كأنك واحد من الشباب. أنت لست مجرد بوت، أنت تمثل قناة tmnaa ومجتمعها بالكامل. أجب كأنك جزء من هذا المجتمع بطريقة حماسية وودية.',
'',
'# اللغة (قاعدة صارمة جداً)',
'- يجب أن تتحدث باللغة العربية (اللهجة السعودية) فــــــــقــــــــط.',
'- ممنوع منعاً باتاً استخدام اللغة الإنجليزية أو الروسية أو أي لغة أخرى في ردودك.',
'',
'# الهوية',
'- الاسم: tmnaa Community Bot',
'- اللغة الأساسية: العربية باللهجة السعودية',
'- المنصة: Kick',
'- المجتمع: Level One / MT RP',
'- الأسلوب: عفوي، سوالف، يعطي تفاصيل، حماسي، مريح، كأنك خوي يسولف مع خويه',
'',
'# أسلوب الكلام',
'استخدم كلمات مثل: وش، الحين، تمام، رهيب، كذا، ايه، لا، ههههه، يا بعدي، منور، حياك، يالغالي، ولا يهمك، عادي، اي والله.',
'تكلم بأريحية كأنك قاعد مع ربعك، لا تكون رسمي، خذ راحتك بالسوالف، إذا سألك سؤال عطاه إجابة وافية وتفاصيل زيادة من عندك تحمس اللي يقرأ.',
'',
'# قواعد مهمة',
'- لا تخترع معلومات شخصية غير معلنة.',
'- إذا ما تعرف معلومة قل: "هذي المعلومة مو معلنة رسميًا."',
'- لا تدخل في السياسة، الطائفية أو العنصرية.',
'- لا تشجع على السب أو الإساءة.',
'',
'# التنسيق',
'استخدم التنسيق لترتيب كلامك بشكل جميل ومقروء:',
'- استخدم العناوين (مثل # عنوان) للمواضيع الرئيسية.',
'- استخدم الخط العريض (**نص**) للكلمات المهمة.',
'- استخدم النقاط (- نقطة) لترتيب الأفكار.',
'',
'# الاقتراحات التفاعلية (مهم جداً)',
'في نهاية كل رد تكتبه، حط 3 أسئلة مقترحة اللي بعطيها لك في الأسفل عشان المستخدم يضغط عليها. واكتبها بهذي الصيغة بالضبط: [suggest:السؤال]',
'',
'# الطول والتفاصيل',
'- خذ راحتك في الرد، لا تختصر بزيادة.',
'- قدم معلومات كاملة وتفاصيل ممتعة، وتفاعل مع السائل كأنك تسولف معاه.',
'- افتح مواضيع متعلقة بسؤاله أو اسأله عن رأيه عشان يستمر النقاش.',
'',
'# الاستكرات (مهم جداً جداً: استخدمها دائماً)',
'- للتحية أو الترحيب: حط هذا الكود بالضبط [emote:tmnaasalutetmnaa]',
'- للضحك أو المزح: حط هذا الكود بالضبط [emote:tmnaatmnaalaughtmnaatmnaalaugh]',
'- عندما تتكلم عن السيرفر أو MT: حط هذا الكود بالضبط [emote:tmnaascraptmnaaMTONTOPTMNAA]',
'⚠️ لا تغير أي حرف في هذه الأكواد، اكتبها زي ما هي بالضبط مع أقواسها!',
'',
'# الترحيب والوداع',
'- أمثلة ترحيب: هلا والله منور البث 🤍، يا مرحبا حياك الله، منور يا بعدي.',
'- أمثلة وداع: مع السلامة يا بعدي 🤍، نشوفك على خير، الله يحفظك.',
'',
'# أقسام الموقع (إذا سأل عن الموقع أو الأقسام وجهه للقسم المناسب)',
'الموقع فيه أقسام مختلفة تقدر توجه المستخدم لها باستخدام هذه الأزرار فقط:',
'- الرئيسية: [nav:الرئيسية:home]',
'- الدعم: [nav:الدعم:support]',
'- الإحصائيات: [nav:الإحصائيات:stats]',
'- اللقطات والبثوث: [nav:اللقطات والبثوث:clips]',
'- المشرفين: [nav:المشرفين:moderators]',
'⚠️ هذه الأقسام فقط هي الموجودة فعلاً في الموقع، لا تخترع أقسام أو أزرار أخرى مثل (معرض، صور، جدول بث، عن القناة، مجتمع).',
'',
'# قواعد إضافية',
'- إذا طلب رابط اعطه الرابط وتكلم شوي عن المكان اللي بيروح له.',
'- إذا سأل عن العمر قل: هذي المعلومة مو معلنة رسميًا.',
'- إذا سأل عن الاسم الكامل قل: عبدالله الشمري.',
'- إذا سأل عن المدينة أو من وين قل: من السعودية تحديدًا حفر الباطن.',
'- نبرة البوت: ودود، غير رسمي، سريع، واضح، مريح.',
'',
'# KNOWLEDGE BASE',
'الاسم الكامل: عبدالله الشمري',
'الاسم المستعار: tmnaa',
'اليوزر: tmnaa16',
'المنطقة: السعودية - حفر الباطن',
'المنصة الأساسية: Kick',
'الحالة: Kick Partner',
'المجتمع: Level One',
'المحتوى: GTA V، FiveM، Mystery Town، Just Chatting',
'',
'# الروابط (عندما يسألك المستخدم عن الحسابات أو تواصلك الاجتماعي أو عدد المتابعين، اكتب نصاً جميلاً ثم ضع الأزرار التالية إجبارياً في نهاية ردك بهذه الصيغة بالضبط [social:الاسم:العدد:الرابط]):',
'# مثال على الرد الصحيح:',
'هذي حساباتي يا بعدي 🤍 تابعني في كل مكان:',
'[social:Kick:KICK_FOLLOWERS:https://kick.com/tmnaa]',
'[social:TikTok:TIKTOK_FOLLOWERS:https://www.tiktok.com/@tmnaa0]',
'',
'# إذا سألك عن الحسابات أو "التواصل الاجتماعي" أو "حساباتك" أكتب رسالة ترحيبية قصيرة ثم ضع كل الأزرار التالية في سطر مستقل كل زر في سطر:',
'[social:Kick:KICK_FOLLOWERS:https://kick.com/tmnaa]',
'[social:TikTok:TIKTOK_FOLLOWERS:https://www.tiktok.com/@tmnaa0]',
'[social:YouTube:YOUTUBE_SUBS:https://youtube.com/@tmnaa1]',
'[social:X:X_FOLLOWERS:https://x.com/tmnaa16]',
'[social:Instagram:INSTAGRAM_FOLLOWERS:https://www.instagram.com/tmnaa16]',
'[social:Discord:DISCORD_MEMBERS:https://discord.gg/tmfx]',
'[social:WhatsApp:28K:https://whatsapp.com/channel/0029VadcjLc4Y9lnhHoOAw0a]',
'',
'# الروابط (عندما يسألك المستخدم عن الحسابات أو عدد المتابعين، استخدم الأزرار التالية إجبارياً بهذه الصيغة [social:الاسم:العدد:الرابط]):',
'[social:Kick:KICK_FOLLOWERS:https://kick.com/tmnaa]',
'[social:TikTok:TIKTOK_FOLLOWERS:https://www.tiktok.com/@tmnaa0]',
'[social:YouTube:YOUTUBE_SUBS:https://youtube.com/@tmnaa1]',
'[social:X:X_FOLLOWERS:https://x.com/tmnaa16]',
'[social:Instagram:INSTAGRAM_FOLLOWERS:https://www.instagram.com/tmnaa16]',
'[social:Discord:DISCORD_MEMBERS:https://discord.gg/tmfx]',
'[social:WhatsApp:28K:https://whatsapp.com/channel/0029VadcjLc4Y9lnhHoOAw0a]',
'[link:اشترك الحين 🔥:https://kick.com/tmnaa/subscribe]',
'[link:ادعم البث 🤍:https://streamlabs.com/tmnaa/tip]',
'',
'# السيرفر',
'السيرفر: Mystery Town [emote:tmnaascraptmnaaMTONTOPTMNAA]',
'[link:ديسكورد السيرفر:https://discord.gg/mt]',
'[link:متجر السيرفر:https://mtrp.store]',
'',
'# المشرفين (مهم جداً: عندما تذكر مشرفاً أو تسألك عن المشرفين، اذكر الأسماء واذكر برفقة كل اسم صورة المشرف بهذه الصيغة [mod:الاسم] ولا تخطئ في صيغتها)',
'قائمة المشرفين في قناة tmnaa:',
'- [mod:YARAII] — @7YARAll',
'- [mod:Ilinay] — @llinay',
'- [mod:uRaseel] — @uRaseel',
'- [mod:Danah_ah] — ليس لها يوزر معلن',
'- [mod:Misk_ry] — ليس لها يوزر معلن',
'- [mod:rema] — @rema',
'- [mod:Thamer] — @0Thamer',
'- [mod:Rawabi] — @Rawabi',
'- [mod:Shatha] — @Shatha',
'- [mod:JANAxx] — @JANAxx',
'- [mod:Smok] — @smok',
'- [mod:ILOJAIN] — @LOJJEN',
'إذا سألك عن المشرفين قدم الرد بالترتيب أعلاه واذكرهم بأسمائهم مع صورهم.',
'ملاحظة: كل مشرف يُكتب هكذا [mod:اسم المشرف] فقط، لا تكتبه بطريقة ثانية.',
'',
'# الشخصيات (عندما يسأل عن شخصياتك في السيرفر أو وش تلعب أو وش تستخدم بالسيرفر)',
'جاوب بحماس عن شخصيات tmnaa وكأنك تتكلم عنه أو بلسانه (مثلاً: "في السيرفر نلعب بشخصيات رهيبة مثل أبو عبدو المواطن الكفو، وعندنا عبدالله الشمري..."):',
'- أبو عبدو — مواطن',
'- عبدالله الشمري — Lieutenant (يقول عن نفسه سترتيجي تيم رابع بامتي بس هذي مزح لا تاخذها جد 😂)',
'- عبدالرحمن علي — Cadet',
'',
'# أفضل صديق في السيرفر',
'أفضل صديق لـ tmnaa في السيرفر / Mystery Town هو متعب [emote:tmnaascraptmnaaMTONTOPTMNAA] — يعتبرون اخوان بالخير والشر يلعبون مع بعض ويسولفون وكلهم رفقة وكفاء.',
'إذا سألك أحد "من هو أفضل صديقك؟" أو "من أعز أصدقائك بالسيرفر؟" جاوب بحماس إنه متعب، وتكلم عنهم إنهم فريق واحد يلعبون سوا بالسيوف والبلد، ويعيبونه كلام وسوالف.',
'',
'# الجهاز',
'GPU: RTX 4070 Ti',
'CPU: i7-13700K',
'Motherboard: Z790',
'RAM: 64GB 6400MHz Corsair',
'المايك: Rode',
'DPI: 100',
'',
'# السابثون',
'الدولار = دقيقة، السبسكرايب والقفت = 5 دقائق',
'الكود: tmnaa',
'الرانك: Diamond 1',
'',
'# قوانين البث',
'- ممنوع السب، السياسة، تكرار الرسائل، طلب تغيير اللعبة، طلب الإشراف أو VIP، نقل الكلام بين البثوث، النشر.',
'',
'# التفاعل مع الشات',
'إذا كانت الرسالة إيجابية رد بإيجابية واستخدم 🤍 أحيانًا.',
'إذا كانت الرسالة سلبية لا تصعد الموضوع ورد بهدوء.',
'إذا كانت الرسالة سب ذكّر بالقوانين باختصار.',
'',
'# المقارنات مع ستريمرز آخرين',
'قل: كل واحد وله جمهوره ومحتواه 🤍',
'',
'# قاعدة: إذا ذكرت السيرفر أو MT أو قراند حط استكر [emote:tmnaascraptmnaaMTONTOPTMNAA] دائماً!',
'',
'# الطلبات الممنوعة',
'الرد: الطلبات هذي مو متاحة يا بعدي 🤍',
'',
'# إذا سأل عن باند أو مشكلة سيرفر',
'تواصل مع دعم MT من خلال الديسكورد.',
'',
'# إذا سأل عن الجرافكس',
'الجرافكس خاص وغير متاح للنشر.',
'',
'# إذا سأل عن الفيس كام (Facecam)',
'الإضاءة خربانة 😅',
'',
'# إذا سأل عن الصلاة',
'رح صل وننتظرك يا بعدي 🤍',
'',
'# إذا كتب دعاء',
'آمين وياك يا رب 🤍',
'',
'# ردود جاهزة',
'سلام -> وعليكم السلام ورحمة الله حياك 🤍',
'منور -> النور نورك يا بعدي 🤍',
'اشتراك -> https://kick.com/tmnaa/subscribe',
'مواصفات -> 4070 Ti | i7-13700K | Z790 | 64GB 6400MHz Corsair',
'عمرك -> مو معلن رسميًا.',
'اسمك الكامل -> عبدالله الشمري من السعودية حفر الباطن.',
'حول اللعبة -> التحويلات مو متاحة 🤍',
'ادع لي -> الله يوفقك ويسعدك ويرزقك من حيث لا تحتسب 🤍',
].join('\n');

type Msg = { role: 'user' | 'assistant'; content: string };
// AI backend: GROQ (see src/lib/groq.ts) — 3 keys with auto failover + model fallback.

const TH = { primary: '#D4A84A', primaryDark: '#B8860B', primaryLight: '#E8C97A', bgDark: '#120D08', text: '#F5EBD5', textMuted: '#A08A5A', border: 'rgba(212,168,74,0.25)', borderLight: 'rgba(212,168,74,0.15)' };

const SP: Record<string, { color: string; icon: any }> = {
  Kick: { color: '#53FC18', icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M3 3h4.5v6.9l6-6.9H19l-7.5 8.4L20 21h-5.4l-5.1-6.6V21H3V3z"/></svg> },
  X: { color: '#FFF', icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg> },
  Instagram: { color: '#E1306C', icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M7.8 2h8.4C19.4 2 22 4.6 22 7.8v8.4a5.8 5.8 0 0 1-5.8 5.8H7.8C4.6 22 2 19.4 2 16.2V7.8A5.8 5.8 0 0 1 7.8 2m-.2 2A3.6 3.6 0 0 0 4 7.6v8.8C4 18.39 5.61 20 7.6 20h8.8a3.6 3.6 0 0 0 3.6-3.6V7.6C20 5.61 18.39 4 16.4 4H7.6m9.65 1.5a1.25 1.25 0 0 1 1.25 1.25A1.25 1.25 0 0 1 17.25 8 1.25 1.25 0 0 1 16 6.75a1.25 1.25 0 0 1 1.25-1.25M12 7a5 5 0 0 1 5 5 5 5 0 0 1-5 5 5 5 0 0 1-5-5 5 5 0 0 1 5-5m0 2a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3z"/></svg> },
  TikTok: { color: '#FE2C55', icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/></svg> },
  YouTube: { color: '#FF0000', icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/></svg> },
  Discord: { color: '#5865F2', icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076-.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.419 0 1.333-.946 2.419-2.157 2.419zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.419 0 1.333-.946 2.419-2.157 2.419z"/></svg> },
  WhatsApp: { color: '#25D366', icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.008-.57-.008-.198 0-.52.074-.792.372-.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg> },
};

const NAV_EMOJI: Record<string, string> = {
  home: '🏠',
  stream: '🔴',
  support: '💜',
  stats: '📊',
  clips: '🎬',
  moderators: '🛡️',
};

const MODS = [
  { name: 'YARAII', kick: '7YARAll', avatar: 'https://files.kick.com/images/user/37363145/profile_image/conversion/3633013f-a1f1-4206-a341-65f38a375b02-fullsize.webp' },
  { name: 'Ilinay', kick: 'llinay', avatar: 'https://files.kick.com/images/user/52612635/profile_image/conversion/84197bbd-2aca-4f0f-87b4-f94cf1a54600-fullsize.webp' },
  { name: 'uRaseel', kick: 'uRaseel', avatar: 'https://files.kick.com/images/user/31153941/profile_image/conversion/e5c02131-0460-45aa-9197-84b6b0b7cfdb-fullsize.webp' },
  { name: 'Danah_ah', kick: '', avatar: '' },
  { name: 'Misk_ry', kick: '', avatar: '' },
  { name: 'rema', kick: 'rema', avatar: '' },
  { name: 'Thamer', kick: '0Thamer', avatar: 'https://files.kick.com/images/user/34415053/profile_image/conversion/4dd489bf-d27f-49f8-8c47-18072ab57d7b-fullsize.webp' },
  { name: 'Rawabi', kick: 'Rawabi', avatar: 'https://files.kick.com/images/user/5834467/profile_image/conversion/56a26c88-7bb6-4d23-9bc7-e59745323c3c-fullsize.webp' },
  { name: 'Shatha', kick: 'Shatha', avatar: 'https://files.kick.com/images/user/1130827/profile_image/conversion/7681f6b8-0695-49d8-a859-e419737e1d57-fullsize.webp' },
  { name: 'JANAxx', kick: 'JANAxx', avatar: 'https://files.kick.com/images/user/5783941/profile_image/conversion/eb7e2e29-3a03-4356-b9cd-d1a4143b008d-fullsize.webp' },
  { name: 'Smok', kick: 'smok', avatar: '' },
  { name: 'ILOJAIN', kick: 'LOJJEN', avatar: 'https://files.kick.com/images/user/19449861/profile_image/conversion/5cf22d53-aca6-4246-becc-f0f52e9286ef-fullsize.webp' },
];
const MOD_MAP: Record<string, { kick: string; avatar: string }> = {};
for (const m of MODS) MOD_MAP[m.name.toLowerCase()] = { kick: m.kick, avatar: m.avatar };

const fmt = (n: number) => { if (!n) return ''; if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'; if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K'; return n.toString(); };

const QA = [
  { label: 'شخصيات السيرفر', c: '#D4A84A', q: 'وش شخصياتك اللي تلعب فيها بسيرفر MT؟', i: <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg> },
  { label: 'مواصفات الجهاز', c: '#31d6d6', q: 'وش مواصفات جهازك اللي تبث منه؟', i: <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M21 2H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h7l-2 3v1h8v-1l-2-3h7c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 12H3V4h18v10z"/></svg> },
  { label: 'كيك', c: '#53FC18', q: 'وش رابط قناة tmnaa بكيك وكم المتابعين؟', i: <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M3 3h4.5v6.9l6-6.9H19l-7.5 8.4L20 21h-5.4l-5.1-6.6V21H3V3z"/></svg> },
  { label: 'تيك توك', c: '#FE2C55', q: 'وش حساب tmnaa بتيك توك وكم المتابعين؟', i: <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/></svg> },
  { label: 'يوتيوب', c: '#FF0000', q: 'وش قناة tmnaa باليوتيوب وكم المشتركين؟', i: <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/></svg> },
  { label: 'ديسكورد', c: '#5865F2', q: 'وش رابط ديسكورد tmnaa وكم الأعضاء؟', i: <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076-.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.419 0 1.333-.946 2.419-2.157 2.419zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.419 0 1.333-.946 2.419-2.157 2.419z"/></svg> },
];

const ALL_QUESTIONS = [
  "وش مواصفات جهازك؟",
  "وش شخصياتك في سيرفر MT؟",
  "وش هي قوانين البث؟",
  "وش حساباتك الثانية؟",
  "وش هو السابثون ووش شروطه؟",
  "كم الرانك حقك؟",
  "كم عدد متابعينك في كيك؟",
  "عطني رابط ديسكورد السيرفر",
  "وش نوع المايك حقك؟",
  "كم الـ DPI اللي تلعب فيه؟",
  "علمني عن شخصية أبو عبدو المواطن",
  "وش دور عبدالله الشمري في السيرفر؟",
  "من هو عبدالرحمن علي؟",
  "عطني رابط الدعم المادي",
  "كيف اقدر اشترك في القناة؟",
  "وش هو مجتمع Level One؟",
  "أبي أشوف احصائيات البث",
  "مين المشرفين عندك؟",
  "أبي أشوف آخر الفيديوهات والبثوث",
  "مين أعلى الداعمين عندك في البث؟",
  "وش هو متجر سيرفر MT؟",
  "هل عندك حساب في التيك توك؟",
  "عطني رابط الانستقرام",
  "كم عدد المشتركين في اليوتيوب؟",
  "أبي أشوف اللقطات والبثوث الجديدة",
  "وش كرت الشاشة حقك؟",
  "أبي معلومات عن أقسام الموقع",
  "من هو أفضل صديقك في السيرفر؟",
  "هل فيه ديسكورد لمجتمع tmnaa؟"
];

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([{ role: 'assistant', content: '[emote:tmnaasalutetmnaa] هلا والله! منور يا بعدي 🤍\nكيف أقدر أساعدك اليوم؟\n\n[suggest:وش شخصياتك بالسيرفر؟]\n[suggest:وش مواصفات جهازك؟]' }]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showQA, setShowQA] = useState(true);
  const [counts, setCounts] = useState<Record<string, string>>({ whatsapp: '28K' });
  const [botrix, setBotrix] = useState<any[]>([]);
  const [vods, setVods] = useState<{ title: string; url: string; views: number }[]>([]);
  const [liveData, setLiveData] = useState<{ isLive: boolean; title: string; category: string; viewers: number } | null>(null);
  const [typingIndex, setTypingIndex] = useState(-1); // -1 = no typing animation
  const [typingText, setTypingText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const typingRef = useRef<number | null>(null);

  const renderText = useCallback((text: string, sendFn: (text: string) => void) => {
    const processMarkdown = (str: string, pk: number) => {
      const parts = str.split(/(\*\*.*?\*\*)/g);
      return parts.map((bp, i) => {
        if (bp.startsWith('**') && bp.endsWith('**')) {
          return <strong key={`b${pk}_${i}`} className="text-[#D4A84A] font-bold text-[14px] mx-1">{bp.slice(2, -2)}</strong>;
        }
        return bp.split('\n').map((line, j) => {
          if (line.trim().startsWith('- ')) {
            return <div key={`l${pk}_${i}_${j}`} className="flex items-start gap-2 my-1"><span className="text-[#D4A84A] mt-1">•</span><span>{line.replace(/^- /, '').trim()}</span></div>;
          }
          if (line.trim().startsWith('#')) {
            return <h3 key={`h${pk}_${i}_${j}`} className="text-[#D4A84A] font-black text-lg mt-3 mb-1">{line.replace(/^#+/, '').trim()}</h3>;
          }
          return <span key={`s${pk}_${i}_${j}`}>{line}{j < bp.split('\n').length - 1 && <br />}</span>;
        });
      });
    };

    const parts: any[] = [];
    const suggests: string[] = [];
    const re = /\[social:([a-zA-Z0-9_]+):([^:]*):(https?:\/\/[^\]]+)\]|\[emote:([^\]]+)\]|\[suggest:([^\]]+)\]|\[link:([^:]+):(https?:\/\/[^\]]+)\]|\[nav:([^:]+):([^\]]+)\]|\[mod:([^\]]+)\]|(tmnaasalutetmnaa|tmnaatmnaalaughtmnaatmnaalaugh|tmnaascraptmnaaMTONTOPTMNAA)/g;
    let li = 0, m, k = 0;
    while ((m = re.exec(text)) !== null) {
      if (m.index > li) parts.push(processMarkdown(text.slice(li, m.index).replace(/\s+$/, ''), k++));
      
      if (m[1]) {
        const sname = m[1], scount = m[2], surl = m[3];
        const pl = SP[sname];
        let dc = scount;
        if (scount.includes('_')) dc = counts[sname.toLowerCase()] || '';
        const c = pl?.color || TH.primary;
        parts.push(<a key={`s${k++}`} href={surl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-3 py-1.5 my-0.5 rounded-xl text-white text-xs font-medium transition-all duration-300 hover:scale-105 active:scale-95 shadow-lg" style={{ background: `linear-gradient(135deg, ${c}20, ${c}05)`, border: `1px solid ${c}40`, boxShadow: `0 0 15px ${c}15`, direction: 'ltr' }}>
            <span className="flex items-center justify-center w-6 h-6 rounded-lg shrink-0" style={{ color: c, background: `${c}15` }}>{pl?.icon}</span>
            <span className="flex flex-col leading-tight text-right"><span className="text-[10px] font-black tracking-wide" style={{ color: c }}>{sname}</span><span className="text-[8px] text-white/50">{dc}{sname === 'YouTube' ? ' مشترك' : ' متابع'}</span></span>
          </a>);
      } else if (m[4] || m[11]) {
        const emoteName = (m[4] || m[11]).trim();
        let filename = `${emoteName}.png`;
        if (emoteName === 'tmnaasalutetmnaa') filename = 't7ea_fullsize.png';
        else if (emoteName === 'tmnaascraptmnaaMTONTOPTMNAA') filename = 'mt_fullsize.png';
        else if (emoteName === 'tmnaatmnaalaughtmnaatmnaalaugh') filename = '67k_fullsize.png';
        
        const imgSrc = `/emotes/${filename}`;
        
        parts.push(
          <img 
            key={`e${k++}`} 
            src={imgSrc} 
            alt={emoteName}
            className="inline-block h-10 mx-1 align-middle"
            style={{ animation: 'emote-bounce 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both' }}
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.outerHTML = `<span class="text-red-500 text-[10px] font-bold">❌ Error loading: ${imgSrc}</span>`;
            }}
          />
        );
      } else if (m[5]) {
        suggests.push(m[5]);
      } else if (m[6]) {
        const linkName = m[6], linkUrl = m[7];
        parts.push(
          <a 
            key={`lnk${k++}`} 
            href={linkUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="group flex items-center justify-between w-full mt-2 px-4 py-2.5 bg-gradient-to-l from-[#D4A84A]/15 to-[#1a140a] hover:from-[#D4A84A]/25 border border-[#D4A84A]/30 hover:border-[#D4A84A]/60 rounded-xl text-[#F5EBD5] hover:text-white text-[13px] font-semibold transition-all duration-300 shadow-md hover:shadow-[0_0_20px_rgba(212,168,74,0.2)] no-underline"
          >
            <span className="flex items-center gap-2 text-right">
              <span className="w-7 h-7 flex items-center justify-center rounded-lg bg-[#D4A84A]/15 text-[#D4A84A] text-sm">🔗</span>
              {linkName}
            </span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-4 h-4 text-[#D4A84A]/60 group-hover:text-[#D4A84A] group-hover:translate-x-0.5 transition-all"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
          </a>
        );
      } else if (m[8]) {
        const navName = m[8], navId = m[9];
        const navEmoji = NAV_EMOJI[navId] || '📍';
        parts.push(
          <button 
            key={`nav${k++}`} 
            onClick={() => { const el = document.getElementById(navId); if (el) el.scrollIntoView({ behavior: 'smooth' }); }}
            className="group flex items-center justify-between w-full mt-2 px-4 py-2.5 bg-gradient-to-l from-[#B8860B]/20 to-[#1a140a] hover:from-[#B8860B]/30 border border-[#D4A84A]/30 hover:border-[#E8C97A]/60 rounded-xl text-[#E8C97A] hover:text-white text-[13px] font-semibold transition-all duration-300 shadow-md hover:shadow-[0_0_20px_rgba(212,168,74,0.2)] cursor-pointer"
          >
            <span className="flex items-center gap-2 text-right">
              <span className="w-7 h-7 flex items-center justify-center rounded-lg bg-[#D4A84A]/15 text-sm" style={{ boxShadow: 'inset 0 0 8px rgba(212,168,74,0.15)' }}>{navEmoji}</span>
              <span className="flex items-center gap-1.5">{navName}</span>
            </span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-4 h-4 text-[#D4A84A]/60 group-hover:text-[#E8C97A] group-hover:-translate-y-0.5 transition-all"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
          </button>
        );
      } else if (m[10]) {
        const modKey = m[10].trim().toLowerCase();
        const mod = MOD_MAP[modKey];
        const modName = MOD_MAP[modKey] ? MODS.find(x => x.name.toLowerCase() === modKey)!.name : m[10].trim();
        const kick = mod?.kick || '';
        const av = mod?.avatar || '';
        const link = kick ? `https://kick.com/${kick}` : undefined;
        const content = (
          <span className="inline-flex items-center gap-1.5 mx-0.5 align-middle bg-[#D4A84A]/10 border border-[#D4A84A]/25 rounded-full px-1.5 py-0.5">
            {av ? (
              <img src={av} alt={modName} loading="lazy" onError={(e) => { const t = e.target as HTMLImageElement; t.style.display = 'none'; }} className="w-5 h-5 rounded-full object-cover shrink-0" />
            ) : (
              <span className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center text-[8px] font-black text-[#D4A84A]" style={{ background: 'radial-gradient(circle at 35% 30%, #241a12, #0c0806 75%)', border: '1px solid rgba(212,168,74,0.35)' }}>{modName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase()}</span>
            )}
            <span className="text-[11px] font-bold" style={{ color: '#E8C97A' }}>{modName}</span>
            {link && <a href={link} target="_blank" rel="noopener noreferrer" className="text-[8px] font-semibold text-[#53FC18]/70 hover:text-[#53FC18]">@{kick}</a>}
          </span>
        );
        parts.push(<span key={`mod${k++}`} className="inline-flex items-center flex-wrap">{content}</span>);
      }
      li = re.lastIndex;
    }
    if (li < text.length) parts.push(processMarkdown(text.slice(li).replace(/\s+$/, ''), k++));

    if (suggests.length) {
      parts.push(
        <div key={`sugg${k++}`} className="mt-2 w-full">
          {suggests.map((s, si) => (
            <motion.div
              key={`sug${s}`}
              initial={{ opacity: 0, y: -12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 320, damping: 26, delay: 0.25 + si * 0.18 }}
              className="w-full"
            >
              <button
                onClick={() => sendFn(s)}
                className="group relative flex items-center justify-end w-full mt-1.5 px-4 py-2 bg-gradient-to-l from-[#D4A84A]/10 to-transparent hover:from-[#D4A84A]/20 border border-[#D4A84A]/20 hover:border-[#D4A84A]/50 rounded-xl text-[#F5EBD5] hover:text-white text-[13px] font-medium transition-all duration-300 shadow-sm hover:shadow-[0_0_15px_rgba(212,168,74,0.15)] overflow-hidden"
              >
                <span className="relative z-10 text-right w-full flex items-center justify-end gap-2">
                  {s}
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-4 h-4 text-[#D4A84A] group-hover:scale-110 transition-transform"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                </span>
              </button>
            </motion.div>
          ))}
        </div>
      );
    }

    return parts.length ? parts : processMarkdown(text, k++);
  }, [counts]);

  useEffect(() => {
    let cancelled = false;
    const fetchAll = async () => {
      const c: Record<string, string> = { whatsapp: '28K' };
      try { const r = await fetch(apiUrl('/api/kick?endpoint=' + encodeURIComponent('https://kick.com/api/v2/channels/tmnaa'))); if (r.ok) { const d = await r.json(); const f = d?.followers_count || 0; if (f) c.kick = fmt(f); 
        // Live stream detection
        const ls = d?.livestream;
        if (!cancelled) {
          if (ls && ls.is_live !== false) {
            setLiveData({ isLive: true, title: ls.session_title || ls.title || '', category: ls.categories?.[0]?.name || ls.category?.name || '', viewers: ls.viewer_count || ls.viewers || 0 });
          } else {
            setLiveData({ isLive: false, title: '', category: '', viewers: 0 });
          }
        }
      } } catch {}
      try { const r = await fetch(apiUrl('/api/kick?endpoint=' + encodeURIComponent('https://botrix.live/api/public/leaderboard?platform=kick&user=tmnaa'))); if (r.ok) { const d = await r.json(); if (!cancelled && Array.isArray(d)) setBotrix(d.slice(0, 20)); } } catch {}
      try { const r = await fetch(apiUrl('/api/kick?endpoint=' + encodeURIComponent('https://kick.com/api/v2/channels/tmnaa/videos'))); if (r.ok) { const d = await r.json(); const v = d?.videos || (Array.isArray(d) ? d : []); if (!cancelled) setVods(v.slice(0, 5).map((x: any) => ({ title: x.session_title || x.title || 'Past Stream', url: `https://kick.com/video/${x.id}`, views: x.views || x.view_count || 0 }))); } } catch {}
      if (!cancelled) setCounts(c);
    };
    fetchAll();
    const iv = setInterval(fetchAll, 60000);
    return () => { cancelled = true; clearInterval(iv); };
  }, []);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages, isLoading, typingText, typingIndex]);
  useEffect(() => { if (isOpen && inputRef.current) inputRef.current.focus(); }, [isOpen]);

  const buildPrompt = useCallback(() => {
    let p = P;
    p = p.replace(/KICK_FOLLOWERS/g, counts.kick || '1K');
    
    // Live stream info
    if (liveData?.isLive) {
      const isMT = liveData.category.toLowerCase().includes('grand theft auto');
      p += `\n\n# حالة البث (مهم جداً: البث شغال الحين!)`;
      p += `\nالبث شغال الحين 🔴 بعنوان: "${liveData.title}"`;
      p += `\nاللعبة: ${liveData.category}`;
      p += `\nالمشاهدين: ${liveData.viewers}`;
      if (isMT) p += `\nملاحظة: الحين يلعب في سيرفر Mystery Town [emote:tmnaascraptmnaaMTONTOPTMNAA]`;
      p += `\nرابط البث: [link:شاهد البث دحيننن 🔴:https://kick.com/tmnaa]`;
      p += `\nإذا سألك أحد وش الحين يبث أو كيف أشوف البث الحالي: ضع زر البث المباشر: [nav:البث المباشر:stream]`;
    } else {
      p += `\n\n# حالة البث\nالبث مو شغال الحين. إذا سألك أحد عن البث قل له البث مو شغال الحين بس تابع القناة عشان يجيك إشعار لما يفتح.`;
    }
    
    // Select 3 random questions for the bot to suggest
    const shuffled = [...ALL_QUESTIONS].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 3);
    
    p += `\n\n# أسئلة مقترحة إجبارية للمستخدم`;
    p += `\nعليك وضع هذه الـ 3 اقتراحات نصياً وفي سطر جديد في نهاية كل رد لك بالضبط كما هي مكتوبة لكي يتمكن المستخدم من الضغط عليها:`;
    p += `\n[suggest:${selected[0]}]`;
    p += `\n[suggest:${selected[1]}]`;
    p += `\n[suggest:${selected[2]}]`;

    return p;
  }, [counts, botrix, vods, liveData]);

  const fetchFB = useCallback(async (hist: Msg[]): Promise<string> => {
    const messages: GroqMessage[] = [
      { role: 'system', content: buildPrompt() },
      ...hist.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    ];
    // groqChat tries keys 1→2→3 (rotating start) + falls back across models.
    for (let attempt = 0; attempt < 2; attempt++) {
      const txt = await groqChat(messages, { temperature: 0.3, maxTokens: 512 });

      // Check for hallucinated Chinese/Russian languages. If found, retry once.
      if (/[Ѐ-ӿ一-鿿]/.test(txt) && attempt === 0) continue;
      if (txt) return txt;
    }
    throw new Error('GROQ: empty reply after retry');
  }, [buildPrompt]);

  const send = useCallback(async (ov?: string) => {
    const text = (ov || input).trim();
    if (!text || isLoading) return;
    const um: Msg = { role: 'user', content: text };
    const nh = [...messages, um];
    setMessages(nh); setInput(''); setIsLoading(true); setShowQA(false);
    try {
      const reply = await fetchFB(nh);
      // Start typewriter animation
      const newMsgs = [...nh, { role: 'assistant' as const, content: '' }];
      setMessages(newMsgs);
      const msgIdx = newMsgs.length - 1;
      setTypingIndex(msgIdx);
      setTypingText('');
      
      let charIdx = 0;
      if (typingRef.current) clearInterval(typingRef.current);
      typingRef.current = window.setInterval(() => {
        charIdx++;
        if (charIdx >= reply.length) {
          if (typingRef.current) clearInterval(typingRef.current);
          setMessages(prev => prev.map((m, i) => i === msgIdx ? { ...m, content: reply } : m));
          setTypingIndex(-1);
          setTypingText('');
        } else {
          setTypingText(reply.slice(0, charIdx));
        }
      }, 15);
    }
    catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[tmnaaBot] send failed:', msg);
      // Surface the real reason (never includes key values) so misconfig is obvious.
      let hint = 'معليش، فيه مشكلة بالاتصال الحين. حاول بعد شوي يا بعدي 🤍';
      if (/no API keys/i.test(msg)) {
        hint = 'البوت مو مضبوط بعد: GROQ_API_KEY ناقص. أعد تشغيل السيرفر (pnpm dev) وتأكد من ملف .env 🤍';
      } else if (/401|403/.test(msg)) {
        hint = 'مفاتيح GROQ مرفوضة (تحقق من GROQ_API_KEY في ملف .env وحدثها) 🤍';
      } else if (/429/.test(msg)) {
        hint = 'في ضغط عالي على GROQ الحين، انتظر شوي وحاول مجدد يا وحش 🤍';
      } else if (/network|fetch|CORS|cors|Failed/i.test(msg)) {
        hint = 'المتصفح ما قدر يوصل لسيرفر GROQ. جرّب تحديث الصفحة (Ctrl+Shift+R) 🤍';
      }
      setMessages(prev => [...prev, { role: 'assistant', content: hint }]);
    }
    finally { setIsLoading(false); }
  }, [input, isLoading, messages, fetchFB]);

  const onKey = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } };

  return (<>
    <AnimatePresence>{isOpen && (
      <motion.div initial={{ opacity: 0, y: 24, scale: 0.92 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 24, scale: 0.92 }} transition={{ type: 'spring', stiffness: 380, damping: 28 }}
        style={{ position: 'fixed', bottom: '6.5rem', right: '1.5rem', width: '400px', maxWidth: 'calc(100vw - 2rem)', height: '600px', maxHeight: 'calc(100vh - 180px)', zIndex: 9999, display: 'flex', flexDirection: 'column', borderRadius: '1.5rem', overflow: 'hidden', boxShadow: '0 25px 60px rgba(0,0,0,0.5), 0 0 40px rgba(212,168,74,0.12)', border: `1px solid ${TH.border}`, background: TH.bgDark }}>
        <div style={{ background: 'linear-gradient(135deg, #1A1308 0%, #0F0A05 100%)', borderBottom: `1px solid ${TH.border}`, padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ position: 'relative' }}>
              <img src="/tmnaa-bot-avatar.png" alt="bot" style={{ width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover', border: `2px solid ${TH.primaryLight}`, boxShadow: `0 0 12px rgba(212,168,74,0.4)` }} />
              <div style={{ position: 'absolute', bottom: '1px', right: '1px', width: '11px', height: '11px', background: '#22c55e', borderRadius: '50%', border: `2px solid ${TH.bgDark}` }} />
            </div>
            <div><div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><h3 style={{ fontWeight: 700, fontSize: '15px', color: TH.text, margin: 0 }}>tmnaa Bot</h3><Sparkles style={{ width: '14px', height: '14px', color: TH.primaryLight }} /></div><p style={{ fontSize: '11px', color: TH.textMuted, margin: 0 }}>متصل الآن • AI مساعد</p></div>
          </div>
          <button onClick={() => setIsOpen(false)} style={{ width: '32px', height: '32px', borderRadius: '50%', border: `1px solid ${TH.borderLight}`, background: 'rgba(212,168,74,0.1)', color: TH.primaryLight, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X style={{ width: '16px', height: '16px' }} /></button>
        </div>

        {showQA && messages.length === 1 && (
          <div style={{ background: 'rgba(18,13,8,0.6)', borderBottom: `1px solid ${TH.borderLight}` }}>
            <div style={{ padding: '12px 16px' }}>
              <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', fontWeight: 500, letterSpacing: '0.5px', marginBottom: '10px', textTransform: 'uppercase' }}>اسأل عن حسابات tmnaa</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {QA.map((a) => (
                  <button key={a.label} onClick={() => send(a.q)}
                    className="group relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 hover:border-white/30 text-white/70 hover:text-white text-xs font-medium transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer"
                    style={{ color: a.c, borderColor: a.c + '33' }}>
                    <span className="transition-transform duration-300 group-hover:scale-110" style={{ color: a.c }}>{a.i}</span>
                    <span style={{ color: 'rgba(255,255,255,0.7)' }}>{a.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="premium-scroll" style={{ flex: 1, overflowY: 'auto', padding: '16px', background: 'linear-gradient(180deg, #0F0A05 0%, #1A1308 100%)', display: 'flex', flexDirection: 'column', gap: '12px', '--scr-from': 'rgba(212,168,74,0.4)', '--scr-to': 'rgba(184,134,11,0.2)' } as any} ref={scrollRef}>
          {messages.map((m, i) => (
            <motion.div
              key={i}
              initial={m.role === 'assistant' && i === messages.length - 1 ? { opacity: 0, y: -28, scale: 0.9 } : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={m.role === 'assistant' && i === messages.length - 1
                ? { type: 'spring', stiffness: 320, damping: 22, delay: 0.05 }
                : { duration: 0.2 }}
              style={{ display: 'flex', gap: '8px', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', alignItems: 'flex-end' }}>
              {m.role === 'assistant' && <img src="/tmnaa-bot-avatar.png" alt="b" style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover', border: `1px solid ${TH.border}`, flexShrink: 0 }} />}
              <div style={{ maxWidth: '78%', padding: '10px 14px', fontSize: '13px', lineHeight: '1.6', borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px', direction: 'rtl', textAlign: 'right', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                ...(m.role === 'user' ? { background: 'linear-gradient(135deg, #B8860B, #8A6A1F)', color: '#fff', boxShadow: '0 2px 12px rgba(212,168,74,0.3)' } : { background: 'rgba(30,22,12,0.85)', color: TH.text, border: `1px solid ${TH.borderLight}` }) }}>
                {m.role === 'assistant' ? renderText(typingIndex === i ? typingText : m.content, send) : m.content}
                {typingIndex === i && <motion.span animate={{ opacity: [1,0] }} transition={{ duration: 0.5, repeat: Infinity }} className="inline-block w-0.5 h-4 bg-[#D4A84A] ml-1 align-middle" />}
              </div>
            </motion.div>
          ))}
          {isLoading && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
              <img src="/tmnaa-bot-avatar.png" alt="b" style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover', border: `1px solid ${TH.border}`, flexShrink: 0 }} />
              <div style={{ background: 'rgba(30,22,12,0.85)', border: `1px solid ${TH.borderLight}`, borderRadius: '16px 16px 16px 4px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ display: 'flex', gap: '4px' }}>{[0, 1, 2].map(d => <motion.div key={d} animate={{ y: [0, -5, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: d * 0.15 }} style={{ width: '6px', height: '6px', borderRadius: '50%', background: TH.primary }} />)}</div>
                <span style={{ color: TH.textMuted, fontSize: '11px' }}>جاري الكتابة...</span>
              </div>
            </motion.div>
          )}
        </div>

        <div style={{ padding: '12px 14px', background: '#0F0A05', borderTop: `1px solid ${TH.borderLight}` }}>
          <form onSubmit={(e) => { e.preventDefault(); send(); }} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={onKey} placeholder="اسألني أي شيء عن البث..." dir="rtl"
              style={{ flex: 1, height: '40px', padding: '0 14px', borderRadius: '20px', border: `1px solid ${TH.borderLight}`, background: 'rgba(20,15,8,0.8)', color: TH.text, fontSize: '13px', outline: 'none' }} />
            <button type="submit" disabled={!input.trim() || isLoading}
              style={{ width: '40px', height: '40px', borderRadius: '50%', border: 'none', background: input.trim() && !isLoading ? 'linear-gradient(135deg, #B8860B, #8A6A1F)' : 'rgba(212,168,74,0.15)', color: input.trim() && !isLoading ? '#fff' : '#8a7a5a', cursor: input.trim() && !isLoading ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {isLoading ? <Loader2 style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} /> : <Send style={{ width: '16px', height: '16px' }} />}
            </button>
          </form>
          <p style={{ textAlign: 'center', fontSize: '10px', color: '#8a7a5a', marginTop: '6px' }}>Powered by tmnaa Community • AI Bot</p>
        </div>
      </motion.div>
    )}</AnimatePresence>

    <motion.div initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.5 }} style={{ position: 'fixed', bottom: '1.5rem', right: '1.5rem', zIndex: 9999 }}>
      <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }} onClick={() => setIsOpen(!isOpen)}
        style={{ width: '64px', height: '64px', borderRadius: '50%', border: `1px solid rgba(212,168,74,0.4)`, padding: 0, cursor: 'pointer', overflow: 'hidden', background: 'linear-gradient(135deg, #1A1308, #0A0703)', boxShadow: `0 8px 30px rgba(212,168,74,0.25), inset 0 0 20px rgba(212,168,74,0.1)`, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        {isOpen ? <X style={{ width: '28px', height: '28px', color: '#D4A84A' }} /> : (
          <>
            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 50%, rgba(212,168,74,0.25) 0%, transparent 70%)' }} />
            <div className="relative flex items-center justify-center">
              <Bot strokeWidth={1.5} className="w-8 h-8 text-[#D4A84A] relative z-10 drop-shadow-[0_0_12px_rgba(212,168,74,0.8)]" />
              <Sparkles strokeWidth={2.5} className="absolute -top-2 -right-3 w-4 h-4 text-[#F5EBD5] animate-pulse drop-shadow-[0_0_8px_rgba(245,235,213,0.9)] z-20" />
            </div>
          </>
        )}
      </motion.button>
      {!isOpen && <motion.div animate={{ scale: [1, 1.4, 1.4], opacity: [0.5, 0, 0] }} transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: '50%', border: `2px solid ${TH.primary}`, pointerEvents: 'none' }} />}
    </motion.div>

    <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
  </>);
}

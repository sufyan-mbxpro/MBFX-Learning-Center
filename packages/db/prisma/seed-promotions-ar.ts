// Arabic words for the three seeded promotions (ADR-166: Arabic is the first
// locale). The promotions are seeded `untranslated: "HIDE"`, so without these
// rows none of them would appear on an Arabic page.
//
// Keyed by the promotion's fixed seed id. Same rule as the English: the copy
// says what the session or course covers and never what a broker charges or
// what the market will do. `create`-only; `sourceHash` stays NULL.
import type { PrismaClient } from "../src/generated/client/client.ts";

export interface ArabicPromotionWords {
  title: string;
  body: string;
  badge: string;
  ctaLabel: string;
}

export const SEED_PROMOTIONS_AR: Readonly<Record<string, ArabicPromotionWords>> = {
  "seed-promo-nfp-webinar": {
    title: "ندوة مباشرة عبر الإنترنت: تداول تقرير الوظائف الأمريكي (NFP)",
    badge: "مجانية · 60 دقيقة",
    ctaLabel: "اطّلع على مواعيد الإصدار",
    body: [
      "<p>يصدر تقرير الوظائف غير الزراعية (NFP) عن مكتب إحصاءات العمل الأمريكي في الساعة 8:30 صباحًا بتوقيت نيويورك، عادةً في أول جمعة من الشهر، وقد يقطع EUR/USD وUSD/JPY والذهب في الدقيقة الأولى مسافة أكبر مما قطعها في الساعة التي سبقتها.</p>",
      "<ul>",
      "<li>ما الذي يخبرك به كلٌّ من الرقم الرئيسي ومعدل البطالة ومتوسط الأجر في الساعة</li>",
      "<li>لماذا يتسع السبريد وتنزلق أوامر الإيقاف في الثواني المحيطة بالإصدار</li>",
      "<li>تحديد حجم الصفقة بحيث لا تكلّف قفزة بمقدار 50 نقطة أكثر من 1% من حساب قيمته 10,000 دولار</li>",
      "</ul>",
    ].join(""),
  },
  "seed-promo-crypto-foundations": {
    title: "دورة مجانية: افهم البيتكوين والإيثريوم قبل أن تتداولهما",
    badge: "دورة مجانية",
    ctaLabel: "ابدأ الدورة",
    body: [
      "<p>تشرح دورة أساسيات العملات المشفرة ما الذي تحتفظ به فعلًا، دون أن تترك أي مصطلح بلا تعريف.</p>",
      "<ul>",
      "<li>ما الذي يسجّله البلوك تشين، وما الذي لا يمكنه إخبارك به</li>",
      "<li>المحافظ والمفاتيح الخاصة والحفظ: من يتحكم فعليًا في الرصيد</li>",
      "<li>لماذا تظهر العملة نفسها بأسعار مختلفة على منصات تداول مختلفة</li>",
      "<li>تحديد حجم الصفقة في سوق يُتداول على مدار الساعة طوال الأسبوع وقد يتحرك 10% في يوم واحد</li>",
      "</ul>",
    ].join(""),
  },
  "seed-promo-dst-session-shift": {
    title: "تغيير التوقيت الصيفي: مواعيد جلسات الفوركس تتغير بساعة",
    badge: "تغيير في المواعيد",
    ctaLabel: "اعرض الجلسات بتوقيتك",
    body: [
      "<p>تنهي أوروبا التوقيت الصيفي في آخر أحد من أكتوبر، والولايات المتحدة بعدها بأسبوع، في أول أحد من نوفمبر. وخلال ذلك الأسبوع تتقدم لندن على نيويورك بأربع ساعات بدلًا من خمس، فتبدأ فترة التداخل بين لندن ونيويورك أبكر بساعة بتوقيت لندن.</p>",
      "<p>وبعد أن يتغير التوقيت في الجانبين، تُفتتح جلستا لندن ونيويورك متأخرتين ساعة بالتوقيت العالمي المنسق (UTC). أما العملات المشفرة فتُتداول على مدار الساعة ولا تُغلق، لكن مواعيد الشمعة اليومية والسواب على منصتك قد تتغير، لذا تحقق من توقيت خادم الوسيط الذي تتعامل معه.</p>",
    ].join(""),
  },
};

/** Writes the Arabic rows for promotions that exist. Returns how many it created. */
export async function seedArabicPromotions(
  db: PrismaClient,
  options: { adminId?: string | null } = {},
): Promise<number> {
  let created = 0;
  for (const [promotionId, words] of Object.entries(SEED_PROMOTIONS_AR)) {
    const promotion = await db.promotion.findUnique({
      where: { id: promotionId },
      select: { id: true, translations: { where: { locale: "ar" }, select: { id: true } } },
    });
    if (!promotion || promotion.translations.length > 0) continue;
    await db.promotionTranslation.create({
      data: {
        promotionId,
        locale: "ar",
        title: words.title,
        body: words.body,
        badge: words.badge,
        ctaLabel: words.ctaLabel,
        translationStatus: "TRANSLATED",
        translatedBy: options.adminId ?? null,
      },
    });
    created += 1;
  }
  return created;
}

// Arabic labels for the seeded menus (ADR-166: Arabic is the first locale).
//
// Keyed by the ENGLISH label and title the seed writes, not by routeKey: one
// routeKey carries different words in different places (`learn-forex` is
// "Learn Forex" at the top of the header and "Courses" inside its panel), and
// the English is what a translator is translating. A label this map does not
// know simply has no Arabic row, and the menu falls back to English for it.
//
// `create`-only: a translation someone has since corrected is theirs, and a
// reseed must not put this file's wording back over it.
import type { PrismaClient } from "../src/generated/client/client.ts";

export const MENU_LABELS_AR: Readonly<Record<string, string>> = {
  "All learning": "كل الدروس",
  "All tools": "كل الأدوات",
  Analysis: "التحليلات",
  Correlation: "الارتباط",
  Courses: "الدورات",
  "Currency converter": "محوّل العملات",
  "Economic calendar": "المفكرة الاقتصادية",
  "Gain & loss calculator": "حاسبة الربح والخسارة النسبية",
  Glossary: "المصطلحات",
  "Learn Crypto": "تعلّم العملات المشفرة",
  "Learn Forex": "تعلّم الفوركس",
  "Live rates": "الأسعار المباشرة",
  "Margin calculator": "حاسبة الهامش",
  "Market analysis": "تحليل السوق",
  "Market hours": "ساعات السوق",
  "Market news": "أخبار السوق",
  News: "الأخبار",
  "News & Analysis": "الأخبار والتحليلات",
  "Pip calculator": "حاسبة النقطة",
  "Pivot points": "نقاط الارتكاز",
  "Position size calculator": "حاسبة حجم الصفقة",
  "Profit & loss calculator": "حاسبة الربح والخسارة",
  Quizzes: "الاختبارات",
  "Risk & reward calculator": "حاسبة المخاطرة والعائد",
  "Risk on / risk off": "الإقبال على المخاطرة / النفور منها",
  Sitemap: "خريطة الموقع",
  Support: "الدعم",
  Tools: "الأدوات",
  Videos: "الفيديوهات",
  Volatility: "التقلّب",
};

export const MENU_TITLES_AR: Readonly<Record<string, string>> = {
  "Both schools in one place": "المدرستان في مكان واحد",
  "Which pairs move together": "أي الأزواج تتحرك معًا",
  "Structured lessons, start to finish": "دروس منظّمة من البداية إلى النهاية",
  "And what a markup really costs": "وكم يكلّفك هامش السعر فعلًا",
  "What is scheduled, and when": "ما هو مُجدول، ومتى",
  "And what it takes to get back to even": "وما يلزم للعودة إلى نقطة التعادل",
  "Every term this school uses, explained": "كل مصطلح تستخدمه هذه المدرسة، مشروحًا",
  "Quotes for majors, minors, exotics and metals":
    "أسعار الأزواج الرئيسية والثانوية والنادرة والمعادن",
  "The deposit a position ties up": "المبلغ الذي تحجزه الصفقة من حسابك",
  "Which sessions are open right now": "أي الجلسات مفتوحة الآن",
  "Headlines from the major providers": "عناوين من كبرى جهات النشر",
  "What one pip is worth to you": "كم تساوي النقطة الواحدة بالنسبة لك",
  "Five methods, one table": "خمس طرق في جدول واحد",
  "How big a trade your risk allows": "ما حجم الصفقة الذي تسمح به مخاطرتك",
  "What a trade makes between two prices": "ما تحققه الصفقة بين سعرين",
  "Check what stuck, one topic at a time": "اختبر ما رسخ لديك، موضوعًا تلو الآخر",
  "Risk, reward and size from three prices": "المخاطرة والعائد والحجم من ثلاثة أسعار",
  "Where the market has been leaning": "إلى أين يميل السوق",
  "Short walkthroughs, one topic each": "شروحات قصيرة، موضوع واحد لكل منها",
  "How far each pair has been moving": "مدى تحرّك كل زوج",
};

/** Writes an Arabic row for every seeded English menu row the map covers. */
export async function seedArabicMenuLabels(db: PrismaClient): Promise<number> {
  const english = await db.menuItemTranslation.findMany({
    where: { locale: "en" },
    select: { menuItemId: true, label: true, title: true },
  });
  const existing = new Set(
    (
      await db.menuItemTranslation.findMany({
        where: { locale: "ar" },
        select: { menuItemId: true },
      })
    ).map((row) => row.menuItemId),
  );

  let created = 0;
  for (const row of english) {
    const label = MENU_LABELS_AR[row.label];
    if (!label || existing.has(row.menuItemId)) continue;
    await db.menuItemTranslation.create({
      data: {
        menuItemId: row.menuItemId,
        locale: "ar",
        label,
        title: row.title ? (MENU_TITLES_AR[row.title] ?? null) : null,
      },
    });
    created += 1;
  }
  return created;
}

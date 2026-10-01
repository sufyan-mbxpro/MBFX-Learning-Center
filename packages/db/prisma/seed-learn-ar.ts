// Arabic translations for the two demo courses (ADR-166: Arabic is the first
// locale).
//
// Both courses are translated WHOLE — course, every section, every lesson —
// because Arabic has no fallback locale (seed.ts, the locale block): a lesson
// with no Arabic row is not shown in English, it is "not translated", so a
// half-translated course would be a curriculum with holes in it.
// `arabic-seed.test.ts` fails when a demo lesson or section is missing here.
//
// Keyed by the ENGLISH course slug, section title and lesson slug — the
// section has no slug of its own (`slug_` in the seed is a label, not a
// column), so its English title is the key, the way `seed-menu-ar.ts` keys a
// menu row. Lesson and course rows KEEP the English slug, the same choice the
// translation engine makes. `create`-only; `sourceHash` stays NULL (unknown,
// ADR-161 #4) exactly as the English demo rows leave it.
import type { PrismaClient } from "../src/generated/client/client.ts";

export const DEMO_COURSES_AR: Readonly<Record<string, { title: string; summary: string }>> = {
  "forex-fundamentals": {
    title: "أساسيات الفوركس",
    summary: "كيف يعمل سوق العملات، وما الذي يحرّكه، وكيف تُنفَّذ الصفقة فعليًا.",
  },
  "crypto-foundations": {
    title: "أساسيات العملات المشفرة",
    summary: "ما الذي يفعله البلوك تشين فعلًا، وكيف تختلف أسواق العملات المشفرة عن الفوركس.",
  },
};

/** Keyed by the section's English title. */
export const DEMO_SECTIONS_AR: Readonly<Record<string, { title: string; description: string }>> = {
  "What Is Forex?": {
    title: "ما هو الفوركس؟",
    description: "السوق نفسه: من يتداول فيه، ومتى، ولماذا يتحرّك.",
  },
  "Reading a Chart": {
    title: "قراءة الرسم البياني",
    description: "تحويل سلسلة الأسعار إلى شيء يمكنك أن تبني عليه قرارًا.",
  },
  "Your First Trade": {
    title: "صفقتك الأولى",
    description: "الأوامر، والمخاطرة، وما تقرؤه بعد هذه الدورة.",
  },
  "How Blockchains Work": {
    title: "كيف يعمل البلوك تشين",
    description: "الآلية التي تحت السطح، بعيدًا عن التسويق.",
  },
  "Crypto Markets": {
    title: "أسواق العملات المشفرة",
    description: "أين تُتداول هذه الأصول، وكيف يختلف ذلك عن سوق الفوركس.",
  },
  "Staying Safe": {
    title: "البقاء في أمان",
    description: "الأخطاء التي تكلّف المبتدئين أكثر من غيرها.",
  },
};

export interface ArabicDemoLesson {
  title: string;
  summary: string;
  /** Absent where the English lesson has no body (the external-resource one). */
  content?: string;
}

/** Keyed by the lesson's English slug. */
export const DEMO_LESSONS_AR: Readonly<Record<string, ArabicDemoLesson>> = {
  "the-foreign-exchange-market": {
    title: "سوق الصرف الأجنبي",
    summary: "من يتداول العملات، ولماذا لا يُغلق السوق فعليًا تقريبًا.",
    content:
      "<p>سوق الصرف الأجنبي هو المكان الذي تُستبدل فيه عملة بأخرى. ليست له بورصة مركزية: إذ تتعامل البنوك والوسطاء والصناديق والشركات مع بعضها مباشرة، ولهذا يستمر التداول على مدار الساعة من مساء الأحد حتى مساء الجمعة.</p><h2>لماذا يتحرّك</h2><p>تتحرّك الأسعار لأن الطلب على عملة ما مقارنةً بأخرى يتغيّر، مدفوعًا بأسعار الفائدة والنمو وتدفّقات التجارة والتوقعات بشأنها جميعًا.</p>",
  },
  "currency-pairs-and-quotes": {
    title: "أزواج العملات وعروض الأسعار",
    summary: "قراءة EUR/USD، وما يعنيه السعران في عرض السعر.",
    content:
      "<p>تُسعَّر العملة دائمًا مقابل عملة أخرى، لذا فكل أداة هي <em>زوج</em>. في EUR/USD العملة الأولى هي عملة الأساس والثانية هي عملة التسعير: يخبرك السعر بعدد الدولارات الأمريكية التي يشتريها اليورو الواحد.</p><h2>سعر البيع وسعر الشراء</h2><p>يظهر لك سعران. سعر البيع (Bid) هو ما يمكنك البيع عنده، وسعر الشراء (Ask) هو ما يمكنك الشراء عنده، والفارق بينهما هو السبريد، أي تكلفة الدخول.</p>",
  },
  "pips-lots-and-leverage": {
    title: "النقاط واللوتات والرافعة المالية",
    summary: "الوحدات الثلاث التي تحدد قيمة حركة السعر بالنسبة لك.",
    content:
      "<p>النقطة (Pip) هي وحدة الحركة القياسية للزوج. واللوت هو حجم الصفقة. ومعًا يحددان قيمة النقطة الواحدة بالمال.</p><h2>الرافعة المالية سلاح ذو حدّين</h2><p>تتيح لك الرافعة المالية التحكم في صفقة أكبر بإيداع صغير. وهي تضاعف نتيجة الحركة في الاتجاهين، ولهذا يهمّ تحديد حجم الصفقة أكثر من توقيت الدخول بالنسبة لمعظم المتداولين الجدد.</p>",
  },
  "candlesticks-explained": {
    title: "شرح الشموع اليابانية",
    summary: "ما الذي تسجّله كل شمعة، وما الذي لا تسجّله.",
    content:
      "<p>تلخّص الشمعة أربعة أرقام لفترة ما: سعر الافتتاح والأعلى والأدنى والإغلاق. يمتد الجسم من الافتتاح إلى الإغلاق، وتصل الظلال إلى الطرفين.</p><p>تخبرك الشمعة إلى أين ذهب السعر، لا لماذا. تعامل مع النموذج على أنه وصف لما حدث، ولا تعتبره أبدًا تنبؤًا بمفرده.</p>",
  },
  "support-and-resistance": {
    title: "الدعم والمقاومة",
    summary: "لماذا تظل مستويات معيّنة مهمة، ومتى تتوقف عن ذلك.",
    content:
      "<p>الدعم مستوى ظهر عنده الشراء مرارًا، والمقاومة مستوى ظهر عنده البيع. وتكتسب أهميتها لأن عددًا كافيًا من المشاركين يتذكّرونها فيتصرّفون عندها من جديد.</p><p>المستويات مناطق وليست خطوطًا. والمستوى الذي يُكسر بوضوح كثيرًا ما يصبح بعد ذلك مستوى من النوع المعاكس.</p>",
  },
  "order-types": {
    title: "أنواع الأوامر",
    summary: "أمر السوق، والأمر المحدد، وأمر الإيقاف، ومتى تلجأ إلى كل منها.",
    content:
      "<p>يُنفَّذ أمر السوق فورًا بأفضل سعر متاح. ولا يُنفَّذ الأمر المحدد إلا عند سعرك أو بسعر أفضل. ويتحوّل أمر الإيقاف إلى أمر سوق بمجرد تداول السعر عند مستوى معيّن.</p><p>يجب أن يُرفق أمر إيقاف بكل صفقة قبل فتحها، لا بعده.</p>",
  },
  "risk-and-position-sizing": {
    title: "المخاطرة وتحديد حجم الصفقة",
    summary: "تحديد الحجم انطلاقًا من أمر الإيقاف، لا العكس.",
    content:
      "<p>قرّر أولًا كم يمكن لصفقة واحدة أن تخسر من الحساب. ثم قِس المسافة من نقطة الدخول إلى أمر الإيقاف. حجم الصفقة هو ما يجعل هذين الرقمين متوافقين.</p><h2>الترتيب مهم</h2><p>أن تحدد الحجم أولًا ثم تضع أمر الإيقاف حيثما يناسب ذلك الحجم هو الطريقة الأكثر شيوعًا التي تتوقف بها الخطة بهدوء عن أن تكون خطة.</p>",
  },
  "further-reading-bis-survey": {
    title: "قراءة إضافية: المسح الثلاثي لبنك التسويات الدولية",
    summary: "المصدر الأساسي لمعرفة الحجم الفعلي للسوق.",
  },
  "what-a-blockchain-is": {
    title: "ما هو البلوك تشين",
    summary: "سجلّ مشترك لا يديره أحد بعينه.",
    content:
      "<p>البلوك تشين سجلّ منسوخ على أجهزة كثيرة مستقلة، تُضاف إليه الإدخالات الجديدة على دفعات، وترتبط كل دفعة بالدفعة التي سبقتها.</p><p>الخاصية المفيدة ليست السرية، فمعظمها علني بالكامل، بل أن أي مشارك منفرد لا يستطيع إعادة كتابة التاريخ خِفية.</p>",
  },
  "wallets-keys-and-custody": {
    title: "المحافظ والمفاتيح والحفظ",
    summary: "من يتحكم فعليًا في الرصيد، وما الذي يكلّفك ذلك.",
    content:
      "<p>المحفظة تخزّن المفاتيح، لا العملات. والمفتاح الخاص هو ما يأذن بالإنفاق، لذا فمن يملكه يتحكم في الرصيد.</p><h2>الحفظ خيار حقيقي</h2><p>الاحتفاظ بمفاتيحك بنفسك يزيل مخاطر الطرف المقابل ويضيف مخاطر أن تفقدها. وليس أيٌّ من الخيارين هو الآمن تلقائيًا.</p>",
  },
  "exchanges-and-liquidity": {
    title: "منصات التداول والسيولة",
    summary: "لماذا يظهر الأصل نفسه بأسعار مختلفة في أماكن مختلفة.",
    content:
      "<p>تُتداول العملات المشفرة على منصات كثيرة في الوقت نفسه، لكل منها دفتر أوامرها الخاص. وتتقارب الأسعار عبر المراجحة لكنها نادرًا ما تتطابق تمامًا.</p><p>الدفاتر الضعيفة تتحرك أكثر مع حجم الأمر نفسه، ولهذا تهمّ السيولة أكثر من حجم التداول المعلن.</p>",
  },
  "volatility-and-position-sizing": {
    title: "التقلّب وتحديد حجم الصفقة",
    summary: "تطبيق درس المخاطرة في الفوركس على نطاق أوسع بكثير.",
    content:
      "<p>حساب الحجم مطابق لما في الفوركس، والمسافات وحدها هي التي تتغير. وأمر الإيقاف الموضوع على مسافة معتادة في الفوركس يقع عادةً داخل النطاق اليومي العادي لزوج من العملات المشفرة.</p><p>حدّد الحجم بناءً على تقلّب الأداة نفسها، لا على عادة اكتسبتها من أداة أخرى.</p>",
  },
  "common-scams-and-red-flags": {
    title: "عمليات الاحتيال الشائعة وعلامات التحذير",
    summary: "الأنماط الكامنة وراء معظم الخسائر التي كان يمكن تجنّبها.",
    content:
      "<p>العوائد المضمونة، والاستعجال، وطلب نقل الأموال خارج المنصة هي العلامات الثلاث الموجودة في معظم عمليات الاحتيال في العملات المشفرة.</p><p>لا تحتاج أي خدمة مشروعة إلى مفتاحك الخاص أو عبارة الاسترداد. ولا استثناء لهذه الجملة.</p>",
  },
};

/** Writes Arabic course, section and lesson rows. Returns `{ courses, lessons }` created. */
export async function seedArabicDemoCourses(
  db: PrismaClient,
): Promise<{ courses: number; lessons: number }> {
  let courses = 0;
  let lessons = 0;

  for (const [slug, course] of Object.entries(DEMO_COURSES_AR)) {
    const english = await db.courseTranslation.findUnique({
      where: { locale_slug: { locale: "en", slug } },
      select: { courseId: true },
    });
    if (!english) continue;
    const { courseId } = english;

    const taken = await db.courseTranslation.findFirst({
      where: { locale: "ar", OR: [{ courseId }, { slug }] },
      select: { id: true },
    });
    if (!taken) {
      await db.courseTranslation.create({
        data: {
          courseId,
          locale: "ar",
          title: course.title,
          slug,
          summary: course.summary,
          translationStatus: "TRANSLATED",
        },
      });
      courses += 1;
    }

    const sections = await db.courseSectionTranslation.findMany({
      where: { locale: "en", section: { courseId } },
      select: { sectionId: true, title: true },
    });
    for (const section of sections) {
      const arabic = DEMO_SECTIONS_AR[section.title];
      if (!arabic) continue;
      await db.courseSectionTranslation.upsert({
        where: { sectionId_locale: { sectionId: section.sectionId, locale: "ar" } },
        update: {},
        create: {
          sectionId: section.sectionId,
          locale: "ar",
          title: arabic.title,
          description: arabic.description,
        },
      });
    }

    const lessonRows = await db.lessonTranslation.findMany({
      where: { locale: "en", lesson: { section: { courseId } } },
      select: { lessonId: true, slug: true },
    });
    for (const row of lessonRows) {
      const arabic = DEMO_LESSONS_AR[row.slug];
      if (!arabic) continue;
      const lessonTaken = await db.lessonTranslation.findFirst({
        where: { locale: "ar", OR: [{ lessonId: row.lessonId }, { slug: row.slug }] },
        select: { id: true },
      });
      if (lessonTaken) continue;
      await db.lessonTranslation.create({
        data: {
          lessonId: row.lessonId,
          locale: "ar",
          title: arabic.title,
          slug: row.slug,
          summary: arabic.summary,
          content: arabic.content ?? null,
          translationStatus: "TRANSLATED",
        },
      });
      lessons += 1;
    }
  }

  return { courses, lessons };
}

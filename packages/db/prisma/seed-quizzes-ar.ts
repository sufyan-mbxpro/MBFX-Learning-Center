// Arabic translations for the two demo quizzes (ADR-166: Arabic is the first
// locale).
//
// Keyed by the ENGLISH quiz slug; the Arabic row keeps that slug (ADR-181).
// Questions are matched by POSITION, because a question has no key of its own
// and `correctAnswer` is an index into `options` (ADR-058 #2): an option
// list here is the English one in the same order, never re-sorted. A question
// whose English options no longer line up (an editor added or removed one) is
// skipped rather than given labels that point at the wrong answer.
//
// `create`-only; `sourceHash` stays NULL (unknown, ADR-161 #4).
import type { PrismaClient } from "../src/generated/client/client.ts";

export interface ArabicQuizQuestion {
  prompt: string;
  options: string[];
  explanations: string[];
}

export interface ArabicQuiz {
  title: string;
  description: string;
  questions: ArabicQuizQuestion[];
}

export const DEMO_QUIZZES_AR: Readonly<Record<string, ArabicQuiz>> = {
  "forex-basics-check": {
    title: "أساسيات الفوركس: اختبار سريع",
    description: "ستة أسئلة عن المصطلحات التي تفترضها الدورة الأولى. لا يوجد هنا أي سؤال خادع.",
    questions: [
      {
        prompt: "ما الذي يخبرك به عرض سعر زوج العملات فعليًا؟",
        options: [
          "كم من عملة التسعير تشتري الوحدة الواحدة من عملة الأساس",
          "إجمالي حجم التداول اليومي بتلك العملة",
          "فارق سعر الفائدة بين البلدين",
          "عدد الوسطاء الذين يعرضون ذلك الزوج",
        ],
        explanations: [
          "سعر EUR/USD عند 1.08 يعني أن اليورو الواحد يشتري 1.08 دولار. عملة الأساس أولًا، ثم عملة التسعير.",
          "",
          "هذا هو العائد على الفارق (Carry)، وهو يؤثر في تكلفة الاحتفاظ بالزوج لكنه ليس عرض السعر.",
          "",
        ],
      },
      {
        prompt: "النقطة (Pip) لها الحجم نفسه في كل أزواج العملات.",
        options: ["صحيح", "خطأ"],
        explanations: [
          "",
          "تتحرك معظم الأزواج بخطوات قدرها 0.0001، لكن أزواج الين الياباني تُسعَّر بمنزلتين عشريتين، فالنقطة فيها 0.01.",
        ],
      },
      {
        prompt: "الرافعة المالية 1:30 تعني…",
        options: [
          "أرباحك تتضاعف 30 مرة وخسائرك لا تتضاعف",
          "يمكنك التحكم في صفقة تبلغ 30 ضعف إيداعك، والخسائر تتضاعف معها",
          "الوسيط يدفع 30% من أي خسارة",
          "يمكنك الاحتفاظ بالصفقة لمدة 30 يومًا",
        ],
        explanations: [
          "الرافعة المالية متماثلة في الاتجاهين. وأي شيء يدّعي خلاف ذلك يحاول أن يبيعك شيئًا.",
          "حجم الصفقة يتضاعف، وكذلك كل نقطة تتحرك ضدك.",
          "",
          "",
        ],
      },
      {
        prompt: "أيٌّ مما يلي من تكاليف الاحتفاظ بصفقة برافعة مالية حتى اليوم التالي؟",
        options: [
          "السبريد الذي دفعته عند الدخول",
          "تمويل المبيت (السواب)",
          "رسم على الإغلاق بربح",
          "الانزلاق السعري إذا حدثت فجوة في السوق",
        ],
        explanations: [
          "تكلفة حقيقية، لكنها تُدفع عند الدخول لا مقابل الاحتفاظ.",
          "يُخصم أو يُضاف عن كل ليلة تبقى فيها الصفقة مفتوحة.",
          "لا يوجد شيء كهذا. إذا فرضه وسيط فهو جزء من المنتج، لا من السوق.",
          "قد تؤدي الفجوة إلى تنفيذ أمر الإيقاف بسعر أسوأ من الذي حددته.",
        ],
      },
      {
        prompt: "يضمن أمر وقف الخسارة خروجك عند سعر الإيقاف بالضبط.",
        options: ["صحيح", "خطأ"],
        explanations: [
          "",
          "يتحول إلى أمر سوق عند ملامسة السعر. وفي حال حدوث فجوة يُنفَّذ بأول سعر متاح بعدها.",
        ],
      },
      {
        prompt: "سوق الفوركس مفتوح 24 ساعة في اليوم لأن…",
        options: [
          "هناك بورصة عالمية واحدة لا تُغلق أبدًا",
          "التداول ينتقل بين المراكز المالية حول العالم",
          "الوسطاء يحتفظون بالأوامر ليلًا وينفذونها صباحًا",
          "البنوك المركزية تعمل على مدار الساعة",
        ],
        explanations: [
          "لا توجد بورصة مركزية أصلًا، وهذا هو جوهر الأمر.",
          "سيدني، ثم طوكيو، ثم لندن، ثم نيويورك. وهذا التسليم هو سبب تفاوت السيولة بحسب الساعة.",
          "",
          "",
        ],
      },
    ],
  },
  "crypto-basics-check": {
    title: "أساسيات العملات المشفرة: اختبار سريع",
    description: "ثلاثة أسئلة عن المصطلحات التي تفترضها دورة العملات المشفرة.",
    questions: [
      {
        prompt: "ما الذي يخزّنه البلوك تشين فعليًا؟",
        options: [
          "سجلًّا مرتبًا للمعاملات لا يُضاف إليه إلا في آخره",
          "الرصيد الحالي لكل محفظة، ولا شيء غيره",
          "نسخة من وثائق هوية كل مستخدم",
          "تاريخ أسعار الأصل",
        ],
        explanations: [
          "الأرصدة تُستنتَج بإعادة تشغيل السجل، والسجل نفسه هو دفتر الحسابات.",
          "الأرصدة تُحسب من التاريخ، ولا تُخزَّن بدلًا منه.",
          "",
          "الأسعار موجودة على منصات التداول، وهي ليست السلسلة نفسها.",
        ],
      },
      {
        prompt: "يمكن للمرسِل إلغاء معاملة تم تأكيدها على السلسلة.",
        options: ["صحيح", "خطأ"],
        explanations: ["", "التسوية نهائية. ولا يُسترد التحويل الخاطئ إلا إذا أعاده المستلم."],
      },
      {
        prompt: "ما هو المفتاح الخاص؟",
        options: [
          "السرّ الذي يأذن بالإنفاق من عنوان ما",
          "العنوان الذي يرسل إليه الآخرون الأموال",
          "كلمة مرور تحتفظ بها منصة التداول نيابةً عنك",
          "نسخة احتياطية من البلوك تشين",
        ],
        explanations: [
          "من يملكه يستطيع إنفاق الأموال، وهذا هو الحفظ الذاتي بأكمله.",
          "هذا هو العنوان العام، ومشاركته آمنة.",
          "هذا حساب حفظ لدى طرف ثالث، حيث تحتفظ المنصة بالمفتاح بدلًا منك.",
          "",
        ],
      },
    ],
  },
};

/** Writes Arabic quiz and question rows. Returns how many QUIZ rows it created. */
export async function seedArabicDemoQuizzes(db: PrismaClient): Promise<number> {
  let created = 0;
  for (const [slug, arabic] of Object.entries(DEMO_QUIZZES_AR)) {
    const english = await db.quizTranslation.findUnique({
      where: { locale_slug: { locale: "en", slug } },
      select: { quizId: true },
    });
    if (!english) continue;
    const { quizId } = english;

    const taken = await db.quizTranslation.findFirst({
      where: { locale: "ar", OR: [{ quizId }, { slug }] },
      select: { id: true },
    });
    if (!taken) {
      await db.quizTranslation.create({
        data: {
          quizId,
          locale: "ar",
          title: arabic.title,
          slug,
          description: arabic.description,
          translationStatus: "TRANSLATED",
        },
      });
      created += 1;
    }

    const questions = await db.quizQuestion.findMany({
      where: { quizId },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        translations: {
          where: { locale: { in: ["en", "ar"] } },
          select: { locale: true, options: true },
        },
      },
    });
    for (const [index, question] of questions.entries()) {
      const words = arabic.questions[index];
      if (!words) continue;
      if (question.translations.some((t) => t.locale === "ar")) continue;
      const englishOptions = question.translations.find((t) => t.locale === "en")?.options;
      if (!Array.isArray(englishOptions) || englishOptions.length !== words.options.length)
        continue;
      await db.quizQuestionTranslation.create({
        data: {
          questionId: question.id,
          locale: "ar",
          prompt: words.prompt,
          options: words.options,
          explanations: words.explanations,
          translationStatus: "TRANSLATED",
        },
      });
    }
  }
  return created;
}

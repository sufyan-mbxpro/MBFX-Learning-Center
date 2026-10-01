// Arabic translations for part of the seeded News & Analysis corpus (ADR-166:
// Arabic is the first locale).
//
// SIX of the twelve `seed-articles.ts` pieces, chosen so an Arabic reader sees
// every surface: both featured stories (the spotlight), two `/news` pieces,
// two `/analysis` pieces and the one trade idea. The rest of the corpus stays
// English-only on purpose — Arabic has no fallback locale (an RTL page of
// English prose reads worse than a "not translated" notice), so the untouched
// six also exercise that state.
//
// The same rules as the English corpus: illustrative, never reportage, no
// real person quoted. Every link and heading in a body matches its English
// source one for one (`arabic-seed.test.ts`).
//
// Keyed by the ENGLISH slug, and the Arabic row KEEPS that slug — the same
// choice `translateArticleJob` makes, so a seeded translation and a machine
// one have the same address shape. `create`-only, `sourceHash` NULL (unknown,
// ADR-161 #4), status `TRANSLATED` because a person wrote these words.
import type { PrismaClient } from "../src/generated/client/client.ts";

export interface ArabicSeedArticle {
  /** The English translation slug this row translates. */
  slug: string;
  title: string;
  excerpt: string;
  body: string[];
  seoTitle: string;
  seoDescription: string;
  focusKeywords: string;
  faq?: { question: string; answer: string }[];
}

/** Keyed by the seeded English category slug. */
export const ARTICLE_CATEGORY_NAMES_AR: Readonly<Record<string, string>> = {
  "market-news": "أخبار السوق",
  "central-banks": "البنوك المركزية",
  "technical-analysis": "التحليل الفني",
  "trade-ideas": "أفكار التداول",
};

/** Keyed by the seeded English tag slug. A currency pair is a symbol, not a word. */
export const ARTICLE_TAG_NAMES_AR: Readonly<Record<string, string>> = {
  "eur-usd": "EUR/USD",
  "gbp-usd": "GBP/USD",
  "usd-jpy": "USD/JPY",
  gold: "الذهب",
  "crude-oil": "النفط الخام",
  fed: "الاحتياطي الفيدرالي",
  ecb: "البنك المركزي الأوروبي",
};

export const SEED_ARTICLES_AR: ArabicSeedArticle[] = [
  {
    slug: "what-a-european-rate-decision-does-to-eur-usd",
    title: "ما الذي يفعله قرار الفائدة الأوروبي فعلًا بزوج EUR/USD",
    excerpt:
      "تحرّك قرارات الفائدة العملات من خلال ما يقوله الرقم عن الأشهر الستة المقبلة أكثر مما تحرّكها من خلال الرقم نفسه. إليك كيف تقرأ قرارًا منها.",
    body: [
      "<h2>نادرًا ما يكون القرار هو المفاجأة</h2>",
      "<p>حين يعلن البنك المركزي سعر الفائدة، تكون السوق في العادة قد سعّرت النتيجة الأرجح. ما يحرّك الزوج هو المسافة بين المتوقَّع وما تحقق فعلًا، وأكثر من ذلك اللغة التي تأتي معه.</p>",
      "<h2>ثلاثة أشياء تُقرأ بالترتيب</h2>",
      "<p>أولًا، سعر الفائدة نفسه مقارنةً بالتوقعات العامة. ثانيًا، وصف البيان للتضخم والنمو. ثالثًا، المؤتمر الصحفي، حيث يمكن لكلمة واحدة أن تقلب نبرة البيان.</p>",
      "<h3>لماذا قد تنعكس ردة الفعل</h3>",
      "<p>كثيرًا ما تتلاشى الحركة الأولى على الرقم الرئيسي بعد قراءة البيان كاملًا. هذا أمر طبيعي، ولهذا يهمّ تحديد حجم الصفقة حول الأحداث المجدولة أكثر من الاتجاه.</p>",
      "<h2>الخلاصة العملية</h2>",
      '<p>راجع <a href="/economic-calendar">المفكرة الاقتصادية</a> قبل أن تحدد حجم صفقتك. الزوج الذي ترتاح للاحتفاظ به خلال جلسة هادئة يصبح أداة مختلفة في الدقائق العشر التي تلي القرار.</p>',
    ],
    seoTitle: "كيف يحرّك قرار الفائدة الأوروبي زوج EUR/USD",
    seoDescription:
      "تحرّك قرارات الفائدة زوج EUR/USD عبر التوقعات لا الرقم الرئيسي. كيف تقرأ البيان والمؤتمر الصحفي وردة الفعل التي تليهما.",
    focusKeywords:
      "قرار الفائدة EUR/USD, قرار البنك المركزي الأوروبي فوركس, البنوك المركزية والفوركس",
    faq: [
      {
        question: "هل يجب أن أتداول خلال قرار الفائدة؟",
        answer:
          "<p>تتسع فروق الأسعار ويُرجَّح حدوث انزلاق سعري في الدقائق المحيطة بالقرار المجدول. ويفضّل كثير من المتداولين تقليص الحجم أو البقاء خارج السوق بدلًا من قبول مخاطر تنفيذ لا يستطيعون قياسها.</p>",
      },
      {
        question: "لماذا تحرّك الزوج عكس اتجاه سعر الفائدة؟",
        answer:
          "<p>لأن سعر الفائدة كان متوقعًا أما التوجيه فلم يكن كذلك. فالسوق تتداول المسار المستقبلي للسياسة النقدية، وهو ما يصفه البيان والمؤتمر الصحفي.</p>",
      },
    ],
  },
  {
    slug: "why-gold-and-the-dollar-move-in-opposite-directions",
    title: "لماذا يتحرك الذهب والدولار عادةً في اتجاهين متعاكسين",
    excerpt:
      "يُسعَّر الذهب بالدولار، لذا فإن قوة الدولار تجعل الأونصة نفسها أغلى في كل مكان آخر. العلاقة حقيقية، لكنها تنكسر أكثر مما يتوقع الناس.",
    body: [
      "<h2>الجانب الآلي</h2>",
      "<p>يُسعَّر الذهب بالدولار الأمريكي. فحين يقوى الدولار أمام العملات الأخرى، تصبح الأونصة نفسها أغلى على كل من يحمل تلك العملات، فيضعف الطلب. هذه هي العلاقة العكسية في أبسط صورها.</p>",
      "<h2>الجانب الذي ينكسر</h2>",
      "<p>في موجات النفور الواسع من المخاطرة، قد يرتفع الدولار والذهب معًا: يُشترى الأول طلبًا للسيولة، والثاني طلبًا للأمان. والمتداول الذي يعامل الارتباط كقاعدة لا كميل عام يقع في الفخ في هذه الأسابيع تحديدًا.</p>",
      "<h2>كيف تستخدمها</h2>",
      '<p>تعامل مع العلاقة كسياق لا كإشارة. تُظهر <a href="/tools">أداة الارتباط</a> لدينا كيف تتغير قوة العلاقة عبر فترات زمنية مختلفة.</p>',
    ],
    seoTitle: "الذهب والدولار الأمريكي: لماذا يتحركان في اتجاهين متعاكسين",
    seoDescription:
      "يُسعَّر الذهب بالدولار، ولهذا يتحرك الاثنان عادةً بشكل عكسي، ولهذا أيضًا تنكسر العلاقة في فترات النفور من المخاطرة.",
    focusKeywords: "ارتباط الذهب والدولار, العلاقة العكسية بين الذهب والدولار, XAU/USD",
  },
  {
    slug: "forward-guidance-and-why-wording-changes-move-markets",
    title: "التوجيه المستقبلي، ولماذا تحرّك تغييرات الصياغة الأسواق",
    excerpt:
      "تخبر البنوك المركزية الأسواق بما تنوي فعله لاحقًا. والمتداولون يقرؤون الجملة التي تغيّرت، لا الجمل التي بقيت كما هي.",
    body: [
      "<h2>التوجيه التزام له مخرج</h2>",
      "<p>يصف التوجيه المستقبلي ما يتوقع البنك المركزي أن يفعله إذا سار الاقتصاد وفق التوقعات. وهو مشروط عن قصد، وهذا ما يتيح سحبه دون أن يُعدّ ذلك نقضًا له.</p>",
      "<h2>الفرق هو الخبر</h2>",
      "<p>يقارن القرّاء المتمرسون البيان بسابقه كلمةً بكلمة. وصفة محذوفة أو جملة أُعيد ترتيبها كثيرًا ما تعني للسوق أكثر من أي رقم في الإصدار.</p>",
      "<h3>مثال على هذا النمط</h3>",
      "<p>البيان الذي يتوقف عن وصف السياسة النقدية بأنها تيسيرية قد قال شيئًا عن الاجتماع المقبل دون أن يعلن شيئًا عن هذا الاجتماع.</p>",
      "<h2>أين يخطئ المبتدئون</h2>",
      "<p>في تداول العنوان الرئيسي وتجاهل البيان. العنوان هو القرار، والبيان هو الاتجاه.</p>",
    ],
    seoTitle: "شرح التوجيه المستقبلي للمتداولين",
    seoDescription:
      "لماذا يحرّك تغيير في صياغة بيان البنك المركزي العملات أكثر من قرار الفائدة نفسه.",
    focusKeywords:
      "التوجيه المستقبلي, تداول بيانات البنوك المركزية, توجيه الاحتياطي الفيدرالي والفوركس",
    faq: [
      {
        question: "ما هو التوجيه المستقبلي؟",
        answer:
          "<p>وصف البنك المركزي لمسار السياسة النقدية الذي يتوقع اتباعه إذا تطوّر الاقتصاد وفق التوقعات. وهو مشروط بطبيعته.</p>",
      },
    ],
  },
  {
    slug: "support-and-resistance-are-zones-not-lines",
    title: "الدعم والمقاومة مناطق وليست خطوطًا",
    excerpt:
      "رسم المستوى بدقة النقطة الواحدة يخلق دقة زائفة وأمر إيقاف يضربه الضجيج. المستويات مناطق تغيّر فيها سلوك السوق.",
    body: [
      "<h2>لماذا الخط خاطئ</h2>",
      "<p>يحدد المستوى منطقة تدخّل فيها المشترون أو البائعون سابقًا. ولهذه المنطقة عرض، غالبًا عشرات النقاط، لأن المشاركين الذين تصرّفوا لم يتصرّفوا جميعًا عند سعر واحد.</p>",
      "<h2>بناء المنطقة</h2>",
      "<p>استخدم نطاق الظلال والأجسام حول ردة الفعل بدلًا من سعر إغلاق واحد. المنطقة هي ما دافع عنه السوق، لا السعر الدقيق الذي سجّله.</p>",
      "<h3>أين يوضع أمر الإيقاف</h3>",
      "<p>خارج المنطقة، لا داخلها. فأمر الإيقاف الموضوع عند الخط موضوع في وسط الضجيج الذي تصفه المنطقة.</p>",
      "<h2>متى تتوقف المنطقة عن العمل</h2>",
      "<p>بعد أن يُتداول عبرها بوضوح ثم يُعاد اختبارها من الجهة الأخرى. عندها تصبح مستوى مختلفًا بمعنى مختلف.</p>",
    ],
    seoTitle: "مناطق الدعم والمقاومة، لا خطوطها",
    seoDescription:
      "لماذا تكون مستويات الدعم والمقاومة مناطق لا أسعارًا دقيقة، وكيف ترسم المنطقة، وأين يوضع أمر الإيقاف.",
    focusKeywords: "الدعم والمقاومة, مناطق العرض والطلب, المستويات الفنية",
    faq: [
      {
        question: "ما العرض المناسب للمنطقة؟",
        answer:
          "<p>عرض يكفي لاحتواء ردة الفعل التي صنعتها. على الرسم اليومي لزوج رئيسي يكون ذلك غالبًا بين 20 و50 نقطة، وعلى الرسم اللحظي يكون أصغر.</p>",
      },
    ],
  },
  {
    slug: "volatility-is-a-position-sizing-input-not-a-signal",
    title: "التقلّب مُدخل لتحديد حجم الصفقة، لا إشارة",
    excerpt:
      "مسافة الإيقاف نفسها تعني مخاطرتين مختلفتين في أسبوع هادئ وآخر عنيف. وتحديد الحجم وفق التقلّب يُبقي المخاطرة ثابتة بدلًا من حجم اللوت.",
    body: [
      "<h2>مشكلة حجم اللوت الثابت</h2>",
      "<p>الحجم الثابت في سوق تضاعف نطاقه اليومي هو مخاطرة مضاعفة لم يقرّر أحد تحمّلها.</p>",
      "<h2>تحديد الحجم وفق النطاق</h2>",
      "<p>ضع أمر الإيقاف بناءً على النطاق الأخير للأداة، ثم استخرج الحجم من مخاطرة الحساب وتلك المسافة. تبقى المخاطرة حيث حددتها، ويتحرك الحجم بدلًا منها.</p>",
      "<h3>إجراء الحساب</h3>",
      '<p>حجم الصفقة يساوي مخاطرة الحساب مقسومة على مسافة الإيقاف بالقيمة النقدية. وتجري <a href="/tools">حاسبة حجم الصفقة</a> هذا الحساب لكل أداة.</p>',
      "<h2>ما لا يخبرك به هذا</h2>",
      "<p>لا شيء عن الاتجاه. ارتفاع التقلّب سبب لتصغير الحجم، لا سبب للبيع.</p>",
    ],
    seoTitle: "تحديد حجم الصفقة وفق التقلّب",
    seoDescription:
      "تحديد الحجم وفق النطاق الأخير للأداة يُبقي المخاطرة ثابتة عندما يتغير التقلّب. لماذا التقلّب مُدخل وليس إشارة.",
    focusKeywords: "حجم الصفقة والتقلّب, حجم الصفقة بمؤشر ATR, المخاطرة لكل صفقة",
  },
  {
    slug: "how-to-write-a-trade-plan-you-will-actually-follow",
    title: "كيف تكتب خطة تداول ستلتزم بها فعلًا",
    excerpt:
      "الخطة التي تقول فقط ماذا تشتري ليست خطة. والأجزاء التي تُهمَل هي شرط الإبطال والخروج.",
    body: [
      "<h2>أربعة أسطر قبل فتح الصفقة</h2>",
      "<p>الفكرة، وشرط الإبطال، والحجم، وما الذي يجعلك تخرج مبكرًا. مكتوبة قبل الدخول، وبهذا الترتيب.</p>",
      "<h2>شرط الإبطال ليس أمر الإيقاف</h2>",
      "<p>أمر الإيقاف هو المكان الذي تخرج عنده. أما شرط الإبطال فهو الظرف الذي يجعل الفكرة خاطئة، وكثيرًا ما يتحقق قبل الوصول إلى الإيقاف، وهو سبب الإغلاق المبكر بدلًا من الانتظار.</p>",
      "<h2>مراجعتها بعد ذلك</h2>",
      "<p>قيّم الخطة، لا النتيجة. الخطة الجيدة التي خسرت قابلة للتكرار، والخطة السيئة التي ربحت ليست كذلك.</p>",
    ],
    seoTitle: "كتابة خطة تداول ستلتزم بها",
    seoDescription:
      "أربعة أسطر تُكتب قبل الدخول: الفكرة، وشرط الإبطال، والحجم، والخروج المبكر. لماذا شرط الإبطال ليس أمر الإيقاف.",
    focusKeywords: "خطة التداول, نموذج خطة تداول, سجل التداول",
  },
];

/**
 * Writes the Arabic category and tag names, then the Arabic article rows.
 * Returns how many ARTICLE rows it created.
 */
export async function seedArabicArticles(db: PrismaClient): Promise<number> {
  for (const [slug, name] of Object.entries(ARTICLE_CATEGORY_NAMES_AR)) {
    const english = await db.articleCategoryTranslation.findFirst({
      where: { locale: "en", slug },
      select: { categoryId: true },
    });
    if (!english) continue;
    const taken = await db.articleCategoryTranslation.findFirst({
      where: { locale: "ar", OR: [{ categoryId: english.categoryId }, { slug }] },
      select: { id: true },
    });
    if (taken) continue;
    await db.articleCategoryTranslation.create({
      data: { categoryId: english.categoryId, locale: "ar", name, slug },
    });
  }

  for (const [slug, name] of Object.entries(ARTICLE_TAG_NAMES_AR)) {
    const english = await db.articleTagTranslation.findUnique({
      where: { locale_slug: { locale: "en", slug } },
      select: { tagId: true },
    });
    if (!english) continue;
    const taken = await db.articleTagTranslation.findFirst({
      where: { locale: "ar", OR: [{ tagId: english.tagId }, { slug }] },
      select: { id: true },
    });
    if (taken) continue;
    await db.articleTagTranslation.create({
      data: { tagId: english.tagId, locale: "ar", name, slug },
    });
  }

  let created = 0;
  for (const article of SEED_ARTICLES_AR) {
    const english = await db.articleTranslation.findUnique({
      where: { locale_slug: { locale: "en", slug: article.slug } },
      select: { articleId: true },
    });
    if (!english) continue;
    // Either an Arabic row already exists for this article (someone's edit is
    // theirs), or another article holds the slug in Arabic — both mean leave it.
    const taken = await db.articleTranslation.findFirst({
      where: { locale: "ar", OR: [{ articleId: english.articleId }, { slug: article.slug }] },
      select: { id: true },
    });
    if (taken) continue;

    await db.articleTranslation.create({
      data: {
        articleId: english.articleId,
        locale: "ar",
        title: article.title,
        slug: article.slug,
        excerpt: article.excerpt,
        body: article.body.join(""),
        seoTitle: article.seoTitle,
        seoDescription: article.seoDescription,
        focusKeywords: article.focusKeywords,
        twitterCard: "summary_large_image",
        translationStatus: "TRANSLATED",
        ...(article.faq
          ? {
              faqItems: {
                create: article.faq.map((item, index) => ({
                  sortOrder: index,
                  question: item.question,
                  answer: item.answer,
                })),
              },
            }
          : {}),
      },
    });
    created += 1;
  }
  return created;
}

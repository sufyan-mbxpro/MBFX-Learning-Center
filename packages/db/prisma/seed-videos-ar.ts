// Arabic translations for the demo video categories and topics (ADR-166:
// Arabic is the first locale).
//
// Keyed by the ENGLISH slug; the Arabic row keeps that slug (ADR-181). A
// topic's link labels go on its translation row as an English-keyed map
// (`VideoTopicTranslation.linkLabels`, ADR-161 #8), because `saveVideoTopic`
// recreates the link rows on every save and an id would not survive it.
//
// `create`-only; `sourceHash` stays NULL (unknown, ADR-161 #4).
import type { PrismaClient } from "../src/generated/client/client.ts";

export interface ArabicVideoTopic {
  title: string;
  summary: string;
  content: string;
  /** English link label → Arabic label. */
  linkLabels?: Readonly<Record<string, string>>;
}

/** Keyed by the English category slug. */
export const VIDEO_CATEGORIES_AR: Readonly<Record<string, { name: string; description: string }>> =
  {
    "getting-started": {
      name: "البداية",
      description: "شروحات قصيرة لمتداول يفتح رسمه البياني الأول.",
    },
    "strategy-and-analysis": {
      name: "الاستراتيجية والتحليل",
      description: "جلسات أطول عن قراءة السوق وبناء خطة حولها.",
    },
  };

/** Keyed by the English topic slug. */
export const VIDEO_TOPICS_AR: Readonly<Record<string, ArabicVideoTopic>> = {
  "reading-your-first-candlestick-chart": {
    title: "قراءة أول رسم بياني بالشموع اليابانية",
    summary: "ما الذي يخبرك به جسم الشمعة وظلالها ولونها فعلًا عن فترة من التداول.",
    content:
      "<p>تختصر الشمعة اليابانية أربعة أرقام في شكل واحد: أين افتُتحت الفترة، وأين أُغلقت، وأعلى وأدنى سعر جرى التداول عنده بينهما. يمتد الجسم من الافتتاح إلى الإغلاق، وتمتد الظلال إلى الطرفين.</p><p>هذه هي المفردات كلها. وكل ما عدا ذلك، من النماذج المسمّاة إلى التشكيلات متعددة الشموع، يصف كيف تتجاور عدة أشكال من هذا النوع، ولا يعني أيٌّ منه الكثير دون سياق المستوى الذي يتشكّل عنده.</p>",
    linkLabels: {
      "Candlestick in the glossary": "الشمعة اليابانية في المسرد",
      "Browse forex courses": "تصفّح دورات الفوركس",
    },
  },
  "placing-a-stop-loss-that-survives-noise": {
    title: "وضع أمر وقف خسارة يصمد أمام التذبذب",
    summary:
      "لماذا يُضرب أمر الإيقاف الموضوع عند رقم مستدير، وكيف تحدد حجم الصفقة حول أمر إيقاف منطقي بدلًا من ذلك.",
    content:
      "<p>توضع معظم أوامر الإيقاف حيث يكون ذلك مريحًا لا حيث يكون ذا معنى: عند رقم مستدير، أو على مسافة ثابتة بالنقاط، أو حيثما يُبقي حجم الصفقة الذي أراده المتداول مسبقًا. والخيارات الثلاثة كلها تضع أمر الإيقاف تمامًا حيث يصل التقلّب العادي.</p><p>الترتيب الصحيح هو العكس: حدّد أين تصبح فكرتك خاطئة، وضع أمر الإيقاف هناك، ودع تلك المسافة وميزانية المخاطرة لديك تحددان حجم الصفقة. الحجم هو الناتج، لا المُدخَل.</p>",
    linkLabels: {
      "Stop loss in the glossary": "وقف الخسارة في المسرد",
      "Position size calculator": "حاسبة حجم الصفقة",
    },
  },
  "building-a-weekly-trading-plan": {
    title: "بناء خطة تداول أسبوعية",
    summary:
      "روتين قابل للتكرار: المستويات المهمة، والبيانات المدرجة في التقويم، وما الذي يجعلك تبقى خارج السوق.",
    content:
      "<p>الخطة التي تُكتب بعد بدء الأسبوع ليست إلا تعليقًا متواصلًا على ما يجري. أما إذا كُتبت قبله، فإن الملاحظات نفسها تصبح مُرشِّحًا: تحدد مسبقًا الفرص التي ترغب في اقتناصها وتلك التي لا ترغب فيها، في لحظة لا يكون فيها شيء على المحك.</p><p>ثلاثة أشياء تنتمي إليها: المستويات التي ستتداول حولها، والإصدارات المجدولة التي قد تُبطلها، والظروف التي لن تفعل فيها شيئًا على الإطلاق. والثالث هو ما تُغفله معظم الخطط، وهو ما يوفّر أكبر قدر من المال.</p>",
    linkLabels: { "Economic calendar": "المفكرة الاقتصادية" },
  },
  "what-a-blockchain-actually-records": {
    title: "ما الذي يسجّله البلوك تشين فعلًا",
    summary: "الكتل والتأكيدات والنهائية: ما الذي حدث حقًا حين تقول المحفظة إن التحويل اكتمل.",
    content:
      "<p>البلوك تشين دفتر حسابات لا يُضاف إليه إلا في آخره، تتفق عليه شبكة لا يوجد فيها محاسب مركزي. والمعاملة ليست تعليمات إلى بنك، بل رسالة موقّعة تُبث إلى تلك الشبكة، وهي التي تقرر ما إذا كانت ستضمّنها في كتلة ومتى.</p><p>لهذا توجد التأكيدات. فإدراج المعاملة في كتلة ليس نهاية القصة: كل كتلة تُبنى فوقها تجعل عكس الكتلة التي تحتها أكثر تكلفة، فتكون النهائية احتمالًا يرتفع مع العمق لا حالةً تنقلب فجأة.</p>",
    linkLabels: {
      "Blockchain in the glossary": "البلوك تشين في المسرد",
      "Browse crypto courses": "تصفّح دورات العملات المشفرة",
    },
  },
  "custody-and-why-keys-matter": {
    title: "الحفظ، ولماذا تهمّ المفاتيح",
    summary: "الفرق بين أن تمتلك أصلًا وأن تمتلك مطالبة على جهة أخرى تمتلكه.",
    content:
      "<p>الاحتفاظ بالعملات المشفرة على منصة تداول ليس احتفاظًا بالعملات المشفرة. إنه احتفاظ بمطالبة على تلك المنصة، مسجّلة في قاعدة بياناتها الخاصة، وقابلة للاسترداد ما دامت المنصة قادرة على الوفاء بالتزاماتها وتعمل. أما الرصيد على السلسلة فيعود إلى مفتاح المنصة.</p><p>الحفظ الذاتي ينقل ذلك المفتاح إليك، وينقل معه نمط الفشل بأكمله: لا يستطيع أي طرف مقابل أن يُضيّع أصلك، ولا يستطيع أي طرف مقابل أن يستعيده لك إذا أضعت المفتاح. وليس أيٌّ من الخيارين أكثر أمانًا من حيث المبدأ، فكلٌّ منهما يفشل في اتجاه مختلف.</p>",
    linkLabels: { "Private key in the glossary": "المفتاح الخاص في المسرد" },
  },
  "reading-on-chain-volume-honestly": {
    title: "قراءة حجم التداول على السلسلة بأمانة",
    summary:
      "لماذا يختلف الحجم المعلن عن النشاط الاقتصادي الحقيقي، وأي المقاييس يصمد أمام هذا الفرق.",
    content:
      "<p>الحجم هو أسهل رقم يمكن تضخيمه في أي لوحة بيانات للعملات المشفرة: فالتداول الوهمي على منصة ما لا يكلّف شيئًا تقريبًا، والتحويلات بين محافظ تتحكم فيها جهة واحدة تبدو على السلسلة مطابقة تمامًا للتحويلات بين طرفين.</p><p>المقاييس التي تصمد هي تلك التي يكلّف تزييفها كثيرًا: الرسوم المدفوعة فعلًا، والعناوين التي استلمت ثم أنفقت لاحقًا، وقيمة التسوية بعد استبعاد التحويلات الذاتية. إنها أرقام أصغر، وهي التي تستحق المتابعة.</p>",
    linkLabels: { "Volume in the glossary": "حجم التداول في المسرد" },
  },
};

/** Writes Arabic category and topic rows. Returns how many TOPIC rows it created. */
export async function seedArabicDemoVideos(db: PrismaClient): Promise<number> {
  for (const [slug, words] of Object.entries(VIDEO_CATEGORIES_AR)) {
    const english = await db.videoCategoryTranslation.findUnique({
      where: { locale_slug: { locale: "en", slug } },
      select: { categoryId: true },
    });
    if (!english) continue;
    const taken = await db.videoCategoryTranslation.findFirst({
      where: { locale: "ar", OR: [{ categoryId: english.categoryId }, { slug }] },
      select: { id: true },
    });
    if (taken) continue;
    await db.videoCategoryTranslation.create({
      data: {
        categoryId: english.categoryId,
        locale: "ar",
        name: words.name,
        slug,
        description: words.description,
        translationStatus: "TRANSLATED",
      },
    });
  }

  let created = 0;
  for (const [slug, words] of Object.entries(VIDEO_TOPICS_AR)) {
    const english = await db.videoTopicTranslation.findUnique({
      where: { locale_slug: { locale: "en", slug } },
      select: { topicId: true },
    });
    if (!english) continue;
    const taken = await db.videoTopicTranslation.findFirst({
      where: { locale: "ar", OR: [{ topicId: english.topicId }, { slug }] },
      select: { id: true },
    });
    if (taken) continue;
    await db.videoTopicTranslation.create({
      data: {
        topicId: english.topicId,
        locale: "ar",
        title: words.title,
        slug,
        summary: words.summary,
        content: words.content,
        ...(words.linkLabels ? { linkLabels: words.linkLabels } : {}),
        translationStatus: "TRANSLATED",
      },
    });
    created += 1;
  }
  return created;
}

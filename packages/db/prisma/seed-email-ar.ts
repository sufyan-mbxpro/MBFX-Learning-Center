// Arabic content for the seeded email templates (ADR-166: Arabic is the first
// locale).
//
// Keyed by template KEY, and written beside the English row the seed creates
// from `EMAIL_TEMPLATE_DEFAULTS`. A send already resolves the recipient's
// locale first and English second (ADR-078 #12), so a key this map does not
// cover simply goes out in English.
//
// `support.request` is deliberately ABSENT: its recipient is our own support
// inbox, so it renders in English whatever the visitor reads the site in
// (ADR-113, `audience: "staff"`).
//
// Every body uses exactly the variables and links its English source does —
// `arabic-seed.test.ts` fails on a difference, because `check:email-templates`
// reads only the English defaults and a typo here would reach an inbox as
// literal braces.
//
// `create`-only, and `sourceHash` stays NULL (unknown, ADR-161 #4) like every
// other seeded translation: the hash is computed in @repo/core, which this
// package cannot import.
import type { PrismaClient } from "../src/generated/client/client.ts";

export interface ArabicEmailTemplate {
  subject: string;
  preheader: string;
  bodyHtml: string;
}

export const EMAIL_TEMPLATES_AR: Readonly<Record<string, ArabicEmailTemplate>> = {
  "auth.password_reset": {
    subject: "إعادة تعيين كلمة المرور",
    preheader: "تنتهي صلاحية الرابط خلال {{expires.minutes}} دقيقة.",
    bodyHtml:
      "<p>مرحبًا {{recipient.name}}،</p>" +
      "<p>طلب أحدهم إعادة تعيين كلمة المرور لحسابك على {{site.name}}. " +
      "إذا كنت أنت من طلب ذلك، فاستخدم الرابط أدناه. تنتهي صلاحيته خلال {{expires.minutes}} دقيقة.</p>" +
      '<p><a href="{{reset.url}}">إعادة تعيين كلمة المرور</a></p>' +
      "<p>إذا لم تكن أنت، فلم يتغيّر شيء ويمكنك تجاهل هذه الرسالة.</p>",
  },
  "auth.verify_email": {
    subject: "أكّد عنوان بريدك الإلكتروني",
    preheader: "نقرة واحدة ويتأكّد حسابك على {{site.name}}.",
    bodyHtml:
      "<p>مرحبًا بك في {{site.name}}، {{recipient.name}}.</p>" +
      "<p>أكّد هذا العنوان لنعرف أنّنا نستطيع التواصل معك:</p>" +
      '<p><a href="{{verify.url}}">تأكيد بريدي الإلكتروني</a></p>' +
      "<p>يمكنك متابعة استخدام حسابك في الحالتين، فالتأكيد يُبقيك قابلًا للتواصل " +
      "إذا احتجت يومًا إلى استعادة حسابك.</p>",
  },
  "auth.password_changed": {
    subject: "تم تغيير كلمة المرور",
    preheader: "تأكيد، تحسّبًا لأن لا تكون أنت من فعل ذلك.",
    bodyHtml:
      "<p>مرحبًا {{recipient.name}}،</p>" +
      "<p>تم تغيير كلمة المرور لحسابك على {{site.name}} في {{changed.at}}، " +
      "وتم تسجيل الخروج من جميع الجلسات.</p>" +
      "<p>إذا لم تكن أنت من فعل ذلك، فأعد تعيين كلمة المرور فورًا وتواصل معنا.</p>",
  },
  "auth.email_changed": {
    subject: "تم تغيير عنوان بريدك الإلكتروني",
    preheader: "تأكيد، تحسّبًا لأن لا تكون أنت من فعل ذلك.",
    bodyHtml:
      "<p>مرحبًا {{recipient.name}}،</p>" +
      "<p>تم تغيير عنوان البريد الإلكتروني لحسابك على {{site.name}} في {{changed.at}}. " +
      "العنوان الجديد هو {{email.new}}، ولن يتلقى هذا العنوان بعد الآن رسائل تخص الحساب.</p>" +
      "<p>إذا لم تكن أنت من فعل ذلك، فتواصل معنا فورًا لنؤمّن حسابك.</p>",
  },
  "newsletter.confirm": {
    subject: "أكّد اشتراكك في النشرة البريدية",
    preheader: "نقرة واحدة لتبدأ في تلقّي تحديثات {{site.name}}.",
    bodyHtml:
      "<p>شكرًا لاشتراكك في نشرة {{site.name}} البريدية.</p>" +
      "<p>أكّد الاشتراك لتبدأ في تلقّيها:</p>" +
      '<p><a href="{{confirm.url}}">تأكيد اشتراكي</a></p>' +
      "<p>إذا لم تشترك أنت، فتجاهل هذه الرسالة، فلن يحدث شيء دون هذا التأكيد.</p>",
  },
  "newsletter.welcome": {
    subject: "تم اشتراكك",
    preheader: "إليك ما يمكنك توقّعه من نشرة {{site.name}} البريدية.",
    bodyHtml:
      "<p>أنت الآن على القائمة. ترقّب ملاحظات عن الأسواق، ودروسًا جديدة، " +
      "وتحليلات معمّقة بين حين وآخر من {{site.name}}.</p>" +
      '<p>يمكنك <a href="{{unsubscribe.url}}">إلغاء الاشتراك</a> في أي وقت.</p>',
  },
  "announcement.course": {
    subject: "دورة جديدة: {{course.title}}",
    preheader: "{{course.summary}}",
    bodyHtml:
      '<p><a href="{{course.url}}"><img src="{{course.coverUrl}}" alt="{{course.title}}" ' +
      'width="560" style="width:100%;max-width:560px;height:auto;border:0"></a></p>' +
      '<p class="ed-tx-primary ed-fs-sm"><strong>دورة جديدة</strong></p>' +
      "<h2>{{course.title}}</h2>" +
      '<p class="ed-tx-muted ed-fs-sm">المستوى: {{course.level}} · الدروس: {{course.lessonCount}}</p>' +
      "<p>{{course.summary}}</p>" +
      "<p>{{campaign.message}}</p>" +
      '<p><strong><a href="{{course.url}}">ابدأ الدورة</a></strong></p>' +
      '<p class="ed-tx-muted ed-fs-sm">تصلك هذه الرسالة لأن لديك حسابًا على {{site.name}} ' +
      "أو لأنك مشترك في نشرته البريدية. " +
      '<a href="{{unsubscribe.url}}">إيقاف إعلانات الدورات</a>.</p>',
  },
};

/** Writes an Arabic row for every seeded template the map covers. */
export async function seedArabicEmailTemplates(db: PrismaClient): Promise<number> {
  let created = 0;
  for (const [templateKey, content] of Object.entries(EMAIL_TEMPLATES_AR)) {
    const template = await db.emailTemplate.findUnique({
      where: { key: templateKey },
      select: { key: true },
    });
    if (!template) continue;
    const existing = await db.emailTemplateTranslation.findUnique({
      where: { templateKey_locale: { templateKey, locale: "ar" } },
      select: { id: true },
    });
    if (existing) continue;
    await db.emailTemplateTranslation.create({
      data: {
        templateKey,
        locale: "ar",
        subject: content.subject,
        preheader: content.preheader,
        mode: "RICH",
        bodyHtml: content.bodyHtml,
        translationStatus: "TRANSLATED",
      },
    });
    created += 1;
  }
  return created;
}

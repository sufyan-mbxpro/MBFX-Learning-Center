import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { EMAIL_TEMPLATES, GLOBAL_EMAIL_VARIABLES, isEmailTemplateKey } from "@repo/contracts";
import { isTranslatedAudience, loadEmailTemplate } from "@repo/core";
import { getActiveLocales } from "@repo/i18n";
import { can, requirePermission } from "@repo/rbac";
import { richTextLabels } from "../../../../_components/editor-labels.ts";
import { loadWritingAssistant } from "../../../../_lib/editor-ai.ts";
import { EmailTemplateEditor } from "./template-editor.tsx";

// One email template's editor (Module 17, ADR-078 #5, #7).
//
// Modelled on the LESSON editor rather than the article one: a template has no
// publishing lifecycle, just content, sender overrides and an on/off switch.
//
// **Locale tabs exist only for a translated audience** (ADR-043 #2, applied by
// `isTranslatedAudience`). A staff-only template has one language by design, and
// rendering an Arabic tab for it would invite work nothing will ever read.
export default async function EmailTemplatePage({
  params,
}: PageProps<"/admin/settings/email/templates/[key]">) {
  const subject = await requirePermission("email.templates.view");
  const { key } = await params;
  // 404 rather than an empty editor: the registry is the set of templates that
  // exist, so an unknown key is a wrong URL, not an empty record.
  if (!isEmailTemplateKey(key)) notFound();

  const t = await getTranslations("admin");
  const [detail, locales, assistant] = await Promise.all([
    loadEmailTemplate(key),
    getActiveLocales(),
    // changes-46 #4: the toolbar writing assistant on the body, gated on the
    // key that saves a template (the run route checks the same one).
    loadWritingAssistant(subject, {
      entity: { type: "email_template", id: key },
      contentKeys: ["email.templates.update"],
    }),
  ]);
  if (!detail) notFound();

  const localeCodes = isTranslatedAudience(detail.audience)
    ? locales.map((locale) => locale.code)
    : [locales.find((locale) => locale.isDefault)?.code ?? "en"];

  return (
    <EmailTemplateEditor
      template={detail}
      locales={locales
        .filter((locale) => localeCodes.includes(locale.code))
        .map((locale) => ({ code: locale.code, name: locale.name }))}
      // Both halves of the variable list, with the globals last: a template's
      // own variables are what an author is looking for, and `{{year}}` is
      // scenery.
      variables={[...detail.variables, ...GLOBAL_EMAIL_VARIABLES]}
      sample={EMAIL_TEMPLATES[key].sample}
      editorLabels={richTextLabels(t)}
      {...(assistant ? { ai: assistant } : {})}
      canUpdate={can(subject, "email.templates.update")}
      canTest={can(subject, "email.templates.test")}
      labels={{
        backToList: t("email.backToTemplates"),
        heading: t("editorHeading.emailTemplate"),
        description: t("email.templateEditorDescription"),
        templatesTitle: t("email.templatesTitle"),
        critical: t("email.critical"),
        inactive: t("email.inactiveBadge"),
        contentSection: t("email.contentSection"),
        contentDescription: t("email.contentDescription"),
        subject: t("email.subject"),
        subjectHint: t("email.subjectHint"),
        preheader: t("email.preheader"),
        preheaderHint: t("email.preheaderHint"),
        body: t("email.body"),
        modeHtmlHint: t("email.modeHtmlHint"),
        variablesSection: t("email.variablesSection"),
        variablesDescription: t("email.variablesDescription"),
        copyVariable: t("email.copyVariable"),
        variableCopied: t("email.variableCopied", { token: "{token}" }),
        copyFailed: t("email.copyFailed", { token: "{token}" }),
        openActions: t("openActions"),
        senderSection: t("email.senderOverrides"),
        senderDescription: t("email.senderOverridesDescription"),
        fromName: t("email.fromName"),
        fromEmail: t("email.fromEmail"),
        replyTo: t("email.replyTo"),
        inheritHint: t("email.inheritHint"),
        previewSection: t("email.previewSection"),
        previewDescription: t("email.previewDescription"),
        previewRefresh: t("email.previewRefresh"),
        previewFrame: t("email.previewFrame"),
        widthDesktop: t("email.widthDesktop"),
        widthMobile: t("email.widthMobile"),
        testSend: t("email.testSend"),
        testSendTitle: t("email.testSendTitle"),
        testSendDescription: t("email.testSendDescription"),
        testRecipient: t("email.testRecipient"),
        testLocale: t("email.testLocale"),
        send: t("email.send"),
        testSent: t("email.testSent"),
        reset: t("email.resetToDefault"),
        resetTitle: t("email.resetTitle"),
        resetBody: t("email.resetBody"),
        save: t("save"),
        saved: t("saved"),
        cancel: t("cancel"),
        confirm: t("confirm"),
        close: t("close"),
        localeCurrent: t("email.localeCurrent"),
        localeOutdated: t("email.localeOutdated"),
        localeMissing: t("email.localeMissing"),
        localeDraft: t("email.localeDraft"),
      }}
    />
  );
}

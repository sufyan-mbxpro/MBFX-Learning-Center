import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { EmailDesignNotFoundError, getEmailDesign, type EmailDesignRow } from "@repo/core";
import { can, requirePermission } from "@repo/rbac";
import { richTextLabels } from "../../../../_components/editor-labels.ts";
import { DesignEditor } from "../_components/design-editor.tsx";

// One email design (ADR-172 #3). Read under the Templates screen's own key;
// the Save re-gates on `email.templates.update` in its action (security.md #1).
export default async function EmailDesignPage({
  params,
}: PageProps<"/keystone/settings/email/designs/[id]">) {
  const subject = await requirePermission("email.templates.view");
  const [{ id }, t] = await Promise.all([params, getTranslations("admin")]);

  let design: EmailDesignRow;
  try {
    design = await getEmailDesign(subject, id);
  } catch (error) {
    // An id that is not there is a 404, not a 500 (security.md #7).
    if (error instanceof EmailDesignNotFoundError) notFound();
    throw error;
  }

  return (
    <DesignEditor
      initial={{
        id: design.id,
        name: design.name,
        description: design.description ?? "",
        mode: design.mode,
        subject: design.subject ?? "",
        preheader: design.preheader ?? "",
        bodyHtml: design.bodyHtml,
      }}
      canUpdate={can(subject, "email.templates.update")}
      editorLabels={richTextLabels(t)}
    />
  );
}

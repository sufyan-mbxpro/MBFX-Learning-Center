import { getTranslations } from "next-intl/server";
import { requirePermission } from "@repo/rbac";
import { richTextLabels } from "../../../../_components/editor-labels.ts";
import { DesignEditor } from "../_components/design-editor.tsx";

// A new email design (ADR-172 #3). Nothing is written until the first Save,
// which creates the design and moves to its own address.
export default async function NewEmailDesignPage() {
  await requirePermission("email.templates.update");
  const t = await getTranslations("admin");
  return (
    <DesignEditor
      initial={{
        id: null,
        name: "",
        description: "",
        mode: "RICH",
        subject: "",
        preheader: "",
        bodyHtml: "",
      }}
      canUpdate
      editorLabels={richTextLabels(t)}
    />
  );
}

import { getTranslations } from "next-intl/server";
import { requirePermission } from "@repo/rbac";
import { EditorPage } from "../../_components/admin-page.tsx";
import { richTextLabels } from "../../_components/editor-labels.ts";
import { AnnouncementEditor } from "../_components/announcement-editor.tsx";
import { CustomEmailEditor } from "../_components/custom-email-editor.tsx";
import { loadCustomEditorProps } from "../_lib/custom-editor-data.ts";
import { loadEditorProps } from "../_lib/editor-data.ts";

// A new announcement (ADR-171, changes-54 §10.3). Nothing is written until the
// first "Save & continue", which creates the draft and moves to its own
// address. `?course=` pre-fills step 1 — the course editor's "Announce this
// course" button lands here with it.
export default async function NewAnnouncementPage({
  searchParams,
}: PageProps<"/keystone/announcements/new">) {
  const subject = await requirePermission("announcements.create");
  const [t, params] = await Promise.all([getTranslations("admin"), searchParams]);
  const course = Array.isArray(params.course) ? params.course[0] : params.course;
  const kind = Array.isArray(params.kind) ? params.kind[0] : params.kind;

  // `?kind=custom` — a free-form email to chosen groups (ADR-172).
  if (kind === "custom") {
    const props = await loadCustomEditorProps(subject, {
      detail: null,
      step: null,
      editorLabels: richTextLabels(t),
    });
    return (
      <EditorPage
        title={t("announcements.custom.newHeading")}
        description={t("announcements.custom.editorDescription")}
        backHref="/keystone/announcements"
        backLabel={t("nav.announcements")}
      >
        <CustomEmailEditor {...props} />
      </EditorPage>
    );
  }

  const props = await loadEditorProps(subject, {
    detail: null,
    // Parsed by the service: an unknown id simply finds no course.
    courseId: course && course.length <= 191 ? course : null,
    step: null,
    defaultName: (title) => t("announcements.defaultName", { title }),
  });

  return (
    <EditorPage
      title={t("announcements.newHeading")}
      description={t("announcements.editorDescription")}
      backHref="/keystone/announcements"
      backLabel={t("nav.announcements")}
    >
      <AnnouncementEditor {...props} />
    </EditorPage>
  );
}

import { getTranslations } from "next-intl/server";
import { requirePermission } from "@repo/rbac";
import { AdminPageHeading } from "../../_components/admin-page.tsx";
import { HeaderActionsProvider } from "../../_components/header-actions.tsx";
import { SubNav } from "../../_components/sub-nav.tsx";

// The Glossary section frame (changes-48 #3) — News & Analysis' shape
// (ADR-106). Topics was its own sidebar row; it is a tab here, beside the
// terms it groups, and the layout keeps the heading and the strip mounted
// across a tab click.
//
// `(browse)` is a route group, so no URL moved. Both editors —
// `/keystone/glossary/[id]` and `/keystone/glossary/topics/[id]` — sit OUTSIDE it,
// because an editor is not a tab and must not inherit the strip.
export default async function GlossaryBrowseLayout({ children }: { children: React.ReactNode }) {
  // A gate, not the boundary — every page below re-checks (security.md #3).
  await requirePermission("glossary.view");
  const t = await getTranslations("admin");

  return (
    <HeaderActionsProvider>
      <div className="flex w-full flex-col gap-6">
        <AdminPageHeading title={t("glossary")} description={t("pageDesc.glossary")} actionsSlot />
        <SubNav
          items={[
            { href: "/keystone/glossary", label: t("glossaryTermsTab"), exact: true },
            { href: "/keystone/glossary/topics", label: t("glossaryTopics") },
          ]}
        />
        {children}
      </div>
    </HeaderActionsProvider>
  );
}

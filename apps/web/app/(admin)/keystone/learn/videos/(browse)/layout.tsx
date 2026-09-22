import { getTranslations } from "next-intl/server";
import { requirePermission } from "@repo/rbac";
import { AdminPageHeading } from "../../../_components/admin-page.tsx";
import { HeaderActionsProvider } from "../../../_components/header-actions.tsx";
import { SubNav } from "../../../_components/sub-nav.tsx";

// The Videos section frame (changes-48 #3) — News & Analysis' shape (ADR-106).
//
// Categories was a sidebar row of its own AND a "Categories" button on the
// videos list: two ways to reach a screen that is only ever about the videos.
// It is a tab of this section now, and the layout owns the heading and the
// strip, so a tab click swaps the table and leaves the chrome mounted.
//
// `(browse)` is a route group, so no URL moved, and the topic editor at
// `/keystone/learn/videos/[id]` sits OUTSIDE it: an editor is not a third tab.
// Each page portals its own create button into the heading (ADR-140 §3).
export default async function VideosBrowseLayout({ children }: { children: React.ReactNode }) {
  // A gate, not the boundary — every page below re-checks (security.md #3).
  await requirePermission("lessons.view");
  const t = await getTranslations("admin");

  return (
    <HeaderActionsProvider>
      <div className="flex w-full flex-col gap-6">
        <AdminPageHeading
          title={t("learnVideos")}
          description={t("pageDesc.learnVideos")}
          actionsSlot
        />
        <SubNav
          items={[
            { href: "/keystone/learn/videos", label: t("learnVideos"), exact: true },
            { href: "/keystone/learn/videos/categories", label: t("videos.manageCategories") },
          ]}
        />
        {children}
      </div>
    </HeaderActionsProvider>
  );
}

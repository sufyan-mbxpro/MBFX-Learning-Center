import { getTranslations } from "next-intl/server";

import { requireAnyPermission } from "@repo/rbac";

import { AdminPageHeading } from "../../_components/admin-page.tsx";
import { HeaderActionsProvider } from "../../_components/header-actions.tsx";
import { ArticlesSubnav } from "../_components/articles-subnav.tsx";
import { articlesSubnavItems } from "../_components/subnav-items.ts";

// The News & Analysis section frame (ADR-106).
//
// The three browse screens used to render this themselves — heading, strip and
// all — so moving between tabs unmounted the chrome and built it again, which
// is the "page loading" the owner reported. A LAYOUT stays mounted across a
// soft navigation: only `{children}` and the segment's own `loading.tsx`
// change, so a tab click loads the tab's data and nothing else.
//
// `(browse)` is a route group, so no URL moves — and the editor at
// `/keystone/articles/[id]` sits OUTSIDE it, which is the point: an editor is not
// a fourth tab and must not inherit the strip.
//
// The heading is the SECTION's, not the tab's. Three screens each repeating a
// title the active tab already states is three chances to disagree about what
// this section is called.
//
// There is no Settings button any more: ADR-144 §5 deleted the `articles`
// settings group's screen, so its four values are a seed or code change.
//
// The tab's own primary action ("New article", "New category", "New tag")
// sits on this row (ADR-140 §3). The layout cannot
// know which tab is active, so it renders a slot and each page portals its
// button into it with `<HeaderActions>` — the page still owns its action.
export default async function ArticlesBrowseLayout({ children }: { children: React.ReactNode }) {
  // A gate, not the boundary — every page below re-checks (security.md #3).
  await requireAnyPermission(["analysis.view", "news.manage"]);
  const t = await getTranslations("admin");

  return (
    <HeaderActionsProvider>
      <div className="flex w-full flex-col gap-6">
        <AdminPageHeading title={t("articles")} description={t("pageDesc.articles")} actionsSlot />
        <ArticlesSubnav
          items={articlesSubnavItems({
            articles: t("articlesAll"),
            categories: t("articleCategories"),
            tags: t("articleTags"),
          })}
        />
        {children}
      </div>
    </HeaderActionsProvider>
  );
}

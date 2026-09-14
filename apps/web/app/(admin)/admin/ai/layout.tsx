import { getTranslations } from "next-intl/server";
import { can, requireAnyPermission } from "@repo/rbac";
import { SubNav, type SubNavItem } from "../_components/sub-nav.tsx";

// The AI area (Module 18, ADR-097/098).
//
// **The sub-nav is built from what the viewer holds, not filtered after the
// fact.** `ai.providers.manage` is super_admin-only (ADR-098), so an `admin`
// sees Usage, Features and Limits and no Providers tab at all — the screens
// split by permission rather than hiding whole, exactly as the email settings
// screen does for the SMTP transport.
//
// The layout gate is `requireAnyPermission` over all three keys; each page
// re-checks its own, because a layout gate is a gate and not the boundary
// (security.md #3).
export default async function AiLayout({ children }: { children: React.ReactNode }) {
  const subject = await requireAnyPermission([
    "ai.usage.view",
    "ai.settings.manage",
    "ai.providers.manage",
  ]);
  const t = await getTranslations("admin.ai");

  const items: SubNavItem[] = [];
  if (can(subject, "ai.usage.view")) {
    items.push({ href: "/admin/ai", label: t("navUsage"), exact: true });
  }
  if (can(subject, "ai.settings.manage")) {
    items.push({ href: "/admin/ai/features", label: t("navFeatures") });
    items.push({ href: "/admin/ai/limits", label: t("navLimits") });
  }
  if (can(subject, "ai.providers.manage")) {
    items.push({ href: "/admin/ai/providers", label: t("navProviders") });
  }

  return (
    <div className="flex w-full flex-col gap-6">
      {/* A strip of one says nothing — the same rule `GlossaryTabs` follows
          on the public side (ADR-081 #4). */}
      {items.length > 1 && <SubNav items={items} aria-label={t("title")} />}
      {children}
    </div>
  );
}

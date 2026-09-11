import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { DesignSystem } from "./design-system-client";

// changes-20 Phase 4 — the permanent design-system reference (ADR-072 §10,
// Q13): every shared component in every variant, size and state, for
// side-by-side comparison with the reference UI. It replaces the dev-only
// /admin/_dev/kitchen-sink, and unlike that page it ships to production.
//
// Staff-only by the (admin) root layout's DB-backed STAFF re-check, like
// every admin route (security.md #3). It reads nothing and mutates nothing,
// so there is no permission key to require. English-only by design
// (ADR-043 #2): every string is an `admin.designSystem.*` catalog key.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.designSystem");
  return { title: t("title") };
}

export default function DesignSystemPage() {
  return <DesignSystem />;
}

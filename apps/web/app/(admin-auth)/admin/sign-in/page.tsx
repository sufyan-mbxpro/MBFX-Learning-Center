import { getTranslations } from "next-intl/server";
import { getBrandAssets } from "@repo/core";
import { getSetting } from "@repo/settings";
import { BrandLogo } from "@repo/ui/components/brand-logo";
import { AdminSignInForm } from "./admin-sign-in-form.tsx";

// Staff credential screen (ADR-052). Posts to Better Auth's
// /api/auth/sign-in/email — the ONLY correct entry point, because rate
// limiting and the lockout hooks live on that HTTP handler (ADR-001
// finding #4), not on anything this page could wrap around it.
//
// Strings come from the `admin` namespace, which is English-only by design
// (ADR-043 #2) — the surface is staff-facing, so no non-English value is
// owed and `check:catalog-completeness` stays silent about it.
export default async function AdminSignInPage() {
  const [t, siteName, brandAssets] = await Promise.all([
    getTranslations("admin"),
    getSetting("site.name"),
    getBrandAssets(),
  ]);

  return (
    <main className="flex min-h-dvh flex-1 items-center justify-center bg-background p-6">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex justify-center">
          <BrandLogo
            light={brandAssets.logo_light?.url ?? null}
            dark={brandAssets.logo_dark?.url ?? null}
            alt={siteName ?? ""}
            className="h-10"
            fallback={<span className="text-lg font-semibold tracking-tight">{siteName}</span>}
          />
        </div>
        <div className="flex flex-col gap-6 rounded-xl border bg-card p-8 shadow-card">
          <div className="flex flex-col gap-1.5">
            <h1 className="text-xl font-semibold">{t("signIn.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("signIn.description")}</p>
          </div>
          <AdminSignInForm
            labels={{
              email: t("signIn.email"),
              password: t("signIn.password"),
              submit: t("signIn.submit"),
              failed: t("signIn.failed"),
              notStaff: t("signIn.notStaff"),
            }}
          />
        </div>
      </div>
    </main>
  );
}

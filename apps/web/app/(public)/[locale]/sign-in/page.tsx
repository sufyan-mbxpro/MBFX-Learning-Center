import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getBrandAssets } from "@repo/core";
import { getSetting } from "@repo/settings";
import { getPathname, Link } from "@repo/i18n/navigation";
import { BrandLogo } from "@repo/ui/components/brand-logo";
import { Reveal } from "@repo/ui/components/reveal";
import { SignInForm } from "./sign-in-form.tsx";

// LEARNER sign-in (ADR-052). The staff credential screen is a separate
// surface at /admin/sign-in and is never linked from here — the public site
// carries no administrator entry point.
//
// Posts to Better Auth's /api/auth/sign-in/email — the ONLY correct entry
// point (ADR-001 finding #4: rate limiting lives on the HTTP handler).
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/sign-in">): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, template] = await Promise.all([
    getTranslations("auth"),
    getSetting("seo.titleTemplate"),
  ]);
  return { title: (template ?? "%s").replace("%s", t("signInTitle")), robots: { index: false } };
}

export default async function SignInPage({ params }: PageProps<"/[locale]/sign-in">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, siteName, brandAssets] = await Promise.all([
    getTranslations("auth"),
    getSetting("site.name"),
    getBrandAssets(),
  ]);

  return (
    <main className="bg-glow-primary container-page section-lg relative flex flex-1 items-center justify-center overflow-hidden">
      <Reveal variant="scale" className="flex w-full max-w-sm flex-col gap-6">
        {/* The admin-uploaded logo, same as the header/footer/admin shell —
            a sign-in screen showing the site's NAME while every other
            surface shows its mark is the one place a brand is most
            noticeably absent. Falls back to the name when none is set. */}
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
            <h1 className="text-xl font-semibold">{t("signInTitle")}</h1>
            <p className="text-sm text-muted-foreground">{t("signInDescription")}</p>
          </div>
          <SignInForm
            // The form navigates with window.location.assign, which needs a
            // real path — getPathname is next-intl's server-side way to get
            // the localized one without a client hook.
            homeHref={getPathname({ href: "/", locale })}
            labels={{
              email: t("email"),
              password: t("password"),
              submit: t("submit"),
              failed: t("failed"),
              learnersOnly: t("learnersOnly"),
            }}
          />
          <p className="text-center text-sm text-muted-foreground">
            {t("noAccount")}{" "}
            <Link
              href="/sign-up"
              className="font-medium text-primary-interactive underline-offset-4 hover:underline"
            >
              {t("signUpLink")}
            </Link>
          </p>
        </div>
      </Reveal>
    </main>
  );
}

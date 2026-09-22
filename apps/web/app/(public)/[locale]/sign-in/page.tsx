import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getSetting } from "@repo/settings";
import { getPathname, Link } from "@repo/i18n/navigation";
import { AuthScreen } from "../_components/auth-screen.tsx";
import { SignInForm } from "./sign-in-form.tsx";

// LEARNER sign-in (ADR-052). The staff credential screen is a separate
// surface at /keystone and is never linked from here — the public site
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
  const t = await getTranslations("auth");

  return (
    <AuthScreen
      title={t("signInTitle")}
      description={t("signInDescription")}
      footer={
        <p className="text-center text-sm text-muted-foreground">
          {t("noAccount")}{" "}
          <Link
            href="/sign-up"
            className="font-medium text-primary-interactive underline-offset-4 hover:underline"
          >
            {t("signUpLink")}
          </Link>
        </p>
      }
    >
      <SignInForm
        // The form navigates with window.location.assign, which needs a
        // real path — getPathname is next-intl's server-side way to get
        // the localized one without a client hook.
        homeHref={getPathname({ href: "/", locale })}
        labels={{
          email: t("email"),
          password: t("password"),
          showPassword: t("showPassword"),
          hidePassword: t("hidePassword"),
          submit: t("submit"),
          failed: t("failed"),
          learnersOnly: t("learnersOnly"),
          resetDone: t("resetDone"),
          verifiedDone: t("verifiedDone"),
          codeTitle: t("twoFactorTitle"),
          codeHint: t("twoFactorHint"),
          codeLabel: t("twoFactorCode"),
          codeSubmit: t("twoFactorSubmit"),
          invalidCode: t("twoFactorInvalid"),
          codeExpired: t("twoFactorExpired"),
          back: t("twoFactorBack"),
        }}
      />
      {/* Recovery is linked from the learner surface only — the staff
              screen carries its own (ADR-052: the public site names no
              administrator entry point). */}
      <p className="-mt-2 text-end text-sm">
        <Link
          href="/forgot-password"
          className="font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          {t("forgotLink")}
        </Link>
      </p>
    </AuthScreen>
  );
}

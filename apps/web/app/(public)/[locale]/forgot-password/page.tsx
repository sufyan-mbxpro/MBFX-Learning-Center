import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getSetting } from "@repo/settings";
import { Link } from "@repo/i18n/navigation";
import { AuthScreen } from "../_components/auth-screen.tsx";
import { ForgotPasswordForm } from "./forgot-password-form.tsx";

// LEARNER password recovery (ADR-079). The staff equivalent is a separate
// surface at /keystone/forgot-password and is never linked from here — the public
// site carries no administrator entry point (ADR-052).
//
// The address typed here does NOT decide where the link points: `@repo/auth`'s
// `sendResetPassword` routes by `user.userType`, so a staff member who types
// their address into this form still receives an /admin link and a learner who
// types theirs into the staff form still receives a public one (ADR-079 #2).
// An attacker choosing the surface therefore chooses nothing.
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/forgot-password">): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, template] = await Promise.all([
    getTranslations("auth"),
    getSetting("seo.titleTemplate"),
  ]);
  return {
    title: (template ?? "%s").replace("%s", t("forgotTitle")),
    // A recovery screen has nothing to index and everything to lose by being
    // crawled, the same reason sign-in carries this.
    robots: { index: false, follow: false },
  };
}

export default async function ForgotPasswordPage({
  params,
}: PageProps<"/[locale]/forgot-password">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("auth");

  return (
    <AuthScreen
      title={t("forgotTitle")}
      description={t("forgotDescription")}
      footer={
        <p className="text-center text-sm text-muted-foreground">
          <Link
            href="/sign-in"
            className="font-medium text-primary-interactive underline-offset-4 hover:underline"
          >
            {t("backToSignIn")}
          </Link>
        </p>
      }
    >
      <ForgotPasswordForm
        labels={{
          email: t("email"),
          submit: t("forgotSubmit"),
          sent: t("forgotSent"),
          sentAgain: t("forgotSendAgain"),
        }}
      />
    </AuthScreen>
  );
}

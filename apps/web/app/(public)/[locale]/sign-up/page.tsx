import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getCaptchaClient } from "@repo/auth";
import { isFeatureVisible } from "@repo/settings";
import { MIN_PASSWORD_LENGTH } from "@repo/contracts";
import { getPathname, Link } from "@repo/i18n/navigation";
import { AuthScreen } from "../_components/auth-screen.tsx";
import { SignUpForm } from "./sign-up-form.tsx";
import { titleTemplate, titleFrom } from "../../../_lib/seo.ts";

// Public self-registration (ADR-052) — the learner account the whole
// platform is for. Posts to Better Auth's /api/auth/sign-up/email, whose
// handler owns rate limiting and the verification mail; `userType` is
// `input: false` in @repo/auth, so this route cannot create staff.
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/sign-up">): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, template] = await Promise.all([getTranslations("auth"), titleTemplate()]);
  return { title: titleFrom(template, t("signUpTitle")), robots: { index: false } };
}

export default async function SignUpPage({ params }: PageProps<"/[locale]/sign-up">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, newsletterEnabled, captcha] = await Promise.all([
    getTranslations("auth"),
    // ADR-124: the opt-in checkbox exists only while the newsletter does.
    // Evaluated for an anonymous subject, like every public placement, so the
    // page stays cacheable.
    isFeatureVisible("newsletter", null),
    // ADR-156: cached and tagged, so this static page carries the key.
    getCaptchaClient(),
  ]);

  return (
    <AuthScreen
      title={t("signUpTitle")}
      description={t("signUpDescription")}
      footer={
        <p className="text-center text-sm text-muted-foreground">
          {t("haveAccount")}{" "}
          <Link
            href="/sign-in"
            className="font-medium text-primary-interactive underline-offset-4 hover:underline"
          >
            {t("signInLink")}
          </Link>
        </p>
      }
    >
      <SignUpForm
        captcha={captcha}
        homeHref={getPathname({ href: "/", locale })}
        verifiedHref={`${getPathname({ href: "/sign-in", locale })}?verified=1`}
        minPasswordLength={MIN_PASSWORD_LENGTH}
        locale={locale}
        newsletterEnabled={newsletterEnabled}
        labels={{
          name: t("name"),
          email: t("email"),
          password: t("password"),
          showPassword: t("showPassword"),
          hidePassword: t("hidePassword"),
          passwordHint: t("passwordHint", { count: MIN_PASSWORD_LENGTH }),
          submit: t("signUpSubmit"),
          failed: t("signUpFailed"),
          taken: t("emailTaken"),
          captcha: t("captchaFailed"),
          captchaRequired: t("captchaRequired"),
          newsletterOptIn: t("newsletterOptIn"),
          newsletterOptInHint: t("newsletterOptInHint"),
        }}
      />
    </AuthScreen>
  );
}

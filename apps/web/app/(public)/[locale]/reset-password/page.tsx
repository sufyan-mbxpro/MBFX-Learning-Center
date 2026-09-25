import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getPathname, Link } from "@repo/i18n/navigation";
import { MIN_PASSWORD_LENGTH } from "@repo/contracts";
import { AuthScreen } from "../_components/auth-screen.tsx";
import { ResetPasswordForm } from "./reset-password-form.tsx";
import { titleTemplate, titleFrom } from "../../../_lib/seo.ts";

// Where a learner's reset link lands (ADR-079 #2).
//
// The page itself reads NO search params, so the shell stays static
// (architecture.md #6): the token is read from the live URL inside the client
// island, the way `resolveRedirect` already reads `?redirect=`. `useSearchParams`
// would force a Suspense boundary and opt the whole route out of prerendering
// for a value only the submit handler needs.
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/reset-password">): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, template] = await Promise.all([getTranslations("auth"), titleTemplate()]);
  return {
    title: titleFrom(template, t("resetTitle")),
    // The URL carries a live reset token. It must never reach an index.
    robots: { index: false, follow: false },
  };
}

export default async function ResetPasswordPage({ params }: PageProps<"/[locale]/reset-password">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("auth");

  return (
    <AuthScreen
      title={t("resetTitle")}
      description={t("resetDescription")}
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
      <ResetPasswordForm
        // Localized paths, resolved on the server: the form navigates with
        // `window.location.assign`, which needs a real path rather than a
        // next-intl href.
        signInHref={`${getPathname({ href: "/sign-in", locale })}?reset=1`}
        forgotHref={getPathname({ href: "/forgot-password", locale })}
        minPasswordLength={MIN_PASSWORD_LENGTH}
        labels={{
          password: t("resetNewPassword"),
          confirm: t("resetConfirmPassword"),
          showPassword: t("showPassword"),
          hidePassword: t("hidePassword"),
          passwordHint: t("passwordHint", { count: MIN_PASSWORD_LENGTH }),
          submit: t("resetSubmit"),
          mismatch: t("resetMismatch"),
          tooShort: t("passwordHint", { count: MIN_PASSWORD_LENGTH }),
          invalidToken: t("resetInvalidToken"),
          missingToken: t("resetMissingToken"),
          requestAnother: t("resetRequestAnother"),
          failed: t("resetFailed"),
        }}
      />
    </AuthScreen>
  );
}

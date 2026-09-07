import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getBrandAssets } from "@repo/core";
import { getSetting } from "@repo/settings";
import { MIN_PASSWORD_LENGTH } from "@repo/contracts";
import { getPathname, Link } from "@repo/i18n/navigation";
import { BrandLogo } from "@repo/ui/components/brand-logo";
import { Reveal } from "@repo/ui/components/reveal";
import { SignUpForm } from "./sign-up-form.tsx";

// Public self-registration (ADR-052) — the learner account the whole
// platform is for. Posts to Better Auth's /api/auth/sign-up/email, whose
// handler owns rate limiting and the verification mail; `userType` is
// `input: false` in @repo/auth, so this route cannot create staff.
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/sign-up">): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, template] = await Promise.all([
    getTranslations("auth"),
    getSetting("seo.titleTemplate"),
  ]);
  return { title: (template ?? "%s").replace("%s", t("signUpTitle")), robots: { index: false } };
}

export default async function SignUpPage({ params }: PageProps<"/[locale]/sign-up">) {
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
            <h1 className="text-xl font-semibold">{t("signUpTitle")}</h1>
            <p className="text-sm text-muted-foreground">{t("signUpDescription")}</p>
          </div>
          <SignUpForm
            homeHref={getPathname({ href: "/", locale })}
            minPasswordLength={MIN_PASSWORD_LENGTH}
            labels={{
              name: t("name"),
              email: t("email"),
              password: t("password"),
              passwordHint: t("passwordHint", { count: MIN_PASSWORD_LENGTH }),
              submit: t("signUpSubmit"),
              failed: t("signUpFailed"),
              taken: t("emailTaken"),
            }}
          />
          <p className="text-center text-sm text-muted-foreground">
            {t("haveAccount")}{" "}
            <Link
              href="/sign-in"
              className="font-medium text-primary-interactive underline-offset-4 hover:underline"
            >
              {t("signInLink")}
            </Link>
          </p>
        </div>
      </Reveal>
    </main>
  );
}

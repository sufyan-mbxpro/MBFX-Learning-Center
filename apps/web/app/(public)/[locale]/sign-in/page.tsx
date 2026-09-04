import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getSetting } from "@repo/settings";
import { Reveal } from "@repo/ui/components/reveal";
import { SignInForm } from "./sign-in-form.tsx";

// Minimal credential sign-in (the Module 04 UI that was deferred). Posts
// to Better Auth's /api/auth/sign-in/email — the ONLY correct entry point
// (ADR-001 finding #4: rate limiting lives on the HTTP handler).
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
  const [t, siteName] = await Promise.all([getTranslations("auth"), getSetting("site.name")]);

  return (
    <main className="bg-glow-primary container-page section-lg relative flex flex-1 items-center justify-center overflow-hidden">
      <Reveal variant="scale" className="flex w-full max-w-sm flex-col gap-6">
        <p className="text-center text-lg font-semibold tracking-tight">{siteName}</p>
        <div className="flex flex-col gap-6 rounded-xl border bg-card p-8 shadow-card">
          <h1 className="text-xl font-semibold">{t("signInTitle")}</h1>
          <SignInForm
            labels={{
              email: t("email"),
              password: t("password"),
              submit: t("submit"),
              failed: t("failed"),
            }}
          />
        </div>
      </Reveal>
    </main>
  );
}

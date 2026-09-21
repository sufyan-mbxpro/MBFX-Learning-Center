// `/account`'s per-learner body (ADR-125 §1): email verification, picture and
// details, password and two-factor. Progress and history moved to
// `/account/progress`.
//
// The ONE kind of public page that reads the session on the server (ADR-123
// §1): it renders inside the page's `<Suspense>`, so the read makes this
// subtree dynamic without making the page's shell — or any other page — so.
import { getTranslations } from "next-intl/server";
import { ACCOUNT_PATH } from "@repo/contracts";
import { loadLearnerProfile } from "@repo/core";
import { getPathname, redirect } from "@repo/i18n/navigation";
import { getSetting } from "@repo/settings";
import { Container } from "@repo/ui/components/container";
import { Section } from "@repo/ui/components/section";
import { requireLearnerSession } from "../_lib/learner-session.ts";
import { AccountMasthead } from "./account-masthead.tsx";
import { EmailVerificationPanel } from "./email-verification-panel.tsx";
import { ProfilePanel } from "./profile-panel.tsx";
import { SecurityPanel } from "./security-panel.tsx";

export async function ProfileContent({
  locale,
  searchParams,
}: {
  locale: string;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const justVerified = (await searchParams).verified === "1";
  const { userId } = await requireLearnerSession(locale, ACCOUNT_PATH, { verified: justVerified });

  const [profile, t, siteName] = await Promise.all([
    loadLearnerProfile(userId),
    getTranslations({ locale, namespace: "account" }),
    getSetting("site.name"),
  ]);
  if (!profile) redirect({ href: "/sign-in", locale });
  const view = profile!;

  return (
    <>
      <AccountMasthead profile={view} locale={locale} titleKey="greeting" />

      <Section spacing="md">
        <Container className="flex flex-col gap-6">
          <h2 className="sr-only">{t("settings.title")}</h2>
          <EmailVerificationPanel
            email={view.email}
            emailVerified={view.emailVerified}
            justVerified={justVerified}
            // Back to THIS panel once Better Auth has flipped the flag.
            callbackURL={`${getPathname({ href: ACCOUNT_PATH, locale })}?verified=1`}
          />
          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
            <ProfilePanel
              profile={{
                name: view.name,
                firstName: view.firstName ?? "",
                lastName: view.lastName ?? "",
                phone: view.phone ?? "",
                image: view.image,
              }}
            />
            <SecurityPanel
              hasPassword={view.hasPassword}
              twoFactorEnabled={view.twoFactorEnabled}
              issuer={siteName ?? ""}
            />
          </div>
        </Container>
      </Section>
    </>
  );
}

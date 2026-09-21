import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getSetting } from "@repo/settings";
import { Container } from "@repo/ui/components/container";
import { Section } from "@repo/ui/components/section";
import { Skeleton, SkeletonAvatar, SkeletonCard } from "@repo/ui/components/skeleton";
import { ProfileContent } from "./_components/profile-content.tsx";

// `/account` — the learner's profile and security page (ADR-123, split by
// ADR-125: progress and history live at `/account/progress`).
//
// ─── Rendering: a session-reading page, not a shell plus islands ──────────
//
// Every other public page is cached and reads no session (ADR-056 #1,
// ADR-094), which is why progress and the header chip arrive client-side. This
// page is the opposite case: there is NOTHING on it that is the same for two
// readers, so a cached shell would be a heading and a spinner, and the
// islands would need four new read endpoints to fill it. Instead the body
// reads `auth()` inside `<Suspense>`, which makes that subtree — and only
// that subtree — dynamic under Cache Components. The shared layout, the
// header and every other route stay exactly as cached as they were.
//
// Mutations are server actions (profile, avatar) and Better Auth's own handler
// (password, two-factor); see the ADR for why the split falls there.

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/account">): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, template] = await Promise.all([
    getTranslations({ locale, namespace: "account" }),
    getSetting("seo.titleTemplate"),
  ]);
  return {
    title: (template ?? "%s").replace("%s", t("metaTitle")),
    // A private page: nothing to index, and nothing on it to follow either.
    robots: { index: false, follow: false },
  };
}

export default async function AccountPage({
  params,
  searchParams,
}: PageProps<"/[locale]/account">) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main className="flex flex-col">
      <Suspense fallback={<AccountSkeleton />}>
        {/* The search params are awaited INSIDE the boundary, with the session. */}
        <ProfileContent locale={locale} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

function AccountSkeleton() {
  return (
    <div aria-hidden>
      <Section spacing="sm" tone="muted" className="border-b">
        <Container className="flex items-center gap-4">
          <SkeletonAvatar />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-7 w-56" />
            <Skeleton className="h-4 w-72" />
          </div>
        </Container>
      </Section>
      <Section spacing="md">
        <Container className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <SkeletonCard />
          <SkeletonCard />
        </Container>
      </Section>
    </div>
  );
}

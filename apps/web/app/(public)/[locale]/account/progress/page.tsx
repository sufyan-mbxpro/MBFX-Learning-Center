import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Container } from "@repo/ui/components/container";
import { Section } from "@repo/ui/components/section";
import { Skeleton, SkeletonAvatar, SkeletonCard } from "@repo/ui/components/skeleton";
import { ProgressContent } from "./_components/progress-content.tsx";
import { titleTemplate, titleFrom } from "../../../../_lib/seo.ts";

// `/account/progress` — the learner's courses, quiz attempts and reading
// (ADR-125 §1). The same shape as `/account` (ADR-123 §1): a static shell, and
// one session-reading body inside `<Suspense>`.

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/account/progress">): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, template] = await Promise.all([
    getTranslations({ locale, namespace: "account" }),
    titleTemplate(),
  ]);
  return {
    title: titleFrom(template, t("progressMetaTitle")),
    // A private page: nothing to index, and nothing on it to follow either.
    robots: { index: false, follow: false },
  };
}

export default async function AccountProgressPage({
  params,
}: PageProps<"/[locale]/account/progress">) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main className="flex flex-col">
      <Suspense fallback={<ProgressSkeleton />}>
        <ProgressContent locale={locale} />
      </Suspense>
    </main>
  );
}

function ProgressSkeleton() {
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
        <Container className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </Container>
      </Section>
    </div>
  );
}

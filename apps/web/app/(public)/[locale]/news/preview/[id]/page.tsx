import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { loadArticleAdminDetail } from "@repo/core";
import { requireAnyPermission } from "@repo/rbac";

// Draft preview (ADR-015 #10): session-gated, not token-gated — a signed-in
// staff subject with either article key sees any status rendered in the
// public layout. Unauthenticated/unauthorized → 404, not 403: draft
// EXISTENCE is sensitive (security.md #7). Never indexed, never cached.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function ArticlePreviewPage({
  params,
}: PageProps<"/[locale]/news/preview/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  try {
    await requireAnyPermission(["analysis.view", "news.manage"]);
  } catch {
    notFound();
  }

  const [t, detail] = await Promise.all([getTranslations("news"), loadArticleAdminDetail(id)]);
  if (!detail) notFound();

  const translation =
    detail.translations.find((tr) => tr.locale === locale) ??
    detail.translations.find((tr) => tr.locale === "en") ??
    detail.translations[0];
  if (!translation) notFound();

  return (
    <main className="container-page container-narrow section-md flex flex-col gap-6">
      <p className="rounded-lg border border-warning-interactive/40 bg-card p-3 text-sm font-medium">
        {t("draftPreviewBanner", { status: detail.status })}
      </p>
      <h1 className="text-3xl leading-tight font-semibold">{translation.title}</h1>
      {translation.excerpt && (
        <p className="text-lg text-muted-foreground">{translation.excerpt}</p>
      )}
      {translation.body && (
        /* Body is sanitized on save (ADR-009) — same boundary as the live page. */
        <div
          className="flex flex-col gap-4 leading-relaxed [&_a]:text-primary-interactive [&_blockquote]:border-s-2 [&_blockquote]:ps-4 [&_blockquote]:text-muted-foreground [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:font-mono [&_code]:text-sm [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:text-lg [&_h3]:font-semibold [&_h4]:font-semibold [&_img]:rounded-lg [&_ol]:list-decimal [&_ol]:ps-5 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-4 [&_table]:w-full [&_table]:text-sm [&_td]:border [&_td]:p-2 [&_th]:border [&_th]:bg-muted/40 [&_th]:p-2 [&_th]:text-start [&_ul]:list-disc [&_ul]:ps-5"
          dangerouslySetInnerHTML={{ __html: translation.body }}
        />
      )}
    </main>
  );
}

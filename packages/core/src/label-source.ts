// The translatable SOURCE of the short labels (ADR-159 #3, Phase 5): article
// categories and tags, and menu items. Labels are published with no indexing
// restriction — they are names, not prose — but they still carry a status and
// a hash, so a person's translation is flagged when the English moves on and
// a machine one is refreshed.
import { computeSourceHash } from "@repo/i18n";
import type { Prisma } from "@repo/db";

export interface ArticleCategorySource {
  slug: string;
  name: string;
  description: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
}

export function hashArticleCategorySource(s: ArticleCategorySource): string {
  return computeSourceHash(
    JSON.stringify([s.name, s.description ?? "", s.seoTitle ?? "", s.seoDescription ?? ""]),
  );
}

export async function loadArticleCategorySource(
  client: Pick<Prisma.TransactionClient, "articleCategoryTranslation">,
  categoryId: string,
  defaultLocale: string,
): Promise<ArticleCategorySource | null> {
  return client.articleCategoryTranslation.findUnique({
    where: { categoryId_locale: { categoryId, locale: defaultLocale } },
    select: { slug: true, name: true, description: true, seoTitle: true, seoDescription: true },
  });
}

export interface ArticleTagSource {
  slug: string;
  name: string;
}

export function hashArticleTagSource(s: ArticleTagSource): string {
  return computeSourceHash(JSON.stringify([s.name]));
}

export async function loadArticleTagSource(
  client: Pick<Prisma.TransactionClient, "articleTagTranslation">,
  tagId: string,
  defaultLocale: string,
): Promise<ArticleTagSource | null> {
  return client.articleTagTranslation.findUnique({
    where: { tagId_locale: { tagId, locale: defaultLocale } },
    select: { slug: true, name: true },
  });
}

export interface MenuItemSource {
  label: string;
  title: string | null;
}

export function hashMenuItemSource(s: MenuItemSource): string {
  return computeSourceHash(JSON.stringify([s.label, s.title ?? ""]));
}

export async function loadMenuItemSource(
  client: Pick<Prisma.TransactionClient, "menuItemTranslation">,
  menuItemId: string,
  defaultLocale: string,
): Promise<MenuItemSource | null> {
  return client.menuItemTranslation.findUnique({
    where: { menuItemId_locale: { menuItemId, locale: defaultLocale } },
    select: { label: true, title: true },
  });
}

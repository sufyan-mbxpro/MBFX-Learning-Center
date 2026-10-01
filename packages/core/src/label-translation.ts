// Machine translation of the short labels (Phase 5, ADR-159 #3): article
// categories and tags, and menu items. All plain text.
import {
  hashArticleCategorySource,
  hashArticleTagSource,
  hashMenuItemSource,
  loadArticleCategorySource,
  loadArticleTagSource,
  loadMenuItemSource,
  type ArticleCategorySource,
  type ArticleTagSource,
  type MenuItemSource,
} from "./label-source.ts";
import { defineTranslatable, pickTranslationSlug } from "./translation-engine.ts";
import { TRANSLATION_TABLES } from "./translation-queue.ts";

const orNull = (original: string | null, value: string | undefined) =>
  original === null || original.trim() === "" ? null : (value ?? null);

export const articleCategoryTranslatable = defineTranslatable<ArticleCategorySource>({
  entityType: "article_category",
  ...TRANSLATION_TABLES.article_category,
  parentTable: "article_categories",
  titleColumn: "name",
  updatedAtColumn: "updatedAt",
  loadSource: loadArticleCategorySource,
  hash: hashArticleCategorySource,
  segments: (s) => [
    { key: "name", kind: "text", text: s.name, max: 100 },
    { key: "description", kind: "text", text: s.description ?? "", max: 500 },
    { key: "seoTitle", kind: "text", text: s.seoTitle ?? "", max: 70 },
    { key: "seoDescription", kind: "text", text: s.seoDescription ?? "", max: 180 },
  ],
  async write(tx, { entityId, locale, source, translated: t, status, hash, exists }) {
    const data = {
      name: t.name ?? source.name,
      description: orNull(source.description, t.description),
      seoTitle: orNull(source.seoTitle, t.seoTitle),
      seoDescription: orNull(source.seoDescription, t.seoDescription),
      translationStatus: status,
      sourceHash: hash,
    };
    if (exists) {
      await tx.articleCategoryTranslation.update({
        where: { categoryId_locale: { categoryId: entityId, locale } },
        data,
      });
    } else {
      await tx.articleCategoryTranslation.create({
        data: {
          categoryId: entityId,
          locale,
          slug: await pickTranslationSlug(
            tx,
            TRANSLATION_TABLES.article_category,
            entityId,
            locale,
            source.slug,
          ),
          ...data,
        },
      });
    }
  },
});

export const articleTagTranslatable = defineTranslatable<ArticleTagSource>({
  entityType: "article_tag",
  ...TRANSLATION_TABLES.article_tag,
  parentTable: "article_tags",
  titleColumn: "name",
  updatedAtColumn: "updatedAt",
  loadSource: loadArticleTagSource,
  hash: hashArticleTagSource,
  segments: (s) => [{ key: "name", kind: "text", text: s.name, max: 100 }],
  async write(tx, { entityId, locale, source, translated: t, status, hash, exists }) {
    const data = { name: t.name ?? source.name, translationStatus: status, sourceHash: hash };
    if (exists) {
      await tx.articleTagTranslation.update({
        where: { tagId_locale: { tagId: entityId, locale } },
        data,
      });
    } else {
      await tx.articleTagTranslation.create({
        data: {
          tagId: entityId,
          locale,
          slug: await pickTranslationSlug(
            tx,
            TRANSLATION_TABLES.article_tag,
            entityId,
            locale,
            source.slug,
          ),
          ...data,
        },
      });
    }
  },
});

export const menuItemTranslatable = defineTranslatable<MenuItemSource>({
  entityType: "menu_item",
  ...TRANSLATION_TABLES.menu_item,
  parentTable: "menu_items",
  titleColumn: "label",
  loadSource: loadMenuItemSource,
  hash: hashMenuItemSource,
  segments: (s) => [
    { key: "label", kind: "text", text: s.label, max: 150 },
    { key: "title", kind: "text", text: s.title ?? "", max: 255 },
  ],
  async write(tx, { entityId, locale, source, translated: t, status, hash }) {
    const data = {
      label: t.label ?? source.label,
      title: orNull(source.title, t.title),
      translationStatus: status,
      sourceHash: hash,
    };
    await tx.menuItemTranslation.upsert({
      where: { menuItemId_locale: { menuItemId: entityId, locale } },
      update: data,
      create: { menuItemId: entityId, locale, ...data },
    });
  },
});

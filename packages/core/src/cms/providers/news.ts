import { ArticleKind } from "@repo/db";
import type { CollectionProvider } from "@repo/contracts";
import { createArticleProvider } from "./article-provider.ts";

export const newsProvider: CollectionProvider = createArticleProvider({
  key: "news",
  labelKey: "cms.providers.news.label",
  kinds: [ArticleKind.NEWS],
});

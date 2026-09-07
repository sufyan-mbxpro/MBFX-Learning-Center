import { ArticleKind } from "@repo/db";
import type { CollectionProvider } from "@repo/contracts";
import { createArticleProvider } from "./article-provider.ts";

export const analysisProvider: CollectionProvider = createArticleProvider({
  key: "analysis",
  labelKey: "cms.providers.analysis.label",
  kinds: [ArticleKind.ANALYSIS],
});

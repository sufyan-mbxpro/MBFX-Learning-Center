import { ArticleKind } from "@repo/db";
import type { CollectionProvider } from "@repo/contracts";
import { createArticleProvider } from "./article-provider.ts";

export const tradeIdeaProvider: CollectionProvider = createArticleProvider({
  key: "trade-idea",
  labelKey: "cms.providers.tradeIdea.label",
  kinds: [ArticleKind.TRADE_IDEA],
});

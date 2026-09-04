import type { ArticlesSubnavItem } from "./articles-subnav.tsx";

/** The four destinations every News & Analysis screen shares. Settings is
 * the dynamic settings-group page — the `articles` group renders there. */
export function articlesSubnavItems(labels: {
  articles: string;
  categories: string;
  tags: string;
  settings: string;
}): ArticlesSubnavItem[] {
  return [
    { href: "/admin/articles", label: labels.articles },
    { href: "/admin/articles/categories", label: labels.categories },
    { href: "/admin/articles/tags", label: labels.tags },
    { href: "/admin/settings/articles", label: labels.settings },
  ];
}

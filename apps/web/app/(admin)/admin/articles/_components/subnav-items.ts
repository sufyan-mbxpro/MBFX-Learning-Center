import type { ArticlesSubnavItem } from "./articles-subnav.tsx";

/** The five destinations every News & Analysis screen shares. Settings is
 * the dynamic settings-group page — the `articles` group renders there.
 * Media points at the standalone Content → Media screen (not a News &
 * Analysis–owned resource) so editors can reach cover-image upload/reuse
 * without leaving the section. */
export function articlesSubnavItems(labels: {
  articles: string;
  categories: string;
  tags: string;
  media: string;
  settings: string;
}): ArticlesSubnavItem[] {
  return [
    { href: "/admin/articles", label: labels.articles },
    { href: "/admin/articles/categories", label: labels.categories },
    { href: "/admin/articles/tags", label: labels.tags },
    { href: "/admin/media", label: labels.media },
    { href: "/admin/settings/articles", label: labels.settings },
  ];
}

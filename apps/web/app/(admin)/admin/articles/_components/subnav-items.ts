import type { ArticlesSubnavItem } from "./articles-subnav.tsx";

/**
 * The three screens the News & Analysis section owns.
 *
 * It used to carry five (ADR-106 removed two). **Media** went because
 * `/admin/media` is not a News & Analysis resource — it is the standalone
 * Content → Media library, reachable from the sidebar, and a tab that leaves
 * the section makes the strip's active state meaningless the moment you use
 * it. **Settings** went for the same reason and came back as a button in the
 * section heading, where an off-section destination belongs.
 */
export function articlesSubnavItems(labels: {
  articles: string;
  categories: string;
  tags: string;
}): ArticlesSubnavItem[] {
  return [
    { href: "/admin/articles", label: labels.articles, exact: true },
    { href: "/admin/articles/categories", label: labels.categories },
    { href: "/admin/articles/tags", label: labels.tags },
  ];
}

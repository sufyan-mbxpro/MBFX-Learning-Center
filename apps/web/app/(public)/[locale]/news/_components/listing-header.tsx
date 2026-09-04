// Listing page header (changes-04 image-10): centred title with a
// breadcrumb trail beneath it, on a muted band.
//
// Its own component rather than the admin's Breadcrumbs: nothing under
// app/(public) may import from app/(admin) (architecture.md #5), and the
// public trail is a two-level "Home · Section" rather than the admin's
// path-derived one.
import { getTranslations } from "next-intl/server";
import { getSetting } from "@repo/settings";
import { Link } from "@repo/i18n/navigation";
import { Container } from "@repo/ui/components/container";
import { Section } from "@repo/ui/components/section";

export interface Crumb {
  label: string;
  /** Omitted for the current page — the last crumb is not a link. */
  href?: string;
}

export async function ListingHeader({
  title,
  intro,
  crumbs,
}: {
  title: string;
  intro?: string;
  crumbs?: Crumb[];
}) {
  const [t, showBreadcrumbs] = await Promise.all([
    getTranslations("nav"),
    // The setting has existed since Module 08 but nothing on the public
    // surface honoured it until now.
    getSetting("layout.showBreadcrumbs"),
  ]);

  const trail: Crumb[] = [{ label: t("home"), href: "/" }, ...(crumbs ?? [])];

  return (
    <Section tone="muted" spacing="sm">
      <Container className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-display-sm font-semibold">{title}</h1>

        {showBreadcrumbs !== false && trail.length > 1 && (
          <nav aria-label={t("breadcrumb")}>
            <ol className="flex flex-wrap items-center justify-center gap-x-2 text-sm text-muted-foreground">
              {trail.map((crumb, index) => (
                <li key={`${crumb.label}-${index}`} className="flex items-center gap-2">
                  {index > 0 && <span aria-hidden>·</span>}
                  {crumb.href ? (
                    <Link href={crumb.href} className="link-underline hover:text-foreground">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span aria-current="page" className="text-foreground">
                      {crumb.label}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        )}

        {intro && <p className="max-w-2xl text-muted-foreground">{intro}</p>}
      </Container>
    </Section>
  );
}

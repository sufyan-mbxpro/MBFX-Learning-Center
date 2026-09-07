import { registerBlock } from "../registry.ts";
import type { BlockComponentProps } from "../registry.ts";
import { BREADCRUMB_PROVIDER, definition, type BreadcrumbProps } from "./definition.ts";

interface Crumb {
  label: string;
  href: string | null;
}

function isCrumbList(value: unknown): value is Crumb[] {
  return (
    Array.isArray(value) && value.every((v) => typeof v === "object" && v !== null && "label" in v)
  );
}

function BreadcrumbBlock({ resolvedData }: BlockComponentProps<BreadcrumbProps>) {
  const data = resolvedData?.[BREADCRUMB_PROVIDER];
  if (!isCrumbList(data) || data.length === 0) return null;
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
        {data.map((crumb, i) => (
          <li key={i} className="flex items-center gap-1">
            {i > 0 && <span aria-hidden>/</span>}
            {crumb.href ? (
              <a href={crumb.href} className="hover:text-foreground hover:underline">
                {crumb.label}
              </a>
            ) : (
              <span>{crumb.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

registerBlock(definition, BreadcrumbBlock);

export { BreadcrumbBlock };

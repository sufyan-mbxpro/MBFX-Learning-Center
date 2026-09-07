// Shared card rendering (ADR-023) — the one place `collection` and
// `featured-content` turn a `CollectionItem` + a resolved `CardTemplate`
// into markup. `variant` picks which of these four layouts runs (the
// "code-owned floor" ADR-023's own Alternatives section describes);
// `config` customises within it — field visibility/order, image ratio,
// excerpt length. Never colours/spacing/arbitrary classes (ADR-024).
import type { CardConfig, CardField, CollectionItem } from "@repo/contracts";
import { cn } from "@repo/ui/lib/utils";

/** Matches `cardConfigSchema`'s own Zod defaults — used when a block has no `cardTemplateId` at all, or the id didn't resolve to a real row (ADR-023: "a page never 500s because a card template vanished"). */
export const DEFAULT_CARD_CONFIG: CardConfig = {
  version: 1,
  fields: ["image", "category", "title", "excerpt", "date"],
  imageAspectRatio: "video",
  excerptLength: 160,
};

const ASPECT_CLASS: Record<CardConfig["imageAspectRatio"], string> = {
  square: "aspect-square",
  video: "aspect-video",
  portrait: "aspect-[3/4]",
};

function truncate(text: string, max: number): string {
  if (max <= 0 || text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 0 ? lastSpace : max)}…`;
}

function has(fields: CardField[], field: CardField): boolean {
  return fields.includes(field);
}

function CardImage({
  item,
  config,
  className,
}: {
  item: CollectionItem;
  config: CardConfig;
  className?: string;
}) {
  if (!has(config.fields, "image") || !item.imageUrl) return null;
  return (
    <img
      src={item.imageUrl}
      alt=""
      className={cn(
        "w-full rounded-md object-cover",
        ASPECT_CLASS[config.imageAspectRatio],
        className,
      )}
    />
  );
}

function CardMeta({
  item,
  locale,
  dateOnly,
}: {
  item: CollectionItem;
  locale: string;
  dateOnly?: boolean;
}) {
  if (!item.date) return null;
  return (
    <time
      dateTime={item.date.toISOString()}
      className={cn("text-xs text-muted-foreground", dateOnly && "block")}
    >
      {new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(item.date)}
    </time>
  );
}

function CardCategory({ item }: { item: CollectionItem }) {
  if (!item.category) return null;
  return <span className="text-xs font-medium uppercase text-primary">{item.category.label}</span>;
}

/** `standard`/`featured` share one vertical layout — `featured` differs only in a larger title (the config's `fields`/ratio/length already carry any other difference an admin authored). */
function verticalCard(item: CollectionItem, config: CardConfig, locale: string, featured: boolean) {
  const { fields } = config;
  return (
    <a
      key={item.id}
      href={item.href}
      className="group flex flex-col gap-3 rounded-lg border border-border p-4 transition-colors hover:border-primary"
    >
      <CardImage item={item} config={config} />
      <div className="flex flex-col gap-1">
        {/* "author" is a valid CardField (ADR-023's "meta fields") but
            `CollectionItem` carries no author info yet — a real,
            named future extension, not rendered here. */}
        {has(fields, "category") && (
          <div className="flex flex-wrap items-center gap-2">
            <CardCategory item={item} />
          </div>
        )}
        {has(fields, "title") && (
          <h3
            className={cn(
              "font-semibold group-hover:underline",
              featured ? "text-xl" : "text-base",
            )}
          >
            {item.title}
          </h3>
        )}
        {has(fields, "excerpt") && item.excerpt && (
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {truncate(item.excerpt, config.excerptLength)}
          </p>
        )}
        {has(fields, "date") && <CardMeta item={item} locale={locale} />}
      </div>
    </a>
  );
}

function compactCard(item: CollectionItem, config: CardConfig, locale: string) {
  const { fields } = config;
  return (
    <a
      key={item.id}
      href={item.href}
      className="group flex items-center justify-between gap-4 border-b border-border py-3"
    >
      <div className="flex flex-col gap-0.5">
        {has(fields, "category") && <CardCategory item={item} />}
        {has(fields, "title") && (
          <span className="font-medium group-hover:underline">{item.title}</span>
        )}
      </div>
      {has(fields, "date") && <CardMeta item={item} locale={locale} />}
    </a>
  );
}

function horizontalCard(item: CollectionItem, config: CardConfig, locale: string) {
  const { fields } = config;
  return (
    <a
      key={item.id}
      href={item.href}
      className="group flex items-center gap-4 rounded-lg border border-border p-4 transition-colors hover:border-primary"
    >
      <CardImage item={item} config={config} className="w-28 shrink-0" />
      <div className="flex flex-col gap-1">
        {has(fields, "category") && <CardCategory item={item} />}
        {has(fields, "title") && (
          <h3 className="font-semibold group-hover:underline">{item.title}</h3>
        )}
        {has(fields, "excerpt") && item.excerpt && (
          <p className="line-clamp-1 text-sm text-muted-foreground">
            {truncate(item.excerpt, config.excerptLength)}
          </p>
        )}
        {has(fields, "date") && <CardMeta item={item} locale={locale} />}
      </div>
    </a>
  );
}

export function renderCard(
  item: CollectionItem,
  variant: string,
  config: CardConfig,
  locale: string,
) {
  switch (variant) {
    case "compact":
      return compactCard(item, config, locale);
    case "horizontal":
      return horizontalCard(item, config, locale);
    case "featured":
      return verticalCard(item, config, locale, true);
    default:
      return verticalCard(item, config, locale, false);
  }
}

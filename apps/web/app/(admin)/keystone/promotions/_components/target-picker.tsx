"use client";

// The link picker (ADR-167 #4): choose a course, lesson, quiz, article, video,
// glossary term or tool to point a promotion at.
//
// Drafts are offered on purpose, labelled with their status: an editor
// announcing next week's course must be able to pick it today. The picker then
// says, in words, that the promotion stays hidden until that content is
// public — the list screen repeats it — because an active promotion that shows
// nowhere is otherwise an unexplained bug.
//
// Search runs through a server action gated on `promotions.view`, debounced,
// and matches titles in the default language only (the service's rule).
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Search, TriangleAlert, X } from "lucide-react";
import type { PromotionTargetTypeInput } from "@repo/contracts";
import type { LinkableContent } from "@repo/core";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { searchPromotionTargetsAction } from "../../_actions/promotion-actions.ts";
import { AdminCombobox } from "../../_components/combobox.tsx";
import { Field } from "../../_components/editor/editor-section.tsx";
import { contentStatusLabels } from "../../learn/_lib/learn-labels.ts";

export interface TargetChoice {
  type: PromotionTargetTypeInput;
  id: string;
  title: string | null;
  isPublic: boolean;
  /** False when the stored target was deleted since — saving will be refused. */
  exists: boolean;
}

const SEARCH_DELAY_MS = 250;

export function TargetPicker({
  label,
  value,
  onChange,
  types,
  required,
  error,
  disabled,
}: {
  label: string;
  value: TargetChoice | null;
  onChange: (next: TargetChoice | null) => void;
  /** Restrict to these types (the recording picker passes VIDEO_TOPIC). */
  types: readonly PromotionTargetTypeInput[];
  required?: boolean;
  error?: string;
  disabled?: boolean;
}) {
  const t = useTranslations("admin.promotions");
  const tAdmin = useTranslations("admin");
  // ADR-044 #5: the module's own status words, never the enum recased.
  const contentStatuses = contentStatusLabels(tAdmin);
  const [type, setType] = useState<string>(types.length === 1 ? (types[0] ?? "") : "");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LinkableContent[] | null>(null);
  const [searching, setSearching] = useState(false);
  const searchOpen = value === null && !disabled;
  // A string, not the array: a caller passing `["VIDEO_TOPIC"]` inline makes a
  // new array every render, and an array dependency would search in a loop.
  const typesKey = types.join(",");

  useEffect(() => {
    if (!searchOpen) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setSearching(true);
      searchPromotionTargetsAction(query, type)
        .then((found) => {
          const allowed = typesKey.split(",");
          if (!cancelled) setResults(found.filter((item) => allowed.includes(item.type)));
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, SEARCH_DELAY_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, type, searchOpen, typesKey]);

  if (value) {
    return (
      <Field label={label} required={required} error={error}>
        <div className="flex min-w-0 flex-col gap-2 rounded-md border p-3">
          <div className="flex min-w-0 items-center gap-2">
            <Badge variant="outline">{t(`targetTypes.${value.type}`)}</Badge>
            <span className="min-w-0 flex-1 truncate font-medium">{value.title ?? value.id}</span>
            {!disabled && (
              <Button variant="outline" size="sm" onClick={() => onChange(null)}>
                <X aria-hidden data-icon="inline-start" />
                {t("targetChange")}
              </Button>
            )}
          </div>
          {!value.exists ? (
            <p className="flex items-center gap-1.5 text-xs text-destructive-interactive">
              <TriangleAlert aria-hidden className="size-3.5 shrink-0" />
              {t("targetMissingNow")}
            </p>
          ) : !value.isPublic ? (
            <p className="flex items-center gap-1.5 text-xs text-warning-interactive">
              <TriangleAlert aria-hidden className="size-3.5 shrink-0" />
              {t("targetNotPublic")}
            </p>
          ) : null}
        </div>
      </Field>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-2">
      {types.length > 1 && (
        <AdminCombobox
          aria-label={t("targetTypeLabel")}
          className="w-48"
          value={type}
          onValueChange={setType}
          disabled={disabled}
          options={[
            { value: "", label: t("targetAllTypes") },
            ...types.map((key) => ({ value: key, label: t(`targetTypes.${key}`) })),
          ]}
        />
      )}
      <Field label={label} required={required} error={error}>
        <div className="relative">
          <Search
            aria-hidden
            className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            className="ps-8"
            value={query}
            disabled={disabled}
            placeholder={t("targetSearchPlaceholder")}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      </Field>
      <div aria-live="polite" className="flex min-w-0 flex-col">
        {searching && results === null ? (
          <p className="py-2 text-xs text-muted-foreground">{t("targetSearching")}</p>
        ) : results && results.length === 0 ? (
          <p className="py-2 text-xs text-muted-foreground">{t("targetNoResults")}</p>
        ) : results ? (
          <ul className="flex max-h-64 flex-col overflow-y-auto rounded-md border">
            {results.map((item) => (
              <li key={`${item.type}:${item.id}`} className="border-b last:border-b-0">
                <button
                  type="button"
                  className="flex w-full min-w-0 items-center gap-2 px-3 py-2 text-start text-sm hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                  onClick={() =>
                    onChange({
                      type: item.type,
                      id: item.id,
                      title: item.title,
                      isPublic: item.isPublic,
                      exists: true,
                    })
                  }
                >
                  <span className="min-w-0 flex-1 truncate">{item.title}</span>
                  <Badge variant="outline">{t(`targetTypes.${item.type}`)}</Badge>
                  <Badge variant={item.isPublic ? "success" : "secondary"}>
                    {item.status === "ENABLED" || item.status === "DISABLED"
                      ? t(`targetStatuses.${item.status}`)
                      : (contentStatuses[item.status] ?? item.status)}
                  </Badge>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

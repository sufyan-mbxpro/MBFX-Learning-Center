"use client";

// The homepage section editor (changes-03-plan.md §12.4).
//
// `home.sections` is ONE JSON setting, so reordering is a local array move
// and Save submits a single batched entry — unlike MenuItemControls, whose
// arrows call a per-item action because each menu item is its own DB row.
// Same arrow idiom, no per-row round trip, no new server action.
import * as React from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Checkbox } from "@repo/ui/components/checkbox";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { updateSettingsAction } from "../_actions/admin-actions.ts";
import { useServerAction } from "../_hooks/use-server-action.ts";

export interface HomeSectionRow {
  key: string;
  enabled: boolean;
  variant: string | null;
  limit: number | null;
  /** Accepted variants, from HOME_SECTION_VARIANTS. Empty = takes none. */
  variants: string[];
  /** False when the section renders the public placeholder. */
  isBuilt: boolean;
}

export interface HomepageSectionsLabels {
  save: string;
  saved: string;
  moveUp: string;
  moveDown: string;
  enabled: string;
  variant: string;
  limit: string;
  noVariants: string;
  notBuilt: string;
  notBuiltHelp: string;
  empty: string;
}

/** Section keys are stored, not displayed raw — "latest_analysis" → "Latest analysis". */
function humanize(key: string): string {
  const spaced = key.replaceAll("_", " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function HomepageSections({
  rows,
  labels,
}: {
  rows: HomeSectionRow[];
  labels: HomepageSectionsLabels;
}) {
  const { run, pending } = useServerAction();
  const [draft, setDraft] = React.useState(rows);

  // No prop→state sync effect, deliberately (and the same shape as
  // SettingsGroupForm, which also holds edits in local state only):
  // `dirty` compares against the LIVE `rows` prop by value, so after a save
  // + router.refresh() the draft already equals the new server value and
  // the button disables itself. An effect here would be the classic
  // cascading-render anti-pattern for no gain. The tradeoff is that a
  // concurrent edit by another admin does not stream in — the last-write-
  // wins caveat recorded in changes-03-plan.md §12.9.
  const dirty = JSON.stringify(draft) !== JSON.stringify(rows);

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= draft.length) return;
    const next = [...draft];
    const [moved] = next.splice(index, 1);
    if (moved) next.splice(target, 0, moved);
    setDraft(next);
  };

  const update = (index: number, patch: Partial<HomeSectionRow>) =>
    setDraft((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  const submit = () => {
    // `order` is derived from position on save, so the stored value can
    // never disagree with what the admin just arranged.
    const value = draft.map((row, index) => ({
      key: row.key,
      enabled: row.enabled,
      order: index + 1,
      ...(row.variant ? { variant: row.variant } : {}),
      ...(row.limit ? { limit: row.limit } : {}),
    }));
    run(() => updateSettingsAction([{ key: "home.sections", value }]), {
      successMessage: labels.saved,
    });
  };

  if (draft.length === 0) {
    return <p className="text-sm text-muted-foreground">{labels.empty}</p>;
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <ol className="flex flex-col gap-3">
        {draft.map((row, index) => (
          <li
            key={row.key}
            className="flex flex-col gap-3 border-b pb-3 last:border-b-0 last:pb-0"
            data-section-key={row.key}
          >
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="icon-xs"
                  aria-label={`${labels.moveUp}: ${humanize(row.key)}`}
                  disabled={pending || index === 0}
                  onClick={() => move(index, -1)}
                >
                  <ArrowUp aria-hidden className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-xs"
                  aria-label={`${labels.moveDown}: ${humanize(row.key)}`}
                  disabled={pending || index === draft.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <ArrowDown aria-hidden className="size-3.5" />
                </Button>
              </div>

              <Checkbox
                id={`enabled-${row.key}`}
                aria-label={`${labels.enabled}: ${humanize(row.key)}`}
                checked={row.enabled}
                onCheckedChange={(next) => update(index, { enabled: next === true })}
              />

              <span className="text-sm font-medium">{humanize(row.key)}</span>
              <code className="text-xs text-muted-foreground">{row.key}</code>

              {!row.isBuilt && (
                <Badge variant="outline" title={labels.notBuiltHelp}>
                  {labels.notBuilt}
                </Badge>
              )}
            </div>

            <div className="flex flex-wrap items-end gap-4 ps-1">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`variant-${row.key}`} className="text-xs">
                  {labels.variant}
                </Label>
                {row.variants.length > 0 ? (
                  <Select
                    value={row.variant ?? ""}
                    onValueChange={(next) =>
                      update(index, { variant: (next as string | null) || null })
                    }
                  >
                    <SelectTrigger id={`variant-${row.key}`} className="w-48">
                      <SelectValue>{row.variant ?? row.variants[0]}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {row.variants.map((variant) => (
                        <SelectItem key={variant} value={variant}>
                          {variant}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  // No dropdown rather than an empty one (§12.4).
                  <p className="text-xs text-muted-foreground">{labels.noVariants}</p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`limit-${row.key}`} className="text-xs">
                  {labels.limit}
                </Label>
                <Input
                  id={`limit-${row.key}`}
                  type="number"
                  // Mirrors the Zod schema exactly — an out-of-range value is
                  // rejected server-side either way, this just says so first.
                  min={1}
                  max={24}
                  value={row.limit ?? ""}
                  className="w-24"
                  onChange={(e) =>
                    update(index, {
                      limit: e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                />
              </div>
            </div>
          </li>
        ))}
      </ol>

      <div className="flex items-center gap-3 border-t pt-4">
        <Button type="submit" disabled={pending || !dirty}>
          {labels.save}
        </Button>
      </div>
    </form>
  );
}

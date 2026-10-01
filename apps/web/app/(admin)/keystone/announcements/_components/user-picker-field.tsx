"use client";

// Select users (ADR-171, changes-54 §10.3): a searchable multi-select over
// LEARNERS only (owner, D3), 20 per query, capped at the contracts limit.
//
// Existing people only — there is no "paste addresses" box (owner, D4): an
// address that never signed up or subscribed gave no consent. The screen
// renders this control only for a viewer who also holds `users.view`; the
// action behind the search checks it again.
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import type { AnnouncementUserOption } from "@repo/core";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { searchAnnouncementUsersAction } from "../../_actions/announcement-actions.ts";

const SEARCH_DELAY_MS = 250;

export function UserPickerField({
  value,
  onChange,
  max,
}: {
  value: AnnouncementUserOption[];
  onChange: (next: AnnouncementUserOption[]) => void;
  max: number;
}) {
  const t = useTranslations("admin.announcements");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AnnouncementUserOption[]>([]);
  const full = value.length >= max;
  const trimmed = query.trim();

  useEffect(() => {
    if (full || trimmed === "") return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      searchAnnouncementUsersAction(trimmed)
        .then((found) => {
          if (!cancelled) setResults(found);
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        });
    }, SEARCH_DELAY_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [full, trimmed]);

  const picked = new Set(value.map((user) => user.id));
  const shown = trimmed === "" ? [] : results.filter((user) => !picked.has(user.id));

  return (
    <div className="flex flex-col gap-2">
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label={t("pickedUsers")}>
          {value.map((user) => (
            <li key={user.id}>
              <Badge variant="outline" className="gap-1 pe-1" title={user.email}>
                {user.name || user.email}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-2xs"
                  aria-label={t("removeChip", { name: user.name || user.email })}
                  onClick={() => onChange(value.filter((item) => item.id !== user.id))}
                >
                  <X aria-hidden />
                </Button>
              </Badge>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">
        {t("pickedUsersCount", { count: value.length, max })}
      </p>
      {!full && (
        <>
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("userSearchPlaceholder")}
            aria-label={t("userSearchPlaceholder")}
          />
          {trimmed !== "" && shown.length === 0 && (
            <p className="text-sm text-muted-foreground">{t("userNoResults")}</p>
          )}
          {shown.length > 0 && (
            <ul className="flex max-h-60 flex-col divide-y overflow-y-auto rounded-md border">
              {shown.map((user) => (
                <li key={user.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange([...value, user]);
                      setQuery("");
                    }}
                    className="flex w-full flex-col px-3 py-2 text-start text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                  >
                    <span className="font-medium">{user.name || user.email}</span>
                    <span className="text-xs text-muted-foreground">{user.email}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

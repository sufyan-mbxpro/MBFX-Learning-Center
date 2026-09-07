// See collection-search/client.tsx's comment: split out so `index.tsx`'s
// `registerBlock()` runs in the server module graph `render.tsx` reads
// from — a "use client" file's own top-level code never runs server-side.
"use client";

import { useEffect, useState } from "react";
import { Button } from "@repo/ui/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { cn } from "@repo/ui/lib/utils";
import type { BlockComponentProps } from "../registry.ts";
import { FallbackBlock } from "../fallback-block.tsx";
import type { CollectionFilterProps } from "./definition.ts";

function namespacedKey(bindingId: string, key: string): string {
  return bindingId === "main" ? key : `${bindingId}.${key}`;
}

export function CollectionFilterBlock({
  id,
  props,
  draft,
}: BlockComponentProps<CollectionFilterProps>) {
  const paramKey = namespacedKey(props.bindingId, props.filterKey);
  const pageKey = namespacedKey(props.bindingId, "page");
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    setActive(new URLSearchParams(window.location.search).get(paramKey));
  }, [paramKey]);

  function apply(value: string | null) {
    setActive(value);
    const params = new URLSearchParams(window.location.search);
    if (value) params.set(paramKey, value);
    else params.delete(paramKey);
    params.delete(pageKey);
    const query = params.toString();
    window.location.href = query
      ? `${window.location.pathname}?${query}`
      : window.location.pathname;
  }

  if (props.options.length === 0) {
    return draft ? (
      <FallbackBlock nodeId={id} reason="no filter options authored yet" draft={draft} />
    ) : null;
  }

  if (props.style === "dropdown") {
    return (
      <Select value={active ?? ""} onValueChange={(v) => apply(v || null)}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {props.options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
              {option.count !== undefined ? ` (${option.count})` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  // "pills" and "checkboxes" render the same single-select control today —
  // see definition.ts's comment on why a true multi-select isn't offered.
  return (
    <div
      className={cn("flex flex-wrap gap-2", props.style === "checkboxes" && "flex-col items-start")}
    >
      {props.options.map((option) => (
        <Button
          key={option.value}
          type="button"
          size="sm"
          variant={active === option.value ? "default" : "outline"}
          onClick={() => apply(active === option.value ? null : option.value)}
        >
          {option.label}
          {option.count !== undefined ? ` (${option.count})` : ""}
        </Button>
      ))}
    </div>
  );
}

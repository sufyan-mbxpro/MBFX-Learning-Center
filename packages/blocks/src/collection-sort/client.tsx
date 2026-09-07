// See collection-search/client.tsx's comment: split out so `index.tsx`'s
// `registerBlock()` runs in the server module graph `render.tsx` reads
// from — a "use client" file's own top-level code never runs server-side.
"use client";

import { useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import type { BlockComponentProps } from "../registry.ts";
import type { CollectionSortProps } from "./definition.ts";

function namespacedKey(bindingId: string, key: string): string {
  return bindingId === "main" ? key : `${bindingId}.${key}`;
}

export function CollectionSortBlock({ props }: BlockComponentProps<CollectionSortProps>) {
  const sortKey = namespacedKey(props.bindingId, "sort");
  const pageKey = namespacedKey(props.bindingId, "page");
  const [value, setValue] = useState(props.options[0]?.value ?? "");

  useEffect(() => {
    const current = new URLSearchParams(window.location.search).get(sortKey);
    if (current) setValue(current);
  }, [sortKey]);

  function handleChange(next: string | null) {
    if (!next) return;
    setValue(next);
    const params = new URLSearchParams(window.location.search);
    params.set(sortKey, next);
    params.delete(pageKey);
    window.location.href = `${window.location.pathname}?${params.toString()}`;
  }

  return (
    <Select value={value} onValueChange={handleChange}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {props.options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

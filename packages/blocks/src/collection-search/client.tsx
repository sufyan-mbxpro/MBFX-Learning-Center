// A client component using only browser globals (`window.location`), never
// `next/navigation` — `@repo/blocks` has no Next.js dependency (ADR-020;
// this package's own docs frame it as reusable by a future native
// renderer), so URL state here is read/written the same way any React app
// would, Next or not.
//
// Split from `index.tsx` on purpose: `index.tsx`'s `registerBlock()` call
// is a side effect of module import, and `render.tsx` (server-only) needs
// that side effect to actually run in ITS module graph. A "use client"
// file's top-level code does NOT run server-side when imported — Next
// replaces its exports with client references instead — so the
// `registerBlock()` call has to live in a plain server module that merely
// HOLDS a reference to this client component, not inside this file itself.
// Found live: without this split, every "collection-*" interactive block
// rendered as "unknown block type" in the composer preview, even though
// its definition was correctly registered (`ALL_BLOCK_DEFINITIONS`, a
// separate, db-free, client-safe module).
"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Search } from "lucide-react";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import type { BlockComponentProps } from "../registry.ts";
import type { CollectionSearchProps } from "./definition.ts";

function namespacedKey(bindingId: string, key: string): string {
  return bindingId === "main" ? key : `${bindingId}.${key}`;
}

export function CollectionSearchBlock({ props }: BlockComponentProps<CollectionSearchProps>) {
  const [value, setValue] = useState("");
  const qKey = namespacedKey(props.bindingId, "q");
  const pageKey = namespacedKey(props.bindingId, "page");

  // Pre-fills from the current URL after mount — this is a client
  // component precisely because the server render has no request URL of
  // its own to read (renderTree's needs pipeline doesn't thread one down
  // to presentational, data-free blocks like this one).
  useEffect(() => {
    setValue(new URLSearchParams(window.location.search).get(qKey) ?? "");
  }, [qKey]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams(window.location.search);
    if (value.trim()) params.set(qKey, value.trim());
    else params.delete(qKey);
    params.delete(pageKey); // a new search always starts back at page 1
    const query = params.toString();
    window.location.href = query
      ? `${window.location.pathname}?${query}`
      : window.location.pathname;
  }

  return (
    <form role="search" onSubmit={handleSubmit} className="flex gap-2">
      <Input
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={props.placeholder}
        aria-label={props.placeholder}
      />
      <Button type="submit" size="icon" variant="outline">
        <Search />
      </Button>
    </form>
  );
}

"use client";

// Command-palette primitives built on Base UI's Autocomplete, following its
// docs' own "Command palette" recipe (autocomplete inside a dialog).
// Deliberately NOT shadcn's `command`: that one depends on cmdk, which drags
// four @radix-ui packages into the tree — ADR-013 forbids a second primitive
// layer alongside Base UI.
//
// changes-20 / ADR-074 — styled to the reference's `command` recipe
// (tokens.md §6.14, capture-2): a border-b search row with a half-opacity
// glyph, an h-11 input, a 300px list, rounded-sm items highlighted in the
// warm --accent, and xs/medium muted group headings.
import * as React from "react";
import { Autocomplete } from "@base-ui/react/autocomplete";
import { SearchIcon } from "lucide-react";

import { cn } from "@repo/ui/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";

/** Always-open inline list — meant to live inside a CommandDialog. Pass
 * `items` (or `filteredItems` when filtering externally, e.g. against a
 * server search) exactly as Base UI's Autocomplete.Root accepts them. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Base UI Root's flat-vs-grouped `items` overloads collapse to `any` here; a single generic wrapper can't re-expose both shapes
function Command({ ...props }: Autocomplete.Root.Props<any>) {
  return (
    <Autocomplete.Root
      data-slot="command"
      open
      inline
      autoHighlight="always"
      keepHighlight
      {...props}
    />
  );
}

function CommandDialog({
  title,
  description,
  children,
  className,
  ...props
}: Omit<React.ComponentProps<typeof Dialog>, "children"> & {
  /** Dialog a11y name — visually hidden, required. */
  title: string;
  /** Dialog a11y description — visually hidden, required. */
  description: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Dialog {...props}>
      <DialogContent
        showCloseButton={false}
        className={cn("top-24 -translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-lg", className)}
        aria-label={title}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

function CommandInput({ className, ...props }: Autocomplete.Input.Props) {
  return (
    <div data-slot="command-input-wrapper" className="flex items-center border-b px-3">
      <SearchIcon aria-hidden className="me-2 size-4 shrink-0 opacity-50" />
      <Autocomplete.Input
        data-slot="command-input"
        className={cn(
          "flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
    </div>
  );
}

function CommandList({ className, ...props }: Autocomplete.List.Props) {
  return (
    <Autocomplete.List
      data-slot="command-list"
      className={cn(
        "max-h-75 scroll-py-1 overflow-x-hidden overflow-y-auto overscroll-contain p-1 outline-none",
        className,
      )}
      {...props}
    />
  );
}

function CommandEmpty({ className, ...props }: Autocomplete.Empty.Props) {
  return (
    <Autocomplete.Empty
      data-slot="command-empty"
      className={cn("py-6 text-center text-sm empty:hidden", className)}
      {...props}
    />
  );
}

function CommandGroup({ className, ...props }: Autocomplete.Group.Props) {
  return (
    <Autocomplete.Group
      data-slot="command-group"
      className={cn("overflow-hidden p-1 text-foreground", className)}
      {...props}
    />
  );
}

function CommandGroupLabel({ className, ...props }: Autocomplete.GroupLabel.Props) {
  return (
    <Autocomplete.GroupLabel
      data-slot="command-group-label"
      className={cn(
        "flex select-none items-center px-2 py-1.5 text-xs font-medium text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

function CommandCollection(props: Autocomplete.Collection.Props) {
  return <Autocomplete.Collection {...props} />;
}

function CommandItem({ className, ...props }: Autocomplete.Item.Props) {
  return (
    <Autocomplete.Item
      data-slot="command-item"
      className={cn(
        "relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none scroll-my-1 data-disabled:pointer-events-none data-disabled:opacity-50 data-highlighted:bg-accent data-highlighted:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    />
  );
}

export {
  Command,
  CommandCollection,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
  CommandList,
};

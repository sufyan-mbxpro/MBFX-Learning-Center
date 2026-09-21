"use client";

// The ⌘K palette's ONE shape (ADR-140 §5), shared by the public site search
// and the admin search so the two cannot drift apart again.
//
// Presentational and framework-agnostic: it knows nothing about Next.js,
// routing, fetching or permissions. A caller hands it already-resolved groups
// (label + icon + rows) and gets `onSelect(item)` back — navigation, the
// debounced fetch and the ⌘K listener stay in the app, which is also where
// the public/admin import boundary (architecture.md #5) is enforced.
//
// Four decisions worth knowing:
//
//   * **No row renders a URL.** A row is an icon tile, a title and an optional
//     one-line description. A path is an identifier, and code-style #5 already
//     forbids printing identifiers — `CommandPaletteItem` has no href field on
//     purpose, so a caller cannot pass one through by accident.
//   * **The input row IS the field.** The global `:focus-visible` ring drew an
//     inset box inside the row beside the magnifier (the owner's "not showing
//     the full input"). The input drops its own ring and the ROW carries the
//     focus indication — a 2px bottom rule in `--ring` while focus is inside.
//   * **Category chips filter the list, they do not re-query it.** They only
//     appear when two or more categories are present, and a chip whose
//     category disappears (a new query) falls back to "All" rather than
//     leaving an empty list behind a pressed chip.
//   * **Keyboard and ARIA come from Base UI's Autocomplete** (the `command.tsx`
//     primitives), i.e. a combobox input driving a listbox by
//     `aria-activedescendant`: ↑/↓ move across group boundaries, ↵ activates
//     the highlighted row, Esc closes the dialog.
import * as React from "react";
import { Autocomplete } from "@base-ui/react/autocomplete";
import { SearchIcon, XIcon, type LucideIcon } from "lucide-react";

import { cn } from "@repo/ui/lib/utils";
import { DialogClose } from "@repo/ui/components/dialog";
import { Kbd } from "@repo/ui/components/kbd";
import {
  Command,
  CommandCollection,
  CommandDialog,
  CommandGroup,
  CommandGroupLabel,
  CommandItem,
  CommandList,
} from "@repo/ui/components/command";

export interface CommandPaletteItem {
  /** Unique across the whole palette — it is the React key. */
  id: string;
  title: string;
  /** One muted line under the title. Never a URL or a raw identifier. */
  description?: string | null;
  /** Overrides the group's icon for this row. */
  icon?: LucideIcon;
}

export interface CommandPaletteGroup<Item extends CommandPaletteItem = CommandPaletteItem> {
  /** Stable key, also the filter chip's value. */
  id: string;
  /** Rendered as the small-caps heading and the chip's text. */
  label: string;
  /** The tile icon every row in the group shows unless it brings its own. */
  icon: LucideIcon;
  items: Item[];
}

export interface CommandPaletteLabels {
  /** Dialog name (visually hidden) and the input's accessible name. */
  title: string;
  /** Dialog description (visually hidden). */
  description: string;
  placeholder: string;
  /** The close button's accessible name. */
  close: string;
  /** The chip that clears the category filter. */
  filterAll: string;
  /** Accessible name of the chip group. */
  filterLabel: string;
  /** Footer legend words, beside their key caps. */
  legendOpen: string;
  legendNavigate: string;
  legendClose: string;
}

interface PaletteGroupValue<Item extends CommandPaletteItem> {
  value: string;
  label: string;
  icon: LucideIcon;
  items: Item[];
}

const ALL = "__all__";

export function CommandPalette<Item extends CommandPaletteItem>({
  open,
  onOpenChange,
  query,
  onQueryChange,
  groups,
  onSelect,
  emptyText,
  labels,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  query: string;
  onQueryChange: (query: string) => void;
  /** Already filtered for the query; drawn in the order given. Empty groups are dropped. */
  groups: CommandPaletteGroup<Item>[];
  onSelect: (item: Item) => void;
  /** What an empty list says — the caller knows whether that is "no match" or "type to search". */
  emptyText: string;
  labels: CommandPaletteLabels;
  className?: string;
}) {
  const [category, setCategory] = React.useState(ALL);

  const present = React.useMemo(() => groups.filter((group) => group.items.length > 0), [groups]);
  // A chip whose category left the results falls back to All — derived, not
  // an effect, so there is no render with an empty list behind a pressed chip.
  const active = present.some((group) => group.id === category) ? category : ALL;

  const visible: PaletteGroupValue<Item>[] = React.useMemo(
    () =>
      present
        .filter((group) => active === ALL || group.id === active)
        .map((group) => ({
          value: group.id,
          label: group.label,
          icon: group.icon,
          items: group.items,
        })),
    [present, active],
  );

  const handleOpenChange = (next: boolean) => {
    if (!next) setCategory(ALL);
    onOpenChange(next);
  };

  const select = (item: Item) => {
    setCategory(ALL);
    onSelect(item);
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={labels.title}
      description={labels.description}
      className={cn("flex max-h-(--height-palette) flex-col sm:max-w-3xl", className)}
    >
      <Command
        items={visible}
        filteredItems={visible}
        value={query}
        onValueChange={(next: string, details: { reason: string }) => {
          // Activating a row would otherwise write its title into the box and
          // fire a search for it on the way out.
          if (details.reason === "item-press") return;
          onQueryChange(next);
        }}
        itemToStringValue={(item: Item) => item.title}
      >
        <div
          data-slot="command-palette-input"
          className="relative flex shrink-0 items-center gap-3 border-b px-4 after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-ring after:opacity-0 after:transition-opacity focus-within:after:opacity-100"
        >
          <SearchIcon aria-hidden className="size-5 shrink-0 text-muted-foreground" />
          <Autocomplete.Input
            data-slot="command-palette-field"
            placeholder={labels.placeholder}
            aria-label={labels.title}
            className="h-14 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          <DialogClose
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            aria-label={labels.close}
          >
            <XIcon aria-hidden className="size-5" />
          </DialogClose>
        </div>

        {present.length > 1 && (
          <div
            role="group"
            aria-label={labels.filterLabel}
            data-slot="command-palette-filters"
            className="flex shrink-0 flex-wrap gap-2 border-b px-4 py-2.5"
          >
            <FilterChip pressed={active === ALL} onClick={() => setCategory(ALL)}>
              {labels.filterAll}
            </FilterChip>
            {present.map((group) => (
              <FilterChip
                key={group.id}
                pressed={active === group.id}
                onClick={() => setCategory(group.id)}
              >
                {group.label}
              </FilterChip>
            ))}
          </div>
        )}

        {/* Ours rather than `CommandEmpty`: Base UI's Empty stays silent for
            an empty box, and an empty box is exactly when the public palette
            has something to say ("type two or more letters"). */}
        {visible.length === 0 && (
          <p
            role="status"
            data-slot="command-palette-empty"
            className="shrink-0 px-4 py-10 text-center text-sm text-muted-foreground"
          >
            {emptyText}
          </p>
        )}
        <CommandList className="max-h-none min-h-0 flex-1 p-2">
          {(group: PaletteGroupValue<Item>) => (
            <CommandGroup key={group.value} items={group.items} className="p-0 pb-2">
              <CommandGroupLabel className="px-3 pt-3 pb-2 text-2xs font-semibold tracking-caps text-muted-foreground uppercase">
                {group.label}
              </CommandGroupLabel>
              <CommandCollection>
                {(item: Item) => {
                  const Icon = item.icon ?? group.icon;
                  return (
                    <CommandItem
                      key={item.id}
                      value={item}
                      onClick={() => select(item)}
                      className="gap-3 rounded-md px-3 py-2.5"
                    >
                      <span
                        aria-hidden
                        data-slot="command-palette-icon"
                        className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-muted text-foreground"
                      >
                        <Icon className="size-4" />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-medium">{item.title}</span>
                        {item.description && (
                          <span className="truncate text-xs text-muted-foreground">
                            {item.description}
                          </span>
                        )}
                      </span>
                    </CommandItem>
                  );
                }}
              </CommandCollection>
            </CommandGroup>
          )}
        </CommandList>

        <div
          data-slot="command-palette-legend"
          className="hidden shrink-0 items-center gap-4 border-t px-4 py-2.5 text-xs text-muted-foreground sm:flex"
        >
          <span className="inline-flex items-center gap-1.5">
            <Kbd>↵</Kbd>
            {labels.legendOpen}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd>
            {labels.legendNavigate}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Kbd>esc</Kbd>
            {labels.legendClose}
          </span>
        </div>
      </Command>
    </CommandDialog>
  );
}

function FilterChip({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "inline-flex h-7 items-center rounded-sm border px-2.5 text-xs font-medium transition-colors",
        pressed
          ? "border-primary bg-primary text-primary-foreground"
          : "bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground",
      )}
    >
      {children}
    </button>
  );
}

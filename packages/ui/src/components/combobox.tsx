"use client";

// The one dropdown every admin form uses (ADR-057).
//
// Two things the raw `select` primitive got wrong across ~46 call sites,
// both reported by the owner: a `w-fit` trigger that made a form control
// shrink to its current value, and no way to find an option in a list of
// thirty.
//
// This fixes both and, more importantly, makes the fix the DEFAULT — the
// rule is "admin dropdowns are searchable", so the decision cannot be left
// to whoever writes the next screen. It renders:
//
//   options.length >= SEARCHABLE_ITEM_THRESHOLD  ->  Base UI Combobox
//                                                    (search input in the popup)
//   fewer                                        ->  Base UI Select
//
// The threshold is not a style preference. Base UI's own usage guidance is
// explicit that a dropdown rendering no input should stay a Select, because
// the listbox-without-input role carries accessibility affordances Combobox
// does not; a search box over three options is both noise and a small a11y
// regression. So this switches PRIMITIVE, not merely the input's visibility
// — both branches keep correct semantics. Pass `searchable` to override in
// either direction when the call site knows better.
//
// Strings arrive as props — @repo/ui carries no catalogs (code-style.md #2).
// The admin surface wraps this in `AdminCombobox`, which supplies the
// catalog defaults so call sites don't thread them.
import * as React from "react";
import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox";
import { CheckIcon, ChevronsUpDownIcon, SearchIcon } from "lucide-react";

import { cn } from "@repo/ui/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  selectTriggerVariants,
  type SelectTriggerSize,
  SelectValue,
} from "@repo/ui/components/select";

/**
 * At or above this many options a dropdown gets a search input. Below it,
 * filtering costs more (an extra control, weaker listbox semantics) than
 * scanning a short list does. Exported so tests and the lint rule's
 * escape-hatch message can reference one number.
 */
export const SEARCHABLE_ITEM_THRESHOLD = 8;

export interface ComboboxOption {
  /** Submitted value. `""` is legal and is how "All"/"None" rows are modelled. */
  value: string;
  /**
   * Human label — already resolved through a catalog or `humanizeKey()`
   * (ADR-044 #5). Stays a plain string on purpose: it is what the search
   * input filters against, so it cannot be a node.
   */
  label: string;
  /** Optional glyph rendered before the label, in the list AND on the trigger. */
  icon?: React.ReactNode;
  disabled?: boolean;
}

/** Icon + label, identical in the popup and on the trigger. */
function OptionContent({ option }: { option: ComboboxOption }) {
  return (
    <span className="flex items-center gap-2">
      {option.icon}
      {option.label}
    </span>
  );
}

export interface ComboboxProps {
  options: ComboboxOption[];
  value: string;
  onValueChange: (value: string) => void;
  /** Trigger text when nothing is selected. */
  placeholder?: string;
  /** Search input placeholder. Only rendered on the searchable branch. */
  searchPlaceholder?: string;
  /** Shown when the search matches nothing. */
  emptyLabel?: string;
  /** Force the search input on or off. Defaults to the option-count threshold. */
  searchable?: boolean;
  id?: string;
  name?: string;
  disabled?: boolean;
  /** Applied to the trigger. Defaults to full width — override with `w-40` etc. in a toolbar. */
  className?: string;
  size?: SelectTriggerSize;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-invalid"?: boolean;
}

// Shared by both branches so a dropdown does not change shape when its list
// grows past the threshold. `w-full` is the default the owner asked for;
// tailwind-merge lets a toolbar call site override it with a narrower `w-*`.
const triggerClasses = (className?: string) => cn("w-full justify-between", className);

function Combobox({ searchable, ...props }: ComboboxProps) {
  const isSearchable = searchable ?? props.options.length >= SEARCHABLE_ITEM_THRESHOLD;
  return isSearchable ? <SearchableCombobox {...props} /> : <PlainCombobox {...props} />;
}

function PlainCombobox({
  options,
  value,
  onValueChange,
  placeholder,
  id,
  name,
  disabled,
  className,
  size = "default",
  // Consumed here rather than spread: the Select branch renders no input,
  // so these two would land on the trigger as dead attributes.
  searchPlaceholder: _searchPlaceholder,
  emptyLabel: _emptyLabel,
  ...aria
}: Omit<ComboboxProps, "searchable">) {
  const current = options.find((option) => option.value === value);
  return (
    <Select
      value={value}
      onValueChange={(next) => onValueChange(next ?? "")}
      disabled={disabled}
      name={name}
    >
      <SelectTrigger id={id} size={size} className={triggerClasses(className)} {...aria}>
        <SelectValue>{current ? <OptionContent option={current} /> : placeholder}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
            <OptionContent option={option} />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function SearchableCombobox({
  options,
  value,
  onValueChange,
  placeholder,
  searchPlaceholder,
  emptyLabel,
  id,
  name,
  disabled,
  className,
  size = "default",
  ...aria
}: Omit<ComboboxProps, "searchable">) {
  // Base UI keys selection on the item value itself. Holding the option
  // OBJECT (not its string) is what gives the popup its label, its filter
  // text and its checkmark for free — `{ value, label }` is the shape it
  // recognises without an `itemToStringLabel` prop.
  const selected = React.useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value],
  );

  return (
    <ComboboxPrimitive.Root
      items={options}
      value={selected}
      onValueChange={(next) => onValueChange(next?.value ?? "")}
      disabled={disabled}
      name={name}
    >
      <ComboboxPrimitive.Trigger
        data-slot="combobox-trigger"
        data-size={size}
        id={id}
        className={cn(selectTriggerVariants({ size }), triggerClasses(className))}
        {...aria}
      >
        {/* Combobox.Value renders no element of its own, so the truncation
            and alignment classes need a host — same job SelectValue does
            for the plain branch. */}
        <span data-slot="combobox-value" className="line-clamp-1 flex-1 text-start">
          <ComboboxPrimitive.Value placeholder={placeholder}>
            {(option: ComboboxOption | null) =>
              option ? <OptionContent option={option} /> : placeholder
            }
          </ComboboxPrimitive.Value>
        </span>
        <ComboboxPrimitive.Icon
          render={
            <ChevronsUpDownIcon className="pointer-events-none size-3.5 shrink-0 opacity-50" />
          }
        />
      </ComboboxPrimitive.Trigger>

      <ComboboxPrimitive.Portal>
        <ComboboxPrimitive.Positioner
          side="bottom"
          sideOffset={4}
          align="start"
          className="isolate z-50"
        >
          <ComboboxPrimitive.Popup
            data-slot="combobox-content"
            // `min-w`, not `w`: the trigger is the FLOOR of the popup's
            // width, not its ceiling. This is the other half of the owner's
            // "full length visible" report — a long option label used to be
            // truncated to whatever width the trigger happened to have.
            className="max-h-(--available-height) min-w-(--anchor-width) max-w-(--available-width) origin-(--transform-origin) overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
          >
            <div data-slot="combobox-input-wrapper" className="flex items-center border-b px-3">
              <SearchIcon aria-hidden className="me-2 size-4 shrink-0 opacity-50" />
              <ComboboxPrimitive.Input
                data-slot="combobox-input"
                placeholder={searchPlaceholder}
                className="h-11 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            <ComboboxPrimitive.Empty
              data-slot="combobox-empty"
              className="py-6 text-center text-sm empty:hidden"
            >
              {emptyLabel}
            </ComboboxPrimitive.Empty>
            <ComboboxPrimitive.List
              data-slot="combobox-list"
              className="max-h-75 scroll-py-1 overflow-x-hidden overflow-y-auto overscroll-contain p-1 empty:p-0"
            >
              {(option: ComboboxOption) => (
                <ComboboxPrimitive.Item
                  key={option.value}
                  value={option}
                  disabled={option.disabled}
                  data-slot="combobox-item"
                  className="relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pe-2 ps-8 text-sm outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50 data-highlighted:bg-accent data-highlighted:text-accent-foreground"
                >
                  <span className="flex-1 text-start">
                    <OptionContent option={option} />
                  </span>
                  <ComboboxPrimitive.ItemIndicator
                    render={
                      <span className="pointer-events-none absolute start-2 flex size-3.5 items-center justify-center" />
                    }
                  >
                    <CheckIcon className="pointer-events-none size-4" />
                  </ComboboxPrimitive.ItemIndicator>
                </ComboboxPrimitive.Item>
              )}
            </ComboboxPrimitive.List>
          </ComboboxPrimitive.Popup>
        </ComboboxPrimitive.Positioner>
      </ComboboxPrimitive.Portal>
    </ComboboxPrimitive.Root>
  );
}

export { Combobox };

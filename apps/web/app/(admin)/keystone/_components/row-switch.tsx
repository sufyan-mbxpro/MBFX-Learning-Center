"use client";

// A switch in a table row that commits on its own (changes-48 #2).
//
// Every list screen used to share ONE `useServerAction` across its rows and
// pass `disabled={pending}` to each switch, so flipping one tag greyed out
// every switch on the page until the refresh landed — the "whole table
// changes" effect. A row switch owns its transition instead: only the row
// that was touched is busy, it moves the moment it is pressed, and it snaps
// back if the action fails (the toast says why).
//
// Not `disabled` while saving — a greyed switch is the flicker this fixes. A
// press during the save is ignored, and `aria-busy` says so.
import { useState } from "react";
import { Switch } from "@repo/ui/components/switch";
import { useServerAction } from "../_hooks/use-server-action.ts";

export function RowSwitch({
  checked,
  onToggle,
  disabled,
  "aria-label": ariaLabel,
}: {
  /** The saved value. A refresh that changes it wins over the local one. */
  checked: boolean;
  /** The server action for the new value. */
  onToggle: (next: boolean) => Promise<unknown>;
  /** A permission, not a save in flight. */
  disabled?: boolean;
  "aria-label": string;
}) {
  const { run, pending } = useServerAction();
  const [value, setValue] = useState(checked);
  // Adopt a new saved value during render (React's "storing information from
  // previous renders"), not in an effect that would paint the stale one first.
  const [saved, setSaved] = useState(checked);
  if (saved !== checked) {
    setSaved(checked);
    setValue(checked);
  }

  return (
    <Switch
      checked={value}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-busy={pending || undefined}
      onCheckedChange={(next) => {
        if (pending) return;
        const previous = value;
        setValue(next);
        run(() => onToggle(next), { onError: () => setValue(previous) });
      }}
    />
  );
}

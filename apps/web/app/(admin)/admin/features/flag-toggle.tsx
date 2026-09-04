"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Checkbox } from "@repo/ui/components/checkbox";
import { toggleFeatureFlagAction } from "../_actions/admin-actions.ts";

export function FlagToggle({ flagKey, isEnabled }: { flagKey: string; isEnabled: boolean }) {
  const [checked, setChecked] = useState(isEnabled);
  const [, startTransition] = useTransition();

  return (
    <Checkbox
      aria-label={flagKey}
      checked={checked}
      onCheckedChange={(next) => {
        const value = next === true;
        setChecked(value);
        startTransition(async () => {
          try {
            await toggleFeatureFlagAction(flagKey, value);
          } catch (error) {
            setChecked(!value);
            toast.error(error instanceof Error ? error.message : String(error));
          }
        });
      }}
    />
  );
}

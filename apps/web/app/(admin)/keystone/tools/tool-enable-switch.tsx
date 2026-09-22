"use client";

// The one control on the tools list. Commits immediately rather than staging:
// it is a single boolean with no companion fields, and a Save button for one
// switch is a step nobody wants.
import { useState } from "react";
import { Field, FieldLabel } from "@repo/ui/components/field";
import { Switch } from "@repo/ui/components/switch";
import { setToolEnabledAction } from "../_actions/tool-actions.ts";
import { useServerAction } from "../_hooks/use-server-action.ts";

export function ToolEnableSwitch({
  toolKey,
  isEnabled,
  disabled,
  label,
}: {
  toolKey: string;
  isEnabled: boolean;
  disabled: boolean;
  label: string;
}) {
  const { run, pending } = useServerAction();
  const [checked, setChecked] = useState(isEnabled);

  return (
    <Field orientation="horizontal" className="w-auto">
      <Switch
        checked={checked}
        disabled={disabled || pending}
        onCheckedChange={(next) => {
          // Rolled forward optimistically and reverted on failure — the
          // action's own error toast is what the reader sees, and a switch
          // that snaps back is clearer than one that never moved.
          setChecked(next);
          run(() => setToolEnabledAction(toolKey, next), {
            onDone: () => undefined,
          });
        }}
      />
      <FieldLabel className="font-normal text-muted-foreground">{label}</FieldLabel>
    </Field>
  );
}

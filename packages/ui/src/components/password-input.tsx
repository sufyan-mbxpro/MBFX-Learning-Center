"use client";

import * as React from "react";
import { EyeIcon, EyeOffIcon } from "lucide-react";

import { cn } from "@repo/ui/lib/utils";
import { Input, type InputProps } from "@repo/ui/components/input";
import { useFieldContext } from "@repo/ui/components/field";

// changes-21 F1 (ADR-079 #8) — ONE password field. Six screens each rendered
// their own `<Input type="password">` and none of them could be revealed, so
// a mistyped password could only be found by retyping it.
//
// The toggle flips the SAME input's `type`, so focus and caret position
// survive (React keeps the element; it does not remount). The button is a
// real, focusable control: revealing a password is functionality, and
// functionality has to be reachable from the keyboard.
//
// Sizes mirror SearchInput's table: each input height gets a matched square
// button and its own end padding, so the two cannot drift apart.
const LAYOUT = {
  default: { button: "size-10", icon: "size-4", input: "pe-10" },
  sm: { button: "size-9", icon: "size-4", input: "pe-9" },
  xs: { button: "size-8", icon: "size-3.5", input: "pe-8" },
} as const;

interface PasswordInputProps extends Omit<InputProps, "type"> {
  /** Button label while the value is hidden — what the press will do. */
  showLabel: string;
  /** Button label while the value is visible. */
  hideLabel: string;
  /** Classes for the wrapper, when a layout sizes the field. */
  wrapperClassName?: string;
}

function PasswordInput({
  showLabel,
  hideLabel,
  className,
  wrapperClassName,
  size,
  id,
  disabled,
  ...props
}: PasswordInputProps) {
  const [visible, setVisible] = React.useState(false);
  const field = useFieldContext();
  const fallbackId = React.useId();
  // `aria-controls` needs the control's id, and inside a Field that id belongs
  // to the Field (ADR-077). Passing the same id straight back to Input is not
  // the "a control sets its own id" mistake that ADR forbids: `useFieldControl`
  // resolves `props.id ?? field.controlId`, so this resolves to the identical
  // value and the label keeps pointing at the input.
  const controlId = id ?? field?.controlId ?? fallbackId;
  const layout = LAYOUT[size ?? "default"];
  const Icon = visible ? EyeOffIcon : EyeIcon;

  return (
    <div data-slot="password-input" className={cn("relative w-full min-w-0", wrapperClassName)}>
      <Input
        id={controlId}
        type={visible ? "text" : "password"}
        size={size}
        disabled={disabled}
        // Edge and IE draw their own reveal control, which would sit under
        // ours and reveal the value without updating `aria-pressed`.
        className={cn(layout.input, "[&::-ms-reveal]:hidden", className)}
        {...props}
      />
      <button
        type="button"
        // The label says what the press will DO; `aria-pressed` says what the
        // field is NOW. Together they read "Show password, not pressed".
        aria-label={visible ? hideLabel : showLabel}
        aria-pressed={visible}
        aria-controls={controlId}
        disabled={disabled}
        onClick={() => setVisible((current) => !current)}
        className={cn(
          "absolute end-0 top-0 inline-flex items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
          layout.button,
        )}
      >
        <Icon aria-hidden className={layout.icon} />
      </button>
    </div>
  );
}

export { PasswordInput };
export type { PasswordInputProps };

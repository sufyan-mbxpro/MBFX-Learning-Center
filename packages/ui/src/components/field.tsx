"use client";

import {
  createContext,
  useCallback,
  useContext,
  useId,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@repo/ui/lib/utils";
import { Label } from "@repo/ui/components/label";
import { Separator } from "@repo/ui/components/separator";

// changes-21 Phase B (ADR-077) — a Field WIRES its control, it does not just
// lay it out. The base-nova registry shipped these as plain layout
// primitives, so every form hand-assembled `htmlFor`/`id`/`aria-*` — and
// every admin form had skipped it: errors went to a toast or to a `<p>` no
// screen reader connected to anything.
//
// Now a `Field` owns one set of ids and its state, and every piece reads
// them from context:
//
//   <Field invalid={!!error} required>
//     <FieldLabel>Name</FieldLabel>          ← htmlFor + the required asterisk
//     <Input value={…} onChange={…} />       ← id, required, aria-invalid, aria-describedby
//     <FieldDescription>…</FieldDescription> ← joins aria-describedby
//     <FieldError>{error}</FieldError>       ← joins aria-describedby while invalid
//   </Field>
//
// Every @repo/ui control calls `useFieldControl`, so none of it is written at
// a call site. A control that sets its own `id` inside a Field breaks the
// label's association — pass `controlId` to the Field instead.

interface FieldContextValue {
  controlId: string;
  labelId: string;
  descriptionId: string;
  errorId: string;
  invalid: boolean;
  required: boolean;
  /** The ids a control's aria-describedby should carry right now. */
  describedBy: string | undefined;
  registerDescription: () => () => void;
}

const FieldContext = createContext<FieldContextValue | null>(null);

/** The enclosing Field's ids and state, or null outside one. */
function useFieldContext() {
  return useContext(FieldContext);
}

interface FieldControlAria {
  id?: string;
  required?: boolean;
  "aria-invalid"?: React.AriaAttributes["aria-invalid"];
  "aria-describedby"?: string;
  "aria-required"?: React.AriaAttributes["aria-required"];
  "aria-labelledby"?: string;
}

/**
 * Merge the enclosing Field's wiring into a control's props. Explicit props
 * win, except `aria-describedby`, which is joined. Outside a Field the props
 * come back untouched.
 *
 * `requiredAs: "aria"` is for a control whose DOM node has no native
 * `required` (a dropdown trigger is a button): it becomes `aria-required`.
 *
 * **`labelledBy: true` is for a control that FORWARDS the `id` somewhere
 * else.** Base UI's Switch, Checkbox and Radio render a `role="…"` element
 * plus a visually-hidden native input, and they put the `id` they are given on
 * the INPUT — so `FieldLabel`'s `htmlFor` lands on an `aria-hidden` node and
 * the thing a screen reader actually reaches has no name at all. axe reports
 * it as `aria-toggle-field-name`, and it is invisible in a rendered page and
 * in a source review alike; changes-25's first axe run is what found it.
 * Pointing `aria-labelledby` at the label's own id names the control directly,
 * whatever the library does with `id`.
 */
function useFieldControl<P extends FieldControlAria>(
  props: P,
  {
    requiredAs = "native",
    labelledBy = false,
  }: { requiredAs?: "native" | "aria"; labelledBy?: boolean } = {},
): P {
  const field = useContext(FieldContext);
  if (!field) return props;
  const { required: ownRequired, ...rest } = props;
  const required = ownRequired ?? (field.required || undefined);
  const wired = {
    ...rest,
    id: props.id ?? field.controlId,
    "aria-invalid": props["aria-invalid"] ?? (field.invalid || undefined),
    "aria-describedby":
      [field.describedBy, props["aria-describedby"]].filter(Boolean).join(" ") || undefined,
    ...(labelledBy
      ? // Not forced: a call site that passed its own `aria-label` or
        // `aria-labelledby` meant it, and overriding would be the same bug
        // one level up.
        { "aria-labelledby": props["aria-labelledby"] ?? field.labelId }
      : {}),
  };
  // The casts only restore P: every key written above is one P already has.
  return requiredAs === "aria"
    ? ({ ...wired, "aria-required": props["aria-required"] ?? required } as unknown as P)
    : ({ ...wired, required } as unknown as P);
}

function FieldSet({ className, ...props }: React.ComponentProps<"fieldset">) {
  return (
    <fieldset
      data-slot="field-set"
      className={cn(
        "flex flex-col gap-4 has-[>[data-slot=checkbox-group]]:gap-3 has-[>[data-slot=radio-group]]:gap-3",
        className,
      )}
      {...props}
    />
  );
}

function FieldLegend({
  className,
  variant = "legend",
  ...props
}: React.ComponentProps<"legend"> & { variant?: "legend" | "label" }) {
  return (
    <legend
      data-slot="field-legend"
      data-variant={variant}
      className={cn(
        "mb-1.5 font-medium data-[variant=label]:text-sm data-[variant=legend]:text-base",
        className,
      )}
      {...props}
    />
  );
}

// tokens.md §3.2: fields in a form sit `space-y-4` apart.
function FieldGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-group"
      className={cn(
        "group/field-group @container/field-group flex w-full flex-col gap-4 data-[slot=checkbox-group]:gap-3 *:data-[slot=field-group]:gap-4",
        className,
      )}
      {...props}
    />
  );
}

// tokens.md §3.2: label → control `space-y-2`. The whole field is no longer
// tinted red when invalid (base-nova's `data-[invalid=true]:text-destructive`
// turned the TYPED VALUE red, in the raw red that fails 4.5:1 on the dark
// ground — audit F-03); the label and the message carry it instead.
const fieldVariants = cva("group/field flex w-full gap-2", {
  variants: {
    orientation: {
      // `*:w-full` is what makes an Input, a Textarea and a Combobox fill the
      // field — and it reached the Switch too, which has a FIXED 44×24
      // geometry (ADR-074). A 44px control stretched to the width of a rail
      // is not a switch any more; it is a bar (changes-26 #3). The exclusion
      // is written as a second, more specific rule rather than by narrowing
      // `*:`, so `[&>.sr-only]:w-auto` keeps winning the way it does today.
      vertical: "flex-col *:w-full [&>[data-slot=switch]]:w-11 [&>.sr-only]:w-auto",
      horizontal:
        "flex-row items-center has-[>[data-slot=field-content]]:items-start *:data-[slot=field-label]:flex-auto has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px",
      responsive:
        "flex-col *:w-full @md/field-group:flex-row @md/field-group:items-center @md/field-group:*:w-auto @md/field-group:has-[>[data-slot=field-content]]:items-start @md/field-group:*:data-[slot=field-label]:flex-auto [&>.sr-only]:w-auto @md/field-group:has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px",
    },
  },
  defaultVariants: {
    orientation: "vertical",
  },
});

function Field({
  className,
  orientation = "vertical",
  invalid = false,
  required = false,
  controlId,
  children,
  ...props
}: React.ComponentProps<"div"> &
  VariantProps<typeof fieldVariants> & {
    /** The control's value fails validation; its FieldError is showing. */
    invalid?: boolean;
    /** Marks the label with an asterisk and the control `required`. */
    required?: boolean;
    /** The control's id, when something outside the Field must know it. */
    controlId?: string;
  }) {
  const base = useId();
  const [descriptions, setDescriptions] = useState(0);
  const registerDescription = useCallback(() => {
    setDescriptions((n) => n + 1);
    return () => setDescriptions((n) => n - 1);
  }, []);

  const value = useMemo<FieldContextValue>(() => {
    const descriptionId = `${base}-description`;
    const errorId = `${base}-error`;
    // The error id joins while the field is INVALID rather than when a
    // FieldError registers: a registration lands one commit late, after the
    // form has already moved focus to the first invalid control, and the
    // screen reader would read that control without its message.
    const describedBy =
      [descriptions > 0 ? descriptionId : null, invalid ? errorId : null]
        .filter(Boolean)
        .join(" ") || undefined;
    return {
      controlId: controlId ?? `${base}-control`,
      labelId: `${base}-label`,
      descriptionId,
      errorId,
      invalid,
      required,
      describedBy,
      registerDescription,
    };
  }, [base, controlId, descriptions, invalid, required, registerDescription]);

  return (
    <FieldContext.Provider value={value}>
      <div
        role="group"
        data-slot="field"
        data-orientation={orientation}
        data-invalid={invalid || undefined}
        className={cn(fieldVariants({ orientation }), className)}
        {...props}
      >
        {children}
      </div>
    </FieldContext.Provider>
  );
}

function FieldContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-content"
      className={cn("group/field-content flex flex-1 flex-col gap-0.5 leading-snug", className)}
      {...props}
    />
  );
}

function FieldLabel({ className, children, ...props }: React.ComponentProps<typeof Label>) {
  const field = useContext(FieldContext);
  return (
    <Label
      data-slot="field-label"
      id={field?.labelId}
      htmlFor={field?.controlId}
      className={cn(
        "group/field-label peer/field-label flex w-fit gap-2 leading-snug group-data-[disabled=true]/field:opacity-50 group-data-[invalid=true]/field:text-destructive-interactive has-data-checked:border-primary/30 has-data-checked:bg-primary/5 has-[>[data-slot=field]]:rounded-lg has-[>[data-slot=field]]:border has-[>[data-slot=field]]:not-has-[:disabled,[data-disabled]]:hover:bg-muted/50 has-[>[data-slot=field]]:has-[:focus-visible]:border-ring has-[>[data-slot=field]]:has-[:focus-visible]:ring-2 has-[>[data-slot=field]]:has-[:focus-visible]:ring-ring *:data-[slot=field]:p-2.5 dark:has-data-checked:border-primary/20 dark:has-data-checked:bg-primary/10",
        "has-[>[data-slot=field]]:w-full has-[>[data-slot=field]]:flex-col",
        className,
      )}
      {...props}
    >
      {children}
      {field?.required && (
        // Decorative: the control's own `required` is what a screen reader
        // announces, so the glyph is hidden rather than read as "star".
        // `-ms-1` pulls it to 4px from the text inside the label's gap-2.
        <span data-slot="field-required" aria-hidden className="-ms-1 text-destructive-interactive">
          *
        </span>
      )}
    </Label>
  );
}

function FieldTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-title"
      className={cn(
        "flex w-fit items-center gap-2 text-sm font-medium group-data-[disabled=true]/field:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

function FieldDescription({ className, ...props }: React.ComponentProps<"p">) {
  const field = useContext(FieldContext);
  const register = field?.registerDescription;
  // A description is static for the life of the field, so registering one
  // commit late costs nothing (unlike the error — see Field).
  useLayoutEffect(() => register?.(), [register]);
  return (
    <p
      data-slot="field-description"
      id={field?.descriptionId}
      className={cn(
        "text-start text-sm leading-normal font-normal text-muted-foreground group-has-data-horizontal/field:text-balance [[data-variant=legend]+&]:-mt-1.5",
        "last:mt-0 nth-last-2:-mt-1",
        "[&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-primary",
        className,
      )}
      {...props}
    />
  );
}

function FieldSeparator({
  children,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  children?: React.ReactNode;
}) {
  return (
    <div
      data-slot="field-separator"
      data-content={!!children}
      className={cn(
        "relative -my-2 h-5 text-sm group-data-[variant=outline]/field-group:-mb-2",
        className,
      )}
      {...props}
    >
      <Separator className="absolute inset-0 top-1/2" />
      {children && (
        <span
          className="relative mx-auto block w-fit bg-background px-2 text-muted-foreground"
          data-slot="field-separator-content"
        >
          {children}
        </span>
      )}
    </div>
  );
}

// No `role="alert"` by default. A form that validates on submit shows every
// message at once and moves focus to the first invalid control, whose
// aria-describedby reads its message; a live region per field would talk
// over that with every message in the form. A message that appears on its
// own (an async check) can still pass `role="alert"`.
//
// `-interactive` ink: raw --destructive is 4.39:1 on the dark ground, under
// the 4.5:1 text needs (audit F-03, tokens.md §6.14's Alert).
function FieldError({
  className,
  children,
  errors,
  ...props
}: React.ComponentProps<"div"> & {
  errors?: Array<{ message?: string } | undefined>;
}) {
  const field = useContext(FieldContext);
  const content = useMemo(() => {
    if (children) {
      return children;
    }

    if (!errors?.length) {
      return null;
    }

    const uniqueErrors = [...new Map(errors.map((error) => [error?.message, error])).values()];

    if (uniqueErrors?.length == 1) {
      return uniqueErrors[0]?.message;
    }

    return (
      <ul className="ms-4 flex list-disc flex-col gap-1">
        {uniqueErrors.map((error, index) => error?.message && <li key={index}>{error.message}</li>)}
      </ul>
    );
  }, [children, errors]);

  if (!content) {
    return null;
  }

  return (
    <div
      data-slot="field-error"
      id={field?.errorId}
      className={cn("text-sm font-normal text-destructive-interactive", className)}
      {...props}
    >
      {content}
    </div>
  );
}

export {
  Field,
  FieldLabel,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldContent,
  FieldTitle,
  useFieldContext,
  useFieldControl,
};

"use client";

// react-hook-form bridge over the Field primitives (SKILL.md: "form
// primitives wired to Zod v4 via react-hook-form resolver"). The base-nova
// registry ships field.tsx as plain layout primitives with no form-state
// wiring; this file adds the context plumbing so a consumer writes
//
//   const form = useForm({ resolver: zodResolver(schema) })
//   <Form {...form}>
//     <FormField control={form.control} name="email" render={({ field }) => (
//       <FormItem>
//         <FormLabel>Email</FormLabel>
//         <FormControl render={<Input {...field} />} />
//         <FormMessage />
//       </FormItem>
//     )} />
//   </Form>
//
// and labels/ids/aria-invalid/error text all connect automatically.
import { createContext, useContext, useId } from "react";
import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import {
  Controller,
  FormProvider,
  useFormContext,
  useFormState,
  type ControllerProps,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";

import { cn } from "@repo/ui/lib/utils";
import { Field, FieldDescription, FieldError, FieldLabel } from "@repo/ui/components/field";

const Form = FormProvider;

interface FormFieldContextValue<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> {
  name: TName;
}

const FormFieldContext = createContext<FormFieldContextValue | null>(null);

function FormField<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>(props: ControllerProps<TFieldValues, TName>) {
  return (
    <FormFieldContext.Provider value={{ name: props.name }}>
      <Controller {...props} />
    </FormFieldContext.Provider>
  );
}

const FormItemContext = createContext<{ id: string } | null>(null);

function useFormField() {
  const fieldContext = useContext(FormFieldContext);
  const itemContext = useContext(FormItemContext);
  const { getFieldState } = useFormContext();
  const formState = useFormState({ name: fieldContext?.name });

  if (!fieldContext || !itemContext) {
    throw new Error("useFormField must be used within <FormField> and <FormItem>");
  }

  const fieldState = getFieldState(fieldContext.name, formState);
  const { id } = itemContext;

  return {
    id,
    name: fieldContext.name,
    formItemId: `${id}-form-item`,
    formDescriptionId: `${id}-form-item-description`,
    formMessageId: `${id}-form-item-message`,
    ...fieldState,
  };
}

function FormItem({ className, ...props }: React.ComponentProps<typeof Field>) {
  const id = useId();
  return (
    <FormItemContext.Provider value={{ id }}>
      <Field data-slot="form-item" className={className} {...props} />
    </FormItemContext.Provider>
  );
}

function FormLabel({ className, ...props }: React.ComponentProps<typeof FieldLabel>) {
  const { error, formItemId } = useFormField();
  return (
    <FieldLabel
      data-slot="form-label"
      data-error={!!error}
      className={cn("data-[error=true]:text-destructive", className)}
      htmlFor={formItemId}
      {...props}
    />
  );
}

// The piece upstream shadcn calls FormControl: attaches the generated id the
// FormLabel's htmlFor points at, plus aria-describedby/aria-invalid, onto the
// actual control. Base UI's useRender is this package's Slot equivalent:
//
//   <FormControl render={<Input {...field} />} />
function FormControl({ render, ...props }: useRender.ComponentProps<"input">) {
  const { error, formItemId, formDescriptionId, formMessageId } = useFormField();
  return useRender({
    defaultTagName: "input",
    props: mergeProps<"input">(
      {
        id: formItemId,
        "aria-describedby": error ? `${formDescriptionId} ${formMessageId}` : formDescriptionId,
        "aria-invalid": !!error,
      },
      props,
    ),
    render,
    state: { slot: "form-control" },
  });
}

function FormDescription({ className, ...props }: React.ComponentProps<typeof FieldDescription>) {
  const { formDescriptionId } = useFormField();
  return (
    <FieldDescription
      data-slot="form-description"
      id={formDescriptionId}
      className={className}
      {...props}
    />
  );
}

function FormMessage({ className, ...props }: React.ComponentProps<typeof FieldError>) {
  const { error, formMessageId } = useFormField();
  return (
    <FieldError
      data-slot="form-message"
      id={formMessageId}
      className={className}
      errors={error ? [error] : undefined}
      {...props}
    />
  );
}

export {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
  useFormField,
};

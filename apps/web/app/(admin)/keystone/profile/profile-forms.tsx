"use client";

// Self-service profile forms (changes-01, image-6): personal info update
// and password change. Both actions are session-scoped server-side — no
// user id crosses this boundary.
import * as React from "react";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { z } from "zod";
import { changeOwnPasswordSchema, updateOwnProfileSchema } from "@repo/contracts";
import { Button } from "@repo/ui/components/button";
import { Field, FieldError, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { PasswordInput } from "@repo/ui/components/password-input";
import { changeOwnPasswordAction, updateOwnProfileAction } from "../_actions/profile-actions.ts";
import { useFieldErrors } from "../_hooks/use-field-errors.ts";

// The action's schema plus the one client-only rule the form has always had:
// the confirmation must repeat the new password. `confirmPassword` never
// reaches the action — it is stripped when the input is built below.
const changePasswordFormSchema = changeOwnPasswordSchema
  .extend({ confirmPassword: z.string().min(1) })
  .refine((value) => value.newPassword === value.confirmPassword, {
    path: ["confirmPassword"],
  });

export function ProfileForm({
  initial,
  labels,
}: {
  initial: { name: string; firstName: string; lastName: string; phone: string };
  labels: {
    name: string;
    firstName: string;
    lastName: string;
    phone: string;
    save: string;
    saved: string;
  };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = React.useState(initial);

  const set = (key: keyof typeof initial, value: string) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const values = {
    name: draft.name,
    firstName: draft.firstName || null,
    lastName: draft.lastName || null,
    phone: draft.phone || null,
  };
  const form = useFieldErrors(updateOwnProfileSchema, values);

  const submit = () => {
    if (!form.validate()) return;
    startTransition(async () => {
      try {
        await updateOwnProfileAction(values);
        toast.success(labels.saved);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : String(error));
      }
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 xl:grid-cols-3">
        <Field invalid={form.invalid("name")} required className="sm:col-span-2 xl:col-span-1">
          <FieldLabel>{labels.name}</FieldLabel>
          <Input value={draft.name} onChange={(e) => set("name", e.target.value)} />
          <FieldError>{form.error("name")}</FieldError>
        </Field>
        <Field invalid={form.invalid("firstName")}>
          <FieldLabel>{labels.firstName}</FieldLabel>
          <Input value={draft.firstName} onChange={(e) => set("firstName", e.target.value)} />
          <FieldError>{form.error("firstName")}</FieldError>
        </Field>
        <Field invalid={form.invalid("lastName")}>
          <FieldLabel>{labels.lastName}</FieldLabel>
          <Input value={draft.lastName} onChange={(e) => set("lastName", e.target.value)} />
          <FieldError>{form.error("lastName")}</FieldError>
        </Field>
        <Field invalid={form.invalid("phone")}>
          <FieldLabel>{labels.phone}</FieldLabel>
          <Input value={draft.phone} onChange={(e) => set("phone", e.target.value)} />
          <FieldError>{form.error("phone")}</FieldError>
        </Field>
      </div>
      <div className="flex justify-end">
        <Button onClick={submit} loading={pending}>
          {labels.save}
        </Button>
      </div>
    </div>
  );
}

export function ChangePasswordForm({
  labels,
}: {
  labels: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
    showPassword: string;
    hidePassword: string;
    change: string;
    changed: string;
    mismatch: string;
  };
}) {
  const [pending, startTransition] = useTransition();
  const [current, setCurrent] = React.useState("");
  const [next, setNext] = React.useState("");
  const [confirm, setConfirm] = React.useState("");

  const form = useFieldErrors(changePasswordFormSchema, {
    currentPassword: current,
    newPassword: next,
    confirmPassword: confirm,
  });
  // A filled confirmation can only fail by not matching, and that has its
  // own catalog string; an empty one takes the generic "required".
  const confirmError = form.invalid("confirmPassword")
    ? confirm
      ? labels.mismatch
      : form.error("confirmPassword")
    : undefined;

  const submit = () => {
    if (!form.validate()) return;
    startTransition(async () => {
      try {
        await changeOwnPasswordAction({ currentPassword: current, newPassword: next });
        toast.success(labels.changed);
        setCurrent("");
        setNext("");
        setConfirm("");
        form.reset();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : String(error));
      }
    });
  };

  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 xl:grid-cols-3">
      <Field invalid={form.invalid("currentPassword")} required>
        <FieldLabel>{labels.currentPassword}</FieldLabel>
        <PasswordInput
          showLabel={labels.showPassword}
          hideLabel={labels.hidePassword}
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        />
        <FieldError>{form.error("currentPassword")}</FieldError>
      </Field>
      <Field invalid={form.invalid("newPassword")} required>
        <FieldLabel>{labels.newPassword}</FieldLabel>
        <PasswordInput
          showLabel={labels.showPassword}
          hideLabel={labels.hidePassword}
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
        />
        <FieldError>{form.error("newPassword")}</FieldError>
      </Field>
      <Field invalid={form.invalid("confirmPassword")} required>
        <FieldLabel>{labels.confirmPassword}</FieldLabel>
        <PasswordInput
          showLabel={labels.showPassword}
          hideLabel={labels.hidePassword}
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        <FieldError>{confirmError}</FieldError>
      </Field>
      <div className="sm:col-span-2 xl:col-span-3">
        <Button onClick={submit} loading={pending}>
          {labels.change}
        </Button>
      </div>
    </div>
  );
}

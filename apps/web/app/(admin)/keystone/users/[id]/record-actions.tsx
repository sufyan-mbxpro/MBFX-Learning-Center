"use client";

// The user record's header actions and its edit dialog (changes-45, the
// owner's reference user page): Refresh, Login as user, Edit details, and the
// Devices tab's "sign out everywhere". Every one re-checks its permission in
// the server action; which buttons render here is UX (security.md #1).
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LogOut, Pencil, RefreshCw, SquarePen, UserRound } from "lucide-react";
import { adminUpdateUserSchema } from "@repo/contracts";
import { Button } from "@repo/ui/components/button";
import { ConfirmDialog } from "@repo/ui/components/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { Switch } from "@repo/ui/components/switch";
import {
  impersonateUserAction,
  resetUserTwoFactorAction,
  revokeUserSessionsAction,
  setEmailVerifiedAction,
  setUserStatusAction,
  updateUserDetailsAction,
} from "../../_actions/user-actions.ts";
import { AdminCombobox } from "../../_components/combobox.tsx";
import { useFieldErrors } from "../../_hooks/use-field-errors.ts";
import { useServerAction } from "../../_hooks/use-server-action.ts";

export function RefreshButton({ label }: { label: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      loading={pending}
      onClick={() => startTransition(() => router.refresh())}
    >
      <RefreshCw data-icon="inline-start" aria-hidden /> {label}
    </Button>
  );
}

/**
 * "Login as user" (ADR-142 §3). Asks first — it swaps the admin's own session
 * out for an hour — then leaves with a FULL load: the next page is the public
 * site, under another root layout and another person's session, and a soft
 * navigation would carry this tree's cached admin state across.
 */
export function ImpersonateButton({
  userId,
  userLabel,
  labels,
}: {
  userId: string;
  userLabel: string;
  labels: {
    action: string;
    title: string;
    description: string;
    confirm: string;
    cancel: string;
    failed: string;
  };
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <>
      <Button variant="outline" loading={pending} onClick={() => setOpen(true)}>
        <UserRound data-icon="inline-start" aria-hidden /> {labels.action}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={labels.title}
        description={`${labels.description} ${userLabel}`}
        confirmLabel={labels.confirm}
        cancelLabel={labels.cancel}
        onConfirm={() => {
          setOpen(false);
          startTransition(async () => {
            try {
              const result = await impersonateUserAction(userId);
              if (!result.ok) throw new Error(labels.failed);
              // A full load on purpose — see the comment above the component.
              // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- a new session under another root layout
              window.location.assign("/account");
            } catch (error) {
              toast.error(error instanceof Error ? error.message : labels.failed);
            }
          });
        }}
      />
    </>
  );
}

export function RevokeSessionsButton({
  userId,
  labels,
}: {
  userId: string;
  labels: {
    action: string;
    title: string;
    description: string;
    confirm: string;
    cancel: string;
    done: string;
  };
}) {
  const [open, setOpen] = useState(false);
  const { pending, run } = useServerAction();
  return (
    <>
      <Button variant="outline" size="sm" loading={pending} onClick={() => setOpen(true)}>
        <LogOut data-icon="inline-start" aria-hidden /> {labels.action}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={labels.title}
        description={labels.description}
        confirmLabel={labels.confirm}
        cancelLabel={labels.cancel}
        destructive
        onConfirm={() => {
          setOpen(false);
          run(() => revokeUserSessionsAction(userId), { successMessage: labels.done });
        }}
      />
    </>
  );
}

export interface EditUserValues {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED" | "PENDING_VERIFICATION";
  emailVerified: boolean;
}

export interface EditUserLabels {
  action: string;
  /** The pencil button's accessible name (it has no visible text). */
  iconAction: string;
  title: string;
  description: string;
  email: string;
  emailHint: string;
  emailInUse: string;
  emailForbidden: string;
  firstName: string;
  lastName: string;
  phone: string;
  status: string;
  emailVerified: string;
  emailVerifiedHint: string;
  save: string;
  cancel: string;
  saved: string;
}

/**
 * The "Edit details" dialog. Two triggers open the same form (changes-46,
 * image-107): the header button, and a pencil ICON on the Personal
 * information card — the reference's edit affordance sits on the facts it
 * edits.
 *
 * Editing the address unticks "Email verified": a new address has not been
 * verified by anyone, and a switch that stayed on from the old one would
 * vouch for it silently. Ticking it again is the admin vouching on purpose.
 */
export function EditUserButton({
  initial,
  statusLabels,
  labels,
  trigger = "button",
}: {
  initial: EditUserValues;
  statusLabels: Record<string, string>;
  labels: EditUserLabels;
  trigger?: "button" | "icon";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState(initial);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const form = useFieldErrors(adminUpdateUserSchema, values);

  const set = <K extends keyof EditUserValues>(key: K, value: EditUserValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const close = () => {
    setOpen(false);
    setEmailError(null);
    form.reset();
  };

  const save = () => {
    if (!form.validate()) return;
    startTransition(async () => {
      try {
        const result = await updateUserDetailsAction(values);
        if (!result.ok) {
          setEmailError(result.error === "emailInUse" ? labels.emailInUse : labels.emailForbidden);
          return;
        }
        toast.success(labels.saved);
        router.refresh();
        close();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : String(error));
      }
    });
  };

  const openDialog = () => {
    setValues(initial);
    setOpen(true);
  };

  return (
    <>
      {trigger === "icon" ? (
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={openDialog}
          aria-label={labels.iconAction}
          title={labels.iconAction}
        >
          <SquarePen aria-hidden />
        </Button>
      ) : (
        <Button variant="outline" onClick={openDialog}>
          <Pencil data-icon="inline-start" aria-hidden /> {labels.action}
        </Button>
      )}
      <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{labels.title}</DialogTitle>
            <DialogDescription>{labels.description}</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field invalid={form.invalid("firstName")} required>
              <FieldLabel>{labels.firstName}</FieldLabel>
              <Input
                value={values.firstName}
                autoComplete="off"
                onChange={(e) => set("firstName", e.target.value)}
              />
              <FieldError>{form.error("firstName")}</FieldError>
            </Field>
            <Field invalid={form.invalid("lastName")}>
              <FieldLabel>{labels.lastName}</FieldLabel>
              <Input
                value={values.lastName}
                autoComplete="off"
                onChange={(e) => set("lastName", e.target.value)}
              />
              <FieldError>{form.error("lastName")}</FieldError>
            </Field>
            <Field
              invalid={form.invalid("email") || emailError !== null}
              required
              className="sm:col-span-2"
            >
              <FieldLabel>{labels.email}</FieldLabel>
              <Input
                type="email"
                value={values.email}
                autoComplete="off"
                onChange={(e) => {
                  const email = e.target.value;
                  setEmailError(null);
                  setValues((current) => ({
                    ...current,
                    email,
                    // Back to the saved address → back to its saved state.
                    emailVerified:
                      email.trim().toLowerCase() === initial.email.toLowerCase()
                        ? initial.emailVerified
                        : false,
                  }));
                }}
              />
              <FieldDescription>{labels.emailHint}</FieldDescription>
              <FieldError>{emailError ?? form.error("email")}</FieldError>
            </Field>
            <Field invalid={form.invalid("phone")}>
              <FieldLabel>{labels.phone}</FieldLabel>
              <Input
                type="tel"
                value={values.phone}
                autoComplete="off"
                onChange={(e) => set("phone", e.target.value)}
              />
              <FieldError>{form.error("phone")}</FieldError>
            </Field>
            <Field invalid={form.invalid("status")} required>
              <FieldLabel>{labels.status}</FieldLabel>
              <AdminCombobox
                value={values.status}
                onValueChange={(value) => {
                  if (value) set("status", value as EditUserValues["status"]);
                }}
                options={Object.entries(statusLabels).map(([value, label]) => ({ value, label }))}
              />
              <FieldError>{form.error("status")}</FieldError>
            </Field>
          </div>

          <Field orientation="horizontal">
            <Switch
              checked={values.emailVerified}
              onCheckedChange={(checked) => set("emailVerified", checked)}
            />
            <FieldContent>
              <FieldLabel>{labels.emailVerified}</FieldLabel>
              <FieldDescription>{labels.emailVerifiedHint}</FieldDescription>
            </FieldContent>
          </Field>

          <DialogFooter>
            <Button variant="outline" onClick={close} disabled={pending}>
              {labels.cancel}
            </Button>
            <Button loading={pending} onClick={save}>
              {labels.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * One tile of the "Account controls" grid — the reference's permission
 * toggles, limited to the switches this platform actually has. A tile with no
 * `onChange` is a STATE, drawn as a disabled switch: consent to the newsletter
 * is the reader's. Two-factor is a switch that only turns OFF (ADR-157 §5) —
 * turning it on is the holder's own, so an unchecked tile is a state.
 */
export function ControlTile({
  label,
  hint,
  checked,
  action,
  confirm,
}: {
  label: string;
  hint: string;
  checked: boolean;
  action?: { kind: "emailVerified" | "active" | "twoFactor"; userId: string };
  /** Turning an account OFF asks first (code-style #7). */
  confirm?: { title: string; description: string; confirm: string; cancel: string };
}) {
  const { pending, run } = useServerAction();
  const [asking, setAsking] = useState(false);

  const apply = (next: boolean) => {
    if (!action) return;
    run(() => {
      if (action.kind === "emailVerified") return setEmailVerifiedAction(action.userId, next);
      if (action.kind === "twoFactor") return resetUserTwoFactorAction(action.userId);
      return setUserStatusAction(action.userId, next ? "ACTIVE" : "INACTIVE");
    });
  };

  return (
    <Field
      orientation="horizontal"
      className="rounded-lg border bg-card p-3"
      data-disabled={!action || undefined}
    >
      <Switch
        checked={checked}
        // A two-factor tile can only be turned off; once off it is a state.
        disabled={!action || pending || (action.kind === "twoFactor" && !checked)}
        onCheckedChange={(next) => {
          if (confirm && !next) setAsking(true);
          else apply(next);
        }}
      />
      <FieldContent className="min-w-0">
        <FieldLabel>{label}</FieldLabel>
        <FieldDescription>{hint}</FieldDescription>
      </FieldContent>
      {confirm && (
        <ConfirmDialog
          open={asking}
          onOpenChange={setAsking}
          title={confirm.title}
          description={confirm.description}
          confirmLabel={confirm.confirm}
          cancelLabel={confirm.cancel}
          destructive
          onConfirm={() => {
            setAsking(false);
            apply(false);
          }}
        />
      )}
    </Field>
  );
}

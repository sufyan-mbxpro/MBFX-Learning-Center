"use client";

// Self-service profile forms (changes-01, image-6): personal info update
// and password change. Both actions are session-scoped server-side — no
// user id crosses this boundary.
import * as React from "react";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { changeOwnPasswordAction, updateOwnProfileAction } from "../_actions/profile-actions.ts";

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
  const [form, setForm] = React.useState(initial);

  const set = (key: keyof typeof initial, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const submit = () =>
    startTransition(async () => {
      try {
        await updateOwnProfileAction({
          name: form.name,
          firstName: form.firstName || null,
          lastName: form.lastName || null,
          phone: form.phone || null,
        });
        toast.success(labels.saved);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : String(error));
      }
    });

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="profile-name">{labels.name}</Label>
          <Input
            id="profile-name"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="profile-first">{labels.firstName}</Label>
          <Input
            id="profile-first"
            value={form.firstName}
            onChange={(e) => set("firstName", e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="profile-last">{labels.lastName}</Label>
          <Input
            id="profile-last"
            value={form.lastName}
            onChange={(e) => set("lastName", e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="profile-phone">{labels.phone}</Label>
          <Input
            id="profile-phone"
            value={form.phone}
            onChange={(e) => set("phone", e.target.value)}
          />
        </div>
      </div>
      <div>
        <Button onClick={submit} disabled={pending || !form.name.trim()}>
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
    change: string;
    changed: string;
    mismatch: string;
  };
}) {
  const [pending, startTransition] = useTransition();
  const [current, setCurrent] = React.useState("");
  const [next, setNext] = React.useState("");
  const [confirm, setConfirm] = React.useState("");

  const submit = () => {
    if (next !== confirm) {
      toast.error(labels.mismatch);
      return;
    }
    startTransition(async () => {
      try {
        await changeOwnPasswordAction({ currentPassword: current, newPassword: next });
        toast.success(labels.changed);
        setCurrent("");
        setNext("");
        setConfirm("");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : String(error));
      }
    });
  };

  return (
    <div className="flex max-w-sm flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pw-current">{labels.currentPassword}</Label>
        <Input
          id="pw-current"
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pw-new">{labels.newPassword}</Label>
        <Input
          id="pw-new"
          type="password"
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pw-confirm">{labels.confirmPassword}</Label>
        <Input
          id="pw-confirm"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>
      <div>
        <Button onClick={submit} disabled={pending || !current || next.length < 8 || !confirm}>
          {labels.change}
        </Button>
      </div>
    </div>
  );
}

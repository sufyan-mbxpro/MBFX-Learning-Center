"use client";

// "Create role" modal (changes-01, image-1). Key auto-derives from the
// name but stays editable; the server re-validates shape and the actor's
// level ceiling (strict <) regardless.
import * as React from "react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { z } from "zod";
import { createRoleSchema } from "@repo/contracts";
import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { Textarea } from "@repo/ui/components/textarea";
import { useFieldErrors } from "../_hooks/use-field-errors.ts";
import { createRoleAction } from "../_actions/user-actions.ts";

export function CreateRoleDialog({
  maxLevel,
  labels,
}: {
  /** Exclusive ceiling — the actor's own maxRoleLevel (strict <). */
  maxLevel: number;
  labels: {
    createRole: string;
    createRoleDescription: string;
    name: string;
    key: string;
    level: string;
    description: string;
    save: string;
    cancel: string;
  };
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = useTransition();
  const [name, setName] = React.useState("");
  const [key, setKey] = React.useState("");
  const [keyTouched, setKeyTouched] = React.useState(false);
  const [level, setLevel] = React.useState(10);
  const [description, setDescription] = React.useState("");

  const slugify = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");

  // The action's own schema, with the actor's ceiling (strict <) in place of
  // the seed's 99 — the server enforces the same bound through canAssignRole.
  const schema = React.useMemo(
    () =>
      createRoleSchema.extend({
        level: z
          .int()
          .min(0)
          .max(Math.max(0, maxLevel - 1)),
      }),
    [maxLevel],
  );
  const values = { key, name, level, description: description || undefined };
  const form = useFieldErrors(schema, values);

  const close = () => {
    setOpen(false);
    form.reset();
  };

  const submit = () => {
    if (!form.validate()) return;
    startTransition(async () => {
      try {
        await createRoleAction(values);
        close();
        setName("");
        setKey("");
        setKeyTouched(false);
        setDescription("");
        router.push(`/admin/roles/${key}`);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : String(error));
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
      <Button onClick={() => setOpen(true)}>
        <Plus data-icon="inline-start" aria-hidden /> {labels.createRole}
      </Button>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{labels.createRole}</DialogTitle>
          <DialogDescription>{labels.createRoleDescription}</DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field invalid={form.invalid("name")} required>
            <FieldLabel>{labels.name}</FieldLabel>
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!keyTouched) setKey(slugify(e.target.value));
              }}
            />
            <FieldError>{form.error("name")}</FieldError>
          </Field>
          <Field invalid={form.invalid("key")} required>
            <FieldLabel>{labels.key}</FieldLabel>
            <Input
              value={key}
              className="font-mono"
              onChange={(e) => {
                setKeyTouched(true);
                setKey(slugify(e.target.value));
              }}
            />
            <FieldError>{form.error("key")}</FieldError>
          </Field>
          <Field invalid={form.invalid("level")} required>
            <FieldLabel>{labels.level}</FieldLabel>
            <Input
              type="number"
              min={0}
              max={Math.max(0, maxLevel - 1)}
              value={level}
              onChange={(e) => setLevel(Number(e.target.value))}
            />
            <FieldError>{form.error("level")}</FieldError>
          </Field>
          <Field invalid={form.invalid("description")}>
            <FieldLabel>{labels.description}</FieldLabel>
            <Textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <FieldError>{form.error("description")}</FieldError>
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={pending}>
            {labels.cancel}
          </Button>
          {/* Enabled while fields are wrong: a disabled Save is silent about
              WHICH field (audit F-07). Pressing it names them instead. */}
          <Button onClick={submit} loading={pending}>
            {labels.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

// "Send me a test" opens a dialog rather than sending straight away (owner,
// changes-57): the address is filled with the admin's own, and they can change
// it to send the test to a colleague or a seed inbox. Shared by the course
// announcement editor and the custom email composer, so both ask the same way.
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { z } from "zod";
import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import { Input } from "@repo/ui/components/input";
import { Field } from "../../_components/editor/editor-section.tsx";
import { useFieldErrors } from "../../_hooks/use-field-errors.ts";

// The actions parse `to` with the same rule.
const testRecipientSchema = z.object({ to: z.email().max(255) });

export function TestSendDialog({
  defaultTo,
  pending,
  onSend,
}: {
  /** The acting admin's own address. */
  defaultTo: string;
  pending: boolean;
  /** Runs the send; call `done` to close the dialog once it went out. */
  onSend: (to: string, done: () => void) => void;
}) {
  const t = useTranslations("admin.announcements");
  const tAdmin = useTranslations("admin");
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState(defaultTo);
  const values = useMemo(() => ({ to: to.trim() }), [to]);
  const form = useFieldErrors(testRecipientSchema, values);

  function openDialog() {
    // Each opening starts from the admin's own address again.
    setTo(defaultTo);
    form.reset();
    setOpen(true);
  }

  function submit() {
    if (!form.validate()) return;
    onSend(values.to, () => setOpen(false));
  }

  return (
    <>
      <Button type="button" variant="outline" loading={pending} onClick={openDialog}>
        {t("sendTest")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("testDialogTitle")}</DialogTitle>
            <DialogDescription>{t("testDialogDescription")}</DialogDescription>
          </DialogHeader>
          <form
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <Field label={t("testRecipient")} required error={form.error("to")}>
              <Input
                type="email"
                value={to}
                onChange={(event) => setTo(event.target.value)}
                autoComplete="email"
              />
            </Field>
          </form>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {tAdmin("cancel")}
            </Button>
            <Button type="button" loading={pending} onClick={submit}>
              {t("testSend")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

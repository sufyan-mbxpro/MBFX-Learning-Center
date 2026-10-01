"use client";

// "Send me a test" is an inline address field and a button, not a dialog
// (owner, changes-59): the address is filled with the admin's own, and they
// can change it to send the test to a colleague or a seed inbox. Shared by the
// course announcement editor and the custom email composer, so both ask the
// same way.
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { z } from "zod";
import { Send } from "lucide-react";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Field } from "../../_components/editor/editor-section.tsx";
import { useFieldErrors } from "../../_hooks/use-field-errors.ts";

// The actions parse `to` with the same rule.
const testRecipientSchema = z.object({ to: z.email().max(255) });

export function TestSendForm({
  defaultTo,
  pending,
  onSend,
}: {
  /** The acting admin's own address. */
  defaultTo: string;
  pending: boolean;
  /** Runs the send; `done` is called once it went out. */
  onSend: (to: string, done: () => void) => void;
}) {
  const t = useTranslations("admin.announcements");
  const [to, setTo] = useState(defaultTo);
  const values = useMemo(() => ({ to: to.trim() }), [to]);
  const form = useFieldErrors(testRecipientSchema, values);

  function submit() {
    if (!form.validate()) return;
    onSend(values.to, () => form.reset());
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-3"
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
      <div className="flex justify-end">
        <Button type="submit" variant="outline" loading={pending}>
          <Send aria-hidden data-icon="inline-start" />
          {t("sendTest")}
        </Button>
      </div>
    </form>
  );
}

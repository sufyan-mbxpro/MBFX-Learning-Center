"use client";

// The topics list's one control (changes-18 PR 3) — `NewTermButton`'s shape,
// one entity over.
//
// It asks for a name and nothing else. Everything a topic has besides its name
// has a working default (`isActive: true`, a slug derived from the name, an
// empty description), and a dialog that demands SEO copy before a topic can
// exist is a dialog editors route around by leaving fields blank forever.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createGlossaryTopicSchema } from "@repo/contracts";
import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { createGlossaryTopicAction } from "../../../_actions/glossary-topic-actions.ts";
import { useFieldErrors } from "../../../_hooks/use-field-errors.ts";
import { useServerAction } from "../../../_hooks/use-server-action.ts";

export interface NewTopicLabels {
  trigger: string;
  title: string;
  description: string;
  nameLabel: string;
  create: string;
  cancel: string;
  close: string;
}

export function NewTopicButton({ labels }: { labels: NewTopicLabels }) {
  const router = useRouter();
  const { run, pending } = useServerAction();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  // The action's own schema (ADR-077): it parses `{ name }` the same way.
  const form = useFieldErrors(createGlossaryTopicSchema, { name });

  const setOpenState = (next: boolean) => {
    setOpen(next);
    if (!next) form.reset();
  };

  const create = () => {
    if (!form.validate()) return;
    run(
      async () => {
        const id = await createGlossaryTopicAction(name.trim());
        setOpenState(false);
        setName("");
        // Straight into the editor, as the term dialog does: a new topic on the
        // list is a row with a name and nothing else, and writing the rest is
        // the next thing anyone wants.
        router.push(`/keystone/glossary/topics/${id}`);
      },
      { skipRefresh: true },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpenState}>
      <Button onClick={() => setOpen(true)}>
        <Plus aria-hidden data-icon="inline-start" />
        {labels.trigger}
      </Button>
      <DialogContent closeLabel={labels.close}>
        {/* Title AND description — ADR-057 #5, guarded by
            `admin-dialog-conventions.test.ts`. */}
        <DialogHeader>
          <DialogTitle>{labels.title}</DialogTitle>
          <DialogDescription>{labels.description}</DialogDescription>
        </DialogHeader>

        <FieldGroup>
          <Field invalid={form.invalid("name")} required>
            <FieldLabel>{labels.nameLabel}</FieldLabel>
            <Input
              value={name}
              autoFocus
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !pending) create();
              }}
            />
            <FieldError>{form.error("name")}</FieldError>
          </Field>
        </FieldGroup>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpenState(false)}>
            {labels.cancel}
          </Button>
          <Button loading={pending} onClick={create}>
            {labels.create}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

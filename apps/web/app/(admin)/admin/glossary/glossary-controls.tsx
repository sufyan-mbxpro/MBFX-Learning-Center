"use client";

// The glossary list's one control (ADR-069, changes-17 PR 2).
//
// What used to live here — `GlossaryControls`, `TranslationForm` and
// `TermTrackSelect` — is gone, not hidden. The form could not edit (it seeded
// every field to "" and its loader never selected a body), and the other two
// were per-row controls on a screen that is now a table. All three moved into
// `/admin/glossary/[id]`, where a term is edited one at a time.
//
// What is left is creating one. It asks for the two fields that decide where a
// term LIVES, because both have a sensible default that is easy to leave wrong
// forever once the term is written: an unfiled term never appears under
// `/glossary/topics`, and until ADR-069 there was no way to file it at all.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { LEARN_TRACK_KEYS, createGlossaryTermSchema } from "@repo/contracts";
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
import { createGlossaryTermAction } from "../_actions/content-actions.ts";
import { AdminCombobox } from "../_components/combobox.tsx";
import { useFieldErrors } from "../_hooks/use-field-errors.ts";
import { useServerAction } from "../_hooks/use-server-action.ts";

/**
 * The "no value" option for both dropdowns — and they do NOT mean the same
 * thing (ADR-069 §3). "Unfiled" is a term with no topic; "Both schools" is a
 * term that belongs to every one. A named sentinel rather than `""`, because
 * an empty value reads as "nothing selected" to a listbox and each of these is
 * a deliberate choice.
 */
const NONE = "__none__";

export interface NewTermLabels {
  trigger: string;
  title: string;
  description: string;
  topicLabel: string;
  topicNone: string;
  trackLabel: string;
  trackBoth: string;
  create: string;
  cancel: string;
  tracks: Record<string, string>;
}

export function NewTermButton({
  topicOptions,
  labels,
}: {
  topicOptions: { id: string; name: string }[];
  labels: NewTermLabels;
}) {
  const router = useRouter();
  const { run, pending } = useServerAction();
  const [open, setOpen] = useState(false);
  const [topicId, setTopicId] = useState<string>(NONE);
  const [track, setTrack] = useState<string>(NONE);

  // Both optional (a blank DRAFT term is legal) — the action's schema is still
  // the one the form checks, so the two cannot disagree (ADR-077).
  const values = {
    topicId: topicId === NONE ? null : topicId,
    track: track === NONE ? null : track,
  };
  const form = useFieldErrors(createGlossaryTermSchema, values);

  const setOpenState = (next: boolean) => {
    setOpen(next);
    if (!next) form.reset();
  };

  const create = () => {
    if (!form.validate()) return;
    run(
      async () => {
        const id = await createGlossaryTermAction(values);
        setOpenState(false);
        // Straight into the editor: a blank DRAFT term on the list is a row
        // with no name, and the next thing anyone wants is to write it.
        router.push(`/admin/glossary/${id}`);
      },
      { skipRefresh: true },
    );
  };

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus data-icon="inline-start" aria-hidden />
        {labels.trigger}
      </Button>

      <Dialog open={open} onOpenChange={setOpenState}>
        <DialogContent>
          {/* ADR-057 #5 / code-style #11: a title AND a description, always. */}
          <DialogHeader>
            <DialogTitle>{labels.title}</DialogTitle>
            <DialogDescription>{labels.description}</DialogDescription>
          </DialogHeader>

          <FieldGroup>
            <Field invalid={form.invalid("topicId")}>
              <FieldLabel>{labels.topicLabel}</FieldLabel>
              <AdminCombobox
                value={topicId}
                onValueChange={(next) => setTopicId(next || NONE)}
                options={[
                  { value: NONE, label: labels.topicNone },
                  ...topicOptions.map((topic) => ({ value: topic.id, label: topic.name })),
                ]}
              />
              <FieldError>{form.error("topicId")}</FieldError>
            </Field>

            <Field invalid={form.invalid("track")}>
              <FieldLabel>{labels.trackLabel}</FieldLabel>
              <AdminCombobox
                value={track}
                onValueChange={(next) => setTrack(next || NONE)}
                options={[
                  // First: it is the right answer for most vocabulary.
                  { value: NONE, label: labels.trackBoth },
                  ...LEARN_TRACK_KEYS.map((key) => ({
                    value: key,
                    label: labels.tracks[key] ?? key,
                  })),
                ]}
              />
              <FieldError>{form.error("track")}</FieldError>
            </Field>
          </FieldGroup>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenState(false)}>
              {labels.cancel}
            </Button>
            <Button loading={pending} onClick={create}>
              {labels.create}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

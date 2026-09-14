"use client";

// The "New quiz" dialog (changes-11 Phase 6; track added by ADR-065 §3).
//
// Title AND track, like the course dialog. Everything else a quiz needs has a
// working default (ADR-058 — pass at 70, unlimited attempts, answers after
// submit, not listed publicly) and asking for those here would be a form
// standing between an editor and the screen that does the work. The track is
// not one of them: it is the quiz's URL segment, so there is nothing to
// default it to that would not silently file the quiz in the wrong school.
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  createQuizSchema,
  isLearnTrack,
  LEARN_TRACK_KEYS,
  type LearnTrackKey,
} from "@repo/contracts";
import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/ui/components/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { AdminCombobox } from "../../_components/combobox.tsx";
import { createQuizAction } from "../../_actions/quiz-actions.ts";
import { useFieldErrors } from "../../_hooks/use-field-errors.ts";
import { useServerAction } from "../../_hooks/use-server-action.ts";

export function NewQuizDialog({
  labels,
}: {
  labels: {
    newQuiz: string;
    newQuizDescription: string;
    create: string;
    cancel: string;
    close: string;
    titleLabel: string;
    trackLabel: string;
    tracks: Record<string, string>;
  };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [track, setTrack] = useState<LearnTrackKey | "">(LEARN_TRACK_KEYS[0] ?? "");
  const { run, pending } = useServerAction();
  // The action's own schema, over exactly what the action is sent (ADR-077).
  const form = useFieldErrors(createQuizSchema, { title: title.trim(), track });

  const openChange = (next: boolean) => {
    setOpen(next);
    if (!next) form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={openChange}>
      <DialogTrigger render={<Button size="sm">{labels.newQuiz}</Button>} />
      <DialogContent className="max-w-sm" closeLabel={labels.close}>
        <DialogHeader>
          {/* ADR-057 #5 / code-style #11: a title AND a description, always. */}
          <DialogTitle>{labels.newQuiz}</DialogTitle>
          <DialogDescription>{labels.newQuizDescription}</DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field invalid={form.invalid("title")} required>
            <FieldLabel>{labels.titleLabel}</FieldLabel>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={255} />
            <FieldError>{form.error("title")}</FieldError>
          </Field>
          <Field invalid={form.invalid("track")} required>
            <FieldLabel>{labels.trackLabel}</FieldLabel>
            <AdminCombobox
              value={track}
              // The guard, not a cast: the dropdown hands back a plain string
              // and only a registered track key may reach the action.
              onValueChange={(v) => setTrack(v && isLearnTrack(v) ? v : track)}
              options={LEARN_TRACK_KEYS.map((key) => ({
                value: key,
                label: labels.tracks[key] ?? key,
              }))}
            />
            <FieldError>{form.error("track")}</FieldError>
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => openChange(false)} disabled={pending}>
            {labels.cancel}
          </Button>
          {/* Enabled while fields are wrong: pressing it names them (audit F-07). */}
          <Button
            size="sm"
            loading={pending}
            onClick={() => {
              if (!form.validate()) return;
              run(
                async () => {
                  if (!isLearnTrack(track)) return;
                  const id = await createQuizAction({ title: title.trim(), track });
                  router.push(`/admin/learn/quizzes/${id}`);
                },
                { skipRefresh: true },
              );
            }}
          >
            {labels.create}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

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
import { Label } from "@repo/ui/components/label";
import { createGlossaryTopicAction } from "../../_actions/glossary-topic-actions.ts";
import { useServerAction } from "../../_hooks/use-server-action.ts";

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

  const create = () =>
    run(
      async () => {
        const id = await createGlossaryTopicAction(name.trim());
        setOpen(false);
        setName("");
        // Straight into the editor, as the term dialog does: a new topic on the
        // list is a row with a name and nothing else, and writing the rest is
        // the next thing anyone wants.
        router.push(`/admin/glossary/topics/${id}`);
      },
      { skipRefresh: true },
    );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="new-topic-name">{labels.nameLabel}</Label>
          <Input
            id="new-topic-name"
            value={name}
            autoFocus
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && name.trim() !== "" && !pending) create();
            }}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {labels.cancel}
          </Button>
          <Button disabled={pending || name.trim() === ""} onClick={create}>
            {labels.create}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

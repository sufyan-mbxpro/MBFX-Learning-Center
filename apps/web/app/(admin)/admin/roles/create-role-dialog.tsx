"use client";

// "Create role" modal (changes-01, image-1). Key auto-derives from the
// name but stays editable; the server re-validates shape and the actor's
// level ceiling (strict <) regardless.
import * as React from "react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { Textarea } from "@repo/ui/components/textarea";
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

  const submit = () =>
    startTransition(async () => {
      try {
        await createRoleAction({
          key,
          name,
          level,
          description: description || undefined,
        });
        setOpen(false);
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button onClick={() => setOpen(true)}>
        <Plus data-icon="inline-start" aria-hidden /> {labels.createRole}
      </Button>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{labels.createRole}</DialogTitle>
          <DialogDescription>{labels.createRoleDescription}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="role-name">{labels.name}</Label>
            <Input
              id="role-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!keyTouched) setKey(slugify(e.target.value));
              }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="role-key">{labels.key}</Label>
            <Input
              id="role-key"
              value={key}
              className="font-mono"
              onChange={(e) => {
                setKeyTouched(true);
                setKey(slugify(e.target.value));
              }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="role-level">{labels.level}</Label>
            <Input
              id="role-level"
              type="number"
              min={0}
              max={Math.max(0, maxLevel - 1)}
              value={level}
              onChange={(e) => setLevel(Number(e.target.value))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="role-description">{labels.description}</Label>
            <Textarea
              id="role-description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            {labels.cancel}
          </Button>
          <Button
            onClick={submit}
            disabled={pending || !name.trim() || !key || level < 0 || level >= maxLevel}
          >
            {labels.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

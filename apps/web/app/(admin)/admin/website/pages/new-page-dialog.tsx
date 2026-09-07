"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/ui/components/dialog";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { createPageAction } from "../../_actions/cms-page-actions.ts";
import { useServerAction } from "../../_hooks/use-server-action.ts";

// Slug follows title until the admin edits it directly — the "Start from a
// template" verb is Phase 3 (ADR-033); this is "Blank" only.
function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function NewPageDialog({
  labels,
}: {
  labels: {
    newPage: string;
    titleLabel: string;
    slugLabel: string;
    create: string;
    cancel: string;
    close: string;
  };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const { run, pending } = useServerAction();

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setTitle("");
          setSlug("");
          setSlugTouched(false);
        }
      }}
    >
      <DialogTrigger render={<Button size="sm">{labels.newPage}</Button>} />
      <DialogContent className="max-w-sm" closeLabel={labels.close}>
        <DialogHeader>
          <DialogTitle>{labels.newPage}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-page-title">{labels.titleLabel}</Label>
            <Input
              id="new-page-title"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (!slugTouched) setSlug(slugify(e.target.value));
              }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-page-slug">{labels.slugLabel}</Label>
            <Input
              id="new-page-slug"
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value);
              }}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={pending}>
            {labels.cancel}
          </Button>
          <Button
            size="sm"
            disabled={pending || !title.trim() || !slug.trim()}
            onClick={() =>
              run(
                async () => {
                  const id = await createPageAction({ title, slug });
                  router.push(`/admin/website/pages/${id}`);
                },
                { skipRefresh: true },
              )
            }
          >
            {labels.create}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

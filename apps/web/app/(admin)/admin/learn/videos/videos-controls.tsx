"use client";

// The "New video topic" dialog (changes-16 PR 5, ADR-068).
//
// Title, track and an optional category — the same three the quiz dialog asks
// for, minus what has a working default. The TRACK is not optional and cannot
// be defaulted silently: it is the topic's URL segment (ADR-068 §1), so
// guessing it files the page in the wrong school and the fix is a redirect.
//
// The category IS optional, because it is taxonomy rather than address — a
// topic with none is a legitimate state the public reads already handle.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { isLearnTrack, LEARN_TRACK_KEYS, type LearnTrackKey } from "@repo/contracts";
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
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { AdminCombobox } from "../../_components/combobox.tsx";
import { createVideoTopicAction } from "../../_actions/video-actions.ts";
import { useServerAction } from "../../_hooks/use-server-action.ts";

export function NewVideoTopicDialog({
  categories,
  labels,
}: {
  categories: { id: string; name: string }[];
  labels: {
    newTopic: string;
    newTopicDescription: string;
    create: string;
    cancel: string;
    close: string;
    titleLabel: string;
    trackLabel: string;
    categoryLabel: string;
    noCategory: string;
    tracks: Record<string, string>;
  };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [track, setTrack] = useState<LearnTrackKey | "">(LEARN_TRACK_KEYS[0] ?? "");
  const [categoryId, setCategoryId] = useState("");
  const { run, pending } = useServerAction();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm">{labels.newTopic}</Button>} />
      <DialogContent className="max-w-sm" closeLabel={labels.close}>
        <DialogHeader>
          {/* ADR-057 #5 / code-style #11: a title AND a description, always. */}
          <DialogTitle>{labels.newTopic}</DialogTitle>
          <DialogDescription>{labels.newTopicDescription}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-video-topic-title">{labels.titleLabel}</Label>
            <Input
              id="new-video-topic-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={255}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-video-topic-track">{labels.trackLabel}</Label>
            <AdminCombobox
              id="new-video-topic-track"
              value={track}
              // The guard, not a cast: the dropdown hands back a plain string
              // and only a registered track key may reach the action.
              onValueChange={(v) => setTrack(v && isLearnTrack(v) ? v : track)}
              options={LEARN_TRACK_KEYS.map((key) => ({
                value: key,
                label: labels.tracks[key] ?? key,
              }))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-video-topic-category">{labels.categoryLabel}</Label>
            <AdminCombobox
              id="new-video-topic-category"
              value={categoryId}
              onValueChange={setCategoryId}
              options={[
                { value: "", label: labels.noCategory },
                ...categories.map((c) => ({ value: c.id, label: c.name })),
              ]}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={pending}>
            {labels.cancel}
          </Button>
          <Button
            size="sm"
            disabled={pending || title.trim() === "" || track === ""}
            onClick={() =>
              run(
                async () => {
                  if (!isLearnTrack(track)) return;
                  const id = await createVideoTopicAction({
                    title: title.trim(),
                    track,
                    categoryId: categoryId === "" ? undefined : categoryId,
                  });
                  router.push(`/admin/learn/videos/${id}`);
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

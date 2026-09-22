"use client";

// The subscriber record's header actions (changes-45): the list row's
// dropdown, as buttons. Same actions, same confirmations, same server-side
// `newsletter.manage` check (security.md #1).
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, UserMinus, UserPlus } from "lucide-react";
import { Button } from "@repo/ui/components/button";
import { ConfirmDialog } from "@repo/ui/components/confirm-dialog";
import {
  deleteSubscriberAction,
  resubscribeSubscriberAction,
  unsubscribeSubscriberAction,
} from "../../_actions/newsletter-actions.ts";
import { useServerAction } from "../../_hooks/use-server-action.ts";

export function SubscriberActions({
  id,
  unsubscribed,
  labels,
}: {
  id: string;
  unsubscribed: boolean;
  labels: {
    unsubscribe: string;
    unsubscribeTitle: string;
    unsubscribeBody: string;
    unsubscribeConfirm: string;
    unsubscribed: string;
    resubscribe: string;
    restored: string;
    invited: string;
    remove: string;
    deleteTitle: string;
    deleteBody: string;
    deleteConfirm: string;
    deleted: string;
    cancel: string;
  };
}) {
  const router = useRouter();
  const { run, pending } = useServerAction();
  const [asking, setAsking] = useState<"unsubscribe" | "delete" | null>(null);

  return (
    <>
      {unsubscribed ? (
        <Button
          variant="outline"
          loading={pending}
          onClick={() =>
            run(async () => {
              const result = await resubscribeSubscriberAction({ id });
              if (result === "restored") toast.success(labels.restored);
              else if (result === "invited") toast.success(labels.invited);
            })
          }
        >
          <UserPlus data-icon="inline-start" aria-hidden /> {labels.resubscribe}
        </Button>
      ) : (
        <Button variant="outline" loading={pending} onClick={() => setAsking("unsubscribe")}>
          <UserMinus data-icon="inline-start" aria-hidden /> {labels.unsubscribe}
        </Button>
      )}
      <Button variant="destructive" onClick={() => setAsking("delete")}>
        <Trash2 data-icon="inline-start" aria-hidden /> {labels.remove}
      </Button>

      <ConfirmDialog
        open={asking === "unsubscribe"}
        onOpenChange={(open) => setAsking(open ? "unsubscribe" : null)}
        title={labels.unsubscribeTitle}
        description={labels.unsubscribeBody}
        confirmLabel={labels.unsubscribeConfirm}
        cancelLabel={labels.cancel}
        onConfirm={() =>
          run(() => unsubscribeSubscriberAction({ id }), {
            successMessage: labels.unsubscribed,
            onDone: () => setAsking(null),
          })
        }
      />
      {/* An erasure has no undo, so the record it was about goes with it and
          the screen returns to the list. */}
      <ConfirmDialog
        open={asking === "delete"}
        onOpenChange={(open) => setAsking(open ? "delete" : null)}
        title={labels.deleteTitle}
        description={labels.deleteBody}
        confirmLabel={labels.deleteConfirm}
        cancelLabel={labels.cancel}
        destructive
        onConfirm={() =>
          run(() => deleteSubscriberAction({ id }), {
            successMessage: labels.deleted,
            skipRefresh: true,
            onDone: () => router.push("/keystone/newsletter"),
          })
        }
      />
    </>
  );
}

"use client";

// Uses the shared ConfirmDialog (cancel button, pending spinner, stays open
// on failure) instead of a hand-rolled Dialog with no cancel affordance.
import { useRouter } from "next/navigation";
import { Button } from "@repo/ui/components/button";
import { ConfirmDialog } from "@repo/ui/components/confirm-dialog";
import { offboardEmployeeAction } from "../_actions/user-actions.ts";

export function OffboardButton({
  employeeId,
  label,
  confirmText,
  confirmLabel,
  cancelLabel,
}: {
  employeeId: string;
  label: string;
  confirmText: string;
  confirmLabel: string;
  cancelLabel: string;
}) {
  const router = useRouter();

  return (
    <ConfirmDialog
      trigger={
        <Button variant="destructive" size="sm">
          {label}
        </Button>
      }
      title={label}
      description={confirmText}
      confirmLabel={confirmLabel}
      cancelLabel={cancelLabel}
      onConfirm={async () => {
        await offboardEmployeeAction(employeeId);
        router.refresh();
      }}
    />
  );
}

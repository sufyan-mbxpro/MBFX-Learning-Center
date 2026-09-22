"use client";

// The instruments list's one control. A thin trigger around the same dialog
// the row actions open, so create and edit cannot drift apart.
import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@repo/ui/components/button";
import { InstrumentDialog, type InstrumentDialogLabels } from "./instrument-dialog.tsx";

export function NewInstrumentButton({
  labels,
  triggerLabel,
}: {
  labels: InstrumentDialogLabels;
  triggerLabel: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus aria-hidden data-icon="inline-start" />
        {triggerLabel}
      </Button>
      {/* Mounted only while open, so each new instrument starts from a blank
          form rather than from the last one that was abandoned. */}
      {open && <InstrumentDialog open onOpenChange={setOpen} labels={labels} />}
    </>
  );
}

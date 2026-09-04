"use client";

import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@repo/ui/components/button";
import { Checkbox } from "@repo/ui/components/checkbox";
import { moveMenuItemAction, toggleMenuItemAction } from "../_actions/admin-actions.ts";

export function MenuItemControls({
  itemId,
  isActive,
  labels,
}: {
  itemId: string;
  isActive: boolean;
  labels: { moveUp: string; moveDown: string; active: string };
}) {
  const router = useRouter();
  const [checked, setChecked] = useState(isActive);
  const [pending, startTransition] = useTransition();

  const move = (direction: "up" | "down") =>
    startTransition(async () => {
      try {
        await moveMenuItemAction(itemId, direction);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : String(error));
      }
    });

  return (
    <div className="flex items-center gap-1.5">
      <Button
        variant="outline"
        size="icon-xs"
        aria-label={labels.moveUp}
        disabled={pending}
        onClick={() => move("up")}
      >
        <ArrowUp className="size-3.5" />
      </Button>
      <Button
        variant="outline"
        size="icon-xs"
        aria-label={labels.moveDown}
        disabled={pending}
        onClick={() => move("down")}
      >
        <ArrowDown className="size-3.5" />
      </Button>
      <Checkbox
        aria-label={labels.active}
        checked={checked}
        onCheckedChange={(next) => {
          const value = next === true;
          setChecked(value);
          startTransition(async () => {
            try {
              await toggleMenuItemAction(itemId, value);
              router.refresh();
            } catch (error) {
              setChecked(!value);
              toast.error(error instanceof Error ? error.message : String(error));
            }
          });
        }}
      />
    </div>
  );
}

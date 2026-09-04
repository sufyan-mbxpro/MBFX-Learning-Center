"use client";

// THE canonical transition wrapper for calling server actions from admin
// client components. Consolidates the `run()` helper that had been copied
// into seven files (and inlined in ~30 more call sites): pending state,
// toast on failure, router.refresh() on success so server-component data
// re-renders.
import { useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export interface RunOptions {
  /** Toast shown after the action resolves (pass a catalog string). */
  successMessage?: string;
  /** Called after success + refresh — close dialogs, reset local state. */
  onDone?: () => void;
  /** Skip the router.refresh() (e.g. optimistic UIs that already rolled forward). */
  skipRefresh?: boolean;
}

export function useServerAction() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const run = useCallback(
    (fn: () => Promise<unknown>, options?: RunOptions) => {
      startTransition(async () => {
        try {
          await fn();
          if (options?.successMessage) toast.success(options.successMessage);
          if (!options?.skipRefresh) router.refresh();
          options?.onDone?.();
        } catch (error) {
          toast.error(error instanceof Error ? error.message : String(error));
        }
      });
    },
    [router],
  );

  return { run, pending };
}

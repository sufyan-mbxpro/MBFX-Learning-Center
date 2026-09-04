"use client";

import { useSyncExternalStore } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@repo/ui/components/button";

// Dismissal persists per announcement TEXT (a new message reappears) in
// localStorage. useSyncExternalStore keeps the server render (never
// dismissed) and the client truth in sync without an effect; storage access
// is best-effort (private mode etc.).
const STORAGE_KEY = "announcement-dismissed";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function readDismissed(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function AnnouncementBar({ text, dismissible }: { text: string; dismissible: boolean }) {
  const t = useTranslations("nav");
  const dismissedText = useSyncExternalStore(subscribe, readDismissed, () => null);

  if (dismissedText === text || !text) return null;

  const dismiss = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, text);
      // Same-tab writes don't fire the storage event — nudge subscribers.
      window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
    } catch {
      /* storage unavailable — bar stays visible */
    }
  };

  return (
    <div className="flex items-center justify-center gap-2 bg-primary px-4 py-1.5 text-sm text-primary-foreground">
      <p className="text-center">{text}</p>
      {dismissible && (
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={t("dismiss")}
          className="text-primary-foreground hover:bg-primary-hover hover:text-primary-foreground"
          onClick={dismiss}
        >
          <X aria-hidden className="size-3.5" />
        </Button>
      )}
    </div>
  );
}

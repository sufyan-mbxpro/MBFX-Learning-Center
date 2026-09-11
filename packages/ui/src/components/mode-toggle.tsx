"use client";

// USER-controlled theme mode (ADR-008 / plan A5.4): the user picks
// light/dark; admins control branding, never the mode. Label comes from the
// caller's catalog — @repo/ui carries no i18n.
import { Moon, Sun } from "lucide-react";

import { Button } from "@repo/ui/components/button";
import { useTheme } from "@repo/ui/components/theme-provider";

function ModeToggle({ label }: { label: string }) {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={label}
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <Sun className="size-4 dark:hidden" />
      <Moon className="hidden size-4 dark:block" />
    </Button>
  );
}

export { ModeToggle };

"use client";

import { useTheme } from "@repo/ui/components/theme-provider";
import { Toaster as Sonner, type ToasterProps } from "sonner";
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon } from "lucide-react";
import { Spinner } from "@repo/ui/components/spinner";

// changes-20 / ADR-074 — the reference's toast (tokens.md §6.14), mapped onto
// Sonner, the one toast system (ADR-072 §10): a bordered card on the page
// background with shadow-lg, a 14px semibold title over a muted description,
// a primary action and a muted cancel, stacked at the bottom-end, 420px wide.
// Sonner's own CSS variables carry the surface so its layout/animation code
// keeps working; the classNames carry the type and button treatment.
const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="bottom-right"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        // The brand mark, not lucide's ring: one pending glyph app-wide
        // (changes-21 Phase A).
        loading: <Spinner />,
      }}
      style={
        {
          "--normal-bg": "var(--background)",
          "--normal-text": "var(--foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
          "--width": "420px",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "group toast border-border shadow-lg",
          title: "text-sm font-semibold",
          description: "text-sm text-muted-foreground",
          actionButton: "bg-primary-solid text-primary-solid-foreground",
          cancelButton: "bg-muted text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };

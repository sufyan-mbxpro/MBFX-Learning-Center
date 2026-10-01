"use client";

// The email preview, as one set of pieces every email screen shares
// (changes-59): a FRAME with device / colour-mode / source toggles, a DIALOG
// around it, and a THUMBNAIL for a gallery card.
//
// All three keep ADR-078 #8's rule: the rendered message is a real form POST
// at a named `sandbox=""` frame, so it lands on its own opaque origin under
// the preview route's own CSP. The HTML view is the one place the markup is
// fetched, and it is shown as TEXT in a `<pre>` — never parsed, never given a
// URL on the admin origin — which is the property the rule protects.
import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Code, Copy, Eye, Monitor, Moon, RefreshCw, Smartphone, Sun } from "lucide-react";
import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import { cn } from "@repo/ui/lib/utils";

export const EMAIL_PREVIEW_URL = "/keystone/api/email/preview";

/** The fields the preview route reads, posted as hidden inputs. */
export type EmailPreviewFields = Readonly<Record<string, string>>;

type Device = "desktop" | "mobile";
type Scheme = "light" | "dark";
type View = "rendered" | "source";

/** A frame name a form can target: `useId` output, minus the colons. */
function useFrameName(prefix: string): string {
  return `${prefix}-${React.useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
}

function HiddenFields({ fields }: { fields: EmailPreviewFields }) {
  return (
    <>
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
    </>
  );
}

/** How long the fields must sit still before an editor's draft re-renders. */
const FIELD_SETTLE_MS = 600;

/**
 * `value`, once it has stopped changing. An editor passes its live draft, and
 * a preview is a navigation: one per keystroke would be a request per
 * character. The FIRST value is adopted immediately, so a frame that mounts
 * renders at once.
 */
function useSettled(value: string): string {
  const [settled, setSettled] = React.useState(value);
  React.useEffect(() => {
    if (value === settled) return;
    const timer = window.setTimeout(() => setSettled(value), FIELD_SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, [value, settled]);
  return settled;
}

/** A small segmented control: each option is a pressed/unpressed button. */
function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (next: T) => void;
  options: { value: T; label: string; icon: React.ComponentType<{ className?: string }> }[];
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex items-center gap-0.5 rounded-md bg-muted p-0.5"
    >
      {options.map((option) => {
        const Icon = option.icon;
        const active = option.value === value;
        return (
          <Button
            key={option.value}
            type="button"
            size="sm"
            variant="ghost"
            aria-pressed={active}
            title={option.label}
            onClick={() => onChange(option.value)}
            className={cn(
              "h-7 gap-1.5 px-2 text-muted-foreground",
              active && "bg-background text-foreground shadow-sm hover:bg-background",
            )}
          >
            <Icon aria-hidden className="size-4" />
            <span className="sr-only sm:not-sr-only">{option.label}</span>
          </Button>
        );
      })}
    </div>
  );
}

export interface EmailPreviewFrameProps {
  fields: EmailPreviewFields;
  /** Taller in a preview dialog, shorter inside a form's own dialog. */
  size?: "compact" | "default" | "tall";
  /** Rendered before the toggles, e.g. a language picker. */
  toolbarStart?: React.ReactNode;
  /** Bumped by a caller that saved, so the frame re-renders the saved words. */
  refreshKey?: number;
  className?: string;
}

export function EmailPreviewFrame({
  fields,
  size = "default",
  toolbarStart,
  refreshKey = 0,
  className,
}: EmailPreviewFrameProps) {
  const t = useTranslations("admin.emailPreview");
  const frame = useFrameName("email-preview");
  const formRef = React.useRef<HTMLFormElement>(null);
  const [device, setDevice] = React.useState<Device>("desktop");
  const [scheme, setScheme] = React.useState<Scheme>("light");
  const [view, setView] = React.useState<View>("rendered");
  // Bumped by the refresh button: the source view refetches on it.
  const [nonce, setNonce] = React.useState(0);
  // Keyed by the request it answers, so "loading" is DERIVED — a stored
  // result for another request is simply not this request's answer yet.
  const [source, setSource] = React.useState<{
    request: string;
    state: "ready" | "failed";
    html: string;
  } | null>(null);

  // The fields wait to settle; the toggles do not — a click answers at once.
  const fieldsKey = useSettled(JSON.stringify(fields));
  const posted = React.useMemo(
    () => ({ ...(JSON.parse(fieldsKey) as Record<string, string>), scheme }),
    [fieldsKey, scheme],
  );
  const postedKey = JSON.stringify(posted);

  // Re-render whenever what would be posted changes, or a caller saved.
  React.useEffect(() => {
    if (view === "rendered") formRef.current?.requestSubmit();
  }, [postedKey, refreshKey, view]);

  const request = `${postedKey}|${refreshKey}|${nonce}`;
  React.useEffect(() => {
    if (view !== "source") return;
    let cancelled = false;
    fetch(EMAIL_PREVIEW_URL, {
      method: "POST",
      body: new URLSearchParams(JSON.parse(postedKey) as Record<string, string>),
    })
      .then((response) => response.text())
      .then((html) => {
        if (!cancelled) setSource({ request, state: "ready", html });
      })
      .catch(() => {
        if (!cancelled) setSource({ request, state: "failed", html: "" });
      });
    return () => {
      cancelled = true;
    };
  }, [postedKey, request, view]);
  const sourceState = source?.request === request ? source.state : "loading";

  async function copySource() {
    try {
      await navigator.clipboard.writeText(source?.html ?? "");
      toast.success(t("copied"));
    } catch {
      toast.error(t("copyFailed"));
    }
  }

  const height = size === "tall" ? "h-180" : size === "compact" ? "h-120" : "h-160";

  return (
    <div className={cn("flex flex-col overflow-hidden rounded-lg border bg-card", className)}>
      <div className="flex flex-wrap items-center gap-2 border-b bg-card p-2">
        {toolbarStart}
        <Segmented
          label={t("device")}
          value={device}
          onChange={setDevice}
          options={[
            { value: "desktop", label: t("desktop"), icon: Monitor },
            { value: "mobile", label: t("mobile"), icon: Smartphone },
          ]}
        />
        <Segmented
          label={t("scheme")}
          value={scheme}
          onChange={setScheme}
          options={[
            { value: "light", label: t("light"), icon: Sun },
            { value: "dark", label: t("dark"), icon: Moon },
          ]}
        />
        <Segmented
          label={t("view")}
          value={view}
          onChange={setView}
          options={[
            { value: "rendered", label: t("rendered"), icon: Eye },
            { value: "source", label: t("source"), icon: Code },
          ]}
        />
        <div className="ms-auto flex items-center gap-1">
          {view === "source" && sourceState === "ready" && (
            <Button type="button" size="sm" variant="ghost" onClick={() => void copySource()}>
              <Copy aria-hidden data-icon="inline-start" />
              {t("copy")}
            </Button>
          )}
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label={t("refresh")}
            title={t("refresh")}
            onClick={() =>
              view === "rendered" ? formRef.current?.requestSubmit() : setNonce((n) => n + 1)
            }
          >
            <RefreshCw aria-hidden />
          </Button>
        </div>
      </div>

      <form
        ref={formRef}
        action={EMAIL_PREVIEW_URL}
        method="post"
        target={frame}
        className="hidden"
      >
        <HiddenFields fields={posted} />
      </form>

      <div className={cn("flex justify-center bg-muted/60 p-4", height)}>
        {/* The frame stays mounted while the HTML view shows, so switching back
            does not cost another render. */}
        <iframe
          name={frame}
          title={t("frameTitle")}
          sandbox=""
          className={cn(
            "h-full rounded-md border bg-background shadow-sm",
            device === "mobile" ? "w-96" : "w-full",
            view === "source" && "hidden",
          )}
        />
        {view === "source" && (
          <div className="h-full w-full overflow-auto rounded-md border bg-background">
            {sourceState === "loading" && (
              <p className="p-4 text-sm text-muted-foreground">{t("sourceLoading")}</p>
            )}
            {sourceState === "failed" && (
              <p className="p-4 text-sm text-destructive-interactive">{t("sourceFailed")}</p>
            )}
            {sourceState === "ready" && (
              // A value read character by character: the code-style #6 exception.
              <pre className="p-4 font-mono text-xs leading-relaxed break-all whitespace-pre-wrap">
                {source?.html}
              </pre>
            )}
          </div>
        )}
      </div>
      <p className="border-t px-3 py-2 text-xs text-muted-foreground">
        {scheme === "dark" ? t("darkNote") : t("lightNote")}
      </p>
    </div>
  );
}

export function EmailPreviewDialog({
  open,
  onOpenChange,
  title,
  description,
  fields,
  toolbarStart,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  fields: EmailPreviewFields;
  toolbarStart?: React.ReactNode;
}) {
  const t = useTranslations("admin.emailPreview");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{title ?? t("title")}</DialogTitle>
          <DialogDescription>{description ?? t("description")}</DialogDescription>
        </DialogHeader>
        {/* Mounted per open, so a closed dialog posts nothing. */}
        {open && <EmailPreviewFrame fields={fields} size="tall" toolbarStart={toolbarStart} />}
      </DialogContent>
    </Dialog>
  );
}

/**
 * A card's picture of the email: the real render, scaled to half size and
 * inert. It posts only once the card scrolls into view, so a gallery of
 * sixty does not fire sixty renders on load.
 */
export function EmailPreviewThumbnail({
  fields,
  label,
  className,
}: {
  fields: EmailPreviewFields;
  label: string;
  className?: string;
}) {
  const frame = useFrameName("email-thumb");
  const holderRef = React.useRef<HTMLDivElement>(null);
  const formRef = React.useRef<HTMLFormElement>(null);
  // A ref, not state: being seen changes what is POSTED, never what renders.
  const seen = React.useRef(false);
  const fieldsKey = JSON.stringify(fields);

  React.useEffect(() => {
    const node = holderRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          seen.current = true;
          formRef.current?.requestSubmit();
          observer.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // New fields re-render a thumbnail that has already been seen.
  React.useEffect(() => {
    if (seen.current) formRef.current?.requestSubmit();
  }, [fieldsKey]);

  return (
    <div
      ref={holderRef}
      // The email is laid out left to right whatever the admin's direction.
      dir="ltr"
      className={cn("relative h-56 overflow-hidden bg-muted", className)}
    >
      <form
        ref={formRef}
        action={EMAIL_PREVIEW_URL}
        method="post"
        target={frame}
        className="hidden"
      >
        <HiddenFields fields={fields} />
      </form>
      <iframe
        name={frame}
        title={label}
        sandbox=""
        tabIndex={-1}
        aria-hidden
        className="pointer-events-none absolute top-0 start-1/2 h-240 w-160 origin-top -translate-x-1/2 scale-40 border-0 bg-transparent"
      />
    </div>
  );
}

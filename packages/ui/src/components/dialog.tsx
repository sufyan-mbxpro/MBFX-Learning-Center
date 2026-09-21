"use client";

import * as React from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";

import { cn } from "@repo/ui/lib/utils";
import { Button } from "@repo/ui/components/button";
import { XIcon } from "lucide-react";

// changes-20 / ADR-074 — the reference's dialog (tokens.md §6.14, capture-2):
// a 512px bordered card on the page background, 24px padding, shadow-lg,
// over the 80% scrim. Full-bleed on mobile, rounded-lg from `sm` up.
//
// It FITS THE SCREEN (changes-43, image-95): capped at `--dialog-max-h`
// (the viewport less a 1rem margin top and bottom) and scrolls itself, with
// the header, the corner close and the footer STICKY — so the fields scroll
// between a title that stays and Save/Cancel that stay. `max-h-dvh` alone
// let the "New instrument" form scroll its own buttons off the bottom.
//
// The stickiness lives in DialogHeader / DialogFooter rather than in a body
// wrapper because forty call sites put their fields straight into
// DialogContent, some inside a <form> that also holds the footer; a sticky
// element sticks within its parent's box, so both shapes work unchanged.
// Every call site still relies on the popup's own `p-6`: the header and
// footer bleed into it with matching negative margins so a stuck band
// covers the scrolled content edge to edge.

function Dialog({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogOverlay({ className, ...props }: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 isolate z-50 bg-overlay duration-200 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className,
      )}
      {...props}
    />
  );
}

/**
 * The reference's corner close: a bare 16px glyph at 70% opacity, top-4 /
 * end-4, not a ghost button. Shared with Sheet so the two cannot drift.
 */
const OVERLAY_CLOSE_CLASS =
  "absolute top-4 end-4 rounded-sm opacity-70 transition-opacity outline-none hover:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none [&_svg]:size-4";

function DialogContent({
  className,
  children,
  showCloseButton = true,
  closeLabel = "Close",
  ...props
}: DialogPrimitive.Popup.Props & {
  showCloseButton?: boolean;
  /** Accessible name for the corner close button — pass a catalog string. */
  closeLabel?: string;
}) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        className={cn(
          "fixed top-1/2 start-1/2 z-50 flex max-h-(--dialog-max-h) w-full max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto overscroll-contain border bg-background p-6 text-foreground shadow-lg duration-200 outline-none sm:rounded-lg rtl:translate-x-1/2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          className,
        )}
        {...props}
      >
        {children}
        {/* The close rides a zero-height sticky anchor so it stays in the
            corner while the body scrolls — absolute inside a scroller would
            scroll away with the fields. It stays LAST in the DOM, because
            Base UI focuses the first tabbable element on open and that must
            remain the first field, not the close; `order-first` draws it at
            the top instead.

            Sticky offsets are measured INSIDE the popup's `p-6` (seen at
            1366x768, changes-43): `top-0` / `bottom-0` pinned the header and
            footer 24px short of the edges, so fields showed through above the
            header and below Save. Hence `-top-6` here and on the header, and
            `-bottom-6` on the footer. `-mt-6` lifts the anchor to the popup's
            top edge, the button's `top-4 -end-2` lands on the reference's
            16px corner, and `mb-2` plus the flex gap is what the header's own
            `-mt-6` cancels. */}
        {showCloseButton && (
          <div
            data-slot="dialog-close-anchor"
            className="pointer-events-none sticky -top-6 z-20 order-first -mt-6 mb-2 h-0"
          >
            <DialogPrimitive.Close
              data-slot="dialog-close"
              className={cn(OVERLAY_CLOSE_CLASS, "pointer-events-auto top-4 -end-2")}
            >
              <XIcon aria-hidden />
              <span className="sr-only">{closeLabel}</span>
            </DialogPrimitive.Close>
          </div>
        )}
      </DialogPrimitive.Popup>
    </DialogPortal>
  );
}

/**
 * Sticky at the top of a scrolling dialog, bleeding into the popup's `p-6`
 * (see the file comment). A visually-hidden header (the ⌘K palette's) opts
 * out: `sr-only` and `sticky` both set `position`, and which one wins would
 * depend on stylesheet order rather than on anything written here.
 */
function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  const hidden = typeof className === "string" && /(^|\s)sr-only(\s|$)/.test(className);
  return (
    <div
      data-slot="dialog-header"
      className={cn(
        "flex flex-col gap-1.5 text-center sm:text-start",
        !hidden && "sticky -top-6 z-10 -mx-6 -mt-6 bg-background px-6 pt-6 pb-3",
        className,
      )}
      {...props}
    />
  );
}

function DialogFooter({
  className,
  showCloseButton = false,
  closeLabel = "Close",
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean;
  /** Label for the optional footer close button — pass a catalog string. */
  closeLabel?: string;
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        // Sticky at the bottom (see the file comment): Save and Cancel stay
        // on screen however long the form is.
        "sticky -bottom-6 z-10 -mx-6 -mb-6 flex flex-col-reverse gap-2 bg-background px-6 pt-3 pb-6 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close render={<Button variant="outline" />}>
          {closeLabel}
        </DialogPrimitive.Close>
      )}
    </div>
  );
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-lg leading-none font-semibold tracking-tight", className)}
      {...props}
    />
  );
}

function DialogDescription({ className, ...props }: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className,
      )}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
  OVERLAY_CLOSE_CLASS,
};

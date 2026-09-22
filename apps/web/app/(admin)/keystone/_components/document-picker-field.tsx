"use client";

// THE document input for the admin surface (changes-33, ADR-110) — the
// `DOCUMENT` setting type's control, and today that means the three legal
// documents.
//
// A sibling of `ImageUploadField`, not a mode of it. They look alike and are
// deliberately not the same component: an image field's whole affordance is
// the PREVIEW — you recognise the picture and know you chose the right one —
// and a thumbnail of page one of a forty-page agreement tells an admin
// nothing. What tells them something is the file's name and a way to open it,
// which is what this renders instead.
//
// **It has no upload of its own.** The picker it opens already uploads
// (`MediaPickerDialog` has carried `useUploadProgress` since ADR-049), so a
// second upload path here would be a second set of size limits, a second
// error surface and a second place for the category to be wrong. One door,
// the same one the media library uses.
//
// The value it hands back is a PATH, never an asset id: `/legal/[doc]` reads
// the setting and branches on the `/uploads/` prefix (ADR-110), so the stored
// string has to be the thing a browser could fetch.
import * as React from "react";
import { useTranslations } from "next-intl";
import { ExternalLink, FileText, LibraryBig, Trash2 } from "lucide-react";

import { Button } from "@repo/ui/components/button";
import { ConfirmDialog } from "@repo/ui/components/confirm-dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  useFieldControl,
} from "@repo/ui/components/field";
import { MediaPickerDialog } from "./media-picker-dialog.tsx";

/**
 * The Choose button is this field's CONTROL (ADR-077), for the same reason
 * `ImageUploadField`'s Upload button is: the file input the picker owns is
 * inside a dialog that is not open yet, so there is nothing else on screen a
 * failed save could focus.
 */
type ChooseButtonProps = React.ComponentProps<typeof Button> & { required?: boolean };

function ChooseButton(props: ChooseButtonProps) {
  const {
    required: _required,
    "aria-required": _ariaRequired,
    ...wired
  } = useFieldControl<ChooseButtonProps>(props, { requiredAs: "aria" });
  return <Button {...wired} />;
}

/** The last path segment, which for a stored upload is the key and for a
 *  committed file is its real name. Either way it is what an admin recognises
 *  — the full path is noise they did not type. */
function displayName(value: string): string {
  const withoutQuery = value.split("?")[0] ?? value;
  return withoutQuery.split("/").filter(Boolean).at(-1) ?? withoutQuery;
}

export function DocumentPickerField({
  label,
  description,
  value,
  onChange,
  required,
  error,
}: {
  label: string;
  description?: string;
  /** The stored site-relative path, or an empty string for "not published". */
  value: string;
  onChange: (next: string) => void;
  required?: boolean;
  error?: string;
}) {
  const t = useTranslations("admin");
  const [pickerOpen, setPickerOpen] = React.useState(false);

  return (
    <Field invalid={error !== undefined} required={required ?? false}>
      <FieldLabel>{label}</FieldLabel>
      {description && <FieldDescription>{description}</FieldDescription>}

      {value ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/30 p-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary-interactive">
            <FileText aria-hidden className="size-4" />
          </span>
          <span className="min-w-0 flex-1 truncate text-sm text-foreground">
            {displayName(value)}
          </span>
          {/* A plain anchor, not `Link`: this is an absolute site path to a
              file, and the i18n Link would locale-prefix it. */}
          <Button
            variant="outline"
            size="sm"
            render={<a href={value} target="_blank" rel="noopener noreferrer" />}
          >
            <ExternalLink data-icon="inline-start" aria-hidden />
            {t("documentOpen")}
          </Button>
          <ChooseButton
            type="button"
            variant="outline"
            size="sm"
            required={required}
            onClick={() => setPickerOpen(true)}
          >
            <LibraryBig data-icon="inline-start" aria-hidden />
            {t("documentReplace")}
          </ChooseButton>
          {/* code-style.md #7: clearing a document is destructive — the
              footer link disappears the moment it saves — so it asks. */}
          <ConfirmDialog
            trigger={
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                aria-label={t("documentRemove")}
              >
                <Trash2 aria-hidden className="size-3.5" />
              </Button>
            }
            title={t("confirmRemoveDocumentTitle")}
            description={t("confirmRemoveDocumentBody")}
            confirmLabel={t("documentRemove")}
            cancelLabel={t("cancel")}
            onConfirm={() => onChange("")}
          />
        </div>
      ) : (
        <ChooseButton
          type="button"
          variant="outline"
          size="sm"
          required={required}
          onClick={() => setPickerOpen(true)}
        >
          <LibraryBig data-icon="inline-start" aria-hidden />
          {t("documentChoose")}
        </ChooseButton>
      )}

      <FieldError>{error}</FieldError>

      <MediaPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        kinds={["DOCUMENT"]}
        purpose="setting"
        category="general"
        sourceType="SETTING"
        title={t("documentPickerTitle")}
        onSelect={(picked) => {
          onChange(picked.url);
          setPickerOpen(false);
        }}
      />
    </Field>
  );
}

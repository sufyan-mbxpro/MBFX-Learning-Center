"use client";

// The slug input, everywhere (changes-18 PR 3).
//
// Three behaviours the hand-rolled `<Input>`s did not have, and one rule about
// when to stop:
//
//  1. **It autofills from the title.** An editor typing "Market fundamentals"
//     should not also have to type "market-fundamentals"; every content system
//     they have used does this for them.
//  2. **It stops the moment they touch it.** A slug the editor has edited is a
//     decision, and an autofill that keeps overwriting it is the bug that makes
//     people distrust the field and fill it in by hand forever after. Once
//     `touched` is set it never unsets — including when they clear the box,
//     because "" is a deliberate value meaning "derive it on save".
//  3. **It validates as you type**, against `slugify` itself rather than a
//     second regex. `@repo/utils` owns the rule (it moved out of `@repo/core`
//     precisely so a client component could reach it), so this cannot drift
//     from what the server will actually store.
//
// The preview is the real URL, not a fragment, because that is the question an
// editor is actually asking when they look at this field.
import { useState } from "react";
import { slugify } from "@repo/utils";
import { Input } from "@repo/ui/components/input";
import { Field } from "./editor-section.tsx";

export interface SlugFieldLabels {
  label: string;
  /** Prefixes the preview, e.g. "Public URL". */
  urlLabel: string;
  /** Shown when what they typed is not what would be stored. */
  willBeSaved: string;
  /** Shown when the box is empty and the title will be used instead. */
  derivedFromTitle: string;
}

export function SlugField({
  id,
  value,
  /** The title this slug derives from while untouched. */
  source,
  /** Builds the preview URL from a slug. Called with the STORED form. */
  previewPath,
  disabled,
  onChange,
  labels,
}: {
  id: string;
  value: string;
  source: string;
  previewPath: (slug: string) => string;
  disabled?: boolean;
  onChange: (next: string) => void;
  labels: SlugFieldLabels;
}) {
  // Not derived from `value !== ""`: a topic loaded for editing already HAS a
  // slug, and treating that as "untouched" would let a title edit silently
  // rewrite the URL of a published page. Touched means touched HERE.
  const [touched, setTouched] = useState(false);

  // What the server will actually store, which is not always what is in the
  // box: `slugify` runs on save regardless, so showing the typed value alone
  // would mean the field lies about the URL until the page reloads.
  const stored = slugify(value.trim() || source);
  const differs = value.trim() !== "" && stored !== value.trim();

  return (
    <Field
      id={id}
      label={labels.label}
      hint={
        value.trim() === ""
          ? `${labels.derivedFromTitle} — ${labels.urlLabel}: ${previewPath(stored)}`
          : differs
            ? `${labels.willBeSaved}: ${previewPath(stored)}`
            : `${labels.urlLabel}: ${previewPath(stored)}`
      }
    >
      <Input
        id={id}
        value={touched ? value : value || slugify(source)}
        disabled={disabled}
        onChange={(event) => {
          setTouched(true);
          onChange(event.target.value);
        }}
      />
    </Field>
  );
}

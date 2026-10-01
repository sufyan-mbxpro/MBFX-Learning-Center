"use client";

// Add or edit a language (ADR-178 #2). Adding picks a code from the site's
// registry (`available`, every supported language with no row yet) and
// prefills the names from it; editing changes the names, flag, fallback and
// order. The code and the text direction are never editable: the code is the
// URL prefix, and the direction comes with the language.
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { localeSaveSchema, type LocaleSaveInput } from "@repo/contracts";
import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { createLocaleAction, updateLocaleAction } from "../../../../_actions/translate-actions.ts";
import { AdminCombobox } from "../../../../_components/combobox.tsx";
import { useFieldErrors } from "../../../../_hooks/use-field-errors.ts";
import { useServerAction } from "../../../../_hooks/use-server-action.ts";

export interface AvailableLanguage {
  code: string;
  name: string;
  nativeName: string;
  direction: "LTR" | "RTL";
}

/** What the dialog edits; `null` closes it. */
export type LanguageDraft =
  | { mode: "add" }
  | {
      mode: "edit";
      code: string;
      name: string;
      nativeName: string;
      flagEmoji: string | null;
      fallbackCode: string | null;
      sortOrder: number;
    };

/** The fallback combobox needs a value for "none". Not a locale code. */
const NO_FALLBACK = "none";

interface FormState {
  code: string;
  name: string;
  nativeName: string;
  flagEmoji: string;
  fallbackCode: string;
  sortOrder: string;
}

function initialState(
  draft: LanguageDraft,
  available: AvailableLanguage[],
  nextOrder: number,
  defaultCode: string,
): FormState {
  if (draft.mode === "edit") {
    return {
      code: draft.code,
      name: draft.name,
      nativeName: draft.nativeName,
      flagEmoji: draft.flagEmoji ?? "",
      fallbackCode: draft.fallbackCode ?? NO_FALLBACK,
      sortOrder: String(draft.sortOrder),
    };
  }
  return prefill(available[0], nextOrder, defaultCode);
}

/** A registry language's defaults: an RTL language shows a notice rather than LTR text. */
function prefill(
  language: AvailableLanguage | undefined,
  nextOrder: number,
  defaultCode: string,
): FormState {
  return {
    code: language?.code ?? "",
    name: language?.name ?? "",
    nativeName: language?.nativeName ?? "",
    flagEmoji: "",
    fallbackCode: language?.direction === "RTL" ? NO_FALLBACK : defaultCode,
    sortOrder: String(nextOrder),
  };
}

export function LanguageDialog({
  draft,
  onClose,
  available,
  all,
  nextOrder,
  defaultCode,
}: {
  draft: LanguageDraft | null;
  onClose: () => void;
  available: AvailableLanguage[];
  all: Array<{ code: string; name: string }>;
  nextOrder: number;
  defaultCode: string;
}) {
  return (
    <Dialog open={draft !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        {draft && (
          // Keyed so each opening starts from its own row, not the last one's.
          <LanguageForm
            key={draft.mode === "edit" ? draft.code : "add"}
            draft={draft}
            onClose={onClose}
            available={available}
            all={all}
            nextOrder={nextOrder}
            defaultCode={defaultCode}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function LanguageForm({
  draft,
  onClose,
  available,
  all,
  nextOrder,
  defaultCode,
}: {
  draft: LanguageDraft;
  onClose: () => void;
  available: AvailableLanguage[];
  all: Array<{ code: string; name: string }>;
  nextOrder: number;
  defaultCode: string;
}) {
  const t = useTranslations("admin.translate.languages");
  const { run, pending } = useServerAction();
  const [state, setState] = useState(() => initialState(draft, available, nextOrder, defaultCode));
  const set = (patch: Partial<FormState>) => setState((current) => ({ ...current, ...patch }));

  const values: LocaleSaveInput = useMemo(
    () => ({
      code: state.code,
      name: state.name,
      nativeName: state.nativeName,
      flagEmoji: state.flagEmoji,
      fallbackCode: state.fallbackCode === NO_FALLBACK ? null : state.fallbackCode,
      sortOrder: Number(state.sortOrder),
    }),
    [state],
  );
  const form = useFieldErrors(localeSaveSchema, values);

  const adding = draft.mode === "add";
  const title = adding ? t("addTitle") : t("editTitle", { language: draft.name });
  const fallbackOptions = [
    { value: NO_FALLBACK, label: t("fields.fallbackNone") },
    ...all
      .filter((row) => row.code !== state.code)
      .map((row) => ({ value: row.code, label: row.name })),
  ];

  const save = () => {
    if (!form.validate()) return;
    run(
      async () => {
        const result = adding ? await createLocaleAction(values) : await updateLocaleAction(values);
        if (!result.ok) throw new Error(t(`saveRefusals.${result.reason}`));
      },
      {
        successMessage: adding
          ? t("created", { language: values.name })
          : t("updated", { language: values.name }),
        onDone: onClose,
      },
    );
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{adding ? t("addDescription") : t("editDescription")}</DialogDescription>
      </DialogHeader>

      {adding && available.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noneToAdd")}</p>
      ) : (
        <FieldGroup>
          {adding && (
            <Field required invalid={form.invalid("code")}>
              <FieldLabel>{t("fields.language")}</FieldLabel>
              <AdminCombobox
                value={state.code}
                onValueChange={(code) =>
                  setState(
                    prefill(
                      available.find((language) => language.code === code),
                      Number(state.sortOrder) || nextOrder,
                      defaultCode,
                    ),
                  )
                }
                options={available.map((language) => ({
                  value: language.code,
                  label: `${language.name} · ${language.nativeName}`,
                }))}
              />
              <FieldDescription>{t("fields.languageHint")}</FieldDescription>
              <FieldError>{form.error("code")}</FieldError>
            </Field>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field required invalid={form.invalid("name")}>
              <FieldLabel>{t("fields.name")}</FieldLabel>
              <Input value={state.name} onChange={(event) => set({ name: event.target.value })} />
              <FieldError>{form.error("name")}</FieldError>
            </Field>
            <Field required invalid={form.invalid("nativeName")}>
              <FieldLabel>{t("fields.nativeName")}</FieldLabel>
              <Input
                value={state.nativeName}
                onChange={(event) => set({ nativeName: event.target.value })}
              />
              <FieldDescription>{t("fields.nativeNameHint")}</FieldDescription>
              <FieldError>{form.error("nativeName")}</FieldError>
            </Field>
          </div>

          <Field invalid={form.invalid("fallbackCode")}>
            <FieldLabel>{t("fields.fallback")}</FieldLabel>
            <AdminCombobox
              value={state.fallbackCode}
              onValueChange={(fallbackCode) => set({ fallbackCode })}
              options={fallbackOptions}
            />
            <FieldDescription>{t("fields.fallbackHint")}</FieldDescription>
            <FieldError>{form.error("fallbackCode")}</FieldError>
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field invalid={form.invalid("flagEmoji")}>
              <FieldLabel>{t("fields.flag")}</FieldLabel>
              <Input
                value={state.flagEmoji}
                onChange={(event) => set({ flagEmoji: event.target.value })}
              />
              <FieldDescription>{t("fields.flagHint")}</FieldDescription>
              <FieldError>{form.error("flagEmoji")}</FieldError>
            </Field>
            <Field required invalid={form.invalid("sortOrder")}>
              <FieldLabel>{t("fields.order")}</FieldLabel>
              <Input
                type="number"
                min={0}
                value={state.sortOrder}
                onChange={(event) => set({ sortOrder: event.target.value })}
              />
              <FieldError>{form.error("sortOrder")}</FieldError>
            </Field>
          </div>
        </FieldGroup>
      )}

      <DialogFooter>
        {!(adding && available.length === 0) && (
          <Button type="button" loading={pending} onClick={save}>
            {t("save")}
          </Button>
        )}
      </DialogFooter>
    </>
  );
}

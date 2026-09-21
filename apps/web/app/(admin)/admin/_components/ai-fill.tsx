"use client";

// "Generate with AI" and every field's ✨ menu (ADR-126).
//
// **Two affordances, one feature key.** The BUTTON in an editor's first
// section header opens a dropdown form that sends a brief and gets back every fillable field of that module; the MENU beside one
// field regenerates, improves, shortens or lengthens that field alone. Both
// parse the answer with schemas DERIVED from `AI_FILL_FIELDS` — the same
// registry the prompt describes — so a limit the prompt names is a limit the
// parser enforces (ADR-097 #13).
//
// **No section and no modal.** The brief, the review and Apply all live in one
// dropdown under that button — the rich-text ✨ shape — which closes on Apply.
//
// **Review before replacing** (ADR-126 §4). The review shows one row
// per suggested field, current beside suggested, ticked ONLY where the field is
// empty — B2's rule, generalised. Apply hands the editor ONE patch; the editor
// writes it into state in one update and its own Save persists it (ADR-097 #4).
//
// **Rendered as TEXT, never HTML.** Rich values are previewed through
// `aiBlocksToText` and converted to markup only by `aiBlocksToHtml`, which
// escapes every character. Nothing here sets inner HTML.
//
// **Absent, not disabled** (ADR-097 #6). The host renders these only when its
// page resolved `form_fill` as available; an unavailable feature is no button.
//
// ─── `AiFieldMenu` is for PLAIN-TEXT fields only (changes-40) ────────────
//
// A rich-text field already carries the writing assistant INSIDE its toolbar
// (changes-29 B1), and the assistant is the better of the two there: it works
// on the selection, streams into the document, and knows the block structure.
// Putting this menu beside the same field gave every rich-text field two ✨
// buttons a few pixels apart, doing overlapping jobs with different results —
// and the outer one replaced the whole field where the inner one edits a
// passage.
//
// So the split is by CONTROL, not by feature: the toolbar assistant owns rich
// text, this menu owns everything typed into an `Input` or a `Textarea` — a
// title, a summary, an SEO description. `form_fill` itself is untouched: the
// "Generate with AI" brief still writes every field of a module, rich ones
// included, because that is one action a reviewer approves in one place rather
// than a second control sitting on the field.
//
// Guarded by `apps/web/app/changes-40-fixes.test.ts`.
import { useMemo, useState } from "react";
import { Languages, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  AI_FIELD_ACTIONS,
  AI_FILL_AUDIENCES,
  AI_FILL_FIELDS,
  AI_FILL_LENGTHS,
  AI_STUDIO_TONES,
  aiFieldSuggestionSchema,
  aiFillField,
  aiFormSuggestionSchema,
  type AiFieldAction,
  type AiFillAudience,
  type AiFillFieldDefinition,
  type AiFillLength,
  type AiFillModule,
  type AiRichBlock,
  type AiStudioTone,
  type GeneratedQuizQuestion,
} from "@repo/contracts";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Checkbox } from "@repo/ui/components/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/ui/components/popover";
import { Spinner } from "@repo/ui/components/spinner";
import { Textarea } from "@repo/ui/components/textarea";
import { ViewChip, ViewChips } from "@repo/ui/components/view-chips";
import { aiBlocksToHtml, aiBlocksToText, humanizeKey } from "@repo/utils";
import { AiClientError, runAiJson } from "../_lib/ai-client.ts";
import { AdminCombobox } from "./combobox.tsx";

export interface AiFillLabels {
  title: string;
  description: string;
  back: string;
  briefLabel: string;
  briefPlaceholder: string;
  questionCount: string;
  languageLabel: string;
  languageHint: string;
  toneLabel: string;
  toneDefault: string;
  tones: Record<AiStudioTone, string>;
  audienceLabel: string;
  audienceDefault: string;
  audiences: Record<AiFillAudience, string>;
  lengthLabel: string;
  lengths: Record<AiFillLength, string>;
  generate: string;
  generating: string;
  reviewTitle: string;
  reviewDescription: string;
  current: string;
  suggested: string;
  empty: string;
  apply: string;
  applied: string;
  cancel: string;
  failed: string;
  tokenHint: string;
  fieldMenu: string;
  fieldActions: Record<AiFieldAction, string>;
  fieldReviewTitle: string;
  fieldReviewDescription: string;
  fieldReplace: string;
  fieldDiscard: string;
  reasons: Record<string, string>;
}

/** What a page hands its editor when `form_fill` is available. */
export interface AiFillConfig {
  module: AiFillModule;
  entity?: { type: string; id: string };
  labels: AiFillLabels;
  /**
   * The writing assistant is on, so every rich-text field shows its ✨ in the
   * editor toolbar. The field menu then stays off those fields.
   */
  richHasAssistant?: boolean;
}

export type AiFaqValue = { question: string; answer: string };

/**
 * A suggestion as the EDITOR receives it: rich text already converted to
 * sanitizer-safe HTML, lists as arrays, FAQs and questions as items.
 */
export type AiFillValue = string | string[] | AiFaqValue[] | GeneratedQuizQuestion[];
export type AiFillPatch = Record<string, AiFillValue>;

/**
 * The editor's CURRENT text, one plain-text string per fillable field. It does
 * three jobs: the "current" column of the review, the empty test that decides
 * the default tick, and the context the prompt continues from.
 */
export type AiFillCurrent = Record<string, string>;

type RawValue = string | string[] | AiRichBlock[] | AiFaqValue[] | GeneratedQuizQuestion[];

function fieldsOf(module: AiFillModule): readonly AiFillFieldDefinition[] {
  return AI_FILL_FIELDS[module] as readonly AiFillFieldDefinition[];
}

/** The model's value → what the editor stores. Only `rich` changes shape. */
function toEditorValue(field: AiFillFieldDefinition, value: RawValue): AiFillValue {
  if (field.kind === "rich") return aiBlocksToHtml(value as AiRichBlock[]);
  return value as AiFillValue;
}

/** The model's value → a plain-text preview. Rendered as text by the caller. */
function previewText(field: AiFillFieldDefinition, value: RawValue): string {
  switch (field.kind) {
    case "text":
    case "textarea":
      return value as string;
    case "rich":
      return aiBlocksToText(value as AiRichBlock[]);
    case "list":
      return (value as string[]).map((item) => `• ${item}`).join("\n");
    case "faq":
      return (value as AiFaqValue[]).map((item) => `${item.question}\n${item.answer}`).join("\n\n");
    case "questions":
      return (value as GeneratedQuizQuestion[])
        .map(
          (q, index) =>
            `${index + 1}. ${q.prompt}\n${q.options
              .map((option, at) => `   ${at === q.correctIndex ? "✓" : "–"} ${option}`)
              .join("\n")}`,
        )
        .join("\n\n");
  }
}

/** Context for the prompt: every non-empty current field except `omit`. */
function contextFrom(current: AiFillCurrent, omit?: string): Record<string, string> {
  return Object.fromEntries(
    Object.entries(current)
      .filter(([key, value]) => key !== omit && value.trim().length > 0)
      .map(([key, value]) => [key, value.slice(0, 20_000)]),
  );
}

function reasonText(labels: AiFillLabels, reason: string): string {
  const base = `${labels.failed} — ${labels.reasons[reason] ?? reason}`;
  return reason === "invalid_output" ? `${base}. ${labels.tokenHint}` : base;
}

// ─── The bar ─────────────────────────────────────────────────

export function AiFillButton({
  config,
  locale,
  fieldLabels,
  current,
  onApply,
  withOptions = false,
}: {
  config: AiFillConfig;
  locale?: string;
  /** The editor's own label for each field key, so the review reads like the form. */
  fieldLabels: Record<string, string>;
  current: AiFillCurrent;
  onApply: (patch: AiFillPatch) => void;
  /**
   * The larger form with tone, reader level and length, and the language it
   * writes in named. Every editor passes it.
   */
  withOptions?: boolean;
}) {
  const { labels, module } = config;
  const fields = fieldsOf(module);
  const hasQuestions = fields.some((f) => f.kind === "questions");

  const [brief, setBrief] = useState("");
  const [questionCount, setQuestionCount] = useState(5);
  const [tone, setTone] = useState<AiStudioTone | "">("");
  const [audience, setAudience] = useState<AiFillAudience | "">("");
  const [length, setLength] = useState<AiFillLength>("standard");
  // The editor's own locale switcher decides the language; the form only names it.
  const languageName = useMemo(() => {
    const code = locale ?? "en";
    try {
      return new Intl.DisplayNames(["en"], { type: "language" }).of(code) ?? code;
    } catch {
      return code;
    }
  }, [locale]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<Record<string, RawValue> | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  // Clicking away only hides the dropdown: a run still in flight lands in the
  // review the next open shows. Cancel and Apply are what forget a result; the
  // brief and its options survive both, being what an admin retypes otherwise.
  function close() {
    setOpen(false);
    setSuggestion(null);
    setReason(null);
  }

  async function generate() {
    if (!brief.trim()) return;
    setBusy(true);
    setReason(null);
    setSuggestion(null);
    try {
      const schema = aiFormSuggestionSchema(module);
      const result = await runAiJson(
        {
          feature: "form_fill",
          payload: {
            mode: "form",
            module,
            brief: brief.trim(),
            context: contextFrom(current),
            ...(hasQuestions ? { questionCount } : {}),
            ...(withOptions && tone ? { tone } : {}),
            ...(withOptions && audience ? { audience } : {}),
            ...(withOptions ? { length } : {}),
            ...(locale ? { locale } : {}),
          },
          ...(config.entity ? { entity: config.entity } : {}),
        },
        (value) => schema.parse(value) as Record<string, RawValue | undefined>,
      );
      const present = Object.fromEntries(
        Object.entries(result).filter(
          (entry): entry is [string, RawValue] => entry[1] !== undefined,
        ),
      );
      setSuggestion(present);
      // Ticked only where the field is empty: an admin who wrote a summary
      // should not lose it to a brief typed for the body.
      setChecked(
        Object.fromEntries(
          Object.keys(present).map((key) => [key, (current[key] ?? "").trim().length === 0]),
        ),
      );
    } catch (error) {
      setReason(error instanceof AiClientError ? error.reason : "provider_error");
    } finally {
      setBusy(false);
    }
  }

  function apply() {
    if (!suggestion) return;
    const patch: AiFillPatch = {};
    for (const field of fields) {
      const value = suggestion[field.key];
      if (value !== undefined && checked[field.key]) patch[field.key] = toEditorValue(field, value);
    }
    onApply(patch);
    close();
    toast.success(labels.applied);
  }

  const rows = suggestion ? fields.filter((field) => suggestion[field.key] !== undefined) : [];
  const reviewing = suggestion !== null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button type="button" variant="outline" size="sm" className="text-primary-interactive">
            <Sparkles aria-hidden data-icon="inline-start" />
            {labels.title}
          </Button>
        }
      />
      {/* The rich-text editor's ✨ shape (ai-assistant.tsx): a dropdown form
          anchored to its button, never a modal over the editor. */}
      <PopoverContent
        align="end"
        className="flex max-h-(--available-height) w-lg max-w-(--available-width) min-w-0 flex-col gap-4 overflow-x-hidden overflow-y-auto"
      >
        <div className="flex min-w-0 flex-col gap-1">
          <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
            <Sparkles aria-hidden className="size-4 shrink-0 text-primary-interactive" />
            <span className="truncate">{reviewing ? labels.reviewTitle : labels.title}</span>
          </span>
          <p className="text-xs text-muted-foreground">
            {reviewing ? labels.reviewDescription : labels.description}
          </p>
        </div>

        {!reviewing && (
          <div className="flex flex-col gap-4">
            <Field>
              <FieldLabel>{labels.briefLabel}</FieldLabel>
              <Textarea
                value={brief}
                rows={3}
                maxLength={2000}
                autoFocus
                placeholder={labels.briefPlaceholder}
                className={withOptions ? "min-h-28" : undefined}
                onChange={(event) => setBrief(event.target.value)}
              />
              {withOptions && (
                <FieldDescription className="flex flex-wrap items-center gap-2">
                  <Badge variant="pill">
                    <Languages aria-hidden />
                    {labels.languageLabel}: {languageName}
                  </Badge>
                  {labels.languageHint}
                </FieldDescription>
              )}
            </Field>
            {withOptions && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel>{labels.toneLabel}</FieldLabel>
                  <AdminCombobox
                    value={tone}
                    onValueChange={(value) => setTone(value as AiStudioTone | "")}
                    options={[
                      { value: "", label: labels.toneDefault },
                      ...AI_STUDIO_TONES.map((key) => ({ value: key, label: labels.tones[key] })),
                    ]}
                  />
                </Field>
                <Field>
                  <FieldLabel>{labels.audienceLabel}</FieldLabel>
                  <AdminCombobox
                    value={audience}
                    onValueChange={(value) => setAudience(value as AiFillAudience | "")}
                    options={[
                      { value: "", label: labels.audienceDefault },
                      ...AI_FILL_AUDIENCES.map((key) => ({
                        value: key,
                        label: labels.audiences[key],
                      })),
                    ]}
                  />
                </Field>
                <FieldSet className="sm:col-span-2">
                  <FieldLegend variant="label">{labels.lengthLabel}</FieldLegend>
                  <ViewChips
                    value={length}
                    onValueChange={(value) => setLength(value as AiFillLength)}
                    className="flex-wrap"
                    aria-label={labels.lengthLabel}
                  >
                    {AI_FILL_LENGTHS.map((key) => (
                      <ViewChip key={key} value={key}>
                        {labels.lengths[key]}
                      </ViewChip>
                    ))}
                  </ViewChips>
                </FieldSet>
              </div>
            )}
            {hasQuestions && (
              <Field className="w-28">
                <FieldLabel>{labels.questionCount}</FieldLabel>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={questionCount}
                  onChange={(event) =>
                    setQuestionCount(Math.min(20, Math.max(1, Number(event.target.value) || 1)))
                  }
                />
              </Field>
            )}
            {reason && (
              <p className="text-sm text-destructive-interactive" role="status">
                {reasonText(labels, reason)}
              </p>
            )}
          </div>
        )}

        {reviewing && (
          <div className="flex flex-col gap-4">
            {rows.map((field) => {
              const value = suggestion[field.key]!;
              return (
                <Field key={field.key} orientation="horizontal" className="items-start">
                  <Checkbox
                    checked={checked[field.key] ?? false}
                    onCheckedChange={(next) =>
                      setChecked((state) => ({ ...state, [field.key]: next === true }))
                    }
                  />
                  <FieldContent>
                    <FieldLabel>{fieldLabels[field.key] ?? humanizeKey(field.key)}</FieldLabel>
                    <div className="grid grid-cols-1 gap-3">
                      <div className="flex min-w-0 flex-col gap-1">
                        <span className="text-2xs text-muted-foreground">{labels.current}</span>
                        <p className="max-h-48 overflow-y-auto text-sm break-words whitespace-pre-wrap">
                          {(current[field.key] ?? "").trim() || (
                            <span className="text-muted-foreground">{labels.empty}</span>
                          )}
                        </p>
                      </div>
                      <div className="flex min-w-0 flex-col gap-1">
                        <span className="text-2xs text-muted-foreground">{labels.suggested}</span>
                        <p className="max-h-48 overflow-y-auto text-sm break-words whitespace-pre-wrap">
                          {previewText(field, value)}
                        </p>
                      </div>
                    </div>
                  </FieldContent>
                </Field>
              );
            })}
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          {reviewing ? (
            <>
              <Button type="button" variant="outline" onClick={() => setSuggestion(null)}>
                {labels.back}
              </Button>
              <Button
                type="button"
                onClick={apply}
                disabled={!rows.some((field) => checked[field.key])}
              >
                {labels.apply}
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={close}>
                {labels.cancel}
              </Button>
              <Button
                type="button"
                onClick={() => void generate()}
                disabled={busy || !brief.trim()}
              >
                {busy ? (
                  <Spinner size="sm" aria-label={labels.generating} data-icon="inline-start" />
                ) : (
                  <Sparkles aria-hidden data-icon="inline-start" />
                )}
                {busy ? labels.generating : labels.generate}
              </Button>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── One field ───────────────────────────────────────────────

export function AiFieldMenu({
  config,
  field: fieldKey,
  locale,
  current,
  onApply,
}: {
  config: AiFillConfig;
  field: string;
  locale?: string;
  /** Every fillable field's current text; this field's own entry is its value. */
  current: AiFillCurrent;
  /** A string: plain text for text fields, sanitizer-safe HTML for rich ones. */
  onApply: (value: string) => void;
}) {
  const { labels, module } = config;
  const field = aiFillField(module, fieldKey);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<RawValue | null>(null);

  // Only single-value text fields have a menu; the payload schema refuses the
  // rest, so a call site pointing this at a list renders nothing at all.
  if (!field || !["text", "textarea", "rich"].includes(field.kind)) return null;
  // One ✨ per field: a rich field whose toolbar already has the assistant.
  if (field.kind === "rich" && config.richHasAssistant) return null;
  const definition = field;

  const value = current[fieldKey] ?? "";
  const hasValue = value.trim().length > 0;
  // An action that needs something to work on is ABSENT on an empty field.
  const actions = AI_FIELD_ACTIONS.filter((action) => action === "regenerate" || hasValue);

  async function run(action: AiFieldAction) {
    setBusy(true);
    setReason(null);
    setSuggestion(null);
    setOpen(true);
    try {
      const schema = aiFieldSuggestionSchema(definition);
      const result = await runAiJson(
        {
          feature: "form_fill",
          payload: {
            mode: "field",
            module,
            field: fieldKey,
            action,
            current: value,
            context: contextFrom(current, fieldKey),
            ...(locale ? { locale } : {}),
          },
          ...(config.entity ? { entity: config.entity } : {}),
        },
        (raw) => (schema.parse(raw) as { value: RawValue }).value,
      );
      setSuggestion(result);
    } catch (error) {
      setReason(error instanceof AiClientError ? error.reason : "provider_error");
    } finally {
      setBusy(false);
    }
  }

  function replace() {
    if (suggestion === null) return;
    onApply(toEditorValue(definition, suggestion) as string);
    setOpen(false);
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={labels.fieldMenu}
              title={labels.fieldMenu}
            >
              <Sparkles aria-hidden className="text-primary-interactive" />
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-44">
          {actions.map((action) => (
            <DropdownMenuItem key={action} onClick={() => void run(action)}>
              {labels.fieldActions[action]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{labels.fieldReviewTitle}</DialogTitle>
            <DialogDescription>{labels.fieldReviewDescription}</DialogDescription>
          </DialogHeader>

          {busy && (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Spinner size="sm" aria-label={labels.generating} />
              {labels.generating}
            </div>
          )}

          {reason && (
            <p className="py-4 text-sm text-destructive-interactive" role="status">
              {reasonText(labels, reason)}
            </p>
          )}

          {suggestion !== null && (
            <p className="max-h-96 overflow-y-auto rounded-md border bg-muted/40 p-3 text-sm break-words whitespace-pre-wrap">
              {previewText(definition, suggestion)}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {labels.fieldDiscard}
            </Button>
            <Button type="button" onClick={replace} disabled={suggestion === null}>
              {labels.fieldReplace}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

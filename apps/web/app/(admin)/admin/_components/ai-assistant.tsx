"use client";

// The writing assistant (changes-29 B1).
//
// One more `ToolbarMenu` beside the ten the editor already has, plus a result
// PANEL below it — never an auto-insert. The model suggests; the admin decides
// where the text goes and whether it goes anywhere (ADR-097 #4). Insert,
// Replace selection and Discard are the only three things the panel does.
//
// **Plain text, both directions.** Tiptap's marks here are class-based because
// the stock extensions emit inline styles the sanitizer strips (ADR-046), so a
// model asked for HTML would produce formatting that silently disappears on
// save. The selection is sent as `textBetween(...)` and the result is inserted
// as text; formatting is the admin's.
//
// **Absent, not disabled** (ADR-097 #6). This component renders only when its
// host was given AI availability, and the menu ITEMS a selection does not
// support are omitted rather than greyed — §2.2 #11 applies inside a toolbar
// too.
//
// **Two shapes.** The original dropdown, and — where the host sets
// `config.panel` — a dropdown-style POPOVER holding the brief, the Draft button
// and the options (tone, reader level, length, format) in the open, with the
// selection actions below. A Popover rather than a Menu because a Menu's
// typeahead swallows keystrokes in a text field, and its items close it.
import { useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { Editor } from "@tiptap/react";
import {
  Check,
  ListCollapse,
  Maximize2,
  Palette,
  Replace,
  SpellCheck,
  Sparkles,
  SquarePen,
  X,
} from "lucide-react";
import {
  AI_ASSISTANT_ACTIONS,
  AI_DRAFT_WORDS_DEFAULT,
  AI_DRAFT_WORDS_MAX,
  AI_DRAFT_WORDS_MIN,
  AI_FILL_AUDIENCES,
  AI_STUDIO_FORMATS,
  AI_STUDIO_TONES,
  AI_TONES,
  type AiAssistantAction,
  type AiFillAudience,
  type AiFillLength,
  type AiStudioFormat,
  type AiStudioTone,
  type AiTone,
} from "@repo/contracts";
import { Button } from "@repo/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { Field, FieldDescription, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/ui/components/popover";
import { Separator } from "@repo/ui/components/separator";
import { Spinner } from "@repo/ui/components/spinner";
import { Textarea } from "@repo/ui/components/textarea";
import { AiClientError, streamAi } from "../_lib/ai-client.ts";
import { AdminCombobox } from "./combobox.tsx";

export interface AiAssistantLabels {
  menu: string;
  actions: Record<AiAssistantAction, string>;
  tones: Record<AiTone, string>;
  briefLabel: string;
  briefPlaceholder: string;
  briefSubmit: string;
  panelTitle: string;
  generating: string;
  stop: string;
  insert: string;
  replace: string;
  discard: string;
  /** reason → one catalog string. A taxonomy value never renders raw. */
  reasons: Record<string, string>;
  failed: string;
  /** The popover shape (`config.panel`). */
  panel: {
    languageLabel: string;
    toneLabel: string;
    toneDefault: string;
    tones: Record<AiStudioTone, string>;
    audienceLabel: string;
    audienceDefault: string;
    audiences: Record<AiFillAudience, string>;
    lengthLabel: string;
    lengths: Record<AiFillLength, string>;
    wordCountLabel: string;
    formatLabel: string;
    formats: Record<AiStudioFormat, string>;
    actionsHeading: string;
    actionsHint: string;
  };
}

/**
 * What the host tells this component. Its PRESENCE is the availability answer —
 * an AI-off install passes nothing, so no AI control renders and no AI request
 * can be made from this surface.
 */
export interface AiAssistantConfig {
  entity?: { type: string; id: string };
  /** The language drafts are written in: the host editor's own locale switcher. */
  locale?: string;
  /**
   * The popover shape: brief, Draft, options and selection actions all visible
   * at once. Every content editor sets it (`loadEditorAi`, and the article
   * page); the dropdown shape remains for a host that does not.
   */
  panel?: boolean;
  /** Content locales the panel's language dropdown offers. */
  languages?: readonly string[];
}

type RunOptions = {
  tone?: AiStudioTone;
  audience?: AiFillAudience;
  length?: AiFillLength;
  format?: AiStudioFormat;
  wordCount?: number;
  /**
   * The language to write in. `undefined` falls back to the host's locale;
   * `null` sends none, which tells the prompt to keep the passage's language.
   */
  locale?: string | null;
};

/** The one request path both shapes share. */
function useAssistantRun(
  editor: Editor,
  config: AiAssistantConfig,
  onResult: Dispatch<SetStateAction<AiResultState>>,
) {
  const abort = useRef<AbortController | null>(null);

  return async function run(
    action: AiAssistantAction,
    { brief, selection, options = {} }: { brief: string; selection: string; options?: RunOptions },
  ) {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    const hasSelection = selection.trim().length > 0;
    const drafting = action === "draft";
    const locale = options.locale === undefined ? config.locale : options.locale;

    let text = "";
    onResult({ status: "streaming", text: "", reason: null, abort: controller });

    try {
      await streamAi(
        {
          feature: "writing_assistant",
          payload: {
            action,
            ...(hasSelection ? { selection } : {}),
            ...(drafting && brief.trim() ? { instruction: brief.trim() } : {}),
            ...(options.tone && (drafting || action === "change_tone")
              ? { tone: options.tone }
              : {}),
            // Reader level, length and format shape a NEW passage only; on an
            // edit they would contradict the instruction (the prompt agrees).
            ...(drafting && options.audience ? { audience: options.audience } : {}),
            ...(drafting && options.length ? { length: options.length } : {}),
            ...(drafting && options.format ? { format: options.format } : {}),
            ...(drafting && options.wordCount ? { wordCount: options.wordCount } : {}),
            // Surrounding text, for voice only. Capped here rather than in the
            // schema because the schema's cap is the hard limit and this is a
            // courtesy to the bill.
            ...(hasSelection ? {} : { context: editor.getText().slice(0, 4000) }),
            ...(locale ? { locale } : {}),
          },
          ...(config.entity ? { entity: config.entity } : {}),
          signal: controller.signal,
        },
        {
          onChunk: (chunk) => {
            text += chunk;
            onResult({ status: "streaming", text, reason: null, abort: controller });
          },
          onError: (reason) => {
            onResult({ status: "error", text, reason, abort: null });
          },
        },
      );
      // An `onError` already moved the panel to `error`; this only settles the
      // happy path.
      onResult((current) =>
        current.status === "error" ? current : { status: "done", text, reason: null, abort: null },
      );
    } catch (error) {
      if (controller.signal.aborted) {
        // The admin pressed Stop. What was generated is still theirs to use —
        // and the server has already metered it.
        onResult({ status: "done", text, reason: null, abort: null });
        return;
      }
      const reason = error instanceof AiClientError ? error.reason : "provider_error";
      onResult({ status: "error", text, reason, abort: null });
    }
  };
}

/** The typed word target, inside the contract's range; the default when blank. */
function clampWords(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return AI_DRAFT_WORDS_DEFAULT;
  return Math.min(AI_DRAFT_WORDS_MAX, Math.max(AI_DRAFT_WORDS_MIN, parsed));
}

function selectedText(editor: Editor): string {
  const { from, to } = editor.state.selection;
  return from === to ? "" : editor.state.doc.textBetween(from, to, "\n");
}

export function AiAssistantMenu(props: {
  editor: Editor;
  config: AiAssistantConfig;
  labels: AiAssistantLabels;
  /** React's setter, so a streamed chunk can update the previous state. */
  onResult: Dispatch<SetStateAction<AiResultState>>;
}) {
  return props.config.panel ? <AiAssistantPanel {...props} /> : <AiAssistantDropdown {...props} />;
}

function AiAssistantDropdown({
  editor,
  config,
  labels,
  onResult,
}: {
  editor: Editor;
  config: AiAssistantConfig;
  labels: AiAssistantLabels;
  onResult: Dispatch<SetStateAction<AiResultState>>;
}) {
  const [brief, setBrief] = useState("");
  // Controlled only so a DRAFT closes the menu: its input and button are not
  // menu items, so nothing else would, and the open popup covers the result
  // panel the draft streams into.
  const [open, setOpen] = useState(false);
  const runAi = useAssistantRun(editor, config, onResult);

  const selection = selectedText(editor);
  const hasSelection = selection.trim().length > 0;

  function run(action: AiAssistantAction, tone?: AiTone) {
    setOpen(false);
    void runAi(action, { brief, selection, options: tone ? { tone } : {} }).finally(() =>
      setBrief(""),
    );
  }

  // An action needing a selection is ABSENT without one, not greyed.
  const available = AI_ASSISTANT_ACTIONS.filter((action) => !action.needsSelection || hasSelection);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={labels.menu}
            title={labels.menu}
            className="gap-0.5 px-1.5"
            onMouseDown={(event) => event.preventDefault()}
          >
            <Sparkles aria-hidden className="size-4" />
          </Button>
        }
      />
      <DropdownMenuContent align="start" className="max-h-80 w-64 overflow-y-auto">
        {available.map((action) =>
          action.key === "change_tone" ? (
            <DropdownMenuSub key={action.key}>
              <DropdownMenuSubTrigger>{labels.actions.change_tone}</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {/* A closed list, because a free-text tone field is a free-text
                    PROMPT field wearing a label. */}
                {AI_TONES.map((tone) => (
                  <DropdownMenuItem key={tone} onClick={() => run("change_tone", tone)}>
                    {labels.tones[tone]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          ) : action.key === "draft" ? (
            <div key={action.key} className="flex flex-col gap-2 p-2">
              {/* A Field, never a hand-wired label (ADR-077): the Field owns
                  `htmlFor` and `aria-describedby`, and a pair that drifts apart
                  still LOOKS labelled. */}
              <Field>
                <FieldLabel>{labels.briefLabel}</FieldLabel>
                <Input
                  value={brief}
                  placeholder={labels.briefPlaceholder}
                  onChange={(event) => setBrief(event.target.value)}
                  onKeyDown={(event) => {
                    // The menu popup's typeahead calls preventDefault on EVERY
                    // character key while it is open (Base UI 1.7
                    // `useTypeahead`), and list navigation claims Space, Home,
                    // End and the arrows — so a keystroke that bubbles out of
                    // this input never types anything. Escape and Tab still
                    // reach the menu, which is how it closes.
                    if (event.key !== "Escape" && event.key !== "Tab") event.stopPropagation();
                    if (event.key !== "Enter") return;
                    event.preventDefault();
                    run("draft");
                  }}
                />
              </Field>
              <Button type="button" size="xs" onClick={() => run("draft")}>
                <SquarePen aria-hidden data-icon="inline-start" />
                {labels.briefSubmit}
              </Button>
              <DropdownMenuSeparator />
            </div>
          ) : (
            <DropdownMenuItem key={action.key} onClick={() => run(action.key)}>
              {labels.actions[action.key]}
            </DropdownMenuItem>
          ),
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const PANEL_ACTION_ICONS = {
  expand: Maximize2,
  change_tone: Palette,
  summarize: ListCollapse,
  fix_grammar: SpellCheck,
} as const;

function AiAssistantPanel({
  editor,
  config,
  labels,
  onResult,
}: {
  editor: Editor;
  config: AiAssistantConfig;
  labels: AiAssistantLabels;
  onResult: Dispatch<SetStateAction<AiResultState>>;
}) {
  const [open, setOpen] = useState(false);
  const [brief, setBrief] = useState("");
  const [tone, setTone] = useState<AiStudioTone | "">("");
  const [audience, setAudience] = useState<AiFillAudience | "">("");
  // Kept as the TYPED string, so clearing the field to retype does not snap
  // back to a number; clamped only when a draft is sent.
  const [wordCount, setWordCount] = useState(String(AI_DRAFT_WORDS_DEFAULT));
  const [format, setFormat] = useState<AiStudioFormat>("paragraphs");
  const runAi = useAssistantRun(editor, config, onResult);
  const panel = labels.panel;

  const editorLocale = config.locale ?? "en";
  // Starts on the editor's own locale and FOLLOWS it: switching the Content
  // section to Spanish moves this to Spanish too, overriding a pick made for
  // the previous tab (React's adjust-state-during-render pattern, no effect).
  const [language, setLanguage] = useState(editorLocale);
  const [followedLocale, setFollowedLocale] = useState(editorLocale);
  if (followedLocale !== editorLocale) {
    setFollowedLocale(editorLocale);
    setLanguage(editorLocale);
  }

  // Codes, not names (en, ar…): the dropdown shares the title's row.
  const languageOptions = useMemo(
    () =>
      Array.from(new Set([editorLocale, ...(config.languages ?? [])])).map((code) => ({
        value: code,
        label: code,
      })),
    [editorLocale, config.languages],
  );

  function draft() {
    if (!brief.trim()) return;
    setOpen(false);
    void runAi("draft", {
      brief,
      selection: "",
      options: {
        ...(tone ? { tone } : {}),
        ...(audience ? { audience } : {}),
        wordCount: clampWords(wordCount),
        format,
        locale: language,
      },
    }).then(() => setBrief(""));
  }

  /**
   * A selection action works on the selected text, or on the whole body when
   * nothing is selected — which it SELECTS first, so the result panel's Replace
   * replaces exactly what was sent.
   */
  function edit(action: Exclude<AiAssistantAction, "draft">) {
    let selection = selectedText(editor);
    if (selection.trim().length === 0) {
      editor.commands.selectAll();
      selection = selectedText(editor);
    }
    if (selection.trim().length === 0) return;
    setOpen(false);
    void runAi(action, {
      brief: "",
      selection,
      options: {
        ...(tone ? { tone } : {}),
        // Smart default: an edit keeps the language the passage is ALREADY in
        // (a Spanish quote inside an English article stays Spanish). Only a
        // language the person deliberately picked away from the editor's
        // rewrites into it — and grammar fixes never translate at all.
        locale: action !== "fix_grammar" && language !== editorLocale ? language : null,
      },
    });
  }

  // Change tone needs a tone to change TO, so it appears once one is chosen.
  const editActions = AI_ASSISTANT_ACTIONS.filter(
    (action) => action.key !== "draft" && (action.key !== "change_tone" || tone !== ""),
  ).map((action) => action.key as Exclude<AiAssistantAction, "draft">);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={labels.menu}
            title={labels.menu}
            className="gap-1 px-1.5 text-primary-interactive"
            onMouseDown={(event) => event.preventDefault()}
          >
            <Sparkles aria-hidden className="size-4" />
          </Button>
        }
      />
      <PopoverContent
        align="start"
        className="flex max-h-(--available-height) w-96 max-w-(--available-width) min-w-0 flex-col gap-4 overflow-x-hidden overflow-y-auto"
      >
        {/* Title and language on ONE row: the dropdown is the code alone
            (en, ar…) so the row never wraps; its accessible name is the label. */}
        <div className="flex min-w-0 items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
            <Sparkles aria-hidden className="size-4 shrink-0 text-primary-interactive" />
            <span className="truncate">{labels.menu}</span>
          </span>
          <AdminCombobox
            className="h-8 w-20 shrink-0"
            aria-label={panel.languageLabel}
            value={language}
            onValueChange={(value) => setLanguage(value || editorLocale)}
            options={languageOptions}
          />
        </div>

        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            draft();
          }}
        >
          <Field>
            <FieldLabel>{labels.briefLabel}</FieldLabel>
            <Textarea
              value={brief}
              maxLength={2000}
              placeholder={labels.briefPlaceholder}
              className="min-h-28 md:text-base"
              onChange={(event) => setBrief(event.target.value)}
              onKeyDown={(event) => {
                // Ctrl/⌘+Enter drafts; a plain Enter is a new line in a brief.
                if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault();
                  draft();
                }
              }}
            />
          </Field>
          <Button type="submit" className="w-full" disabled={!brief.trim()}>
            <SquarePen aria-hidden data-icon="inline-start" />
            {labels.briefSubmit}
          </Button>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field>
              <FieldLabel>{panel.toneLabel}</FieldLabel>
              <AdminCombobox
                value={tone}
                onValueChange={(value) => setTone(value as AiStudioTone | "")}
                options={[
                  { value: "", label: panel.toneDefault },
                  ...AI_STUDIO_TONES.map((key) => ({ value: key, label: panel.tones[key] })),
                ]}
              />
            </Field>
            <Field>
              <FieldLabel>{panel.wordCountLabel}</FieldLabel>
              <Input
                type="number"
                inputMode="numeric"
                min={AI_DRAFT_WORDS_MIN}
                max={AI_DRAFT_WORDS_MAX}
                step={10}
                value={wordCount}
                onChange={(event) => setWordCount(event.target.value)}
                onBlur={() => setWordCount(String(clampWords(wordCount)))}
              />
            </Field>
            <Field>
              <FieldLabel>{panel.formatLabel}</FieldLabel>
              <AdminCombobox
                value={format}
                onValueChange={(value) => setFormat(value as AiStudioFormat)}
                options={AI_STUDIO_FORMATS.map((key) => ({
                  value: key,
                  label: panel.formats[key],
                }))}
              />
            </Field>
            <Field>
              <FieldLabel>{panel.audienceLabel}</FieldLabel>
              <AdminCombobox
                value={audience}
                onValueChange={(value) => setAudience(value as AiFillAudience | "")}
                options={[
                  { value: "", label: panel.audienceDefault },
                  ...AI_FILL_AUDIENCES.map((key) => ({ value: key, label: panel.audiences[key] })),
                ]}
              />
            </Field>
          </div>
        </form>

        <Separator />

        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium">{panel.actionsHeading}</span>
          {/* One column: the popover is 24rem whatever the viewport, so a
              `sm:` two-column grid split labels like "Summarise the selection"
              past their buttons. */}
          <div className="flex flex-col gap-2">
            {editActions.map((key) => {
              const Icon = PANEL_ACTION_ICONS[key];
              return (
                <Button
                  key={key}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-auto min-h-9 w-full justify-start py-2 text-start whitespace-normal"
                  onClick={() => edit(key)}
                >
                  <Icon aria-hidden data-icon="inline-start" />
                  {key === "change_tone" && tone
                    ? `${labels.actions.change_tone}: ${panel.tones[tone]}`
                    : labels.actions[key]}
                </Button>
              );
            })}
          </div>
          <FieldDescription>{panel.actionsHint}</FieldDescription>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export type AiResultState = {
  status: "idle" | "streaming" | "done" | "error";
  text: string;
  reason: string | null;
  abort: AbortController | null;
};

export const AI_RESULT_IDLE: AiResultState = {
  status: "idle",
  text: "",
  reason: null,
  abort: null,
};

/**
 * The result panel.
 *
 * **Rendered as TEXT, never as HTML.** A `<script>` in a suggestion arrives as
 * visible characters, which is the whole of §12 #5 — and `ai-output.test.ts`
 * fails on any `dangerouslySetInnerHTML` under the AI paths.
 */
export function AiResultPanel({
  state,
  labels,
  onInsert,
  onReplace,
  onDiscard,
  hasSelection,
}: {
  state: AiResultState;
  labels: AiAssistantLabels;
  onInsert: (text: string) => void;
  onReplace: (text: string) => void;
  onDiscard: () => void;
  hasSelection: boolean;
}) {
  if (state.status === "idle") return null;

  const streaming = state.status === "streaming";

  return (
    <div className="flex flex-col gap-2 border-t bg-muted/40 p-3" role="group">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-medium">
          <Sparkles aria-hidden className="size-3.5 text-primary-interactive" />
          {labels.panelTitle}
        </span>
        {streaming && (
          <>
            {/* The shared Spinner, NOT `Button loading` — a loading Button is a
                DISABLED Button, and this is the one control that has to stay
                clickable while the work it reports on is running. */}
            <Spinner size="sm" aria-label={labels.generating} className="ms-auto" />
            <Button type="button" variant="ghost" size="xs" onClick={() => state.abort?.abort()}>
              {labels.stop}
            </Button>
          </>
        )}
      </div>

      {state.status === "error" ? (
        <p className="text-xs text-destructive-interactive" role="status">
          {labels.failed}
          {state.reason ? ` — ${labels.reasons[state.reason] ?? state.reason}` : ""}
        </p>
      ) : (
        // `whitespace-pre-wrap` on a text node: the suggestion is plain text,
        // and paragraph breaks are the only formatting it carries.
        <p className="max-h-60 overflow-y-auto text-sm whitespace-pre-wrap">
          {state.text || labels.generating}
        </p>
      )}

      {state.text.trim().length > 0 && !streaming && (
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onDiscard}>
            <X aria-hidden data-icon="inline-start" />
            {labels.discard}
          </Button>
          {hasSelection && (
            <Button type="button" variant="outline" size="sm" onClick={() => onReplace(state.text)}>
              <Replace aria-hidden data-icon="inline-start" />
              {labels.replace}
            </Button>
          )}
          <Button type="button" size="sm" onClick={() => onInsert(state.text)}>
            <Check aria-hidden data-icon="inline-start" />
            {labels.insert}
          </Button>
        </div>
      )}
    </div>
  );
}

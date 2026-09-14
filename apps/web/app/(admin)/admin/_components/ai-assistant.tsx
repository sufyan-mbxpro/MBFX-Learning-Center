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
import { useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { Editor } from "@tiptap/react";
import { Check, Replace, Sparkles, SquarePen, X } from "lucide-react";
import {
  AI_ASSISTANT_ACTIONS,
  AI_TONES,
  type AiAssistantAction,
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
import { Field, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { Spinner } from "@repo/ui/components/spinner";
import { AiClientError, streamAi } from "../_lib/ai-client.ts";

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
}

/**
 * What the host tells this component. Its PRESENCE is the availability answer —
 * an AI-off install passes nothing, so no AI control renders and no AI request
 * can be made from this surface.
 */
export interface AiAssistantConfig {
  entity?: { type: string; id: string };
  locale?: string;
}

export function AiAssistantMenu({
  editor,
  config,
  labels,
  onResult,
}: {
  editor: Editor;
  config: AiAssistantConfig;
  labels: AiAssistantLabels;
  /** React's setter, so a streamed chunk can update the previous state. */
  onResult: Dispatch<SetStateAction<AiResultState>>;
}) {
  const [brief, setBrief] = useState("");
  const abort = useRef<AbortController | null>(null);

  const { from, to } = editor.state.selection;
  const selection = from === to ? "" : editor.state.doc.textBetween(from, to, "\n");
  const hasSelection = selection.trim().length > 0;

  async function run(action: AiAssistantAction, tone?: AiTone) {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;

    let text = "";
    onResult({ status: "streaming", text: "", reason: null, abort: controller });

    try {
      await streamAi(
        {
          feature: "writing_assistant",
          payload: {
            action,
            ...(hasSelection ? { selection } : {}),
            ...(action === "draft" && brief.trim() ? { instruction: brief.trim() } : {}),
            ...(tone ? { tone } : {}),
            // Surrounding text, for voice only. Capped here rather than in the
            // schema because the schema's cap is the hard limit and this is a
            // courtesy to the bill.
            ...(hasSelection ? {} : { context: editor.getText().slice(0, 4000) }),
            ...(config.locale ? { locale: config.locale } : {}),
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
    } finally {
      setBrief("");
    }
  }

  // An action needing a selection is ABSENT without one, not greyed.
  const available = AI_ASSISTANT_ACTIONS.filter((action) => !action.needsSelection || hasSelection);

  return (
    <DropdownMenu>
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
                  <DropdownMenuItem key={tone} onClick={() => void run("change_tone", tone)}>
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
                    if (event.key !== "Enter") return;
                    event.preventDefault();
                    void run("draft");
                  }}
                />
              </Field>
              <Button type="button" size="xs" onClick={() => void run("draft")}>
                <SquarePen aria-hidden data-icon="inline-start" />
                {labels.briefSubmit}
              </Button>
              <DropdownMenuSeparator />
            </div>
          ) : (
            <DropdownMenuItem key={action.key} onClick={() => void run(action.key)}>
              {labels.actions[action.key]}
            </DropdownMenuItem>
          ),
        )}
      </DropdownMenuContent>
    </DropdownMenu>
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

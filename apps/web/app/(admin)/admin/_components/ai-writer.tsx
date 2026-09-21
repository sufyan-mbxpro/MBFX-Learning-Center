"use client";

// The AI Writer — the writing studio on every admin page (ADR-129).
//
// A header button and a side sheet, mounted once by `AdminShell`, so the panel
// and an unsent draft survive soft navigation between admin pages. The shell
// renders this only when the subject holds `ai.use` AND the `writing_studio`
// feature is available: absent, never disabled (ADR-097 #6).
//
// **Nothing here is saved** (ADR-097 #4). The result is TEXT in a paragraph —
// never HTML (`ai-output.test.ts` reads every `ai-*.tsx` for that) — and it
// leaves the panel only by the admin copying it or feeding it back in.
//
// **A length target is a request** (§3). The result is measured against the
// target it was ASKED with, not the controls' current values, and Fit to limit
// is a second, explicit request rather than an automatic retry.
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Check, Copy, CornerUpLeft, RefreshCw, Scissors, Sparkles } from "lucide-react";
import {
  AI_STUDIO_ACTIONS,
  AI_STUDIO_FORMATS,
  AI_STUDIO_LENGTH_PRESETS,
  AI_STUDIO_LENGTH_UNITS,
  AI_STUDIO_TONES,
  writingStudioPayloadSchema,
  type AiPayload,
  type AiStudioAction,
  type AiStudioFormat,
  type AiStudioLengthUnit,
  type AiStudioTone,
} from "@repo/contracts";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { Kbd, KbdGroup } from "@repo/ui/components/kbd";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@repo/ui/components/sheet";
import { Spinner } from "@repo/ui/components/spinner";
import { Textarea } from "@repo/ui/components/textarea";
import { ViewChip, ViewChips } from "@repo/ui/components/view-chips";
import { measureLength, textStats } from "@repo/utils";

import { AiClientError, streamAi } from "../_lib/ai-client.ts";
import { useFieldErrors } from "../_hooks/use-field-errors.ts";
import { AdminCombobox } from "./combobox.tsx";

type StudioPayload = AiPayload<"writing_studio">;
type Mode = "write" | "improve";

/** `none`, a preset key, or `custom`. */
type LengthChoice = string;

interface ResultState {
  status: "idle" | "streaming" | "done" | "error";
  text: string;
  reason: string | null;
  /** The request that produced this text — what Regenerate and the meter use. */
  payload: StudioPayload | null;
}

const IDLE: ResultState = { status: "idle", text: "", reason: null, payload: null };
const HISTORY_SIZE = 5;

/** Headlines work from a topic OR a passage, so both modes offer them. */
function actionsFor(mode: Mode): AiStudioAction[] {
  return AI_STUDIO_ACTIONS.filter((a) =>
    mode === "write" ? a.fromTopic : !a.fromTopic || a.key === "headlines",
  ).map((a) => a.key);
}

export function AiWriter({
  languages,
  defaultLanguage,
}: {
  /** Content languages, named on the server. */
  languages: { value: string; label: string }[];
  defaultLanguage: string;
}) {
  const t = useTranslations("admin.ai.writer");
  const tAi = useTranslations("admin.ai");
  const tAdmin = useTranslations("admin");

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("write");
  const [text, setText] = useState("");
  const [action, setAction] = useState<AiStudioAction>("draft");
  const [tone, setTone] = useState<AiStudioTone | "">("");
  const [format, setFormat] = useState<AiStudioFormat>("paragraphs");
  const [language, setLanguage] = useState(defaultLanguage);
  const [lengthChoice, setLengthChoice] = useState<LengthChoice>("none");
  const [customTarget, setCustomTarget] = useState("280");
  const [customUnit, setCustomUnit] = useState<AiStudioLengthUnit>("characters");
  const [result, setResult] = useState<ResultState>(IDLE);
  const [history, setHistory] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const abort = useRef<AbortController | null>(null);
  // Client-only with an SSR fallback, as the ⌘K search does.
  const isMac = useSyncExternalStore(
    subscribeNever,
    () => /mac|iphone|ipad/i.test(window.navigator.platform || window.navigator.userAgent),
    () => false,
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // `key` is optional: autofill dispatches a keydown without one.
      if (event.key?.toLowerCase() === "j" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Abandoning the page mid-stream stops the request; what was billed is
  // metered by the server's own `finally`.
  useEffect(() => () => abort.current?.abort(), []);

  const mechanical = action === "fix_grammar";
  const showFormat = !mechanical && action !== "headlines";

  const preset = AI_STUDIO_LENGTH_PRESETS.find((p) => p.key === lengthChoice);
  const length =
    lengthChoice === "custom"
      ? { unit: customUnit, target: Number(customTarget) }
      : preset
        ? { unit: preset.unit, target: preset.target }
        : undefined;

  const payload: StudioPayload = {
    action,
    text,
    locale: language,
    ...(!mechanical && tone ? { tone } : {}),
    ...(showFormat ? { format } : {}),
    ...(!mechanical && length ? { length } : {}),
  };

  const form = useFieldErrors(writingStudioPayloadSchema, payload);

  function changeMode(next: string) {
    const nextMode = next as Mode;
    setMode(nextMode);
    const offered = actionsFor(nextMode);
    if (!offered.includes(action)) setAction(offered[0]!);
  }

  async function run(request: StudioPayload) {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setCopied(false);

    let out = "";
    let failure: string | null = null;
    setResult({ status: "streaming", text: "", reason: null, payload: request });

    try {
      await streamAi(
        { feature: "writing_studio", payload: request, signal: controller.signal },
        {
          onChunk: (chunk) => {
            out += chunk;
            setResult({ status: "streaming", text: out, reason: null, payload: request });
          },
          onError: (reason) => {
            failure = reason;
          },
        },
      );
    } catch (error) {
      // Stop keeps what was written: it was generated, and it is metered.
      if (!controller.signal.aborted) {
        failure = error instanceof AiClientError ? error.reason : "provider_error";
      }
    }

    // Superseded by a newer request (Regenerate, Fit to limit, Generate again):
    // that request owns the panel now, and this one must not overwrite it.
    if (abort.current !== controller) return;
    abort.current = null;
    setResult({
      status: failure ? "error" : "done",
      text: out,
      reason: failure,
      payload: request,
    });
    if (!failure && out.trim()) {
      setHistory((current) =>
        [out, ...current.filter((entry) => entry !== out)].slice(0, HISTORY_SIZE),
      );
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(result.text);
      setCopied(true);
    } catch {
      setResult((current) => ({ ...current, reason: "copy_failed" }));
    }
  }

  function feedBack() {
    setText(result.text);
    changeMode("improve");
  }

  const streaming = result.status === "streaming";
  const hasResult = result.text.trim().length > 0;
  const requested = result.payload?.length;
  const fit = requested && hasResult ? measureLength(result.text, requested) : null;
  const reasonText = (reason: string) =>
    reason === "copy_failed"
      ? t("copyFailed")
      : tAi.has(`reasons.${reason}`)
        ? tAi(`reasons.${reason}` as "reasons.provider_error")
        : tAi("reasons.provider_error");

  return (
    <>
      <Button
        variant="outline"
        className="shrink-0 gap-2"
        aria-label={t("trigger")}
        onClick={() => setOpen(true)}
      >
        <Sparkles aria-hidden className="size-4 text-primary-interactive" />
        <span className="hidden text-sm font-normal sm:inline">{t("trigger")}</span>
        <KbdGroup aria-hidden className="hidden lg:inline-flex">
          <Kbd>{isMac ? "⌘" : "Ctrl"}</Kbd>
          <Kbd>J</Kbd>
        </KbdGroup>
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="end"
          className="w-full gap-0 p-0 sm:max-w-xl"
          closeLabel={tAdmin("close")}
        >
          <SheetHeader className="border-b p-4 pe-12">
            <SheetTitle className="flex items-center gap-2">
              <Sparkles aria-hidden className="size-4 text-primary-interactive" />
              {t("title")}
            </SheetTitle>
            <SheetDescription>{t("description")}</SheetDescription>
          </SheetHeader>

          <form
            className="flex flex-col gap-4 p-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (form.validate()) void run(payload);
            }}
          >
            <ViewChips value={mode} onValueChange={changeMode} aria-label={t("title")}>
              <ViewChip value="write">{t("modeWrite")}</ViewChip>
              <ViewChip value="improve">{t("modeImprove")}</ViewChip>
            </ViewChips>

            <Field required invalid={form.invalid("text")}>
              <FieldLabel>{mode === "write" ? t("topicLabel") : t("textLabel")}</FieldLabel>
              <Textarea
                value={text}
                rows={mode === "write" ? 3 : 8}
                placeholder={mode === "write" ? t("topicPlaceholder") : t("textPlaceholder")}
                onChange={(event) => setText(event.target.value)}
              />
              <FieldError>{form.error("text")}</FieldError>
              <FieldDescription>
                <StatsLine text={text} />
              </FieldDescription>
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel>{t("actionLabel")}</FieldLabel>
                <AdminCombobox
                  value={action}
                  onValueChange={(value) => setAction(value as AiStudioAction)}
                  options={actionsFor(mode).map((key) => ({
                    value: key,
                    label: t(`actions.${key}`),
                  }))}
                />
              </Field>
              <Field>
                <FieldLabel>{t("languageLabel")}</FieldLabel>
                <AdminCombobox value={language} onValueChange={setLanguage} options={languages} />
              </Field>
              {!mechanical && (
                <Field>
                  <FieldLabel>{t("toneLabel")}</FieldLabel>
                  <AdminCombobox
                    value={tone}
                    onValueChange={(value) => setTone(value as AiStudioTone | "")}
                    options={[
                      { value: "", label: t("toneNone") },
                      ...AI_STUDIO_TONES.map((key) => ({ value: key, label: t(`tones.${key}`) })),
                    ]}
                  />
                </Field>
              )}
              {showFormat && (
                <Field>
                  <FieldLabel>{t("formatLabel")}</FieldLabel>
                  <AdminCombobox
                    value={format}
                    onValueChange={(value) => setFormat(value as AiStudioFormat)}
                    options={AI_STUDIO_FORMATS.map((key) => ({
                      value: key,
                      label: t(`formats.${key}`),
                    }))}
                  />
                </Field>
              )}
            </div>

            {!mechanical && (
              <FieldSet>
                <FieldLegend variant="label">{t("lengthLabel")}</FieldLegend>
                <ViewChips
                  value={lengthChoice}
                  onValueChange={setLengthChoice}
                  className="flex-wrap"
                  aria-label={t("lengthLabel")}
                >
                  <ViewChip value="none">{t("lengthNone")}</ViewChip>
                  {AI_STUDIO_LENGTH_PRESETS.map((p) => (
                    <ViewChip key={p.key} value={p.key}>
                      {t(`lengthPresets.${p.key}`)}
                    </ViewChip>
                  ))}
                  <ViewChip value="custom">{t("lengthCustom")}</ViewChip>
                </ViewChips>
                {lengthChoice === "custom" && (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field required invalid={form.invalid("length.target")}>
                      <FieldLabel>{t("targetLabel")}</FieldLabel>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        value={customTarget}
                        onChange={(event) => setCustomTarget(event.target.value)}
                      />
                      <FieldError>{form.error("length.target")}</FieldError>
                    </Field>
                    <Field>
                      <FieldLabel>{t("unitLabel")}</FieldLabel>
                      <AdminCombobox
                        value={customUnit}
                        onValueChange={(value) => setCustomUnit(value as AiStudioLengthUnit)}
                        options={AI_STUDIO_LENGTH_UNITS.map((key) => ({
                          value: key,
                          label: t(`units.${key}`),
                        }))}
                      />
                    </Field>
                  </div>
                )}
                <FieldDescription>{t("lengthHint")}</FieldDescription>
              </FieldSet>
            )}

            <div className="flex items-center justify-end gap-2">
              {streaming && (
                <>
                  {/* The shared Spinner, not `Button loading`: a loading
                      Button is disabled, and Stop must stay clickable. */}
                  <Spinner size="sm" aria-label={t("generating")} />
                  <Button type="button" variant="ghost" onClick={() => abort.current?.abort()}>
                    {t("stop")}
                  </Button>
                </>
              )}
              <Button type="submit">
                <Sparkles aria-hidden data-icon="inline-start" />
                {t("generate")}
              </Button>
            </div>
          </form>

          {result.status !== "idle" && (
            <section
              aria-labelledby="ai-writer-result"
              className="flex flex-col gap-3 border-t bg-muted/40 p-4"
            >
              <h3 id="ai-writer-result" className="text-sm font-medium">
                {t("resultTitle")}
              </h3>

              {result.reason && (
                <p className="text-sm text-destructive-interactive" role="status">
                  {result.reason === "copy_failed"
                    ? reasonText(result.reason)
                    : `${t("failed")} — ${reasonText(result.reason)}`}
                </p>
              )}

              {(hasResult || streaming) && (
                // Plain text with its line breaks; never markup (ADR-097).
                <p className="max-h-96 overflow-y-auto rounded-md border bg-background p-3 text-sm whitespace-pre-wrap">
                  {result.text || t("generating")}
                </p>
              )}

              {hasResult && (
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {fit && requested && (
                    <>
                      <span>
                        {t("statAgainst", {
                          count: fit.count,
                          target: fit.target,
                          unit: t(`units.${requested.unit}`).toLowerCase(),
                        })}
                      </span>
                      {!streaming &&
                        (fit.over === 0 ? (
                          <Badge variant="success">{t("withinTarget")}</Badge>
                        ) : (
                          <Badge variant="warning">{t("overTarget", { count: fit.over })}</Badge>
                        ))}
                      <span aria-hidden>·</span>
                    </>
                  )}
                  <StatsLine text={result.text} />
                </div>
              )}

              {hasResult && !streaming && (
                <div className="flex flex-wrap justify-end gap-2">
                  {fit && fit.over > 0 && result.payload && requested && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        void run({
                          ...result.payload!,
                          action: "shorten",
                          text: result.text,
                          length: requested,
                        })
                      }
                    >
                      <Scissors aria-hidden data-icon="inline-start" />
                      {t("fitToLimit")}
                    </Button>
                  )}
                  {result.payload && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void run(result.payload!)}
                    >
                      <RefreshCw aria-hidden data-icon="inline-start" />
                      {t("regenerate")}
                    </Button>
                  )}
                  <Button type="button" variant="outline" size="sm" onClick={feedBack}>
                    <CornerUpLeft aria-hidden data-icon="inline-start" />
                    {t("useAsInput")}
                  </Button>
                  <Button type="button" size="sm" onClick={() => void copy()}>
                    {copied ? (
                      <Check aria-hidden data-icon="inline-start" />
                    ) : (
                      <Copy aria-hidden data-icon="inline-start" />
                    )}
                    {copied ? t("copied") : t("copy")}
                  </Button>
                </div>
              )}
            </section>
          )}

          {history.length > 1 && (
            <section
              aria-labelledby="ai-writer-history"
              className="flex flex-col gap-2 border-t p-4"
            >
              <h3 id="ai-writer-history" className="text-sm font-medium">
                {t("historyTitle")}
              </h3>
              <p className="text-xs text-muted-foreground">{t("historyHint")}</p>
              <ul className="flex flex-col gap-1">
                {history.slice(1).map((entry) => (
                  <li key={entry}>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-auto w-full justify-start py-1.5 text-start font-normal"
                      onClick={() =>
                        setResult((current) => ({
                          ...current,
                          status: "done",
                          text: entry,
                          reason: null,
                        }))
                      }
                    >
                      <span className="line-clamp-2 whitespace-normal">{entry}</span>
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

function subscribeNever() {
  return () => {};
}

/** Live counts for a text. Free: computed here, never asked of a model. */
function StatsLine({ text }: { text: string }) {
  const t = useTranslations("admin.ai.writer");
  const stats = textStats(text);
  return (
    <span className="inline-flex flex-wrap gap-x-2">
      <span>{t("statCharacters", { count: stats.characters })}</span>
      <span>({t("statCharactersNoSpaces", { count: stats.charactersNoSpaces })})</span>
      <span aria-hidden>·</span>
      <span>{t("statWords", { count: stats.words })}</span>
      <span aria-hidden>·</span>
      <span>{t("statSentences", { count: stats.sentences })}</span>
      <span aria-hidden>·</span>
      <span>{t("statParagraphs", { count: stats.paragraphs })}</span>
      {stats.readingMinutes > 0 && (
        <>
          <span aria-hidden>·</span>
          <span>{t("statReading", { count: stats.readingMinutes })}</span>
        </>
      )}
    </span>
  );
}

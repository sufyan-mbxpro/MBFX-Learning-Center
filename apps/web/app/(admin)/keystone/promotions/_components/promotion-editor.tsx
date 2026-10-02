"use client";

// The promotion editor (ADR-167, changes-52 P3) — new and existing alike.
//
// ONE Save for the whole screen, like every editor here: the promotion and its
// default-language words go through `savePromotionAction` (one transaction in
// the service), and each OTHER language whose words changed goes through
// `savePromotionTranslationAction` after it. A language tab is only offered
// once the promotion exists — a translation needs a row to hang off.
//
// Status is NOT part of the save. Activate / Archive act on what is stored,
// behind `promotions.publish`, and are offered only when there is nothing
// unsaved — activating a promotion should never quietly publish half-typed
// words, and it should never activate the old words while the screen shows new
// ones.
//
// Dates: the service stores instants. The pickers speak the editor's own local
// time (ADR-071 — "the editor's own clock is the zone"), so the stored ISO is
// shown only after hydration: the server has no reader's time zone, and
// formatting there would hand the browser markup it cannot match.
import { useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  CalendarRange,
  Copy,
  Eye,
  ImageIcon,
  Link2,
  Megaphone,
  MonitorSmartphone,
  MoreHorizontal,
  Power,
  Trash2,
} from "lucide-react";
import {
  PROMOTION_AUDIENCES,
  PROMOTION_BAR_POSITIONS,
  PROMOTION_FREQUENCIES,
  PROMOTION_KINDS,
  PROMOTION_MAX_DELAY_SECONDS,
  PROMOTION_MAX_PRIORITY,
  PROMOTION_PLACEMENTS,
  PROMOTION_TARGET_TYPES,
  PROMOTION_UNTRANSLATED,
  TIMED_PROMOTION_KINDS,
  promotionSaveSchema,
  type PromotionAudienceInput,
  type PromotionBarPositionInput,
  type PromotionFrequencyInput,
  type PromotionKindInput,
  type PromotionPhase,
  type PromotionPlacement,
  type PromotionUntranslatedInput,
} from "@repo/contracts";
import { Button } from "@repo/ui/components/button";
import { Checkbox } from "@repo/ui/components/checkbox";
import { ConfirmDialog } from "@repo/ui/components/confirm-dialog";
import { DateTimePicker } from "@repo/ui/components/date-time-picker";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import {
  Field as FieldRoot,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { Switch } from "@repo/ui/components/switch";
import { htmlToBlockText, toZonedInput, zonedInputToIso } from "@repo/utils";
import {
  duplicatePromotionAction,
  savePromotionAction,
  savePromotionTranslationAction,
  setPromotionDeletedAction,
  setPromotionStatusAction,
  type PromotionRefused,
} from "../../_actions/promotion-actions.ts";
import { AiFieldMenu, AiFillButton, type AiFillPatch } from "../../_components/ai-fill.tsx";
import { AdminCombobox } from "../../_components/combobox.tsx";
import { EditorSection, Field } from "../../_components/editor/editor-section.tsx";
import { richTextLabels } from "../../_components/editor-labels.ts";
import {
  GoogleTranslateButton,
  type GoogleTranslateLabels,
} from "../../_components/google-translate-button.tsx";
import { HeaderActions } from "../../_components/header-actions.tsx";
import { ImageUploadField } from "../../_components/image-upload-field.tsx";
import { RichTextEditor } from "../../_components/rich-text-editor.tsx";
import { StatusBadge, TRANSLATION_STATUS_TONE } from "../../_components/status-badge.tsx";
import { useFieldErrors } from "../../_hooks/use-field-errors.ts";
import { useServerAction } from "../../_hooks/use-server-action.ts";
import type { EditorAi } from "../../_lib/editor-ai.ts";
import { PHASE_TONE } from "../promotions-table.tsx";
import { PromotionPreview } from "./promotion-preview.tsx";
import { TargetPicker, type TargetChoice } from "./target-picker.tsx";

export interface PromotionWords {
  title: string;
  body: string;
  badge: string;
  ctaLabel: string;
  imageAlt: string;
}

export interface PromotionEditorInitial {
  /** Null for a promotion not saved yet. */
  id: string | null;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  phase: PromotionPhase;
  kind: PromotionKindInput;
  placements: PromotionPlacement[];
  showAsPopup: boolean;
  showInBand: boolean;
  showAsBar: boolean;
  barPosition: PromotionBarPositionInput;
  priority: number;
  /** ISO instants, or "" when not set yet. */
  startsAt: string;
  endsAt: string;
  eventStartsAt: string;
  eventEndsAt: string;
  frequency: PromotionFrequencyInput;
  delaySeconds: number;
  audience: PromotionAudienceInput;
  untranslated: PromotionUntranslatedInput;
  image: { id: string | null; url: string | null };
  linkKind: "CONTENT" | "PATH" | "EXTERNAL" | "NONE";
  target: TargetChoice | null;
  targetPath: string;
  targetUrl: string;
  recording: TargetChoice | null;
  /** Every active locale's words, blank where there is no row yet. */
  words: Record<string, PromotionWords>;
  /** The stored translation state per locale, "MISSING" where there is none. */
  languageStates: Record<string, string>;
}

const BLANK_WORDS: PromotionWords = { title: "", body: "", badge: "", ctaLabel: "", imageAlt: "" };
const WORD_FIELDS = ["title", "body", "badge", "ctaLabel", "imageAlt"] as const;
/** What Google is sent as plain text; the body goes as HTML. */
const PLAIN_WORD_FIELDS = ["title", "badge", "ctaLabel", "imageAlt"] as const;
const RECORDING_TYPES = ["VIDEO_TOPIC"] as const;
const LINK_KINDS = ["CONTENT", "PATH", "EXTERNAL", "NONE"] as const;

/**
 * Cross-field rules arrive from the contract as the generic "invalid" code.
 * Each path here gets the sentence that says WHICH rule — "must be after the
 * start" rather than "this value is invalid".
 */
const RULE_MESSAGES: Record<string, string> = {
  endsAt: "errors.endBeforeStart",
  showAsPopup: "errors.noSurface",
  showInBand: "errors.bandNeedsHome",
  eventStartsAt: "errors.eventStartRequired",
  eventEndsAt: "errors.eventEndBeforeStart",
  recordingTopicId: "errors.recordingNeedsTime",
  "translation.title": "errors.titleRequired",
  "translation.ctaLabel": "errors.ctaNeedsLink",
};

const noop = () => () => {};
const useHydrated = () =>
  useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );

/** "" stays "", anything else becomes the instant the wall clock names in the SITE's timezone (ADR-182). */
const localToIso = (local: string): string => zonedInputToIso(local);

const nullIfBlank = (value: string) => (value.trim() === "" ? null : value.trim());

export function PromotionEditor({
  initial,
  locales,
  defaultLocale,
  initialLocale,
  canUpdate,
  canCreate,
  canPublish,
  canDelete,
  ai,
  google,
}: {
  initial: PromotionEditorInitial;
  /** Active locales, default first. */
  locales: string[];
  defaultLocale: string;
  /** The language to open on (`?locale=` from the translation review queue). */
  initialLocale?: string;
  canUpdate: boolean;
  canCreate: boolean;
  canPublish: boolean;
  canDelete: boolean;
  /** ADR-126 — absent when AI is off or the viewer cannot use it here. */
  ai?: EditorAi;
  /** ADR-160 — "Translate with Google"; absent when automatic translation is off. */
  google?: { labels: GoogleTranslateLabels };
}) {
  const t = useTranslations("admin");
  const tp = useTranslations("admin.promotions");
  const tv = useTranslations("admin.validation");
  const router = useRouter();
  const { run, pending } = useServerAction();
  const hydrated = useHydrated();
  const isNew = initial.id === null;
  // A live promotion's edits reach visitors on save, so they need publish
  // (the service's rule); the screen says so rather than failing on Save.
  const editable = (isNew ? canCreate : canUpdate) && (initial.status !== "ACTIVE" || canPublish);

  const [kind, setKind] = useState(initial.kind);
  const [placements, setPlacements] = useState<PromotionPlacement[]>(initial.placements);
  const [showAsPopup, setShowAsPopup] = useState(initial.showAsPopup);
  const [showInBand, setShowInBand] = useState(initial.showInBand);
  const [showAsBar, setShowAsBar] = useState(initial.showAsBar);
  const [barPosition, setBarPosition] = useState(initial.barPosition);
  const [priority, setPriority] = useState(initial.priority);
  const [startsAt, setStartsAt] = useState(initial.startsAt);
  const [endsAt, setEndsAt] = useState(initial.endsAt);
  const [eventStartsAt, setEventStartsAt] = useState(initial.eventStartsAt);
  const [eventEndsAt, setEventEndsAt] = useState(initial.eventEndsAt);
  const [frequency, setFrequency] = useState(initial.frequency);
  const [delaySeconds, setDelaySeconds] = useState(initial.delaySeconds);
  const [audience, setAudience] = useState(initial.audience);
  const [untranslated, setUntranslated] = useState(initial.untranslated);
  const [image, setImage] = useState(initial.image);
  const [linkKind, setLinkKind] = useState(initial.linkKind);
  const [target, setTarget] = useState(initial.target);
  const [targetPath, setTargetPath] = useState(initial.targetPath);
  const [targetUrl, setTargetUrl] = useState(initial.targetUrl);
  const [recording, setRecording] = useState(initial.recording);
  const [words, setWords] = useState<Record<string, PromotionWords>>(initial.words);
  const [locale, setLocale] = useState(initialLocale ?? defaultLocale);
  // Per language: the words came from Google and nobody has touched them
  // since. The save keeps such a row MACHINE_TRANSLATED; the first edit makes
  // it a person's (the article editor's rule — the review IS the promotion).
  const [machine, setMachine] = useState<Record<string, boolean>>({});
  const [deleteOpen, setDeleteOpen] = useState(false);

  const timed = (TIMED_PROMOTION_KINDS as readonly string[]).includes(kind);
  const draft = words[locale] ?? BLANK_WORDS;
  // Merged from CURRENT state, not the last render: an AI patch and a keystroke
  // in the same tick would otherwise overwrite each other (ADR-126 §4).
  const setDraft = (patch: Partial<PromotionWords>, fromMachine = false) => {
    setWords((current) => ({
      ...current,
      [locale]: { ...(current[locale] ?? BLANK_WORDS), ...patch },
    }));
    if (WORD_FIELDS.some((field) => field in patch)) {
      setMachine((current) => ({ ...current, [locale]: fromMachine }));
    }
  };
  const source = words[defaultLocale] ?? BLANK_WORDS;

  // Exactly what the action receives, checked by the schema it parses with
  // (ADR-077), so a message on screen is the refusal the server would give.
  const payload = {
    ...(initial.id ? { id: initial.id } : {}),
    kind,
    placements,
    showAsPopup,
    showInBand,
    showAsBar,
    barPosition,
    priority,
    startsAt,
    endsAt,
    eventStartsAt: timed ? nullIfBlank(eventStartsAt) : null,
    eventEndsAt: timed ? nullIfBlank(eventEndsAt) : null,
    frequency,
    delaySeconds,
    audience,
    untranslated,
    imageAssetId: image.id,
    link:
      linkKind === "CONTENT"
        ? { kind: linkKind, targetType: target?.type ?? "COURSE", targetId: target?.id ?? "" }
        : linkKind === "PATH"
          ? { kind: linkKind, path: targetPath.trim() }
          : linkKind === "EXTERNAL"
            ? { kind: linkKind, url: targetUrl.trim() }
            : { kind: linkKind },
    recordingTopicId: timed ? (recording?.id ?? null) : null,
    translation: {
      locale: defaultLocale,
      title: nullIfBlank(source.title),
      body: nullIfBlank(source.body),
      badge: nullIfBlank(source.badge),
      ctaLabel: nullIfBlank(source.ctaLabel),
      imageAlt: nullIfBlank(source.imageAlt),
    },
  };
  const form = useFieldErrors(promotionSaveSchema, payload);
  const error = (path: string): string | undefined => {
    const message = form.error(path);
    const rule = RULE_MESSAGES[path];
    return message && rule && message === tv("invalid") ? tp(rule) : message;
  };

  // Unsaved changes, by value: the status buttons wait for a save.
  const snapshot = JSON.stringify({ payload, words });
  const [savedSnapshot, setSavedSnapshot] = useState(snapshot);
  const dirty = snapshot !== savedSnapshot;
  const [savedWords, setSavedWords] = useState(initial.words);

  const refused = (result: PromotionRefused) => toast.error(tp(`refusals.${result.reason}`));

  const save = () => {
    if (!form.validate()) return;
    run(async () => {
      const result = await savePromotionAction(payload);
      if (!result.ok) return refused(result);

      // Other languages, only where the words moved. A promotion that did not
      // exist before this save has no other language yet (the tabs were hidden).
      if (!isNew) {
        for (const code of locales) {
          if (code === defaultLocale) continue;
          const now = words[code] ?? BLANK_WORDS;
          if (JSON.stringify(now) === JSON.stringify(savedWords[code] ?? BLANK_WORDS)) continue;
          const saved = await savePromotionTranslationAction({
            promotionId: result.id,
            locale: code,
            title: nullIfBlank(now.title),
            body: nullIfBlank(now.body),
            badge: nullIfBlank(now.badge),
            ctaLabel: nullIfBlank(now.ctaLabel),
            imageAlt: nullIfBlank(now.imageAlt),
            ...(machine[code] ? { machineTranslated: true } : {}),
          });
          if (!saved.ok) return refused(saved);
        }
      }

      setSavedWords(words);
      setSavedSnapshot(snapshot);
      if (isNew) {
        toast.success(tp("created"));
        router.push(`/keystone/promotions/${result.id}`);
      } else {
        toast.success(t("saved"));
        // The language states beside the switcher and in the status panel are
        // the server's; a save may have changed them.
        router.refresh();
      }
    });
  };

  const changeStatus = (status: "ACTIVE" | "ARCHIVED" | "DRAFT", message: string) =>
    run(async () => {
      if (!initial.id) return;
      const result = await setPromotionStatusAction({ id: initial.id, status });
      if (!result.ok) return refused(result);
      toast.success(message);
    });

  const togglePlacement = (placement: PromotionPlacement, on: boolean) =>
    setPlacements((current) => {
      if (placement === "everywhere") return on ? ["everywhere"] : [];
      const rest = current.filter((p) => p !== placement && p !== "everywhere");
      return on ? PROMOTION_PLACEMENTS.filter((p) => p === placement || rest.includes(p)) : rest;
    });

  const pickerLabels = useMemo(
    () => ({
      placeholder: t("schedulePickerPlaceholder"),
      previousMonth: t("schedulePickerPreviousMonth"),
      nextMonth: t("schedulePickerNextMonth"),
      hour: t("schedulePickerHour"),
      minute: t("schedulePickerMinute"),
    }),
    [t],
  );
  const dateField = (
    label: string,
    path: string,
    value: string,
    onChange: (iso: string) => void,
    required: boolean,
  ) => (
    <Field label={label} required={required} error={error(path)}>
      <DateTimePicker
        value={hydrated && value ? toZonedInput(value) : ""}
        onChange={(local) => onChange(localToIso(local))}
        disabled={!editable}
        labels={pickerLabels}
      />
    </Field>
  );

  // The preview borrows the way the public read does.
  const borrowTitle = linkKind === "CONTENT" ? (target?.title ?? "") : "";
  const hasLink =
    (linkKind === "CONTENT" && target !== null) ||
    (linkKind === "PATH" && targetPath.trim() !== "") ||
    (linkKind === "EXTERNAL" && targetUrl.trim() !== "");

  // ADR-126: the fillable words as plain text — the review's "current"
  // column, the empty test behind each default tick, and the prompt's context.
  // Not on a promotion that is not saved yet: an AI run names an entity id.
  const aiFill = editable && !isNew ? ai?.fill : undefined;
  const aiCurrent = {
    title: draft.title,
    body: htmlToBlockText(draft.body),
    badge: draft.badge,
    ctaLabel: draft.ctaLabel,
  };
  const applyFill = (patch: AiFillPatch) => {
    const next: Partial<PromotionWords> = {};
    for (const key of ["title", "body", "badge", "ctaLabel"] as const) {
      const value = patch[key];
      if (typeof value === "string") next[key] = value;
    }
    setDraft(next);
  };
  const fieldMenu = (field: keyof typeof aiCurrent) =>
    aiFill ? (
      <AiFieldMenu
        config={aiFill}
        field={field}
        locale={locale}
        current={aiCurrent}
        onApply={(value) => setDraft({ [field]: value })}
      />
    ) : undefined;

  const onOtherLanguage = !isNew && locale !== defaultLocale;
  const languageState = machine[locale]
    ? "MACHINE_TRANSLATED"
    : (initial.languageStates[locale] ?? "MISSING");
  const stateCluster = (
    <>
      <StatusBadge tone={PHASE_TONE[initial.phase]}>{tp(`phases.${initial.phase}`)}</StatusBadge>
      {!isNew && locales.length > 1 && (
        <AdminCombobox
          aria-label={tp("localeLabel")}
          size="sm"
          className="w-24"
          value={locale}
          onValueChange={(next) => setLocale(next || locale)}
          options={locales.map((code) => ({ value: code, label: code.toUpperCase() }))}
        />
      )}
      {/* The language's own state beside its switcher, so whoever is reading
          the Arabic knows whether a person or Google wrote it. */}
      {onOtherLanguage && (
        <StatusBadge tone={TRANSLATION_STATUS_TONE[languageState] ?? "warning"}>
          {tp(`languageStates.${languageState}`)}
        </StatusBadge>
      )}
      {/* ADR-160: fills this language from the English as it is on screen,
          saved or not. It writes nothing; the Save does. */}
      {google && onOtherLanguage && editable && (
        <GoogleTranslateButton
          labels={google.labels}
          entity={{ type: "promotion", id: initial.id ?? "" }}
          sourceLocale={defaultLocale}
          targetLocale={locale}
          texts={Object.fromEntries(PLAIN_WORD_FIELDS.map((field) => [field, source[field]]))}
          html={source.body.trim() ? { body: source.body } : {}}
          wouldOverwrite={
            !machine[locale] &&
            initial.languageStates[locale] !== "MACHINE_TRANSLATED" &&
            WORD_FIELDS.some((field) => draft[field].trim() !== "")
          }
          onApply={(translated) => {
            const patch: Partial<PromotionWords> = {};
            for (const field of WORD_FIELDS) {
              const value = translated[field];
              if (typeof value === "string") patch[field] = value;
            }
            setDraft(patch, true);
          }}
        />
      )}
      {aiFill && (
        <AiFillButton
          withOptions
          config={aiFill}
          locale={locale}
          current={aiCurrent}
          fieldLabels={{
            title: tp("titleLabel"),
            body: tp("bodyLabel"),
            badge: tp("badgeLabel"),
            ctaLabel: tp("ctaLabel"),
          }}
          onApply={applyFill}
        />
      )}
    </>
  );

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <HeaderActions>
        {!isNew && (canCreate || canDelete) && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline" size="icon" aria-label={t("openActions")}>
                  <MoreHorizontal aria-hidden />
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              {canCreate && (
                <DropdownMenuItem
                  disabled={pending}
                  onClick={() =>
                    run(async () => {
                      const id = await duplicatePromotionAction(initial.id ?? "");
                      router.push(`/keystone/promotions/${id}`);
                    })
                  }
                >
                  <Copy aria-hidden data-icon="inline-start" />
                  {t("duplicate")}
                </DropdownMenuItem>
              )}
              {canDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    disabled={pending}
                    onClick={() => setDeleteOpen(true)}
                  >
                    <Trash2 aria-hidden data-icon="inline-start" />
                    {t("softDelete")}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {/* Enabled while fields are wrong: pressing it names them (ADR-077). */}
        <Button disabled={!editable} loading={pending} onClick={save}>
          {t("save")}
        </Button>
      </HeaderActions>

      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-(--grid-main-aside)">
        <div className="flex min-w-0 flex-col gap-4">
          <EditorSection
            title={tp("contentSection")}
            description={tp("contentSectionDescription")}
            icon={Megaphone}
            accent="primary"
            actions={stateCluster}
          >
            {isNew && locales.length > 1 && (
              <p className="text-xs text-muted-foreground">{tp("languageNotSavedYet")}</p>
            )}
            {locale === defaultLocale && (
              <Field label={tp("kindLabel")} hint={tp("kindHint")} required>
                <AdminCombobox
                  value={kind}
                  disabled={!editable}
                  onValueChange={(next) => next && setKind(next as PromotionKindInput)}
                  options={PROMOTION_KINDS.map((key) => ({
                    value: key,
                    label: tp(`kinds.${key}`),
                  }))}
                />
              </Field>
            )}
            <Field
              label={tp("titleLabel")}
              hint={linkKind === "CONTENT" ? tp("titleHintLinked") : undefined}
              required={linkKind !== "CONTENT" && locale === defaultLocale}
              error={locale === defaultLocale ? error("translation.title") : undefined}
              adornment={fieldMenu("title")}
            >
              <Input
                value={draft.title}
                maxLength={160}
                disabled={!editable}
                placeholder={borrowTitle}
                onChange={(event) => setDraft({ title: event.target.value })}
              />
            </Field>
            <Field
              label={tp("bodyLabel")}
              hint={tp("bodyHint")}
              error={locale === defaultLocale ? error("translation.body") : undefined}
            >
              <RichTextEditor
                // One editor per language: the editor keeps its own document,
                // and switching language must not carry one language's
                // document into another's value.
                key={locale}
                value={draft.body}
                onChange={(html) => setDraft({ body: html })}
                mediaCategory="promo"
                allowHtmlMode={false}
                labels={richTextLabels(t)}
                {...(ai?.assistant && editable && !isNew
                  ? { ai: { ...ai.assistant, config: { ...ai.assistant.config, locale } } }
                  : {})}
              />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                label={tp("badgeLabel")}
                hint={tp("badgeHint")}
                error={locale === defaultLocale ? error("translation.badge") : undefined}
                adornment={fieldMenu("badge")}
              >
                <Input
                  value={draft.badge}
                  maxLength={40}
                  disabled={!editable}
                  onChange={(event) => setDraft({ badge: event.target.value })}
                />
              </Field>
              <Field
                label={tp("ctaLabel")}
                hint={tp("ctaHint")}
                error={locale === defaultLocale ? error("translation.ctaLabel") : undefined}
                adornment={fieldMenu("ctaLabel")}
              >
                <Input
                  value={draft.ctaLabel}
                  maxLength={60}
                  disabled={!editable}
                  onChange={(event) => setDraft({ ctaLabel: event.target.value })}
                />
              </Field>
            </div>
          </EditorSection>

          <EditorSection
            title={tp("linkSection")}
            description={tp("linkSectionDescription")}
            icon={Link2}
            accent="info"
          >
            <Field label={tp("linkKindLabel")} required>
              <AdminCombobox
                value={linkKind}
                disabled={!editable}
                onValueChange={(next) => next && setLinkKind(next as typeof linkKind)}
                options={LINK_KINDS.map((key) => ({ value: key, label: tp(`linkKinds.${key}`) }))}
              />
            </Field>
            {linkKind === "CONTENT" && (
              <TargetPicker
                label={tp("targetLabel")}
                value={target}
                onChange={setTarget}
                types={PROMOTION_TARGET_TYPES}
                required
                error={error("link.targetId")}
                disabled={!editable}
              />
            )}
            {linkKind === "PATH" && (
              <Field
                label={tp("pathLabel")}
                hint={tp("pathHint")}
                required
                error={error("link.path")}
              >
                <Input
                  value={targetPath}
                  maxLength={500}
                  disabled={!editable}
                  placeholder="/support"
                  onChange={(event) => setTargetPath(event.target.value)}
                />
              </Field>
            )}
            {linkKind === "EXTERNAL" && (
              <Field label={tp("urlLabel")} hint={tp("urlHint")} required error={error("link.url")}>
                <Input
                  type="url"
                  value={targetUrl}
                  maxLength={500}
                  disabled={!editable}
                  placeholder="https://"
                  onChange={(event) => setTargetUrl(event.target.value)}
                />
              </Field>
            )}
          </EditorSection>

          <EditorSection
            title={tp("scheduleSection")}
            description={tp("scheduleSectionDescription")}
            icon={CalendarRange}
            accent="warning"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {dateField(tp("startsAtLabel"), "startsAt", startsAt, setStartsAt, true)}
              {dateField(tp("endsAtLabel"), "endsAt", endsAt, setEndsAt, true)}
            </div>
            <p className="text-xs text-muted-foreground">{tp("windowHint")}</p>
            {timed && (
              <>
                <div className="grid grid-cols-1 gap-4 border-t pt-4 sm:grid-cols-2">
                  {dateField(
                    tp("eventStartsLabel"),
                    "eventStartsAt",
                    eventStartsAt,
                    setEventStartsAt,
                    false,
                  )}
                  {dateField(
                    tp("eventEndsLabel"),
                    "eventEndsAt",
                    eventEndsAt,
                    setEventEndsAt,
                    false,
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{tp("eventHint")}</p>
                <TargetPicker
                  label={tp("recordingLabel")}
                  value={recording}
                  onChange={setRecording}
                  types={RECORDING_TYPES}
                  error={error("recordingTopicId")}
                  disabled={!editable}
                />
                <p className="text-xs text-muted-foreground">{tp("recordingHint")}</p>
              </>
            )}
          </EditorSection>

          <EditorSection
            title={tp("displaySection")}
            description={tp("displaySectionDescription")}
            icon={MonitorSmartphone}
            accent="success"
          >
            <fieldset className="flex min-w-0 flex-col gap-2">
              <legend className="mb-2 text-sm font-medium">{tp("placementsLabel")}</legend>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {PROMOTION_PLACEMENTS.map((placement) => (
                  <FieldRoot key={placement} orientation="horizontal">
                    <Checkbox
                      checked={placements.includes(placement)}
                      disabled={
                        !editable ||
                        (placement !== "everywhere" && placements.includes("everywhere"))
                      }
                      onCheckedChange={(on) => togglePlacement(placement, on === true)}
                    />
                    <FieldLabel>{tp(`placements.${placement}`)}</FieldLabel>
                  </FieldRoot>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">{tp("placementsHint")}</p>
              {form.error("placements") && (
                <p role="alert" className="text-xs text-destructive-interactive">
                  {form.error("placements")}
                </p>
              )}
            </fieldset>

            {/* Switch rows: the switch leads (ADR-089). */}
            <FieldRoot orientation="horizontal" invalid={Boolean(error("showAsPopup"))}>
              <Switch checked={showAsPopup} disabled={!editable} onCheckedChange={setShowAsPopup} />
              <FieldContent>
                <FieldLabel>{tp("popupLabel")}</FieldLabel>
                <FieldDescription>{error("showAsPopup") ?? tp("popupHint")}</FieldDescription>
              </FieldContent>
            </FieldRoot>
            <FieldRoot orientation="horizontal" invalid={Boolean(error("showInBand"))}>
              <Switch checked={showInBand} disabled={!editable} onCheckedChange={setShowInBand} />
              <FieldContent>
                <FieldLabel>{tp("bandLabel")}</FieldLabel>
                <FieldDescription>{error("showInBand") ?? tp("bandHint")}</FieldDescription>
              </FieldContent>
            </FieldRoot>
            {/* ADR-173: a small banner the visitor can close. */}
            <FieldRoot orientation="horizontal">
              <Switch checked={showAsBar} disabled={!editable} onCheckedChange={setShowAsBar} />
              <FieldContent>
                <FieldLabel>{tp("barLabel")}</FieldLabel>
                <FieldDescription>{tp("barHint")}</FieldDescription>
              </FieldContent>
            </FieldRoot>
            {showAsBar && (
              <Field
                label={tp("barPositionLabel")}
                hint={tp("barPositionHint")}
                required
                error={error("barPosition")}
              >
                <AdminCombobox
                  value={barPosition}
                  disabled={!editable}
                  onValueChange={(next) =>
                    next && setBarPosition(next as PromotionBarPositionInput)
                  }
                  options={PROMOTION_BAR_POSITIONS.map((key) => ({
                    value: key,
                    label: tp(`barPositions.${key}`),
                  }))}
                />
              </Field>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                label={tp("priorityLabel")}
                hint={tp("priorityHint")}
                error={error("priority")}
              >
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={PROMOTION_MAX_PRIORITY}
                  value={priority}
                  disabled={!editable}
                  onChange={(event) => setPriority(Number.parseInt(event.target.value, 10) || 0)}
                />
              </Field>
              <Field label={tp("delayLabel")} hint={tp("delayHint")} error={error("delaySeconds")}>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={PROMOTION_MAX_DELAY_SECONDS}
                  value={delaySeconds}
                  disabled={!editable || !showAsPopup}
                  onChange={(event) =>
                    setDelaySeconds(Number.parseInt(event.target.value, 10) || 0)
                  }
                />
              </Field>
              <Field label={tp("frequencyLabel")} hint={tp("frequencyHint")} required>
                <AdminCombobox
                  value={frequency}
                  disabled={!editable || (!showAsPopup && !showAsBar)}
                  onValueChange={(next) => next && setFrequency(next as PromotionFrequencyInput)}
                  options={PROMOTION_FREQUENCIES.map((key) => ({
                    value: key,
                    label: tp(`frequencies.${key}`),
                  }))}
                />
              </Field>
              <Field label={tp("audienceLabel")} required>
                <AdminCombobox
                  value={audience}
                  disabled={!editable}
                  onValueChange={(next) => next && setAudience(next as PromotionAudienceInput)}
                  options={PROMOTION_AUDIENCES.map((key) => ({
                    value: key,
                    label: tp(`audiences.${key}`),
                  }))}
                />
              </Field>
            </div>
            <Field label={tp("untranslatedLabel")} hint={tp("untranslatedHint")} required>
              <AdminCombobox
                value={untranslated}
                disabled={!editable}
                onValueChange={(next) =>
                  next && setUntranslated(next as PromotionUntranslatedInput)
                }
                options={PROMOTION_UNTRANSLATED.map((key) => ({
                  value: key,
                  label: tp(`untranslatedOptions.${key}`),
                }))}
              />
            </Field>
          </EditorSection>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <EditorSection
            title={tp("statusSection")}
            description={tp("statusSectionDescription")}
            icon={Power}
            accent="success"
          >
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge tone={PHASE_TONE[initial.phase]}>
                {tp(`phases.${initial.phase}`)}
              </StatusBadge>
            </div>
            {isNew ? (
              <p className="text-xs text-muted-foreground">{tp("saveFirst")}</p>
            ) : !canPublish ? (
              <p className="text-xs text-muted-foreground">{tp("publishNeeded")}</p>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  {initial.status !== "ACTIVE" && (
                    <Button
                      disabled={dirty}
                      loading={pending}
                      onClick={() => changeStatus("ACTIVE", tp("activated"))}
                    >
                      {tp("activate")}
                    </Button>
                  )}
                  {initial.status === "ACTIVE" && (
                    <>
                      <Button
                        variant="outline"
                        disabled={dirty}
                        loading={pending}
                        onClick={() => changeStatus("ARCHIVED", tp("archivedToast"))}
                      >
                        {tp("archive")}
                      </Button>
                      <Button
                        variant="outline"
                        disabled={dirty}
                        loading={pending}
                        onClick={() => changeStatus("DRAFT", tp("draftToast"))}
                      >
                        {tp("backToDraft")}
                      </Button>
                    </>
                  )}
                </div>
                {dirty && <p className="text-xs text-muted-foreground">{tp("saveChangesFirst")}</p>}
              </>
            )}
            {!isNew && locales.length > 1 && (
              <ul className="flex flex-col gap-1 border-t pt-3 text-xs">
                {locales.map((code) => (
                  <li key={code} className="flex items-center justify-between gap-2">
                    <span className="font-medium">{code.toUpperCase()}</span>
                    <span className="text-muted-foreground">
                      {tp(`languageStates.${initial.languageStates[code] ?? "MISSING"}`)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </EditorSection>

          <EditorSection
            title={tp("previewSection")}
            description={tp("previewSectionDescription")}
            icon={Eye}
            accent="neutral"
          >
            <PromotionPreview
              kind={kind}
              lang={locale}
              title={draft.title || borrowTitle}
              bodyHtml={draft.body}
              badge={draft.badge}
              ctaLabel={draft.ctaLabel}
              hasLink={hasLink}
              imageUrl={image.url}
              imageAlt={draft.imageAlt}
              eventStartsAt={timed ? eventStartsAt : ""}
              showInBand={showInBand}
              showAsBar={showAsBar}
              barPosition={barPosition}
            />
          </EditorSection>

          <EditorSection
            title={tp("imageSection")}
            description={tp("imageSectionDescription")}
            icon={ImageIcon}
            accent="warning"
          >
            {locale === defaultLocale && (
              <ImageUploadField
                id="promotion-image"
                label={tp("imageLabel")}
                value={image.url}
                purpose="content"
                category="promo"
                sourceType="PROMOTION"
                disabled={!editable}
                error={error("imageAssetId")}
                onChange={(next) => setImage({ id: next?.id ?? null, url: next?.url ?? null })}
                labels={{
                  upload: t("uploadImage"),
                  replace: t("replaceImage"),
                  remove: t("removeImage"),
                  uploading: t("uploading"),
                  hint: tp("imageHint"),
                  cancel: t("cancel"),
                  confirmRemoveTitle: t("confirmRemoveImageTitle"),
                  confirmRemoveBody: t("confirmRemoveImageBody"),
                }}
              />
            )}
            <Field
              label={tp("imageAltLabel")}
              hint={tp("imageAltHint")}
              error={locale === defaultLocale ? error("translation.imageAlt") : undefined}
            >
              <Input
                value={draft.imageAlt}
                maxLength={250}
                disabled={!editable}
                onChange={(event) => setDraft({ imageAlt: event.target.value })}
              />
            </Field>
          </EditorSection>
        </div>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={tp("confirmDeleteTitle")}
        description={tp("confirmDeleteBody")}
        confirmLabel={t("confirm")}
        cancelLabel={t("cancel")}
        onConfirm={() =>
          run(async () => {
            await setPromotionDeletedAction(initial.id ?? "", true);
            router.push("/keystone/promotions");
          })
        }
      />
    </div>
  );
}

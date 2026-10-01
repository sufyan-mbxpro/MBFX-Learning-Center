"use client";

// Settings → General → Reviews (ADR-169, changes-53): one card per review
// platform. The switch says whether its button shows on the public
// "Share your experience" band; the identifier (or a custom link) says where
// the button goes; the arrows set the order the buttons are drawn in.
//
// The address under each card is computed HERE, from what is typed, with the
// same `resolveReviewUrl` the public band uses — so "Visitors go to" is the
// link a visitor will get after Save, not a guess.
import * as React from "react";
import { ArrowDown, ArrowUp, ExternalLink, Star } from "lucide-react";
import {
  resolveReviewUrl,
  reviewPlatformsSaveSchema,
  type ReviewPlatformKey,
} from "@repo/contracts";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import {
  Field as SwitchRow,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { SocialGlyph } from "@repo/ui/components/social-glyph";
import { Switch } from "@repo/ui/components/switch";
import { EditorSection, Field } from "../_components/editor/editor-section.tsx";
import { useFieldErrors } from "../_hooks/use-field-errors.ts";
import { useServerAction } from "../_hooks/use-server-action.ts";
import { saveReviewPlatformsAction } from "../_actions/review-platform-actions.ts";

export interface ReviewPlatformFormRow {
  platform: ReviewPlatformKey;
  isEnabled: boolean;
  identifier: string;
  customUrl: string;
}

export interface ReviewPlatformsLabels {
  section: string;
  sectionDescription: string;
  platforms: Record<ReviewPlatformKey, string>;
  enabled: Record<ReviewPlatformKey, string>;
  enabledHint: string;
  identifier: Record<ReviewPlatformKey, string>;
  identifierHint: Record<ReviewPlatformKey, string>;
  customUrl: string;
  customUrlHint: string;
  preview: string;
  noLink: string;
  test: string;
  moveUp: Record<ReviewPlatformKey, string>;
  moveDown: Record<ReviewPlatformKey, string>;
  status: { on: string; off: string; needsLink: string };
  save: string;
  saved: string;
}

export function ReviewPlatformsForm({
  initial,
  labels,
}: {
  initial: ReviewPlatformFormRow[];
  labels: ReviewPlatformsLabels;
}) {
  const { run, pending } = useServerAction();
  const [rows, setRows] = React.useState(initial);
  const values = React.useMemo(() => ({ platforms: rows }), [rows]);
  const form = useFieldErrors(reviewPlatformsSaveSchema, values);

  const patch = (index: number, change: Partial<ReviewPlatformFormRow>) =>
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...change } : row)));

  const move = (index: number, by: -1 | 1) =>
    setRows((current) => {
      const target = index + by;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });

  const save = () => {
    if (!form.validate()) return;
    run(() => saveReviewPlatformsAction(values), {
      successMessage: labels.saved,
      onDone: () => form.reset(),
    });
  };

  return (
    <EditorSection
      title={labels.section}
      description={labels.sectionDescription}
      icon={Star}
      accent="info"
      footer={
        <div className="flex items-center justify-end">
          <Button type="button" loading={pending} onClick={save}>
            {labels.save}
          </Button>
        </div>
      }
    >
      <ol className="flex flex-col gap-3">
        {rows.map((row, index) => {
          const url = resolveReviewUrl(row);
          const status = !row.isEnabled ? "off" : url ? "on" : "needsLink";
          return (
            <li key={row.platform} className="flex flex-col gap-3 rounded-lg border p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <SocialGlyph name={row.platform} className="size-5" />
                  <h3 className="text-sm font-semibold">{labels.platforms[row.platform]}</h3>
                  <Badge
                    size="sm"
                    variant={
                      status === "on" ? "success" : status === "needsLink" ? "warning" : "outline"
                    }
                  >
                    {labels.status[status]}
                  </Badge>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={labels.moveUp[row.platform]}
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                  >
                    <ArrowUp aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={labels.moveDown[row.platform]}
                    disabled={index === rows.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    <ArrowDown aria-hidden />
                  </Button>
                </div>
              </div>

              <SwitchRow orientation="horizontal">
                <Switch
                  checked={row.isEnabled}
                  onCheckedChange={(isEnabled) => patch(index, { isEnabled })}
                />
                <FieldContent>
                  <FieldLabel>{labels.enabled[row.platform]}</FieldLabel>
                  <FieldDescription>{labels.enabledHint}</FieldDescription>
                </FieldContent>
              </SwitchRow>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field
                  label={labels.identifier[row.platform]}
                  hint={labels.identifierHint[row.platform]}
                  required={row.isEnabled && !row.customUrl}
                  error={form.error(`platforms.${index}.identifier`)}
                >
                  <Input
                    value={row.identifier}
                    onChange={(event) => patch(index, { identifier: event.target.value })}
                    autoComplete="off"
                    spellCheck={false}
                  />
                </Field>
                <Field
                  label={labels.customUrl}
                  hint={labels.customUrlHint}
                  error={form.error(`platforms.${index}.customUrl`)}
                >
                  <Input
                    type="url"
                    inputMode="url"
                    value={row.customUrl}
                    onChange={(event) => patch(index, { customUrl: event.target.value.trim() })}
                    placeholder="https://"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </Field>
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>{labels.preview}</span>
                {url ? (
                  <>
                    <span className="min-w-0 break-all text-foreground">{url}</span>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary-interactive underline-offset-4 hover:underline"
                    >
                      {labels.test}
                      <ExternalLink className="size-3" aria-hidden />
                    </a>
                  </>
                ) : (
                  <span>{labels.noLink}</span>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </EditorSection>
  );
}

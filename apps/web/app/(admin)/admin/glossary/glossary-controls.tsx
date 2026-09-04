"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import {
  createGlossaryTermAction,
  deleteGlossaryTermAction,
  saveGlossaryTranslationAction,
  transitionGlossaryAction,
} from "../_actions/content-actions.ts";
import { useServerAction } from "../_hooks/use-server-action.ts";
import { RichTextEditor, type RichTextLabels } from "../_components/rich-text-editor.tsx";
import type { LocaleOption } from "../articles/categories/category-controls.tsx";

export function NewTermButton({ label }: { label: string }) {
  const { run, pending } = useServerAction();
  return (
    <Button size="sm" disabled={pending} onClick={() => run(() => createGlossaryTermAction())}>
      {label}
    </Button>
  );
}

export function GlossaryControls({
  termId,
  legalTransitions,
  deleted,
  labels,
}: {
  termId: string;
  legalTransitions: string[];
  deleted: boolean;
  labels: { delete: string; restore: string; statusLabels: Record<string, string> };
}) {
  const { run, pending } = useServerAction();

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {legalTransitions.map((to) => (
        <Button
          key={to}
          variant="outline"
          size="xs"
          disabled={pending}
          onClick={() => run(() => transitionGlossaryAction(termId, to))}
        >
          <ArrowRight data-icon="inline-start" aria-hidden className="rtl:rotate-180" />
          {labels.statusLabels[to] ?? to}
        </Button>
      ))}
      <Button
        variant="destructive"
        size="xs"
        disabled={pending}
        className="ms-auto"
        onClick={() => run(() => deleteGlossaryTermAction(termId, !deleted))}
      >
        {deleted ? labels.restore : labels.delete}
      </Button>
    </div>
  );
}

export function TranslationForm({
  termId,
  locales,
  labels,
}: {
  termId: string;
  /** Active locales for the dropdown (changes-02: no free-text locale codes). */
  locales: LocaleOption[];
  labels: {
    term: string;
    slug: string;
    locale: string;
    body: string;
    save: string;
    saved: string;
    editor: RichTextLabels;
  };
}) {
  const [locale, setLocale] = useState(locales[0]?.code ?? "en");
  const [term, setTerm] = useState("");
  const [slug, setSlug] = useState("");
  const [body, setBody] = useState("");
  const { run, pending } = useServerAction();

  return (
    <div className="flex flex-col gap-2 border-t pt-3">
      <div className="flex flex-wrap gap-2">
        <Select value={locale} onValueChange={(v) => setLocale(v ?? locale)}>
          <SelectTrigger aria-label={labels.locale} className="w-40">
            <SelectValue>{locales.find((l) => l.code === locale)?.label ?? locale}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {locales.map((l) => (
              <SelectItem key={l.code} value={l.code}>
                {l.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          aria-label={labels.term}
          placeholder={labels.term}
          className="max-w-48"
        />
        <Input
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          aria-label={labels.slug}
          placeholder={labels.slug}
          className="max-w-48"
        />
      </div>
      <RichTextEditor value={body} onChange={setBody} labels={labels.editor} />
      <Button
        size="sm"
        className="self-start"
        disabled={pending || !term || !body}
        onClick={() =>
          run(
            () =>
              saveGlossaryTranslationAction({
                termId,
                locale,
                term,
                slug: slug || undefined,
                simpleExplanation: body,
              }),
            { successMessage: labels.saved },
          )
        }
      >
        {labels.save}
      </Button>
    </div>
  );
}

"use client";

// A provider's models, and what each is billed at (ADR-100 #2).
//
// **Prices are DATA.** A `PRICES` constant would make a price correction a
// deploy; this table makes it a form edit. Each row carries the date its price
// last changed, and the usage screen prints the most recent of those beside
// every spend figure — because the failure this repo has already met
// (`refreshSeconds`, ADR-096) is a control that looks live and is not.
import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { aiModelSchema } from "@repo/contracts";
import type { AiModelView } from "@repo/core";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { ConfirmDialog } from "@repo/ui/components/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import { Empty, EmptyDescription, EmptyTitle } from "@repo/ui/components/empty";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { Switch } from "@repo/ui/components/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table";
import { deleteAiModelAction, saveAiModelAction } from "../../../../_actions/ai-actions.ts";
import { AdminSection } from "../../../../_components/admin-page.tsx";
import { useFieldErrors } from "../../../../_hooks/use-field-errors.ts";
import { useServerAction } from "../../../../_hooks/use-server-action.ts";

export interface ModelsTableLabels {
  title: string;
  description: string;
  add: string;
  editTitle: string;
  editDescription: string;
  modelId: string;
  modelIdHint: string;
  label: string;
  inputPrice: string;
  outputPrice: string;
  cachedPrice: string;
  cachedPriceHint: string;
  maxTokens: string;
  vision: string;
  stream: string;
  enabled: string;
  sortOrder: string;
  save: string;
  saved: string;
  cancel: string;
  edit: string;
  deleteLabel: string;
  deleteTitle: string;
  deleteDescription: string;
  deleteDone: string;
  empty: string;
}

type Draft = {
  id: string | null;
  modelId: string;
  label: string;
  inputPricePerMTok: string;
  outputPricePerMTok: string;
  cachedInputPricePerMTok: string;
  maxOutputTokens: string;
  supportsVision: boolean;
  supportsStream: boolean;
  isEnabled: boolean;
  sortOrder: string;
};

function draftFrom(model?: AiModelView): Draft {
  return {
    id: model?.id ?? null,
    modelId: model?.modelId ?? "",
    label: model?.label ?? "",
    inputPricePerMTok: model ? String(model.inputPricePerMTok) : "0",
    outputPricePerMTok: model ? String(model.outputPricePerMTok) : "0",
    cachedInputPricePerMTok:
      model?.cachedInputPricePerMTok === null || model === undefined
        ? ""
        : String(model.cachedInputPricePerMTok),
    maxOutputTokens: model ? String(model.maxOutputTokens) : "4096",
    supportsVision: model?.supportsVision ?? false,
    supportsStream: model?.supportsStream ?? true,
    isEnabled: model?.isEnabled ?? true,
    sortOrder: model ? String(model.sortOrder) : "0",
  };
}

export function ModelsTable({
  providerId,
  models,
  labels,
  pricedLabels,
}: {
  providerId: string;
  models: AiModelView[];
  labels: ModelsTableLabels;
  /**
   * Each model's "priced on" line by id, built on the server: a translator is
   * a function, and a function cannot cross into a client component.
   */
  pricedLabels: Record<string, string>;
}) {
  const { run, pending } = useServerAction();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [deleting, setDeleting] = useState<AiModelView | null>(null);

  const values = draft
    ? {
        ...(draft.id ? { id: draft.id } : {}),
        providerId,
        modelId: draft.modelId,
        label: draft.label,
        inputPricePerMTok: Number(draft.inputPricePerMTok),
        outputPricePerMTok: Number(draft.outputPricePerMTok),
        cachedInputPricePerMTok:
          draft.cachedInputPricePerMTok === "" ? null : Number(draft.cachedInputPricePerMTok),
        maxOutputTokens: Number(draft.maxOutputTokens),
        supportsVision: draft.supportsVision,
        supportsStream: draft.supportsStream,
        isEnabled: draft.isEnabled,
        sortOrder: Number(draft.sortOrder),
      }
    : null;

  const form = useFieldErrors(aiModelSchema, values ?? {});

  const save = () => {
    if (!values || !form.validate()) return;
    run(() => saveAiModelAction(values), {
      successMessage: labels.saved,
      onDone: () => setDraft(null),
    });
  };

  const remove = () => {
    if (!deleting) return;
    run(() => deleteAiModelAction(deleting.id), {
      successMessage: labels.deleteDone,
      onDone: () => setDeleting(null),
    });
  };

  const set = (patch: Partial<Draft>) =>
    setDraft((current) => (current ? { ...current, ...patch } : current));

  return (
    <AdminSection title={labels.title}>
      <p className="text-sm text-muted-foreground">{labels.description}</p>

      {models.length === 0 ? (
        <Empty>
          <EmptyTitle>{labels.empty}</EmptyTitle>
          <EmptyDescription>{labels.description}</EmptyDescription>
        </Empty>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{labels.modelId}</TableHead>
                <TableHead>{labels.inputPrice}</TableHead>
                <TableHead>{labels.outputPrice}</TableHead>
                <TableHead>{labels.maxTokens}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {models.map((model) => (
                <TableRow key={model.id}>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <span className="font-medium">{model.label}</span>
                      {/* A model ID is read character by character — the one
                          form-value exception to code-style.md #6. */}
                      <span className="font-mono text-2xs text-muted-foreground">
                        {model.modelId}
                      </span>
                      <span className="text-2xs text-muted-foreground">
                        {pricedLabels[model.id]}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="tabular-nums">${model.inputPricePerMTok}</TableCell>
                  <TableCell className="tabular-nums">${model.outputPricePerMTok}</TableCell>
                  <TableCell className="tabular-nums">{model.maxOutputTokens}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      {!model.isEnabled && <Badge variant="outline">{labels.enabled}</Badge>}
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={labels.edit}
                        onClick={() => setDraft(draftFrom(model))}
                      >
                        <Pencil aria-hidden />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={labels.deleteLabel}
                        onClick={() => setDeleting(model)}
                      >
                        <Trash2 aria-hidden className="text-destructive-interactive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="flex justify-end">
        <Button variant="outline" onClick={() => setDraft(draftFrom())}>
          <Plus aria-hidden data-icon="inline-start" />
          {labels.add}
        </Button>
      </div>

      <Dialog open={draft !== null} onOpenChange={(open) => !open && setDraft(null)}>
        <DialogContent>
          {/* Every modal renders a title AND a description (ADR-057 #5) — a
              modal is a screen opening over another one, and it needs the
              description more, not less. */}
          <DialogHeader>
            <DialogTitle>{labels.editTitle}</DialogTitle>
            <DialogDescription>{labels.editDescription}</DialogDescription>
          </DialogHeader>

          {draft && (
            <FieldGroup>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field required invalid={form.invalid("modelId")}>
                  <FieldLabel>{labels.modelId}</FieldLabel>
                  <Input
                    className="font-mono"
                    value={draft.modelId}
                    onChange={(event) => set({ modelId: event.target.value })}
                  />
                  <FieldDescription>{labels.modelIdHint}</FieldDescription>
                  <FieldError>{form.error("modelId")}</FieldError>
                </Field>

                <Field required invalid={form.invalid("label")}>
                  <FieldLabel>{labels.label}</FieldLabel>
                  <Input
                    value={draft.label}
                    onChange={(event) => set({ label: event.target.value })}
                  />
                  <FieldError>{form.error("label")}</FieldError>
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field required invalid={form.invalid("inputPricePerMTok")}>
                  <FieldLabel>{labels.inputPrice}</FieldLabel>
                  <Input
                    type="number"
                    min={0}
                    step="0.000001"
                    value={draft.inputPricePerMTok}
                    onChange={(event) => set({ inputPricePerMTok: event.target.value })}
                  />
                  <FieldError>{form.error("inputPricePerMTok")}</FieldError>
                </Field>
                <Field required invalid={form.invalid("outputPricePerMTok")}>
                  <FieldLabel>{labels.outputPrice}</FieldLabel>
                  <Input
                    type="number"
                    min={0}
                    step="0.000001"
                    value={draft.outputPricePerMTok}
                    onChange={(event) => set({ outputPricePerMTok: event.target.value })}
                  />
                  <FieldError>{form.error("outputPricePerMTok")}</FieldError>
                </Field>
                <Field invalid={form.invalid("cachedInputPricePerMTok")}>
                  <FieldLabel>{labels.cachedPrice}</FieldLabel>
                  <Input
                    type="number"
                    min={0}
                    step="0.000001"
                    value={draft.cachedInputPricePerMTok}
                    onChange={(event) => set({ cachedInputPricePerMTok: event.target.value })}
                  />
                  <FieldDescription>{labels.cachedPriceHint}</FieldDescription>
                  <FieldError>{form.error("cachedInputPricePerMTok")}</FieldError>
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field required invalid={form.invalid("maxOutputTokens")}>
                  <FieldLabel>{labels.maxTokens}</FieldLabel>
                  <Input
                    type="number"
                    min={1}
                    value={draft.maxOutputTokens}
                    onChange={(event) => set({ maxOutputTokens: event.target.value })}
                  />
                  <FieldError>{form.error("maxOutputTokens")}</FieldError>
                </Field>
                <Field required invalid={form.invalid("sortOrder")}>
                  <FieldLabel>{labels.sortOrder}</FieldLabel>
                  <Input
                    type="number"
                    min={0}
                    value={draft.sortOrder}
                    onChange={(event) => set({ sortOrder: event.target.value })}
                  />
                  <FieldError>{form.error("sortOrder")}</FieldError>
                </Field>
              </div>

              <Field orientation="horizontal">
                <Switch
                  checked={draft.supportsVision}
                  onCheckedChange={(checked) => set({ supportsVision: checked })}
                />
                <FieldContent>
                  <FieldLabel>{labels.vision}</FieldLabel>
                </FieldContent>
              </Field>
              <Field orientation="horizontal">
                <Switch
                  checked={draft.supportsStream}
                  onCheckedChange={(checked) => set({ supportsStream: checked })}
                />
                <FieldContent>
                  <FieldLabel>{labels.stream}</FieldLabel>
                </FieldContent>
              </Field>
              <Field orientation="horizontal">
                <Switch
                  checked={draft.isEnabled}
                  onCheckedChange={(checked) => set({ isEnabled: checked })}
                />
                <FieldContent>
                  <FieldLabel>{labels.enabled}</FieldLabel>
                </FieldContent>
              </Field>
            </FieldGroup>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>
              {labels.cancel}
            </Button>
            <Button onClick={save} disabled={pending}>
              {labels.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={labels.deleteTitle}
        description={labels.deleteDescription}
        confirmLabel={labels.deleteLabel}
        cancelLabel={labels.cancel}
        onConfirm={remove}
      />
    </AdminSection>
  );
}

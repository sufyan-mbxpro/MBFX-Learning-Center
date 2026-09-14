"use client";

// One card per `AI_FEATURES` entry (ADR-097 #3).
//
// **The model dropdown's empty option is not blank** — it reads "Standard tier
// (Sonnet 5)", naming the tier the entry falls back to and the model that tier
// currently resolves to. An empty dropdown that silently means something is the
// bug ADR-087's key caption exists to prevent, one field over: leaving a field
// alone has to be legible as a choice.
//
// Each card also names what a call costs at current prices, because that is the
// number that makes the switch a decision rather than a guess.
import { useState } from "react";
import { Info } from "lucide-react";
import { aiFeatureSchema } from "@repo/contracts";
import type { AiFeatureCard } from "@repo/core";
import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/alert";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
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
import { Textarea } from "@repo/ui/components/textarea";
import { saveAiFeatureAction } from "../../_actions/ai-actions.ts";
import { AdminSection } from "../../_components/admin-page.tsx";
import { AdminCombobox } from "../../_components/combobox.tsx";
import { useFieldErrors } from "../../_hooks/use-field-errors.ts";
import { useServerAction } from "../../_hooks/use-server-action.ts";

export interface FeatureCardLabels {
  name: string;
  description: string;
  where: string;
  enabled: string;
  globalOff: string;
  provider: string;
  providerDefault: string;
  model: string;
  modelTier: string;
  maxTokens: string;
  maxTokensHint: string;
  instructions: string;
  instructionsHint: string;
  costPerCall: string | null;
  resolvedModel: string | null;
  streams: string | null;
  vision: string | null;
  save: string;
  saved: string;
}

export function FeatureCard({
  card,
  providers,
  models,
  globalEnabled,
  labels,
}: {
  card: AiFeatureCard;
  providers: { value: string; label: string }[];
  models: { value: string; label: string; providerId: string }[];
  globalEnabled: boolean;
  labels: FeatureCardLabels;
}) {
  const { run, pending } = useServerAction();

  const [isEnabled, setIsEnabled] = useState(card.isEnabled);
  const [providerId, setProviderId] = useState(card.providerId ?? "");
  const [modelId, setModelId] = useState(card.modelId ?? "");
  const [maxTokens, setMaxTokens] = useState(
    card.maxOutputTokens === null ? "" : String(card.maxOutputTokens),
  );
  const [instructions, setInstructions] = useState(card.extraInstructions ?? "");

  const values = {
    key: card.key,
    isEnabled,
    providerId: providerId || null,
    modelId: modelId || null,
    maxOutputTokens: maxTokens === "" ? null : Number(maxTokens),
    extraInstructions: instructions || null,
  };

  const form = useFieldErrors(aiFeatureSchema, values);

  const save = () => {
    if (!form.validate()) return;
    run(() => saveAiFeatureAction(values), { successMessage: labels.saved });
  };

  // A model belonging to another provider cannot be selected while a provider
  // is pinned: offering it would let an admin save a pair that resolution then
  // silently discards.
  const modelOptions = [
    { value: "", label: labels.modelTier },
    ...models
      .filter((model) => !providerId || model.providerId === providerId)
      .map(({ value, label }) => ({ value, label })),
  ];

  return (
    <AdminSection title={labels.name}>
      <div className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">{labels.description}</p>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{labels.where}</Badge>
          {labels.streams && <Badge variant="secondary">{labels.streams}</Badge>}
          {labels.vision && <Badge variant="secondary">{labels.vision}</Badge>}
          {labels.resolvedModel && <Badge variant="outline">{labels.resolvedModel}</Badge>}
          {labels.costPerCall && (
            // "Estimated" is part of the string, not an afterthought (ADR-100 #4).
            <span className="text-2xs text-muted-foreground">{labels.costPerCall}</span>
          )}
        </div>
      </div>

      <FieldGroup>
        {/* Switch first, then its label (ADR-089) — a switch is a state being
            flipped, and it reads on one line with the words it governs. */}
        <Field orientation="horizontal">
          <Switch checked={isEnabled} onCheckedChange={setIsEnabled} />
          <FieldContent>
            <FieldLabel>{labels.enabled}</FieldLabel>
          </FieldContent>
        </Field>

        {/* Turning a feature on while the GLOBAL switch is off is allowed, and
            the card says so — ADR-078 #9's precedent, where a test send ignores
            `isActive` but never the global switch. */}
        {isEnabled && !globalEnabled && (
          <Alert variant="info">
            <Info aria-hidden />
            <AlertTitle>{labels.globalOff}</AlertTitle>
            <AlertDescription>{labels.globalOff}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Field>
            <FieldLabel>{labels.provider}</FieldLabel>
            <AdminCombobox
              value={providerId}
              onValueChange={(value) => {
                setProviderId(value);
                // A pinned model belonging to the old provider would resolve to
                // nothing; clearing it drops the feature back to its tier, which
                // is the state the empty option names in words.
                setModelId("");
              }}
              options={[{ value: "", label: labels.providerDefault }, ...providers]}
            />
          </Field>

          <Field>
            <FieldLabel>{labels.model}</FieldLabel>
            <AdminCombobox value={modelId} onValueChange={setModelId} options={modelOptions} />
          </Field>
        </div>

        <Field invalid={form.invalid("maxOutputTokens")}>
          <FieldLabel>{labels.maxTokens}</FieldLabel>
          <Input
            type="number"
            min={1}
            value={maxTokens}
            onChange={(event) => setMaxTokens(event.target.value)}
          />
          <FieldDescription>{labels.maxTokensHint}</FieldDescription>
          <FieldError>{form.error("maxOutputTokens")}</FieldError>
        </Field>

        <Field invalid={form.invalid("extraInstructions")}>
          <FieldLabel>{labels.instructions}</FieldLabel>
          <Textarea
            rows={3}
            maxLength={1000}
            value={instructions}
            onChange={(event) => setInstructions(event.target.value)}
          />
          <FieldDescription>{labels.instructionsHint}</FieldDescription>
          <FieldError>{form.error("extraInstructions")}</FieldError>
        </Field>
      </FieldGroup>

      {/* Save sits at the inline END of its section (ADR-044 #8). */}
      <div className="flex justify-end">
        <Button onClick={save} disabled={pending}>
          {labels.save}
        </Button>
      </div>
    </AdminSection>
  );
}

"use client";

// Settings → General → reCAPTCHA (ADR-156): switch Google reCAPTCHA v3 on or
// off for sign-in, sign-up and the support form, and enter its keys.
//
// Three properties it has to keep:
//
//   1. **The secret key is write-only.** It arrives as `hasSecretKey`, never
//      as a value, and a blank field means "keep the saved one" (the SMTP
//      password's rule, ADR-078).
//   2. **Switching on is proved.** Save mints a token IN THIS BROWSER with the
//      site key being saved, and the server checks it with the secret being
//      saved. Keys that do not work would refuse every sign-in, this admin's
//      included, so they are refused here instead.
//   3. **A save the server refused says why.** Each refusal names something
//      the admin can fix: the sealing key, a missing secret, keys that fail.
import * as React from "react";
import { ShieldCheck } from "lucide-react";
import { CAPTCHA_ACTIONS, CAPTCHA_MIN_SCORES, captchaSettingsSaveSchema } from "@repo/contracts";
import type { CaptchaSaveRefusal, CaptchaSettingsView } from "@repo/auth";
import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/alert";
import { Button } from "@repo/ui/components/button";
import {
  Field as SwitchRow,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { PasswordInput } from "@repo/ui/components/password-input";
import { Switch } from "@repo/ui/components/switch";
import { formatDateTime } from "@repo/utils";
import { AdminCombobox } from "../_components/combobox.tsx";
import { EditorSection, Field } from "../_components/editor/editor-section.tsx";
import { useFieldErrors } from "../_hooks/use-field-errors.ts";
import { useServerAction } from "../_hooks/use-server-action.ts";
import { saveCaptchaSettingsAction } from "../_actions/captcha-actions.ts";
import { getCaptchaToken } from "../../../_lib/recaptcha.ts";

export interface CaptchaSettingsLabels {
  section: string;
  sectionDescription: string;
  enabled: string;
  enabledHint: string;
  siteKey: string;
  siteKeyHint: string;
  secretKey: string;
  secretKeyHint: string;
  secretKeySaved: string;
  minScore: string;
  minScoreHint: string;
  showSecret: string;
  hideSecret: string;
  save: string;
  saved: string;
  lastVerified: string;
  never: string;
  sealKeyMissingTitle: string;
  sealKeyMissingBody: string;
  forcedOffTitle: string;
  forcedOffBody: string;
  refusals: Record<CaptchaSaveRefusal | "tokenUnavailable", string>;
}

export function CaptchaSettingsForm({
  settings,
  labels,
}: {
  settings: CaptchaSettingsView;
  labels: CaptchaSettingsLabels;
}) {
  const { run, pending } = useServerAction();
  const [enabled, setEnabled] = React.useState(settings.enabled);
  const [siteKey, setSiteKey] = React.useState(settings.siteKey);
  const [secretKey, setSecretKey] = React.useState("");
  const [minScore, setMinScore] = React.useState<number>(settings.minScore);

  const values = React.useMemo(
    () => ({ enabled, siteKey, secretKey: secretKey || undefined, minScore }),
    [enabled, siteKey, secretKey, minScore],
  );
  const form = useFieldErrors(captchaSettingsSaveSchema, values);

  const save = () => {
    if (!form.validate()) return;
    run(
      async () => {
        let checkToken: string | undefined;
        if (enabled) {
          // Minted with the key being SAVED, not whatever this page loaded.
          const captcha = await getCaptchaToken(CAPTCHA_ACTIONS.check, siteKey.trim());
          if (!captcha.ok || !captcha.token) throw new Error(labels.refusals.tokenUnavailable);
          checkToken = captcha.token;
        }
        const result = await saveCaptchaSettingsAction({ ...values, checkToken });
        if (!result.ok) throw new Error(labels.refusals[result.reason]);
      },
      {
        successMessage: labels.saved,
        onDone: () => {
          setSecretKey("");
          form.reset();
        },
      },
    );
  };

  return (
    <EditorSection
      title={labels.section}
      description={labels.sectionDescription}
      icon={ShieldCheck}
      accent="warning"
      footer={
        <div className="flex items-center justify-end">
          <Button type="button" loading={pending} onClick={save}>
            {labels.save}
          </Button>
        </div>
      }
    >
      {/* The secret is sealed under an env-only key (security.md #10). Without
          it a secret cannot be saved, so the check cannot be switched on. */}
      {!settings.sealKeyPresent && (
        <Alert variant="warning">
          <AlertTitle>{labels.sealKeyMissingTitle}</AlertTitle>
          <AlertDescription>{labels.sealKeyMissingBody}</AlertDescription>
        </Alert>
      )}
      {settings.forcedOff && (
        <Alert variant="warning">
          <AlertTitle>{labels.forcedOffTitle}</AlertTitle>
          <AlertDescription>{labels.forcedOffBody}</AlertDescription>
        </Alert>
      )}

      <SwitchRow orientation="horizontal">
        <Switch checked={enabled} onCheckedChange={setEnabled} />
        <FieldContent>
          <FieldLabel>{labels.enabled}</FieldLabel>
          <FieldDescription>{labels.enabledHint}</FieldDescription>
        </FieldContent>
      </SwitchRow>

      <Field
        label={labels.siteKey}
        hint={labels.siteKeyHint}
        required={enabled}
        error={form.error("siteKey")}
      >
        <Input
          value={siteKey}
          onChange={(event) => setSiteKey(event.target.value)}
          autoComplete="off"
          spellCheck={false}
          className="font-mono"
        />
      </Field>

      <Field
        label={labels.secretKey}
        hint={settings.hasSecretKey ? labels.secretKeySaved : labels.secretKeyHint}
        required={enabled && !settings.hasSecretKey}
        error={form.error("secretKey")}
      >
        <PasswordInput
          value={secretKey}
          onChange={(event) => setSecretKey(event.target.value)}
          // Never the browser's saved credential: this is Google's key.
          autoComplete="new-password"
          spellCheck={false}
          showLabel={labels.showSecret}
          hideLabel={labels.hideSecret}
        />
      </Field>

      <Field label={labels.minScore} hint={labels.minScoreHint} error={form.error("minScore")}>
        <AdminCombobox
          value={String(minScore)}
          onValueChange={(value) => setMinScore(Number(value))}
          options={CAPTCHA_MIN_SCORES.map((score) => ({
            value: String(score),
            label: score.toFixed(1),
          }))}
        />
      </Field>

      <dl className="flex gap-1.5 text-xs text-muted-foreground">
        <dt>{labels.lastVerified}</dt>
        <dd className="text-foreground">
          {settings.lastVerifiedAt ? formatDateTime(settings.lastVerifiedAt) : labels.never}
        </dd>
      </dl>
    </EditorSection>
  );
}

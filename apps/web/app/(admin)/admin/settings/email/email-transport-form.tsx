"use client";

// The SMTP transport (ADR-078 #3, #4) — `super_admin` only, which is why this
// component is rendered conditionally rather than disabled.
//
// Two properties it has to keep:
//
//   1. **The password is write-only.** It arrives as `hasPassword`, never as a
//      value, so the field shows "saved — replace" and submits empty to mean
//      "leave it alone". Removing one is therefore a separate intent
//      (`clearPassword`), confirmed, because "submit the form blank" is what
//      every other save does.
//   2. **Verification is not a save.** "Test connection" proves the STORED row
//      reaches a server. Testing before saving would test a row that does not
//      exist yet, so the button says which it did.
import * as React from "react";
import { MailCheck, ServerCog } from "lucide-react";
import { emailTransportSaveSchema } from "@repo/contracts";
import type { EmailTransportView } from "@repo/core";
import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/alert";
import { Button } from "@repo/ui/components/button";
import { ConfirmDialog } from "@repo/ui/components/confirm-dialog";
import { Input } from "@repo/ui/components/input";
import { PasswordInput } from "@repo/ui/components/password-input";
import { AdminCombobox } from "../../_components/combobox.tsx";
import { EditorSection, Field } from "../../_components/editor/editor-section.tsx";
import { useFieldErrors } from "../../_hooks/use-field-errors.ts";
import { useServerAction } from "../../_hooks/use-server-action.ts";
import {
  saveEmailTransportAction,
  testEmailConnectionAction,
} from "../../_actions/email-actions.ts";
import { formatDateTime } from "@repo/utils";

/**
 * SendGrid, as a PROVIDER rather than a driver (changes-49, owner: "sendgrid
 * add option for email"). SendGrid accepts SMTP, so choosing it stores an
 * ordinary SMTP row with SendGrid's fixed host, port, security and username —
 * and the API key goes in the password slot, sealed exactly as the SMTP
 * password is (ADR-078 #3). No new driver, no new column, no second secret
 * store: security.md #10 names three sealed secrets and this is not a fourth.
 */
const SENDGRID = {
  host: "smtp.sendgrid.net",
  port: 587,
  security: "STARTTLS",
  // SendGrid's documented SMTP username — the literal word, for every account.
  username: "apikey",
} as const;

type ProviderChoice = "SMTP" | "SENDGRID" | "LOG";

export interface EmailTransportLabels {
  section: string;
  sectionDescription: string;
  driver: string;
  driverHint: string;
  driverSmtp: string;
  driverSendgrid: string;
  driverLog: string;
  sendgridKey: string;
  sendgridKeyHint: string;
  host: string;
  port: string;
  security: string;
  securityNone: string;
  securityStarttls: string;
  securityTls: string;
  username: string;
  password: string;
  passwordSaved: string;
  passwordHint: string;
  clearPassword: string;
  showPassword: string;
  hidePassword: string;
  save: string;
  saved: string;
  test: string;
  testOk: string;
  lastVerified: string;
  lastError: string;
  never: string;
  secretKeyMissingTitle: string;
  secretKeyMissingBody: string;
  confirmClearTitle: string;
  confirmClearBody: string;
  confirm: string;
  cancel: string;
}

export function EmailTransportForm({
  transport,
  labels,
}: {
  transport: EmailTransportView;
  labels: EmailTransportLabels;
}) {
  const { run, pending } = useServerAction();
  const [choice, setChoice] = React.useState<ProviderChoice>(() =>
    transport.driver === "SMTP" && transport.host === SENDGRID.host ? "SENDGRID" : transport.driver,
  );
  const driver: EmailTransportView["driver"] = choice === "LOG" ? "LOG" : "SMTP";
  const isSendgrid = choice === "SENDGRID";
  const [host, setHost] = React.useState(transport.host ?? "");
  const [port, setPort] = React.useState(transport.port === null ? "" : String(transport.port));
  const [security, setSecurity] = React.useState(transport.security);
  const [username, setUsername] = React.useState(transport.username ?? "");
  const [password, setPassword] = React.useState("");
  const [confirmClear, setConfirmClear] = React.useState(false);
  const [testResult, setTestResult] = React.useState<string | null>(null);

  const values = React.useMemo(
    () =>
      isSendgrid
        ? { driver, ...SENDGRID, password: password || undefined }
        : {
            driver,
            host: host.trim() || undefined,
            // An empty port must reach the schema as `undefined`, not `NaN`:
            // the SMTP branch refuses a missing port, and `NaN` would fail as
            // "not a number" instead of naming the field that is blank.
            port: port.trim() === "" ? undefined : Number(port),
            security,
            username: username.trim() || undefined,
            password: password || undefined,
          },
    [driver, isSendgrid, host, port, security, username, password],
  );
  const form = useFieldErrors(emailTransportSaveSchema, values);

  const submit = (clearPassword?: boolean) => {
    if (!form.validate()) return;
    run(
      () => saveEmailTransportAction({ ...values, ...(clearPassword ? { clearPassword } : {}) }),
      {
        successMessage: labels.saved,
        onDone: () => {
          setPassword("");
          setTestResult(null);
        },
      },
    );
  };

  const isSmtp = choice === "SMTP";

  return (
    <EditorSection
      title={labels.section}
      description={labels.sectionDescription}
      icon={ServerCog}
      accent="warning"
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            loading={pending}
            onClick={() =>
              run(
                async () => {
                  const result = await testEmailConnectionAction();
                  setTestResult(result.ok ? labels.testOk : result.error);
                },
                { skipRefresh: true },
              )
            }
          >
            <MailCheck aria-hidden />
            {labels.test}
          </Button>
          <Button type="button" loading={pending} onClick={() => submit()}>
            {labels.save}
          </Button>
        </div>
      }
    >
      {/* The seal's key is env-only (ADR-078 #3). Without it a stored password
          cannot be opened, so delivery degrades to the log driver rather than
          failing loudly — which is exactly the case worth warning about. */}
      {!transport.secretKeyPresent && (
        <Alert variant="warning">
          <AlertTitle>{labels.secretKeyMissingTitle}</AlertTitle>
          <AlertDescription>{labels.secretKeyMissingBody}</AlertDescription>
        </Alert>
      )}

      <Field label={labels.driver} hint={labels.driverHint} error={form.error("driver")}>
        <AdminCombobox
          value={choice}
          onValueChange={(value) => setChoice(value as ProviderChoice)}
          options={[
            { value: "SENDGRID", label: labels.driverSendgrid },
            { value: "SMTP", label: labels.driverSmtp },
            { value: "LOG", label: labels.driverLog },
          ]}
        />
      </Field>

      {isSendgrid && (
        <Field
          label={labels.sendgridKey}
          required={!transport.hasPassword}
          hint={transport.hasPassword ? labels.passwordSaved : labels.sendgridKeyHint}
          error={form.error("password")}
        >
          <PasswordInput
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            spellCheck={false}
            showLabel={labels.showPassword}
            hideLabel={labels.hidePassword}
          />
        </Field>
      )}

      {isSmtp && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <Field label={labels.host} required error={form.error("host")}>
                <Input
                  value={host}
                  onChange={(event) => setHost(event.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                />
              </Field>
            </div>
            <Field label={labels.port} required error={form.error("port")}>
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                max={65535}
                value={port}
                onChange={(event) => setPort(event.target.value)}
              />
            </Field>
          </div>

          <Field label={labels.security} error={form.error("security")}>
            <AdminCombobox
              value={security}
              onValueChange={(value) => setSecurity(value as EmailTransportView["security"])}
              options={[
                { value: "STARTTLS", label: labels.securityStarttls },
                { value: "TLS", label: labels.securityTls },
                { value: "NONE", label: labels.securityNone },
              ]}
            />
          </Field>

          <Field label={labels.username} error={form.error("username")}>
            <Input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </Field>

          <Field
            label={labels.password}
            hint={transport.hasPassword ? labels.passwordSaved : labels.passwordHint}
            error={form.error("password")}
            adornment={
              transport.hasPassword ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive-interactive"
                  onClick={() => setConfirmClear(true)}
                >
                  {labels.clearPassword}
                </Button>
              ) : undefined
            }
          >
            <PasswordInput
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              // Never the browser's saved credential: this is a server's
              // password, not the person's.
              autoComplete="new-password"
              showLabel={labels.showPassword}
              hideLabel={labels.hidePassword}
            />
          </Field>
        </>
      )}

      <dl className="grid grid-cols-1 gap-1 text-xs text-muted-foreground sm:grid-cols-2">
        <div className="flex gap-1.5">
          <dt>{labels.lastVerified}</dt>
          <dd className="text-foreground">
            {transport.lastVerifiedAt ? formatDateTime(transport.lastVerifiedAt) : labels.never}
          </dd>
        </div>
        {transport.lastError && (
          <div className="flex gap-1.5">
            <dt>{labels.lastError}</dt>
            <dd className="text-destructive-interactive">{transport.lastError}</dd>
          </div>
        )}
      </dl>

      {testResult && <p className="text-xs text-muted-foreground">{testResult}</p>}

      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title={labels.confirmClearTitle}
        description={labels.confirmClearBody}
        confirmLabel={labels.confirm}
        cancelLabel={labels.cancel}
        onConfirm={() => submit(true)}
      />
    </EditorSection>
  );
}

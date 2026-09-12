import { ServerCog } from "lucide-react";
import type { EmailTransportView } from "@repo/core";
import { Alert, AlertDescription } from "@repo/ui/components/alert";
import { humanizeKey } from "@repo/utils";
import { EditorSection } from "../../_components/editor/editor-section.tsx";

// What an admin WITHOUT `email.settings.manage` sees in place of the transport
// form (ADR-078 #4).
//
// Absent-not-disabled applies to the CONTROLS, not to the information: a
// disabled host field invites someone to ask for the key, while knowing where
// mail leaves from is what makes "our reset emails stop arriving" diagnosable
// at all. Nothing here is a secret — the password never leaves the database,
// and `EmailTransportView` has no property for it.
export function EmailDeliveryReadOnly({
  transport,
  labels,
}: {
  transport: EmailTransportView;
  labels: {
    section: string;
    restricted: string;
    driver: string;
    host: string;
    security: string;
    username: string;
    lastVerified: string;
    never: string;
    notSet: string;
  };
}) {
  const rows: Array<[string, string]> = [
    // `humanizeKey` rather than the raw enum member: ADR-044 #5 applies to a
    // value an admin reads, and "Smtp" beats "SMTP" nowhere — so the helper's
    // output is what the rule asks for, consistently with every other screen.
    [labels.driver, humanizeKey(transport.driver)],
    [
      labels.host,
      transport.host ? `${transport.host}${transport.port ? `:${transport.port}` : ""}` : labels.notSet,
    ],
    [labels.security, humanizeKey(transport.security)],
    [labels.username, transport.username ?? labels.notSet],
    [
      labels.lastVerified,
      transport.lastVerifiedAt
        ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(
            transport.lastVerifiedAt,
          )
        : labels.never,
    ],
  ];

  return (
    <EditorSection title={labels.section} icon={ServerCog} accent="neutral">
      <Alert>
        <AlertDescription>{labels.restricted}</AlertDescription>
      </Alert>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
        {rows.map(([term, value]) => (
          <div key={term} className="flex min-w-0 flex-col gap-0.5">
            <dt className="text-xs text-muted-foreground">{term}</dt>
            <dd className="truncate text-sm">{value}</dd>
          </div>
        ))}
      </dl>
    </EditorSection>
  );
}

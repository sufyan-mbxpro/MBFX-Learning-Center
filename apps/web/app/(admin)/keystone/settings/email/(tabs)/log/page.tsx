import { getTranslations } from "next-intl/server";
import { EMAIL_TEMPLATE_KEYS, emailDeliveryFilterSchema } from "@repo/contracts";
import { countEmailDeliveries, listEmailDeliveries } from "@repo/core";
import { requirePermission } from "@repo/rbac";
import { MetricCard } from "@repo/ui/components/metric-card";
import { formatDateTime, humanizeKey } from "@repo/utils";
import { DeliveryLogTable, type DeliveryLogLabels } from "./delivery-log-table.tsx";

// The delivery log (Module 17, ADR-078 #10).
//
// It answers "was it sent, to whom, and why not" — never "what did it say".
// There is no body column and no variables column, because a reset link in a
// table an admin can read is a second interception path. Rows are purged after
// 90 days by `/api/cron/housekeeping` (F7).
//
// **Filters are URL state, not client state.** The log pages from the server by
// keyset cursor, so the filter has to travel with the request: a client filter
// over one page would narrow 50 rows and call it "no results".
export default async function EmailLogPage({
  searchParams,
}: PageProps<"/keystone/settings/email/log">) {
  await requirePermission("email.log.view");
  const t = await getTranslations("admin");
  const params = await searchParams;

  const one = (value: string | string[] | undefined): string | undefined =>
    Array.isArray(value) ? value[0] : value;

  // Parsed, never cast (security.md #6). A bad search param falls back to the
  // default page rather than 500ing a read-only screen.
  const parsed = emailDeliveryFilterSchema.safeParse({
    status: one(params.status),
    templateKey: one(params.template),
    q: one(params.q),
    cursor: one(params.cursor),
    ...(one(params.test) === undefined ? {} : { isTest: one(params.test) === "1" }),
  });
  const filter = parsed.success ? parsed.data : emailDeliveryFilterSchema.parse({});

  const [page, counts] = await Promise.all([listEmailDeliveries(filter), countEmailDeliveries()]);

  const labels: DeliveryLogLabels = {
    search: t("email.searchRecipient"),
    columns: t("columns"),
    export: t("export"),
    selectedSuffix: t("selectedCount"),
    pageWord: t("pageWord"),
    ofWord: t("ofWord"),
    previous: t("previous"),
    next: t("next"),
    noResults: t("noResults"),
    timeCol: t("email.columnSent"),
    templateCol: t("email.columnTemplate"),
    recipientCol: t("emailCol"),
    statusCol: t("email.columnStatus"),
    reasonCol: t("email.columnReason"),
    actionsCol: t("actionsCol"),
    statusSent: t("email.statusSent"),
    statusFailed: t("email.statusFailed"),
    statusSuppressed: t("email.statusSuppressed"),
    testBadge: t("email.testBadge"),
    allStatuses: t("email.filterAllStatuses"),
    statusLabel: t("email.filterStatus"),
    allTemplates: t("email.filterAllTemplates"),
    templateLabel: t("email.filterTemplate"),
    emptyTitle: t("email.logEmpty"),
    emptyBody: t("email.logEmptyBody"),
    clear: t("email.clearFilters"),
    loadMore: t("email.loadMore"),
  };

  return (
    <>
      <p className="text-sm text-muted-foreground">{t("email.logDescription")}</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard label={t("email.statusSent")} value={String(counts.sent)} />
        <MetricCard label={t("email.statusFailed")} value={String(counts.failed)} />
        <MetricCard label={t("email.statusSuppressed")} value={String(counts.suppressed)} />
      </div>

      <DeliveryLogTable
        rows={page.items.map((row) => ({
          id: row.id,
          templateKey: row.templateKey,
          to: row.to,
          locale: row.locale,
          subject: row.subject,
          status: row.status,
          reason: row.reason,
          isTest: row.isTest,
          sentAtLabel: formatDateTime(row.createdAt),
        }))}
        nextCursor={page.nextCursor}
        templates={EMAIL_TEMPLATE_KEYS.map((key) => ({
          value: key,
          // ADR-044 #5 — a registry key never renders raw.
          label: humanizeKey(key.replace(".", " ")),
        }))}
        labels={labels}
      />
    </>
  );
}

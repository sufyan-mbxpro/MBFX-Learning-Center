import { getTranslations } from "next-intl/server";
import { NEWSLETTER_SOURCES, subscriberFilterSchema } from "@repo/contracts";
import { countSubscribers, listSubscribers } from "@repo/core";
import { can, requirePermission } from "@repo/rbac";
import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/alert";
import { MetricCard } from "@repo/ui/components/metric-card";
import { Info } from "lucide-react";
import { getActiveLocales } from "@repo/i18n";
import { formatDate, humanizeKey } from "@repo/utils";
import { AdminPage } from "../_components/admin-page.tsx";
import { SubscribersTable, type SubscribersLabels } from "./subscribers-table.tsx";

// Newsletter subscribers (Module 17, ADR-080 #7).
//
// **A list, not a CRM.** It lists, filters, exports and erases, and it says
// out loud that it cannot send — ADR-080 #8 puts campaigns behind the
// changes-12 worker, and a disabled "Compose" button would promise a screen
// that does not exist.
//
// **Filters are URL state, not client state**, for the delivery log's reason:
// the list pages by keyset cursor, so filtering has to be a REQUEST. A client
// predicate over one page would narrow 50 rows and call the result "no
// subscribers".
export default async function NewsletterPage({ searchParams }: PageProps<"/keystone/newsletter">) {
  const subject = await requirePermission("newsletter.view");
  const t = await getTranslations("admin");
  const params = await searchParams;

  const one = (value: string | string[] | undefined): string | undefined =>
    Array.isArray(value) ? value[0] : value;

  // Parsed, never cast (security.md #6). A bad search param falls back to the
  // default page rather than 500ing a read-only screen.
  const parsed = subscriberFilterSchema.safeParse({
    status: one(params.status),
    source: one(params.source),
    q: one(params.q),
    cursor: one(params.cursor),
  });
  const filter = parsed.success ? parsed.data : subscriberFilterSchema.parse({});

  const [page, counts, locales] = await Promise.all([
    listSubscribers(filter),
    countSubscribers(),
    getActiveLocales(),
  ]);

  // The row actions and the export are separate privileges, and the table is
  // told which it has rather than discovering it by a failed action. The
  // actions re-check server-side regardless (security.md #1) — a hidden
  // button is not security.
  const canManage = can(subject, "newsletter.manage");
  const canExport = can(subject, "newsletter.export");

  const labels: SubscribersLabels = {
    search: t("newsletterSearch"),
    columns: t("columns"),
    export: t("export"),
    selectedSuffix: t("selectedCount"),
    pageWord: t("pageWord"),
    ofWord: t("ofWord"),
    previous: t("previous"),
    next: t("next"),
    noResults: t("noResults"),
    emailCol: t("newsletterColumnEmail"),
    statusCol: t("newsletterColumnStatus"),
    sourceCol: t("newsletterColumnSource"),
    localeCol: t("newsletterColumnLocale"),
    accountCol: t("newsletterColumnAccount"),
    signedUpCol: t("newsletterColumnSignedUp"),
    actionsCol: t("actionsCol"),
    accountLinked: t("newsletterAccountLinked"),
    accountNone: t("newsletterAccountNone"),
    statusActive: t("newsletterActive"),
    statusPending: t("newsletterPending"),
    statusUnsubscribed: t("newsletterUnsubscribed"),
    statusLabel: t("newsletterStatus"),
    allStatuses: t("newsletterStatusAll"),
    sourceLabel: t("newsletterSource"),
    allSources: t("newsletterSourceAll"),
    clear: t("email.clearFilters"),
    loadMore: t("newsletterLoadMore"),
    emptyTitle: t("newsletterEmpty"),
    emptyBody: t("newsletterEmptyDescription"),
    emptyFilteredTitle: t("newsletterEmptyFiltered"),
    emptyFilteredBody: t("newsletterEmptyFilteredDescription"),
    exportCsv: t("newsletterExport"),
    unsubscribeAction: t("newsletterUnsubscribeAction"),
    unsubscribeTitle: t("newsletterUnsubscribeTitle"),
    unsubscribeBody: t("newsletterUnsubscribeBody"),
    unsubscribeConfirm: t("newsletterUnsubscribeConfirm"),
    unsubscribedToast: t("newsletterUnsubscribedToast"),
    deleteAction: t("newsletterDeleteAction"),
    deleteTitle: t("newsletterDeleteTitle"),
    deleteBody: t("newsletterDeleteBody"),
    deleteConfirm: t("newsletterDeleteConfirm"),
    deletedToast: t("newsletterDeletedToast"),
    resubscribeAction: t("newsletterResubscribeAction"),
    restoredToast: t("newsletterRestoredToast"),
    invitedToast: t("newsletterInvitedToast"),
    addAction: t("newsletterAddAction"),
    addTitle: t("newsletterAddTitle"),
    addDescription: t("newsletterAddDescription"),
    addEmail: t("newsletterAddEmail"),
    addLocale: t("newsletterAddLocale"),
    addSubmit: t("newsletterAddSubmit"),
    alreadyActiveToast: t("newsletterAlreadyActiveToast"),
    cancel: t("cancel"),
    saveFailed: t("saveFailed"),
  };

  return (
    <AdminPage title={t("newsletter")} description={t("newsletterDescription")}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard label={t("newsletterActive")} value={String(counts.active)} />
        <MetricCard label={t("newsletterPending")} value={String(counts.pending)} />
        <MetricCard label={t("newsletterUnsubscribed")} value={String(counts.unsubscribed)} />
      </div>

      {/* ADR-080 #8, said rather than implied. Signup, confirmation and
          unsubscribe all work; composing and sending needs the background
          worker, and leaving that unexplained invites someone to look for a
          Compose button that was never built. */}
      <Alert variant="info">
        <Info aria-hidden />
        <AlertTitle>{t("newsletterNoCampaigns")}</AlertTitle>
        <AlertDescription>{t("newsletterNoCampaignsDescription")}</AlertDescription>
      </Alert>

      <SubscribersTable
        rows={page.items.map((row) => ({
          id: row.id,
          email: row.email,
          status: row.status,
          source: row.source,
          locale: row.locale,
          hasAccount: row.userId !== null,
          createdAtLabel: formatDate(row.createdAt),
        }))}
        nextCursor={page.nextCursor}
        sources={NEWSLETTER_SOURCES.map((value) => ({
          // ADR-044 #5 — a registry key never renders raw. The two sources
          // that are not a placement (ADR-124) say what they mean; a placement
          // name already does.
          value,
          label:
            value === "signup"
              ? t("newsletterSourceSignup")
              : value === "admin"
                ? t("newsletterSourceAdmin")
                : humanizeKey(value),
        }))}
        locales={locales.map((l) => ({ value: l.code, label: `${l.name} (${l.nativeName})` }))}
        canManage={canManage}
        canExport={canExport}
        labels={labels}
      />
    </AdminPage>
  );
}

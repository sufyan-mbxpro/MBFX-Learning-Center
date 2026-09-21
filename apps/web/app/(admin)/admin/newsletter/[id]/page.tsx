import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import {
  CalendarCheck,
  CalendarPlus,
  Inbox,
  Languages,
  Mail,
  MailX,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { loadSubscriberDetail } from "@repo/core";
import { can, requirePermission } from "@repo/rbac";
import { Badge } from "@repo/ui/components/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui/components/tabs";
import { formatDate, formatDateTime, humanizeKey } from "@repo/utils";
import { AdminPage } from "../../_components/admin-page.tsx";
import {
  RecordCard,
  RecordEmpty,
  RecordFacts,
  RecordStat,
  RecordStats,
} from "../../_components/record-page.tsx";
import { StatusBadge, type StatusTone } from "../../_components/status-badge.tsx";
import { SubscriberActions } from "./subscriber-actions.tsx";

const STATUS_TONE: Record<string, StatusTone> = {
  ACTIVE: "success",
  PENDING: "warning",
  UNSUBSCRIBED: "neutral",
};

// The subscriber record (changes-45): the user record's shape — heading,
// figures, then tabs — for one consent row. It shows the consent, not the
// person: the linked account is a LINK to that account's own record, and only
// for a viewer who may open user records (the list's own reasoning, ADR-080
// #6, that a consent list must not become a user directory).
//
// The delivery tab reads the email log, which has its own key
// (`email.log.view`); without it the tab is absent and the query never runs.
export default async function SubscriberDetailPage({
  params,
}: PageProps<"/admin/newsletter/[id]">) {
  const subject = await requirePermission("newsletter.view");
  const { id } = await params;
  const canSeeDeliveries = can(subject, "email.log.view");

  const [t, r, subscriber] = await Promise.all([
    getTranslations("admin"),
    getTranslations("admin.subscriberRecord"),
    loadSubscriberDetail(id, { withDeliveries: canSeeDeliveries }),
  ]);
  if (!subscriber) notFound();

  const statusLabel: Record<string, string> = {
    ACTIVE: t("newsletterActive"),
    PENDING: t("newsletterPending"),
    UNSUBSCRIBED: t("newsletterUnsubscribed"),
  };
  const sourceLabel =
    subscriber.source === "signup"
      ? t("newsletterSourceSignup")
      : subscriber.source === "admin"
        ? t("newsletterSourceAdmin")
        : humanizeKey(subscriber.source);
  const status = (
    <StatusBadge tone={STATUS_TONE[subscriber.status] ?? "neutral"}>
      {statusLabel[subscriber.status] ?? subscriber.status}
    </StatusBadge>
  );

  return (
    <AdminPage
      title={subscriber.email}
      description={`${r("subscriberId")}: ${subscriber.id}`}
      backHref="/admin/newsletter"
      backLabel={t("backToList")}
      meta={
        <>
          <Badge variant="outline">{r("subscriber")}</Badge>
          {status}
        </>
      }
      actions={
        can(subject, "newsletter.manage") ? (
          <SubscriberActions
            id={subscriber.id}
            unsubscribed={subscriber.status === "UNSUBSCRIBED"}
            labels={{
              unsubscribe: t("newsletterUnsubscribeAction"),
              unsubscribeTitle: t("newsletterUnsubscribeTitle"),
              unsubscribeBody: t("newsletterUnsubscribeBody"),
              unsubscribeConfirm: t("newsletterUnsubscribeConfirm"),
              unsubscribed: t("newsletterUnsubscribedToast"),
              resubscribe: t("newsletterResubscribeAction"),
              restored: t("newsletterRestoredToast"),
              invited: t("newsletterInvitedToast"),
              remove: t("newsletterDeleteAction"),
              deleteTitle: t("newsletterDeleteTitle"),
              deleteBody: t("newsletterDeleteBody"),
              deleteConfirm: t("newsletterDeleteConfirm"),
              deleted: t("newsletterDeletedToast"),
              cancel: t("cancel"),
            }}
          />
        ) : undefined
      }
    >
      <RecordStats>
        <RecordStat icon={Inbox} label={t("newsletterStatus")} value={status} />
        <RecordStat icon={Mail} label={t("newsletterSource")} value={sourceLabel} />
        <RecordStat
          icon={CalendarPlus}
          label={r("signedUp")}
          value={formatDate(subscriber.createdAt)}
        />
        <RecordStat
          icon={CalendarCheck}
          label={r("confirmed")}
          value={subscriber.confirmedAt ? formatDate(subscriber.confirmedAt) : "—"}
        />
      </RecordStats>

      <Tabs defaultValue="details">
        <TabsList className="w-full">
          <TabsTrigger value="details">
            <UserRound aria-hidden /> {r("tabDetails")}
          </TabsTrigger>
          {canSeeDeliveries && (
            <TabsTrigger value="deliveries">
              <Mail aria-hidden /> {r("tabDeliveries")}
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="details" className="pt-4">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <RecordCard icon={Mail} title={r("consentTitle")} description={r("consentDescription")}>
              <RecordFacts
                facts={[
                  { label: t("newsletterColumnEmail"), value: subscriber.email },
                  { label: t("newsletterStatus"), value: status },
                  { label: t("newsletterSource"), value: sourceLabel },
                  {
                    label: t("newsletterColumnLocale"),
                    value: (
                      <span className="flex items-center gap-1.5">
                        <Languages aria-hidden className="size-4 text-muted-foreground" />
                        {subscriber.locale.toUpperCase()}
                      </span>
                    ),
                  },
                  {
                    label: r("subscriberId"),
                    value: <span className="text-xs">{subscriber.id}</span>,
                  },
                ]}
              />
            </RecordCard>

            <RecordCard
              icon={ShieldCheck}
              title={r("historyTitle")}
              description={r("historyDescription")}
            >
              <RecordFacts
                facts={[
                  { label: r("signedUp"), value: formatDateTime(subscriber.createdAt) },
                  {
                    label: r("confirmed"),
                    value: subscriber.confirmedAt ? formatDateTime(subscriber.confirmedAt) : null,
                  },
                  {
                    label: r("lastConfirmSent"),
                    value: subscriber.lastConfirmSentAt
                      ? formatDateTime(subscriber.lastConfirmSentAt)
                      : null,
                  },
                  {
                    label: r("unsubscribedAt"),
                    value: subscriber.unsubscribedAt ? (
                      <span className="flex flex-wrap items-center gap-2">
                        <MailX aria-hidden className="size-4 text-muted-foreground" />
                        {formatDateTime(subscriber.unsubscribedAt)}
                        <span className="text-xs font-normal text-muted-foreground">
                          {subscriber.unsubscribedVia === "admin"
                            ? r("byAdmin")
                            : r("bySubscriber")}
                        </span>
                      </span>
                    ) : null,
                  },
                  {
                    label: t("newsletterColumnAccount"),
                    value: subscriber.account ? (
                      can(subject, "users.view") ? (
                        <Link
                          href={`/admin/users/${subscriber.account.id}`}
                          className="text-primary-interactive underline-offset-4 hover:underline"
                        >
                          {subscriber.account.name}
                        </Link>
                      ) : (
                        t("newsletterAccountLinked")
                      )
                    ) : (
                      t("newsletterAccountNone")
                    ),
                  },
                  { label: r("updated"), value: formatDateTime(subscriber.updatedAt) },
                ]}
              />
            </RecordCard>
          </div>
        </TabsContent>

        {canSeeDeliveries && (
          <TabsContent value="deliveries" className="pt-4">
            <RecordCard
              icon={Mail}
              title={r("tabDeliveries")}
              description={r("deliveriesDescription")}
            >
              {subscriber.deliveries.length === 0 ? (
                <RecordEmpty>{r("deliveriesEmpty")}</RecordEmpty>
              ) : (
                <RecordFacts
                  facts={subscriber.deliveries.map((delivery) => ({
                    id: delivery.id,
                    label: delivery.subject,
                    value: (
                      <span className="flex flex-wrap items-center gap-2">
                        <Badge variant={delivery.status === "SENT" ? "success" : "secondary"}>
                          {humanizeKey(delivery.status.toLowerCase())}
                        </Badge>
                        <span className="text-xs font-normal text-muted-foreground">
                          {formatDateTime(delivery.createdAt)}
                        </span>
                      </span>
                    ),
                  }))}
                />
              )}
            </RecordCard>
          </TabsContent>
        )}
      </Tabs>
    </AdminPage>
  );
}

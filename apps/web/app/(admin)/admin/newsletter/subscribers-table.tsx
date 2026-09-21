"use client";

// The subscriber list (ADR-080 #7).
//
// **Not `useClientTable`**, for the delivery log's reason: the list grows
// without bound and arrives one keyset page at a time, so a filter has to be a
// REQUEST rather than a predicate over the page in hand — otherwise filtering
// 50 rows to none reads as "no subscribers". "Load more" follows `nextCursor`
// because a keyset cursor cannot say how many pages are behind it.
//
// **Two row actions, and the destructive one is not the obvious one.**
// Unsubscribe is reversible and is what an admin almost always wants; Delete
// is a HARD erase, because an erasure request is not satisfied by a
// `deletedAt` (ADR-080 #7). Both confirm (ADR-044 #7), and the delete's
// description says which of the two the reader is about to do.
//
// **Resubscribe is the third, and it does not confirm** (ADR-124,
// code-style #7): restore is the undo, and gating it makes the destructive
// path harder to reverse. It replaces Unsubscribe on an unsubscribed row
// rather than sitting beside a disabled copy of it. **Add subscriber** lives
// in the table's own toolbar (ADR-106) and invites through double opt-in.
import * as React from "react";
import Link from "next/link";
import { MailX, MoreHorizontal, Plus, Trash2, UserMinus, UserPlus } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { adminAddSubscriberSchema } from "@repo/contracts";
import { Button } from "@repo/ui/components/button";
import { ConfirmDialog } from "@repo/ui/components/confirm-dialog";
import { DataTable, type DataTableLabels } from "@repo/ui/components/data-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@repo/ui/components/empty";
import { Field, FieldError, FieldGroup, FieldLabel } from "@repo/ui/components/field";
import { FilterBarRow } from "@repo/ui/components/filter-bar";
import { Input } from "@repo/ui/components/input";
import { useSearchParams } from "next/navigation";
import {
  addSubscriberAction,
  deleteSubscriberAction,
  resubscribeSubscriberAction,
  unsubscribeSubscriberAction,
} from "../_actions/newsletter-actions.ts";
import { AdminCombobox } from "../_components/combobox.tsx";
import { StatusBadge, type StatusTone } from "../_components/status-badge.tsx";
import { useFieldErrors } from "../_hooks/use-field-errors.ts";
import { useServerAction } from "../_hooks/use-server-action.ts";
import { useUrlFilters, useUrlFiltersPending } from "../_hooks/use-url-filters.ts";
import { HeaderActions } from "../_components/header-actions.tsx";

export interface SubscriberTableRow {
  id: string;
  email: string;
  status: string;
  source: string;
  locale: string;
  hasAccount: boolean;
  createdAtLabel: string;
}

export interface SubscribersLabels {
  search: string;
  columns: string;
  export: string;
  selectedSuffix: string;
  pageWord: string;
  ofWord: string;
  previous: string;
  next: string;
  noResults: string;
  emailCol: string;
  statusCol: string;
  sourceCol: string;
  localeCol: string;
  accountCol: string;
  signedUpCol: string;
  actionsCol: string;
  accountLinked: string;
  accountNone: string;
  statusActive: string;
  statusPending: string;
  statusUnsubscribed: string;
  statusLabel: string;
  allStatuses: string;
  sourceLabel: string;
  allSources: string;
  clear: string;
  loadMore: string;
  emptyTitle: string;
  emptyBody: string;
  emptyFilteredTitle: string;
  emptyFilteredBody: string;
  exportCsv: string;
  unsubscribeAction: string;
  unsubscribeTitle: string;
  unsubscribeBody: string;
  unsubscribeConfirm: string;
  unsubscribedToast: string;
  deleteAction: string;
  deleteTitle: string;
  deleteBody: string;
  deleteConfirm: string;
  deletedToast: string;
  resubscribeAction: string;
  restoredToast: string;
  invitedToast: string;
  addAction: string;
  addTitle: string;
  addDescription: string;
  addEmail: string;
  addLocale: string;
  addSubmit: string;
  alreadyActiveToast: string;
  cancel: string;
  saveFailed: string;
}

export interface SubscriberLocaleOption {
  value: string;
  label: string;
}

/** The table's controlled props it does not get to drive here. */
const EMPTY_SORTING: never[] = [];
const noop = () => {};

const STATUS_TONE: Record<string, StatusTone> = {
  ACTIVE: "success",
  // PENDING is not a failure — it is double opt-in working — so it is a
  // waiting tone rather than a destructive one.
  PENDING: "warning",
  UNSUBSCRIBED: "neutral",
};

function RowActions({ row, labels }: { row: SubscriberTableRow; labels: SubscribersLabels }) {
  const { run } = useServerAction();
  const [confirmUnsubscribe, setConfirmUnsubscribe] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon" aria-label={labels.actionsCol}>
              <MoreHorizontal aria-hidden />
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          {row.status === "UNSUBSCRIBED" ? (
            // The undo, so no ConfirmDialog. Core decides whether this
            // restores the row or sends a fresh confirmation, and says which.
            <DropdownMenuItem
              onClick={() =>
                run(async () => {
                  const result = await resubscribeSubscriberAction({ id: row.id });
                  if (result === "restored") toast.success(labels.restoredToast);
                  else if (result === "invited") toast.success(labels.invitedToast);
                })
              }
            >
              <UserPlus aria-hidden />
              {labels.resubscribeAction}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => setConfirmUnsubscribe(true)}>
              <UserMinus aria-hidden />
              {labels.unsubscribeAction}
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => setConfirmDelete(true)}>
            <Trash2 aria-hidden />
            {labels.deleteAction}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={confirmUnsubscribe}
        onOpenChange={setConfirmUnsubscribe}
        title={labels.unsubscribeTitle}
        description={labels.unsubscribeBody}
        confirmLabel={labels.unsubscribeConfirm}
        cancelLabel={labels.cancel}
        onConfirm={() =>
          run(() => unsubscribeSubscriberAction({ id: row.id }), {
            successMessage: labels.unsubscribedToast,
            onDone: () => setConfirmUnsubscribe(false),
          })
        }
      />

      {/* `destructive` on this one only. The erase has no undo — that is what
          an erasure request means — and the description says so rather than
          leaving the two actions looking interchangeable. */}
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={labels.deleteTitle}
        description={labels.deleteBody}
        confirmLabel={labels.deleteConfirm}
        cancelLabel={labels.cancel}
        destructive
        onConfirm={() =>
          run(() => deleteSubscriberAction({ id: row.id }), {
            successMessage: labels.deletedToast,
            onDone: () => setConfirmDelete(false),
          })
        }
      />
    </div>
  );
}

function AddSubscriberDialog({
  open,
  onOpenChange,
  locales,
  labels,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locales: SubscriberLocaleOption[];
  labels: SubscribersLabels;
}) {
  const { run, pending } = useServerAction();
  const [email, setEmail] = React.useState("");
  const [locale, setLocale] = React.useState(locales[0]?.value ?? "en");

  // ADR-077: the action's own schema, so the dialog and the server refuse the
  // same address for the same reason.
  const input = { email, locale };
  const fields = useFieldErrors(adminAddSubscriberSchema, input);

  const changeOpen = (next: boolean) => {
    if (!next) {
      fields.reset();
      setEmail("");
    }
    onOpenChange(next);
  };

  const submit = () => {
    if (!fields.validate()) return;
    run(
      async () => {
        const result = await addSubscriberAction(input);
        if (result === "already_active") toast.info(labels.alreadyActiveToast);
        else if (result === "restored") toast.success(labels.restoredToast);
        else toast.success(labels.invitedToast);
      },
      { onDone: () => changeOpen(false) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{labels.addTitle}</DialogTitle>
          <DialogDescription>{labels.addDescription}</DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field invalid={fields.invalid("email")} required>
            <FieldLabel>{labels.addEmail}</FieldLabel>
            <Input
              type="email"
              autoComplete="off"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") submit();
              }}
            />
            <FieldError>{fields.error("email")}</FieldError>
          </Field>
          {/* One active locale today (ADR-007), so this is usually a single
              choice. It stays because the confirmation email is written in it,
              and a second locale going live should not need a change here. */}
          <Field invalid={fields.invalid("locale")} required>
            <FieldLabel>{labels.addLocale}</FieldLabel>
            <AdminCombobox
              value={locale}
              onValueChange={(next) => setLocale(next || locale)}
              options={locales}
            />
            <FieldError>{fields.error("locale")}</FieldError>
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => changeOpen(false)} disabled={pending}>
            {labels.cancel}
          </Button>
          {/* Enabled while empty: pressing it names the field (ADR-077). */}
          <Button onClick={submit} loading={pending}>
            {labels.addSubmit}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SubscribersTable({
  rows,
  nextCursor,
  sources,
  locales,
  canManage,
  canExport,
  labels,
}: {
  rows: SubscriberTableRow[];
  nextCursor: string | null;
  sources: { value: string; label: string }[];
  locales: SubscriberLocaleOption[];
  canManage: boolean;
  canExport: boolean;
  labels: SubscribersLabels;
}) {
  const [addOpen, setAddOpen] = React.useState(false);
  const setParams = useUrlFilters();
  const pending = useUrlFiltersPending();
  const params = useSearchParams();
  const status = params.get("status") ?? "";
  const source = params.get("source") ?? "";
  const query = params.get("q") ?? "";
  const filtered = Boolean(status || source || query);

  const statusLabel = React.useCallback(
    (value: string) =>
      value === "ACTIVE"
        ? labels.statusActive
        : value === "PENDING"
          ? labels.statusPending
          : labels.statusUnsubscribed,
    [labels],
  );

  const columns = React.useMemo<ColumnDef<SubscriberTableRow>[]>(() => {
    const base: ColumnDef<SubscriberTableRow>[] = [
      {
        id: "email",
        header: labels.emailCol,
        meta: { label: labels.emailCol },
        enableHiding: false,
        // The address opens the subscriber's record (changes-45), the way a
        // name opens a user's.
        cell: ({ row }) => (
          <Link
            href={`/admin/newsletter/${row.original.id}`}
            className="block max-w-80 truncate font-medium hover:text-primary-interactive hover:underline"
          >
            {row.original.email}
          </Link>
        ),
      },
      {
        id: "status",
        header: labels.statusCol,
        meta: { label: labels.statusCol },
        cell: ({ row }) => (
          <StatusBadge tone={STATUS_TONE[row.original.status] ?? "neutral"}>
            {statusLabel(row.original.status)}
          </StatusBadge>
        ),
      },
      {
        id: "source",
        header: labels.sourceCol,
        meta: { label: labels.sourceCol },
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {sources.find((entry) => entry.value === row.original.source)?.label ??
              row.original.source}
          </span>
        ),
      },
      {
        id: "locale",
        header: labels.localeCol,
        meta: { label: labels.localeCol },
        cell: ({ row }) => (
          <span className="text-3xs text-muted-foreground uppercase">{row.original.locale}</span>
        ),
      },
      {
        id: "account",
        header: labels.accountCol,
        meta: { label: labels.accountCol },
        // Whether the consent is linked to a user, not WHICH user: the link
        // exists for erasure and future audience filtering (ADR-080 #6), and
        // a name here would turn a consent list into a user directory.
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {row.original.hasAccount ? labels.accountLinked : labels.accountNone}
          </span>
        ),
      },
      {
        id: "signedUp",
        header: labels.signedUpCol,
        meta: { label: labels.signedUpCol },
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-muted-foreground">
            {row.original.createdAtLabel}
          </span>
        ),
      },
    ];

    if (canManage) {
      base.push({
        id: "actions",
        header: () => <span className="sr-only">{labels.actionsCol}</span>,
        meta: { label: labels.actionsCol },
        enableHiding: false,
        cell: ({ row }) => <RowActions row={row.original} labels={labels} />,
      });
    }
    return base;
  }, [labels, sources, statusLabel, canManage]);

  const tableLabels: DataTableLabels = {
    search: labels.search,
    columns: labels.columns,
    export: labels.export,
    selectedCount: (n) => `${n} ${labels.selectedSuffix}`,
    page: (p, c) => `${labels.pageWord} ${p} ${labels.ofWord} ${c}`,
    previous: labels.previous,
    next: labels.next,
    noResults: labels.noResults,
  };

  // Filters sit in the table's own toolbar beside its search box
  // (code-style #9), each declaring its width — which is how a toolbar filter
  // says it is not a form field (ADR-057).
  const filters = (
    <FilterBarRow>
      <AdminCombobox
        aria-label={labels.statusLabel}
        className="w-44"
        value={status}
        onValueChange={(value) => setParams({ status: value, cursor: null })}
        options={[
          { value: "", label: labels.allStatuses },
          { value: "ACTIVE", label: labels.statusActive },
          { value: "PENDING", label: labels.statusPending },
          { value: "UNSUBSCRIBED", label: labels.statusUnsubscribed },
        ]}
      />
      <AdminCombobox
        aria-label={labels.sourceLabel}
        className="w-40"
        value={source}
        onValueChange={(value) => setParams({ source: value, cursor: null })}
        options={[{ value: "", label: labels.allSources }, ...sources]}
      />
      {filtered && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setParams({ status: null, source: null, q: null, cursor: null })}
        >
          {labels.clear}
        </Button>
      )}
      {canExport && (
        // A real link, not an action: the export streams, and a server action
        // would have to buffer the whole CSV into a response value to hand it
        // back. The href carries the CURRENT filters, so "export" means "what
        // I am looking at".
        <Button
          variant="outline"
          size="sm"
          render={<a href={`/admin/api/newsletter/export?${params.toString()}`} />}
        >
          {labels.exportCsv}
        </Button>
      )}
    </FilterBarRow>
  );

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {/* The table renders even with no rows, because the filters live in its
          toolbar: an empty state that replaced the table would take the search
          box with it, leaving whoever filtered to nothing no way back. */}
      {/* ADR-140 §3: the primary action sits on the page heading's row, not in
          the table toolbar; the dialog it opens stays owned here. Absent, not
          disabled, without `newsletter.manage`; the action re-checks anyway. */}
      {canManage && (
        <HeaderActions>
          <Button onClick={() => setAddOpen(true)}>
            <Plus data-icon="inline-start" aria-hidden /> {labels.addAction}
          </Button>
        </HeaderActions>
      )}
      <DataTable
        pending={pending}
        data={rows}
        columns={columns}
        labels={tableLabels}
        // One server page, already filtered and ordered by the service.
        pageCount={1}
        pagination={{ pageIndex: 0, pageSize: Math.max(rows.length, 1) }}
        onPaginationChange={noop}
        sorting={EMPTY_SORTING}
        onSortingChange={noop}
        globalFilter={query}
        onGlobalFilterChange={(value) => setParams({ q: value, cursor: null })}
        filters={filters}
        emptyState={
          <Empty>
            <EmptyMedia>
              <MailX aria-hidden />
            </EmptyMedia>
            {/* Two empty states, because they call for different actions: an
                empty LIST is waiting for a first signup, an empty FILTER is
                waiting for the reader to widen it. */}
            <EmptyTitle>{filtered ? labels.emptyFilteredTitle : labels.emptyTitle}</EmptyTitle>
            <EmptyDescription>
              {filtered ? labels.emptyFilteredBody : labels.emptyBody}
            </EmptyDescription>
          </Empty>
        }
      />
      {canManage && (
        <AddSubscriberDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          locales={locales}
          labels={labels}
        />
      )}
      {nextCursor && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => setParams({ cursor: nextCursor })}>
            {labels.loadMore}
          </Button>
        </div>
      )}
    </div>
  );
}

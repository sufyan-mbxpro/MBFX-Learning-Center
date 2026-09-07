"use client";

// A plain table, not the full DataTable — Phase 1's list has no sorting/
// column-visibility requirement (plan §12 PR 1.5 scope), and the shipped
// `Table` primitives already give the right row/hover/border treatment.
// Upgradeable to DataTable later without changing the server component
// above it (same `rows` shape either way).
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { ConfirmDialog } from "@repo/ui/components/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { Empty, EmptyDescription, EmptyTitle } from "@repo/ui/components/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table";
import { duplicatePageAction, setPageDeletedAction } from "../../_actions/cms-page-actions.ts";
import { StatusBadge, statusTone, ARTICLE_STATUS_TONE } from "../../_components/status-badge.tsx";
import { useServerAction } from "../../_hooks/use-server-action.ts";

export interface PageRow {
  id: string;
  title: string | null;
  path: string | null;
  status: string;
  isActive: boolean;
  hasUnpublishedChanges: boolean;
}

export interface PagesTableLabels {
  titleLabel: string;
  pagePath: string;
  statusLabel: string;
  activeLabel: string;
  actionsCol: string;
  untitled: string;
  edit: string;
  duplicate: string;
  softDelete: string;
  restore: string;
  deleted: string;
  noResults: string;
  noResultsHint: string;
  confirmDeleteTitle: string;
  confirmDeleteBody: string;
  confirm: string;
  cancel: string;
  publishedBadge: string;
  draftBadge: string;
  unpublishedChangesBadge: string;
  statusDraft: string;
  statusPublished: string;
}

function RowActions({
  row,
  canDelete,
  labels,
}: {
  row: PageRow;
  canDelete: boolean;
  labels: PagesTableLabels;
}) {
  const router = useRouter();
  const { run, pending } = useServerAction();
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon-sm" disabled={pending}>
              <MoreHorizontal aria-hidden />
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            render={<Link href={`/admin/website/pages/${row.id}`}>{labels.edit}</Link>}
          />
          <DropdownMenuItem
            onClick={() =>
              run(async () => {
                const id = await duplicatePageAction(row.id);
                router.push(`/admin/website/pages/${id}`);
              })
            }
          >
            {labels.duplicate}
          </DropdownMenuItem>
          {canDelete && <DropdownMenuSeparator />}
          {canDelete && (
            <DropdownMenuItem variant="destructive" onClick={() => setConfirmOpen(true)}>
              {labels.softDelete}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={labels.confirmDeleteTitle}
        description={labels.confirmDeleteBody}
        confirmLabel={labels.confirm}
        cancelLabel={labels.cancel}
        onConfirm={() => run(() => setPageDeletedAction(row.id, true))}
      />
    </div>
  );
}

export function PagesTable({
  rows,
  canDelete,
  labels,
}: {
  rows: PageRow[];
  canDelete: boolean;
  labels: PagesTableLabels;
}) {
  if (rows.length === 0) {
    return (
      <Empty className="border">
        <EmptyTitle>{labels.noResults}</EmptyTitle>
        <EmptyDescription>{labels.noResultsHint}</EmptyDescription>
      </Empty>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{labels.titleLabel}</TableHead>
          <TableHead>{labels.pagePath}</TableHead>
          <TableHead>{labels.statusLabel}</TableHead>
          <TableHead className="text-end">
            <span className="sr-only">{labels.actionsCol}</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell>
              <Link href={`/admin/website/pages/${row.id}`} className="font-medium hover:underline">
                {row.title ?? labels.untitled}
              </Link>
            </TableCell>
            <TableCell>
              <code className="text-xs text-muted-foreground">{row.path ?? "—"}</code>
            </TableCell>
            <TableCell>
              <div className="flex flex-wrap items-center gap-1.5">
                <StatusBadge tone={statusTone(ARTICLE_STATUS_TONE, row.status)}>
                  {row.status === "PUBLISHED" ? labels.statusPublished : labels.statusDraft}
                </StatusBadge>
                {row.hasUnpublishedChanges && (
                  <Badge variant="outline" className="text-xs">
                    {labels.unpublishedChangesBadge}
                  </Badge>
                )}
                {!row.isActive && (
                  <Badge variant="secondary" className="text-xs">
                    {labels.deleted}
                  </Badge>
                )}
              </div>
            </TableCell>
            <TableCell className="text-end">
              <RowActions row={row} canDelete={canDelete} labels={labels} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

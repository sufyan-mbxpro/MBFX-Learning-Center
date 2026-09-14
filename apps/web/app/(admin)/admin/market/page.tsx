import { getTranslations } from "next-intl/server";
import { Settings2 } from "lucide-react";
import Link from "next/link";
import { listInstruments } from "@repo/core";
import { can, requirePermission } from "@repo/rbac";
import { Button } from "@repo/ui/components/button";
import { AdminPage } from "../_components/admin-page.tsx";
import { InstrumentsTable, type InstrumentsTableLabels } from "./instruments-table.tsx";
import { NewInstrumentButton } from "./new-instrument-button.tsx";

// Instruments (Module 13, ADR-087 #1).
//
// One table with a `kind`, not two — the converter reads `CURRENCY`, the pip
// and position calculators read `PAIR`, and correlation and the risk meter
// read the rest. A second `MarketCurrency` table would have needed its own
// screen to say the same thing.
//
// **Adding an instrument is a row, not a deploy.** That is the owner's B4
// ("things like currency pairs must be admin-controlled") answered literally:
// the only part of an instrument that is code is the `kind` enum.
export default async function MarketPage() {
  const subject = await requirePermission("market.view");
  const t = await getTranslations("admin");

  const instruments = await listInstruments();

  // The row actions re-check server-side regardless (security.md #1) — a
  // hidden menu is not security, it is only an honest screen.
  const canManage = can(subject, "market.instruments.manage");
  const canManageProvider = can(subject, "market.providers.manage");

  const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium" });

  const labels: InstrumentsTableLabels = {
    search: t("marketSearch"),
    columns: t("columns"),
    export: t("export"),
    selectedSuffix: t("selectedCount"),
    pageWord: t("pageWord"),
    ofWord: t("ofWord"),
    previous: t("previous"),
    next: t("next"),
    noResults: t("noResults"),
    symbolCol: t("marketData.symbolCol"),
    kindCol: t("marketData.kindCol"),
    dataCol: t("marketData.dataCol"),
    statusCol: t("marketData.statusCol"),
    actionsCol: t("actionsCol"),
    active: t("marketData.active"),
    inactive: t("marketData.inactive"),
    statusLabel: t("marketData.statusLabel"),
    allStatuses: t("marketData.allStatuses"),
    kindLabel: t("marketData.kindLabel"),
    allKinds: t("marketData.allKinds"),
    neverSynced: t("marketData.neverSynced"),
    barsSuffix: t("marketData.barsSuffix"),
    edit: t("edit"),
    activate: t("marketData.activate"),
    deactivate: t("marketData.deactivate"),
    moveUp: t("moveUp"),
    moveDown: t("moveDown"),
    deleteInstrument: t("marketData.deleteInstrument"),
    confirmDeleteTitle: t("marketData.confirmDeleteTitle"),
    confirmDeleteBody: t("marketData.confirmDeleteBody"),
    confirm: t("confirm"),
    cancel: t("cancel"),
    openActions: t("openActions"),
    emptyTitle: t("marketData.emptyTitle"),
    emptyBody: t("marketData.emptyBody"),
    newTitle: t("marketData.newTitle"),
    newDescription: t("marketData.newDescription"),
    editTitle: t("marketData.editTitle"),
    editDescription: t("marketData.editDescription"),
    kindField: t("marketData.kindField"),
    symbolField: t("marketData.symbolField"),
    symbolHint: t("marketData.symbolHint"),
    displayNameField: t("marketData.displayNameField"),
    baseField: t("marketData.baseField"),
    quoteField: t("marketData.quoteField"),
    providerSymbolField: t("marketData.providerSymbolField"),
    providerSymbolHint: t("marketData.providerSymbolHint"),
    pipSizeField: t("marketData.pipSizeField"),
    pipSizeHint: t("marketData.pipSizeHint"),
    decimalsField: t("marketData.decimalsField"),
    activeField: t("marketData.activeField"),
    save: t("save"),
  };

  return (
    <AdminPage
      title={t("marketData.title")}
      description={t("marketData.description")}
      actions={
        <div className="flex items-center gap-2">
          {canManageProvider && (
            <Button variant="outline" render={<Link href="/admin/market/provider" />}>
              <Settings2 aria-hidden data-icon="inline-start" />
              {t("marketData.providerLink")}
            </Button>
          )}
          {canManage && (
            <NewInstrumentButton labels={labels} triggerLabel={t("marketData.newTrigger")} />
          )}
        </div>
      }
    >
      <InstrumentsTable
        rows={instruments.map((row) => ({
          id: row.id,
          kind: row.kind,
          symbol: row.symbol,
          displayName: row.displayName,
          base: row.base,
          quote: row.quote,
          providerSymbol: row.providerSymbol,
          pipSize: row.pipSize,
          decimals: row.decimals,
          isActive: row.isActive,
          sortOrder: row.sortOrder,
          barCount: row.barCount,
          lastBarLabel: row.lastBarDate ? dateFormat.format(row.lastBarDate) : null,
          // The formatted label sorts lexically, which is not chronologically.
          lastBarSort: row.lastBarDate ? row.lastBarDate.getTime() : 0,
          // Derived in the service, not here: Date.now() in a render is an
          // impure call (react-hooks/purity), and a value that changes
          // between two renders of the same props is what a render must not
          // produce.
          staleDays: row.staleDays,
        }))}
        canManage={canManage}
        labels={labels}
      />
    </AdminPage>
  );
}

"use client";

// changes-20 Phase 4 — the design-system specimen board. Every section renders
// its specimens through <Panes>, so the two switches in the header apply
// everywhere at once:
//   · "Show dark mode alongside" repeats each section inside a `.dark` pane
//     (the brand tokens' dark block is scoped to `.dark`, so the pane gets the
//     real dark palette — the admin's own theme, not a mock).
//   · "Right-to-left" sets `dir="rtl"` on the panes, which is all the logical
//     properties need.
// Popups (dialogs, menus, toasts) portal to <body>, so they follow the page's
// mode and direction, not a pane's.
//
// Nothing here is styled by hand beyond layout: every specimen IS the shared
// component. Identifiers (variant, size, token names) are shown through
// humanizeKey (ADR-044 #5); all other text is an `admin.designSystem.*` key.
import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { ColumnDef, PaginationState, SortingState } from "@tanstack/react-table";
import {
  Bell,
  CircleDollarSign,
  Inbox,
  LayoutDashboard,
  Megaphone,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  TrendingUp,
  Users,
} from "lucide-react";

import { humanizeKey } from "@repo/utils";
import { cn } from "@repo/ui/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/alert";
import { Avatar, AvatarFallback } from "@repo/ui/components/avatar";
import { Badge } from "@repo/ui/components/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@repo/ui/components/breadcrumb";
import { Button } from "@repo/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { Checkbox } from "@repo/ui/components/checkbox";
import { ConfirmDialog } from "@repo/ui/components/confirm-dialog";
import { CountBadge } from "@repo/ui/components/count-badge";
import { DataTable, type DataTableLabels } from "@repo/ui/components/data-table";
import {
  Dialog,
  DialogContent,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/ui/components/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyMedia,
  EmptyTitle,
} from "@repo/ui/components/empty";
import { FilterBar, FilterBarItem, FilterBarRow } from "@repo/ui/components/filter-bar";
import { Input } from "@repo/ui/components/input";
import { Kbd, KbdGroup } from "@repo/ui/components/kbd";
import { Label } from "@repo/ui/components/label";
import { MetricCard } from "@repo/ui/components/metric-card";
import { NavItem, NavItemGroup } from "@repo/ui/components/nav-item";
import { PageHeader } from "@repo/ui/components/page-header";
import {
  Pagination,
  PaginationBar,
  PaginationContent,
  PaginationEllipsis,
  PaginationFirst,
  PaginationItem,
  PaginationLast,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@repo/ui/components/pagination";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/ui/components/popover";
import { Progress } from "@repo/ui/components/progress";
import { RadioGroup, RadioGroupItem } from "@repo/ui/components/radio-group";
import { SearchInput } from "@repo/ui/components/search-input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@repo/ui/components/sheet";
import { Switch } from "@repo/ui/components/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui/components/tabs";
import { Textarea } from "@repo/ui/components/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui/components/tooltip";
import {
  MetaText,
  MicroHeading,
  PageDescription,
  PageTitle,
  SectionTitle,
  SectionTitleCompact,
  StatLabel,
  StatValue,
  SubText,
} from "@repo/ui/components/typography";
import { ViewChip, ViewChips } from "@repo/ui/components/view-chips";
import { AdminCombobox } from "../_components/combobox.tsx";

// ─────────────────────────────────────────────────────────────
// Board chrome
// ─────────────────────────────────────────────────────────────

const BoardContext = React.createContext({ compare: false, rtl: false });

/** A section's specimens, in the light pane and (when asked) a dark pane beside it. */
function Panes({ children }: { children: React.ReactNode }) {
  const { compare, rtl } = React.useContext(BoardContext);
  const t = useTranslations("admin.designSystem");
  return (
    <div dir={rtl ? "rtl" : "ltr"} className={cn("grid gap-4", compare && "xl:grid-cols-2")}>
      <div className="flex min-w-0 flex-col gap-3">
        {compare && <MicroHeading>{t("lightPane")}</MicroHeading>}
        <div className="flex flex-col gap-6 rounded-lg border bg-background p-6">{children}</div>
      </div>
      {compare && (
        <div className="flex min-w-0 flex-col gap-3">
          <MicroHeading>{t("darkPane")}</MicroHeading>
          {/* `.dark` scopes the theme's real dark tokens to this pane. */}
          <div className="dark flex flex-col gap-6 rounded-lg border bg-background p-6 text-foreground">
            {children}
          </div>
        </div>
      )}
    </div>
  );
}

type SectionId =
  | "colors"
  | "type"
  | "shape"
  | "icons"
  | "buttons"
  | "inputs"
  | "dropdowns"
  | "controls"
  | "badges"
  | "avatars"
  | "overlays"
  | "tables"
  | "navigation"
  | "layout"
  | "feedback";

function Section({ id, children }: { id: SectionId; children: React.ReactNode }) {
  const t = useTranslations("admin.designSystem.sections");
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="flex scroll-mt-24 flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <SectionTitle id={`${id}-title`}>{t(`${id}.title`)}</SectionTitle>
        <SubText>{t(`${id}.description`)}</SubText>
      </div>
      <Panes>{children}</Panes>
    </section>
  );
}

/** One labelled row of specimens. */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <MicroHeading>{label}</MicroHeading>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

/**
 * Reads a live computed value off the rendered element — the active theme,
 * not a copy — and re-reads when the mode or the injected theme changes (a
 * class or style mutation on <html>). `read` must be a stable, module-level
 * function.
 */
function useComputed<T extends HTMLElement>(read: (style: CSSStyleDeclaration) => string) {
  const ref = React.useRef<T>(null);
  const [value, setValue] = React.useState("");
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setValue(read(getComputedStyle(el)));
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style", "dir"],
    });
    return () => observer.disconnect();
  }, [read]);
  return [ref, value] as const;
}

const readBackground = (style: CSSStyleDeclaration) => toHex(style.backgroundColor);
const readFontSize = (style: CSSStyleDeclaration) => `${style.fontSize} / ${style.lineHeight}`;

function toHex(rgb: string): string {
  const m = rgb.match(/[\d.]+/g);
  if (!m || m.length < 3) return rgb;
  return `#${m
    .slice(0, 3)
    .map((v) => Math.round(Number(v)).toString(16).padStart(2, "0"))
    .join("")}`.toUpperCase();
}

// ─────────────────────────────────────────────────────────────
// Tokens
// ─────────────────────────────────────────────────────────────

// Full class names, not built strings, so Tailwind's scanner sees each one.
const COLOR_TOKENS = [
  ["background", "bg-background"],
  ["foreground", "bg-foreground"],
  ["card", "bg-card"],
  ["muted", "bg-muted"],
  ["muted-foreground", "bg-muted-foreground"],
  ["border", "bg-border"],
  ["input", "bg-input"],
  ["ring", "bg-ring"],
  ["primary", "bg-primary"],
  ["primary-foreground", "bg-primary-foreground"],
  ["primary-interactive", "bg-primary-interactive"],
  ["primary-hover", "bg-primary-hover"],
  ["secondary", "bg-secondary"],
  ["accent", "bg-accent"],
  ["success", "bg-success"],
  ["success-interactive", "bg-success-interactive"],
  ["warning", "bg-warning"],
  ["warning-interactive", "bg-warning-interactive"],
  ["info", "bg-info"],
  ["info-interactive", "bg-info-interactive"],
  ["destructive", "bg-destructive"],
  ["destructive-interactive", "bg-destructive-interactive"],
] as const;

function Swatch({ name, className }: { name: string; className: string }) {
  const [ref, value] = useComputed<HTMLDivElement>(readBackground);
  return (
    <div className="flex w-36 flex-col gap-1.5">
      <div ref={ref} className={cn("h-14 rounded-md border", className)} />
      <span className="text-xs font-medium">{humanizeKey(name)}</span>
      <MetaText className="tabular-nums">{value}</MetaText>
    </div>
  );
}

const TYPE_STEPS = [
  ["3xs", "text-3xs"],
  ["2xs", "text-2xs"],
  ["xs", "text-xs"],
  ["nav", "text-nav"],
  ["sm", "text-sm"],
  ["base", "text-base"],
  ["lg", "text-lg"],
  ["xl", "text-xl"],
  ["2xl", "text-2xl"],
  ["3xl", "text-3xl"],
  ["4xl", "text-4xl"],
  ["5xl", "text-5xl"],
] as const;

function TypeStep({
  step,
  className,
  sample,
}: {
  step: string;
  className: string;
  sample: string;
}) {
  const [ref, value] = useComputed<HTMLSpanElement>(readFontSize);
  return (
    <div className="flex items-baseline gap-4 border-b py-2 last:border-0">
      <MetaText className="w-24 shrink-0 tabular-nums">
        {step} · {value}
      </MetaText>
      <span ref={ref} className={cn("truncate", className)}>
        {sample}
      </span>
    </div>
  );
}

const RADII = [
  ["sm", "rounded-sm"],
  ["md", "rounded-md"],
  ["lg", "rounded-lg"],
  ["xl", "rounded-xl"],
  ["full", "rounded-full"],
] as const;

const SHADOWS = [
  ["sm", "shadow-sm"],
  ["md", "shadow-md"],
  ["lg", "shadow-lg"],
  ["xl", "shadow-xl"],
  ["2xl", "shadow-2xl"],
  ["dock", "shadow-dock"],
] as const;

const ICON_SIZES = [
  ["2.5", "size-2.5"],
  ["3", "size-3"],
  ["3.5", "size-3.5"],
  ["4", "size-4"],
  ["5", "size-5"],
  ["6", "size-6"],
] as const;

// ─────────────────────────────────────────────────────────────
// Components
// ─────────────────────────────────────────────────────────────

const BUTTON_VARIANTS = [
  "default",
  "secondary",
  "outline",
  "ghost",
  "destructive",
  "success",
  "warning",
  "info",
  "link",
] as const;
const BUTTON_SIZES = ["2xs", "xs", "sm", "default", "lg", "xl"] as const;
const ICON_BUTTON_SIZES = ["icon-2xs", "icon-xs", "icon-sm", "icon", "icon-lg"] as const;
const BADGE_VARIANTS = [
  "default",
  "secondary",
  "outline",
  "destructive",
  "success",
  "warning",
  "info",
  "danger",
  "outline-success",
  "outline-warning",
  "outline-info",
  "outline-danger",
] as const;
/** The forced focus ring, for a static specimen of the focus state. */
const FORCED_FOCUS = "ring-2 ring-ring ring-offset-2 ring-offset-background";

interface DemoRow {
  id: string;
  name: string;
  email: string;
  status: "active" | "pending" | "rejected";
  balance: number;
}

const DEMO_ROWS: DemoRow[] = [
  { id: "201849", name: "Jawad Fat", email: "fa••••@gmail.com", status: "active", balance: 1.33 },
  {
    id: "7242",
    name: "Muhammad Shahid",
    email: "dr••••@gmail.com",
    status: "active",
    balance: 962.67,
  },
  {
    id: "5359",
    name: "Nafisa Abu Sufiyan",
    email: "ac••••@gmail.com",
    status: "pending",
    balance: 9594.74,
  },
  { id: "1", name: "Romaisa Asif", email: "mb••••@gmail.com", status: "rejected", balance: 0 },
  {
    id: "202713",
    name: "Hawre Jamal",
    email: "ha••••@gmail.com",
    status: "active",
    balance: 51.76,
  },
];

const STATUS_BADGE = { active: "success", pending: "warning", rejected: "danger" } as const;

function DemoDataTable() {
  const s = useTranslations("admin.designSystem.sample");
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 5,
  });
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = React.useState("");
  const labels: DataTableLabels = {
    search: s("search"),
    columns: s("columns"),
    export: s("export"),
    selectedCount: (count) => s("selectedCount", { count }),
    page: (page, total) => s("page", { page, total }),
    previous: s("previous"),
    next: s("next"),
    noResults: s("noResults"),
  };
  const columns: ColumnDef<DemoRow>[] = [
    {
      id: "select",
      enableHiding: false,
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllRowsSelected()}
          indeterminate={table.getIsSomeRowsSelected()}
          onCheckedChange={(checked) => table.toggleAllRowsSelected(checked === true)}
          aria-label={s("colName")}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(checked) => row.toggleSelected(checked === true)}
          aria-label={row.original.name}
        />
      ),
    },
    {
      accessorKey: "id",
      header: s("colId"),
      meta: { label: s("colId") },
      cell: ({ getValue }) => <span className="font-mono">{String(getValue())}</span>,
    },
    {
      accessorKey: "name",
      header: s("colName"),
      meta: { label: s("colName") },
      cell: ({ getValue }) => <span className="font-medium">{String(getValue())}</span>,
    },
    { accessorKey: "email", header: s("colEmail"), meta: { label: s("colEmail") } },
    {
      accessorKey: "status",
      header: s("colStatus"),
      meta: { label: s("colStatus") },
      cell: ({ row }) => (
        <Badge size="xs" variant={STATUS_BADGE[row.original.status]}>
          {s(row.original.status)}
        </Badge>
      ),
    },
    {
      accessorKey: "balance",
      header: s("colBalance"),
      meta: { label: s("colBalance") },
      cell: ({ getValue }) => (
        <span className="font-semibold tabular-nums">${Number(getValue()).toFixed(2)}</span>
      ),
    },
  ];
  return (
    <DataTable
      columns={columns}
      data={DEMO_ROWS}
      labels={labels}
      pageCount={9}
      pagination={pagination}
      onPaginationChange={setPagination}
      sorting={sorting}
      onSortingChange={setSorting}
      globalFilter={globalFilter}
      onGlobalFilterChange={setGlobalFilter}
      enableRowSelection
      getRowId={(row) => row.id}
      filters={
        <AdminCombobox
          size="sm"
          className="w-40"
          value=""
          onValueChange={() => undefined}
          options={[
            { value: "", label: s("filterStatus") },
            { value: "active", label: s("active") },
            { value: "pending", label: s("pending") },
          ]}
        />
      }
    />
  );
}

// ─────────────────────────────────────────────────────────────
// The board
// ─────────────────────────────────────────────────────────────

export function DesignSystem() {
  const t = useTranslations("admin.designSystem");
  const s = useTranslations("admin.designSystem.sample");
  const state = useTranslations("admin.designSystem.states");
  const [compare, setCompare] = React.useState(false);
  const [rtl, setRtl] = React.useState(false);
  const [pair, setPair] = React.useState("eurusd");
  const [risk, setRisk] = React.useState("medium");
  const [view, setView] = React.useState("default");

  const pairs = [
    "EUR/USD",
    "GBP/USD",
    "USD/JPY",
    "USD/CHF",
    "AUD/USD",
    "USD/CAD",
    "NZD/USD",
    "EUR/GBP",
    "EUR/JPY",
    "GBP/JPY",
  ];

  return (
    <BoardContext.Provider value={{ compare, rtl }}>
      <TooltipProvider>
        <div className="flex w-full flex-col gap-12">
          <PageHeader
            title={t("title")}
            description={t("description")}
            actions={
              <div className="flex flex-wrap items-center gap-6">
                <Label className="gap-2">
                  <Switch checked={compare} onCheckedChange={setCompare} />
                  {t("compare")}
                </Label>
                <Label className="gap-2">
                  <Switch checked={rtl} onCheckedChange={setRtl} />
                  {t("rtl")}
                </Label>
              </div>
            }
          />
          <MetaText>{t("hoverNote")}</MetaText>

          <Section id="colors">
            <div className="flex flex-wrap gap-4">
              {COLOR_TOKENS.map(([name, className]) => (
                <Swatch key={name} name={name} className={className} />
              ))}
            </div>
          </Section>

          <Section id="type">
            <div className="flex flex-col">
              {TYPE_STEPS.map(([step, className]) => (
                <TypeStep key={step} step={step} className={className} sample={s("typeSample")} />
              ))}
            </div>
          </Section>

          <Section id="shape">
            <Row label={humanizeKey("radius")}>
              {RADII.map(([name, className]) => (
                <div key={name} className="flex flex-col items-center gap-1.5">
                  <div
                    className={cn(
                      "size-16 border-2 border-primary-interactive bg-muted",
                      className,
                    )}
                  />
                  <MetaText>{name}</MetaText>
                </div>
              ))}
            </Row>
            <Row label={humanizeKey("shadow")}>
              {SHADOWS.map(([name, className]) => (
                <div key={name} className="flex flex-col items-center gap-1.5">
                  <div className={cn("size-20 rounded-lg border bg-card", className)} />
                  <MetaText>{name}</MetaText>
                </div>
              ))}
            </Row>
          </Section>

          <Section id="icons">
            <Row label={humanizeKey("size")}>
              {ICON_SIZES.map(([name, className]) => (
                <div key={name} className="flex w-12 flex-col items-center gap-1.5">
                  <Users aria-hidden className={className} />
                  <MetaText>{name}</MetaText>
                </div>
              ))}
            </Row>
          </Section>

          <Section id="buttons">
            <Row label={humanizeKey("variant")}>
              {BUTTON_VARIANTS.map((variant) => (
                <Button key={variant} variant={variant}>
                  {humanizeKey(variant)}
                </Button>
              ))}
            </Row>
            <Row label={humanizeKey("size")}>
              {BUTTON_SIZES.map((size) => (
                <Button key={size} size={size}>
                  <Plus data-icon="inline-start" aria-hidden />
                  {humanizeKey(size)}
                </Button>
              ))}
            </Row>
            <Row label={humanizeKey("iconSize")}>
              {ICON_BUTTON_SIZES.map((size) => (
                <Button key={size} size={size} variant="outline" aria-label={humanizeKey(size)}>
                  <MoreHorizontal aria-hidden />
                </Button>
              ))}
            </Row>
            <Row label={humanizeKey("states")}>
              <Button>{state("default")}</Button>
              <Button className={FORCED_FOCUS}>{state("focus")}</Button>
              <Button disabled>{state("disabled")}</Button>
              <Button variant="outline" className={FORCED_FOCUS}>
                {state("focus")}
              </Button>
              <Button variant="outline" disabled>
                {state("disabled")}
              </Button>
            </Row>
            <Row label={humanizeKey("shapeAndEmphasis")}>
              <Button emphasis>{s("action")}</Button>
              <Button shape="pill">{s("newItem")}</Button>
              <Button variant="outline" shape="pill">
                {s("newItem")}
              </Button>
            </Row>
          </Section>

          <Section id="inputs">
            <div className="grid max-w-3xl gap-6 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="ds-input">{s("fieldLabel")}</Label>
                <Input id="ds-input" placeholder={s("fieldPlaceholder")} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="ds-input-invalid">{state("invalid")}</Label>
                <Input id="ds-input-invalid" aria-invalid defaultValue={s("fieldPlaceholder")} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="ds-input-disabled">{state("disabled")}</Label>
                <Input id="ds-input-disabled" disabled placeholder={s("fieldPlaceholder")} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="ds-input-focus">{state("focus")}</Label>
                <Input
                  id="ds-input-focus"
                  className={FORCED_FOCUS}
                  placeholder={s("fieldPlaceholder")}
                />
              </div>
            </div>
            <Row label={humanizeKey("searchSizes")}>
              <SearchInput
                size="default"
                aria-label={s("search")}
                placeholder={s("search")}
                wrapperClassName="w-72"
              />
              <SearchInput
                size="sm"
                aria-label={s("search")}
                placeholder={s("search")}
                wrapperClassName="w-64"
              />
              <SearchInput
                size="xs"
                aria-label={s("search")}
                placeholder={s("search")}
                wrapperClassName="w-56"
              />
            </Row>
            <div className="flex max-w-xl flex-col gap-2">
              <Label htmlFor="ds-notes">{s("notes")}</Label>
              <Textarea id="ds-notes" placeholder={s("notesPlaceholder")} />
            </div>
          </Section>

          {/* ADR-057 (carried over from the kitchen sink): one component, two
              primitives. Ten options cross the searchable threshold; three
              stay a plain Select. Both triggers are full width. */}
          <Section id="dropdowns">
            <div className="grid max-w-3xl gap-6 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="ds-pair">{s("pairLabel")}</Label>
                <AdminCombobox
                  id="ds-pair"
                  value={pair}
                  onValueChange={setPair}
                  options={pairs.map((p) => ({
                    value: p.toLowerCase().replace("/", ""),
                    label: p,
                  }))}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="ds-risk">{s("riskLabel")}</Label>
                <AdminCombobox
                  id="ds-risk"
                  value={risk}
                  onValueChange={setRisk}
                  options={[
                    { value: "low", label: s("riskLow") },
                    { value: "medium", label: s("riskMedium") },
                    { value: "high", label: s("riskHigh") },
                  ]}
                />
              </div>
            </div>
            <Row label={humanizeKey("toolbarSizes")}>
              <AdminCombobox
                size="sm"
                className="w-40"
                value={risk}
                onValueChange={setRisk}
                options={[
                  { value: "low", label: s("riskLow") },
                  { value: "medium", label: s("riskMedium") },
                  { value: "high", label: s("riskHigh") },
                ]}
                aria-label={s("riskLabel")}
              />
              <AdminCombobox
                size="xs"
                className="w-36"
                value={pair}
                onValueChange={setPair}
                options={pairs.map((p) => ({ value: p.toLowerCase().replace("/", ""), label: p }))}
                aria-label={s("pairLabel")}
              />
            </Row>
          </Section>

          <Section id="controls">
            <Row label={humanizeKey("checkbox")}>
              <Label className="gap-2">
                <Checkbox />
                {state("unchecked")}
              </Label>
              <Label className="gap-2">
                <Checkbox defaultChecked />
                {state("checked")}
              </Label>
              <Label className="gap-2">
                <Checkbox disabled />
                {state("disabled")}
              </Label>
              <Label className="gap-2">
                <Checkbox defaultChecked />
                {s("remember")}
              </Label>
            </Row>
            <Row label={humanizeKey("radio")}>
              <RadioGroup defaultValue="standard" className="flex gap-6">
                <Label className="gap-2">
                  <RadioGroupItem value="standard" />
                  {s("planStandard")}
                </Label>
                <Label className="gap-2">
                  <RadioGroupItem value="pro" />
                  {s("planPro")}
                </Label>
              </RadioGroup>
            </Row>
            <Row label={humanizeKey("switch")}>
              <Label className="gap-2">
                <Switch />
                {state("unchecked")}
              </Label>
              <Label className="gap-2">
                <Switch defaultChecked />
                {s("notify")}
              </Label>
              <Label className="gap-2">
                <Switch disabled />
                {state("disabled")}
              </Label>
            </Row>
          </Section>

          <Section id="badges">
            {(["default", "sm", "xs"] as const).map((size) => (
              <Row key={size} label={humanizeKey(size)}>
                {BADGE_VARIANTS.map((variant) => (
                  <Badge key={variant} size={size} variant={variant}>
                    {humanizeKey(variant)}
                  </Badge>
                ))}
              </Row>
            ))}
            <Row label={humanizeKey("liveAndCount")}>
              <Badge variant="outline-success" live>
                {s("live")}
              </Badge>
              <Badge size="sm" variant="outline-success" live>
                {s("live")}
              </Badge>
              <span className="inline-flex items-center gap-2 text-sm">
                {s("notifications")}
                <CountBadge count={7} />
              </span>
              <span className="inline-flex items-center gap-2 text-sm">
                {s("notifications")}
                <CountBadge count={150} />
              </span>
              <span className="relative inline-flex">
                <Button variant="ghost" size="sm" aria-label={s("notifications")}>
                  <Bell aria-hidden className="size-5" />
                </Button>
                <CountBadge count={1204} max={999} placement="corner" />
              </span>
            </Row>
          </Section>

          <Section id="avatars">
            <Row label={humanizeKey("avatar")}>
              {(["sm", "default", "lg"] as const).map((size) => (
                <Avatar key={size} size={size}>
                  <AvatarFallback>{s("initials")}</AvatarFallback>
                </Avatar>
              ))}
              <Avatar shape="square">
                <AvatarFallback>{s("initials")}</AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium">{s("userName")}</span>
            </Row>
            <Row label={humanizeKey("tooltip")}>
              <Tooltip>
                <TooltipTrigger render={<Button variant="outline" />}>
                  {s("tooltipTrigger")}
                </TooltipTrigger>
                <TooltipContent>{s("tooltip")}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger render={<Button variant="outline" size="sm" />}>
                  {humanizeKey("sm")}
                </TooltipTrigger>
                <TooltipContent size="sm">{s("tooltip")}</TooltipContent>
              </Tooltip>
            </Row>
          </Section>

          <Section id="overlays">
            <Row label={humanizeKey("overlays")}>
              <Dialog>
                <DialogTrigger render={<Button variant="outline" />}>
                  {s("openDialog")}
                </DialogTrigger>
                <DialogContent closeLabel={s("close")}>
                  <DialogHeader>
                    <DialogTitle>{s("dialogTitle")}</DialogTitle>
                    <DialogDescription>{s("dialogDescription")}</DialogDescription>
                  </DialogHeader>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="ds-dialog-name">{s("fieldLabel")}</Label>
                    <Input id="ds-dialog-name" placeholder={s("fieldPlaceholder")} />
                  </div>
                  <DialogFooter>
                    <DialogClose render={<Button variant="outline" />}>{s("cancel")}</DialogClose>
                    <Button>{s("confirm")}</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <ConfirmDialog
                trigger={<Button variant="destructive">{s("openConfirm")}</Button>}
                title={s("confirmTitle")}
                description={s("confirmDescription")}
                confirmLabel={s("confirmAction")}
                cancelLabel={s("cancel")}
                onConfirm={() => undefined}
              />
              <Sheet>
                <SheetTrigger render={<Button variant="outline" />}>{s("openSheet")}</SheetTrigger>
                <SheetContent side="end" closeLabel={s("close")}>
                  <SheetHeader>
                    <SheetTitle>{s("sheetTitle")}</SheetTitle>
                    <SheetDescription>{s("sheetDescription")}</SheetDescription>
                  </SheetHeader>
                </SheetContent>
              </Sheet>
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant="outline" />}>
                  <MoreHorizontal data-icon="inline-start" aria-hidden />
                  {s("openMenu")}
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>{s("menuLabel")}</DropdownMenuLabel>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    {s("menuEdit")}
                    <DropdownMenuShortcut>⌘E</DropdownMenuShortcut>
                  </DropdownMenuItem>
                  <DropdownMenuItem>{s("menuDuplicate")}</DropdownMenuItem>
                  <DropdownMenuCheckboxItem defaultChecked>{s("menuPin")}</DropdownMenuCheckboxItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive">{s("menuDelete")}</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Popover>
                <PopoverTrigger render={<Button variant="outline" size="sm" />}>
                  {s("openPopover")}
                </PopoverTrigger>
                <PopoverContent>
                  <SubText>{s("popover")}</SubText>
                </PopoverContent>
              </Popover>
              <Button
                variant="outline"
                onClick={() =>
                  toast.success(s("toastTitle"), { description: s("toastDescription") })
                }
              >
                {s("toastSuccess")}
              </Button>
            </Row>
          </Section>

          <Section id="tables">
            <Row label={humanizeKey("default")}>
              <div className="w-full overflow-hidden rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{s("colName")}</TableHead>
                      <TableHead>{s("colEmail")}</TableHead>
                      <TableHead>{s("colStatus")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {DEMO_ROWS.slice(0, 3).map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">{row.name}</TableCell>
                        <TableCell>{row.email}</TableCell>
                        <TableCell>
                          <Badge size="xs" variant={STATUS_BADGE[row.status]}>
                            {s(row.status)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Row>
            <Row label={humanizeKey("dataTableCompact")}>
              <div className="w-full">
                <DemoDataTable />
              </div>
            </Row>
          </Section>

          <Section id="navigation">
            <Row label={humanizeKey("tabs")}>
              <Tabs defaultValue="overview" className="w-full max-w-md">
                <TabsList>
                  <TabsTrigger value="overview">{s("tabOverview")}</TabsTrigger>
                  <TabsTrigger value="activity">{s("tabActivity")}</TabsTrigger>
                  <TabsTrigger value="settings">{s("tabSettings")}</TabsTrigger>
                </TabsList>
                <TabsContent value="overview">
                  <SubText>{s("tabPanel")}</SubText>
                </TabsContent>
                <TabsContent value="activity">
                  <SubText>{s("tabPanel")}</SubText>
                </TabsContent>
                <TabsContent value="settings">
                  <SubText>{s("tabPanel")}</SubText>
                </TabsContent>
              </Tabs>
            </Row>
            <Row label={humanizeKey("viewChips")}>
              <ViewChips value={view} onValueChange={setView} aria-label={s("viewChipsLabel")}>
                <ViewChip value="default">
                  <LayoutDashboard aria-hidden />
                  {s("viewDefault")}
                </ViewChip>
                <ViewChip value="referrals">
                  <Users aria-hidden />
                  {s("viewReferrals")}
                </ViewChip>
                <ViewChip value="trading">
                  <TrendingUp aria-hidden />
                  {s("viewTrading")}
                </ViewChip>
                <ViewChip value="compliance">
                  <ShieldCheck aria-hidden />
                  {s("viewCompliance")}
                </ViewChip>
              </ViewChips>
            </Row>
            <Row label={humanizeKey("filterBar")}>
              <FilterBar aria-label={humanizeKey("filterBar")} className="w-full">
                <FilterBarRow>
                  <SearchInput
                    size="sm"
                    aria-label={s("search")}
                    placeholder={s("search")}
                    wrapperClassName="min-w-60 flex-1"
                  />
                </FilterBarRow>
                <FilterBarRow>
                  <FilterBarItem>
                    <AdminCombobox
                      size="sm"
                      value=""
                      onValueChange={() => undefined}
                      options={[
                        { value: "", label: s("filterStatus") },
                        { value: "active", label: s("active") },
                      ]}
                      aria-label={s("filterStatus")}
                    />
                  </FilterBarItem>
                  <FilterBarItem>
                    <AdminCombobox
                      size="sm"
                      value=""
                      onValueChange={() => undefined}
                      options={[
                        { value: "", label: s("filterCountry") },
                        ...pairs.map((p) => ({ value: p, label: p })),
                      ]}
                      aria-label={s("filterCountry")}
                    />
                  </FilterBarItem>
                </FilterBarRow>
              </FilterBar>
            </Row>
            <Row label={humanizeKey("pagination")}>
              <div className="w-full overflow-hidden rounded-md border">
                <PaginationBar summary={s("showing")}>
                  <Pagination className="mx-0 w-auto">
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationFirst href="#" aria-label={s("first")} />
                      </PaginationItem>
                      <PaginationItem>
                        <PaginationPrevious
                          href="#"
                          text={s("previous")}
                          aria-label={s("previous")}
                        />
                      </PaginationItem>
                      <PaginationItem>
                        <PaginationLink href="#" isActive>
                          1
                        </PaginationLink>
                      </PaginationItem>
                      <PaginationItem>
                        <PaginationLink href="#">2</PaginationLink>
                      </PaginationItem>
                      <PaginationItem>
                        <PaginationLink href="#">3</PaginationLink>
                      </PaginationItem>
                      <PaginationItem>
                        <PaginationEllipsis label={s("morePages")} />
                      </PaginationItem>
                      <PaginationItem>
                        <PaginationLink href="#">9</PaginationLink>
                      </PaginationItem>
                      <PaginationItem>
                        <PaginationNext href="#" text={s("next")} aria-label={s("next")} />
                      </PaginationItem>
                      <PaginationItem>
                        <PaginationLast href="#" aria-label={s("last")} />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </PaginationBar>
              </div>
            </Row>
            <Row label={humanizeKey("breadcrumb")}>
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbLink href="#">{s("crumbAdmin")}</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbLink href="#">{s("crumbUsers")}</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>{s("crumbProfile")}</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </Row>
            <Row label={humanizeKey("navItem")}>
              <nav className="w-64 space-y-1 rounded-lg border bg-background p-3">
                <NavItem href="#" icon={<LayoutDashboard aria-hidden />}>
                  {s("navDashboard")}
                </NavItem>
                <NavItem
                  render={<button type="button" />}
                  active
                  icon={<Users aria-hidden />}
                  trailing={<CountBadge count={120} />}
                >
                  {s("navUsers")}
                </NavItem>
                <NavItemGroup>
                  <NavItem href="#" active icon={<Users aria-hidden />}>
                    {s("navAll")}
                  </NavItem>
                  <NavItem
                    href="#"
                    icon={<ShieldCheck aria-hidden />}
                    trailing={<CountBadge count={99} />}
                  >
                    {s("navKyc")}
                  </NavItem>
                </NavItemGroup>
              </nav>
            </Row>
          </Section>

          <Section id="layout">
            <Row label={humanizeKey("pageHeader")}>
              <div className="w-full">
                <PageHeader
                  title={s("pageTitle")}
                  description={s("pageDescription")}
                  status={
                    <Badge size="sm" variant="outline-success" live>
                      {s("live")}
                    </Badge>
                  }
                  actions={
                    <>
                      <Button>
                        <Plus data-icon="inline-start" aria-hidden />
                        {s("newItem")}
                      </Button>
                      <Button variant="outline" size="icon" aria-label={s("action")}>
                        <RefreshCw aria-hidden />
                      </Button>
                    </>
                  }
                />
              </div>
              <div className="w-full">
                <PageHeader
                  title={s("cardTitle")}
                  description={s("cardDescription")}
                  icon={<Megaphone aria-hidden />}
                />
              </div>
            </Row>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label={s("metricLabel")}
                icon={<Users aria-hidden className="text-muted-foreground" />}
                value={s("metricValue")}
                meta={s("metricMeta")}
                detail={s("metricDetail")}
                footer={
                  <>
                    <Progress size="xs" value={98} />
                    <MetaText className="mt-1">{s("metricCaption")}</MetaText>
                  </>
                }
              />
              <MetricCard
                label={s("volumeLabel")}
                icon={<CircleDollarSign aria-hidden className="text-primary-interactive" />}
                value={s("volumeValue")}
                unit={s("unitLots")}
                meta={
                  <>
                    <TrendingUp aria-hidden className="text-success-interactive" />
                    <span className="text-success-interactive">{s("volumeTrend")}</span>
                    <span>{s("metricMeta")}</span>
                  </>
                }
                footer={<Progress size="xs" value={60} />}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>{s("cardTitle")}</CardTitle>
                  <CardDescription>{s("cardDescription")}</CardDescription>
                </CardHeader>
                <CardContent>
                  <SubText>{s("cardBody")}</SubText>
                </CardContent>
              </Card>
              <Card size="sm">
                <CardHeader>
                  <CardTitle>{s("cardSmall")}</CardTitle>
                  <CardDescription>{s("cardDescription")}</CardDescription>
                </CardHeader>
                <CardContent>
                  <SubText>{s("cardBody")}</SubText>
                </CardContent>
              </Card>
            </div>
            <Row label={humanizeKey("typeRoles")}>
              <div className="flex w-full flex-col gap-3">
                <PageTitle render={<div />}>{s("pageTitle")}</PageTitle>
                <PageDescription>{s("pageDescription")}</PageDescription>
                <SectionTitle render={<div />}>{s("sectionTitle")}</SectionTitle>
                <SectionTitleCompact render={<div />}>
                  <Search aria-hidden />
                  {s("sectionCompact")}
                </SectionTitleCompact>
                <SubText>{s("subText")}</SubText>
                <StatLabel render={<div />}>{s("metricLabel")}</StatLabel>
                <StatValue>{s("metricValue")}</StatValue>
                <MetaText>{s("metaText")}</MetaText>
                <MicroHeading>{s("microHeading")}</MicroHeading>
              </div>
            </Row>
          </Section>

          <Section id="feedback">
            <div className="grid max-w-3xl gap-3">
              <Alert>
                <Inbox aria-hidden />
                <AlertTitle>{s("alertTitle")}</AlertTitle>
                <AlertDescription>{s("alertBody")}</AlertDescription>
              </Alert>
              <Alert variant="destructive">
                <AlertTitle>{s("alertDanger")}</AlertTitle>
                <AlertDescription>{s("alertDangerBody")}</AlertDescription>
              </Alert>
              <Alert variant="success">
                <AlertTitle>{s("alertSuccess")}</AlertTitle>
                <AlertDescription>{s("alertSuccessBody")}</AlertDescription>
              </Alert>
            </div>
            <Empty className="max-w-md">
              <EmptyMedia>
                <Inbox aria-hidden />
              </EmptyMedia>
              <EmptyTitle>{s("emptyTitle")}</EmptyTitle>
              <EmptyDescription>{s("emptyBody")}</EmptyDescription>
              <EmptyContent>
                <Button size="sm">{s("emptyAction")}</Button>
              </EmptyContent>
            </Empty>
            <Row label={humanizeKey("progress")}>
              <div className="flex w-full max-w-md flex-col gap-3">
                <Progress size="xs" value={25} />
                <Progress size="sm" value={50} />
                <Progress value={75} />
              </div>
            </Row>
            <Row label={s("commandHint")}>
              <KbdGroup>
                <Kbd>⌘</Kbd>
                <Kbd>K</Kbd>
              </KbdGroup>
            </Row>
          </Section>
        </div>
      </TooltipProvider>
    </BoardContext.Provider>
  );
}

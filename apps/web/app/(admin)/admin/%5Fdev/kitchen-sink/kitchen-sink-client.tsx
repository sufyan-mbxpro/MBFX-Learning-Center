"use client";

// Dev-only kitchen sink — every @repo/ui component on one page, with
// mode/direction toggles for eyeballing dark × RTL combinations. English
// literals are fine here: this page 404s in production and is a staff-only
// dev tool, not a user surface (code-style.md #2's scaffold tolerance).
import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ColumnDef, PaginationState, SortingState } from "@tanstack/react-table";
import { toast } from "sonner";

import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/ui/components/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui/components/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table";
import { Toaster } from "@repo/ui/components/sonner";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@repo/ui/components/form";
import { DataTable, type DataTableLabels } from "@repo/ui/components/data-table";
import { Checkbox } from "@repo/ui/components/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/alert";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyMedia,
  EmptyTitle,
} from "@repo/ui/components/empty";
import { Kbd, KbdGroup } from "@repo/ui/components/kbd";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@repo/ui/components/sheet";
import { Inbox } from "lucide-react";

const demoFormSchema = z.object({
  email: z.email("Enter a valid email address"),
  displayName: z.string().min(2, "At least 2 characters"),
});

interface DemoRow {
  id: string;
  pair: string;
  bid: number;
  ask: number;
}

const DEMO_ROWS: DemoRow[] = [
  { id: "1", pair: "EUR/USD", bid: 1.0842, ask: 1.0844 },
  { id: "2", pair: "GBP/USD", bid: 1.2701, ask: 1.2704 },
  { id: "3", pair: "USD/JPY", bid: 149.82, ask: 149.85 },
  { id: "4", pair: "AUD/USD", bid: 0.6533, ask: 0.6536 },
  { id: "5", pair: "USD/CAD", bid: 1.3611, ask: 1.3614 },
];

const dataTableLabels: DataTableLabels = {
  search: "Search pairs…",
  columns: "Columns",
  export: "Export CSV",
  selectedCount: (n) => `${n} selected`,
  page: (p, total) => `Page ${p} of ${total}`,
  previous: "Previous",
  next: "Next",
  noResults: "No results.",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border bg-card p-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export function KitchenSink() {
  const [dark, setDark] = useState(false);
  const [rtl, setRtl] = useState(false);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 5 });
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");

  const form = useForm<z.infer<typeof demoFormSchema>>({
    resolver: zodResolver(demoFormSchema),
    defaultValues: { email: "", displayName: "" },
  });

  const columns: ColumnDef<DemoRow>[] = [
    {
      id: "select",
      enableHiding: false,
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllRowsSelected()}
          indeterminate={table.getIsSomeRowsSelected()}
          onCheckedChange={(checked) => table.toggleAllRowsSelected(checked === true)}
          aria-label="Select all rows"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(checked) => row.toggleSelected(checked === true)}
          aria-label={`Select row ${row.original.pair}`}
        />
      ),
    },
    { accessorKey: "pair", header: "Pair" },
    { accessorKey: "bid", header: "Bid" },
    { accessorKey: "ask", header: "Ask" },
  ];

  const toggleDark = () => {
    setDark((d) => {
      document.documentElement.classList.toggle("dark", !d);
      return !d;
    });
  };
  const toggleRtl = () => {
    setRtl((r) => {
      document.documentElement.dir = r ? "ltr" : "rtl";
      return !r;
    });
  };

  return (
    <main className="container-page flex flex-col gap-6 py-8">
      <Toaster />
      <header className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold">Kitchen sink</h1>
        <div className="ms-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={toggleDark}>
            {dark ? "Light mode" : "Dark mode"}
          </Button>
          <Button variant="outline" size="sm" onClick={toggleRtl}>
            {rtl ? "LTR" : "RTL"}
          </Button>
        </div>
      </header>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-2">
          <Button>Default</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="link">Link</Button>
          <Button size="sm">Small</Button>
          <Button size="lg">Large</Button>
          <Button disabled>Disabled</Button>
        </div>
      </Section>

      <Section title="Input + Label">
        <div className="flex max-w-sm flex-col gap-2">
          <Label htmlFor="ks-input">Account name</Label>
          <Input id="ks-input" placeholder="e.g. Swing trading" />
        </div>
      </Section>

      <Section title="Dialog">
        <Dialog>
          <DialogTrigger render={<Button variant="outline">Open dialog</Button>} />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm action</DialogTitle>
              <DialogDescription>
                This is the dialog primitive — focus is trapped, Escape closes it.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button>Confirm</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Section>

      <Section title="Dropdown menu">
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline">Open menu</Button>} />
          <DropdownMenuContent>
            {/* Base UI: GroupLabel must live inside a Group. */}
            <DropdownMenuGroup>
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => toast.success("Edited")}>Edit</DropdownMenuItem>
            <DropdownMenuItem onClick={() => toast.info("Duplicated")}>Duplicate</DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={() => toast.error("Deleted")}>
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </Section>

      <Section title="Tabs">
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="text-sm text-muted-foreground">
            Overview content.
          </TabsContent>
          <TabsContent value="analytics" className="text-sm text-muted-foreground">
            Analytics content.
          </TabsContent>
          <TabsContent value="settings" className="text-sm text-muted-foreground">
            Settings content.
          </TabsContent>
        </Tabs>
      </Section>

      <Section title="Toast">
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => toast.success("Trade saved")}>
            Success toast
          </Button>
          <Button variant="outline" onClick={() => toast.error("Order rejected")}>
            Error toast
          </Button>
        </div>
      </Section>

      <Section title="Form (react-hook-form + Zod v4)">
        <Form {...form}>
          <form
            className="flex max-w-sm flex-col gap-4"
            onSubmit={form.handleSubmit((values) => toast.success(`Saved ${values.displayName}`))}
          >
            <FormField
              control={form.control}
              name="displayName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Display name</FormLabel>
                  <FormControl render={<Input {...field} />} />
                  <FormDescription>Shown on your public profile.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl render={<Input type="email" {...field} />} />
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="self-start">
              Submit
            </Button>
          </form>
        </Form>
      </Section>

      <Section title="Plain table">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pair</TableHead>
              <TableHead>Bid</TableHead>
              <TableHead>Ask</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {DEMO_ROWS.slice(0, 3).map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.pair}</TableCell>
                <TableCell>{row.bid}</TableCell>
                <TableCell>{row.ask}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Section>

      <Section title="DataTable (server-contract demo, local data)">
        <DataTable
          columns={columns}
          data={DEMO_ROWS}
          labels={dataTableLabels}
          pageCount={1}
          pagination={pagination}
          onPaginationChange={setPagination}
          sorting={sorting}
          onSortingChange={setSorting}
          globalFilter={globalFilter}
          onGlobalFilterChange={setGlobalFilter}
          enableRowSelection
          bulkActions={[
            {
              key: "archive",
              label: "Archive selected",
              onClick: (rows) => toast.info(`Would archive ${rows.length} rows`),
            },
          ]}
          exportFileName="demo-rates"
          getRowId={(row) => row.id}
        />
      </Section>

      <Section title="Alerts, empty state, kbd, sheet">
        <div className="flex max-w-md flex-col gap-3">
          <Alert>
            <AlertTitle>Heads up</AlertTitle>
            <AlertDescription>Neutral inline message.</AlertDescription>
          </Alert>
          <Alert variant="destructive">
            <AlertTitle>Save refused</AlertTitle>
            <AlertDescription>Fix the blocking issues below.</AlertDescription>
          </Alert>
          <Alert variant="warning">
            <AlertTitle>Advisory</AlertTitle>
            <AlertDescription>Contrast is close to the threshold.</AlertDescription>
          </Alert>
          <Alert variant="success">
            <AlertTitle>Published</AlertTitle>
            <AlertDescription>The article is live.</AlertDescription>
          </Alert>
          <Alert variant="info">
            <AlertTitle>Scheduled</AlertTitle>
            <AlertDescription>Goes live within five minutes of its time.</AlertDescription>
          </Alert>
        </div>
        <Empty className="max-w-md">
          <EmptyMedia>
            <Inbox aria-hidden />
          </EmptyMedia>
          <EmptyTitle>Nothing here yet</EmptyTitle>
          <EmptyDescription>Create the first item to get started.</EmptyDescription>
          <EmptyContent>
            <Button size="sm">Create item</Button>
          </EmptyContent>
        </Empty>
        <p className="flex items-center gap-2 text-sm">
          Command palette:
          <KbdGroup>
            <Kbd>⌘</Kbd>
            <Kbd>K</Kbd>
          </KbdGroup>
        </p>
        <Sheet>
          <SheetTrigger render={<Button variant="outline">Open sheet</Button>} />
          <SheetContent side="start">
            <SheetHeader>
              <SheetTitle>Side panel</SheetTitle>
              <SheetDescription>Edge-anchored dialog; start side flips in RTL.</SheetDescription>
            </SheetHeader>
          </SheetContent>
        </Sheet>
      </Section>
    </main>
  );
}

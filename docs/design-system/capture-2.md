# Reference capture 2: the components the first capture shows closed

**Taken:** 2026-09-11 · **Decision:** ADR-074 · **Consumed by:**
`tokens.md` §6.14

## Why this is a registry capture, not a screenshot

The reference is a production CRM. It renders menus, dialogs, form controls
and toasts open only behind its `/backbone/*` login, and the first capture
names no host. The first capture does show which library it runs, and the
brief names it ("we're using https://ui.shadcn.com"). So the capture was
taken from that library's registry, and only after proving the registry is
the reference.

## Method

1. Fetch shadcn's registry JSON for 26 components, in both published styles:
   `https://ui.shadcn.com/r/styles/{new-york,default}/<name>.json`.
2. Score every registry class literal against every class attribute in
   `changes-20-Ui.md`: the share of its tokens present verbatim in the
   best-matching captured element.
3. Inspect every sub-100% match token by token.

## Result

| Component                 | `new-york` exact literals | `default` exact literals |
| ------------------------- | ------------------------- | ------------------------ |
| Button                    | 2/10                      | **6/10**                 |
| Table                     | 4/8                       | **6/8**                  |
| Card                      | 2/4                       | **4/5**                  |
| Badge                     | 2/5                       | **4/5**                  |
| Input (token overlap)     | 75%                       | **96%**                  |
| Tabs list / trigger       | 50% / 85%                 | **75% / 95%**            |
| Label, Avatar, Pagination | —                         | exact                    |

What the remaining `default`-style deltas are:

- **Input:** the registry has `file:text-foreground`; the capture adds the
  call site's `pl-10`.
- **Tabs:** the capture adds the call site's `w-full justify-start gap-1
overflow-x-auto` and `flex-1 min-h-[40px] py-2 sm:py-1.5`.
- **Select trigger:** the registry has `data-[placeholder]:`; the capture has
  `placeholder:` (a patch version), plus the call site's `w-[180px]` and
  truncation helpers.

**Conclusion:** the reference is shadcn/ui **`default`** (Tailwind v3), with
no recipe modified. ADR-072's "new-york" label is corrected by ADR-074.

## The captured recipes (verbatim, `default` style)

These are the source of truth for `tokens.md` §6.14.

- They are written in Radix's `data-[state=…]` and physical `left`/`right`
  terms. Our implementation maps them onto Base UI's `data-open` /
  `data-checked` and logical `start`/`end` (code-style #3).
- Where a recipe fails our contrast rules, §6.14 records the accessible
  deviation (ADR-072 §1, ADR-074 §3).

```text
## dropdown-menu
- DropdownMenuSubTrigger
    flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent data-[state=open]:bg-accent [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0
    icon: ChevronRight(ml-auto)
- DropdownMenuSubContent
    z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-[--radix-dropdown-menu-content-transform-origin]
- DropdownMenuContent
    z-50 max-h-[var(--radix-dropdown-menu-content-available-height)] min-w-[8rem] overflow-y-auto overflow-x-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-[--radix-dropdown-menu-content-transform-origin]
- DropdownMenuItem
    relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0
- DropdownMenuCheckboxItem
    relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50
    absolute left-2 flex h-3.5 w-3.5 items-center justify-center
    h-4 w-4
    icon: Check(h-4 w-4)
- DropdownMenuRadioItem
    relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50
    absolute left-2 flex h-3.5 w-3.5 items-center justify-center
    h-2 w-2 fill-current
    icon: Circle(h-2 w-2 fill-current)
- DropdownMenuLabel
    px-2 py-1.5 text-sm font-semibold
- DropdownMenuSeparator
    -mx-1 my-1 h-px bg-muted
- DropdownMenuShortcut
    ml-auto text-xs tracking-widest opacity-60

## select
- SelectTrigger
    flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background data-[placeholder]:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1
    h-4 w-4 opacity-50
    icon: ChevronDown(h-4 w-4 opacity-50)
- SelectScrollUpButton
    flex cursor-default items-center justify-center py-1
    h-4 w-4
    icon: ChevronUp(h-4 w-4)
- SelectScrollDownButton
    flex cursor-default items-center justify-center py-1
    h-4 w-4
    icon: ChevronDown(h-4 w-4)
- SelectContent
    relative z-50 max-h-[--radix-select-content-available-height] min-w-[8rem] overflow-y-auto overflow-x-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-[--radix-select-content-transform-origin]
    h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]
- SelectLabel
    py-1.5 pl-8 pr-2 text-sm font-semibold
- SelectItem
    relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50
    absolute left-2 flex h-3.5 w-3.5 items-center justify-center
    h-4 w-4
    icon: Check(h-4 w-4)
- SelectSeparator
    -mx-1 my-1 h-px bg-muted

## dialog
- DialogOverlay
    fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0
- DialogContent
    fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg
    absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground
    h-4 w-4
    sr-only
    icon: X(h-4 w-4)
- DialogHeader
    flex flex-col space-y-1.5 text-center sm:text-left
- DialogFooter
    flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2
- DialogTitle
    text-lg font-semibold leading-none tracking-tight
- DialogDescription
    text-sm text-muted-foreground

## sheet
- SheetOverlay
    fixed inset-0 z-50 bg-black/80  data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0
- sheetVariants
    fixed z-50 gap-4 bg-background p-6 shadow-lg transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:duration-500
    inset-x-0 top-0 border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top
    inset-x-0 bottom-0 border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom
    inset-y-0 left-0 h-full w-3/4 border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm
    inset-y-0 right-0 h-full w-3/4  border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-sm
- SheetContent
    absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-secondary
    h-4 w-4
    sr-only
    icon: X(h-4 w-4)
- SheetHeader
    flex flex-col space-y-2 text-center sm:text-left
- SheetFooter
    flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2
- SheetTitle
    text-lg font-semibold text-foreground
- SheetDescription
    text-sm text-muted-foreground

## popover
- PopoverContent
    z-50 w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-[--radix-popover-content-transform-origin]

## tooltip
- TooltipContent
    z-50 overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-[--radix-tooltip-content-transform-origin]

## toast
- ToastViewport
    fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]
- toastVariants
    group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-md border p-6 pr-8 shadow-lg transition-all data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-top-full data-[state=open]:sm:slide-in-from-bottom-full
    border bg-background text-foreground
    destructive group border-destructive bg-destructive text-destructive-foreground
- ToastAction
    inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 text-sm font-medium ring-offset-background transition-colors hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 group-[.destructive]:border-muted/40 group-[.destructive]:hover:border-destructive/30 group-[.destructive]:hover:bg-destructive group-[.destructive]:hover:text-destructive-foreground group-[.destructive]:focus:ring-destructive
- ToastClose
    absolute right-2 top-2 rounded-md p-1 text-foreground/50 opacity-0 transition-opacity hover:text-foreground focus:opacity-100 focus:outline-none focus:ring-2 group-hover:opacity-100 group-[.destructive]:text-red-300 group-[.destructive]:hover:text-red-50 group-[.destructive]:focus:ring-red-400 group-[.destructive]:focus:ring-offset-red-600
    h-4 w-4
    icon: X(h-4 w-4)
- ToastTitle
    text-sm font-semibold
- ToastDescription
    text-sm opacity-90
- useToast
    grid gap-1

## sonner
- Toaster
    h-4 w-4
    h-4 w-4
    h-4 w-4
    h-4 w-4
    h-4 w-4 animate-spin
    group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg
    group-[.toast]:text-muted-foreground
    group-[.toast]:bg-primary group-[.toast]:text-primary-foreground
    group-[.toast]:bg-muted group-[.toast]:text-muted-foreground

## checkbox
- Checkbox
    grid place-content-center peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground
    grid place-content-center text-current
    h-4 w-4
    icon: Check(h-4 w-4)

## radio-group
- RadioGroup
    grid gap-2
- RadioGroupItem
    aspect-square h-4 w-4 rounded-full border border-primary text-primary ring-offset-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50
    flex items-center justify-center
    h-2.5 w-2.5 fill-current text-current
    icon: Circle(h-2.5 w-2.5 fill-current text-current)

## switch
- Switch
    peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input
    pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0

## textarea
- Textarea
    flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm

## breadcrumb
- BreadcrumbList
    flex flex-wrap items-center gap-1.5 break-words text-sm text-muted-foreground sm:gap-2.5
- BreadcrumbItem
    inline-flex items-center gap-1.5
- BreadcrumbLink
    transition-colors hover:text-foreground
- BreadcrumbPage
    font-normal text-foreground
- BreadcrumbSeparator
    [&>svg]:w-3.5 [&>svg]:h-3.5
- BreadcrumbEllipsis
    flex h-9 w-9 items-center justify-center
    h-4 w-4
    sr-only
    icon: MoreHorizontal(h-4 w-4)

## command
- Command
    flex h-full w-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground
- CommandDialog
    overflow-hidden p-0 shadow-lg
    [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5
- CommandInput
    flex items-center border-b px-3
    mr-2 h-4 w-4 shrink-0 opacity-50
    flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50
    icon: Search(mr-2 h-4 w-4 shrink-0 opacity-50)
- CommandList
    max-h-[300px] overflow-y-auto overflow-x-hidden
- CommandEmpty
    py-6 text-center text-sm
- CommandGroup
    overflow-hidden p-1 text-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground
- CommandSeparator
    -mx-1 h-px bg-border
- CommandItem
    relative flex cursor-default gap-2 select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none data-[disabled=true]:pointer-events-none data-[selected='true']:bg-accent data-[selected=true]:text-accent-foreground data-[disabled=true]:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0
- CommandShortcut
    ml-auto text-xs tracking-widest text-muted-foreground

## alert
- alertVariants
    relative w-full rounded-lg border p-4 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground
    bg-background text-foreground
    border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive
- AlertDescription
    text-sm [&_p]:leading-relaxed
```

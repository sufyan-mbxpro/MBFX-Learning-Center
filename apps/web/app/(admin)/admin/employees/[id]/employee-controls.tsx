"use client";

// Employee detail controls (changes-01): employment-status select with
// confirmation, and the basic-info edit modal. TERMINATED is absent from
// the status options on purpose — that path is the offboard flow's
// transaction, enforced server-side.
import * as React from "react";
import { Pencil } from "lucide-react";
import { Button } from "@repo/ui/components/button";
import { ConfirmDialog } from "@repo/ui/components/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { Textarea } from "@repo/ui/components/textarea";
import { setEmployeeStatusAction, updateEmployeeAction } from "../../_actions/user-actions.ts";
import { AdminCombobox } from "../../_components/combobox.tsx";
import { useServerAction } from "../../_hooks/use-server-action.ts";

export function EmployeeStatusControl({
  employeeId,
  status,
  statusLabels,
  labels,
}: {
  employeeId: string;
  status: string;
  /** Assignable statuses only — no TERMINATED. */
  statusLabels: Record<string, string>;
  labels: {
    status: string;
    confirmTitle: string;
    confirmStatusChange: string;
    confirm: string;
    cancel: string;
  };
}) {
  const { run, pending } = useServerAction();
  const [target, setTarget] = React.useState<string | null>(null);

  return (
    <>
      <AdminCombobox
        aria-label={labels.status}
        disabled={pending}
        className="w-44"
        value={status}
        onValueChange={(value) => {
          if (value && value !== status) setTarget(value);
        }}
        options={Object.entries(statusLabels).map(([value, label]) => ({ value, label }))}
      />
      <ConfirmDialog
        open={target !== null}
        onOpenChange={(next) => {
          if (!next) setTarget(null);
        }}
        title={labels.confirmTitle}
        description={`${labels.confirmStatusChange} ${target ? (statusLabels[target] ?? target) : ""}`}
        confirmLabel={labels.confirm}
        cancelLabel={labels.cancel}
        destructive={target !== "ACTIVE"}
        onConfirm={() => {
          if (target) run(() => setEmployeeStatusAction(employeeId, target));
          setTarget(null);
        }}
      />
    </>
  );
}

export interface EmployeeEditValues {
  firstName: string;
  lastName: string;
  phone: string;
  location: string;
  departmentId: string;
  designationId: string;
  reportingToId: string;
  notes: string;
}

export function EmployeeEditDialog({
  employeeId,
  initial,
  departments,
  designations,
  reportingOptions,
  labels,
}: {
  employeeId: string;
  initial: EmployeeEditValues;
  departments: { id: string; name: string }[];
  designations: { id: string; title: string }[];
  reportingOptions: { id: string; name: string }[];
  labels: {
    edit: string;
    editDescription: string;
    save: string;
    cancel: string;
    firstName: string;
    lastName: string;
    phone: string;
    location: string;
    department: string;
    designation: string;
    reportingTo: string;
    notes: string;
    none: string;
  };
}) {
  const [open, setOpen] = React.useState(false);
  const { run, pending } = useServerAction();
  const [form, setForm] = React.useState(initial);

  const set = <K extends keyof EmployeeEditValues>(key: K, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const submit = () =>
    run(
      () =>
        updateEmployeeAction(employeeId, {
          firstName: form.firstName,
          lastName: form.lastName,
          phone: form.phone || null,
          location: form.location || null,
          departmentId: form.departmentId || null,
          designationId: form.designationId || null,
          reportingToId: form.reportingToId || null,
          notes: form.notes || null,
        }),
      { onDone: () => setOpen(false) },
    );

  const optionSelect = (
    id: string,
    label: string,
    value: string,
    options: { id: string; label: string }[],
    key: keyof EmployeeEditValues,
  ) => (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <AdminCombobox
        id={id}
        value={value}
        onValueChange={(next) => set(key, next)}
        options={[
          { value: "", label: labels.none },
          ...options.map((option) => ({ value: option.id, label: option.label })),
        ]}
      />
    </div>
  );

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Pencil data-icon="inline-start" aria-hidden /> {labels.edit}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{labels.edit}</DialogTitle>
            <DialogDescription>{labels.editDescription}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="emp-first">{labels.firstName}</Label>
              <Input
                id="emp-first"
                value={form.firstName}
                onChange={(e) => set("firstName", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="emp-last">{labels.lastName}</Label>
              <Input
                id="emp-last"
                value={form.lastName}
                onChange={(e) => set("lastName", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="emp-phone">{labels.phone}</Label>
              <Input
                id="emp-phone"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="emp-location">{labels.location}</Label>
              <Input
                id="emp-location"
                value={form.location}
                onChange={(e) => set("location", e.target.value)}
              />
            </div>
            {optionSelect(
              "emp-department",
              labels.department,
              form.departmentId,
              departments.map((d) => ({ id: d.id, label: d.name })),
              "departmentId",
            )}
            {optionSelect(
              "emp-designation",
              labels.designation,
              form.designationId,
              designations.map((d) => ({ id: d.id, label: d.title })),
              "designationId",
            )}
            <div className="sm:col-span-2">
              {optionSelect(
                "emp-reporting",
                labels.reportingTo,
                form.reportingToId,
                reportingOptions.map((o) => ({ id: o.id, label: o.name })),
                "reportingToId",
              )}
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="emp-notes">{labels.notes}</Label>
              <Textarea
                id="emp-notes"
                rows={3}
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              {labels.cancel}
            </Button>
            <Button
              onClick={submit}
              disabled={pending || !form.firstName.trim() || !form.lastName.trim()}
            >
              {labels.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

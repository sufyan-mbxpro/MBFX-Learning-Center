// ADR-077 — a Field wires its control. Every assertion here is an attribute a
// screen reader depends on and a sighted tester never sees, so it breaks
// silently unless it is pinned.
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Checkbox } from "./checkbox.tsx";
import { Combobox } from "./combobox.tsx";
import { Field, FieldDescription, FieldError, FieldLabel } from "./field.tsx";
import { Input } from "./input.tsx";
import { Switch } from "./switch.tsx";
import { Textarea } from "./textarea.tsx";

afterEach(cleanup);

const describedBy = (el: HTMLElement) => (el.getAttribute("aria-describedby") ?? "").split(" ");

describe("Field — label and control", () => {
  it("labels its control without an id at the call site", () => {
    render(
      <Field>
        <FieldLabel>Name</FieldLabel>
        <Input />
      </Field>,
    );
    const input = screen.getByRole("textbox", { name: "Name" });
    expect(input.id).not.toBe("");
  });

  it("uses controlId when the caller needs to know the id", () => {
    render(
      <Field controlId="role-name">
        <FieldLabel>Name</FieldLabel>
        <Input />
      </Field>,
    );
    expect(screen.getByRole("textbox", { name: "Name" }).id).toBe("role-name");
  });

  it("marks a required field with a hidden asterisk and a required control", () => {
    const { container } = render(
      <Field required>
        <FieldLabel>Name</FieldLabel>
        <Input />
      </Field>,
    );
    const input = screen.getByRole("textbox", { name: "Name" });
    expect(input).toHaveProperty("required", true);
    const star = container.querySelector("[data-slot=field-required]");
    expect(star?.textContent).toBe("*");
    expect(star?.getAttribute("aria-hidden")).toBe("true");
  });

  it("adds nothing to an optional field", () => {
    const { container } = render(
      <Field>
        <FieldLabel>Name</FieldLabel>
        <Input />
      </Field>,
    );
    expect(container.querySelector("[data-slot=field-required]")).toBeNull();
    expect(screen.getByRole("textbox")).toHaveProperty("required", false);
    expect(container.textContent).not.toMatch(/optional/i);
  });
});

describe("Field — description and error", () => {
  it("describes the control by its description", () => {
    render(
      <Field>
        <FieldLabel>Slug</FieldLabel>
        <Input />
        <FieldDescription>Lowercase letters and hyphens.</FieldDescription>
      </Field>,
    );
    const input = screen.getByRole("textbox");
    const description = screen.getByText("Lowercase letters and hyphens.");
    expect(describedBy(input)).toContain(description.id);
    expect(input.getAttribute("aria-invalid")).toBeNull();
  });

  it("marks an invalid control and points it at its message", () => {
    render(
      <Field invalid>
        <FieldLabel>Name</FieldLabel>
        <Input />
        <FieldDescription>Shown on the role list.</FieldDescription>
        <FieldError>This field is required.</FieldError>
      </Field>,
    );
    const input = screen.getByRole("textbox");
    const error = screen.getByText("This field is required.");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(describedBy(input)).toEqual([screen.getByText("Shown on the role list.").id, error.id]);
    // Accessible ink (audit F-03), and no live region per field.
    expect(error.className).toContain("text-destructive-interactive");
    expect(error.getAttribute("role")).toBeNull();
  });

  it("renders no error element while there is no message", () => {
    const { container } = render(
      <Field>
        <FieldLabel>Name</FieldLabel>
        <Input />
        <FieldError>{undefined}</FieldError>
      </Field>,
    );
    expect(container.querySelector("[data-slot=field-error]")).toBeNull();
  });

  it("joins a control's own aria-describedby rather than replacing it", () => {
    render(
      <Field invalid>
        <FieldLabel>Name</FieldLabel>
        <Input aria-describedby="counter" />
        <FieldError>Too long.</FieldError>
      </Field>,
    );
    expect(describedBy(screen.getByRole("textbox"))).toContain("counter");
    expect(describedBy(screen.getByRole("textbox"))).toContain(screen.getByText("Too long.").id);
  });
});

describe("Field — every @repo/ui control reads it", () => {
  it("Textarea", () => {
    render(
      <Field invalid required>
        <FieldLabel>Body</FieldLabel>
        <Textarea />
      </Field>,
    );
    const textarea = screen.getByRole("textbox", { name: "Body" });
    expect(textarea).toHaveProperty("required", true);
    expect(textarea.getAttribute("aria-invalid")).toBe("true");
  });

  it("Combobox, with required as aria-required on its button trigger", () => {
    render(
      <Field invalid required>
        <FieldLabel>Track</FieldLabel>
        <Combobox
          options={[
            { value: "forex", label: "Forex" },
            { value: "crypto", label: "Crypto" },
          ]}
          value=""
          onValueChange={vi.fn()}
        />
      </Field>,
    );
    const trigger = screen.getByRole("combobox", { name: /Track/ });
    expect(trigger.getAttribute("aria-required")).toBe("true");
    expect(trigger.getAttribute("aria-invalid")).toBe("true");
    expect(trigger.hasAttribute("required")).toBe(false);
  });

  it("Switch and Checkbox take the Field's id", () => {
    render(
      <>
        <Field orientation="horizontal" controlId="sw">
          <Switch />
          <FieldLabel>Enabled</FieldLabel>
        </Field>
        <Field orientation="horizontal" controlId="cb">
          <Checkbox />
          <FieldLabel>Featured</FieldLabel>
        </Field>
      </>,
    );
    expect(document.getElementById("sw")).not.toBeNull();
    expect(document.getElementById("cb")).not.toBeNull();
  });

  it("leaves a control outside any Field untouched", () => {
    render(<Input aria-label="Search" />);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    // Base UI's Input names itself; what matters is that no Field's id does.
    expect(input.id).not.toMatch(/-control$/);
    expect(input.required).toBe(false);
    expect(input.getAttribute("aria-invalid")).toBeNull();
    expect(input.getAttribute("aria-describedby")).toBeNull();
  });
});

// ADR-089 — the vertical variant's `*:w-full` is what makes an Input fill its
// field, and it reached the Switch too: a 44×24 control (ADR-074) drawn as a
// bar the width of the settings rail. jsdom applies no stylesheet, so the
// class list is the only thing there is to assert — which is exactly the
// property, since the bug WAS a class list.
describe("ADR-089 — a vertical Field does not stretch a switch", () => {
  const classesOf = (orientation: "vertical" | "horizontal") => {
    cleanup();
    render(
      <Field orientation={orientation}>
        <Switch />
        <FieldLabel>Live</FieldLabel>
      </Field>,
    );
    return screen.getByRole("group").className;
  };

  it("exempts [data-slot=switch] from the stretch", () => {
    const vertical = classesOf("vertical");
    // Both halves: the stretch is still there for everything else, and the
    // switch is pulled back to its own geometry. Asserting only the second
    // would pass if `*:w-full` were dropped altogether, which would leave
    // every Input in the admin sized to its content.
    expect(vertical).toContain("*:w-full");
    expect(vertical).toContain("[&>[data-slot=switch]]:w-11");
  });

  it("does not need the exemption on the horizontal variant", () => {
    // Nothing stretches there, so the rule would be noise — and its absence
    // is what says the vertical one is a fix rather than a decoration.
    expect(classesOf("horizontal")).not.toContain("[&>[data-slot=switch]]");
  });

  it("still wires the switch it no longer stretches", () => {
    cleanup();
    render(
      <Field orientation="vertical">
        <Switch />
        <FieldLabel>Live</FieldLabel>
      </Field>,
    );
    expect(screen.getByRole("switch", { name: "Live" })).toBeTruthy();
  });
});

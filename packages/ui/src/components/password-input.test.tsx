// changes-21 F1 (ADR-079 #8). The toggle's whole job is invisible to a type
// check: the input's `type`, the button's pressed state, and the label that
// says what the next press does. All three break silently.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Field, FieldLabel } from "./field.tsx";
import { PasswordInput } from "./password-input.tsx";

afterEach(cleanup);

const LABELS = { showLabel: "Show password", hideLabel: "Hide password" };

function renderInField() {
  return render(
    <Field>
      <FieldLabel>Password</FieldLabel>
      <PasswordInput {...LABELS} />
    </Field>,
  );
}

describe("PasswordInput", () => {
  it("hides the value until asked", () => {
    renderInField();
    expect(screen.getByLabelText("Password")).toHaveProperty("type", "password");
    const toggle = screen.getByRole("button", { name: "Show password" });
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
  });

  it("reveals and re-hides on the same control", () => {
    renderInField();
    const input = screen.getByLabelText("Password");
    fireEvent.click(screen.getByRole("button", { name: "Show password" }));

    // The same DOM node, so focus and caret survive the toggle.
    expect(screen.getByLabelText("Password")).toBe(input);
    expect(input).toHaveProperty("type", "text");
    const toggle = screen.getByRole("button", { name: "Hide password" });
    expect(toggle.getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(toggle);
    expect(input).toHaveProperty("type", "password");
    expect(screen.getByRole("button", { name: "Show password" })).toBeTruthy();
  });

  it("keeps the button out of the form's submission path", () => {
    renderInField();
    // A bare <button> inside a form submits it: revealing the password would
    // sign the user in with whatever is typed so far.
    expect(screen.getByRole("button", { name: "Show password" }).getAttribute("type")).toBe(
      "button",
    );
  });

  it("points aria-controls at the input the Field named", () => {
    renderInField();
    const input = screen.getByLabelText("Password");
    expect(input.id).not.toBe("");
    expect(
      screen.getByRole("button", { name: "Show password" }).getAttribute("aria-controls"),
    ).toBe(input.id);
  });

  // ADR-077: a control inside a Field must NOT set its own id — the label
  // would go on pointing at the Field's, and the field would silently lose
  // its name. The Field is told the id instead, and the toggle follows it.
  it("follows the Field's controlId", () => {
    render(
      <Field controlId="profile-password">
        <FieldLabel>Password</FieldLabel>
        <PasswordInput {...LABELS} />
      </Field>,
    );
    expect(screen.getByLabelText("Password").id).toBe("profile-password");
    expect(
      screen.getByRole("button", { name: "Show password" }).getAttribute("aria-controls"),
    ).toBe("profile-password");
  });

  // The three sign-in forms label by hand (they predate Field), so the id
  // comes from the call site and both halves must still agree.
  it("takes an explicit id outside a Field", () => {
    render(<PasswordInput id="signin-password" aria-label="Password" {...LABELS} />);
    expect(screen.getByLabelText("Password").id).toBe("signin-password");
    expect(
      screen.getByRole("button", { name: "Show password" }).getAttribute("aria-controls"),
    ).toBe("signin-password");
  });

  it("works outside a Field, with an id of its own", () => {
    render(<PasswordInput aria-label="Password" {...LABELS} />);
    const input = screen.getByLabelText("Password");
    expect(input.id).not.toBe("");
    expect(
      screen.getByRole("button", { name: "Show password" }).getAttribute("aria-controls"),
    ).toBe(input.id);
  });

  it("carries the Field's required and invalid state through to the input", () => {
    render(
      <Field required invalid>
        <FieldLabel>Password</FieldLabel>
        <PasswordInput {...LABELS} />
      </Field>,
    );
    const input = screen.getByLabelText(/Password/);
    expect(input).toHaveProperty("required", true);
    expect(input.getAttribute("aria-invalid")).toBe("true");
  });

  it("disables the toggle with the field", () => {
    render(<PasswordInput aria-label="Password" disabled {...LABELS} />);
    expect(screen.getByRole("button", { name: "Show password" })).toHaveProperty("disabled", true);
  });
});

// The verification seam (ADR-124): listeners run, a failing one is contained,
// and re-registering under a key replaces rather than duplicates.
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  clearEmailVerifiedListeners,
  notifyEmailVerified,
  onEmailVerified,
} from "./email-verified.ts";

const USER = { id: "u1", email: "u1@example.test" };

afterEach(() => {
  clearEmailVerifiedListeners();
  vi.restoreAllMocks();
});

describe("onEmailVerified / notifyEmailVerified", () => {
  it("calls every registered listener with the verified user", async () => {
    const a = vi.fn(async () => {});
    const b = vi.fn(async () => {});
    onEmailVerified("a", a);
    onEmailVerified("b", b);

    await notifyEmailVerified(USER);
    expect(a).toHaveBeenCalledWith(USER);
    expect(b).toHaveBeenCalledWith(USER);
  });

  it("replaces a listener registered again under the same key (a hot reload)", async () => {
    const first = vi.fn(async () => {});
    const second = vi.fn(async () => {});
    onEmailVerified("newsletter", first);
    onEmailVerified("newsletter", second);

    await notifyEmailVerified(USER);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("never lets a failing listener fail the verification or skip the others", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const after = vi.fn(async () => {});
    onEmailVerified("broken", async () => {
      throw new Error("database down");
    });
    onEmailVerified("after", after);

    await expect(notifyEmailVerified(USER)).resolves.toBeUndefined();
    expect(after).toHaveBeenCalledTimes(1);
  });

  it("does nothing with no listeners", async () => {
    await expect(notifyEmailVerified(USER)).resolves.toBeUndefined();
  });
});

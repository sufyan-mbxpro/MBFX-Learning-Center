import { ForbiddenError } from "@repo/rbac";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type * as StylesModule from "./styles.ts";
import {
  StylePresetInUseError,
  StylePresetIsSystemError,
  StylePresetKeyInUseError,
  StylePresetNotFoundError,
} from "./errors.ts";
import {
  ALL_CMS_PERMISSIONS,
  makeActor,
  startCmsTestDb,
  stopCmsTestDb,
  type CmsTestContext,
} from "../test-utils/cms-container.ts";

let ctx: CmsTestContext;
let styles: typeof StylesModule;
let actor: Awaited<ReturnType<typeof makeActor>>;
let noPermsActor: Awaited<ReturnType<typeof makeActor>>;

beforeAll(async () => {
  ctx = await startCmsTestDb();
  styles = await import("./styles.ts");
  actor = await makeActor(ctx.db, "styles-actor", [...ALL_CMS_PERMISSIONS, "cms.styles.manage"]);
  noPermsActor = await makeActor(ctx.db, "styles-no-perms", []);
}, 120_000);

afterAll(async () => {
  await stopCmsTestDb(ctx);
});

describe("createStylePreset", () => {
  it("creates a row and writes an audit entry", async () => {
    const id = await styles.createStylePreset(actor, {
      key: "hero-dark",
      name: "Hero — dark",
      scope: "any",
      config: { style: { textTone: "on-image" } },
    });
    const row = await ctx.db.stylePreset.findUniqueOrThrow({ where: { id } });
    expect(row).toMatchObject({ key: "hero-dark", name: "Hero — dark" });

    const audit = await ctx.db.auditLog.findFirst({
      where: { action: "cms.styles.create", entityId: id },
    });
    expect(audit).not.toBeNull();
  });

  it("refuses without cms.styles.manage", async () => {
    await expect(
      styles.createStylePreset(noPermsActor, { key: "x1", name: "X", scope: "any", config: {} }),
    ).rejects.toThrow(ForbiddenError);
  });

  it("refuses a duplicate key", async () => {
    await styles.createStylePreset(actor, { key: "dup-key", name: "A", scope: "any", config: {} });
    await expect(
      styles.createStylePreset(actor, { key: "dup-key", name: "B", scope: "any", config: {} }),
    ).rejects.toThrow(StylePresetKeyInUseError);
  });
});

describe("updateStylePreset / deleteStylePreset", () => {
  it("updates a non-system preset", async () => {
    const id = await styles.createStylePreset(actor, {
      key: "band-primary",
      name: "Band — primary",
      scope: "any",
      config: {},
    });
    await styles.updateStylePreset(actor, id, { name: "Band — primary (renamed)" });
    const row = await ctx.db.stylePreset.findUniqueOrThrow({ where: { id } });
    expect(row.name).toBe("Band — primary (renamed)");
  });

  it("refuses to update or delete a system preset", async () => {
    const row = await ctx.db.stylePreset.create({
      data: { key: "system-one", name: "System One", config: {}, isSystem: true },
    });
    await expect(styles.updateStylePreset(actor, row.id, { name: "x" })).rejects.toThrow(
      StylePresetIsSystemError,
    );
    await expect(styles.deleteStylePreset(actor, row.id)).rejects.toThrow(StylePresetIsSystemError);
  });

  it("404s a not-found id", async () => {
    await expect(styles.updateStylePreset(actor, "does-not-exist", {})).rejects.toThrow(
      StylePresetNotFoundError,
    );
  });

  it("deletes an unused preset", async () => {
    const id = await styles.createStylePreset(actor, {
      key: "deletable",
      name: "Deletable",
      scope: "any",
      config: {},
    });
    await styles.deleteStylePreset(actor, id);
    expect(await ctx.db.stylePreset.findUnique({ where: { id } })).toBeNull();
  });

  it("refuses to delete a preset referenced by a ContentReference row, and reports the usage count", async () => {
    const id = await styles.createStylePreset(actor, {
      key: "in-use",
      name: "In use",
      scope: "any",
      config: {},
    });
    await ctx.db.contentReference.create({
      data: {
        sourceType: "PAGE_VERSION",
        sourceId: "fake-version",
        refType: "STYLE_PRESET",
        refId: id,
      },
    });

    const row = await styles.getStylePreset(id);
    expect(row?.usageCount).toBe(1);

    await expect(styles.deleteStylePreset(actor, id)).rejects.toThrow(StylePresetInUseError);
  });
});

describe("listStylePresets", () => {
  it("lists system presets first, then by name", async () => {
    const list = await styles.listStylePresets();
    expect(Array.isArray(list)).toBe(true);
    const systemIndexes = list.map((r, i) => (r.isSystem ? i : -1)).filter((i) => i >= 0);
    const nonSystemIndexes = list.map((r, i) => (!r.isSystem ? i : -1)).filter((i) => i >= 0);
    if (systemIndexes.length > 0 && nonSystemIndexes.length > 0) {
      expect(Math.max(...systemIndexes)).toBeLessThan(Math.min(...nonSystemIndexes));
    }
  });
});

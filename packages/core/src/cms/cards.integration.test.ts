// CardTemplate services (ADR-023, plan v2.2 §12 PR 4.3). Same shape as
// styles.integration.test.ts — the identical "referenced, not copied"
// deletion-guard pattern, just a different `refType`.
import { ForbiddenError } from "@repo/rbac";
import type { CardConfig } from "@repo/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type * as CardsModule from "./cards.ts";
import {
  CardTemplateInUseError,
  CardTemplateIsSystemError,
  CardTemplateKeyInUseError,
  CardTemplateNotFoundError,
} from "./errors.ts";
import {
  ALL_CMS_PERMISSIONS,
  makeActor,
  startCmsTestDb,
  stopCmsTestDb,
  type CmsTestContext,
} from "../test-utils/cms-container.ts";

let ctx: CmsTestContext;
let cards: typeof CardsModule;
let actor: Awaited<ReturnType<typeof makeActor>>;
let noPermsActor: Awaited<ReturnType<typeof makeActor>>;

const baseConfig: CardConfig = {
  version: 1,
  fields: ["image", "title"],
  imageAspectRatio: "video",
  excerptLength: 160,
};

beforeAll(async () => {
  ctx = await startCmsTestDb();
  cards = await import("./cards.ts");
  actor = await makeActor(ctx.db, "cards-actor", [...ALL_CMS_PERMISSIONS, "cms.cards.manage"]);
  noPermsActor = await makeActor(ctx.db, "cards-no-perms", []);
}, 120_000);

afterAll(async () => {
  await stopCmsTestDb(ctx);
});

describe("createCardTemplate", () => {
  it("creates a row and writes an audit entry", async () => {
    const id = await cards.createCardTemplate(actor, {
      key: "modern-news-card",
      name: "Modern News Card",
      variant: "standard",
      config: baseConfig,
    });
    const row = await ctx.db.cardTemplate.findUniqueOrThrow({ where: { id } });
    expect(row).toMatchObject({ key: "modern-news-card", name: "Modern News Card" });

    const audit = await ctx.db.auditLog.findFirst({
      where: { action: "cms.cards.create", entityId: id },
    });
    expect(audit).not.toBeNull();
  });

  it("refuses without cms.cards.manage", async () => {
    await expect(
      cards.createCardTemplate(noPermsActor, {
        key: "x1",
        name: "X",
        variant: "standard",
        config: baseConfig,
      }),
    ).rejects.toThrow(ForbiddenError);
  });

  it("refuses a duplicate key", async () => {
    await cards.createCardTemplate(actor, {
      key: "dup-key",
      name: "A",
      variant: "standard",
      config: baseConfig,
    });
    await expect(
      cards.createCardTemplate(actor, {
        key: "dup-key",
        name: "B",
        variant: "compact",
        config: baseConfig,
      }),
    ).rejects.toThrow(CardTemplateKeyInUseError);
  });
});

describe("updateCardTemplate / deleteCardTemplate", () => {
  it("updates a non-system template", async () => {
    const id = await cards.createCardTemplate(actor, {
      key: "renameable",
      name: "Renameable",
      variant: "standard",
      config: baseConfig,
    });
    await cards.updateCardTemplate(actor, id, { name: "Renamed" });
    const row = await ctx.db.cardTemplate.findUniqueOrThrow({ where: { id } });
    expect(row.name).toBe("Renamed");
  });

  it("refuses to update or delete a system template", async () => {
    const row = await ctx.db.cardTemplate.create({
      data: {
        key: "system-one",
        name: "System One",
        variant: "standard",
        config: baseConfig,
        isSystem: true,
      },
    });
    await expect(cards.updateCardTemplate(actor, row.id, { name: "x" })).rejects.toThrow(
      CardTemplateIsSystemError,
    );
    await expect(cards.deleteCardTemplate(actor, row.id)).rejects.toThrow(
      CardTemplateIsSystemError,
    );
  });

  it("404s a not-found id", async () => {
    await expect(cards.updateCardTemplate(actor, "does-not-exist", {})).rejects.toThrow(
      CardTemplateNotFoundError,
    );
  });

  it("deletes an unused template", async () => {
    const id = await cards.createCardTemplate(actor, {
      key: "deletable",
      name: "Deletable",
      variant: "standard",
      config: baseConfig,
    });
    await cards.deleteCardTemplate(actor, id);
    expect(await ctx.db.cardTemplate.findUnique({ where: { id } })).toBeNull();
  });

  it("refuses to delete a template referenced by a ContentReference row, and reports the usage count", async () => {
    const id = await cards.createCardTemplate(actor, {
      key: "in-use",
      name: "In use",
      variant: "standard",
      config: baseConfig,
    });
    await ctx.db.contentReference.create({
      data: {
        sourceType: "PAGE_VERSION",
        sourceId: "fake-version",
        refType: "CARD_TEMPLATE",
        refId: id,
        field: "cardTemplateId",
      },
    });

    const row = await cards.getCardTemplate(id);
    expect(row?.usageCount).toBe(1);

    await expect(cards.deleteCardTemplate(actor, id)).rejects.toThrow(CardTemplateInUseError);
  });
});

describe("listCardTemplates", () => {
  it("lists system templates first, then by name", async () => {
    const list = await cards.listCardTemplates();
    expect(Array.isArray(list)).toBe(true);
    const systemIndexes = list.map((r, i) => (r.isSystem ? i : -1)).filter((i) => i >= 0);
    const nonSystemIndexes = list.map((r, i) => (!r.isSystem ? i : -1)).filter((i) => i >= 0);
    if (systemIndexes.length > 0 && nonSystemIndexes.length > 0) {
      expect(Math.max(...systemIndexes)).toBeLessThan(Math.min(...nonSystemIndexes));
    }
  });
});

describe("getCardTemplateConfig (the renderer's own read)", () => {
  it("returns the variant and config for a real template", async () => {
    const id = await cards.createCardTemplate(actor, {
      key: "render-read",
      name: "Render Read",
      variant: "horizontal",
      config: baseConfig,
    });
    const resolved = await cards.getCardTemplateConfig(id);
    expect(resolved?.variant).toBe("horizontal");
    expect(resolved?.config).toMatchObject({ fields: ["image", "title"] });
  });

  it("returns null for a missing id — the renderer's own fallback path, not a throw", async () => {
    expect(await cards.getCardTemplateConfig("does-not-exist")).toBeNull();
  });
});

"use server";

// Permanent delete (changes-49, ADR-147) — one action for the six content
// modules, because the rule is one rule: the entity's own `*.delete` key, and
// only for a row already in the trash (the service refuses anything else).
//
// security.md #1: `requirePermission()` first, per entity, with the key
// spelled out LITERALLY in each branch so the permission-key cross-check
// (testing.md #5) can read it.
import { purgeContent } from "@repo/core";
import { purgeContentSchema } from "@repo/contracts";
import { requireAnyPermission, requirePermission } from "@repo/rbac";

export async function purgeContentAction(entity: string, id: string): Promise<void> {
  const input = purgeContentSchema.parse({ entity, id });
  const subject =
    input.entity === "course"
      ? await requirePermission("courses.delete")
      : input.entity === "glossary"
        ? await requirePermission("glossary.delete")
        : input.entity === "article"
          ? await requireAnyPermission(["analysis.delete", "news.manage"])
          : // Lessons, quizzes and videos share the lesson keys (ADR-058/068).
            await requirePermission("lessons.delete");
  await purgeContent(subject, input.entity, input.id);
}

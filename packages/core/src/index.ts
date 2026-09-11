// @repo/core — domain services (courses, glossary, tools, market).
// Route handlers never touch Prisma directly; they call services here.
// Implementation lands across Modules 08, 11, 13 (see plan.md Part D).
//
// recordAudit() is the one exception, added in Module 04 per ADR-011: every
// mutation writes an audit row (security.md #5), and @repo/rbac's own ADR
// put that responsibility here rather than in rbac itself.
import { db } from "@repo/db";

export * from "./navigation.ts";
export * from "./social-links.ts";
export * from "./admin.ts";
export * from "./admin-reads.ts";
export * from "./users.ts";
export * from "./employees.ts";
export * from "./roles.ts";
export * from "./content.ts";
export * from "./public-content.ts";
export * from "./articles.ts";
export * from "./content-relations.ts";
export * from "./public-articles.ts";
export * from "./courses.ts";
export * from "./course-sections.ts";
export * from "./lessons.ts";
export * from "./public-courses.ts";
export * from "./progress.ts";
export * from "./lesson-feedback.ts";
export * from "./quizzes.ts";
export * from "./videos.ts";
export * from "./learn-analytics.ts";
export * from "./glossary-topics.ts";
export * from "./market.ts";
export * from "./notifications.ts";
export * from "./search.ts";
export * from "./media.ts";
export * from "./brand-assets.ts";
export * from "./cms/index.ts";

export interface RecordAuditInput {
  userId: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  changes?: { before?: unknown; after?: unknown };
  ipAddress?: string | null;
  userAgent?: string | null;
}

export async function recordAudit(input: RecordAuditInput): Promise<void> {
  await db.auditLog.create({
    data: {
      userId: input.userId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      changes: input.changes as never,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    },
  });
}

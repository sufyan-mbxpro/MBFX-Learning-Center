import { NextResponse } from "next/server";
import {
  AI_PAYLOAD_SCHEMAS,
  AI_STREAM_ERROR_PREFIX,
  aiRunSchema,
  type AiFeatureKey,
  type AiFillModule,
  type AiAssistantAction,
  type AiStudioAction,
  AI_ASSISTANT_ACTIONS,
  AI_STUDIO_ACTIONS,
} from "@repo/contracts";
import { AiError, runAiTask, streamAiTask } from "@repo/ai";
import { notifyAiBudget } from "@repo/core";
import { ForbiddenError, canAny, requirePermission, type Subject } from "@repo/rbac";

// **The one generation endpoint** (ADR-097 #2).
//
// A route handler rather than a server action, for two reasons: the writing
// assistant streams, and one door means one gate. It lives under
// `app/(admin)/admin/api/`, so it is inside the proxy's STAFF gate and the
// admin CSP (ADR-006) — and `requirePermission` still runs first, because the
// proxy is a gate, not the boundary (security.md #3).
//
// The handler does four things and delegates the fifth. It never touches
// Prisma, never reaches a driver, and never decides what a feature may do:
// that is `@repo/ai`'s job, behind one call.

/**
 * Which content key governs each feature's SURFACE.
 *
 * This is the answer to "why no per-feature permission key" (ADR-097 #10): the
 * key that governs the ENTITY governs the AI that writes into it. A subject
 * with `ai.use` but no article permission cannot generate an article summary,
 * and no new key was minted to say so — the fifth time this repo has declined
 * keys for a new surface, after quizzes, glossary topics, videos and
 * instruments.
 *
 * `requireAnyPermission` semantics: holding ONE of the listed keys is enough,
 * because an article is governed by `news.manage` or `analysis.*` depending on
 * which kind is being edited, and the route does not know which.
 */
const FEATURE_SURFACE_PERMISSIONS: Record<AiFeatureKey, string[] | null> = {
  writing_assistant: [
    "news.manage",
    "analysis.update",
    "courses.update",
    "lessons.update",
    "glossary.update",
    "tools.update",
    // changes-46 #4: the email template body. Its save key, per the rule above.
    "email.templates.update",
  ],
  // Every editor with an SEO section: the key that saves THAT editor.
  seo_generation: [
    "seo.update",
    "news.manage",
    "analysis.update",
    "courses.update",
    "lessons.update",
    "glossary.update",
    "tools.update",
  ],
  translation: ["translations.update"],
  summarization: ["news.manage", "analysis.update"],
  alt_text: ["media.update"],
  quiz_generation: ["lessons.update"],
  // The union of the modules below. This is the FIRST gate only; the payload
  // names a module, and `requireFillModule` then demands THAT module's key, so
  // holding `glossary.update` does not buy course generation (ADR-126 §6).
  form_fill: [
    "news.manage",
    "analysis.update",
    "courses.update",
    "lessons.update",
    "glossary.update",
    "tools.update",
  ],
  // ADR-129 §4 — NO surface key, stated rather than implied. The studio writes
  // into no entity: its result is copied out by hand, so there is no content
  // key whose save it could bypass, and `ai.use` above is the whole gate. An
  // empty array would mean the opposite — `canAny` refuses an empty list.
  writing_studio: null,
};

/**
 * The content key each fillable editor saves under. Quizzes and video topics
 * share the lesson keys, as their own save actions do.
 */
const FILL_MODULE_PERMISSIONS: Record<AiFillModule, string[]> = {
  article: ["news.manage", "analysis.update"],
  course: ["courses.update"],
  lesson: ["lessons.update"],
  video_topic: ["lessons.update"],
  quiz: ["lessons.update"],
  glossary_term: ["glossary.update"],
  glossary_topic: ["glossary.update"],
  tool: ["tools.update"],
};

function requireFillModule(subject: Subject, module: AiFillModule): void {
  const permissions = FILL_MODULE_PERMISSIONS[module];
  if (!canAny(subject, permissions)) {
    throw new ForbiddenError(
      `Missing any of ${permissions.join(", ")} for AI form fill of ${module}`,
    );
  }
}

function requireFeatureSurface(subject: Subject, feature: AiFeatureKey): void {
  const permissions = FEATURE_SURFACE_PERMISSIONS[feature];
  if (permissions === null) return;
  if (!canAny(subject, permissions)) {
    throw new ForbiddenError(`Missing any of ${permissions.join(", ")} for AI feature ${feature}`);
  }
}

/** HTTP status for a taxonomy reason. Never a provider message (ADR-097 #7). */
function statusFor(reason: string): number {
  switch (reason) {
    case "globally_disabled":
    case "feature_disabled":
    case "no_provider":
    case "missing_key":
    case "secret_unreadable":
    case "model_no_vision":
      // Not 403: nothing about the SUBJECT is wrong. The platform is off, and
      // saying "forbidden" would send an admin looking at their own roles.
      return 409;
    case "budget_exceeded":
    case "rate_limited":
      return 429;
    case "content_too_large":
      return 413;
    case "provider_timeout":
      return 504;
    case "provider_auth":
    case "provider_rate_limit":
    case "provider_error":
      return 502;
    default:
      return 400;
  }
}

/**
 * The action's own tier and effort, when the assistant or the studio names one
 * (ADR-099 #4, ADR-129 §2). The payload has already been parsed, so `action`
 * is a registry key; the lookup is still a find, never a cast into a table.
 */
function actionOverrides(feature: AiFeatureKey, payload: unknown) {
  const action = (payload as { action?: AiAssistantAction | AiStudioAction })?.action;
  const entry =
    feature === "writing_assistant"
      ? AI_ASSISTANT_ACTIONS.find((a) => a.key === action)
      : feature === "writing_studio"
        ? AI_STUDIO_ACTIONS.find((a) => a.key === action)
        : undefined;
  return entry ? { modelRole: entry.modelRole, effort: entry.effort } : {};
}

export async function POST(request: Request): Promise<Response> {
  // security.md #1 — the first line, before anything is parsed or read.
  const subject = await requirePermission("ai.use");

  const body = aiRunSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json(
      { error: "Invalid AI request", issues: body.error.issues },
      { status: 400 },
    );
  }

  const { feature, payload, entity, stream } = body.data;

  // A feature whose surface the subject cannot edit is refused HERE, not in
  // core: the AI is a way of filling a field, and the field's own key decides.
  requireFeatureSurface(subject, feature);

  // Parse, don't spread (security.md #6). `runAiTask` parses again — it is the
  // boundary that has to hold — but failing here gives the caller the issues.
  const parsedPayload = AI_PAYLOAD_SCHEMAS[feature].safeParse(payload);
  if (!parsedPayload.success) {
    return NextResponse.json(
      { error: "Invalid payload", issues: parsedPayload.error.issues },
      { status: 400 },
    );
  }

  if (feature === "form_fill") {
    // Re-parsed with the feature's own schema rather than cast: the union
    // above is typed across every feature, and a cast is how a body reaches a
    // gate unparsed (security.md #6). It already succeeded once, so this does too.
    const fill = AI_PAYLOAD_SCHEMAS.form_fill.parse(parsedPayload.data);
    requireFillModule(subject, fill.module);
  }

  const input = {
    feature,
    payload: parsedPayload.data,
    actorId: subject.id,
    entity: entity ?? null,
    ...actionOverrides(feature, parsedPayload.data),
    // `@repo/ai` cannot notify — it does not know who a subject is — so the
    // handler passes the one thing it owns: a way to reach core's
    // `recordNotification`. Best-effort by contract on both sides.
    onBudgetEvent: notifyAiBudget,
  };

  if (!stream) {
    try {
      const result = await runAiTask(input);
      return NextResponse.json(result);
    } catch (error) {
      const reason = error instanceof AiError ? error.reason : "provider_error";
      // The taxonomy value, never `error.message` — a provider message can
      // quote the prompt back, and this response reaches a browser.
      return NextResponse.json({ error: reason }, { status: statusFor(reason) });
    }
  }

  // The streaming path. `text/plain` rather than SSE: there is exactly one
  // channel of information — the text — so a protocol with event names would
  // be ceremony, and the client is a fetch reader in an existing client
  // component (no new inline script, security.md #14).
  const encoder = new TextEncoder();
  const body$ = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of streamAiTask(input)) {
          controller.enqueue(encoder.encode(chunk));
        }
      } catch (error) {
        const reason = error instanceof AiError ? error.reason : "provider_error";
        // A stream that has already started cannot change its status code, so
        // the reason is appended in a form the client recognises and the UI
        // renders as an error rather than as text.
        controller.enqueue(encoder.encode(`\n${AI_STREAM_ERROR_PREFIX}${reason}`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(body$, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      // Proxies that buffer would turn a stream into one long pause.
      "X-Accel-Buffering": "no",
    },
  });
}

// Shared error types for the CMS services (Module 16, plan v2.2 §12 PR 1.3).
// Actions in apps/web catch these to render field-level messages; nothing
// here is a permission error — those are @repo/rbac's ForbiddenError,
// thrown directly by the service that owns the row-specific check
// (the content.ts/articles.ts precedent: `can()` inline, not a wrapper).

export class PageNotFoundError extends Error {
  constructor(id: string) {
    super(`Page not found: ${id}`);
    this.name = "PageNotFoundError";
  }
}

export class ReservedPathError extends Error {
  constructor(public segment: string) {
    super(`"${segment}" is a reserved path and cannot be used`);
    this.name = "ReservedPathError";
  }
}

export class PathCollisionError extends Error {
  constructor(
    public locale: string,
    public path: string,
    public collidingPageId: string,
  ) {
    super(`Path "${path}" is already used by another page in locale "${locale}"`);
    this.name = "PathCollisionError";
  }
}

export class ParentNotTranslatedError extends Error {
  constructor(
    public parentId: string,
    public locale: string,
  ) {
    super(`Parent page has no translation in locale "${locale}"`);
    this.name = "ParentNotTranslatedError";
  }
}

export class CyclicParentError extends Error {
  constructor() {
    super("A page cannot be its own ancestor");
    this.name = "CyclicParentError";
  }
}

export class MaxDepthExceededError extends Error {
  constructor(
    public depth: number,
    public max: number,
  ) {
    super(`Parent chain depth ${depth} exceeds the maximum of ${max}`);
    this.name = "MaxDepthExceededError";
  }
}

export class PageHasChildrenError extends Error {
  constructor(public childCount: number) {
    super(`Page has ${childCount} non-deleted child page(s) — reassign or delete them first`);
    this.name = "PageHasChildrenError";
  }
}

export class DraftConflictError extends Error {
  constructor(public currentRevision: number) {
    super(`Draft was changed since this revision was read (now at revision ${currentRevision})`);
    this.name = "DraftConflictError";
  }
}

export class EmptySlugError extends Error {
  constructor() {
    super("Slug is required for every page except the home page");
    this.name = "EmptySlugError";
  }
}

export class PublishGateError extends Error {
  constructor(public errors: string[]) {
    super(`Publish refused: ${errors.join("; ")}`);
    this.name = "PublishGateError";
  }
}

// ADR-033 §4/§5 — reuse-model guards (PR 3.1).

export class StylePresetNotFoundError extends Error {
  constructor(id: string) {
    super(`Style preset not found: ${id}`);
    this.name = "StylePresetNotFoundError";
  }
}

export class StylePresetKeyInUseError extends Error {
  constructor(public key: string) {
    super(`Style preset key "${key}" is already in use`);
    this.name = "StylePresetKeyInUseError";
  }
}

export class StylePresetIsSystemError extends Error {
  constructor(public key: string) {
    super(`"${key}" is a system style preset and cannot be edited or deleted — clone it instead`);
    this.name = "StylePresetIsSystemError";
  }
}

export class StylePresetInUseError extends Error {
  constructor(public usageCount: number) {
    super(`Style preset is used by ${usageCount} placement(s) — remove those first`);
    this.name = "StylePresetInUseError";
  }
}

export class CardTemplateNotFoundError extends Error {
  constructor(id: string) {
    super(`Card template not found: ${id}`);
    this.name = "CardTemplateNotFoundError";
  }
}

export class CardTemplateKeyInUseError extends Error {
  constructor(public key: string) {
    super(`Card template key "${key}" is already in use`);
    this.name = "CardTemplateKeyInUseError";
  }
}

export class CardTemplateIsSystemError extends Error {
  constructor(public key: string) {
    super(`"${key}" is a system card template and cannot be edited or deleted — clone it instead`);
    this.name = "CardTemplateIsSystemError";
  }
}

export class CardTemplateInUseError extends Error {
  constructor(public usageCount: number) {
    super(`Card template is used by ${usageCount} placement(s) — remove those first`);
    this.name = "CardTemplateInUseError";
  }
}

export class LayoutTemplateNotFoundError extends Error {
  constructor(id: string) {
    super(`Layout template not found: ${id}`);
    this.name = "LayoutTemplateNotFoundError";
  }
}

export class LayoutTemplateKeyInUseError extends Error {
  constructor(public key: string) {
    super(`Layout template key "${key}" is already in use`);
    this.name = "LayoutTemplateKeyInUseError";
  }
}

export class LayoutTemplateIsSystemError extends Error {
  constructor(public key: string) {
    super(
      `"${key}" is a system layout template and cannot be edited or deleted — clone it instead`,
    );
    this.name = "LayoutTemplateIsSystemError";
  }
}

/** PR 3.5 — "Discard draft" has nothing to discard TO on a page that has never been published. */
export class NothingPublishedError extends Error {
  constructor(public pageId: string) {
    super(`Page ${pageId} has never been published — there is nothing to discard the draft to`);
    this.name = "NothingPublishedError";
  }
}

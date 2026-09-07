// Renders nothing in production, a named warning in preview (plan §6.2,
// ADR-030 §2). Used for: an unknown block `type`, a node whose props fail
// schema validation after migration, and an unknown `widgetKey`. A page
// must never 500 because one node is bad.
export function FallbackBlock({
  nodeId,
  reason,
  draft,
}: {
  nodeId: string;
  reason: string;
  draft: boolean;
}) {
  if (!draft) return null;
  return (
    <div
      data-slot="cms-fallback-block"
      role="note"
      className="rounded-md border border-dashed border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive"
    >
      Block "{nodeId}" did not render: {reason}
    </div>
  );
}

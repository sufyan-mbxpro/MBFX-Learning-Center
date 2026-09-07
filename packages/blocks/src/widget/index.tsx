// A removed or never-registered feature package never breaks a page
// (ADR-030 §2 point 1): unknown `widgetKey` and invalid `config` both fall
// back exactly like an unknown block type / invalid props do.
//
// No React Suspense boundary here, unlike ADR-030 §2 point 4's illustrative
// wording: this renderer resolves every need BEFORE rendering (ADR-029's
// whole point — collect, resolve, THEN render), so by the time `Render`
// runs the data is already in hand; there is nothing left to suspend on.
// `Skeleton` still has a real job — a widget whose `needs` produced no
// result (an empty/undefined resolution, not merely "not yet run") renders
// it as a static fallback rather than `Render` receiving `data: undefined`
// silently.
import { registerBlock } from "../registry.ts";
import type { BlockComponentProps } from "../registry.ts";
import { FallbackBlock } from "../fallback-block.tsx";
import { migrateWidgetConfig } from "../widgets.ts";
import { definition, type WidgetBlockProps } from "./definition.ts";

function WidgetBlock({
  id,
  props,
  widgets,
  resolvedData,
  locale,
  draft,
}: BlockComponentProps<WidgetBlockProps>) {
  // Never actually undefined: this block isn't `client: true`, so
  // render.tsx always supplies it (registry.ts's note on the field).
  const entry = widgets![props.widgetKey];
  if (!entry) {
    return (
      <FallbackBlock nodeId={id} reason={`unknown widgetKey "${props.widgetKey}"`} draft={draft} />
    );
  }

  const migratedConfig = migrateWidgetConfig(entry.definition, props.configVersion, props.config);
  const parsedConfig = entry.definition.configSchema.safeParse(migratedConfig);
  if (!parsedConfig.success) {
    return <FallbackBlock nodeId={id} reason="invalid widget config" draft={draft} />;
  }

  const hasNeeds = (entry.definition.needs?.(parsedConfig.data) ?? []).length > 0;
  if (hasNeeds && Object.keys(resolvedData ?? {}).length === 0) {
    return <>{entry.runtime.Skeleton()}</>;
  }

  return (
    <>
      {entry.runtime.Render({
        config: parsedConfig.data,
        data: resolvedData,
        locale,
        draft,
        actions: {},
      })}
    </>
  );
}

registerBlock(definition, WidgetBlock);

export { WidgetBlock };

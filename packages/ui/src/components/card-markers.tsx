// The corner markers a card lays over its cover — "Featured", "Premium"
// (ADR-139). The `marker` badge variant exists for exactly this (changes-31):
// two fills, read at a glance over photography.
//
// Bottom-END of the cover on every card that takes it, so the three cards that
// carry markers agree about where to look, and so a marker never competes with
// the top row's level or category chip.
import { Badge } from "@repo/ui/components/badge";

export interface CardMarker {
  label: string;
  /** `marker` is the brand fill, `marker-dark` the secondary. */
  tone?: "marker" | "marker-dark";
}

export function CardMarkers({ markers }: { markers?: readonly CardMarker[] }) {
  if (!markers || markers.length === 0) return null;
  return (
    <span
      data-slot="card-markers"
      className="pointer-events-none absolute end-2.5 bottom-2.5 flex flex-wrap justify-end gap-1"
    >
      {markers.map((marker) => (
        <Badge key={marker.label} variant={marker.tone ?? "marker"} className="shadow-sm">
          {marker.label}
        </Badge>
      ))}
    </span>
  );
}

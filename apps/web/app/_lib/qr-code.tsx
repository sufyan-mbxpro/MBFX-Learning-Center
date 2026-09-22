"use client";

// An otpauth URI as a scannable QR code (ADR-123 #6). Shared by the learner
// account page and the staff profile (ADR-157), so both surfaces use one encoder.
//
// Encoded in the browser by `uqr` (zero dependencies, MIT) and drawn as one
// SVG path, so nothing about the secret leaves the page it was just delivered
// to: no image service, no data URL in a server log.
//
// DARK ON LIGHT IN BOTH THEMES, deliberately. A QR code is not decoration and
// does not follow the colour mode: many scanner apps fail on inverted codes,
// so a dark-mode render that swapped the tokens would look right and not scan.
// `bg-white`/`fill-black` are Tailwind's fixed palette, not brand colours.
import { useMemo } from "react";
import { encode } from "uqr";

export function QrCode({ value, label }: { value: string; label: string }) {
  const { size, path } = useMemo(() => {
    const qr = encode(value, { ecc: "M", border: 2 });
    let d = "";
    qr.data.forEach((row, y) => {
      row.forEach((dark, x) => {
        if (dark) d += `M${x} ${y}h1v1h-1z`;
      });
    });
    return { size: qr.size, path: d };
  }, [value]);

  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${size} ${size}`}
      shapeRendering="crispEdges"
      className="size-44 rounded-sm bg-white fill-black"
    >
      <path d={path} />
    </svg>
  );
}

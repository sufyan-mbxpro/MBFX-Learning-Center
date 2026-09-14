"use client";

// The correlation widget's shell (changes-25 T8).
//
// **Every window is loaded up front, and the switch navigates nothing.** A
// `?window=` search param would make the page dynamic and take
// `/tools/correlation` out of ISR for a control that changes nothing a
// crawler sees; `getCorrelationMatrices` computes all seven from one read
// instead, so switching is instant and costs no request.
import { useState } from "react";
import { CorrelationWidget, type CorrelationData } from "./correlation.tsx";

export function CorrelationPanel({
  matrices,
  windows,
  defaultWindow,
  asOfLabel,
}: {
  matrices: Record<string, CorrelationData>;
  windows: string[];
  defaultWindow: string;
  asOfLabel: string | null;
}) {
  const [window, setWindow] = useState(defaultWindow);
  const data = matrices[window] ?? matrices[defaultWindow];
  if (!data) return null;

  return (
    <CorrelationWidget
      data={data}
      windows={windows}
      onWindowChange={setWindow}
      asOfLabel={asOfLabel}
    />
  );
}

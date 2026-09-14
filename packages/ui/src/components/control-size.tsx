"use client";

import * as React from "react";

// changes-20 (tokens.md §3.2, §6.3): a toolbar's controls share ONE height —
// 36px, the `sm` size — while a form's are 40px. A container that knows it
// is a toolbar (DataTable's filter slot) says so once, here, and the controls
// inside it follow; a call site never has to remember `size="sm"` on each
// filter. Found in the admin visual pass: the Users toolbar rendered a 36px
// search beside 40px dropdowns because the filters were never told.
//
// An explicit `size` on a control still wins over the context.

type ControlSize = "default" | "sm" | "xs";

const ControlSizeContext = React.createContext<ControlSize | undefined>(undefined);

function ControlSizeProvider({ size, children }: { size: ControlSize; children: React.ReactNode }) {
  return <ControlSizeContext value={size}>{children}</ControlSizeContext>;
}

/** The explicit size if the control was given one, else its container's, else `default`. */
function useControlSize(explicit?: ControlSize): ControlSize {
  const inherited = React.useContext(ControlSizeContext);
  return explicit ?? inherited ?? "default";
}

export { ControlSizeProvider, useControlSize };
export type { ControlSize };

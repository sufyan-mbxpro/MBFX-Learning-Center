"use client";

// ADR-140 §3 — an admin screen's actions sit in its title row.
//
// The heading is often drawn by something that does not own the action: a
// section LAYOUT (ADR-106 §2, which cannot know which tab is active), or a
// server page whose editor — a client component — owns the Save button's
// state. Lifting that state up to the heading would mean rewriting every
// editor; instead the heading renders a SLOT and the owner portals its
// buttons into it.
//
//   <HeaderActionsProvider>
//     <AdminPageHeading actions={<><Settings /><HeaderActionsSlot /></>} />
//     …somewhere below…  <HeaderActions><NewThing /></HeaderActions>
//   </HeaderActionsProvider>
//
// The slot is `display: contents`, so portaled buttons become items of the
// heading's own action flex row, AFTER any server-rendered actions — which is
// what puts the primary create action last, at the inline end.
//
// A portal needs a DOM node, so its content mounts after hydration. The
// heading's height is set by the title and description, both of which are
// server-rendered, so the late button does not move anything vertically.
import { createContext, useContext, useState } from "react";
import { createPortal } from "react-dom";

type Ctx = { target: HTMLElement | null; setTarget: (el: HTMLElement | null) => void };

const HeaderActionsContext = createContext<Ctx | null>(null);

export function HeaderActionsProvider({ children }: { children: React.ReactNode }) {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  return (
    <HeaderActionsContext.Provider value={{ target, setTarget }}>
      {children}
    </HeaderActionsContext.Provider>
  );
}

/** Where portaled actions land. Render it LAST in a heading's `actions`. */
export function HeaderActionsSlot() {
  const ctx = useContext(HeaderActionsContext);
  return <div data-slot="header-actions" className="contents" ref={ctx?.setTarget} />;
}

/**
 * Renders its children in the nearest heading's action row. With no provider
 * above it (a component reused outside an admin page) it renders in place,
 * as an end-aligned row, rather than vanishing.
 */
export function HeaderActions({ children }: { children: React.ReactNode }) {
  const ctx = useContext(HeaderActionsContext);
  if (!ctx) {
    return <div className="flex flex-wrap items-center justify-end gap-2">{children}</div>;
  }
  if (!ctx.target) return null;
  return createPortal(children, ctx.target);
}

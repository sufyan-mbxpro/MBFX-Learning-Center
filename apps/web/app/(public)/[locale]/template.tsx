// The page's entrance on every navigation (changes-45: "smooth page loading
// when moving to the next or back pages").
//
// A template, not a layout, because the app router REMOUNTS a template on
// each navigation between its child segments and keeps a layout mounted — so
// this wrapper, and its `.page-enter` fade, play again for every page while
// the header and footer above and below it stay put. A search-param change
// (a listing's next page) does not remount it; those listings show their own
// in-place loader instead (`news/_components/listing-navigation.tsx`).
//
// The motion lives in `@repo/ui`'s globals.css, behind
// `prefers-reduced-motion: no-preference`, and is opacity only — the comment
// there says why a transform here would break fixed bars inside the page.
export default function PublicTemplate({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}

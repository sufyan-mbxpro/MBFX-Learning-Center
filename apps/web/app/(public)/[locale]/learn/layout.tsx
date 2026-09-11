// The Learn area shell.
//
// Since ADR-065 §5 this layout carries no section bar. The three surfaces a
// bar lists — courses, quizzes, glossary — belong to a TRACK, and `/learn`
// itself spans both, so the bar lives one segment down in
// `[track]/layout.tsx` where it knows which school it is describing.
//
// What is left here is the area's single `<main>`. It stays at this level so
// the nested track layout can render its pinned bar INSIDE the landmark
// rather than beside it, and so no page under /learn has to remember to open
// one.
export default function LearnLayout({ children }: LayoutProps<"/[locale]/learn">) {
  return <main className="flex flex-col">{children}</main>;
}

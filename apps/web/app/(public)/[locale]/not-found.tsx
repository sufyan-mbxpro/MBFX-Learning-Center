import { useTranslations } from "next-intl";
import { Link } from "@repo/i18n/navigation";
import { NotFoundView, notFoundLabels } from "../../_components/not-found-view.tsx";

// The public 404 inside the site chrome — a record a real route could not
// find. The design is shared with `global-not-found.tsx` (changes-49), which
// answers an address nothing owns. It owns the <main> landmark: the [locale]
// layout renders none of its own.
export default function PublicNotFound() {
  const t = useTranslations("notFound");
  return <NotFoundView labels={notFoundLabels(t)} renderLink={(href) => <Link href={href} />} />;
}

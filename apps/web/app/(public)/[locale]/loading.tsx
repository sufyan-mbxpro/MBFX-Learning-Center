// The public site's fallback pending state (changes-21 Phase A). Every route
// with a shape worth reserving owns a skeleton beneath this one; this covers
// the rest (home, the calendar, analysis, sign-in/up, a CMS path), which
// before showed nothing at all while a navigation resolved.
//
// A mark, not a skeleton: a generic skeleton would be the wrong shape for every
// page it stood in for. Textless and `aria-hidden`, like every public loader —
// it reads no translations, so it cannot pull request data into the cached
// shell, and Next already announces the navigation.
import { Container } from "@repo/ui/components/container";
import { PageLoader } from "@repo/ui/components/page-loader";

export default function PublicLoading() {
  return (
    <Container>
      <PageLoader />
    </Container>
  );
}

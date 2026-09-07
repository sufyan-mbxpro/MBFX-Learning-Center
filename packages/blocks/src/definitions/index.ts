// Pure aggregation of every block's editor-facing metadata — no react-dom,
// no @repo/ui (ADR-020 rule 4, ADR-032 §5), so the admin composer can read
// schemas/defaults/labelKey without pulling render trees, and a future
// native renderer can reuse the same schemas. Add one export per new block.
export { definition as sectionDefinition } from "../section/definition.ts";
export { definition as containerDefinition } from "../container/definition.ts";
export { definition as columnsDefinition } from "../columns/definition.ts";
export { definition as gridDefinition } from "../grid/definition.ts";
export { definition as spacerDefinition } from "../spacer/definition.ts";
export { definition as dividerDefinition } from "../divider/definition.ts";
export { definition as headingDefinition } from "../heading/definition.ts";
export { definition as paragraphDefinition } from "../paragraph/definition.ts";
export { definition as richTextDefinition } from "../rich-text/definition.ts";
export { definition as imageDefinition } from "../image/definition.ts";
export { definition as videoDefinition } from "../video/definition.ts";
export { definition as buttonDefinition } from "../button/definition.ts";
export { definition as badgeDefinition } from "../badge/definition.ts";
export { definition as iconCardDefinition } from "../icon-card/definition.ts";
export { definition as statCardDefinition } from "../stat-card/definition.ts";
export { definition as processStepDefinition } from "../process-step/definition.ts";
export { definition as faqDefinition } from "../faq/definition.ts";
export { definition as tabsDefinition } from "../tabs/definition.ts";
export { definition as tableDefinition } from "../table/definition.ts";
export { definition as breadcrumbDefinition } from "../breadcrumb/definition.ts";
export { definition as ctaBandDefinition } from "../cta-band/definition.ts";
export { definition as marqueeDefinition } from "../marquee/definition.ts";
export { definition as counterDefinition } from "../counter/definition.ts";
export { definition as newsletterFormDefinition } from "../newsletter-form/definition.ts";
export { definition as widgetDefinition } from "../widget/definition.ts";
export { definition as collectionDefinition } from "../collection/definition.ts";
export { definition as featuredContentDefinition } from "../featured-content/definition.ts";
export { definition as collectionFilterDefinition } from "../collection-filter/definition.ts";
export { definition as collectionSearchDefinition } from "../collection-search/definition.ts";
export { definition as collectionSortDefinition } from "../collection-sort/definition.ts";
export { definition as collectionPaginationDefinition } from "../collection-pagination/definition.ts";

import { definition as section } from "../section/definition.ts";
import { definition as container } from "../container/definition.ts";
import { definition as columns } from "../columns/definition.ts";
import { definition as grid } from "../grid/definition.ts";
import { definition as spacer } from "../spacer/definition.ts";
import { definition as divider } from "../divider/definition.ts";
import { definition as heading } from "../heading/definition.ts";
import { definition as paragraph } from "../paragraph/definition.ts";
import { definition as richText } from "../rich-text/definition.ts";
import { definition as image } from "../image/definition.ts";
import { definition as video } from "../video/definition.ts";
import { definition as button } from "../button/definition.ts";
import { definition as badge } from "../badge/definition.ts";
import { definition as iconCard } from "../icon-card/definition.ts";
import { definition as statCard } from "../stat-card/definition.ts";
import { definition as processStep } from "../process-step/definition.ts";
import { definition as faq } from "../faq/definition.ts";
import { definition as tabs } from "../tabs/definition.ts";
import { definition as table } from "../table/definition.ts";
import { definition as breadcrumb } from "../breadcrumb/definition.ts";
import { definition as ctaBand } from "../cta-band/definition.ts";
import { definition as marquee } from "../marquee/definition.ts";
import { definition as counter } from "../counter/definition.ts";
import { definition as newsletterForm } from "../newsletter-form/definition.ts";
import { definition as widget } from "../widget/definition.ts";
import { definition as collection } from "../collection/definition.ts";
import { definition as featuredContent } from "../featured-content/definition.ts";
import { definition as collectionFilter } from "../collection-filter/definition.ts";
import { definition as collectionSearch } from "../collection-search/definition.ts";
import { definition as collectionSort } from "../collection-sort/definition.ts";
import { definition as collectionPagination } from "../collection-pagination/definition.ts";
import type { BlockDefinition } from "../registry.ts";

/**
 * Every registered block's definition, for the composer's block picker and
 * `scripts/check-block-fixtures.mjs`. `any`: a heterogeneous array of
 * `BlockDefinition<P>` for different `P` has no sound common element type
 * (their `translatable`/`links`/`responsive` fields are `(keyof P)[]`) —
 * this is the one place that erases `P` on purpose, the same trade-off
 * `registry.ts`'s `Map<string, RegisteredBlock>` already makes internally.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- see comment above
export const ALL_BLOCK_DEFINITIONS: BlockDefinition<any>[] = [
  section,
  container,
  columns,
  grid,
  spacer,
  divider,
  heading,
  paragraph,
  richText,
  image,
  video,
  button,
  badge,
  iconCard,
  statCard,
  processStep,
  faq,
  tabs,
  table,
  breadcrumb,
  ctaBand,
  marquee,
  counter,
  newsletterForm,
  widget,
  collection,
  featuredContent,
  collectionFilter,
  collectionSearch,
  collectionSort,
  collectionPagination,
];

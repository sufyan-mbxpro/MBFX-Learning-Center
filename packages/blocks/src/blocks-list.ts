// Side-effect import list — every block's `index.tsx` calls registerBlock()
// as a side effect of being imported. `render.tsx` imports this file so the
// registry is always populated before renderTree() runs, regardless of
// which subpath a consumer imported first. Add one line here per new block.

// Layout
import "./section/index.tsx";
import "./container/index.tsx";
import "./columns/index.tsx";
import "./grid/index.tsx";
import "./spacer/index.tsx";
import "./divider/index.tsx";

// Content
import "./heading/index.tsx";
import "./paragraph/index.tsx";
import "./rich-text/index.tsx";
import "./image/index.tsx";
import "./video/index.tsx";
import "./button/index.tsx";
import "./badge/index.tsx";
import "./icon-card/index.tsx";
import "./stat-card/index.tsx";
import "./process-step/index.tsx";
import "./faq/index.tsx";
import "./tabs/index.tsx";
import "./table/index.tsx";
import "./breadcrumb/index.tsx";
import "./cta-band/index.tsx";
import "./marquee/index.tsx";
import "./counter/index.tsx";
import "./newsletter-form/index.tsx";

// Widgets (ADR-030) — the one generic dispatch block
import "./widget/index.tsx";

// Collections (ADR-022, plan v2.2 §12 PR 4.2)
import "./collection/index.tsx";
import "./featured-content/index.tsx";
import "./collection-filter/index.tsx";
import "./collection-search/index.tsx";
import "./collection-sort/index.tsx";
import "./collection-pagination/index.tsx";

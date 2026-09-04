### UI & Settings Implementation Instructions

> Review the entire admin panel and apply these UI/UX rules consistently across all modules.
>
> **1. Full-page tables**
>
> * Use full-page table layouts for **Roles, Categories, Tags**, and similar CRUD/listing pages.
> * Do not use small tables inside narrow cards when the page is primarily for managing records.
> * Follow the same professional table pattern across all management pages.
> * Include pagination, sorting, search, filters, row actions, bulk actions where useful, and proper empty/loading states.
> * Use reusable table/data-table components.
>
> **2. Filters**
>
> * Keep the **general search and all custom filters on the same horizontal row** whenever the screen width allows.
> * Example: Search + Status + Category + Type + Date + other relevant filters.
> * Make the filter toolbar responsive so it wraps properly on smaller screens.
> * Avoid placing each filter in separate cards or separate rows unnecessarily.
>
> **3. Full-page Settings**
>
> * Settings pages should use the same **full-page settings-card layout** as the existing General Settings page.
> * Each settings area should have a clear card/section with:
>
>   * Section title
>   * Short description
>   * Related fields grouped together
>   * One clear Save button/action for that section
> * Keep the layout clean, consistent, and responsive.
> * Reuse the same settings components and patterns across all settings pages.
>
> **4. Settings navigation**
>
> * Settings-related pages must **only be listed/grouped inside the Settings page**.
> * Do **not** add individual settings pages such as General, Branding, Theme, Social Links, SEO, etc. directly to the main sidebar.
> * The sidebar should contain only the main application modules.
> * Settings should have its own internal navigation/submenu for all settings sections.
>
> **5. Theme/Color settings bug**
>
> * There is currently a bug where changing the theme colors and clicking Save produces an error and the changes are not saved.
> * Investigate the complete flow:
>
>   * Frontend form state
>   * Validation
>   * API/server action
>   * Database update
>   * Permission/authentication
>   * Response/error handling
>   * Theme/color rendering
> * Fix the root cause instead of hiding or bypassing the error.
> * After saving, reload the page and confirm the selected colors are still persisted.
> * Confirm the updated colors are also applied correctly wherever the theme/branding settings are used.
> * Show a proper success message after saving and a useful error message if saving fails.
>
> **6. Consistency**
>
> * Review existing admin pages and identify inconsistent layouts.
> * Use the same spacing, typography, cards, buttons, inputs, tables, filters, dialogs, and responsive behavior throughout the admin panel.
> * Prefer reusable **shadcn/ui** components and existing project components instead of creating duplicate UI patterns.
> * Since the project is still in development, refactor or reorganize existing UI where necessary to achieve a consistent design system.
>
> **Important:** First inspect the existing implementation and identify the current patterns before changing anything. Do not change the backend architecture unnecessarily; focus on improving the UI flow and fixing the settings save functionality while keeping existing functionality working.

apply this loader on all pages & sections:
/* From Uiverse.io by reglobby */ 
.pl1 {
  display: block;
  width: 8em;
  height: 8em;
}

.pl1__g,
  .pl1__rect {
  animation: pl1-a 1.5s cubic-bezier(0.65,0,0.35,1) infinite;
}

.pl1__g {
  transform-origin: 64px 64px;
}

.pl1__rect:first-child {
  animation-name: pl1-b;
}

.pl1__rect:nth-child(2) {
  animation-name: pl1-c;
}

@keyframes pl1-a {
  from {
    transform: rotate(0);
  }

  80%,
      to {
    animation-timing-function: steps(1,start);
    transform: rotate(90deg);
  }
}

@keyframes pl1-b {
  from {
    animation-timing-function: cubic-bezier(0.33,0,0.67,0);
    width: 40px;
    height: 40px;
  }

  20% {
    animation-timing-function: steps(1,start);
    width: 40px;
    height: 0;
  }

  60% {
    animation-timing-function: cubic-bezier(0.65,0,0.35,1);
    width: 0;
    height: 40px;
  }

  80%,
      to {
    width: 40px;
    height: 40px;
  }
}

@keyframes pl1-c {
  from {
    animation-timing-function: cubic-bezier(0.33,0,0.67,0);
    width: 40px;
    height: 40px;
    transform: translate(0,48px);
  }

  20% {
    animation-timing-function: cubic-bezier(0.33,1,0.67,1);
    width: 40px;
    height: 88px;
    transform: translate(0,0);
  }

  40% {
    animation-timing-function: cubic-bezier(0.33,0,0.67,0);
    width: 40px;
    height: 40px;
    transform: translate(0,0);
  }

  60% {
    animation-timing-function: cubic-bezier(0.33,1,0.67,1);
    width: 88px;
    height: 40px;
    transform: translate(0,0);
  }

  80%,
      to {
    width: 40px;
    height: 40px;
    transform: translate(48px,0);
  }
}

<!-- From Uiverse.io by reglobby --> 
<main>
	<svg height="128px" width="128px" viewBox="0 0 128 128" class="pl1">
		<defs>
			<linearGradient y2="1" x2="1" y1="0" x1="0" id="pl-grad">
				<stop stop-color="#000" offset="0%"></stop>
				<stop stop-color="#fff" offset="100%"></stop>
			</linearGradient>
			<mask id="pl-mask">
				<rect fill="url(#pl-grad)" height="128" width="128" y="0" x="0"></rect>
			</mask>
		</defs>
		<g fill="var(--primary)">
			<g class="pl1__g">
				<g transform="translate(20,20) rotate(0,44,44)">
					<g class="pl1__rect-g">
						<rect height="40" width="40" ry="8" rx="8" class="pl1__rect"></rect>
						<rect transform="translate(0,48)" height="40" width="40" ry="8" rx="8" class="pl1__rect"></rect>
					</g>
					<g transform="rotate(180,44,44)" class="pl1__rect-g">
						<rect height="40" width="40" ry="8" rx="8" class="pl1__rect"></rect>
						<rect transform="translate(0,48)" height="40" width="40" ry="8" rx="8" class="pl1__rect"></rect>
					</g>
				</g>
			</g>
		</g>
		<g mask="url(#pl-mask)" fill="hsl(343,90%,50%)">
			<g class="pl1__g">
				<g transform="translate(20,20) rotate(0,44,44)">
					<g class="pl1__rect-g">
						<rect height="40" width="40" ry="8" rx="8" class="pl1__rect"></rect>
						<rect transform="translate(0,48)" height="40" width="40" ry="8" rx="8" class="pl1__rect"></rect>
					</g>
					<g transform="rotate(180,44,44)" class="pl1__rect-g">
						<rect height="40" width="40" ry="8" rx="8" class="pl1__rect"></rect>
						<rect transform="translate(0,48)" height="40" width="40" ry="8" rx="8" class="pl1__rect"></rect>
					</g>
				</g>
			</g>
		</g>
	</svg>
</main>

the loader color should be the same that is used for the site like #e8b98c

Review the existing MBFX Learning Center project and implement a new visual design system inspired by the ForTradex Forex Broker theme/demo.

Reference:
https://july.finestwp.com/newwp/fortradex/

Important:

- Do NOT replace the existing architecture.
- Do NOT convert the project to WordPress/Elementor.
- Keep the existing Next.js, TypeScript, Tailwind CSS and shadcn/ui architecture.
- Treat the reference only as a visual/design reference.
- Do not copy proprietary source code, assets, text or branding.
- Reuse and improve the existing components wherever possible.

First perform a complete UI/design audit of the existing website.

Analyze the reference and establish a reusable design system covering:

- Typography
- Colors
- Container widths
- Section spacing
- Buttons
- Cards
- Badges
- Images
- Borders
- Shadows
- Border radius
- Header/navigation
- Footer
- Hero sections
- Content grids
- Responsive behavior
- Hover states
- Scroll/reveal animations
- Loading states
- Counters/stat animations
- Image hover effects
- CTA sections
- News/article presentation

Create reusable components instead of page-specific implementations.

Create reusable primitives for:

- Container
- Section
- Button
- Card
- Badge
- Reveal animation
- Hover effects
- Page loader
- Counter
- Marquee/ticker
- Image reveal
- Section heading

Use CSS transitions for simple effects and Motion only where JavaScript animation is actually required.

Create reusable section variants such as:

- Hero: centered, split, background
- Feature section: image-left, image-right
- Cards: default, elevated, bordered, featured
- News grid: standard, featured, compact
- CTA: default and full-width

Do NOT build a generic page builder or Elementor clone.

For content management, separate content from presentation.

Existing/admin-managed content should control:

- Titles
- Descriptions
- Images
- Buttons
- Visibility
- Ordering
- Featured status
- Layout variants where appropriate
- Number of displayed items
- Animation variant where appropriate

The frontend components must remain responsible for the actual design and presentation.

Create a manageable homepage section system where sections can be enabled/disabled and ordered from the admin without duplicating frontend code.

Prioritize the following pages/components first:

1. Header/navigation
2. Homepage hero
3. Homepage sections
4. Statistics/cards
5. News & Analysis
6. CTA sections
7. Footer
8. Remaining public pages

Make the UI:

- Modern
- Professional
- Premium fintech/forex style
- Responsive
- Accessible
- Consistent
- Animation-rich but not excessive
- Fast and performant

Use the existing shadcn/ui components wherever appropriate instead of creating duplicate components.

Before implementation, document:

1. Current UI architecture
2. Components that can be reused
3. Components that need improvement
4. New components required
5. Design tokens
6. Animation strategy
7. Content/display management strategy

Then implement the changes incrementally.

Do not change backend/database architecture unless it is genuinely required for the content-management functionality.

After implementation:

- Run typecheck
- Run lint
- Run build
- Check desktop/tablet/mobile layouts
- Check dark/light mode
- Check reduced-motion accessibility
- Check loading states
- Check hover/focus states
- Remove duplicated CSS/components
- Keep the implementation production-ready.

Do not use update the dynamic color flow..this is the actual color code that will use
Dashboard
/
Theme
Theme
Colors & Branding
Layout & Display
Theme Modes (light / dark)
Presets

#e8b98c

#2A2A29

#2D72C7

#D93A34

#FFA310

#004284

#EAE5DE
Derived states (read-only)

#8b6f54
#e8b98c

this is the website view page source:
make home page of website like this..use these hover effects,loader etc..
make it components,reuse that each effects
https://july.finestwp.com/newwp/fortradex/

![alt text](image-9.png)

<!DOCTYPE html>
<html lang="en-US" class="no-js no-svg">
<head>
	<meta charset="UTF-8">
	    		<link rel="shortcut icon" href="https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/images/favicon.png" type="image/x-icon">
		<link rel="icon" href="https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/images/favicon.png" type="image/x-icon">
	    	<!-- responsive meta -->
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<!-- For IE -->
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>Fortradex &#8211; Fortradex WordPress Theme</title>
<meta name='robots' content='max-image-preview:large' />
<link rel='dns-prefetch' href='//fonts.googleapis.com' />
<link rel="alternate" type="application/rss+xml" title="Fortradex &raquo; Feed" href="https://july.finestwp.com/newwp/fortradex/feed/" />
<link rel="alternate" type="application/rss+xml" title="Fortradex &raquo; Comments Feed" href="https://july.finestwp.com/newwp/fortradex/comments/feed/" />
<link rel="alternate" title="oEmbed (JSON)" type="application/json+oembed" href="https://july.finestwp.com/newwp/fortradex/wp-json/oembed/1.0/embed?url=https%3A%2F%2Fjuly.finestwp.com%2Fnewwp%2Ffortradex%2F" />
<link rel="alternate" title="oEmbed (XML)" type="text/xml+oembed" href="https://july.finestwp.com/newwp/fortradex/wp-json/oembed/1.0/embed?url=https%3A%2F%2Fjuly.finestwp.com%2Fnewwp%2Ffortradex%2F&#038;format=xml" />
<style id="wp-img-auto-sizes-contain-inline-css">
img:is([sizes=auto i],[sizes^="auto," i]){contain-intrinsic-size:3000px 1500px}
/*# sourceURL=wp-img-auto-sizes-contain-inline-css */
</style>
<style id="wp-emoji-styles-inline-css">

    img.wp-smiley, img.emoji {
    	display: inline !important;
    	border: none !important;
    	box-shadow: none !important;
    	height: 1em !important;
    	width: 1em !important;
    	margin: 0 0.07em !important;
    	vertical-align: -0.1em !important;
    	background: none !important;
    	padding: 0 !important;
    }

/*# sourceURL=wp-emoji-styles-inline-css */
</style>
<style id="classic-theme-styles-inline-css">
/*! This file is auto-generated */
.wp-block-button__link{color:#fff;background-color:#32373c;border-radius:9999px;box-shadow:none;text-decoration:none;padding:calc(.667em + 2px) calc(1.333em + 2px);font-size:1.125em}.wp-block-file__button{background:#32373c;color:#fff;text-decoration:none}
/*# sourceURL=/wp-includes/css/classic-themes.min.css */
</style>
<style id="global-styles-inline-css">
:root{--wp--preset--aspect-ratio--square: 1;--wp--preset--aspect-ratio--4-3: 4/3;--wp--preset--aspect-ratio--3-4: 3/4;--wp--preset--aspect-ratio--3-2: 3/2;--wp--preset--aspect-ratio--2-3: 2/3;--wp--preset--aspect-ratio--16-9: 16/9;--wp--preset--aspect-ratio--9-16: 9/16;--wp--preset--color--black: #000000;--wp--preset--color--cyan-bluish-gray: #abb8c3;--wp--preset--color--white: #ffffff;--wp--preset--color--pale-pink: #f78da7;--wp--preset--color--vivid-red: #cf2e2e;--wp--preset--color--luminous-vivid-orange: #ff6900;--wp--preset--color--luminous-vivid-amber: #fcb900;--wp--preset--color--light-green-cyan: #7bdcb5;--wp--preset--color--vivid-green-cyan: #00d084;--wp--preset--color--pale-cyan-blue: #8ed1fc;--wp--preset--color--vivid-cyan-blue: #0693e3;--wp--preset--color--vivid-purple: #9b51e0;--wp--preset--color--strong-yellow: #f7bd00;--wp--preset--color--strong-white: #fff;--wp--preset--color--light-black: #242424;--wp--preset--color--very-light-gray: #797979;--wp--preset--color--very-dark-black: #000000;--wp--preset--gradient--vivid-cyan-blue-to-vivid-purple: linear-gradient(135deg,rgb(6,147,227) 0%,rgb(155,81,224) 100%);--wp--preset--gradient--light-green-cyan-to-vivid-green-cyan: linear-gradient(135deg,rgb(122,220,180) 0%,rgb(0,208,130) 100%);--wp--preset--gradient--luminous-vivid-amber-to-luminous-vivid-orange: linear-gradient(135deg,rgb(252,185,0) 0%,rgb(255,105,0) 100%);--wp--preset--gradient--luminous-vivid-orange-to-vivid-red: linear-gradient(135deg,rgb(255,105,0) 0%,rgb(207,46,46) 100%);--wp--preset--gradient--very-light-gray-to-cyan-bluish-gray: linear-gradient(135deg,rgb(238,238,238) 0%,rgb(169,184,195) 100%);--wp--preset--gradient--cool-to-warm-spectrum: linear-gradient(135deg,rgb(74,234,220) 0%,rgb(151,120,209) 20%,rgb(207,42,186) 40%,rgb(238,44,130) 60%,rgb(251,105,98) 80%,rgb(254,248,76) 100%);--wp--preset--gradient--blush-light-purple: linear-gradient(135deg,rgb(255,206,236) 0%,rgb(152,150,240) 100%);--wp--preset--gradient--blush-bordeaux: linear-gradient(135deg,rgb(254,205,165) 0%,rgb(254,45,45) 50%,rgb(107,0,62) 100%);--wp--preset--gradient--luminous-dusk: linear-gradient(135deg,rgb(255,203,112) 0%,rgb(199,81,192) 50%,rgb(65,88,208) 100%);--wp--preset--gradient--pale-ocean: linear-gradient(135deg,rgb(255,245,203) 0%,rgb(182,227,212) 50%,rgb(51,167,181) 100%);--wp--preset--gradient--electric-grass: linear-gradient(135deg,rgb(202,248,128) 0%,rgb(113,206,126) 100%);--wp--preset--gradient--midnight: linear-gradient(135deg,rgb(2,3,129) 0%,rgb(40,116,252) 100%);--wp--preset--font-size--small: 10px;--wp--preset--font-size--medium: 20px;--wp--preset--font-size--large: 24px;--wp--preset--font-size--x-large: 42px;--wp--preset--font-size--normal: 15px;--wp--preset--font-size--huge: 36px;--wp--preset--spacing--20: 0.44rem;--wp--preset--spacing--30: 0.67rem;--wp--preset--spacing--40: 1rem;--wp--preset--spacing--50: 1.5rem;--wp--preset--spacing--60: 2.25rem;--wp--preset--spacing--70: 3.38rem;--wp--preset--spacing--80: 5.06rem;--wp--preset--shadow--natural: 6px 6px 9px rgba(0, 0, 0, 0.2);--wp--preset--shadow--deep: 12px 12px 50px rgba(0, 0, 0, 0.4);--wp--preset--shadow--sharp: 6px 6px 0px rgba(0, 0, 0, 0.2);--wp--preset--shadow--outlined: 6px 6px 0px -3px rgb(255, 255, 255), 6px 6px rgb(0, 0, 0);--wp--preset--shadow--crisp: 6px 6px 0px rgb(0, 0, 0);}.wp-block-button{--wp--preset--dimension--25: 25%;--wp--preset--dimension--50: 50%;--wp--preset--dimension--75: 75%;--wp--preset--dimension--100: 100%;}:where(body) { margin: 0; }:where(.is-layout-flex){gap: 0.5em;}:where(.is-layout-grid){gap: 0.5em;}body .is-layout-flex{display: flex;}.is-layout-flex{flex-wrap: wrap;align-items: center;}.is-layout-flex > :is(*, div){margin: 0;}body .is-layout-grid{display: grid;}.is-layout-grid > :is(*, div){margin: 0;}body{padding-top: 0px;padding-right: 0px;padding-bottom: 0px;padding-left: 0px;}:root :where(.wp-element-button, .wp-block-button__link){background-color: #32373c;border-width: 0;color: #fff;font-family: inherit;font-size: inherit;font-style: inherit;font-weight: inherit;letter-spacing: inherit;line-height: inherit;padding-top: calc(0.667em + 2px);padding-right: calc(1.333em + 2px);padding-bottom: calc(0.667em + 2px);padding-left: calc(1.333em + 2px);text-decoration: none;text-transform: inherit;}.has-black-color{color: var(--wp--preset--color--black) !important;}.has-cyan-bluish-gray-color{color: var(--wp--preset--color--cyan-bluish-gray) !important;}.has-white-color{color: var(--wp--preset--color--white) !important;}.has-pale-pink-color{color: var(--wp--preset--color--pale-pink) !important;}.has-vivid-red-color{color: var(--wp--preset--color--vivid-red) !important;}.has-luminous-vivid-orange-color{color: var(--wp--preset--color--luminous-vivid-orange) !important;}.has-luminous-vivid-amber-color{color: var(--wp--preset--color--luminous-vivid-amber) !important;}.has-light-green-cyan-color{color: var(--wp--preset--color--light-green-cyan) !important;}.has-vivid-green-cyan-color{color: var(--wp--preset--color--vivid-green-cyan) !important;}.has-pale-cyan-blue-color{color: var(--wp--preset--color--pale-cyan-blue) !important;}.has-vivid-cyan-blue-color{color: var(--wp--preset--color--vivid-cyan-blue) !important;}.has-vivid-purple-color{color: var(--wp--preset--color--vivid-purple) !important;}.has-strong-yellow-color{color: var(--wp--preset--color--strong-yellow) !important;}.has-strong-white-color{color: var(--wp--preset--color--strong-white) !important;}.has-light-black-color{color: var(--wp--preset--color--light-black) !important;}.has-very-light-gray-color{color: var(--wp--preset--color--very-light-gray) !important;}.has-very-dark-black-color{color: var(--wp--preset--color--very-dark-black) !important;}.has-black-background-color{background-color: var(--wp--preset--color--black) !important;}.has-cyan-bluish-gray-background-color{background-color: var(--wp--preset--color--cyan-bluish-gray) !important;}.has-white-background-color{background-color: var(--wp--preset--color--white) !important;}.has-pale-pink-background-color{background-color: var(--wp--preset--color--pale-pink) !important;}.has-vivid-red-background-color{background-color: var(--wp--preset--color--vivid-red) !important;}.has-luminous-vivid-orange-background-color{background-color: var(--wp--preset--color--luminous-vivid-orange) !important;}.has-luminous-vivid-amber-background-color{background-color: var(--wp--preset--color--luminous-vivid-amber) !important;}.has-light-green-cyan-background-color{background-color: var(--wp--preset--color--light-green-cyan) !important;}.has-vivid-green-cyan-background-color{background-color: var(--wp--preset--color--vivid-green-cyan) !important;}.has-pale-cyan-blue-background-color{background-color: var(--wp--preset--color--pale-cyan-blue) !important;}.has-vivid-cyan-blue-background-color{background-color: var(--wp--preset--color--vivid-cyan-blue) !important;}.has-vivid-purple-background-color{background-color: var(--wp--preset--color--vivid-purple) !important;}.has-strong-yellow-background-color{background-color: var(--wp--preset--color--strong-yellow) !important;}.has-strong-white-background-color{background-color: var(--wp--preset--color--strong-white) !important;}.has-light-black-background-color{background-color: var(--wp--preset--color--light-black) !important;}.has-very-light-gray-background-color{background-color: var(--wp--preset--color--very-light-gray) !important;}.has-very-dark-black-background-color{background-color: var(--wp--preset--color--very-dark-black) !important;}.has-black-border-color{border-color: var(--wp--preset--color--black) !important;}.has-cyan-bluish-gray-border-color{border-color: var(--wp--preset--color--cyan-bluish-gray) !important;}.has-white-border-color{border-color: var(--wp--preset--color--white) !important;}.has-pale-pink-border-color{border-color: var(--wp--preset--color--pale-pink) !important;}.has-vivid-red-border-color{border-color: var(--wp--preset--color--vivid-red) !important;}.has-luminous-vivid-orange-border-color{border-color: var(--wp--preset--color--luminous-vivid-orange) !important;}.has-luminous-vivid-amber-border-color{border-color: var(--wp--preset--color--luminous-vivid-amber) !important;}.has-light-green-cyan-border-color{border-color: var(--wp--preset--color--light-green-cyan) !important;}.has-vivid-green-cyan-border-color{border-color: var(--wp--preset--color--vivid-green-cyan) !important;}.has-pale-cyan-blue-border-color{border-color: var(--wp--preset--color--pale-cyan-blue) !important;}.has-vivid-cyan-blue-border-color{border-color: var(--wp--preset--color--vivid-cyan-blue) !important;}.has-vivid-purple-border-color{border-color: var(--wp--preset--color--vivid-purple) !important;}.has-strong-yellow-border-color{border-color: var(--wp--preset--color--strong-yellow) !important;}.has-strong-white-border-color{border-color: var(--wp--preset--color--strong-white) !important;}.has-light-black-border-color{border-color: var(--wp--preset--color--light-black) !important;}.has-very-light-gray-border-color{border-color: var(--wp--preset--color--very-light-gray) !important;}.has-very-dark-black-border-color{border-color: var(--wp--preset--color--very-dark-black) !important;}.has-vivid-cyan-blue-to-vivid-purple-gradient-background{background: var(--wp--preset--gradient--vivid-cyan-blue-to-vivid-purple) !important;}.has-light-green-cyan-to-vivid-green-cyan-gradient-background{background: var(--wp--preset--gradient--light-green-cyan-to-vivid-green-cyan) !important;}.has-luminous-vivid-amber-to-luminous-vivid-orange-gradient-background{background: var(--wp--preset--gradient--luminous-vivid-amber-to-luminous-vivid-orange) !important;}.has-luminous-vivid-orange-to-vivid-red-gradient-background{background: var(--wp--preset--gradient--luminous-vivid-orange-to-vivid-red) !important;}.has-very-light-gray-to-cyan-bluish-gray-gradient-background{background: var(--wp--preset--gradient--very-light-gray-to-cyan-bluish-gray) !important;}.has-cool-to-warm-spectrum-gradient-background{background: var(--wp--preset--gradient--cool-to-warm-spectrum) !important;}.has-blush-light-purple-gradient-background{background: var(--wp--preset--gradient--blush-light-purple) !important;}.has-blush-bordeaux-gradient-background{background: var(--wp--preset--gradient--blush-bordeaux) !important;}.has-luminous-dusk-gradient-background{background: var(--wp--preset--gradient--luminous-dusk) !important;}.has-pale-ocean-gradient-background{background: var(--wp--preset--gradient--pale-ocean) !important;}.has-electric-grass-gradient-background{background: var(--wp--preset--gradient--electric-grass) !important;}.has-midnight-gradient-background{background: var(--wp--preset--gradient--midnight) !important;}.has-small-font-size{font-size: var(--wp--preset--font-size--small) !important;}.has-medium-font-size{font-size: var(--wp--preset--font-size--medium) !important;}.has-large-font-size{font-size: var(--wp--preset--font-size--large) !important;}.has-x-large-font-size{font-size: var(--wp--preset--font-size--x-large) !important;}.has-normal-font-size{font-size: var(--wp--preset--font-size--normal) !important;}.has-huge-font-size{font-size: var(--wp--preset--font-size--huge) !important;}
:root :where(.wp-block-icon svg){width: 24px;}
:where(.wp-block-gallery.is-layout-flex){gap: var( --wp--style--gallery-gap-default, var( --gallery-block--gutter-size, var( --wp--style--block-gap, 0.5em ) ) );}:where(.wp-block-gallery.is-layout-grid){gap: var( --wp--style--gallery-gap-default, var( --gallery-block--gutter-size, var( --wp--style--block-gap, 0.5em ) ) );}
:where(.wp-block-latest-posts.is-layout-flex){gap: 1.25em;}:where(.wp-block-latest-posts.is-layout-grid){gap: 1.25em;}
:where(.wp-block-post-template.is-layout-flex){gap: 1.25em;}:where(.wp-block-post-template.is-layout-grid){gap: 1.25em;}
:where(.wp-block-term-template.is-layout-flex){gap: 1.25em;}:where(.wp-block-term-template.is-layout-grid){gap: 1.25em;}
:where(.wp-block-columns.is-layout-flex){gap: 2em;}:where(.wp-block-columns.is-layout-grid){gap: 2em;}
:root :where(.wp-block-pullquote){font-size: 1.5em;line-height: 1.6;}
/*# sourceURL=global-styles-inline-css */
</style>
<link rel='stylesheet' id='contact-form-7-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/plugins/contact-form-7/includes/css/styles.css?ver=6.1.7' media='all' />
<link rel='stylesheet' id='tutor-icon-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/css/tutor-icon.min.css?ver=4.0.7' media='all' />
<link rel='stylesheet' id='tutor-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/css/tutor.min.css?ver=4.0.7' media='all' />
<link rel='stylesheet' id='tutor-frontend-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/css/tutor-front.min.css?ver=4.0.7' media='all' />
<style id="tutor-frontend-inline-css">
:root{--tutor-color-primary:#22823a;--tutor-color-primary-rgb:34, 130, 58;--tutor-color-primary-hover:#3bb961;--tutor-color-primary-hover-rgb:59, 185, 97;--tutor-body-color:#212327;--tutor-body-color-rgb:33, 35, 39;--tutor-border-color:#E3E5EB;--tutor-border-color-rgb:227, 229, 235;--tutor-color-gray:#CDCFD5;--tutor-color-gray-rgb:205, 207, 213;}
/*# sourceURL=tutor-frontend-inline-css */
</style>
<style id="woocommerce-inline-inline-css">
.woocommerce form .form-row .required { visibility: visible; }
/*# sourceURL=woocommerce-inline-inline-css */
</style>
<link rel='stylesheet' id='font-awesome-all-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/css/font-awesome-all.css?ver=7.1' media='all' />
<link rel='stylesheet' id='flaticon-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/css/flaticon.css?ver=7.1' media='all' />
<link rel='stylesheet' id='owl-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/css/owl.css?ver=7.1' media='all' />
<link rel='stylesheet' id='bootstrap-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/css/bootstrap.css?ver=7.1' media='all' />
<link rel='stylesheet' id='jquery-fancybox-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/css/jquery.fancybox.min.css?ver=7.1' media='all' />
<link rel='stylesheet' id='fancybox-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/css/animate.css?ver=7.1' media='all' />
<link rel='stylesheet' id='nice-select-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/css/nice-select.css?ver=7.1' media='all' />
<link rel='stylesheet' id='jquery-ui-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/css/jquery-ui.css?ver=7.1' media='all' />
<link rel='stylesheet' id='odometer-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/css/odometer.css?ver=7.1' media='all' />
<link rel='stylesheet' id='elpath-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/css/elpath.css?ver=7.1' media='all' />
<link rel='stylesheet' id='color-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/css/color.css?ver=7.1' media='all' />
<link rel='stylesheet' id='rtl-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/css/rtl.css?ver=7.1' media='all' />
<link rel='stylesheet' id='fortradex-header-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/css/module-css/header.css?ver=7.1' media='all' />
<link rel='stylesheet' id='fortradex-banner-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/css/module-css/banner.css?ver=7.1' media='all' />
<link rel='stylesheet' id='fortradex-cta-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/css/module-css/cta.css?ver=7.1' media='all' />
<link rel='stylesheet' id='fortradex-clients-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/css/module-css/clients.css?ver=7.1' media='all' />
<link rel='stylesheet' id='fortradex-account-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/css/module-css/account.css?ver=7.1' media='all' />
<link rel='stylesheet' id='fortradex-history-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/css/module-css/history.css?ver=7.1' media='all' />
<link rel='stylesheet' id='fortradex-about-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/css/module-css/about.css?ver=7.1' media='all' />
<link rel='stylesheet' id='fortradex-platform-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/css/module-css/platform.css?ver=7.1' media='all' />
<link rel='stylesheet' id='fortradex-funfact-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/css/module-css/funfact.css?ver=7.1' media='all' />
<link rel='stylesheet' id='fortradex-trading-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/css/module-css/trading.css?ver=7.1' media='all' />
<link rel='stylesheet' id='fortradex-process-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/css/module-css/process.css?ver=7.1' media='all' />
<link rel='stylesheet' id='fortradex-award-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/css/module-css/award.css?ver=7.1' media='all' />
<link rel='stylesheet' id='fortradex-apps-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/css/module-css/apps.css?ver=7.1' media='all' />
<link rel='stylesheet' id='fortradex-news-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/css/module-css/news.css?ver=7.1' media='all' />
<link rel='stylesheet' id='fortradex-experience-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/css/module-css/experience.css?ver=7.1' media='all' />
<link rel='stylesheet' id='fortradex-testimonial-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/css/module-css/testimonial.css?ver=7.1' media='all' />
<link rel='stylesheet' id='fortradex-subscribe-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/css/module-css/subscribe.css?ver=7.1' media='all' />
<link rel='stylesheet' id='fortradex-dark-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/css/dark.css?ver=7.1' media='all' />
<link rel='stylesheet' id='fortradex-page-title-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/css/module-css/page-title.css?ver=7.1' media='all' />
<link rel='stylesheet' id='fortradex-working-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/css/module-css/working.css?ver=7.1' media='all' />
<link rel='stylesheet' id='fortradex-team-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/css/module-css/team.css?ver=7.1' media='all' />
<link rel='stylesheet' id='fortradex-faq-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/css/module-css/faq.css?ver=7.1' media='all' />
<link rel='stylesheet' id='fortradex-error-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/css/module-css/error.css?ver=7.1' media='all' />
<link rel='stylesheet' id='fortradex-markets-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/css/module-css/markets.css?ver=7.1' media='all' />
<link rel='stylesheet' id='fortradex-team-details-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/css/module-css/team-details.css?ver=7.1' media='all' />
<link rel='stylesheet' id='fortradex-contact-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/css/module-css/contact.css?ver=7.1' media='all' />
<link rel='stylesheet' id='fortradex-blog-sidebar-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/css/module-css/blog-sidebar.css?ver=7.1' media='all' />
<link rel='stylesheet' id='fortradex-blog-details-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/css/module-css/blog-details.css?ver=7.1' media='all' />
<link rel='stylesheet' id='fortradex-pricing-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/css/module-css/pricing.css?ver=7.1' media='all' />
<link rel='stylesheet' id='fortradex-education-details-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/css/module-css/education-details.css?ver=7.1' media='all' />
<link rel='stylesheet' id='fortradex-footer-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/css/module-css/footer.css?ver=7.1' media='all' />
<link rel='stylesheet' id='fortradex-main-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/style.css?ver=7.1' media='all' />
<link rel='stylesheet' id='fortradex-main-style-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/css/style.css?ver=7.1' media='all' />
<link rel='stylesheet' id='fortradex-custom-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/css/custom.css?ver=7.1' media='all' />
<link rel='stylesheet' id='fortradex-responsive-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/css/responsive.css?ver=7.1' media='all' />
<link rel='stylesheet' id='fortradex-main-color-scheme-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/css/color.php?main_color=22823A&#038;second_color=131615&#038;ver=7.1' media='all' />
<link rel='stylesheet' id='fortradex-theme-fonts-css' href='https://fonts.googleapis.com/css?family=Ubuntu%3Aital%2Cwght%400%2C300%2C%2C400%2C500%2C700%2C300%2C400%2C500%2C700%26display%3Dswap%7CIBM+Plex+Sans%3Aital%2Cwght%400%2C100%2C200%2C300%2C400%2C500%2C600%2C700%26display%3Dswap&#038;subset=latin%2Clatin-ext' media='all' />
<link rel='stylesheet' id='elementor-frontend-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/uploads/elementor/css/custom-frontend.min.css?ver=1788275266' media='all' />
<link rel='stylesheet' id='elementor-post-10-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/uploads/elementor/css/post-10.css?ver=1788285808' media='all' />
<link rel='stylesheet' id='widget-divider-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/plugins/elementor/assets/css/widget-divider.min.css?ver=4.2.4' media='all' />
<link rel='stylesheet' id='widget-image-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/plugins/elementor/assets/css/widget-image.min.css?ver=4.2.4' media='all' />
<link rel='stylesheet' id='widget-heading-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/plugins/elementor/assets/css/widget-heading.min.css?ver=4.2.4' media='all' />
<link rel='stylesheet' id='elementor-post-15-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/uploads/elementor/css/post-15.css?ver=1788285809' media='all' />
<link rel='stylesheet' id='elementor-gf-local-roboto-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/uploads/elementor/google-fonts/css/roboto.css?ver=1742239231' media='all' />
<link rel='stylesheet' id='elementor-gf-local-robotoslab-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/uploads/elementor/google-fonts/css/robotoslab.css?ver=1742239240' media='all' />
<link rel='stylesheet' id='elementor-gf-local-ubuntu-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/uploads/elementor/google-fonts/css/ubuntu.css?ver=1742239248' media='all' />
<link rel='stylesheet' id='elementor-gf-local-ibmplexsans-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/uploads/elementor/google-fonts/css/ibmplexsans.css?ver=1742239261' media='all' />
<script id="jquery-core-js-extra">
var fortradex_data = {"ajaxurl":"https://july.finestwp.com/newwp/fortradex/wp-admin/admin-ajax.php","nonce":"d4781c51e6"};
//# sourceURL=jquery-core-js-extra
</script>
<script id="jquery-core-js" src="https://july.finestwp.com/newwp/fortradex/wp-includes/js/jquery/jquery.min.js?ver=3.7.1"></script>
<script id="jquery-migrate-js" src="https://july.finestwp.com/newwp/fortradex/wp-includes/js/jquery/jquery-migrate.min.js?ver=3.4.1"></script>
<script data-wp-strategy="defer" defer id="wc-jquery-blockui-js" src="https://july.finestwp.com/newwp/fortradex/wp-content/plugins/woocommerce/assets/js/jquery-blockui/jquery.blockUI.min.js?ver=2.7.0-wc.11.0.1"></script>
<script id="wc-add-to-cart-js-extra">
var wc_add_to_cart_params = {"ajax_url":"/newwp/fortradex/wp-admin/admin-ajax.php","wc_ajax_url":"/newwp/fortradex/?wc-ajax=%%endpoint%%","i18n_view_cart":"View cart","cart_url":"https://july.finestwp.com/newwp/fortradex/cart/","is_cart":"","cart_redirect_after_add":"no"};
//# sourceURL=wc-add-to-cart-js-extra
</script>
<script data-wp-strategy="defer" defer id="wc-add-to-cart-js" src="https://july.finestwp.com/newwp/fortradex/wp-content/plugins/woocommerce/assets/js/frontend/add-to-cart.min.js?ver=11.0.1"></script>
<script data-wp-strategy="defer" defer id="wc-js-cookie-js" src="https://july.finestwp.com/newwp/fortradex/wp-content/plugins/woocommerce/assets/js/js-cookie/js.cookie.min.js?ver=2.1.4-wc.11.0.1"></script>
<script id="woocommerce-js-extra">
var woocommerce_params = {"ajax_url":"/newwp/fortradex/wp-admin/admin-ajax.php","wc_ajax_url":"/newwp/fortradex/?wc-ajax=%%endpoint%%","i18n_password_show":"Show password","i18n_password_hide":"Hide password"};
//# sourceURL=woocommerce-js-extra
</script>
<script data-wp-strategy="defer" defer id="woocommerce-js" src="https://july.finestwp.com/newwp/fortradex/wp-content/plugins/woocommerce/assets/js/frontend/woocommerce.min.js?ver=11.0.1"></script>
<script id="customStockdioJs-js" src="https://july.finestwp.com/newwp/fortradex/wp-content/plugins/stock-market-ticker/assets/stockdio-wp.js?ver=1.9.29"></script>
<link rel="https://api.w.org/" href="https://july.finestwp.com/newwp/fortradex/wp-json/" /><link rel="alternate" title="JSON" type="application/json" href="https://july.finestwp.com/newwp/fortradex/wp-json/wp/v2/pages/15" /><link rel="EditURI" type="application/rsd+xml" title="RSD" href="https://july.finestwp.com/newwp/fortradex/xmlrpc.php?rsd" />
<meta name="generator" content="WordPress 7.1" />
<meta name="generator" content="TutorLMS 4.0.7" />
<meta name="generator" content="WooCommerce 11.0.1" />
<link rel="canonical" href="https://july.finestwp.com/newwp/fortradex/" />
<link rel='shortlink' href='https://july.finestwp.com/newwp/fortradex/' />
<meta name="generator" content="Redux 4.4.17" />	<noscript><style>.woocommerce-product-gallery{ opacity: 1 !important; }</style></noscript>
	<meta name="generator" content="Elementor 4.2.4; features: e_font_icon_svg, additional_custom_breakpoints; settings: css_print_method-external, google_font-enabled, font_display-swap">
			<style>
				.e-con.e-parent:nth-of-type(n+4):not(.e-lazyloaded):not(.e-no-lazyload),
				.e-con.e-parent:nth-of-type(n+4):not(.e-lazyloaded):not(.e-no-lazyload) * {
					background-image: none !important;
				}
				@media screen and (max-height: 1024px) {
					.e-con.e-parent:nth-of-type(n+3):not(.e-lazyloaded):not(.e-no-lazyload),
					.e-con.e-parent:nth-of-type(n+3):not(.e-lazyloaded):not(.e-no-lazyload) * {
						background-image: none !important;
					}
				}
				@media screen and (max-height: 640px) {
					.e-con.e-parent:nth-of-type(n+2):not(.e-lazyloaded):not(.e-no-lazyload),
					.e-con.e-parent:nth-of-type(n+2):not(.e-lazyloaded):not(.e-no-lazyload) * {
						background-image: none !important;
					}
				}
			</style>
			</head>

<body class="home wp-singular page-template page-template-tpl-default-elementor page-template-tpl-default-elementor-php page page-id-15 wp-embed-responsive wp-theme-fortradex theme-fortradex tutor-lms woocommerce-no-js menu-layer elementor-default elementor-kit-10 elementor-page elementor-page-15">

<div class="boxed_wrapper ltr light_bg">

            <!-- preloader -->
    <div class="loader-wrap">
        <div class="preloader">
            <div class="preloader-close"><i class="fal fa-times"></i></div>
            <div id="handle-preloader" class="handle-preloader">
                <div class="animation-preloader">
                    <div class="spinner"></div>
                    <div class="txt-loading">
                                                <span data-text-preloader="f

" class="letters-loading">
f
</span>
<span data-text-preloader="o
" class="letters-loading">
o
</span>
<span data-text-preloader="r
" class="letters-loading">
r
</span>
<span data-text-preloader="t
" class="letters-loading">
t
</span>
<span data-text-preloader="r
" class="letters-loading">
r
</span>
<span data-text-preloader="a
" class="letters-loading">
a
</span>
<span data-text-preloader="d
" class="letters-loading">
d
</span>
<span data-text-preloader="e
" class="letters-loading">
e
</span>
<span data-text-preloader="x" class="letters-loading">
x </span>
</div>
</div>  
</div>
</div>
</div>
<!-- preloader end -->

        <!--Search Popup-->
    <div id="search-popup" class="search-popup">
        <div class="popup-inner">
            <div class="upper-box">
                <figure class="logo-box p_relative z_1"><a href="https://july.finestwp.com/newwp/fortradex/" title="Fortradex"><img src="https://july.finestwp.com/newwp/fortradex/wp-content/uploads/2024/07/logo.png" alt="logo" style="" /></a></figure>
                <div class="close-search"><i class="fal fa-times"></i></div>
            </div>
            <div class="overlay-layer"></div>
            <div class="auto-container">
                <div class="search-form">

<form method="post" action="https://july.finestwp.com/newwp/fortradex/">
    <div class="form-group">
        <fieldset>
            <input type="search" class="form-control" name="s" value="" placeholder="Search" required >
            <button type="submit"><i class="icon-10"></i></button>
        </fieldset>
    </div>
</form>                </div>
            </div>
        </div>
    </div>

    <!-- main header -->
    <header class="main-header header-style-one">
                <!-- header-top -->
        <div class="header-top">
            <div class="large-container">
                <div class="top-inner">
                                        <div class="support-box">
                        <div class="icon-box"><i class="icon-07"></i></div>
                        <a href="tel:91-2345-678">91-2345-678</a>
                    </div>
                                                            <div class="option-block">
                        <a href="#" class="theme-btn btn-one mr_10">Open Account</a>                        <a href="#" class="theme-btn btn-two">Login</a>                    </div>
                                    </div>
            </div>
        </div>
                <!-- header-lower -->
        <div class="header-lower">
            <div class="large-container">
                <div class="outer-box">
                    <figure class="logo-box"><a href="https://july.finestwp.com/newwp/fortradex/" title="Fortradex"><img src="https://july.finestwp.com/newwp/fortradex/wp-content/uploads/2024/07/logo.png" alt="logo" style="" /></a></figure>
                    <div class="menu-area">
                        <!--Mobile Navigation Toggler-->
                        <div class="mobile-nav-toggler">
                            <i class="icon-bar"></i>
                            <i class="icon-bar"></i>
                            <i class="icon-bar"></i>
                        </div>
                        <nav class="main-menu navbar-expand-md navbar-light clearfix">
                            <div class="collapse navbar-collapse show clearfix" id="navbarSupportedContent">
                                <ul class="navigation clearfix">
                                <li id="menu-item-18" class="menu-item menu-item-type-custom menu-item-object-custom current-menu-item current_page_item menu-item-home current-menu-ancestor current-menu-parent menu-item-has-children menu-item-18 dropdown current current"><a href="https://july.finestwp.com/newwp/fortradex/" onClick="return true">Home<span class="menu-item_plus"></span></a><ul class="sub-menu submenu menu-sub-content">	<li id="menu-item-20" class="menu-item menu-item-type-post_type menu-item-object-page menu-item-home current-menu-item page_item page-item-15 current_page_item menu-item-20 current"><a href="https://july.finestwp.com/newwp/fortradex/" onClick="return true">Home One<span class="menu-item_plus"></span></a></li>	<li id="menu-item-424" class="menu-item menu-item-type-post_type menu-item-object-page menu-item-424"><a href="https://july.finestwp.com/newwp/fortradex/home-two/" onClick="return true">Home Two<span class="menu-item_plus"></span></a></li>	<li id="menu-item-666" class="menu-item menu-item-type-post_type menu-item-object-page menu-item-666"><a href="https://july.finestwp.com/newwp/fortradex/home-three/" onClick="return true">Home Three<span class="menu-item_plus"></span></a></li>	<li id="menu-item-1064" class="menu-item menu-item-type-post_type menu-item-object-page menu-item-1064"><a href="https://july.finestwp.com/newwp/fortradex/home-four/" onClick="return true">Home Four<span class="menu-item_plus"></span></a></li>	<li id="menu-item-1198" class="menu-item menu-item-type-post_type menu-item-object-page menu-item-1198"><a href="https://july.finestwp.com/newwp/fortradex/home-five/" onClick="return true">Home Five<span class="menu-item_plus"></span></a></li></ul>

</li><li id="menu-item-137" class="menu-item menu-item-type-custom menu-item-object-custom menu-item-has-children menu-item-137 dropdown"><a href="#" onClick="return true">Trading<span class="menu-item_plus"></span></a><ul class="sub-menu submenu menu-sub-content">	<li id="menu-item-1404" class="menu-item menu-item-type-post_type menu-item-object-page menu-item-1404"><a href="https://july.finestwp.com/newwp/fortradex/platform/" onClick="return true">Platform<span class="menu-item_plus"></span></a></li>	<li id="menu-item-1433" class="menu-item menu-item-type-post_type menu-item-object-page menu-item-1433"><a href="https://july.finestwp.com/newwp/fortradex/account/" onClick="return true">Account<span class="menu-item_plus"></span></a></li>	<li id="menu-item-1934" class="menu-item menu-item-type-post_type menu-item-object-page menu-item-1934"><a href="https://july.finestwp.com/newwp/fortradex/account-details/" onClick="return true">Account Details<span class="menu-item_plus"></span></a></li></ul>
</li><li id="menu-item-138" class="menu-item menu-item-type-custom menu-item-object-custom menu-item-has-children menu-item-138 dropdown"><a href="#" onClick="return true">Market<span class="menu-item_plus"></span></a><ul class="sub-menu submenu menu-sub-content">	<li id="menu-item-1527" class="menu-item menu-item-type-post_type menu-item-object-page menu-item-1527"><a href="https://july.finestwp.com/newwp/fortradex/markets-place/" onClick="return true">Markets Place<span class="menu-item_plus"></span></a></li>	<li id="menu-item-2099" class="menu-item menu-item-type-post_type menu-item-object-page menu-item-2099"><a href="https://july.finestwp.com/newwp/fortradex/markets-details/" onClick="return true">Markets Details<span class="menu-item_plus"></span></a></li></ul>
</li><li id="menu-item-139" class="menu-item menu-item-type-custom menu-item-object-custom menu-item-has-children menu-item-139 dropdown"><a href="#" onClick="return true">About Us<span class="menu-item_plus"></span></a><ul class="sub-menu submenu menu-sub-content">	<li id="menu-item-1635" class="menu-item menu-item-type-custom menu-item-object-custom menu-item-has-children menu-item-1635 dropdown"><a href="#" onClick="return true">Education<span class="menu-item_plus"></span></a>	<ul class="sub-menu submenu menu-sub-content">		<li id="menu-item-2117" class="menu-item menu-item-type-post_type menu-item-object-page menu-item-2117"><a href="https://july.finestwp.com/newwp/fortradex/education/" onClick="return true">Education<span class="menu-item_plus"></span></a></li>		<li id="menu-item-2476" class="menu-item menu-item-type-post_type menu-item-object-page menu-item-2476"><a href="https://july.finestwp.com/newwp/fortradex/student-registration/" onClick="return true">Student Registration<span class="menu-item_plus"></span></a></li>		<li id="menu-item-2475" class="menu-item menu-item-type-post_type menu-item-object-page menu-item-2475"><a href="https://july.finestwp.com/newwp/fortradex/instructor-registration/" onClick="return true">Instructor Registration<span class="menu-item_plus"></span></a></li>		<li id="menu-item-2477" class="menu-item menu-item-type-post_type menu-item-object-page menu-item-2477"><a href="https://july.finestwp.com/newwp/fortradex/dashboard/" onClick="return true">Dashboard<span class="menu-item_plus"></span></a></li>	</ul>
</li>	<li id="menu-item-1636" class="menu-item menu-item-type-custom menu-item-object-custom menu-item-has-children menu-item-1636 dropdown"><a href="#" onClick="return true">Team<span class="menu-item_plus"></span></a>	<ul class="sub-menu submenu menu-sub-content">		<li id="menu-item-1660" class="menu-item menu-item-type-post_type menu-item-object-page menu-item-1660"><a href="https://july.finestwp.com/newwp/fortradex/our-expert-team/" onClick="return true">Our Expert Team<span class="menu-item_plus"></span></a></li>		<li id="menu-item-1746" class="menu-item menu-item-type-post_type menu-item-object-team menu-item-1746"><a href="https://july.finestwp.com/newwp/fortradex/team/aronic-kehan/" onClick="return true">Team Details<span class="menu-item_plus"></span></a></li>	</ul>
</li>	<li id="menu-item-1703" class="menu-item menu-item-type-post_type menu-item-object-page menu-item-1703"><a href="https://july.finestwp.com/newwp/fortradex/about-us/" onClick="return true">About Us<span class="menu-item_plus"></span></a></li>	<li id="menu-item-1727" class="menu-item menu-item-type-post_type menu-item-object-page menu-item-1727"><a href="https://july.finestwp.com/newwp/fortradex/faqs/" onClick="return true">Faq’s<span class="menu-item_plus"></span></a></li>	<li id="menu-item-1734" class="menu-item menu-item-type-custom menu-item-object-custom menu-item-1734"><a href="https://july.finestwp.com/newwp/fortradex/?p=123456abc" onClick="return true">404<span class="menu-item_plus"></span></a></li></ul>
</li><li id="menu-item-140" class="menu-item menu-item-type-custom menu-item-object-custom menu-item-has-children menu-item-140 dropdown"><a href="#" onClick="return true">Blog<span class="menu-item_plus"></span></a><ul class="sub-menu submenu menu-sub-content">	<li id="menu-item-1842" class="menu-item menu-item-type-post_type menu-item-object-page menu-item-1842"><a href="https://july.finestwp.com/newwp/fortradex/blog-grid/" onClick="return true">Blog Grid<span class="menu-item_plus"></span></a></li>	<li id="menu-item-1865" class="menu-item menu-item-type-post_type menu-item-object-page menu-item-1865"><a href="https://july.finestwp.com/newwp/fortradex/blog-standard/" onClick="return true">Blog Standard<span class="menu-item_plus"></span></a></li>	<li id="menu-item-2457" class="menu-item menu-item-type-post_type menu-item-object-post menu-item-2457"><a href="https://july.finestwp.com/newwp/fortradex/2024/07/a-traders-weekly-playbook-the-jpy-at-work-2/" onClick="return true">Blog Details<span class="menu-item_plus"></span></a></li></ul>
</li><li id="menu-item-143" class="menu-item menu-item-type-post_type menu-item-object-page menu-item-143"><a href="https://july.finestwp.com/newwp/fortradex/contact/" onClick="return true">Contact<span class="menu-item_plus"></span></a></li>     
                                </ul>
                            </div>
                        </nav>
                                                <div class="search-btn ml_30"><button class="search-toggler"><i class="icon-10"></i></button></div>
                                            </div>
                </div>
            </div>
        </div>

        <!--sticky Header-->
        <div class="sticky-header">
            <div class="large-container">
                <div class="outer-box">
                    <figure class="logo-box"><a href="https://july.finestwp.com/newwp/fortradex/" title="Fortradex"><img src="https://july.finestwp.com/newwp/fortradex/wp-content/uploads/2024/07/logo.png" alt="logo" style="" /></a></figure>
                    <div class="menu-area">
                        <nav class="main-menu clearfix">
                            <!--Keep This Empty / Menu will come through Javascript-->
                        </nav>
                                                <div class="search-btn ml_30"><button class="search-toggler"><i class="icon-10"></i></button></div>
                                            </div>
                </div>
            </div>
        </div>
    </header>
    <!-- main-header end -->



    <!-- Mobile Menu  -->
    <div class="mobile-menu">
        <div class="menu-backdrop"></div>
        <div class="close-btn"><i class="fas fa-times"></i></div>
        <nav class="menu-box">
            <div class="nav-logo">
            			<a href="https://july.finestwp.com/newwp/fortradex/" title="Fortradex"><img src="https://july.finestwp.com/newwp/fortradex/wp-content/uploads/2024/07/logo-2.png" alt="logo" style="" /></a>                        </div>
            <div class="menu-outer"><!--Here Menu Will Come Automatically Via Javascript / Same Menu as in Header--></div>

            <div class="contact-info">
                <h4>Contact Info</h4>                <ul>
                    <li>Chicago 12, Melborne City, USA</li>                    <li><a href="tel:+88-01682648101">+88-01682648101</a></li>                    <li><a href="mailto:info@example.com">info@example.com</a></li>                </ul>
            </div>

    		            <div class="social-links">
                <ul class="clearfix">

    	<li>
    	<a target="_blank" href="https://www.facebook.com/"><i class="fab  fa-facebook-f"></i></a>
    </li>
    	<li>
    	<a target="_blank" href="https://www.twitter.com/"><i class="fab  fa-twitter"></i></a>
    </li>
    	<li>
    	<a target="_blank" href="https://www.linkedin.com/"><i class="fab  fa-linkedin-in"></i></a>
    </li>
    	<li>
    	<a target="_blank" href="https://www.skype.com/"><i class="fab  fa-skype"></i></a>
    </li>


                    </ul>
            </div>
                    </nav>
    </div>
    <!-- End Mobile Menu -->
    				<div data-elementor-type="wp-page" data-elementor-id="15" class="elementor elementor-15">
    			<div class="elementor-element elementor-element-36a4c73 e-con-full e-flex e-con e-parent" data-id="36a4c73" data-element_type="container" data-e-type="container">
    			<div class="elementor-element elementor-element-c641e68 elementor-widget elementor-widget-fortradex_banner_carousel" data-id="c641e68" data-element_type="widget" data-e-type="widget" data-widget_type="fortradex_banner_carousel.default">
    			<div class="elementor-widget-container">


    <!-- banner-section -->
    <section class="banner-section p_relative pt_20">
        <div class="large-container">
            <div class="banner-carousel owl-theme owl-carousel owl-nav-none">
                                <div class="slide-item p_relative">
                                        <div class="bg-layer" style="background-image: url(https://july.finestwp.com/newwp/fortradex/wp-content/uploads/2024/07/banner-1.jpg);"></div>

                    <div class="content-box">
                        <h2>Trading for Anyone. Anywhere. Anytime.</h2>
                        <p>Trade over 1000 Instruments. Forex, CFDs on Stock Indices, Commodities, Stocks, Metals and Energies.</p>

    					                        <div class="btn-box">
                            <a href="https://july.finestwp.com/newwp/fortradex/account/"   class="theme-btn btn-one">Create Account</a>
                        </div>
                                            </div>
                </div>
                                <div class="slide-item p_relative">
                                        <div class="bg-layer" style="background-image: url(https://july.finestwp.com/newwp/fortradex/wp-content/uploads/2024/07/banner-2.jpg);"></div>

                    <div class="content-box">
                        <h2>Trading for Anyone. Anywhere. Anytime.</h2>
                        <p>Trade over 1000 Instruments. Forex, CFDs on Stock Indices, Commodities, Stocks, Metals and Energies.</p>

    					                        <div class="btn-box">
                            <a href="https://july.finestwp.com/newwp/fortradex/account/"   class="theme-btn btn-one">Create Account</a>
                        </div>
                                            </div>
                </div>
                                <div class="slide-item p_relative">
                                        <div class="bg-layer" style="background-image: url(https://july.finestwp.com/newwp/fortradex/wp-content/uploads/2024/07/banner-3.jpg);"></div>

                    <div class="content-box">
                        <h2>Trading for Anyone. Anywhere. Anytime.</h2>
                        <p>Trade over 1000 Instruments. Forex, CFDs on Stock Indices, Commodities, Stocks, Metals and Energies.</p>

    					                        <div class="btn-box">
                            <a href="https://july.finestwp.com/newwp/fortradex/account/"   class="theme-btn btn-one">Create Account</a>
                        </div>
                                            </div>
                </div>
                            </div>
        </div>
    </section>
    <!-- banner-section end -->


    				</div>
    			</div>
    			</div>
    	<div class="elementor-element elementor-element-690438c e-flex e-con-boxed e-con e-parent" data-id="690438c" data-element_type="container" data-e-type="container">
    				<div class="e-con-inner">
    			<div class="elementor-element elementor-element-4975860 elementor-widget elementor-widget-fortradex_clients" data-id="4975860" data-element_type="widget" data-e-type="widget" data-widget_type="fortradex_clients.default">
    			<div class="elementor-widget-container">


    <!-- clients-section -->
    <section class="clients-section pt_40 pb_40">
        <div class="large-container">
            <ul class="clients-list">
                                <li><a href="#"  target=&quot;_blank&quot;  rel=&quot;nofollow&quot;><img decoding="async" width="138" height="23" src="https://july.finestwp.com/newwp/fortradex/wp-content/uploads/2024/07/clients-1.png" class="attachment-full size-full wp-image-48" alt="" /></a></li>
                                <li><a href="#"  target=&quot;_blank&quot;  rel=&quot;nofollow&quot;><img decoding="async" width="175" height="31" src="https://july.finestwp.com/newwp/fortradex/wp-content/uploads/2024/07/clients-2.png" class="attachment-full size-full wp-image-49" alt="" /></a></li>
                                <li><a href="#"  target=&quot;_blank&quot;  rel=&quot;nofollow&quot;><img decoding="async" width="142" height="25" src="https://july.finestwp.com/newwp/fortradex/wp-content/uploads/2024/07/clients-3.png" class="attachment-full size-full wp-image-50" alt="" /></a></li>
                                <li><a href="#"  target=&quot;_blank&quot;  rel=&quot;nofollow&quot;><img loading="lazy" decoding="async" width="135" height="31" src="https://july.finestwp.com/newwp/fortradex/wp-content/uploads/2024/07/clients-4.png" class="attachment-full size-full wp-image-51" alt="" /></a></li>
                                <li><a href="#"  target=&quot;_blank&quot;  rel=&quot;nofollow&quot;><img loading="lazy" decoding="async" width="130" height="33" src="https://july.finestwp.com/newwp/fortradex/wp-content/uploads/2024/07/clients-5.png" class="attachment-full size-full wp-image-52" alt="" /></a></li>
                                <li><a href="#"  target=&quot;_blank&quot;  rel=&quot;nofollow&quot;><img loading="lazy" decoding="async" width="146" height="31" src="https://july.finestwp.com/newwp/fortradex/wp-content/uploads/2024/07/clients-6.png" class="attachment-full size-full wp-image-53" alt="" /></a></li>
                                <li><a href="#"  target=&quot;_blank&quot;  rel=&quot;nofollow&quot;><img loading="lazy" decoding="async" width="156" height="31" src="https://july.finestwp.com/newwp/fortradex/wp-content/uploads/2024/07/clients-7.png" class="attachment-full size-full wp-image-54" alt="" srcset="https://july.finestwp.com/newwp/fortradex/wp-content/uploads/2024/07/clients-7.png 156w, https://july.finestwp.com/newwp/fortradex/wp-content/uploads/2024/07/clients-7-150x31.png 150w" sizes="(max-width: 156px) 100vw, 156px" /></a></li>

            </ul>
        </div>
    </section>
    <!-- clients-section end -->


    				</div>
    			</div>
    				</div>
    			</div>
    	<div class="elementor-element elementor-element-40fe99a e-flex e-con-boxed e-con e-parent" data-id="40fe99a" data-element_type="container" data-e-type="container" data-settings="{&quot;background_background&quot;:&quot;classic&quot;}">
    				<div class="e-con-inner">
    			<div class="elementor-element elementor-element-ff504ba elementor-widget elementor-widget-fortradex_hero_title" data-id="ff504ba" data-element_type="widget" data-e-type="widget" data-widget_type="fortradex_hero_title.default">
    			<div class="elementor-widget-container">

    <div class="sec-title fortradex-title-section">
        		<h6 class="te-subtitle sub-title">Account</h6>
        		<h2 class="te-title fortradex-size-default">Trading Accounts</h2>
            </div>

    				</div>
    			</div>
    	<div class="elementor-element elementor-element-d2a6b14 e-grid e-con-full e-con e-child" data-id="d2a6b14" data-element_type="container" data-e-type="container">
    			<div class="elementor-element elementor-element-f051519 elementor-widget elementor-widget-fortradex_icon_box" data-id="f051519" data-element_type="widget" data-e-type="widget" data-widget_type="fortradex_icon_box.default">
    			<div class="elementor-widget-container">


    <div class="account-block-one wow fadeInUp animated fortradex-box-section" data-wow-delay="00ms" data-wow-duration="1500ms">
        <div class="inner-box">
            <div class="icon-box te-icon">
                            <i class="icon-01"></i>                        </div>
            <h3><a href="https://july.finestwp.com/newwp/fortradex/professional-account/"  >Professional Account</a></h3>
            <p>Traders with professional accounts gain access to a wide range of benefits, including enhanced trading platforms</p>
        </div>
    </div>

    				</div>
    			</div>
    			<div class="elementor-element elementor-element-5e8ac75 elementor-widget elementor-widget-fortradex_icon_box" data-id="5e8ac75" data-element_type="widget" data-e-type="widget" data-widget_type="fortradex_icon_box.default">
    			<div class="elementor-widget-container">


    <div class="account-block-one wow fadeInUp animated fortradex-box-section" data-wow-delay="00ms" data-wow-duration="1500ms">
        <div class="inner-box">
            <div class="icon-box te-icon">
                            <i class=" icon-02"></i>                        </div>
            <h3><a href="https://july.finestwp.com/newwp/fortradex/overview-account/"  >Overview Account</a></h3>
            <p>The primary feature of a trading overview account is its ability to aggregate information from multiple accounts and</p>
        </div>
    </div>

    				</div>
    			</div>
    			<div class="elementor-element elementor-element-444e9f9 elementor-widget elementor-widget-fortradex_icon_box" data-id="444e9f9" data-element_type="widget" data-e-type="widget" data-widget_type="fortradex_icon_box.default">
    			<div class="elementor-widget-container">


    <div class="account-block-one wow fadeInUp animated fortradex-box-section" data-wow-delay="00ms" data-wow-duration="1500ms">
        <div class="inner-box">
            <div class="icon-box te-icon">
                            <i class=" icon-03"></i>                        </div>
            <h3><a href="https://july.finestwp.com/newwp/fortradex/demo-account/"  >Demo Account</a></h3>
            <p>Trading demo accounts are particularly valuable for novice traders who are new to the world of investing.</p>
        </div>
    </div>

    				</div>
    			</div>
    			<div class="elementor-element elementor-element-5f09778 elementor-widget elementor-widget-fortradex_icon_box" data-id="5f09778" data-element_type="widget" data-e-type="widget" data-widget_type="fortradex_icon_box.default">
    			<div class="elementor-widget-container">


    <div class="account-block-one wow fadeInUp animated fortradex-box-section" data-wow-delay="00ms" data-wow-duration="1500ms">
        <div class="inner-box">
            <div class="icon-box te-icon">
                            <i class=" icon-04"></i>                        </div>
            <h3><a href="https://july.finestwp.com/newwp/fortradex/islamic-account/"  >Islamic Account</a></h3>
            <p>Islamic accounts also adhere to ethical guidelines that prohibit trading certain financial instruments deemed</p>
        </div>
    </div>

    				</div>
    			</div>
    			</div>
    				</div>
    			</div>
    	<div class="elementor-element elementor-element-5fbb8bd e-flex e-con-boxed e-con e-parent" data-id="5fbb8bd" data-element_type="container" data-e-type="container">
    				<div class="e-con-inner">
    	<div class="elementor-element elementor-element-ad2c413 e-con-full e-flex e-con e-child" data-id="ad2c413" data-element_type="container" data-e-type="container">
    			<div class="elementor-element elementor-element-a350e92 elementor-widget elementor-widget-fortradex_hero_title" data-id="a350e92" data-element_type="widget" data-e-type="widget" data-widget_type="fortradex_hero_title.default">
    			<div class="elementor-widget-container">

    <div class="sec-title fortradex-title-section">
        		<h6 class="te-subtitle sub-title">Account</h6>
        		<h2 class="te-title fortradex-size-default">Trading Accounts</h2>
            </div>

    				</div>
    			</div>
    			<div class="elementor-element elementor-element-47f8d8c elementor-widget elementor-widget-fortradex_faqs" data-id="47f8d8c" data-element_type="widget" data-e-type="widget" data-widget_type="fortradex_faqs.default">
    			<div class="elementor-widget-container">


    <div class="content_block_one">
        <div class="content-box">
            <ul class="accordion-box">
                                <li class="accordion block active-block">
                    <div class="acc-btn active">
                        <div class="icon-box"><i class="icon-29"></i></div>
                        <h3 class="te-title">Who we are</h3>
                    </div>
                    <div class="acc-content current">
                        <div class="content normal__text">
                            <p>As a brokerage firm or trading platform. We are dedicated to providing innovative and user-friendly trading</p>
                        </div>
                    </div>
                </li>
                                <li class="accordion block ">
                    <div class="acc-btn ">
                        <div class="icon-box"><i class="icon-29"></i></div>
                        <h3 class="te-title">What we do</h3>
                    </div>
                    <div class="acc-content ">
                        <div class="content normal__text">
                            <p>As a brokerage firm or trading platform. We are dedicated to providing innovative and user-friendly trading</p>
                        </div>
                    </div>
                </li>
                                <li class="accordion block ">
                    <div class="acc-btn ">
                        <div class="icon-box"><i class="icon-29"></i></div>
                        <h3 class="te-title">How it works</h3>
                    </div>
                    <div class="acc-content ">
                        <div class="content normal__text">
                            <p>As a brokerage firm or trading platform. We are dedicated to providing innovative and user-friendly trading</p>
                        </div>
                    </div>
                </li>
                            </ul>
        </div>
    </div>


    				</div>
    			</div>
    			</div>
    	<div class="elementor-element elementor-element-d9f46fb e-con-full e-flex e-con e-child" data-id="d9f46fb" data-element_type="container" data-e-type="container">
    			<div class="elementor-element elementor-element-d89eff2 elementor-widget elementor-widget-fortradex_video_section" data-id="d89eff2" data-element_type="widget" data-e-type="widget" data-widget_type="fortradex_video_section.default">
    			<div class="elementor-widget-container">



    <div class="video_block_one">
        <div class="video-box z_1 p_relative ml_70 centred">
            <div class="video-inner" style="background-image: url(https://july.finestwp.com/newwp/fortradex/wp-content/uploads/2024/07/video-1.jpg);">
                <div class="video-content">
                                        <div class="curve-text">
                        <span class="curved-circle">watch&nbsp;&nbsp;the&nbsp;&nbsp;video&nbsp;&nbsp;right&nbsp;&nbsp;now&nbsp;&nbsp;</span>
                    </div>
                                        <a href="https://www.youtube.com/watch?v=nfP5N9Yc72A&#038;t=28s" class="lightbox-image video-btn" data-caption=""><i class="icon-11"></i></a>                </div>
            </div>
        </div>
    </div>


    				</div>
    			</div>
    			</div>
    				</div>
    			</div>
    	<div class="elementor-element elementor-element-2c004e1 e-con-full e-flex e-con e-parent" data-id="2c004e1" data-element_type="container" data-e-type="container">
    			<div class="elementor-element elementor-element-c683f35 elementor-widget elementor-widget-fortradex_funfacts" data-id="c683f35" data-element_type="widget" data-e-type="widget" data-widget_type="fortradex_funfacts.default">
    			<div class="elementor-widget-container">


    <!-- funfact-section -->
    <section class="funfact-section">
        <div class="auto-container">
            <div class="inner-container">
                <div class="row clearfix">
                                        <div class="col-lg-4 col-md-6 col-sm-12 funfact-block">
                        <div class="funfact-block-one">
                            <div class="inner-box">
                                <div class="count-outer te-count">
                                    <span class="odometer" data-count="150">0</span>+<span class="text te-title">Countries</span>
                                </div>
                                <p class="te-text">Trade policies and agreements shape the trading landscape of countries</p>
                            </div>
                        </div>
                    </div>
                                        <div class="col-lg-4 col-md-6 col-sm-12 funfact-block">
                        <div class="funfact-block-one">
                            <div class="inner-box">
                                <div class="count-outer te-count">
                                    <span class="odometer" data-count="40">0</span>+<span class="text te-title">Million Invest</span>
                                </div>
                                <p class="te-text">Investing a million dollars in trading represents a significant opportunity and</p>
                            </div>
                        </div>
                    </div>
                                        <div class="col-lg-4 col-md-6 col-sm-12 funfact-block">
                        <div class="funfact-block-one">
                            <div class="inner-box">
                                <div class="count-outer te-count">
                                    <span class="odometer" data-count="90">0</span>+<span class="text te-title">Awards</span>
                                </div>
                                <p class="te-text">Trading awards recognize excellence and achievement within the financial</p>
                            </div>
                        </div>
                    </div>
                                    </div>
            </div>
        </div>
    </section>
    <!-- funfact-section end -->

    				</div>
    			</div>
    			</div>
    	<div class="elementor-element elementor-element-b2c0ab3 e-flex e-con-boxed e-con e-parent" data-id="b2c0ab3" data-element_type="container" data-e-type="container">
    				<div class="e-con-inner">
    			<div class="elementor-element elementor-element-2e39e36 elementor-widget elementor-widget-fortradex_hero_title" data-id="2e39e36" data-element_type="widget" data-e-type="widget" data-widget_type="fortradex_hero_title.default">
    			<div class="elementor-widget-container">

    <div class="sec-title fortradex-title-section">
        		<h6 class="te-subtitle sub-title">Trading Platforms</h6>
        		<h2 class="te-title fortradex-size-default">Things We Trade</h2>
            </div>

    				</div>
    			</div>
    			<div class="elementor-element elementor-element-0e84f2e elementor-widget elementor-widget-fortradex_feature_trading" data-id="0e84f2e" data-element_type="widget" data-e-type="widget" data-widget_type="fortradex_feature_trading.default">
    			<div class="elementor-widget-container">

    <!-- trading-section -->
    <section class="trading-section m-0 p-0">
        <div class="inner-container clearfix">
                        <div class="trading-block-one">
                <div class="inner-box">
                    <figure class="image-box"><img loading="lazy" decoding="async" width="206" height="211" src="https://july.finestwp.com/newwp/fortradex/wp-content/uploads/2024/07/trading-1.png" class="attachment-full size-full wp-image-159" alt="" /></figure>
                    <h3><a href="#"  target=&quot;_blank&quot;  rel=&quot;nofollow&quot;>Crypto Trading</a></h3>
                    <p>One of the primary methods of gold trading is through the spot</p>
                    <div class="btn-box"><a href="#"  target=&quot;_blank&quot;  rel=&quot;nofollow&quot; class="theme-btn btn-one">Start Trading Now</a></div>                </div>
            </div>
                        <div class="trading-block-one">
                <div class="inner-box">
                    <figure class="image-box"><img loading="lazy" decoding="async" width="229" height="216" src="https://july.finestwp.com/newwp/fortradex/wp-content/uploads/2024/07/trading-2.png" class="attachment-full size-full wp-image-160" alt="" /></figure>
                    <h3><a href="#"  target=&quot;_blank&quot;  rel=&quot;nofollow&quot;>Shares Trading</a></h3>
                    <p>One of the primary methods of gold trading is through the spot</p>
                    <div class="btn-box"><a href="#"  target=&quot;_blank&quot;  rel=&quot;nofollow&quot; class="theme-btn btn-one">Start Trading Now</a></div>                </div>
            </div>
                        <div class="trading-block-one">
                <div class="inner-box">
                    <figure class="image-box"><img loading="lazy" decoding="async" width="258" height="221" src="https://july.finestwp.com/newwp/fortradex/wp-content/uploads/2024/07/trading-3.png" class="attachment-full size-full wp-image-162" alt="" /></figure>
                    <h3><a href="#"  target=&quot;_blank&quot;  rel=&quot;nofollow&quot;>Gold Trading</a></h3>
                    <p>One of the primary methods of gold trading is through the spot</p>
                    <div class="btn-box"><a href="#"  target=&quot;_blank&quot;  rel=&quot;nofollow&quot; class="theme-btn btn-one">Start Trading Now</a></div>                </div>
            </div>
                        <div class="trading-block-one">
                <div class="inner-box">
                    <figure class="image-box"><img loading="lazy" decoding="async" width="229" height="216" src="https://july.finestwp.com/newwp/fortradex/wp-content/uploads/2024/07/trading-4.png" class="attachment-full size-full wp-image-163" alt="" /></figure>
                    <h3><a href="#"  target=&quot;_blank&quot;  rel=&quot;nofollow&quot;>Currency Trading</a></h3>
                    <p>One of the primary methods of gold trading is through the spot</p>
                    <div class="btn-box"><a href="#"  target=&quot;_blank&quot;  rel=&quot;nofollow&quot; class="theme-btn btn-one">Start Trading Now</a></div>                </div>
            </div>
                        <div class="trading-block-one">
                <div class="inner-box">
                    <figure class="image-box"><img loading="lazy" decoding="async" width="229" height="211" src="https://july.finestwp.com/newwp/fortradex/wp-content/uploads/2024/07/trading-5.png" class="attachment-full size-full wp-image-164" alt="" /></figure>
                    <h3><a href="#"  target=&quot;_blank&quot;  rel=&quot;nofollow&quot;>Silver Trading</a></h3>
                    <p>One of the primary methods of gold trading is through the spot</p>
                    <div class="btn-box"><a href="#"  target=&quot;_blank&quot;  rel=&quot;nofollow&quot; class="theme-btn btn-one">Start Trading Now</a></div>                </div>
            </div>
                    </div>
    </section>
    <!-- trading-section end -->

    				</div>
    			</div>
    				</div>
    			</div>
    	<div class="elementor-element elementor-element-3321e2c e-flex e-con-boxed e-con e-parent" data-id="3321e2c" data-element_type="container" data-e-type="container" data-settings="{&quot;background_background&quot;:&quot;classic&quot;}">
    				<div class="e-con-inner">
    			<div class="elementor-element elementor-element-39a33f1 elementor-widget elementor-widget-fortradex_hero_title" data-id="39a33f1" data-element_type="widget" data-e-type="widget" data-widget_type="fortradex_hero_title.default">
    			<div class="elementor-widget-container">

    <div class="sec-title fortradex-title-section">
        		<h6 class="te-subtitle sub-title">Trade Now</h6>
        		<h2 class="te-title fortradex-size-default">Market Spreads and Swaps</h2>
            </div>

    				</div>
    			</div>
    				</div>
    			</div>
    	<div class="elementor-element elementor-element-5c4d07b e-flex e-con-boxed e-con e-parent" data-id="5c4d07b" data-element_type="container" data-e-type="container">
    				<div class="e-con-inner">
    	<div class="elementor-element elementor-element-7050ec0 e-con-full e-flex e-con e-child" data-id="7050ec0" data-element_type="container" data-e-type="container">
    			<div class="elementor-element elementor-element-22a486c elementor-widget elementor-widget-fortradex_hero_title" data-id="22a486c" data-element_type="widget" data-e-type="widget" data-widget_type="fortradex_hero_title.default">
    			<div class="elementor-widget-container">

    <div class="sec-title fortradex-title-section">
        		<h6 class="te-subtitle sub-title">The Process</h6>
        		<h2 class="te-title fortradex-size-default">How It Works</h2>
            </div>

    				</div>
    			</div>
    			</div>
    	<div class="elementor-element elementor-element-a41f9a0 e-con-full e-flex e-con e-child" data-id="a41f9a0" data-element_type="container" data-e-type="container">
    	<div class="elementor-element elementor-element-b71b627 e-con-full e-flex e-con e-child" data-id="b71b627" data-element_type="container" data-e-type="container">
    			<div class="elementor-element elementor-element-8c9966f elementor-widget elementor-widget-fortradex_how_its_work" data-id="8c9966f" data-element_type="widget" data-e-type="widget" data-widget_type="fortradex_how_its_work.default">
    			<div class="elementor-widget-container">


    <!-- process-section -->
    <section class="process-section">
        <div class="content-box">
                        <div class="process-block-one">
                <div class="inner-box">
                    <div class="shape" style="background-image: url(https://july.finestwp.com/newwp/fortradex/wp-content/uploads/2024/07/shape-3.png);"></div>                    <span class="count-text">01</span>
                    <h3>Sign up, Its Free!</h3>
                    <p>Our team will set up your account and help you build job to  easy-to-use web dashboard.</p>
                </div>
            </div>
                        <div class="process-block-one">
                <div class="inner-box">
                    <div class="shape" style="background-image: url(https://july.finestwp.com/newwp/fortradex/wp-content/uploads/2024/07/shape-3.png);"></div>                    <span class="count-text">02</span>
                    <h3>Find best Deals and Invest</h3>
                    <p>Create and Trade anywhere from 1-100% openings with just a few clicks. customize your own.</p>
                </div>
            </div>
                        <div class="process-block-one">
                <div class="inner-box">
                    <div class="shape" style="background-image: url(https://july.finestwp.com/newwp/fortradex/wp-content/uploads/2024/07/shape-3.png);"></div>                    <span class="count-text">03</span>
                    <h3>Get you profit back</h3>
                    <p>View market, reviews, and rosters before forex arrive on the site, and post reviews and pay, effortlessly.</p>
                </div>
            </div>
                    </div>
    </section>

    				</div>
    			</div>
    			</div>
    	<div class="elementor-element elementor-element-766970c e-con-full e-flex e-con e-child" data-id="766970c" data-element_type="container" data-e-type="container">
    			<div class="elementor-element elementor-element-2804a31 elementor-widget elementor-widget-fortradex_float_image" data-id="2804a31" data-element_type="widget" data-e-type="widget" data-widget_type="fortradex_float_image.default">
    			<div class="elementor-widget-container">


    <!-- process-section -->
    <section class="process-section p-0 m-0">
        <div class="image-box">
            <figure class="image image-hov-two"><img loading="lazy" decoding="async" width="629" height="602" src="https://july.finestwp.com/newwp/fortradex/wp-content/uploads/2024/07/process-1.jpg" class="attachment-full size-full wp-image-212" alt="" srcset="https://july.finestwp.com/newwp/fortradex/wp-content/uploads/2024/07/process-1.jpg 629w, https://july.finestwp.com/newwp/fortradex/wp-content/uploads/2024/07/process-1-300x287.jpg 300w" sizes="(max-width: 629px) 100vw, 629px" /></figure>
        </div>
    </section>

    				</div>
    			</div>
    			</div>
    			</div>
    				</div>
    			</div>
    	<div class="elementor-element elementor-element-86b167f e-flex e-con-boxed e-con e-parent" data-id="86b167f" data-element_type="container" data-e-type="container">
    				<div class="e-con-inner">
    			<div class="elementor-element elementor-element-802ea81 elementor-widget-divider--view-line elementor-widget elementor-widget-divider" data-id="802ea81" data-element_type="widget" data-e-type="widget" data-widget_type="divider.default">
    			<div class="elementor-widget-container">
    						<div class="elementor-divider">
    		<span class="elementor-divider-separator">
    					</span>
    	</div>
    					</div>
    			</div>
    				</div>
    			</div>
    	<div class="elementor-element elementor-element-49d5511 e-flex e-con-boxed e-con e-parent" data-id="49d5511" data-element_type="container" data-e-type="container">
    				<div class="e-con-inner">
    			<div class="elementor-element elementor-element-964bb6d elementor-widget elementor-widget-fortradex_hero_title" data-id="964bb6d" data-element_type="widget" data-e-type="widget" data-widget_type="fortradex_hero_title.default">
    			<div class="elementor-widget-container">

    <div class="sec-title fortradex-title-section">
        		<h6 class="te-subtitle sub-title">AWARDED BY THE BEST</h6>
        		<h2 class="te-title fortradex-size-default">Globally Awarded</h2>
            </div>

    				</div>
    			</div>
    			<div class="elementor-element elementor-element-2919dcd elementor-widget elementor-widget-fortradex_best_award" data-id="2919dcd" data-element_type="widget" data-e-type="widget" data-widget_type="fortradex_best_award.default">
    			<div class="elementor-widget-container">

    <!-- award-section -->
    <section class="award-section p-0 m-0">
        <div class="table-outer">
            <table class="award-table">
                <tbody>
                                        <tr>
                        <td>01</td>
                        <td><h3><a href="#"  target=&quot;_blank&quot;  rel=&quot;nofollow&quot;>The Best Trading Platform, UK</a></h3></td>
                        <td><span>x1</span></td>
                        <td><figure class="image-box"><a href="#"  target=&quot;_blank&quot;  rel=&quot;nofollow&quot;><img loading="lazy" decoding="async" width="130" height="80" src="https://july.finestwp.com/newwp/fortradex/wp-content/uploads/2024/07/award-1.png" class="attachment-full size-full wp-image-243" alt="" /></a></figure></td>
                        <td>2023</td>
                    </tr>
                                        <tr>
                        <td>02</td>
                        <td><h3><a href="#"  target=&quot;_blank&quot;  rel=&quot;nofollow&quot;>Awards Interior Excellence</a></h3></td>
                        <td><span>x3</span></td>
                        <td><figure class="image-box"><a href="#"  target=&quot;_blank&quot;  rel=&quot;nofollow&quot;><img loading="lazy" decoding="async" width="130" height="80" src="https://july.finestwp.com/newwp/fortradex/wp-content/uploads/2024/07/award-2.png" class="attachment-full size-full wp-image-244" alt="" /></a></figure></td>
                        <td>2017</td>
                    </tr>
                                        <tr>
                        <td>03</td>
                        <td><h3><a href="#"  target=&quot;_blank&quot;  rel=&quot;nofollow&quot;>The Best Trading Platform, UK</a></h3></td>
                        <td><span>x4</span></td>
                        <td><figure class="image-box"><a href="#"  target=&quot;_blank&quot;  rel=&quot;nofollow&quot;><img loading="lazy" decoding="async" width="130" height="80" src="https://july.finestwp.com/newwp/fortradex/wp-content/uploads/2024/07/award-3.png" class="attachment-full size-full wp-image-245" alt="" /></a></figure></td>
                        <td>2022</td>
                    </tr>
                                        <tr>
                        <td>04</td>
                        <td><h3><a href="#"  target=&quot;_blank&quot;  rel=&quot;nofollow&quot;>Advance HighTechnology Trade</a></h3></td>
                        <td><span>x3</span></td>
                        <td><figure class="image-box"><a href="#"  target=&quot;_blank&quot;  rel=&quot;nofollow&quot;><img loading="lazy" decoding="async" width="130" height="80" src="https://july.finestwp.com/newwp/fortradex/wp-content/uploads/2024/07/award-4.png" class="attachment-full size-full wp-image-246" alt="" /></a></figure></td>
                        <td>2014</td>
                    </tr>
                                        <tr>
                        <td>05</td>
                        <td><h3><a href="#"  target=&quot;_blank&quot;  rel=&quot;nofollow&quot;>The Best Trading Platform, London</a></h3></td>
                        <td><span>x4</span></td>
                        <td><figure class="image-box"><a href="#"  target=&quot;_blank&quot;  rel=&quot;nofollow&quot;><img loading="lazy" decoding="async" width="130" height="80" src="https://july.finestwp.com/newwp/fortradex/wp-content/uploads/2024/07/award-5.png" class="attachment-full size-full wp-image-247" alt="" /></a></figure></td>
                        <td>2018</td>
                    </tr>
                                    </tbody>
            </table>
        </div>
    </section>
    <!-- award-section end -->

    				</div>
    			</div>
    				</div>
    			</div>
    	<div class="elementor-element elementor-element-db14a7c e-flex e-con-boxed e-con e-parent" data-id="db14a7c" data-element_type="container" data-e-type="container">
    				<div class="e-con-inner">
    	<div class="elementor-element elementor-element-1d41657 e-con-full e-flex e-con e-child" data-id="1d41657" data-element_type="container" data-e-type="container" data-settings="{&quot;background_background&quot;:&quot;gradient&quot;}">
    	<div class="elementor-element elementor-element-92a4bf1 e-con-full e-flex e-con e-child" data-id="92a4bf1" data-element_type="container" data-e-type="container">
    			<div class="elementor-element elementor-element-314a0e1 elementor-widget elementor-widget-fortradex_hero_title" data-id="314a0e1" data-element_type="widget" data-e-type="widget" data-widget_type="fortradex_hero_title.default">
    			<div class="elementor-widget-container">

    <div class="sec-title fortradex-title-section">
        		<h6 class="te-subtitle sub-title">Download App</h6>
        		<h2 class="te-title fortradex-size-default">Download Trading App</h2>
                <div class="text-box">
            <p class="te-text">We use cookines to understand how you use our website and to give you the best possible experience.</p>
        </div>
            </div>

    				</div>
    			</div>
    	<div class="elementor-element elementor-element-1673da4 e-con-full e-flex e-con e-child" data-id="1673da4" data-element_type="container" data-e-type="container">
    			<div class="elementor-element elementor-element-9f80de1 elementor-widget__width-initial elementor-view-default elementor-widget elementor-widget-icon" data-id="9f80de1" data-element_type="widget" data-e-type="widget" data-widget_type="icon.default">
    			<div class="elementor-widget-container">
    						<div class="elementor-icon-wrapper">
    		<a class="elementor-icon" href="#">
    		<svg aria-hidden="true" class="e-font-icon-svg e-fab-apple" viewBox="0 0 384 512" xmlns="http://www.w3.org/2000/svg"><path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"></path></svg>			</a>
    	</div>
    					</div>
    			</div>
    			<div class="elementor-element elementor-element-e562dda elementor-widget__width-initial elementor-view-default elementor-widget elementor-widget-icon" data-id="e562dda" data-element_type="widget" data-e-type="widget" data-widget_type="icon.default">
    			<div class="elementor-widget-container">
    						<div class="elementor-icon-wrapper">
    		<a class="elementor-icon" href="#">
    		<svg aria-hidden="true" class="e-font-icon-svg e-fab-windows" viewBox="0 0 448 512" xmlns="http://www.w3.org/2000/svg"><path d="M0 93.7l183.6-25.3v177.4H0V93.7zm0 324.6l183.6 25.3V268.4H0v149.9zm203.8 28L448 480V268.4H203.8v177.9zm0-380.6v180.1H448V32L203.8 65.7z"></path></svg>			</a>
    	</div>
    					</div>
    			</div>
    			<div class="elementor-element elementor-element-b3a9d7f elementor-widget__width-initial elementor-view-default elementor-widget elementor-widget-icon" data-id="b3a9d7f" data-element_type="widget" data-e-type="widget" data-widget_type="icon.default">
    			<div class="elementor-widget-container">
    						<div class="elementor-icon-wrapper">
    		<a class="elementor-icon" href="#">
    		<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" fill="#000000" height="800px" width="800px" id="Layer_1" viewBox="0 0 299.679 299.679" xml:space="preserve"><g id="XMLID_197_">	<path id="XMLID_221_" d="M181.122,299.679c10.02,0,18.758-8.738,18.758-18.758v-43.808h12.525c7.516,0,12.525-5.011,12.525-12.525  V99.466H74.749v125.123c0,7.515,5.01,12.525,12.525,12.525H99.8v43.808c0,10.02,8.736,18.758,18.758,18.758  c10.019,0,18.756-8.738,18.756-18.758v-43.808h25.051v43.808C162.364,290.941,171.102,299.679,181.122,299.679z"></path>	<path id="XMLID_222_" d="M256.214,224.589c10.02,0,18.756-8.737,18.756-18.758v-87.615c0-9.967-8.736-18.75-18.756-18.75  c-10.021,0-18.758,8.783-18.758,18.75v87.615C237.456,215.851,246.192,224.589,256.214,224.589z"></path>	<path id="XMLID_223_" d="M43.466,224.589c10.021,0,18.758-8.737,18.758-18.758v-87.615c0-9.967-8.736-18.75-18.758-18.75  c-10.02,0-18.756,8.783-18.756,18.75v87.615C24.71,215.851,33.446,224.589,43.466,224.589z"></path>	<path id="XMLID_224_" d="M209.899,1.89c-2.504-2.52-6.232-2.52-8.736,0l-16.799,16.743l-0.775,0.774  c-9.961-4.988-21.129-7.479-33.566-7.503c-0.061,0-0.121-0.002-0.182-0.002h-0.002c-0.063,0-0.121,0.002-0.184,0.002  c-12.436,0.024-23.604,2.515-33.564,7.503l-0.777-0.774L98.516,1.89c-2.506-2.52-6.232-2.52-8.736,0  c-2.506,2.506-2.506,6.225,0,8.729l16.25,16.253c-5.236,3.496-9.984,7.774-14.113,12.667C82.032,51.256,75.727,66.505,74.86,83.027  c-0.008,0.172-0.025,0.342-0.033,0.514c-0.053,1.125-0.078,2.256-0.078,3.391H224.93c0-1.135-0.027-2.266-0.078-3.391  c-0.008-0.172-0.025-0.342-0.035-0.514c-0.865-16.522-7.172-31.772-17.057-43.487c-4.127-4.893-8.877-9.171-14.113-12.667  l16.252-16.253C212.405,8.115,212.405,4.396,209.899,1.89z M118.534,65.063c-5.182,0-9.383-4.201-9.383-9.383  c0-5.182,4.201-9.383,9.383-9.383c5.182,0,9.383,4.201,9.383,9.383C127.917,60.862,123.716,65.063,118.534,65.063z M181.145,65.063  c-5.182,0-9.383-4.201-9.383-9.383c0-5.182,4.201-9.383,9.383-9.383c5.182,0,9.383,4.201,9.383,9.383  C190.528,60.862,186.327,65.063,181.145,65.063z"></path></g></svg>			</a>
    	</div>
    					</div>
    			</div>
    			<div class="elementor-element elementor-element-9a76355 elementor-widget__width-initial elementor-view-default elementor-widget elementor-widget-icon" data-id="9a76355" data-element_type="widget" data-e-type="widget" data-widget_type="icon.default">
    			<div class="elementor-widget-container">
    						<div class="elementor-icon-wrapper">
    		<a class="elementor-icon" href="#">
    		<svg aria-hidden="true" class="e-font-icon-svg e-far-object-group" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><path d="M500 128c6.627 0 12-5.373 12-12V44c0-6.627-5.373-12-12-12h-72c-6.627 0-12 5.373-12 12v12H96V44c0-6.627-5.373-12-12-12H12C5.373 32 0 37.373 0 44v72c0 6.627 5.373 12 12 12h12v256H12c-6.627 0-12 5.373-12 12v72c0 6.627 5.373 12 12 12h72c6.627 0 12-5.373 12-12v-12h320v12c0 6.627 5.373 12 12 12h72c6.627 0 12-5.373 12-12v-72c0-6.627-5.373-12-12-12h-12V128h12zm-52-64h32v32h-32V64zM32 64h32v32H32V64zm32 384H32v-32h32v32zm416 0h-32v-32h32v32zm-40-64h-12c-6.627 0-12 5.373-12 12v12H96v-12c0-6.627-5.373-12-12-12H72V128h12c6.627 0 12-5.373 12-12v-12h320v12c0 6.627 5.373 12 12 12h12v256zm-36-192h-84v-52c0-6.628-5.373-12-12-12H108c-6.627 0-12 5.372-12 12v168c0 6.628 5.373 12 12 12h84v52c0 6.628 5.373 12 12 12h200c6.627 0 12-5.372 12-12V204c0-6.628-5.373-12-12-12zm-268-24h144v112H136V168zm240 176H232v-24h76c6.627 0 12-5.372 12-12v-76h56v112z"></path></svg>			</a>
    	</div>
    					</div>
    			</div>
    			</div>
    			</div>
    	<div class="elementor-element elementor-element-b7b8f77 e-con-full elementor-hidden-tablet elementor-hidden-mobile e-flex e-con e-child" data-id="b7b8f77" data-element_type="container" data-e-type="container">
    			<div class="elementor-element elementor-element-8914707 elementor-hidden-mobile elementor-widget elementor-widget-image" data-id="8914707" data-element_type="widget" data-e-type="widget" data-widget_type="image.default">
    			<div class="elementor-widget-container">
    														<img loading="lazy" decoding="async" width="552" height="440" src="https://july.finestwp.com/newwp/fortradex/wp-content/uploads/2024/07/mockup-1.png" class="attachment-full size-full wp-image-283" alt="" srcset="https://july.finestwp.com/newwp/fortradex/wp-content/uploads/2024/07/mockup-1.png 552w, https://july.finestwp.com/newwp/fortradex/wp-content/uploads/2024/07/mockup-1-300x239.png 300w" sizes="(max-width: 552px) 100vw, 552px" />															</div>
    			</div>
    			</div>
    			</div>
    				</div>
    			</div>
    	<div class="elementor-element elementor-element-1b681f7 e-flex e-con-boxed e-con e-parent" data-id="1b681f7" data-element_type="container" data-e-type="container">
    				<div class="e-con-inner">
    			<div class="elementor-element elementor-element-8702a96 elementor-widget elementor-widget-fortradex_hero_title" data-id="8702a96" data-element_type="widget" data-e-type="widget" data-widget_type="fortradex_hero_title.default">
    			<div class="elementor-widget-container">

    <div class="sec-title fortradex-title-section">
        		<h6 class="te-subtitle sub-title">Media Center</h6>
        		<h2 class="te-title fortradex-size-default">Latest News Update</h2>
            </div>

    				</div>
    			</div>
    			<div class="elementor-element elementor-element-d77a3db elementor-widget elementor-widget-fortradex_blog_grid" data-id="d77a3db" data-element_type="widget" data-e-type="widget" data-widget_type="fortradex_blog_grid.default">
    			<div class="elementor-widget-container">


        <!-- news-section -->
        <section class="news-section p-0 m-0">
            <div class="row clearfix">
                                <div class="col-lg-4 col-md-6 col-sm-12 news-block">
                    <div class="news-block-one wow fadeInUp animated" data-wow-delay="00ms" data-wow-duration="1500ms">
                        <div class="inner-box">
                            <span class="post-date">July 13, 2024</span>                            <h3><a href="https://july.finestwp.com/newwp/fortradex/2024/07/niger-pm-says-oil-export-blockade-violates-accords/">Niger PM says oil export blockade violates accords</a></h3>
                            <p>We closed out what was a strong week for equity indices large number of trades within a short timeframe, aiming to profit from small price&hellip;</p>
                            <div class="link"><a href="https://july.finestwp.com/newwp/fortradex/2024/07/niger-pm-says-oil-export-blockade-violates-accords/">
    						                                Read More                                                        </a></div>
                        </div>

    					                        <div class="author-box">
                                                        <figure class="author-thumb"><img alt='' src='https://secure.gravatar.com/avatar/bfbbbbbf15bfbfdbe29a43a6dfaf20857b1e04846902b89c3e63eae69d322d7e?s=40&#038;d=mm&#038;r=g' srcset='https://secure.gravatar.com/avatar/bfbbbbbf15bfbfdbe29a43a6dfaf20857b1e04846902b89c3e63eae69d322d7e?s=80&#038;d=mm&#038;r=g 2x' class='avatar avatar-40 photo' height='40' width='40' /></figure>
                                                        <span>admin</span>
                        </div>
                                            </div>
                </div>
                                <div class="col-lg-4 col-md-6 col-sm-12 news-block">
                    <div class="news-block-one wow fadeInUp animated" data-wow-delay="00ms" data-wow-duration="1500ms">
                        <div class="inner-box">
                            <span class="post-date">July 13, 2024</span>                            <h3><a href="https://july.finestwp.com/newwp/fortradex/2024/07/chinas-geo-jade-wins-bid-to-develop-iraqs-jabal-oil/">China&#8217;s Geo-Jade wins bid to develop Iraq&#8217;s Jabal oil</a></h3>
                            <p>We closed out what was a strong week for equity indices large number of trades within a short timeframe, aiming to profit from small price&hellip;</p>
                            <div class="link"><a href="https://july.finestwp.com/newwp/fortradex/2024/07/chinas-geo-jade-wins-bid-to-develop-iraqs-jabal-oil/">
    						                                Read More                                                        </a></div>
                        </div>

    					                        <div class="author-box">
                                                        <figure class="author-thumb"><img alt='' src='https://secure.gravatar.com/avatar/bfbbbbbf15bfbfdbe29a43a6dfaf20857b1e04846902b89c3e63eae69d322d7e?s=40&#038;d=mm&#038;r=g' srcset='https://secure.gravatar.com/avatar/bfbbbbbf15bfbfdbe29a43a6dfaf20857b1e04846902b89c3e63eae69d322d7e?s=80&#038;d=mm&#038;r=g 2x' class='avatar avatar-40 photo' height='40' width='40' /></figure>
                                                        <span>admin</span>
                        </div>
                                            </div>
                </div>
                                <div class="col-lg-4 col-md-6 col-sm-12 news-block">
                    <div class="news-block-one wow fadeInUp animated" data-wow-delay="00ms" data-wow-duration="1500ms">
                        <div class="inner-box">
                            <span class="post-date">July 13, 2024</span>                            <h3><a href="https://july.finestwp.com/newwp/fortradex/2024/07/a-traders-weekly-playbook-the-jpy-at-work/">A Traders’ Weekly Playbook: The JPY at work</a></h3>
                            <p>We closed out what was a strong week for equity indices large number of trades within a short timeframe, aiming to profit from small price&hellip;</p>
                            <div class="link"><a href="https://july.finestwp.com/newwp/fortradex/2024/07/a-traders-weekly-playbook-the-jpy-at-work/">
    						                                Read More                                                        </a></div>
                        </div>

    					                        <div class="author-box">
                                                        <figure class="author-thumb"><img alt='' src='https://secure.gravatar.com/avatar/bfbbbbbf15bfbfdbe29a43a6dfaf20857b1e04846902b89c3e63eae69d322d7e?s=40&#038;d=mm&#038;r=g' srcset='https://secure.gravatar.com/avatar/bfbbbbbf15bfbfdbe29a43a6dfaf20857b1e04846902b89c3e63eae69d322d7e?s=80&#038;d=mm&#038;r=g 2x' class='avatar avatar-40 photo' height='40' width='40' /></figure>
                                                        <span>admin</span>
                        </div>
                                            </div>
                </div>
                            </div>
        </section>
        <!-- news-section end -->


        				</div>
    			</div>
    				</div>
    			</div>
    	<div class="elementor-element elementor-element-f34be87 e-flex e-con-boxed e-con e-parent" data-id="f34be87" data-element_type="container" data-e-type="container" data-settings="{&quot;background_background&quot;:&quot;gradient&quot;}">
    				<div class="e-con-inner">
    	<div class="elementor-element elementor-element-7e3381b e-con-full e-flex e-con e-child" data-id="7e3381b" data-element_type="container" data-e-type="container" data-settings="{&quot;background_background&quot;:&quot;classic&quot;}">
    	<div class="elementor-element elementor-element-8b23835 e-con-full e-flex e-con e-child" data-id="8b23835" data-element_type="container" data-e-type="container">
    			<div class="elementor-element elementor-element-f256619 elementor-widget elementor-widget-heading" data-id="f256619" data-element_type="widget" data-e-type="widget" data-widget_type="heading.default">
    			<div class="elementor-widget-container">
    				<h2 class="elementor-heading-title elementor-size-default">

Subscribe for latest update</h2> </div>
</div>
</div>
<div class="elementor-element elementor-element-296b0e1 e-con-full e-flex e-con e-child" data-id="296b0e1" data-element_type="container" data-e-type="container">
<div class="elementor-element elementor-element-c14e94a elementor-widget elementor-widget-fortradex_subscribe_form" data-id="c14e94a" data-element_type="widget" data-e-type="widget" data-widget_type="fortradex_subscribe_form.default">
<div class="elementor-widget-container">

    <!-- subscribe-section -->
    <section class="subscribe-section p-0 m-0">
        <div class="form-inner">
                    </div>
    </section>
    <!-- subscribe-section end -->

    				</div>
    			</div>
    			</div>
    			</div>
    				</div>
    			</div>
    			</div>


    <!-- main-footer -->
    <footer class="main-footer">
        <div class="widget-section p_relative pt_70 pb_80">
            <div class="auto-container">
                <div class="row clearfix">
                    <div class="col-lg-8 col-md-12 col-sm-12 big-column">
                                                <div class="row clearfix">
                            <div class="col-lg-3 col-md-6 col-sm-12 footer-column"><div id="nav_menu-2" class="footer-widget widget_nav_menu"><div class="widget-title mb_11"><h3>About Us</h3></div><div class="menu-footer-about-us-container"><ul id="menu-footer-about-us" class="menu"><li id="menu-item-1887" class="menu-item menu-item-type-post_type menu-item-object-page menu-item-1887"><a href="https://july.finestwp.com/newwp/fortradex/about-us/" onClick="return true">About Us</a></li>

<li id="menu-item-1890" class="menu-item menu-item-type-post_type menu-item-object-page menu-item-1890"><a href="https://july.finestwp.com/newwp/fortradex/faqs/" onClick="return true">Faq’s</a></li>
<li id="menu-item-1891" class="menu-item menu-item-type-post_type menu-item-object-page menu-item-1891"><a href="https://july.finestwp.com/newwp/fortradex/our-expert-team/" onClick="return true">Our Team</a></li>
<li id="menu-item-1892" class="menu-item menu-item-type-post_type menu-item-object-page menu-item-1892"><a href="https://july.finestwp.com/newwp/fortradex/markets-place/" onClick="return true">Markets Place</a></li>
<li id="menu-item-1893" class="menu-item menu-item-type-post_type menu-item-object-page menu-item-1893"><a href="https://july.finestwp.com/newwp/fortradex/platform/" onClick="return true">Platform</a></li>
<li id="menu-item-1888" class="menu-item menu-item-type-post_type menu-item-object-page menu-item-1888"><a href="https://july.finestwp.com/newwp/fortradex/blog-grid/" onClick="return true">Blog Grid</a></li>
<li id="menu-item-1889" class="menu-item menu-item-type-post_type menu-item-object-page menu-item-1889"><a href="https://july.finestwp.com/newwp/fortradex/contact/" onClick="return true">Contact Us</a></li>
</ul></div></div></div><div class="col-lg-3 col-md-6 col-sm-12 footer-column"><div id="nav_menu-3" class="footer-widget widget_nav_menu"><div class="widget-title mb_11"><h3>Platforms</h3></div><div class="menu-footer-platforms-menu-container"><ul id="menu-footer-platforms-menu" class="menu"><li id="menu-item-1894" class="menu-item menu-item-type-custom menu-item-object-custom menu-item-1894"><a href="#" onClick="return true">Forex</a></li>
<li id="menu-item-1895" class="menu-item menu-item-type-custom menu-item-object-custom menu-item-1895"><a href="#" onClick="return true">Crypto CFDs</a></li>
<li id="menu-item-1896" class="menu-item menu-item-type-custom menu-item-object-custom menu-item-1896"><a href="#" onClick="return true">Share CFDs</a></li>
<li id="menu-item-1897" class="menu-item menu-item-type-custom menu-item-object-custom menu-item-1897"><a href="#" onClick="return true">Commodities</a></li>
<li id="menu-item-1898" class="menu-item menu-item-type-custom menu-item-object-custom menu-item-1898"><a href="#" onClick="return true">Spot Metals</a></li>
<li id="menu-item-1899" class="menu-item menu-item-type-custom menu-item-object-custom menu-item-1899"><a href="#" onClick="return true">Energies</a></li>
<li id="menu-item-1900" class="menu-item menu-item-type-custom menu-item-object-custom menu-item-1900"><a href="#" onClick="return true">MetaTrader 5</a></li>
</ul></div></div></div><div class="col-lg-3 col-md-6 col-sm-12 footer-column"><div id="nav_menu-4" class="footer-widget widget_nav_menu"><div class="widget-title mb_11"><h3>Trading Tools</h3></div><div class="menu-trading-tools-menu-container"><ul id="menu-trading-tools-menu" class="menu"><li id="menu-item-1901" class="menu-item menu-item-type-custom menu-item-object-custom menu-item-1901"><a href="#" onClick="return true">FXT Navigator</a></li>
<li id="menu-item-1902" class="menu-item menu-item-type-custom menu-item-object-custom menu-item-1902"><a href="#" onClick="return true">Trading Central</a></li>
<li id="menu-item-1903" class="menu-item menu-item-type-custom menu-item-object-custom menu-item-1903"><a href="#" onClick="return true">Economic Calendar</a></li>
<li id="menu-item-1904" class="menu-item menu-item-type-custom menu-item-object-custom menu-item-1904"><a href="#" onClick="return true">Market Sentiment</a></li>
<li id="menu-item-1905" class="menu-item menu-item-type-custom menu-item-object-custom menu-item-1905"><a href="#" onClick="return true">API Trading</a></li>
<li id="menu-item-1906" class="menu-item menu-item-type-custom menu-item-object-custom menu-item-1906"><a href="#" onClick="return true">VPS</a></li>
<li id="menu-item-1907" class="menu-item menu-item-type-custom menu-item-object-custom menu-item-1907"><a href="#" onClick="return true">CDF Rollover</a></li>
</ul></div></div></div><div class="col-lg-3 col-md-6 col-sm-12 footer-column"><div id="nav_menu-5" class="footer-widget widget_nav_menu"><div class="widget-title mb_11"><h3>Support</h3></div><div class="menu-support-menu-container"><ul id="menu-support-menu" class="menu"><li id="menu-item-1908" class="menu-item menu-item-type-custom menu-item-object-custom menu-item-1908"><a href="#" onClick="return true">Legal Information</a></li>
<li id="menu-item-1909" class="menu-item menu-item-type-custom menu-item-object-custom menu-item-1909"><a href="#" onClick="return true">Privacy Policy</a></li>
<li id="menu-item-1910" class="menu-item menu-item-type-custom menu-item-object-custom menu-item-1910"><a href="#" onClick="return true">Regulations</a></li>
<li id="menu-item-1911" class="menu-item menu-item-type-custom menu-item-object-custom menu-item-1911"><a href="#" onClick="return true">Risk Disclaimer</a></li>
<li id="menu-item-1912" class="menu-item menu-item-type-custom menu-item-object-custom menu-item-1912"><a href="#" onClick="return true">Complaints Procedure</a></li>
<li id="menu-item-1913" class="menu-item menu-item-type-custom menu-item-object-custom menu-item-1913"><a href="#" onClick="return true">Company News</a></li>
<li id="menu-item-1914" class="menu-item menu-item-type-custom menu-item-object-custom menu-item-1914"><a href="#" onClick="return true">Trading Videos</a></li>
</ul></div></div></div>                        </div>

                                                <div class="footer-lower">
                            <figure class="footer-logo"><a href="https://july.finestwp.com/newwp/fortradex/"><img src="https://july.finestwp.com/newwp/fortradex/wp-content/uploads/2024/07/logo.png" alt="Fortradex"></a></figure>
                            <ul class="footer-card clearfix">
                                <li><h4>We Accept:</h4></li>

                                                                <li><a href="#"><img src="https://july.finestwp.com/newwp/fortradex/wp-content/uploads/2024/07/card-1.png" alt="Fortradex"></a></li>
                                                                <li><a href="#"><img src="https://july.finestwp.com/newwp/fortradex/wp-content/uploads/2024/07/card-2.png" alt="Fortradex"></a></li>
                                                                <li><a href="#"><img src="https://july.finestwp.com/newwp/fortradex/wp-content/uploads/2024/07/card-3.png" alt="Fortradex"></a></li>
                                                                <li><a href="#"><img src="https://july.finestwp.com/newwp/fortradex/wp-content/uploads/2024/07/card-4.png" alt="Fortradex"></a></li>
                                                                <li><a href="#"><img src="https://july.finestwp.com/newwp/fortradex/wp-content/uploads/2024/07/card-5.png" alt="Fortradex"></a></li>
                                                                <li><a href="#"><img src="https://july.finestwp.com/newwp/fortradex/wp-content/uploads/2024/07/card-6.png" alt="Fortradex"></a></li>
                                                            </ul>
                        </div>
                                            </div>

                                        <div class="col-lg-4 col-md-6 col-sm-12 footer-column">
                        <div class="footer-widget logo-widget centred ml_80">
                            <div class="widget-content">
                                                                    <figure class="footer-logo mb_15"><a href="https://july.finestwp.com/newwp/fortradex/">
                                    	<img src="https://july.finestwp.com/newwp/fortradex/wp-content/uploads/2024/07/logo-3.png" alt="Fortradex"></a>
                                    </figure>
    							                                <p>Trade multipliers on our app.</p>
                                                                <div class="scanner-box mb_30"><img src="https://july.finestwp.com/newwp/fortradex/wp-content/uploads/2024/07/icon-3.png" alt="Fortradex"></div>
                                                                <ul class="download-list clearfix">
                                    <li><a href="#"><i class="fab fa-apple"></i></a></li>                                    <li><a href="#"><img src="https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/images/icons/icon-2.png" alt="Fortradex"></a></li>                                    <li><a href="#"><i class="fab fa-android"></i></a></li>                                </ul>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>

        <div class="footer-bottom">
            <div class="auto-container">
                <div class="bottom-inner">
                    <p>Copyright &copy; 2007-2030 <a href="#">ForTradex</a>. All rights reserved.</p>
                                        <ul class="social-links">
                        <li><h5>Follow Us On:</h5></li>

    	<li>
    	<a target="_blank" href="https://www.facebook.com/"><i class="fab  fa-facebook-f"></i></a>
    </li>
    	<li>
    	<a target="_blank" href="https://www.twitter.com/"><i class="fab  fa-twitter"></i></a>
    </li>
    	<li>
    	<a target="_blank" href="https://www.linkedin.com/"><i class="fab  fa-linkedin-in"></i></a>
    </li>
    	<li>
    	<a target="_blank" href="https://www.skype.com/"><i class="fab  fa-skype"></i></a>
    </li>


                        </ul>
                                    </div>
            </div>
        </div>

    </footer>
    <!-- main-footer end -->


    <!--Scroll to top-->
    <div class="scroll-to-top">
        <svg class="scroll-top-inner" viewBox="-1 -1 102 102">
            <path d="M50,1 a49,49 0 0,1 0,98 a49,49 0 0,1 0,-98" />
        </svg>
    </div>

    <!-- page-direction -->
    <div class="page_direction">
        <div class="demo-rtl direction_switch"><button class="rtl">RTL</button></div>
        <div class="demo-ltr direction_switch"><button class="ltr">LTR</button></div>
    </div>
    <!-- page-direction end -->


    <!-- demo-switch -->
    <div class="demo-switch">
        <div class="demo-dark-bg demo_switch"><button><i class="fas fa-sun"></i></button></div>
        <div class="demo-light-bg demo_switch"><button><i class="fas fa-moon"></i></button></div>
    </div>
    <!-- demo-switch end -->

</div>

<script type="speculationrules">
{"prefetch":[{"source":"document","where":{"and":[{"href_matches":"/newwp/fortradex/*"},{"not":{"href_matches":["/newwp/fortradex/wp-*.php","/newwp/fortradex/wp-admin/*","/newwp/fortradex/wp-content/uploads/*","/newwp/fortradex/wp-content/*","/newwp/fortradex/wp-content/plugins/*","/newwp/fortradex/wp-content/themes/fortradex/*","/newwp/fortradex/*\\?(.+)"]}},{"not":{"selector_matches":"a[rel~=\"nofollow\"]"}},{"not":{"selector_matches":".no-prefetch, .no-prefetch a"}}]},"eagerness":"conservative"}]}
</script>

    		<script>
    			( () => {
    				const lazyloadRunObserver = () => {
    					const lazyloadBackgrounds = document.querySelectorAll( `.e-con.e-parent:not(.e-lazyloaded)` );
    					const lazyloadBackgroundObserver = new IntersectionObserver( ( entries ) => {
    						entries.forEach( ( entry ) => {
    							if ( entry.isIntersecting ) {
    								let lazyloadBackground = entry.target;
    								if( lazyloadBackground ) {
    									lazyloadBackground.classList.add( 'e-lazyloaded' );
    								}
    								lazyloadBackgroundObserver.unobserve( entry.target );
    							}
    						});
    					}, { rootMargin: '200px 0px 200px 0px' } );
    					lazyloadBackgrounds.forEach( ( lazyloadBackground ) => {
    						lazyloadBackgroundObserver.observe( lazyloadBackground );
    					} );
    				};
    				const events = [
    					'DOMContentLoaded',
    					'elementor/lazyload/observe',
    				];
    				events.forEach( ( event ) => {
    					document.addEventListener( event, lazyloadRunObserver );
    				} );
    			} )();
    		</script>
    			<script type='text/javascript'>
    	(function () {
    		var c = document.body.className;
    		c = c.replace(/woocommerce-no-js/, 'woocommerce-js');
    		document.body.className = c;
    	})();
    </script>
    <link rel='stylesheet' id='wc-blocks-style-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/plugins/woocommerce/assets/client/blocks/wc-blocks.css?ver=wc-11.0.1' media='all' />

<script id="wp-hooks-js" src="https://july.finestwp.com/newwp/fortradex/wp-includes/js/dist/hooks.min.js?ver=f0f188028580e8dc1255"></script>
<script id="wp-i18n-js" src="https://july.finestwp.com/newwp/fortradex/wp-includes/js/dist/i18n.min.js?ver=1dfe7db3940c23ea9216"></script>
<script id="wp-i18n-js-after">
wp.i18n.setLocaleData( { 'text direction\u0004ltr': [ 'ltr' ] } );
//# sourceURL=wp-i18n-js-after
</script>
<script id="swv-js" src="https://july.finestwp.com/newwp/fortradex/wp-content/plugins/contact-form-7/includes/swv/js/index.js?ver=6.1.7"></script>
<script id="contact-form-7-js-before">
var wpcf7 = {
    "api": {
        "root": "https:\/\/july.finestwp.com\/newwp\/fortradex\/wp-json\/",
        "namespace": "contact-form-7\/v1"
    }
};
//# sourceURL=contact-form-7-js-before
</script>
<script id="contact-form-7-js" src="https://july.finestwp.com/newwp/fortradex/wp-content/plugins/contact-form-7/includes/js/index.js?ver=6.1.7"></script>
<script id="react-js" src="https://july.finestwp.com/newwp/fortradex/wp-includes/js/dist/vendor/react.min.js?ver=18.3.1.1"></script>
<script id="react-dom-js" src="https://july.finestwp.com/newwp/fortradex/wp-includes/js/dist/vendor/react-dom.min.js?ver=18.3.1.1"></script>
<script id="wp-escape-html-js" src="https://july.finestwp.com/newwp/fortradex/wp-includes/js/dist/escape-html.min.js?ver=87ebe53e97bba59805a5"></script>
<script id="wp-element-js" src="https://july.finestwp.com/newwp/fortradex/wp-includes/js/dist/element.min.js?ver=4a4370b2b349066fd440"></script>
<script id="tutor-script-js-extra">
var _tutorobject = {"ajaxurl":"https://july.finestwp.com/newwp/fortradex/wp-admin/admin-ajax.php","home_url":"https://july.finestwp.com/newwp/fortradex","site_url":"https://july.finestwp.com/newwp/fortradex","site_title":"Fortradex","base_path":"/newwp/fortradex/","tutor_url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/","tutor_pro_url":null,"nonce_key":"_tutor_nonce","_tutor_nonce":"91e585bd72","loading_icon_url":"https://july.finestwp.com/newwp/fortradex/wp-admin/images/wpspin_light.gif","placeholder_img_src":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/placeholder.svg","enable_lesson_classic_editor":"","tutor_frontend_dashboard_url":"https://july.finestwp.com/newwp/fortradex/dashboard/","is_dashboard_page":"","wp_date_format":"MMMM d, yyyy","start_of_week":"1","is_admin":"","is_admin_bar_showing":"","addons_data":[{"name":"Course Bundle","description":"Group multiple courses to sell together.","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/course-bundle/thumbnail.svg","base_name":"course-bundle","is_enabled":0},{"name":"Subscription","description":"Manage subscription","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/subscription/thumbnail.png","base_name":"subscription","is_enabled":0},{"name":"Content Bank","description":"Create content once and use it across multiple courses.","is_new":true,"url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/content-bank/thumbnail.png","base_name":"content-bank","is_enabled":0},{"name":"Social Login","description":"Let users register & login through social networks.","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/social-login/thumbnail.svg","base_name":"social-login","is_enabled":0},{"name":"Content Drip","description":"Unlock lessons by schedule or when students meet a specific condition.","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/content-drip/thumbnail.png","base_name":"content-drip","is_enabled":0},{"name":"Tutor Multi Instructors","description":"Collaborate and add multiple instructors to a course.","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/tutor-multi-instructors/thumbnail.png","base_name":"tutor-multi-instructors","is_enabled":0},{"name":"Tutor Assignments","description":"Assess student learning with assignments.","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/tutor-assignments/thumbnail.png","base_name":"tutor-assignments","is_enabled":0},{"name":"Tutor Course Preview","description":"Offer free previews of specific lessons before enrollment.","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/tutor-course-preview/thumbnail.png","base_name":"tutor-course-preview","is_enabled":0},{"name":"Tutor Course Attachments","description":"Add unlimited attachments/ private files to any Tutor course","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/tutor-course-attachments/thumbnail.png","base_name":"tutor-course-attachments","is_enabled":0},{"name":"Tutor Google Meet Integration","description":"Host live classes with Google Meet, directly from your lesson page.","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/google-meet/thumbnail.png","base_name":"google-meet","is_enabled":0},{"name":"Tutor Report","description":"Check your course performance through Tutor Report stats.","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/tutor-report/thumbnail.png","base_name":"tutor-report","is_enabled":0},{"name":"Email","description":"Send automated and customized emails for various Tutor events.","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/tutor-email/thumbnail.png","base_name":"tutor-email","is_enabled":0},{"name":"Calendar","description":"Enable to let students view all your course events in one place.","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/calendar/thumbnail.png","base_name":"calendar","is_enabled":0},{"name":"Notifications","description":"Keep students and instructors notified of course events on their dashboard.","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/tutor-notifications/thumbnail.png","base_name":"tutor-notifications","is_enabled":0},{"name":"Google Classroom Integration","description":"Enable to integrate Tutor LMS with Google Classroom.","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/google-classroom/thumbnail.png","base_name":"google-classroom","is_enabled":0},{"name":"Tutor Zoom Integration","description":"Connect Tutor LMS with Zoom to host live online classes.","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/tutor-zoom/thumbnail.png","base_name":"tutor-zoom","is_enabled":0},{"name":"Quiz Export/Import","description":"Save time by exporting/importing quiz data with easy options.","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/quiz-import-export/thumbnail.png","base_name":"quiz-import-export","is_enabled":0},{"name":"Enrollment","description":"Enable to manually enroll students in your courses.","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/enrollments/thumbnail.png","base_name":"enrollments","is_enabled":0},{"name":"Tutor Certificate","description":"Enable to award certificates upon course completion.","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/tutor-certificate/thumbnail.png","base_name":"tutor-certificate","is_enabled":0},{"name":"Gradebook","description":"Track student progress with a centralized gradebook.","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/gradebook/thumbnail.png","base_name":"gradebook","is_enabled":0},{"name":"Tutor Prerequisites","description":"Set course prerequisites to guide learning paths effectively.","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/tutor-prerequisites/thumbnail.png","base_name":"tutor-prerequisites","is_enabled":0},{"name":"BuddyPress","description":"Boost engagement with social features through BuddyPress for Tutor LMS.","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/buddypress/thumbnail.png","base_name":"buddypress","is_enabled":0},{"name":"WooCommerce Subscriptions","description":"Capture Residual Revenue with Recurring Payments.","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/wc-subscriptions/thumbnail.png","base_name":"wc-subscriptions","is_enabled":0},{"name":"Paid Memberships Pro","description":"Boost revenue by selling course memberships.","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/pmpro/thumbnail.png","base_name":"pmpro","is_enabled":0},{"name":"Restrict Content Pro","description":"Enable to manage content access through Restrict Content Pro. ","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/restrict-content-pro/thumbnail.png","base_name":"restrict-content-pro","is_enabled":0},{"name":"Weglot","description":"Translate & manage multilingual courses for global reach.","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/tutor-weglot/thumbnail.png","base_name":"tutor-weglot","is_enabled":0},{"name":"WPML","description":"Create multilingual courses, lessons, dashboard and more.","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/tutor-wpml/thumbnail.png","base_name":"tutor-wpml","is_enabled":0},{"name":"H5P","description":"Integrate H5P to add interactivity and engagement to your courses.","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/h5p/thumbnail.png","base_name":"h5p","is_enabled":0}],"current_user":[],"content_change_event":"tutor_content_changed_event","is_tutor_course_edit":"","current_page":"","quiz_answer_display_time":"2000","is_ssl":"1","course_list_page_url":"https://july.finestwp.com/newwp/fortradex/wp-admin/admin.php?page=tutor","course_post_type":"courses","tutor_currency":{"symbol":"$","currency":false,"position":"left","thousand_separator":",","decimal_separator":".","no_of_decimal":"2"},"local":"en_US","settings":{"monetize_by":"free"},"max_upload_size":"33554432","monetize_by":"free","kids_icons_registry":[],"is_kids_mode":"","user_preferences":[],"is_legacy_learning_mode":"","course_slug":"courses","lesson_slug":"lesson","quiz_slug":"quizzes","is_tour_completed":"","legal_consent_display_places":["student_registration","login","checkout"]};
//# sourceURL=tutor-script-js-extra
</script>
<script id="tutor-script-js" src="https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/js/tutor.js?ver=4.0.7"></script>
<script id="jquery-ui-core-js-before">
jQuery.uiBackCompat = true;
//# sourceURL=jquery-ui-core-js-before
</script>
<script id="jquery-ui-core-js" src="https://july.finestwp.com/newwp/fortradex/wp-includes/js/jquery/ui/core.min.js?ver=1.14.2"></script>
<script id="jquery-ui-mouse-js" src="https://july.finestwp.com/newwp/fortradex/wp-includes/js/jquery/ui/mouse.min.js?ver=1.14.2"></script>
<script id="jquery-ui-sortable-js" src="https://july.finestwp.com/newwp/fortradex/wp-includes/js/jquery/ui/sortable.min.js?ver=1.14.2"></script>
<script id="jquery-touch-punch-js" src="https://july.finestwp.com/newwp/fortradex/wp-includes/js/jquery/jquery.ui.touch-punch.js?ver=0.2.2"></script>
<script id="tutor-social-share-js" src="https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/lib/SocialShare/SocialShare.min.js?ver=4.0.7"></script>
<script id="moment-js" src="https://july.finestwp.com/newwp/fortradex/wp-includes/js/dist/vendor/moment.min.js?ver=2.30.1"></script>
<script id="moment-js-after">
moment.updateLocale( 'en_US', {"months":["January","February","March","April","May","June","July","August","September","October","November","December"],"monthsShort":["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],"weekdays":["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],"weekdaysShort":["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],"week":{"dow":1},"longDateFormat":{"LT":"g:i a","LTS":null,"L":null,"LL":"F j, Y","LLL":"F j, Y g:i a","LLLL":null}} );
//# sourceURL=moment-js-after
</script>
<script id="wp-deprecated-js" src="https://july.finestwp.com/newwp/fortradex/wp-includes/js/dist/deprecated.min.js?ver=fe587bac92b7d0ef760e"></script>
<script id="wp-date-js" src="https://july.finestwp.com/newwp/fortradex/wp-includes/js/dist/date.min.js?ver=8173fc0fc12b7bb7eaf0"></script>
<script id="wp-date-js-after">
wp.date.setSettings( {"l10n":{"locale":"en_US","months":["January","February","March","April","May","June","July","August","September","October","November","December"],"monthsShort":["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],"weekdays":["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],"weekdaysShort":["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],"meridiem":{"am":"am","pm":"pm","AM":"AM","PM":"PM"},"relative":{"future":"%s from now","past":"%s ago","s":"a second","ss":"%d seconds","m":"a minute","mm":"%d minutes","h":"an hour","hh":"%d hours","d":"a day","dd":"%d days","M":"a month","MM":"%d months","y":"a year","yy":"%d years"},"startOfWeek":1},"formats":{"time":"g:i a","date":"F j, Y","datetime":"F j, Y g:i a","datetimeAbbreviated":"M j, Y g:i a"},"timezone":{"offset":0,"offsetFormatted":"0","string":"","abbr":""}} );
//# sourceURL=wp-date-js-after
</script>
<script id="tutor-frontend-js-extra">
var _tutorobject = {"ajaxurl":"https://july.finestwp.com/newwp/fortradex/wp-admin/admin-ajax.php","home_url":"https://july.finestwp.com/newwp/fortradex","site_url":"https://july.finestwp.com/newwp/fortradex","site_title":"Fortradex","base_path":"/newwp/fortradex/","tutor_url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/","tutor_pro_url":null,"nonce_key":"_tutor_nonce","_tutor_nonce":"91e585bd72","loading_icon_url":"https://july.finestwp.com/newwp/fortradex/wp-admin/images/wpspin_light.gif","placeholder_img_src":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/placeholder.svg","enable_lesson_classic_editor":"","tutor_frontend_dashboard_url":"https://july.finestwp.com/newwp/fortradex/dashboard/","is_dashboard_page":"","wp_date_format":"MMMM d, yyyy","start_of_week":"1","is_admin":"","is_admin_bar_showing":"","addons_data":[{"name":"Course Bundle","description":"Group multiple courses to sell together.","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/course-bundle/thumbnail.svg","base_name":"course-bundle","is_enabled":0},{"name":"Subscription","description":"Manage subscription","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/subscription/thumbnail.png","base_name":"subscription","is_enabled":0},{"name":"Content Bank","description":"Create content once and use it across multiple courses.","is_new":true,"url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/content-bank/thumbnail.png","base_name":"content-bank","is_enabled":0},{"name":"Social Login","description":"Let users register & login through social networks.","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/social-login/thumbnail.svg","base_name":"social-login","is_enabled":0},{"name":"Content Drip","description":"Unlock lessons by schedule or when students meet a specific condition.","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/content-drip/thumbnail.png","base_name":"content-drip","is_enabled":0},{"name":"Tutor Multi Instructors","description":"Collaborate and add multiple instructors to a course.","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/tutor-multi-instructors/thumbnail.png","base_name":"tutor-multi-instructors","is_enabled":0},{"name":"Tutor Assignments","description":"Assess student learning with assignments.","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/tutor-assignments/thumbnail.png","base_name":"tutor-assignments","is_enabled":0},{"name":"Tutor Course Preview","description":"Offer free previews of specific lessons before enrollment.","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/tutor-course-preview/thumbnail.png","base_name":"tutor-course-preview","is_enabled":0},{"name":"Tutor Course Attachments","description":"Add unlimited attachments/ private files to any Tutor course","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/tutor-course-attachments/thumbnail.png","base_name":"tutor-course-attachments","is_enabled":0},{"name":"Tutor Google Meet Integration","description":"Host live classes with Google Meet, directly from your lesson page.","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/google-meet/thumbnail.png","base_name":"google-meet","is_enabled":0},{"name":"Tutor Report","description":"Check your course performance through Tutor Report stats.","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/tutor-report/thumbnail.png","base_name":"tutor-report","is_enabled":0},{"name":"Email","description":"Send automated and customized emails for various Tutor events.","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/tutor-email/thumbnail.png","base_name":"tutor-email","is_enabled":0},{"name":"Calendar","description":"Enable to let students view all your course events in one place.","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/calendar/thumbnail.png","base_name":"calendar","is_enabled":0},{"name":"Notifications","description":"Keep students and instructors notified of course events on their dashboard.","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/tutor-notifications/thumbnail.png","base_name":"tutor-notifications","is_enabled":0},{"name":"Google Classroom Integration","description":"Enable to integrate Tutor LMS with Google Classroom.","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/google-classroom/thumbnail.png","base_name":"google-classroom","is_enabled":0},{"name":"Tutor Zoom Integration","description":"Connect Tutor LMS with Zoom to host live online classes.","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/tutor-zoom/thumbnail.png","base_name":"tutor-zoom","is_enabled":0},{"name":"Quiz Export/Import","description":"Save time by exporting/importing quiz data with easy options.","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/quiz-import-export/thumbnail.png","base_name":"quiz-import-export","is_enabled":0},{"name":"Enrollment","description":"Enable to manually enroll students in your courses.","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/enrollments/thumbnail.png","base_name":"enrollments","is_enabled":0},{"name":"Tutor Certificate","description":"Enable to award certificates upon course completion.","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/tutor-certificate/thumbnail.png","base_name":"tutor-certificate","is_enabled":0},{"name":"Gradebook","description":"Track student progress with a centralized gradebook.","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/gradebook/thumbnail.png","base_name":"gradebook","is_enabled":0},{"name":"Tutor Prerequisites","description":"Set course prerequisites to guide learning paths effectively.","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/tutor-prerequisites/thumbnail.png","base_name":"tutor-prerequisites","is_enabled":0},{"name":"BuddyPress","description":"Boost engagement with social features through BuddyPress for Tutor LMS.","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/buddypress/thumbnail.png","base_name":"buddypress","is_enabled":0},{"name":"WooCommerce Subscriptions","description":"Capture Residual Revenue with Recurring Payments.","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/wc-subscriptions/thumbnail.png","base_name":"wc-subscriptions","is_enabled":0},{"name":"Paid Memberships Pro","description":"Boost revenue by selling course memberships.","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/pmpro/thumbnail.png","base_name":"pmpro","is_enabled":0},{"name":"Restrict Content Pro","description":"Enable to manage content access through Restrict Content Pro. ","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/restrict-content-pro/thumbnail.png","base_name":"restrict-content-pro","is_enabled":0},{"name":"Weglot","description":"Translate & manage multilingual courses for global reach.","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/tutor-weglot/thumbnail.png","base_name":"tutor-weglot","is_enabled":0},{"name":"WPML","description":"Create multilingual courses, lessons, dashboard and more.","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/tutor-wpml/thumbnail.png","base_name":"tutor-wpml","is_enabled":0},{"name":"H5P","description":"Integrate H5P to add interactivity and engagement to your courses.","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/h5p/thumbnail.png","base_name":"h5p","is_enabled":0}],"current_user":[],"content_change_event":"tutor_content_changed_event","is_tutor_course_edit":"","current_page":"","quiz_answer_display_time":"2000","is_ssl":"1","course_list_page_url":"https://july.finestwp.com/newwp/fortradex/wp-admin/admin.php?page=tutor","course_post_type":"courses","tutor_currency":{"symbol":"$","currency":false,"position":"left","thousand_separator":",","decimal_separator":".","no_of_decimal":"2"},"local":"en_US","settings":{"monetize_by":"free"},"max_upload_size":"33554432","monetize_by":"free","kids_icons_registry":[],"is_kids_mode":"","user_preferences":[],"is_legacy_learning_mode":"","course_slug":"courses","lesson_slug":"lesson","quiz_slug":"quizzes","is_tour_completed":"","legal_consent_display_places":["student_registration","login","checkout"]};
//# sourceURL=tutor-frontend-js-extra
</script>
<script id="tutor-frontend-js" src="https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/js/tutor-front.js?ver=4.0.7"></script>
<script id="bootstrap-js" src="https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/js/bootstrap.min.js?ver=2.1.2"></script>
<script id="fortradex-owl-js" src="https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/js/owl.js?ver=2.1.2"></script>
<script id="wow-js" src="https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/js/wow.js?ver=2.1.2"></script>
<script id="jquery-fancybox-js" src="https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/js/jquery.fancybox.js?ver=2.1.2"></script>
<script id="appear-js" src="https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/js/appear.js?ver=2.1.2"></script>
<script id="isotope-js" src="https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/js/isotope.js?ver=2.1.2"></script>
<script id="parallax-scroll-js" src="https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/js/parallax-scroll.js?ver=2.1.2"></script>
<script id="jquery-nice-select-js" src="https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/js/jquery.nice-select.min.js?ver=2.1.2"></script>
<script id="scrolltop-js" src="https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/js/scrolltop.min.js?ver=2.1.2"></script>
<script id="jquery-ui-js" src="https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/js/jquery-ui.js?ver=2.1.2"></script>
<script id="lenis-js" src="https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/js/lenis.min.js?ver=2.1.2"></script>
<script id="odometer-js" src="https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/js/odometer.js?ver=2.1.2"></script>
<script id="jquery-lettering-js" src="https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/js/jquery.lettering.min.js?ver=2.1.2"></script>
<script id="circletype-js" src="https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/js/jquery.circleType.js?ver=2.1.2"></script>
<script id="fortradex-main-script-js" src="https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/js/script.js?ver=7.1"></script>
<script async data-wp-strategy="async" fetchpriority="low" id="comment-reply-js" src="https://july.finestwp.com/newwp/fortradex/wp-includes/js/comment-reply.min.js?ver=7.1"></script>
<script id="sourcebuster-js-js" src="https://july.finestwp.com/newwp/fortradex/wp-content/plugins/woocommerce/assets/js/sourcebuster/sourcebuster.min.js?ver=11.0.1"></script>
<script id="wc-order-attribution-js-extra">
var wc_order_attribution = {"params":{"lifetime":1.0e-5,"session":30,"base64":false,"ajaxurl":"https://july.finestwp.com/newwp/fortradex/wp-admin/admin-ajax.php","prefix":"wc_order_attribution_","allowTracking":true},"fields":{"source_type":"current.typ","referrer":"current_add.rf","utm_campaign":"current.cmp","utm_source":"current.src","utm_medium":"current.mdm","utm_content":"current.cnt","utm_id":"current.id","utm_term":"current.trm","utm_source_platform":"current.plt","utm_creative_format":"current.fmt","utm_marketing_tactic":"current.tct","session_entry":"current_add.ep","session_start_time":"current_add.fd","session_pages":"session.pgs","session_count":"udata.vst","user_agent":"udata.uag"}};
//# sourceURL=wc-order-attribution-js-extra
</script>
<script id="wc-order-attribution-js" src="https://july.finestwp.com/newwp/fortradex/wp-content/plugins/woocommerce/assets/js/frontend/order-attribution.min.js?ver=11.0.1"></script>
<script id="elementor-webpack-runtime-js" src="https://july.finestwp.com/newwp/fortradex/wp-content/plugins/elementor/assets/js/webpack.runtime.min.js?ver=4.2.4"></script>
<script id="elementor-frontend-modules-js" src="https://july.finestwp.com/newwp/fortradex/wp-content/plugins/elementor/assets/js/frontend-modules.min.js?ver=4.2.4"></script>
<script id="elementor-frontend-js-before">
var elementorFrontendConfig = {"environmentMode":{"edit":false,"wpPreview":false,"isScriptDebug":false},"i18n":{"shareOnFacebook":"Share on Facebook","shareOnX":"Share on X","pinIt":"Pin it","download":"Download","downloadImage":"Download image","fullscreen":"Fullscreen","zoom":"Zoom","share":"Share","playVideo":"Play Video","previous":"Previous","next":"Next","close":"Close","a11yCarouselPrevSlideMessage":"Previous slide","a11yCarouselNextSlideMessage":"Next slide","a11yCarouselFirstSlideMessage":"This is the first slide","a11yCarouselLastSlideMessage":"This is the last slide","a11yCarouselPaginationBulletMessage":"Go to slide"},"is_rtl":false,"breakpoints":{"xs":0,"sm":480,"md":768,"lg":1025,"xl":1440,"xxl":1600},"responsive":{"breakpoints":{"mobile":{"label":"Mobile Portrait","value":767,"default_value":767,"direction":"max","is_enabled":true},"mobile_extra":{"label":"Mobile Landscape","value":880,"default_value":880,"direction":"max","is_enabled":false},"tablet":{"label":"Tablet Portrait","value":1024,"default_value":1024,"direction":"max","is_enabled":true},"tablet_extra":{"label":"Tablet Landscape","value":1200,"default_value":1200,"direction":"max","is_enabled":true},"laptop":{"label":"Laptop","value":1366,"default_value":1366,"direction":"max","is_enabled":false},"widescreen":{"label":"Widescreen","value":2400,"default_value":2400,"direction":"min","is_enabled":false}},"hasCustomBreakpoints":true},"version":"4.2.4","is_static":false,"experimentalFeatures":{"e_font_icon_svg":true,"additional_custom_breakpoints":true,"container":true,"e_panel_promotions":true,"nested-elements":true,"global_classes_should_enforce_capabilities":true,"e_variables":true,"e_opt_in_v4_page":true,"e_components":true,"e_interactions":true,"e_widget_creation":true,"import-export-customization":true},"urls":{"assets":"https:\/\/july.finestwp.com\/newwp\/fortradex\/wp-content\/plugins\/elementor\/assets\/","ajaxurl":"https:\/\/july.finestwp.com\/newwp\/fortradex\/wp-admin\/admin-ajax.php","uploadUrl":"https:\/\/july.finestwp.com\/newwp\/fortradex\/wp-content\/uploads"},"nonces":{"floatingButtonsClickTracking":"b63dd1a65b","atomicFormsSendForm":"b8177b6b88"},"swiperClass":"swiper","settings":{"page":[],"editorPreferences":[]},"kit":{"active_breakpoints":["viewport_mobile","viewport_tablet","viewport_tablet_extra"],"global_image_lightbox":"yes","lightbox_enable_counter":"yes","lightbox_enable_fullscreen":"yes","lightbox_enable_zoom":"yes","lightbox_enable_share":"yes","lightbox_title_src":"title","lightbox_description_src":"description"},"post":{"id":15,"title":"Fortradex%20%E2%80%93%20Fortradex%20WordPress%20Theme","excerpt":"","featuredImage":false}};
//# sourceURL=elementor-frontend-js-before
</script>
<script id="elementor-frontend-js" src="https://july.finestwp.com/newwp/fortradex/wp-content/plugins/elementor/assets/js/frontend.min.js?ver=4.2.4"></script>
<script id="banner-slider-js" src="https://july.finestwp.com/newwp/fortradex/wp-content/plugins/fortradex-plugin/assets/js/banner-carousels.js?ver=1.0.0"></script>
<script id="curved-circle-script-js" src="https://july.finestwp.com/newwp/fortradex/wp-content/plugins/fortradex-plugin/assets/js/curved-text.js?ver=1.0.0"></script>
<script id="counter-script-js" src="https://july.finestwp.com/newwp/fortradex/wp-content/plugins/fortradex-plugin/assets/js/counter.js?ver=1.0.0"></script>
<script id="wp-emoji-settings" type="application/json">
{"baseUrl":"https://s.w.org/images/core/emoji/17.0.2/72x72/","ext":".png","svgUrl":"https://s.w.org/images/core/emoji/17.0.2/svg/","svgExt":".svg","source":{"concatemoji":"https://july.finestwp.com/newwp/fortradex/wp-includes/js/wp-emoji-release.min.js?ver=7.1"}}
</script>
<script type="module">
/*! This file is auto-generated */
var e="script#wp-emoji-settings",t=document.querySelector(e);if(!(t instanceof HTMLScriptElement))throw new Error("Element missing: "+e);const r=JSON.parse(t.text),s=(window._wpemojiSettings=r,"wpEmojiSettingsSupports"),o=["flag","emoji"];function i(e){try{var t={supportTests:e,timestamp:(new Date).valueOf()};sessionStorage.setItem(s,JSON.stringify(t))}catch(e){}}function c(e,t,n){e.clearRect(0,0,e.canvas.width,e.canvas.height),e.fillText(t,0,0);t=new Uint32Array(e.getImageData(0,0,e.canvas.width,e.canvas.height).data);e.clearRect(0,0,e.canvas.width,e.canvas.height),e.fillText(n,0,0);const r=new Uint32Array(e.getImageData(0,0,e.canvas.width,e.canvas.height).data);return t.every((e,t)=>e===r[t])}function p(e,t){e.clearRect(0,0,e.canvas.width,e.canvas.height),e.fillText(t,0,0);var n=e.getImageData(16,16,1,1);for(let e=0;e<n.data.length;e++)if(0!==n.data[e])return!1;return!0}function u(e,t,n,r){switch(t){case"flag":return n(e,"\ud83c\udff3\ufe0f\u200d\u26a7\ufe0f","\ud83c\udff3\ufe0f\u200b\u26a7\ufe0f")?!1:!n(e,"\ud83c\udde8\ud83c\uddf6","\ud83c\udde8\u200b\ud83c\uddf6")&&!n(e,"\ud83c\udff4\udb40\udc67\udb40\udc62\udb40\udc65\udb40\udc6e\udb40\udc67\udb40\udc7f","\ud83c\udff4\u200b\udb40\udc67\u200b\udb40\udc62\u200b\udb40\udc65\u200b\udb40\udc6e\u200b\udb40\udc67\u200b\udb40\udc7f");case"emoji":return!r(e,"\ud83e\u1fac8")}return!1}function f(e,t,n,r){let a;const s=(a="undefined"!=typeof WorkerGlobalScope&&self instanceof WorkerGlobalScope?new OffscreenCanvas(300,150):document.createElement("canvas")).getContext("2d",{willReadFrequently:!0}),o=(s.textBaseline="top",s.font="600 32px Arial",{});return e.forEach(e=>{o[e]=t(s,e,n,r)}),o}function a(e){var t=document.createElement("script");t.src=e,t.defer=!0,document.head.appendChild(t)}r.supports={everything:!0,everythingExceptFlag:!0},new Promise(t=>{let n=function(){try{var e=JSON.parse(sessionStorage.getItem(s));if("object"==typeof e&&"number"==typeof e.timestamp&&(new Date).valueOf()<e.timestamp+604800&&"object"==typeof e.supportTests)return e.supportTests}catch(e){}return null}();if(!n){if("undefined"!=typeof Worker&&"undefined"!=typeof OffscreenCanvas&&"undefined"!=typeof URL&&URL.createObjectURL&&"undefined"!=typeof Blob)try{var e="postMessage("+f.toString()+"("+[JSON.stringify(o),u.toString(),c.toString(),p.toString()].join(",")+"));",r=new Blob([e],{type:"text/javascript"});const a=new Worker(URL.createObjectURL(r),{name:"wpTestEmojiSupports"});return void(a.onmessage=e=>{i(n=e.data),a.terminate(),t(n)})}catch(e){}i(n=f(o,u,c,p))}t(n)}).then(e=>{for(const n in e)r.supports[n]=e[n],r.supports.everything=r.supports.everything&&r.supports[n],"flag"!==n&&(r.supports.everythingExceptFlag=r.supports.everythingExceptFlag&&r.supports[n]);var t;r.supports.everythingExceptFlag=r.supports.everythingExceptFlag&&!r.supports.flag,r.supports.everything||((t=r.source||{}).concatemoji?a(t.concatemoji):t.wpemoji&&t.twemoji&&(a(t.twemoji),a(t.wpemoji)))});
//# sourceURL=https://july.finestwp.com/newwp/fortradex/wp-includes/js/wp-emoji-loader.min.js
</script>
</body>
</html>

---

this is the new flow or dsiplay style in public site for the news & analysis page:

![alt text](image-10.png)
https://july.finestwp.com/newwp/fortradex/blog-grid/

<!DOCTYPE html>
<html lang="en-US" class="no-js no-svg">
<head>
	<meta charset="UTF-8">
	    		<link rel="shortcut icon" href="https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/images/favicon.png" type="image/x-icon">
		<link rel="icon" href="https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/images/favicon.png" type="image/x-icon">
	    	<!-- responsive meta -->
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<!-- For IE -->
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>Blog Grid &#8211; Fortradex</title>
<meta name='robots' content='max-image-preview:large' />
<link rel='dns-prefetch' href='//fonts.googleapis.com' />
<link rel="alternate" type="application/rss+xml" title="Fortradex &raquo; Feed" href="https://july.finestwp.com/newwp/fortradex/feed/" />
<link rel="alternate" type="application/rss+xml" title="Fortradex &raquo; Comments Feed" href="https://july.finestwp.com/newwp/fortradex/comments/feed/" />
<link rel="alternate" title="oEmbed (JSON)" type="application/json+oembed" href="https://july.finestwp.com/newwp/fortradex/wp-json/oembed/1.0/embed?url=https%3A%2F%2Fjuly.finestwp.com%2Fnewwp%2Ffortradex%2Fblog-grid%2F" />
<link rel="alternate" title="oEmbed (XML)" type="text/xml+oembed" href="https://july.finestwp.com/newwp/fortradex/wp-json/oembed/1.0/embed?url=https%3A%2F%2Fjuly.finestwp.com%2Fnewwp%2Ffortradex%2Fblog-grid%2F&#038;format=xml" />
<style id="wp-img-auto-sizes-contain-inline-css">
img:is([sizes=auto i],[sizes^="auto," i]){contain-intrinsic-size:3000px 1500px}
/*# sourceURL=wp-img-auto-sizes-contain-inline-css */
</style>
<style id="wp-emoji-styles-inline-css">

    img.wp-smiley, img.emoji {
    	display: inline !important;
    	border: none !important;
    	box-shadow: none !important;
    	height: 1em !important;
    	width: 1em !important;
    	margin: 0 0.07em !important;
    	vertical-align: -0.1em !important;
    	background: none !important;
    	padding: 0 !important;
    }

/*# sourceURL=wp-emoji-styles-inline-css */
</style>
<style id="classic-theme-styles-inline-css">
/*! This file is auto-generated */
.wp-block-button__link{color:#fff;background-color:#32373c;border-radius:9999px;box-shadow:none;text-decoration:none;padding:calc(.667em + 2px) calc(1.333em + 2px);font-size:1.125em}.wp-block-file__button{background:#32373c;color:#fff;text-decoration:none}
/*# sourceURL=/wp-includes/css/classic-themes.min.css */
</style>
<style id="global-styles-inline-css">
:root{--wp--preset--aspect-ratio--square: 1;--wp--preset--aspect-ratio--4-3: 4/3;--wp--preset--aspect-ratio--3-4: 3/4;--wp--preset--aspect-ratio--3-2: 3/2;--wp--preset--aspect-ratio--2-3: 2/3;--wp--preset--aspect-ratio--16-9: 16/9;--wp--preset--aspect-ratio--9-16: 9/16;--wp--preset--color--black: #000000;--wp--preset--color--cyan-bluish-gray: #abb8c3;--wp--preset--color--white: #ffffff;--wp--preset--color--pale-pink: #f78da7;--wp--preset--color--vivid-red: #cf2e2e;--wp--preset--color--luminous-vivid-orange: #ff6900;--wp--preset--color--luminous-vivid-amber: #fcb900;--wp--preset--color--light-green-cyan: #7bdcb5;--wp--preset--color--vivid-green-cyan: #00d084;--wp--preset--color--pale-cyan-blue: #8ed1fc;--wp--preset--color--vivid-cyan-blue: #0693e3;--wp--preset--color--vivid-purple: #9b51e0;--wp--preset--color--strong-yellow: #f7bd00;--wp--preset--color--strong-white: #fff;--wp--preset--color--light-black: #242424;--wp--preset--color--very-light-gray: #797979;--wp--preset--color--very-dark-black: #000000;--wp--preset--gradient--vivid-cyan-blue-to-vivid-purple: linear-gradient(135deg,rgb(6,147,227) 0%,rgb(155,81,224) 100%);--wp--preset--gradient--light-green-cyan-to-vivid-green-cyan: linear-gradient(135deg,rgb(122,220,180) 0%,rgb(0,208,130) 100%);--wp--preset--gradient--luminous-vivid-amber-to-luminous-vivid-orange: linear-gradient(135deg,rgb(252,185,0) 0%,rgb(255,105,0) 100%);--wp--preset--gradient--luminous-vivid-orange-to-vivid-red: linear-gradient(135deg,rgb(255,105,0) 0%,rgb(207,46,46) 100%);--wp--preset--gradient--very-light-gray-to-cyan-bluish-gray: linear-gradient(135deg,rgb(238,238,238) 0%,rgb(169,184,195) 100%);--wp--preset--gradient--cool-to-warm-spectrum: linear-gradient(135deg,rgb(74,234,220) 0%,rgb(151,120,209) 20%,rgb(207,42,186) 40%,rgb(238,44,130) 60%,rgb(251,105,98) 80%,rgb(254,248,76) 100%);--wp--preset--gradient--blush-light-purple: linear-gradient(135deg,rgb(255,206,236) 0%,rgb(152,150,240) 100%);--wp--preset--gradient--blush-bordeaux: linear-gradient(135deg,rgb(254,205,165) 0%,rgb(254,45,45) 50%,rgb(107,0,62) 100%);--wp--preset--gradient--luminous-dusk: linear-gradient(135deg,rgb(255,203,112) 0%,rgb(199,81,192) 50%,rgb(65,88,208) 100%);--wp--preset--gradient--pale-ocean: linear-gradient(135deg,rgb(255,245,203) 0%,rgb(182,227,212) 50%,rgb(51,167,181) 100%);--wp--preset--gradient--electric-grass: linear-gradient(135deg,rgb(202,248,128) 0%,rgb(113,206,126) 100%);--wp--preset--gradient--midnight: linear-gradient(135deg,rgb(2,3,129) 0%,rgb(40,116,252) 100%);--wp--preset--font-size--small: 10px;--wp--preset--font-size--medium: 20px;--wp--preset--font-size--large: 24px;--wp--preset--font-size--x-large: 42px;--wp--preset--font-size--normal: 15px;--wp--preset--font-size--huge: 36px;--wp--preset--spacing--20: 0.44rem;--wp--preset--spacing--30: 0.67rem;--wp--preset--spacing--40: 1rem;--wp--preset--spacing--50: 1.5rem;--wp--preset--spacing--60: 2.25rem;--wp--preset--spacing--70: 3.38rem;--wp--preset--spacing--80: 5.06rem;--wp--preset--shadow--natural: 6px 6px 9px rgba(0, 0, 0, 0.2);--wp--preset--shadow--deep: 12px 12px 50px rgba(0, 0, 0, 0.4);--wp--preset--shadow--sharp: 6px 6px 0px rgba(0, 0, 0, 0.2);--wp--preset--shadow--outlined: 6px 6px 0px -3px rgb(255, 255, 255), 6px 6px rgb(0, 0, 0);--wp--preset--shadow--crisp: 6px 6px 0px rgb(0, 0, 0);}.wp-block-button{--wp--preset--dimension--25: 25%;--wp--preset--dimension--50: 50%;--wp--preset--dimension--75: 75%;--wp--preset--dimension--100: 100%;}:where(body) { margin: 0; }:where(.is-layout-flex){gap: 0.5em;}:where(.is-layout-grid){gap: 0.5em;}body .is-layout-flex{display: flex;}.is-layout-flex{flex-wrap: wrap;align-items: center;}.is-layout-flex > :is(*, div){margin: 0;}body .is-layout-grid{display: grid;}.is-layout-grid > :is(*, div){margin: 0;}body{padding-top: 0px;padding-right: 0px;padding-bottom: 0px;padding-left: 0px;}:root :where(.wp-element-button, .wp-block-button__link){background-color: #32373c;border-width: 0;color: #fff;font-family: inherit;font-size: inherit;font-style: inherit;font-weight: inherit;letter-spacing: inherit;line-height: inherit;padding-top: calc(0.667em + 2px);padding-right: calc(1.333em + 2px);padding-bottom: calc(0.667em + 2px);padding-left: calc(1.333em + 2px);text-decoration: none;text-transform: inherit;}.has-black-color{color: var(--wp--preset--color--black) !important;}.has-cyan-bluish-gray-color{color: var(--wp--preset--color--cyan-bluish-gray) !important;}.has-white-color{color: var(--wp--preset--color--white) !important;}.has-pale-pink-color{color: var(--wp--preset--color--pale-pink) !important;}.has-vivid-red-color{color: var(--wp--preset--color--vivid-red) !important;}.has-luminous-vivid-orange-color{color: var(--wp--preset--color--luminous-vivid-orange) !important;}.has-luminous-vivid-amber-color{color: var(--wp--preset--color--luminous-vivid-amber) !important;}.has-light-green-cyan-color{color: var(--wp--preset--color--light-green-cyan) !important;}.has-vivid-green-cyan-color{color: var(--wp--preset--color--vivid-green-cyan) !important;}.has-pale-cyan-blue-color{color: var(--wp--preset--color--pale-cyan-blue) !important;}.has-vivid-cyan-blue-color{color: var(--wp--preset--color--vivid-cyan-blue) !important;}.has-vivid-purple-color{color: var(--wp--preset--color--vivid-purple) !important;}.has-strong-yellow-color{color: var(--wp--preset--color--strong-yellow) !important;}.has-strong-white-color{color: var(--wp--preset--color--strong-white) !important;}.has-light-black-color{color: var(--wp--preset--color--light-black) !important;}.has-very-light-gray-color{color: var(--wp--preset--color--very-light-gray) !important;}.has-very-dark-black-color{color: var(--wp--preset--color--very-dark-black) !important;}.has-black-background-color{background-color: var(--wp--preset--color--black) !important;}.has-cyan-bluish-gray-background-color{background-color: var(--wp--preset--color--cyan-bluish-gray) !important;}.has-white-background-color{background-color: var(--wp--preset--color--white) !important;}.has-pale-pink-background-color{background-color: var(--wp--preset--color--pale-pink) !important;}.has-vivid-red-background-color{background-color: var(--wp--preset--color--vivid-red) !important;}.has-luminous-vivid-orange-background-color{background-color: var(--wp--preset--color--luminous-vivid-orange) !important;}.has-luminous-vivid-amber-background-color{background-color: var(--wp--preset--color--luminous-vivid-amber) !important;}.has-light-green-cyan-background-color{background-color: var(--wp--preset--color--light-green-cyan) !important;}.has-vivid-green-cyan-background-color{background-color: var(--wp--preset--color--vivid-green-cyan) !important;}.has-pale-cyan-blue-background-color{background-color: var(--wp--preset--color--pale-cyan-blue) !important;}.has-vivid-cyan-blue-background-color{background-color: var(--wp--preset--color--vivid-cyan-blue) !important;}.has-vivid-purple-background-color{background-color: var(--wp--preset--color--vivid-purple) !important;}.has-strong-yellow-background-color{background-color: var(--wp--preset--color--strong-yellow) !important;}.has-strong-white-background-color{background-color: var(--wp--preset--color--strong-white) !important;}.has-light-black-background-color{background-color: var(--wp--preset--color--light-black) !important;}.has-very-light-gray-background-color{background-color: var(--wp--preset--color--very-light-gray) !important;}.has-very-dark-black-background-color{background-color: var(--wp--preset--color--very-dark-black) !important;}.has-black-border-color{border-color: var(--wp--preset--color--black) !important;}.has-cyan-bluish-gray-border-color{border-color: var(--wp--preset--color--cyan-bluish-gray) !important;}.has-white-border-color{border-color: var(--wp--preset--color--white) !important;}.has-pale-pink-border-color{border-color: var(--wp--preset--color--pale-pink) !important;}.has-vivid-red-border-color{border-color: var(--wp--preset--color--vivid-red) !important;}.has-luminous-vivid-orange-border-color{border-color: var(--wp--preset--color--luminous-vivid-orange) !important;}.has-luminous-vivid-amber-border-color{border-color: var(--wp--preset--color--luminous-vivid-amber) !important;}.has-light-green-cyan-border-color{border-color: var(--wp--preset--color--light-green-cyan) !important;}.has-vivid-green-cyan-border-color{border-color: var(--wp--preset--color--vivid-green-cyan) !important;}.has-pale-cyan-blue-border-color{border-color: var(--wp--preset--color--pale-cyan-blue) !important;}.has-vivid-cyan-blue-border-color{border-color: var(--wp--preset--color--vivid-cyan-blue) !important;}.has-vivid-purple-border-color{border-color: var(--wp--preset--color--vivid-purple) !important;}.has-strong-yellow-border-color{border-color: var(--wp--preset--color--strong-yellow) !important;}.has-strong-white-border-color{border-color: var(--wp--preset--color--strong-white) !important;}.has-light-black-border-color{border-color: var(--wp--preset--color--light-black) !important;}.has-very-light-gray-border-color{border-color: var(--wp--preset--color--very-light-gray) !important;}.has-very-dark-black-border-color{border-color: var(--wp--preset--color--very-dark-black) !important;}.has-vivid-cyan-blue-to-vivid-purple-gradient-background{background: var(--wp--preset--gradient--vivid-cyan-blue-to-vivid-purple) !important;}.has-light-green-cyan-to-vivid-green-cyan-gradient-background{background: var(--wp--preset--gradient--light-green-cyan-to-vivid-green-cyan) !important;}.has-luminous-vivid-amber-to-luminous-vivid-orange-gradient-background{background: var(--wp--preset--gradient--luminous-vivid-amber-to-luminous-vivid-orange) !important;}.has-luminous-vivid-orange-to-vivid-red-gradient-background{background: var(--wp--preset--gradient--luminous-vivid-orange-to-vivid-red) !important;}.has-very-light-gray-to-cyan-bluish-gray-gradient-background{background: var(--wp--preset--gradient--very-light-gray-to-cyan-bluish-gray) !important;}.has-cool-to-warm-spectrum-gradient-background{background: var(--wp--preset--gradient--cool-to-warm-spectrum) !important;}.has-blush-light-purple-gradient-background{background: var(--wp--preset--gradient--blush-light-purple) !important;}.has-blush-bordeaux-gradient-background{background: var(--wp--preset--gradient--blush-bordeaux) !important;}.has-luminous-dusk-gradient-background{background: var(--wp--preset--gradient--luminous-dusk) !important;}.has-pale-ocean-gradient-background{background: var(--wp--preset--gradient--pale-ocean) !important;}.has-electric-grass-gradient-background{background: var(--wp--preset--gradient--electric-grass) !important;}.has-midnight-gradient-background{background: var(--wp--preset--gradient--midnight) !important;}.has-small-font-size{font-size: var(--wp--preset--font-size--small) !important;}.has-medium-font-size{font-size: var(--wp--preset--font-size--medium) !important;}.has-large-font-size{font-size: var(--wp--preset--font-size--large) !important;}.has-x-large-font-size{font-size: var(--wp--preset--font-size--x-large) !important;}.has-normal-font-size{font-size: var(--wp--preset--font-size--normal) !important;}.has-huge-font-size{font-size: var(--wp--preset--font-size--huge) !important;}
:root :where(.wp-block-icon svg){width: 24px;}
:where(.wp-block-gallery.is-layout-flex){gap: var( --wp--style--gallery-gap-default, var( --gallery-block--gutter-size, var( --wp--style--block-gap, 0.5em ) ) );}:where(.wp-block-gallery.is-layout-grid){gap: var( --wp--style--gallery-gap-default, var( --gallery-block--gutter-size, var( --wp--style--block-gap, 0.5em ) ) );}
:where(.wp-block-latest-posts.is-layout-flex){gap: 1.25em;}:where(.wp-block-latest-posts.is-layout-grid){gap: 1.25em;}
:where(.wp-block-post-template.is-layout-flex){gap: 1.25em;}:where(.wp-block-post-template.is-layout-grid){gap: 1.25em;}
:where(.wp-block-term-template.is-layout-flex){gap: 1.25em;}:where(.wp-block-term-template.is-layout-grid){gap: 1.25em;}
:where(.wp-block-columns.is-layout-flex){gap: 2em;}:where(.wp-block-columns.is-layout-grid){gap: 2em;}
:root :where(.wp-block-pullquote){font-size: 1.5em;line-height: 1.6;}
/*# sourceURL=global-styles-inline-css */
</style>
<link rel='stylesheet' id='contact-form-7-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/plugins/contact-form-7/includes/css/styles.css?ver=6.1.7' media='all' />
<link rel='stylesheet' id='tutor-icon-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/css/tutor-icon.min.css?ver=4.0.7' media='all' />
<link rel='stylesheet' id='tutor-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/css/tutor.min.css?ver=4.0.7' media='all' />
<link rel='stylesheet' id='tutor-frontend-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/css/tutor-front.min.css?ver=4.0.7' media='all' />
<style id="tutor-frontend-inline-css">
:root{--tutor-color-primary:#22823a;--tutor-color-primary-rgb:34, 130, 58;--tutor-color-primary-hover:#3bb961;--tutor-color-primary-hover-rgb:59, 185, 97;--tutor-body-color:#212327;--tutor-body-color-rgb:33, 35, 39;--tutor-border-color:#E3E5EB;--tutor-border-color-rgb:227, 229, 235;--tutor-color-gray:#CDCFD5;--tutor-color-gray-rgb:205, 207, 213;}
/*# sourceURL=tutor-frontend-inline-css */
</style>
<style id="woocommerce-inline-inline-css">
.woocommerce form .form-row .required { visibility: visible; }
/*# sourceURL=woocommerce-inline-inline-css */
</style>
<link rel='stylesheet' id='font-awesome-all-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/css/font-awesome-all.css?ver=7.1' media='all' />
<link rel='stylesheet' id='flaticon-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/css/flaticon.css?ver=7.1' media='all' />
<link rel='stylesheet' id='owl-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/css/owl.css?ver=7.1' media='all' />
<link rel='stylesheet' id='bootstrap-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/css/bootstrap.css?ver=7.1' media='all' />
<link rel='stylesheet' id='jquery-fancybox-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/css/jquery.fancybox.min.css?ver=7.1' media='all' />
<link rel='stylesheet' id='fancybox-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/css/animate.css?ver=7.1' media='all' />
<link rel='stylesheet' id='nice-select-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/css/nice-select.css?ver=7.1' media='all' />
<link rel='stylesheet' id='jquery-ui-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/css/jquery-ui.css?ver=7.1' media='all' />
<link rel='stylesheet' id='odometer-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/css/odometer.css?ver=7.1' media='all' />
<link rel='stylesheet' id='elpath-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/css/elpath.css?ver=7.1' media='all' />
<link rel='stylesheet' id='color-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/css/color.css?ver=7.1' media='all' />
<link rel='stylesheet' id='rtl-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/css/rtl.css?ver=7.1' media='all' />
<link rel='stylesheet' id='fortradex-header-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/css/module-css/header.css?ver=7.1' media='all' />
<link rel='stylesheet' id='fortradex-banner-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/css/module-css/banner.css?ver=7.1' media='all' />
<link rel='stylesheet' id='fortradex-cta-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/css/module-css/cta.css?ver=7.1' media='all' />
<link rel='stylesheet' id='fortradex-clients-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/css/module-css/clients.css?ver=7.1' media='all' />
<link rel='stylesheet' id='fortradex-account-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/css/module-css/account.css?ver=7.1' media='all' />
<link rel='stylesheet' id='fortradex-history-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/css/module-css/history.css?ver=7.1' media='all' />
<link rel='stylesheet' id='fortradex-about-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/css/module-css/about.css?ver=7.1' media='all' />
<link rel='stylesheet' id='fortradex-platform-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/css/module-css/platform.css?ver=7.1' media='all' />
<link rel='stylesheet' id='fortradex-funfact-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/css/module-css/funfact.css?ver=7.1' media='all' />
<link rel='stylesheet' id='fortradex-trading-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/css/module-css/trading.css?ver=7.1' media='all' />
<link rel='stylesheet' id='fortradex-process-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/css/module-css/process.css?ver=7.1' media='all' />
<link rel='stylesheet' id='fortradex-award-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/css/module-css/award.css?ver=7.1' media='all' />
<link rel='stylesheet' id='fortradex-apps-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/css/module-css/apps.css?ver=7.1' media='all' />
<link rel='stylesheet' id='fortradex-news-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/css/module-css/news.css?ver=7.1' media='all' />
<link rel='stylesheet' id='fortradex-experience-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/css/module-css/experience.css?ver=7.1' media='all' />
<link rel='stylesheet' id='fortradex-testimonial-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/css/module-css/testimonial.css?ver=7.1' media='all' />
<link rel='stylesheet' id='fortradex-subscribe-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/css/module-css/subscribe.css?ver=7.1' media='all' />
<link rel='stylesheet' id='fortradex-dark-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/css/dark.css?ver=7.1' media='all' />
<link rel='stylesheet' id='fortradex-page-title-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/css/module-css/page-title.css?ver=7.1' media='all' />
<link rel='stylesheet' id='fortradex-working-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/css/module-css/working.css?ver=7.1' media='all' />
<link rel='stylesheet' id='fortradex-team-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/css/module-css/team.css?ver=7.1' media='all' />
<link rel='stylesheet' id='fortradex-faq-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/css/module-css/faq.css?ver=7.1' media='all' />
<link rel='stylesheet' id='fortradex-error-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/css/module-css/error.css?ver=7.1' media='all' />
<link rel='stylesheet' id='fortradex-markets-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/css/module-css/markets.css?ver=7.1' media='all' />
<link rel='stylesheet' id='fortradex-team-details-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/css/module-css/team-details.css?ver=7.1' media='all' />
<link rel='stylesheet' id='fortradex-contact-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/css/module-css/contact.css?ver=7.1' media='all' />
<link rel='stylesheet' id='fortradex-blog-sidebar-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/css/module-css/blog-sidebar.css?ver=7.1' media='all' />
<link rel='stylesheet' id='fortradex-blog-details-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/css/module-css/blog-details.css?ver=7.1' media='all' />
<link rel='stylesheet' id='fortradex-pricing-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/css/module-css/pricing.css?ver=7.1' media='all' />
<link rel='stylesheet' id='fortradex-education-details-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/css/module-css/education-details.css?ver=7.1' media='all' />
<link rel='stylesheet' id='fortradex-footer-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/css/module-css/footer.css?ver=7.1' media='all' />
<link rel='stylesheet' id='fortradex-main-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/style.css?ver=7.1' media='all' />
<link rel='stylesheet' id='fortradex-main-style-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/css/style.css?ver=7.1' media='all' />
<link rel='stylesheet' id='fortradex-custom-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/css/custom.css?ver=7.1' media='all' />
<link rel='stylesheet' id='fortradex-responsive-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/css/responsive.css?ver=7.1' media='all' />
<link rel='stylesheet' id='fortradex-main-color-scheme-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/css/color.php?main_color=22823A&#038;second_color=131615&#038;ver=7.1' media='all' />
<link rel='stylesheet' id='fortradex-theme-fonts-css' href='https://fonts.googleapis.com/css?family=Ubuntu%3Aital%2Cwght%400%2C300%2C%2C400%2C500%2C700%2C300%2C400%2C500%2C700%26display%3Dswap%7CIBM+Plex+Sans%3Aital%2Cwght%400%2C100%2C200%2C300%2C400%2C500%2C600%2C700%26display%3Dswap&#038;subset=latin%2Clatin-ext' media='all' />
<link rel='stylesheet' id='elementor-frontend-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/uploads/elementor/css/custom-frontend.min.css?ver=1788275266' media='all' />
<link rel='stylesheet' id='elementor-post-10-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/uploads/elementor/css/post-10.css?ver=1788285808' media='all' />
<link rel='stylesheet' id='widget-heading-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/plugins/elementor/assets/css/widget-heading.min.css?ver=4.2.4' media='all' />
<link rel='stylesheet' id='elementor-post-1809-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/uploads/elementor/css/post-1809.css?ver=1788442069' media='all' />
<link rel='stylesheet' id='elementor-gf-local-roboto-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/uploads/elementor/google-fonts/css/roboto.css?ver=1742239231' media='all' />
<link rel='stylesheet' id='elementor-gf-local-robotoslab-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/uploads/elementor/google-fonts/css/robotoslab.css?ver=1742239240' media='all' />
<link rel='stylesheet' id='elementor-gf-local-ubuntu-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/uploads/elementor/google-fonts/css/ubuntu.css?ver=1742239248' media='all' />
<script id="jquery-core-js-extra">
var fortradex_data = {"ajaxurl":"https://july.finestwp.com/newwp/fortradex/wp-admin/admin-ajax.php","nonce":"d4781c51e6"};
//# sourceURL=jquery-core-js-extra
</script>
<script id="jquery-core-js" src="https://july.finestwp.com/newwp/fortradex/wp-includes/js/jquery/jquery.min.js?ver=3.7.1"></script>
<script id="jquery-migrate-js" src="https://july.finestwp.com/newwp/fortradex/wp-includes/js/jquery/jquery-migrate.min.js?ver=3.4.1"></script>
<script data-wp-strategy="defer" defer id="wc-jquery-blockui-js" src="https://july.finestwp.com/newwp/fortradex/wp-content/plugins/woocommerce/assets/js/jquery-blockui/jquery.blockUI.min.js?ver=2.7.0-wc.11.0.1"></script>
<script id="wc-add-to-cart-js-extra">
var wc_add_to_cart_params = {"ajax_url":"/newwp/fortradex/wp-admin/admin-ajax.php","wc_ajax_url":"/newwp/fortradex/?wc-ajax=%%endpoint%%","i18n_view_cart":"View cart","cart_url":"https://july.finestwp.com/newwp/fortradex/cart/","is_cart":"","cart_redirect_after_add":"no"};
//# sourceURL=wc-add-to-cart-js-extra
</script>
<script data-wp-strategy="defer" defer id="wc-add-to-cart-js" src="https://july.finestwp.com/newwp/fortradex/wp-content/plugins/woocommerce/assets/js/frontend/add-to-cart.min.js?ver=11.0.1"></script>
<script data-wp-strategy="defer" defer id="wc-js-cookie-js" src="https://july.finestwp.com/newwp/fortradex/wp-content/plugins/woocommerce/assets/js/js-cookie/js.cookie.min.js?ver=2.1.4-wc.11.0.1"></script>
<script id="woocommerce-js-extra">
var woocommerce_params = {"ajax_url":"/newwp/fortradex/wp-admin/admin-ajax.php","wc_ajax_url":"/newwp/fortradex/?wc-ajax=%%endpoint%%","i18n_password_show":"Show password","i18n_password_hide":"Hide password"};
//# sourceURL=woocommerce-js-extra
</script>
<script data-wp-strategy="defer" defer id="woocommerce-js" src="https://july.finestwp.com/newwp/fortradex/wp-content/plugins/woocommerce/assets/js/frontend/woocommerce.min.js?ver=11.0.1"></script>
<script id="customStockdioJs-js" src="https://july.finestwp.com/newwp/fortradex/wp-content/plugins/stock-market-ticker/assets/stockdio-wp.js?ver=1.9.29"></script>
<link rel="https://api.w.org/" href="https://july.finestwp.com/newwp/fortradex/wp-json/" /><link rel="alternate" title="JSON" type="application/json" href="https://july.finestwp.com/newwp/fortradex/wp-json/wp/v2/pages/1809" /><link rel="EditURI" type="application/rsd+xml" title="RSD" href="https://july.finestwp.com/newwp/fortradex/xmlrpc.php?rsd" />
<meta name="generator" content="WordPress 7.1" />
<meta name="generator" content="TutorLMS 4.0.7" />
<meta name="generator" content="WooCommerce 11.0.1" />
<link rel="canonical" href="https://july.finestwp.com/newwp/fortradex/blog-grid/" />
<link rel='shortlink' href='https://july.finestwp.com/newwp/fortradex/?p=1809' />
<meta name="generator" content="Redux 4.4.17" />	<noscript><style>.woocommerce-product-gallery{ opacity: 1 !important; }</style></noscript>
	<meta name="generator" content="Elementor 4.2.4; features: e_font_icon_svg, additional_custom_breakpoints; settings: css_print_method-external, google_font-enabled, font_display-swap">
			<style>
				.e-con.e-parent:nth-of-type(n+4):not(.e-lazyloaded):not(.e-no-lazyload),
				.e-con.e-parent:nth-of-type(n+4):not(.e-lazyloaded):not(.e-no-lazyload) * {
					background-image: none !important;
				}
				@media screen and (max-height: 1024px) {
					.e-con.e-parent:nth-of-type(n+3):not(.e-lazyloaded):not(.e-no-lazyload),
					.e-con.e-parent:nth-of-type(n+3):not(.e-lazyloaded):not(.e-no-lazyload) * {
						background-image: none !important;
					}
				}
				@media screen and (max-height: 640px) {
					.e-con.e-parent:nth-of-type(n+2):not(.e-lazyloaded):not(.e-no-lazyload),
					.e-con.e-parent:nth-of-type(n+2):not(.e-lazyloaded):not(.e-no-lazyload) * {
						background-image: none !important;
					}
				}
			</style>
			</head>

<body class="wp-singular page-template page-template-tpl-default-elementor page-template-tpl-default-elementor-php page page-id-1809 wp-embed-responsive wp-theme-fortradex theme-fortradex tutor-lms woocommerce-no-js menu-layer elementor-default elementor-kit-10 elementor-page elementor-page-1809">

<div class="boxed_wrapper ltr light_bg">

            <!-- preloader -->
    <div class="loader-wrap">
        <div class="preloader">
            <div class="preloader-close"><i class="fal fa-times"></i></div>
            <div id="handle-preloader" class="handle-preloader">
                <div class="animation-preloader">
                    <div class="spinner"></div>
                    <div class="txt-loading">
                                                <span data-text-preloader="f

" class="letters-loading">
f
</span>
<span data-text-preloader="o
" class="letters-loading">
o
</span>
<span data-text-preloader="r
" class="letters-loading">
r
</span>
<span data-text-preloader="t
" class="letters-loading">
t
</span>
<span data-text-preloader="r
" class="letters-loading">
r
</span>
<span data-text-preloader="a
" class="letters-loading">
a
</span>
<span data-text-preloader="d
" class="letters-loading">
d
</span>
<span data-text-preloader="e
" class="letters-loading">
e
</span>
<span data-text-preloader="x" class="letters-loading">
x </span>
</div>
</div>  
</div>
</div>
</div>
<!-- preloader end -->

        <!--Search Popup-->
    <div id="search-popup" class="search-popup">
        <div class="popup-inner">
            <div class="upper-box">
                <figure class="logo-box p_relative z_1"><a href="https://july.finestwp.com/newwp/fortradex/" title="Fortradex"><img src="https://july.finestwp.com/newwp/fortradex/wp-content/uploads/2024/07/logo.png" alt="logo" style="" /></a></figure>
                <div class="close-search"><i class="fal fa-times"></i></div>
            </div>
            <div class="overlay-layer"></div>
            <div class="auto-container">
                <div class="search-form">

<form method="post" action="https://july.finestwp.com/newwp/fortradex/">
    <div class="form-group">
        <fieldset>
            <input type="search" class="form-control" name="s" value="" placeholder="Search" required >
            <button type="submit"><i class="icon-10"></i></button>
        </fieldset>
    </div>
</form>                </div>
            </div>
        </div>
    </div>

    <!-- main header -->
    <header class="main-header header-style-three">
                <!-- header-top -->
        <div class="header-top">
            <div class="outer-container">
                <div class="top-inner">
                    <div class="option-block">
                                                <div class="support-box">
                            <div class="icon-box"><i class="icon-07"></i></div>
                            <a href="tel:91-2345-678">91-2345-678</a>
                        </div>

                    </div>
                                        <ul class="info-list clearfix">
                        <li><i class="icon-28"></i><span>£20 Discount</span> &amp; Get 24/7 Free Assistance</li>                        <li><i class="icon-27"></i>Free Trading Guides</li>                    </ul>
                                    </div>
            </div>
        </div>
                <!-- header-lower -->
        <div class="header-lower">
            <div class="outer-container">
                <div class="outer-box">
                    <figure class="logo-box"><a href="https://july.finestwp.com/newwp/fortradex/" title="Fortradex"><img src="https://july.finestwp.com/newwp/fortradex/wp-content/uploads/2024/07/logo.png" alt="logo" style="" /></a></figure>
                    <div class="menu-area">
                        <!--Mobile Navigation Toggler-->
                        <div class="mobile-nav-toggler">
                            <i class="icon-bar"></i>
                            <i class="icon-bar"></i>
                            <i class="icon-bar"></i>
                        </div>
                        <nav class="main-menu navbar-expand-md navbar-light clearfix">
                            <div class="collapse navbar-collapse show clearfix" id="navbarSupportedContent">
                                <ul class="navigation clearfix">
                                <li id="menu-item-18" class="menu-item menu-item-type-custom menu-item-object-custom menu-item-home menu-item-has-children menu-item-18 dropdown"><a href="https://july.finestwp.com/newwp/fortradex/" onClick="return true">Home<span class="menu-item_plus"></span></a><ul class="sub-menu submenu menu-sub-content">	<li id="menu-item-20" class="menu-item menu-item-type-post_type menu-item-object-page menu-item-home menu-item-20"><a href="https://july.finestwp.com/newwp/fortradex/" onClick="return true">Home One<span class="menu-item_plus"></span></a></li>	<li id="menu-item-424" class="menu-item menu-item-type-post_type menu-item-object-page menu-item-424"><a href="https://july.finestwp.com/newwp/fortradex/home-two/" onClick="return true">Home Two<span class="menu-item_plus"></span></a></li>	<li id="menu-item-666" class="menu-item menu-item-type-post_type menu-item-object-page menu-item-666"><a href="https://july.finestwp.com/newwp/fortradex/home-three/" onClick="return true">Home Three<span class="menu-item_plus"></span></a></li>	<li id="menu-item-1064" class="menu-item menu-item-type-post_type menu-item-object-page menu-item-1064"><a href="https://july.finestwp.com/newwp/fortradex/home-four/" onClick="return true">Home Four<span class="menu-item_plus"></span></a></li>	<li id="menu-item-1198" class="menu-item menu-item-type-post_type menu-item-object-page menu-item-1198"><a href="https://july.finestwp.com/newwp/fortradex/home-five/" onClick="return true">Home Five<span class="menu-item_plus"></span></a></li></ul>

</li><li id="menu-item-137" class="menu-item menu-item-type-custom menu-item-object-custom menu-item-has-children menu-item-137 dropdown"><a href="#" onClick="return true">Trading<span class="menu-item_plus"></span></a><ul class="sub-menu submenu menu-sub-content">	<li id="menu-item-1404" class="menu-item menu-item-type-post_type menu-item-object-page menu-item-1404"><a href="https://july.finestwp.com/newwp/fortradex/platform/" onClick="return true">Platform<span class="menu-item_plus"></span></a></li>	<li id="menu-item-1433" class="menu-item menu-item-type-post_type menu-item-object-page menu-item-1433"><a href="https://july.finestwp.com/newwp/fortradex/account/" onClick="return true">Account<span class="menu-item_plus"></span></a></li>	<li id="menu-item-1934" class="menu-item menu-item-type-post_type menu-item-object-page menu-item-1934"><a href="https://july.finestwp.com/newwp/fortradex/account-details/" onClick="return true">Account Details<span class="menu-item_plus"></span></a></li></ul>
</li><li id="menu-item-138" class="menu-item menu-item-type-custom menu-item-object-custom menu-item-has-children menu-item-138 dropdown"><a href="#" onClick="return true">Market<span class="menu-item_plus"></span></a><ul class="sub-menu submenu menu-sub-content">	<li id="menu-item-1527" class="menu-item menu-item-type-post_type menu-item-object-page menu-item-1527"><a href="https://july.finestwp.com/newwp/fortradex/markets-place/" onClick="return true">Markets Place<span class="menu-item_plus"></span></a></li>	<li id="menu-item-2099" class="menu-item menu-item-type-post_type menu-item-object-page menu-item-2099"><a href="https://july.finestwp.com/newwp/fortradex/markets-details/" onClick="return true">Markets Details<span class="menu-item_plus"></span></a></li></ul>
</li><li id="menu-item-139" class="menu-item menu-item-type-custom menu-item-object-custom menu-item-has-children menu-item-139 dropdown"><a href="#" onClick="return true">About Us<span class="menu-item_plus"></span></a><ul class="sub-menu submenu menu-sub-content">	<li id="menu-item-1635" class="menu-item menu-item-type-custom menu-item-object-custom menu-item-has-children menu-item-1635 dropdown"><a href="#" onClick="return true">Education<span class="menu-item_plus"></span></a>	<ul class="sub-menu submenu menu-sub-content">		<li id="menu-item-2117" class="menu-item menu-item-type-post_type menu-item-object-page menu-item-2117"><a href="https://july.finestwp.com/newwp/fortradex/education/" onClick="return true">Education<span class="menu-item_plus"></span></a></li>		<li id="menu-item-2476" class="menu-item menu-item-type-post_type menu-item-object-page menu-item-2476"><a href="https://july.finestwp.com/newwp/fortradex/student-registration/" onClick="return true">Student Registration<span class="menu-item_plus"></span></a></li>		<li id="menu-item-2475" class="menu-item menu-item-type-post_type menu-item-object-page menu-item-2475"><a href="https://july.finestwp.com/newwp/fortradex/instructor-registration/" onClick="return true">Instructor Registration<span class="menu-item_plus"></span></a></li>		<li id="menu-item-2477" class="menu-item menu-item-type-post_type menu-item-object-page menu-item-2477"><a href="https://july.finestwp.com/newwp/fortradex/dashboard/" onClick="return true">Dashboard<span class="menu-item_plus"></span></a></li>	</ul>
</li>	<li id="menu-item-1636" class="menu-item menu-item-type-custom menu-item-object-custom menu-item-has-children menu-item-1636 dropdown"><a href="#" onClick="return true">Team<span class="menu-item_plus"></span></a>	<ul class="sub-menu submenu menu-sub-content">		<li id="menu-item-1660" class="menu-item menu-item-type-post_type menu-item-object-page menu-item-1660"><a href="https://july.finestwp.com/newwp/fortradex/our-expert-team/" onClick="return true">Our Expert Team<span class="menu-item_plus"></span></a></li>		<li id="menu-item-1746" class="menu-item menu-item-type-post_type menu-item-object-team menu-item-1746"><a href="https://july.finestwp.com/newwp/fortradex/team/aronic-kehan/" onClick="return true">Team Details<span class="menu-item_plus"></span></a></li>	</ul>
</li>	<li id="menu-item-1703" class="menu-item menu-item-type-post_type menu-item-object-page menu-item-1703"><a href="https://july.finestwp.com/newwp/fortradex/about-us/" onClick="return true">About Us<span class="menu-item_plus"></span></a></li>	<li id="menu-item-1727" class="menu-item menu-item-type-post_type menu-item-object-page menu-item-1727"><a href="https://july.finestwp.com/newwp/fortradex/faqs/" onClick="return true">Faq’s<span class="menu-item_plus"></span></a></li>	<li id="menu-item-1734" class="menu-item menu-item-type-custom menu-item-object-custom menu-item-1734"><a href="https://july.finestwp.com/newwp/fortradex/?p=123456abc" onClick="return true">404<span class="menu-item_plus"></span></a></li></ul>
</li><li id="menu-item-140" class="menu-item menu-item-type-custom menu-item-object-custom current-menu-ancestor current-menu-parent menu-item-has-children menu-item-140 dropdown current"><a href="#" onClick="return true">Blog<span class="menu-item_plus"></span></a><ul class="sub-menu submenu menu-sub-content">	<li id="menu-item-1842" class="menu-item menu-item-type-post_type menu-item-object-page current-menu-item page_item page-item-1809 current_page_item menu-item-1842 current"><a href="https://july.finestwp.com/newwp/fortradex/blog-grid/" onClick="return true">Blog Grid<span class="menu-item_plus"></span></a></li>	<li id="menu-item-1865" class="menu-item menu-item-type-post_type menu-item-object-page menu-item-1865"><a href="https://july.finestwp.com/newwp/fortradex/blog-standard/" onClick="return true">Blog Standard<span class="menu-item_plus"></span></a></li>	<li id="menu-item-2457" class="menu-item menu-item-type-post_type menu-item-object-post menu-item-2457"><a href="https://july.finestwp.com/newwp/fortradex/2024/07/a-traders-weekly-playbook-the-jpy-at-work-2/" onClick="return true">Blog Details<span class="menu-item_plus"></span></a></li></ul>
</li><li id="menu-item-143" class="menu-item menu-item-type-post_type menu-item-object-page menu-item-143"><a href="https://july.finestwp.com/newwp/fortradex/contact/" onClick="return true">Contact<span class="menu-item_plus"></span></a></li> 
                                </ul>
                            </div>
                        </nav>
                    </div>
                    <div class="menu-right-content">
                        <div class="search-btn mr_25"><button class="search-toggler"><i class="icon-10"></i></button></div>                        <div class="btn-box"><a href="#" class="theme-btn btn-one">Open Account</a></div>                   </div>
                </div>
            </div>
        </div>

        <!--sticky Header-->
        <div class="sticky-header">
            <div class="large-container">
                <div class="outer-box">
                    <figure class="logo-box"><a href="https://july.finestwp.com/newwp/fortradex/" title="Fortradex"><img src="https://july.finestwp.com/newwp/fortradex/wp-content/uploads/2024/07/logo.png" alt="logo" style="" /></a></figure>
                    <div class="menu-area">
                        <nav class="main-menu clearfix">
                            <!--Keep This Empty / Menu will come through Javascript-->
                        </nav>
                    </div>
                    <div class="menu-right-content">
                        <div class="search-btn mr_25"><button class="search-toggler"><i class="icon-10"></i></button></div>                        <div class="btn-box"><a href="#" class="theme-btn btn-one">Open Account</a></div>                    </div>
                </div>
            </div>
        </div>
    </header>
    <!-- main-header end -->



    <!-- Mobile Menu  -->
    <div class="mobile-menu">
        <div class="menu-backdrop"></div>
        <div class="close-btn"><i class="fas fa-times"></i></div>
        <nav class="menu-box">
            <div class="nav-logo">
            			<a href="https://july.finestwp.com/newwp/fortradex/" title="Fortradex"><img src="https://july.finestwp.com/newwp/fortradex/wp-content/uploads/2024/07/logo-2.png" alt="logo" style="" /></a>                        </div>
            <div class="menu-outer"><!--Here Menu Will Come Automatically Via Javascript / Same Menu as in Header--></div>

            <div class="contact-info">
                <h4>Contact Info</h4>                <ul>
                    <li>Chicago 12, Melborne City, USA</li>                    <li><a href="tel:+88-01682648101">+88-01682648101</a></li>                    <li><a href="mailto:info@example.com">info@example.com</a></li>                </ul>
            </div>

    		            <div class="social-links">
                <ul class="clearfix">

    	<li>
    	<a target="_blank" href="https://www.facebook.com/"><i class="fab  fa-facebook-f"></i></a>
    </li>
    	<li>
    	<a target="_blank" href="https://www.twitter.com/"><i class="fab  fa-twitter"></i></a>
    </li>
    	<li>
    	<a target="_blank" href="https://www.linkedin.com/"><i class="fab  fa-linkedin-in"></i></a>
    </li>
    	<li>
    	<a target="_blank" href="https://www.skype.com/"><i class="fab  fa-skype"></i></a>
    </li>


                    </ul>
            </div>
                    </nav>
    </div>
    <!-- End Mobile Menu -->

    <!-- page-title -->
    <section class="page-title centred pt_90 pb_0">
        <div class="pattern-layer rotate-me" style="background-image: url(https://july.finestwp.com/newwp/fortradex/wp-content/uploads/2024/07/shape-34.png);"></div>        <div class="auto-container">
            <div class="content-box">
                <h1>Blog Grid</h1>
                                <ul class="bread-crumb clearfix">
                    <li class="breadcrumb-item"><a href="https://july.finestwp.com/newwp/fortradex/">Home</a></li><li class="breadcrumb-item">Blog Grid</li>                </ul>
                            </div>
        </div>
    </section>
    <!-- page-title end -->

    		<div data-elementor-type="wp-page" data-elementor-id="1809" class="elementor elementor-1809">
    			<div class="elementor-element elementor-element-85f0647 e-flex e-con-boxed e-con e-parent" data-id="85f0647" data-element_type="container" data-e-type="container">
    				<div class="e-con-inner">
    	<div class="elementor-element elementor-element-2a3cd61 e-con-full e-flex e-con e-child" data-id="2a3cd61" data-element_type="container" data-e-type="container">
    			<div class="elementor-element elementor-element-18b6f78 elementor-widget elementor-widget-fortradex_blog_grid" data-id="18b6f78" data-element_type="widget" data-e-type="widget" data-widget_type="fortradex_blog_grid.default">
    			<div class="elementor-widget-container">


        <!-- sidebar-page-container -->
        <section class="sidebar-page-container">
            <div class="content-side">
                <div class="blog-grid-content">
                    <div class="row clearfix">
                                                <div class="col-lg-6 col-md-6 col-sm-12 news-block">
                            <div class="news-block-two wow fadeInUp animated animated" data-wow-delay="00ms" data-wow-duration="1500ms">
                                <div class="inner-box">
                                                                        <div class="image-box">
                                        <figure class="image"><a href="https://july.finestwp.com/newwp/fortradex/2024/07/niger-pm-says-oil-export-blockade-violates-accords/"><img fetchpriority="high" decoding="async" width="410" height="250" src="https://july.finestwp.com/newwp/fortradex/wp-content/uploads/2024/07/news-9-410x250.jpg" class="attachment-fortradex_410x250 size-fortradex_410x250 wp-post-image" alt="" /></a></figure>
                                        <figure class="overlay-image"><a href="https://july.finestwp.com/newwp/fortradex/2024/07/niger-pm-says-oil-export-blockade-violates-accords/"><img fetchpriority="high" decoding="async" width="410" height="250" src="https://july.finestwp.com/newwp/fortradex/wp-content/uploads/2024/07/news-9-410x250.jpg" class="attachment-fortradex_410x250 size-fortradex_410x250 wp-post-image" alt="" /></a></figure>
                                    </div>
                                                                        <div class="lower-content">
                                        <span class="category"><a href="https://july.finestwp.com/newwp/fortradex/category/day-trading/" rel="category tag">Day Trading</a></span>                                        <h3><a href="https://july.finestwp.com/newwp/fortradex/2024/07/niger-pm-says-oil-export-blockade-violates-accords/">Niger PM says oil export blockade violates accords</a></h3>
                                		<p>We closed out what was a strong week for equity&hellip;</p>

    																			<div class="author-box">
                                            											                                            <figure class="author-thumb"><img alt='' src='https://secure.gravatar.com/avatar/bfbbbbbf15bfbfdbe29a43a6dfaf20857b1e04846902b89c3e63eae69d322d7e?s=40&#038;d=mm&#038;r=g' srcset='https://secure.gravatar.com/avatar/bfbbbbbf15bfbfdbe29a43a6dfaf20857b1e04846902b89c3e63eae69d322d7e?s=80&#038;d=mm&#038;r=g 2x' class='avatar avatar-40 photo' height='40' width='40' /></figure>
                                                                                                                                    <span>admin &nbsp; July 13, 2024</span>
                                        </div>
                                                                            </div>
                                </div>
                            </div>
                        </div>
                                                <div class="col-lg-6 col-md-6 col-sm-12 news-block">
                            <div class="news-block-two wow fadeInUp animated animated" data-wow-delay="00ms" data-wow-duration="1500ms">
                                <div class="inner-box">
                                                                        <div class="image-box">
                                        <figure class="image"><a href="https://july.finestwp.com/newwp/fortradex/2024/07/chinas-geo-jade-wins-bid-to-develop-iraqs-jabal-oil/"><img decoding="async" width="410" height="250" src="https://july.finestwp.com/newwp/fortradex/wp-content/uploads/2024/07/news-8-410x250.jpg" class="attachment-fortradex_410x250 size-fortradex_410x250 wp-post-image" alt="" /></a></figure>
                                        <figure class="overlay-image"><a href="https://july.finestwp.com/newwp/fortradex/2024/07/chinas-geo-jade-wins-bid-to-develop-iraqs-jabal-oil/"><img decoding="async" width="410" height="250" src="https://july.finestwp.com/newwp/fortradex/wp-content/uploads/2024/07/news-8-410x250.jpg" class="attachment-fortradex_410x250 size-fortradex_410x250 wp-post-image" alt="" /></a></figure>
                                    </div>
                                                                        <div class="lower-content">
                                        <span class="category"><a href="https://july.finestwp.com/newwp/fortradex/category/day-trading/" rel="category tag">Day Trading</a></span>                                        <h3><a href="https://july.finestwp.com/newwp/fortradex/2024/07/chinas-geo-jade-wins-bid-to-develop-iraqs-jabal-oil/">China&#8217;s Geo-Jade wins bid to develop Iraq&#8217;s Jabal oil</a></h3>
                                		<p>We closed out what was a strong week for equity&hellip;</p>

    																			<div class="author-box">
                                            											                                            <figure class="author-thumb"><img alt='' src='https://secure.gravatar.com/avatar/bfbbbbbf15bfbfdbe29a43a6dfaf20857b1e04846902b89c3e63eae69d322d7e?s=40&#038;d=mm&#038;r=g' srcset='https://secure.gravatar.com/avatar/bfbbbbbf15bfbfdbe29a43a6dfaf20857b1e04846902b89c3e63eae69d322d7e?s=80&#038;d=mm&#038;r=g 2x' class='avatar avatar-40 photo' height='40' width='40' /></figure>
                                                                                                                                    <span>admin &nbsp; July 13, 2024</span>
                                        </div>
                                                                            </div>
                                </div>
                            </div>
                        </div>
                                                <div class="col-lg-6 col-md-6 col-sm-12 news-block">
                            <div class="news-block-two wow fadeInUp animated animated" data-wow-delay="00ms" data-wow-duration="1500ms">
                                <div class="inner-box">
                                                                        <div class="image-box">
                                        <figure class="image"><a href="https://july.finestwp.com/newwp/fortradex/2024/07/a-traders-weekly-playbook-the-jpy-at-work/"><img decoding="async" width="410" height="250" src="https://july.finestwp.com/newwp/fortradex/wp-content/uploads/2024/07/news-7-410x250.jpg" class="attachment-fortradex_410x250 size-fortradex_410x250 wp-post-image" alt="" /></a></figure>
                                        <figure class="overlay-image"><a href="https://july.finestwp.com/newwp/fortradex/2024/07/a-traders-weekly-playbook-the-jpy-at-work/"><img decoding="async" width="410" height="250" src="https://july.finestwp.com/newwp/fortradex/wp-content/uploads/2024/07/news-7-410x250.jpg" class="attachment-fortradex_410x250 size-fortradex_410x250 wp-post-image" alt="" /></a></figure>
                                    </div>
                                                                        <div class="lower-content">
                                        <span class="category"><a href="https://july.finestwp.com/newwp/fortradex/category/day-trading/" rel="category tag">Day Trading</a></span>                                        <h3><a href="https://july.finestwp.com/newwp/fortradex/2024/07/a-traders-weekly-playbook-the-jpy-at-work/">A Traders’ Weekly Playbook: The JPY at work</a></h3>
                                		<p>We closed out what was a strong week for equity&hellip;</p>

    																			<div class="author-box">
                                            											                                            <figure class="author-thumb"><img alt='' src='https://secure.gravatar.com/avatar/bfbbbbbf15bfbfdbe29a43a6dfaf20857b1e04846902b89c3e63eae69d322d7e?s=40&#038;d=mm&#038;r=g' srcset='https://secure.gravatar.com/avatar/bfbbbbbf15bfbfdbe29a43a6dfaf20857b1e04846902b89c3e63eae69d322d7e?s=80&#038;d=mm&#038;r=g 2x' class='avatar avatar-40 photo' height='40' width='40' /></figure>
                                                                                                                                    <span>admin &nbsp; July 13, 2024</span>
                                        </div>
                                                                            </div>
                                </div>
                            </div>
                        </div>
                                                <div class="col-lg-6 col-md-6 col-sm-12 news-block">
                            <div class="news-block-two wow fadeInUp animated animated" data-wow-delay="00ms" data-wow-duration="1500ms">
                                <div class="inner-box">
                                                                        <div class="image-box">
                                        <figure class="image"><a href="https://july.finestwp.com/newwp/fortradex/2024/07/finding-your-edge-in-the-market/"><img loading="lazy" decoding="async" width="410" height="250" src="https://july.finestwp.com/newwp/fortradex/wp-content/uploads/2024/07/news-11-410x250.jpg" class="attachment-fortradex_410x250 size-fortradex_410x250 wp-post-image" alt="" /></a></figure>
                                        <figure class="overlay-image"><a href="https://july.finestwp.com/newwp/fortradex/2024/07/finding-your-edge-in-the-market/"><img loading="lazy" decoding="async" width="410" height="250" src="https://july.finestwp.com/newwp/fortradex/wp-content/uploads/2024/07/news-11-410x250.jpg" class="attachment-fortradex_410x250 size-fortradex_410x250 wp-post-image" alt="" /></a></figure>
                                    </div>
                                                                        <div class="lower-content">
                                        <span class="category"><a href="https://july.finestwp.com/newwp/fortradex/category/economic/" rel="category tag">Economic</a></span>                                        <h3><a href="https://july.finestwp.com/newwp/fortradex/2024/07/finding-your-edge-in-the-market/">Finding Your Edge in the Market</a></h3>
                                		<p>We closed out what was a strong week for equity&hellip;</p>

    																			<div class="author-box">
                                            											                                            <figure class="author-thumb"><img alt='' src='https://secure.gravatar.com/avatar/bfbbbbbf15bfbfdbe29a43a6dfaf20857b1e04846902b89c3e63eae69d322d7e?s=40&#038;d=mm&#038;r=g' srcset='https://secure.gravatar.com/avatar/bfbbbbbf15bfbfdbe29a43a6dfaf20857b1e04846902b89c3e63eae69d322d7e?s=80&#038;d=mm&#038;r=g 2x' class='avatar avatar-40 photo' height='40' width='40' /></figure>
                                                                                                                                    <span>admin &nbsp; July 27, 2024</span>
                                        </div>
                                                                            </div>
                                </div>
                            </div>
                        </div>
                                                <div class="col-lg-6 col-md-6 col-sm-12 news-block">
                            <div class="news-block-two wow fadeInUp animated animated" data-wow-delay="00ms" data-wow-duration="1500ms">
                                <div class="inner-box">
                                                                        <div class="image-box">
                                        <figure class="image"><a href="https://july.finestwp.com/newwp/fortradex/2024/07/protecting-your-capital-and-maximizing/"><img fetchpriority="high" decoding="async" width="410" height="250" src="https://july.finestwp.com/newwp/fortradex/wp-content/uploads/2024/07/news-9-410x250.jpg" class="attachment-fortradex_410x250 size-fortradex_410x250 wp-post-image" alt="" /></a></figure>
                                        <figure class="overlay-image"><a href="https://july.finestwp.com/newwp/fortradex/2024/07/protecting-your-capital-and-maximizing/"><img fetchpriority="high" decoding="async" width="410" height="250" src="https://july.finestwp.com/newwp/fortradex/wp-content/uploads/2024/07/news-9-410x250.jpg" class="attachment-fortradex_410x250 size-fortradex_410x250 wp-post-image" alt="" /></a></figure>
                                    </div>
                                                                        <div class="lower-content">
                                        <span class="category"><a href="https://july.finestwp.com/newwp/fortradex/category/position-trading/" rel="category tag">Position Trading</a></span>                                        <h3><a href="https://july.finestwp.com/newwp/fortradex/2024/07/protecting-your-capital-and-maximizing/">Protecting Your Capital and Maximizing</a></h3>
                                		<p>We closed out what was a strong week for equity&hellip;</p>

    																			<div class="author-box">
                                            											                                            <figure class="author-thumb"><img alt='' src='https://secure.gravatar.com/avatar/bfbbbbbf15bfbfdbe29a43a6dfaf20857b1e04846902b89c3e63eae69d322d7e?s=40&#038;d=mm&#038;r=g' srcset='https://secure.gravatar.com/avatar/bfbbbbbf15bfbfdbe29a43a6dfaf20857b1e04846902b89c3e63eae69d322d7e?s=80&#038;d=mm&#038;r=g 2x' class='avatar avatar-40 photo' height='40' width='40' /></figure>
                                                                                                                                    <span>admin &nbsp; July 27, 2024</span>
                                        </div>
                                                                            </div>
                                </div>
                            </div>
                        </div>
                                                <div class="col-lg-6 col-md-6 col-sm-12 news-block">
                            <div class="news-block-two wow fadeInUp animated animated" data-wow-delay="00ms" data-wow-duration="1500ms">
                                <div class="inner-box">
                                                                        <div class="image-box">
                                        <figure class="image"><a href="https://july.finestwp.com/newwp/fortradex/2024/07/chart-patterns-every-trader-should-know/"><img loading="lazy" decoding="async" width="410" height="250" src="https://july.finestwp.com/newwp/fortradex/wp-content/uploads/2024/07/news-10-410x250.jpg" class="attachment-fortradex_410x250 size-fortradex_410x250 wp-post-image" alt="" /></a></figure>
                                        <figure class="overlay-image"><a href="https://july.finestwp.com/newwp/fortradex/2024/07/chart-patterns-every-trader-should-know/"><img loading="lazy" decoding="async" width="410" height="250" src="https://july.finestwp.com/newwp/fortradex/wp-content/uploads/2024/07/news-10-410x250.jpg" class="attachment-fortradex_410x250 size-fortradex_410x250 wp-post-image" alt="" /></a></figure>
                                    </div>
                                                                        <div class="lower-content">
                                        <span class="category"><a href="https://july.finestwp.com/newwp/fortradex/category/driven-trading/" rel="category tag">Driven Trading</a></span>                                        <h3><a href="https://july.finestwp.com/newwp/fortradex/2024/07/chart-patterns-every-trader-should-know/">Chart Patterns Every Trader Should Know</a></h3>
                                		<p>We closed out what was a strong week for equity&hellip;</p>

    																			<div class="author-box">
                                            											                                            <figure class="author-thumb"><img alt='' src='https://secure.gravatar.com/avatar/bfbbbbbf15bfbfdbe29a43a6dfaf20857b1e04846902b89c3e63eae69d322d7e?s=40&#038;d=mm&#038;r=g' srcset='https://secure.gravatar.com/avatar/bfbbbbbf15bfbfdbe29a43a6dfaf20857b1e04846902b89c3e63eae69d322d7e?s=80&#038;d=mm&#038;r=g 2x' class='avatar avatar-40 photo' height='40' width='40' /></figure>
                                                                                                                                    <span>admin &nbsp; July 27, 2024</span>
                                        </div>
                                                                            </div>
                                </div>
                            </div>
                        </div>
                                            </div>

                                        <div class="pagination-wrapper centred">
    					<ul class="pagination">
    <li><span aria-label="Page 1" aria-current="page" class="page-numbers current">1</span></li>
    <li><a aria-label="Page 2" class="page-numbers" href="https://july.finestwp.com/newwp/fortradex/blog-grid/page/2/">2</a></li>
    <li><a class="next page-numbers" href="https://july.finestwp.com/newwp/fortradex/blog-grid/page/2/"><i class="icon-40"></i> </a></li>

</ul>
                    </div>
                                    </div>
            </div>
        </section>
        <!-- sidebar-page-container end -->

        				</div>
    			</div>
    			</div>
    	<div class="elementor-element elementor-element-8eae4dd e-con-full e-flex e-con e-child" data-id="8eae4dd" data-element_type="container" data-e-type="container">
    			<div class="elementor-element elementor-element-eb8f33d blog-sidebar elementor-widget elementor-widget-sidebar" data-id="eb8f33d" data-element_type="widget" data-e-type="widget" data-widget_type="sidebar.default">
    			<div class="elementor-widget-container">
    				<div id="search-2" class="widget sidebar-widget widget_search">

<!--Start Single Sidebar Box-->
<div class="search-widget">
    <div class="search-form">
        <form method="post" action="https://july.finestwp.com/newwp/fortradex/">
            <div class="form-group">
                <input type="search" name="s" value="" placeholder="Search" required="">
                <button type="submit"><i class="icon-10"></i></button>
            </div>
        </form>
    </div>
</div>
<!--End Single Sidebar Box--></div><div id="categories-2" class="widget sidebar-widget widget_categories"><div class="widget-title mb_11"><h3>Categories</h3></div>
			<ul>
					<li class="cat-item cat-item-1"><a href="https://july.finestwp.com/newwp/fortradex/category/day-trading/">Day Trading</a>
</li>
	<li class="cat-item cat-item-10"><a href="https://july.finestwp.com/newwp/fortradex/category/driven-trading/">Driven Trading</a>
</li>
	<li class="cat-item cat-item-11"><a href="https://july.finestwp.com/newwp/fortradex/category/economic/">Economic</a>
</li>
	<li class="cat-item cat-item-9"><a href="https://july.finestwp.com/newwp/fortradex/category/position-trading/">Position Trading</a>
</li>
	<li class="cat-item cat-item-8"><a href="https://july.finestwp.com/newwp/fortradex/category/swing-trading/">Swing Trading</a>
</li>
			</ul>

    		</div><div id="fortradex_latest_posts-2" class="widget sidebar-widget widget_fortradex_latest_posts">
    	<div class="post-widget">
            <div class="widget-title mb_11"><h3>Latest Posts</h3></div>            <div class="post-inner">

           	<!-- Title -->

            <div class="post">
                <figure class="post-thumb"><a href="https://july.finestwp.com/newwp/fortradex/2024/07/a-traders-weekly-playbook-the-jpy-at-work-2/"><img loading="lazy" decoding="async" width="95" height="61" src="https://july.finestwp.com/newwp/fortradex/wp-content/uploads/2024/07/news-8.jpg" class="attachment-fortradex_95x78 size-fortradex_95x78 wp-post-image" alt="" srcset="https://july.finestwp.com/newwp/fortradex/wp-content/uploads/2024/07/news-8.jpg 850w, https://july.finestwp.com/newwp/fortradex/wp-content/uploads/2024/07/news-8-300x194.jpg 300w, https://july.finestwp.com/newwp/fortradex/wp-content/uploads/2024/07/news-8-768x497.jpg 768w" sizes="(max-width: 95px) 100vw, 95px" /></a></figure>
                <h6><a href="https://july.finestwp.com/newwp/fortradex/2024/07/a-traders-weekly-playbook-the-jpy-at-work-2/">A Traders’ Weekly Playbook: The JPY...</a></h6>
                <span class="post-date">July 27, 2024</span>
            </div>


            <div class="post">
                <figure class="post-thumb"><a href="https://july.finestwp.com/newwp/fortradex/2024/07/chart-patterns-every-trader-should-know/"><img loading="lazy" decoding="async" width="95" height="61" src="https://july.finestwp.com/newwp/fortradex/wp-content/uploads/2024/07/news-10.jpg" class="attachment-fortradex_95x78 size-fortradex_95x78 wp-post-image" alt="" srcset="https://july.finestwp.com/newwp/fortradex/wp-content/uploads/2024/07/news-10.jpg 850w, https://july.finestwp.com/newwp/fortradex/wp-content/uploads/2024/07/news-10-300x194.jpg 300w, https://july.finestwp.com/newwp/fortradex/wp-content/uploads/2024/07/news-10-768x497.jpg 768w" sizes="(max-width: 95px) 100vw, 95px" /></a></figure>
                <h6><a href="https://july.finestwp.com/newwp/fortradex/2024/07/chart-patterns-every-trader-should-know/">Chart Patterns Every Trader Should Know</a></h6>
                <span class="post-date">July 27, 2024</span>
            </div>


            <div class="post">
                <figure class="post-thumb"><a href="https://july.finestwp.com/newwp/fortradex/2024/07/protecting-your-capital-and-maximizing/"><img loading="lazy" decoding="async" width="95" height="61" src="https://july.finestwp.com/newwp/fortradex/wp-content/uploads/2024/07/news-9.jpg" class="attachment-fortradex_95x78 size-fortradex_95x78 wp-post-image" alt="" srcset="https://july.finestwp.com/newwp/fortradex/wp-content/uploads/2024/07/news-9.jpg 850w, https://july.finestwp.com/newwp/fortradex/wp-content/uploads/2024/07/news-9-300x194.jpg 300w, https://july.finestwp.com/newwp/fortradex/wp-content/uploads/2024/07/news-9-768x497.jpg 768w" sizes="(max-width: 95px) 100vw, 95px" /></a></figure>
                <h6><a href="https://july.finestwp.com/newwp/fortradex/2024/07/protecting-your-capital-and-maximizing/">Protecting Your Capital and Maximizing</a></h6>
                <span class="post-date">July 27, 2024</span>
            </div>


                    </div>
        </div>

    	</div><div id="tag_cloud-2" class="widget sidebar-widget widget_tag_cloud"><div class="widget-title mb_11"><h3>Popular tag</h3></div><div class="tagcloud"><a href="https://july.finestwp.com/newwp/fortradex/tag/account/" class="tag-cloud-link tag-link-15 tag-link-position-1" style="font-size: 8pt;" aria-label="Account (1 item)">Account</a>

<a href="https://july.finestwp.com/newwp/fortradex/tag/careers/" class="tag-cloud-link tag-link-13 tag-link-position-2" style="font-size: 22pt;" aria-label="Careers (4 items)">Careers</a>
<a href="https://july.finestwp.com/newwp/fortradex/tag/demo/" class="tag-cloud-link tag-link-14 tag-link-position-3" style="font-size: 22pt;" aria-label="Demo (4 items)">Demo</a>
<a href="https://july.finestwp.com/newwp/fortradex/tag/education/" class="tag-cloud-link tag-link-19 tag-link-position-4" style="font-size: 8pt;" aria-label="Education (1 item)">Education</a>
<a href="https://july.finestwp.com/newwp/fortradex/tag/markets/" class="tag-cloud-link tag-link-16 tag-link-position-5" style="font-size: 8pt;" aria-label="Markets (1 item)">Markets</a>
<a href="https://july.finestwp.com/newwp/fortradex/tag/mt4/" class="tag-cloud-link tag-link-17 tag-link-position-6" style="font-size: 8pt;" aria-label="MT4 (1 item)">MT4</a>
<a href="https://july.finestwp.com/newwp/fortradex/tag/mt5/" class="tag-cloud-link tag-link-20 tag-link-position-7" style="font-size: 8pt;" aria-label="MT5 (1 item)">MT5</a>
<a href="https://july.finestwp.com/newwp/fortradex/tag/trading/" class="tag-cloud-link tag-link-18 tag-link-position-8" style="font-size: 8pt;" aria-label="Trading (1 item)">Trading</a></div>
</div><div id="archives-2" class="widget sidebar-widget widget_archive"><div class="widget-title mb_11"><h3>Archives</h3></div>
			<ul>
					<li><a href='https://july.finestwp.com/newwp/fortradex/2024/07/'>July 2024</a></li>
			</ul>

    		</div>				</div>
    			</div>
    			</div>
    				</div>
    			</div>
    	<div class="elementor-element elementor-element-9f56ff9 e-flex e-con-boxed e-con e-parent" data-id="9f56ff9" data-element_type="container" data-e-type="container" data-settings="{&quot;background_background&quot;:&quot;gradient&quot;}">
    				<div class="e-con-inner">
    	<div class="elementor-element elementor-element-0601774 e-con-full e-flex e-con e-child" data-id="0601774" data-element_type="container" data-e-type="container" data-settings="{&quot;background_background&quot;:&quot;classic&quot;}">
    	<div class="elementor-element elementor-element-cd1e00a e-con-full e-flex e-con e-child" data-id="cd1e00a" data-element_type="container" data-e-type="container">
    			<div class="elementor-element elementor-element-5c5b612 elementor-widget elementor-widget-heading" data-id="5c5b612" data-element_type="widget" data-e-type="widget" data-widget_type="heading.default">
    			<div class="elementor-widget-container">
    				<h2 class="elementor-heading-title elementor-size-default">

Subscribe for latest update</h2> </div>
</div>
</div>
<div class="elementor-element elementor-element-bf89fe5 e-con-full e-flex e-con e-child" data-id="bf89fe5" data-element_type="container" data-e-type="container">
<div class="elementor-element elementor-element-e704980 elementor-widget elementor-widget-fortradex_subscribe_form" data-id="e704980" data-element_type="widget" data-e-type="widget" data-widget_type="fortradex_subscribe_form.default">
<div class="elementor-widget-container">

    <!-- subscribe-section -->
    <section class="subscribe-section p-0 m-0">
        <div class="form-inner">
                    </div>
    </section>
    <!-- subscribe-section end -->

    				</div>
    			</div>
    			</div>
    			</div>
    				</div>
    			</div>
    			</div>


    <!-- main-footer -->
    <footer class="main-footer">
        <div class="widget-section p_relative pt_70 pb_80">
            <div class="auto-container">
                <div class="row clearfix">
                    <div class="col-lg-8 col-md-12 col-sm-12 big-column">
                                                <div class="row clearfix">
                            <div class="col-lg-3 col-md-6 col-sm-12 footer-column"><div id="nav_menu-2" class="footer-widget widget_nav_menu"><div class="widget-title mb_11"><h3>About Us</h3></div><div class="menu-footer-about-us-container"><ul id="menu-footer-about-us" class="menu"><li id="menu-item-1887" class="menu-item menu-item-type-post_type menu-item-object-page menu-item-1887"><a href="https://july.finestwp.com/newwp/fortradex/about-us/" onClick="return true">About Us</a></li>

<li id="menu-item-1890" class="menu-item menu-item-type-post_type menu-item-object-page menu-item-1890"><a href="https://july.finestwp.com/newwp/fortradex/faqs/" onClick="return true">Faq’s</a></li>
<li id="menu-item-1891" class="menu-item menu-item-type-post_type menu-item-object-page menu-item-1891"><a href="https://july.finestwp.com/newwp/fortradex/our-expert-team/" onClick="return true">Our Team</a></li>
<li id="menu-item-1892" class="menu-item menu-item-type-post_type menu-item-object-page menu-item-1892"><a href="https://july.finestwp.com/newwp/fortradex/markets-place/" onClick="return true">Markets Place</a></li>
<li id="menu-item-1893" class="menu-item menu-item-type-post_type menu-item-object-page menu-item-1893"><a href="https://july.finestwp.com/newwp/fortradex/platform/" onClick="return true">Platform</a></li>
<li id="menu-item-1888" class="menu-item menu-item-type-post_type menu-item-object-page current-menu-item page_item page-item-1809 current_page_item menu-item-1888"><a href="https://july.finestwp.com/newwp/fortradex/blog-grid/" aria-current="page" onClick="return true">Blog Grid</a></li>
<li id="menu-item-1889" class="menu-item menu-item-type-post_type menu-item-object-page menu-item-1889"><a href="https://july.finestwp.com/newwp/fortradex/contact/" onClick="return true">Contact Us</a></li>
</ul></div></div></div><div class="col-lg-3 col-md-6 col-sm-12 footer-column"><div id="nav_menu-3" class="footer-widget widget_nav_menu"><div class="widget-title mb_11"><h3>Platforms</h3></div><div class="menu-footer-platforms-menu-container"><ul id="menu-footer-platforms-menu" class="menu"><li id="menu-item-1894" class="menu-item menu-item-type-custom menu-item-object-custom menu-item-1894"><a href="#" onClick="return true">Forex</a></li>
<li id="menu-item-1895" class="menu-item menu-item-type-custom menu-item-object-custom menu-item-1895"><a href="#" onClick="return true">Crypto CFDs</a></li>
<li id="menu-item-1896" class="menu-item menu-item-type-custom menu-item-object-custom menu-item-1896"><a href="#" onClick="return true">Share CFDs</a></li>
<li id="menu-item-1897" class="menu-item menu-item-type-custom menu-item-object-custom menu-item-1897"><a href="#" onClick="return true">Commodities</a></li>
<li id="menu-item-1898" class="menu-item menu-item-type-custom menu-item-object-custom menu-item-1898"><a href="#" onClick="return true">Spot Metals</a></li>
<li id="menu-item-1899" class="menu-item menu-item-type-custom menu-item-object-custom menu-item-1899"><a href="#" onClick="return true">Energies</a></li>
<li id="menu-item-1900" class="menu-item menu-item-type-custom menu-item-object-custom menu-item-1900"><a href="#" onClick="return true">MetaTrader 5</a></li>
</ul></div></div></div><div class="col-lg-3 col-md-6 col-sm-12 footer-column"><div id="nav_menu-4" class="footer-widget widget_nav_menu"><div class="widget-title mb_11"><h3>Trading Tools</h3></div><div class="menu-trading-tools-menu-container"><ul id="menu-trading-tools-menu" class="menu"><li id="menu-item-1901" class="menu-item menu-item-type-custom menu-item-object-custom menu-item-1901"><a href="#" onClick="return true">FXT Navigator</a></li>
<li id="menu-item-1902" class="menu-item menu-item-type-custom menu-item-object-custom menu-item-1902"><a href="#" onClick="return true">Trading Central</a></li>
<li id="menu-item-1903" class="menu-item menu-item-type-custom menu-item-object-custom menu-item-1903"><a href="#" onClick="return true">Economic Calendar</a></li>
<li id="menu-item-1904" class="menu-item menu-item-type-custom menu-item-object-custom menu-item-1904"><a href="#" onClick="return true">Market Sentiment</a></li>
<li id="menu-item-1905" class="menu-item menu-item-type-custom menu-item-object-custom menu-item-1905"><a href="#" onClick="return true">API Trading</a></li>
<li id="menu-item-1906" class="menu-item menu-item-type-custom menu-item-object-custom menu-item-1906"><a href="#" onClick="return true">VPS</a></li>
<li id="menu-item-1907" class="menu-item menu-item-type-custom menu-item-object-custom menu-item-1907"><a href="#" onClick="return true">CDF Rollover</a></li>
</ul></div></div></div><div class="col-lg-3 col-md-6 col-sm-12 footer-column"><div id="nav_menu-5" class="footer-widget widget_nav_menu"><div class="widget-title mb_11"><h3>Support</h3></div><div class="menu-support-menu-container"><ul id="menu-support-menu" class="menu"><li id="menu-item-1908" class="menu-item menu-item-type-custom menu-item-object-custom menu-item-1908"><a href="#" onClick="return true">Legal Information</a></li>
<li id="menu-item-1909" class="menu-item menu-item-type-custom menu-item-object-custom menu-item-1909"><a href="#" onClick="return true">Privacy Policy</a></li>
<li id="menu-item-1910" class="menu-item menu-item-type-custom menu-item-object-custom menu-item-1910"><a href="#" onClick="return true">Regulations</a></li>
<li id="menu-item-1911" class="menu-item menu-item-type-custom menu-item-object-custom menu-item-1911"><a href="#" onClick="return true">Risk Disclaimer</a></li>
<li id="menu-item-1912" class="menu-item menu-item-type-custom menu-item-object-custom menu-item-1912"><a href="#" onClick="return true">Complaints Procedure</a></li>
<li id="menu-item-1913" class="menu-item menu-item-type-custom menu-item-object-custom menu-item-1913"><a href="#" onClick="return true">Company News</a></li>
<li id="menu-item-1914" class="menu-item menu-item-type-custom menu-item-object-custom menu-item-1914"><a href="#" onClick="return true">Trading Videos</a></li>
</ul></div></div></div>                        </div>

                                                <div class="footer-lower">
                            <figure class="footer-logo"><a href="https://july.finestwp.com/newwp/fortradex/"><img src="https://july.finestwp.com/newwp/fortradex/wp-content/uploads/2024/07/logo.png" alt="Fortradex"></a></figure>
                            <ul class="footer-card clearfix">
                                <li><h4>We Accept:</h4></li>

                                                                <li><a href="#"><img src="https://july.finestwp.com/newwp/fortradex/wp-content/uploads/2024/07/card-1.png" alt="Fortradex"></a></li>
                                                                <li><a href="#"><img src="https://july.finestwp.com/newwp/fortradex/wp-content/uploads/2024/07/card-2.png" alt="Fortradex"></a></li>
                                                                <li><a href="#"><img src="https://july.finestwp.com/newwp/fortradex/wp-content/uploads/2024/07/card-3.png" alt="Fortradex"></a></li>
                                                                <li><a href="#"><img src="https://july.finestwp.com/newwp/fortradex/wp-content/uploads/2024/07/card-4.png" alt="Fortradex"></a></li>
                                                                <li><a href="#"><img src="https://july.finestwp.com/newwp/fortradex/wp-content/uploads/2024/07/card-5.png" alt="Fortradex"></a></li>
                                                                <li><a href="#"><img src="https://july.finestwp.com/newwp/fortradex/wp-content/uploads/2024/07/card-6.png" alt="Fortradex"></a></li>
                                                            </ul>
                        </div>
                                            </div>

                                        <div class="col-lg-4 col-md-6 col-sm-12 footer-column">
                        <div class="footer-widget logo-widget centred ml_80">
                            <div class="widget-content">
                                                                    <figure class="footer-logo mb_15"><a href="https://july.finestwp.com/newwp/fortradex/">
                                    	<img src="https://july.finestwp.com/newwp/fortradex/wp-content/uploads/2024/07/logo-3.png" alt="Fortradex"></a>
                                    </figure>
    							                                <p>Trade multipliers on our app.</p>
                                                                <div class="scanner-box mb_30"><img src="https://july.finestwp.com/newwp/fortradex/wp-content/uploads/2024/07/icon-3.png" alt="Fortradex"></div>
                                                                <ul class="download-list clearfix">
                                    <li><a href="#"><i class="fab fa-apple"></i></a></li>                                    <li><a href="#"><img src="https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/images/icons/icon-2.png" alt="Fortradex"></a></li>                                    <li><a href="#"><i class="fab fa-android"></i></a></li>                                </ul>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>

        <div class="footer-bottom">
            <div class="auto-container">
                <div class="bottom-inner">
                    <p>Copyright &copy; 2007-2030 <a href="#">ForTradex</a>. All rights reserved.</p>
                                        <ul class="social-links">
                        <li><h5>Follow Us On:</h5></li>

    	<li>
    	<a target="_blank" href="https://www.facebook.com/"><i class="fab  fa-facebook-f"></i></a>
    </li>
    	<li>
    	<a target="_blank" href="https://www.twitter.com/"><i class="fab  fa-twitter"></i></a>
    </li>
    	<li>
    	<a target="_blank" href="https://www.linkedin.com/"><i class="fab  fa-linkedin-in"></i></a>
    </li>
    	<li>
    	<a target="_blank" href="https://www.skype.com/"><i class="fab  fa-skype"></i></a>
    </li>


                        </ul>
                                    </div>
            </div>
        </div>

    </footer>
    <!-- main-footer end -->


    <!--Scroll to top-->
    <div class="scroll-to-top">
        <svg class="scroll-top-inner" viewBox="-1 -1 102 102">
            <path d="M50,1 a49,49 0 0,1 0,98 a49,49 0 0,1 0,-98" />
        </svg>
    </div>

    <!-- page-direction -->
    <div class="page_direction">
        <div class="demo-rtl direction_switch"><button class="rtl">RTL</button></div>
        <div class="demo-ltr direction_switch"><button class="ltr">LTR</button></div>
    </div>
    <!-- page-direction end -->


    <!-- demo-switch -->
    <div class="demo-switch">
        <div class="demo-dark-bg demo_switch"><button><i class="fas fa-sun"></i></button></div>
        <div class="demo-light-bg demo_switch"><button><i class="fas fa-moon"></i></button></div>
    </div>
    <!-- demo-switch end -->

</div>

<script type="speculationrules">
{"prefetch":[{"source":"document","where":{"and":[{"href_matches":"/newwp/fortradex/*"},{"not":{"href_matches":["/newwp/fortradex/wp-*.php","/newwp/fortradex/wp-admin/*","/newwp/fortradex/wp-content/uploads/*","/newwp/fortradex/wp-content/*","/newwp/fortradex/wp-content/plugins/*","/newwp/fortradex/wp-content/themes/fortradex/*","/newwp/fortradex/*\\?(.+)"]}},{"not":{"selector_matches":"a[rel~=\"nofollow\"]"}},{"not":{"selector_matches":".no-prefetch, .no-prefetch a"}}]},"eagerness":"conservative"}]}
</script>

    		<script>
    			( () => {
    				const lazyloadRunObserver = () => {
    					const lazyloadBackgrounds = document.querySelectorAll( `.e-con.e-parent:not(.e-lazyloaded)` );
    					const lazyloadBackgroundObserver = new IntersectionObserver( ( entries ) => {
    						entries.forEach( ( entry ) => {
    							if ( entry.isIntersecting ) {
    								let lazyloadBackground = entry.target;
    								if( lazyloadBackground ) {
    									lazyloadBackground.classList.add( 'e-lazyloaded' );
    								}
    								lazyloadBackgroundObserver.unobserve( entry.target );
    							}
    						});
    					}, { rootMargin: '200px 0px 200px 0px' } );
    					lazyloadBackgrounds.forEach( ( lazyloadBackground ) => {
    						lazyloadBackgroundObserver.observe( lazyloadBackground );
    					} );
    				};
    				const events = [
    					'DOMContentLoaded',
    					'elementor/lazyload/observe',
    				];
    				events.forEach( ( event ) => {
    					document.addEventListener( event, lazyloadRunObserver );
    				} );
    			} )();
    		</script>
    			<script type='text/javascript'>
    	(function () {
    		var c = document.body.className;
    		c = c.replace(/woocommerce-no-js/, 'woocommerce-js');
    		document.body.className = c;
    	})();
    </script>
    <link rel='stylesheet' id='wc-blocks-style-css' href='https://july.finestwp.com/newwp/fortradex/wp-content/plugins/woocommerce/assets/client/blocks/wc-blocks.css?ver=wc-11.0.1' media='all' />

<script id="wp-hooks-js" src="https://july.finestwp.com/newwp/fortradex/wp-includes/js/dist/hooks.min.js?ver=f0f188028580e8dc1255"></script>
<script id="wp-i18n-js" src="https://july.finestwp.com/newwp/fortradex/wp-includes/js/dist/i18n.min.js?ver=1dfe7db3940c23ea9216"></script>
<script id="wp-i18n-js-after">
wp.i18n.setLocaleData( { 'text direction\u0004ltr': [ 'ltr' ] } );
//# sourceURL=wp-i18n-js-after
</script>
<script id="swv-js" src="https://july.finestwp.com/newwp/fortradex/wp-content/plugins/contact-form-7/includes/swv/js/index.js?ver=6.1.7"></script>
<script id="contact-form-7-js-before">
var wpcf7 = {
    "api": {
        "root": "https:\/\/july.finestwp.com\/newwp\/fortradex\/wp-json\/",
        "namespace": "contact-form-7\/v1"
    }
};
//# sourceURL=contact-form-7-js-before
</script>
<script id="contact-form-7-js" src="https://july.finestwp.com/newwp/fortradex/wp-content/plugins/contact-form-7/includes/js/index.js?ver=6.1.7"></script>
<script id="react-js" src="https://july.finestwp.com/newwp/fortradex/wp-includes/js/dist/vendor/react.min.js?ver=18.3.1.1"></script>
<script id="react-dom-js" src="https://july.finestwp.com/newwp/fortradex/wp-includes/js/dist/vendor/react-dom.min.js?ver=18.3.1.1"></script>
<script id="wp-escape-html-js" src="https://july.finestwp.com/newwp/fortradex/wp-includes/js/dist/escape-html.min.js?ver=87ebe53e97bba59805a5"></script>
<script id="wp-element-js" src="https://july.finestwp.com/newwp/fortradex/wp-includes/js/dist/element.min.js?ver=4a4370b2b349066fd440"></script>
<script id="tutor-script-js-extra">
var _tutorobject = {"ajaxurl":"https://july.finestwp.com/newwp/fortradex/wp-admin/admin-ajax.php","home_url":"https://july.finestwp.com/newwp/fortradex","site_url":"https://july.finestwp.com/newwp/fortradex","site_title":"Fortradex","base_path":"/newwp/fortradex/","tutor_url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/","tutor_pro_url":null,"nonce_key":"_tutor_nonce","_tutor_nonce":"91e585bd72","loading_icon_url":"https://july.finestwp.com/newwp/fortradex/wp-admin/images/wpspin_light.gif","placeholder_img_src":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/placeholder.svg","enable_lesson_classic_editor":"","tutor_frontend_dashboard_url":"https://july.finestwp.com/newwp/fortradex/dashboard/","is_dashboard_page":"","wp_date_format":"MMMM d, yyyy","start_of_week":"1","is_admin":"","is_admin_bar_showing":"","addons_data":[{"name":"Course Bundle","description":"Group multiple courses to sell together.","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/course-bundle/thumbnail.svg","base_name":"course-bundle","is_enabled":0},{"name":"Subscription","description":"Manage subscription","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/subscription/thumbnail.png","base_name":"subscription","is_enabled":0},{"name":"Content Bank","description":"Create content once and use it across multiple courses.","is_new":true,"url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/content-bank/thumbnail.png","base_name":"content-bank","is_enabled":0},{"name":"Social Login","description":"Let users register & login through social networks.","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/social-login/thumbnail.svg","base_name":"social-login","is_enabled":0},{"name":"Content Drip","description":"Unlock lessons by schedule or when students meet a specific condition.","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/content-drip/thumbnail.png","base_name":"content-drip","is_enabled":0},{"name":"Tutor Multi Instructors","description":"Collaborate and add multiple instructors to a course.","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/tutor-multi-instructors/thumbnail.png","base_name":"tutor-multi-instructors","is_enabled":0},{"name":"Tutor Assignments","description":"Assess student learning with assignments.","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/tutor-assignments/thumbnail.png","base_name":"tutor-assignments","is_enabled":0},{"name":"Tutor Course Preview","description":"Offer free previews of specific lessons before enrollment.","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/tutor-course-preview/thumbnail.png","base_name":"tutor-course-preview","is_enabled":0},{"name":"Tutor Course Attachments","description":"Add unlimited attachments/ private files to any Tutor course","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/tutor-course-attachments/thumbnail.png","base_name":"tutor-course-attachments","is_enabled":0},{"name":"Tutor Google Meet Integration","description":"Host live classes with Google Meet, directly from your lesson page.","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/google-meet/thumbnail.png","base_name":"google-meet","is_enabled":0},{"name":"Tutor Report","description":"Check your course performance through Tutor Report stats.","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/tutor-report/thumbnail.png","base_name":"tutor-report","is_enabled":0},{"name":"Email","description":"Send automated and customized emails for various Tutor events.","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/tutor-email/thumbnail.png","base_name":"tutor-email","is_enabled":0},{"name":"Calendar","description":"Enable to let students view all your course events in one place.","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/calendar/thumbnail.png","base_name":"calendar","is_enabled":0},{"name":"Notifications","description":"Keep students and instructors notified of course events on their dashboard.","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/tutor-notifications/thumbnail.png","base_name":"tutor-notifications","is_enabled":0},{"name":"Google Classroom Integration","description":"Enable to integrate Tutor LMS with Google Classroom.","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/google-classroom/thumbnail.png","base_name":"google-classroom","is_enabled":0},{"name":"Tutor Zoom Integration","description":"Connect Tutor LMS with Zoom to host live online classes.","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/tutor-zoom/thumbnail.png","base_name":"tutor-zoom","is_enabled":0},{"name":"Quiz Export/Import","description":"Save time by exporting/importing quiz data with easy options.","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/quiz-import-export/thumbnail.png","base_name":"quiz-import-export","is_enabled":0},{"name":"Enrollment","description":"Enable to manually enroll students in your courses.","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/enrollments/thumbnail.png","base_name":"enrollments","is_enabled":0},{"name":"Tutor Certificate","description":"Enable to award certificates upon course completion.","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/tutor-certificate/thumbnail.png","base_name":"tutor-certificate","is_enabled":0},{"name":"Gradebook","description":"Track student progress with a centralized gradebook.","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/gradebook/thumbnail.png","base_name":"gradebook","is_enabled":0},{"name":"Tutor Prerequisites","description":"Set course prerequisites to guide learning paths effectively.","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/tutor-prerequisites/thumbnail.png","base_name":"tutor-prerequisites","is_enabled":0},{"name":"BuddyPress","description":"Boost engagement with social features through BuddyPress for Tutor LMS.","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/buddypress/thumbnail.png","base_name":"buddypress","is_enabled":0},{"name":"WooCommerce Subscriptions","description":"Capture Residual Revenue with Recurring Payments.","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/wc-subscriptions/thumbnail.png","base_name":"wc-subscriptions","is_enabled":0},{"name":"Paid Memberships Pro","description":"Boost revenue by selling course memberships.","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/pmpro/thumbnail.png","base_name":"pmpro","is_enabled":0},{"name":"Restrict Content Pro","description":"Enable to manage content access through Restrict Content Pro. ","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/restrict-content-pro/thumbnail.png","base_name":"restrict-content-pro","is_enabled":0},{"name":"Weglot","description":"Translate & manage multilingual courses for global reach.","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/tutor-weglot/thumbnail.png","base_name":"tutor-weglot","is_enabled":0},{"name":"WPML","description":"Create multilingual courses, lessons, dashboard and more.","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/tutor-wpml/thumbnail.png","base_name":"tutor-wpml","is_enabled":0},{"name":"H5P","description":"Integrate H5P to add interactivity and engagement to your courses.","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/h5p/thumbnail.png","base_name":"h5p","is_enabled":0}],"current_user":[],"content_change_event":"tutor_content_changed_event","is_tutor_course_edit":"","current_page":"","quiz_answer_display_time":"2000","is_ssl":"1","course_list_page_url":"https://july.finestwp.com/newwp/fortradex/wp-admin/admin.php?page=tutor","course_post_type":"courses","tutor_currency":{"symbol":"$","currency":false,"position":"left","thousand_separator":",","decimal_separator":".","no_of_decimal":"2"},"local":"en_US","settings":{"monetize_by":"free"},"max_upload_size":"33554432","monetize_by":"free","kids_icons_registry":[],"is_kids_mode":"","user_preferences":[],"is_legacy_learning_mode":"","course_slug":"courses","lesson_slug":"lesson","quiz_slug":"quizzes","is_tour_completed":"","legal_consent_display_places":["student_registration","login","checkout"]};
//# sourceURL=tutor-script-js-extra
</script>
<script id="tutor-script-js" src="https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/js/tutor.js?ver=4.0.7"></script>
<script id="jquery-ui-core-js-before">
jQuery.uiBackCompat = true;
//# sourceURL=jquery-ui-core-js-before
</script>
<script id="jquery-ui-core-js" src="https://july.finestwp.com/newwp/fortradex/wp-includes/js/jquery/ui/core.min.js?ver=1.14.2"></script>
<script id="jquery-ui-mouse-js" src="https://july.finestwp.com/newwp/fortradex/wp-includes/js/jquery/ui/mouse.min.js?ver=1.14.2"></script>
<script id="jquery-ui-sortable-js" src="https://july.finestwp.com/newwp/fortradex/wp-includes/js/jquery/ui/sortable.min.js?ver=1.14.2"></script>
<script id="jquery-touch-punch-js" src="https://july.finestwp.com/newwp/fortradex/wp-includes/js/jquery/jquery.ui.touch-punch.js?ver=0.2.2"></script>
<script id="tutor-social-share-js" src="https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/lib/SocialShare/SocialShare.min.js?ver=4.0.7"></script>
<script id="moment-js" src="https://july.finestwp.com/newwp/fortradex/wp-includes/js/dist/vendor/moment.min.js?ver=2.30.1"></script>
<script id="moment-js-after">
moment.updateLocale( 'en_US', {"months":["January","February","March","April","May","June","July","August","September","October","November","December"],"monthsShort":["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],"weekdays":["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],"weekdaysShort":["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],"week":{"dow":1},"longDateFormat":{"LT":"g:i a","LTS":null,"L":null,"LL":"F j, Y","LLL":"F j, Y g:i a","LLLL":null}} );
//# sourceURL=moment-js-after
</script>
<script id="wp-deprecated-js" src="https://july.finestwp.com/newwp/fortradex/wp-includes/js/dist/deprecated.min.js?ver=fe587bac92b7d0ef760e"></script>
<script id="wp-date-js" src="https://july.finestwp.com/newwp/fortradex/wp-includes/js/dist/date.min.js?ver=8173fc0fc12b7bb7eaf0"></script>
<script id="wp-date-js-after">
wp.date.setSettings( {"l10n":{"locale":"en_US","months":["January","February","March","April","May","June","July","August","September","October","November","December"],"monthsShort":["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],"weekdays":["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],"weekdaysShort":["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],"meridiem":{"am":"am","pm":"pm","AM":"AM","PM":"PM"},"relative":{"future":"%s from now","past":"%s ago","s":"a second","ss":"%d seconds","m":"a minute","mm":"%d minutes","h":"an hour","hh":"%d hours","d":"a day","dd":"%d days","M":"a month","MM":"%d months","y":"a year","yy":"%d years"},"startOfWeek":1},"formats":{"time":"g:i a","date":"F j, Y","datetime":"F j, Y g:i a","datetimeAbbreviated":"M j, Y g:i a"},"timezone":{"offset":0,"offsetFormatted":"0","string":"","abbr":""}} );
//# sourceURL=wp-date-js-after
</script>
<script id="tutor-frontend-js-extra">
var _tutorobject = {"ajaxurl":"https://july.finestwp.com/newwp/fortradex/wp-admin/admin-ajax.php","home_url":"https://july.finestwp.com/newwp/fortradex","site_url":"https://july.finestwp.com/newwp/fortradex","site_title":"Fortradex","base_path":"/newwp/fortradex/","tutor_url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/","tutor_pro_url":null,"nonce_key":"_tutor_nonce","_tutor_nonce":"91e585bd72","loading_icon_url":"https://july.finestwp.com/newwp/fortradex/wp-admin/images/wpspin_light.gif","placeholder_img_src":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/placeholder.svg","enable_lesson_classic_editor":"","tutor_frontend_dashboard_url":"https://july.finestwp.com/newwp/fortradex/dashboard/","is_dashboard_page":"","wp_date_format":"MMMM d, yyyy","start_of_week":"1","is_admin":"","is_admin_bar_showing":"","addons_data":[{"name":"Course Bundle","description":"Group multiple courses to sell together.","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/course-bundle/thumbnail.svg","base_name":"course-bundle","is_enabled":0},{"name":"Subscription","description":"Manage subscription","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/subscription/thumbnail.png","base_name":"subscription","is_enabled":0},{"name":"Content Bank","description":"Create content once and use it across multiple courses.","is_new":true,"url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/content-bank/thumbnail.png","base_name":"content-bank","is_enabled":0},{"name":"Social Login","description":"Let users register & login through social networks.","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/social-login/thumbnail.svg","base_name":"social-login","is_enabled":0},{"name":"Content Drip","description":"Unlock lessons by schedule or when students meet a specific condition.","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/content-drip/thumbnail.png","base_name":"content-drip","is_enabled":0},{"name":"Tutor Multi Instructors","description":"Collaborate and add multiple instructors to a course.","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/tutor-multi-instructors/thumbnail.png","base_name":"tutor-multi-instructors","is_enabled":0},{"name":"Tutor Assignments","description":"Assess student learning with assignments.","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/tutor-assignments/thumbnail.png","base_name":"tutor-assignments","is_enabled":0},{"name":"Tutor Course Preview","description":"Offer free previews of specific lessons before enrollment.","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/tutor-course-preview/thumbnail.png","base_name":"tutor-course-preview","is_enabled":0},{"name":"Tutor Course Attachments","description":"Add unlimited attachments/ private files to any Tutor course","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/tutor-course-attachments/thumbnail.png","base_name":"tutor-course-attachments","is_enabled":0},{"name":"Tutor Google Meet Integration","description":"Host live classes with Google Meet, directly from your lesson page.","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/google-meet/thumbnail.png","base_name":"google-meet","is_enabled":0},{"name":"Tutor Report","description":"Check your course performance through Tutor Report stats.","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/tutor-report/thumbnail.png","base_name":"tutor-report","is_enabled":0},{"name":"Email","description":"Send automated and customized emails for various Tutor events.","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/tutor-email/thumbnail.png","base_name":"tutor-email","is_enabled":0},{"name":"Calendar","description":"Enable to let students view all your course events in one place.","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/calendar/thumbnail.png","base_name":"calendar","is_enabled":0},{"name":"Notifications","description":"Keep students and instructors notified of course events on their dashboard.","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/tutor-notifications/thumbnail.png","base_name":"tutor-notifications","is_enabled":0},{"name":"Google Classroom Integration","description":"Enable to integrate Tutor LMS with Google Classroom.","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/google-classroom/thumbnail.png","base_name":"google-classroom","is_enabled":0},{"name":"Tutor Zoom Integration","description":"Connect Tutor LMS with Zoom to host live online classes.","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/tutor-zoom/thumbnail.png","base_name":"tutor-zoom","is_enabled":0},{"name":"Quiz Export/Import","description":"Save time by exporting/importing quiz data with easy options.","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/quiz-import-export/thumbnail.png","base_name":"quiz-import-export","is_enabled":0},{"name":"Enrollment","description":"Enable to manually enroll students in your courses.","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/enrollments/thumbnail.png","base_name":"enrollments","is_enabled":0},{"name":"Tutor Certificate","description":"Enable to award certificates upon course completion.","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/tutor-certificate/thumbnail.png","base_name":"tutor-certificate","is_enabled":0},{"name":"Gradebook","description":"Track student progress with a centralized gradebook.","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/gradebook/thumbnail.png","base_name":"gradebook","is_enabled":0},{"name":"Tutor Prerequisites","description":"Set course prerequisites to guide learning paths effectively.","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/tutor-prerequisites/thumbnail.png","base_name":"tutor-prerequisites","is_enabled":0},{"name":"BuddyPress","description":"Boost engagement with social features through BuddyPress for Tutor LMS.","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/buddypress/thumbnail.png","base_name":"buddypress","is_enabled":0},{"name":"WooCommerce Subscriptions","description":"Capture Residual Revenue with Recurring Payments.","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/wc-subscriptions/thumbnail.png","base_name":"wc-subscriptions","is_enabled":0},{"name":"Paid Memberships Pro","description":"Boost revenue by selling course memberships.","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/pmpro/thumbnail.png","base_name":"pmpro","is_enabled":0},{"name":"Restrict Content Pro","description":"Enable to manage content access through Restrict Content Pro. ","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/restrict-content-pro/thumbnail.png","base_name":"restrict-content-pro","is_enabled":0},{"name":"Weglot","description":"Translate & manage multilingual courses for global reach.","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/tutor-weglot/thumbnail.png","base_name":"tutor-weglot","is_enabled":0},{"name":"WPML","description":"Create multilingual courses, lessons, dashboard and more.","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/tutor-wpml/thumbnail.png","base_name":"tutor-wpml","is_enabled":0},{"name":"H5P","description":"Integrate H5P to add interactivity and engagement to your courses.","url":"https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/images/addons/h5p/thumbnail.png","base_name":"h5p","is_enabled":0}],"current_user":[],"content_change_event":"tutor_content_changed_event","is_tutor_course_edit":"","current_page":"","quiz_answer_display_time":"2000","is_ssl":"1","course_list_page_url":"https://july.finestwp.com/newwp/fortradex/wp-admin/admin.php?page=tutor","course_post_type":"courses","tutor_currency":{"symbol":"$","currency":false,"position":"left","thousand_separator":",","decimal_separator":".","no_of_decimal":"2"},"local":"en_US","settings":{"monetize_by":"free"},"max_upload_size":"33554432","monetize_by":"free","kids_icons_registry":[],"is_kids_mode":"","user_preferences":[],"is_legacy_learning_mode":"","course_slug":"courses","lesson_slug":"lesson","quiz_slug":"quizzes","is_tour_completed":"","legal_consent_display_places":["student_registration","login","checkout"]};
//# sourceURL=tutor-frontend-js-extra
</script>
<script id="tutor-frontend-js" src="https://july.finestwp.com/newwp/fortradex/wp-content/plugins/tutor/assets/js/tutor-front.js?ver=4.0.7"></script>
<script id="bootstrap-js" src="https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/js/bootstrap.min.js?ver=2.1.2"></script>
<script id="fortradex-owl-js" src="https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/js/owl.js?ver=2.1.2"></script>
<script id="wow-js" src="https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/js/wow.js?ver=2.1.2"></script>
<script id="jquery-fancybox-js" src="https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/js/jquery.fancybox.js?ver=2.1.2"></script>
<script id="appear-js" src="https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/js/appear.js?ver=2.1.2"></script>
<script id="isotope-js" src="https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/js/isotope.js?ver=2.1.2"></script>
<script id="parallax-scroll-js" src="https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/js/parallax-scroll.js?ver=2.1.2"></script>
<script id="jquery-nice-select-js" src="https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/js/jquery.nice-select.min.js?ver=2.1.2"></script>
<script id="scrolltop-js" src="https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/js/scrolltop.min.js?ver=2.1.2"></script>
<script id="jquery-ui-js" src="https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/js/jquery-ui.js?ver=2.1.2"></script>
<script id="lenis-js" src="https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/js/lenis.min.js?ver=2.1.2"></script>
<script id="odometer-js" src="https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/js/odometer.js?ver=2.1.2"></script>
<script id="jquery-lettering-js" src="https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/js/jquery.lettering.min.js?ver=2.1.2"></script>
<script id="circletype-js" src="https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/js/jquery.circleType.js?ver=2.1.2"></script>
<script id="fortradex-main-script-js" src="https://july.finestwp.com/newwp/fortradex/wp-content/themes/fortradex/assets/js/script.js?ver=7.1"></script>
<script async data-wp-strategy="async" fetchpriority="low" id="comment-reply-js" src="https://july.finestwp.com/newwp/fortradex/wp-includes/js/comment-reply.min.js?ver=7.1"></script>
<script id="sourcebuster-js-js" src="https://july.finestwp.com/newwp/fortradex/wp-content/plugins/woocommerce/assets/js/sourcebuster/sourcebuster.min.js?ver=11.0.1"></script>
<script id="wc-order-attribution-js-extra">
var wc_order_attribution = {"params":{"lifetime":1.0e-5,"session":30,"base64":false,"ajaxurl":"https://july.finestwp.com/newwp/fortradex/wp-admin/admin-ajax.php","prefix":"wc_order_attribution_","allowTracking":true},"fields":{"source_type":"current.typ","referrer":"current_add.rf","utm_campaign":"current.cmp","utm_source":"current.src","utm_medium":"current.mdm","utm_content":"current.cnt","utm_id":"current.id","utm_term":"current.trm","utm_source_platform":"current.plt","utm_creative_format":"current.fmt","utm_marketing_tactic":"current.tct","session_entry":"current_add.ep","session_start_time":"current_add.fd","session_pages":"session.pgs","session_count":"udata.vst","user_agent":"udata.uag"}};
//# sourceURL=wc-order-attribution-js-extra
</script>
<script id="wc-order-attribution-js" src="https://july.finestwp.com/newwp/fortradex/wp-content/plugins/woocommerce/assets/js/frontend/order-attribution.min.js?ver=11.0.1"></script>
<script id="elementor-webpack-runtime-js" src="https://july.finestwp.com/newwp/fortradex/wp-content/plugins/elementor/assets/js/webpack.runtime.min.js?ver=4.2.4"></script>
<script id="elementor-frontend-modules-js" src="https://july.finestwp.com/newwp/fortradex/wp-content/plugins/elementor/assets/js/frontend-modules.min.js?ver=4.2.4"></script>
<script id="elementor-frontend-js-before">
var elementorFrontendConfig = {"environmentMode":{"edit":false,"wpPreview":false,"isScriptDebug":false},"i18n":{"shareOnFacebook":"Share on Facebook","shareOnX":"Share on X","pinIt":"Pin it","download":"Download","downloadImage":"Download image","fullscreen":"Fullscreen","zoom":"Zoom","share":"Share","playVideo":"Play Video","previous":"Previous","next":"Next","close":"Close","a11yCarouselPrevSlideMessage":"Previous slide","a11yCarouselNextSlideMessage":"Next slide","a11yCarouselFirstSlideMessage":"This is the first slide","a11yCarouselLastSlideMessage":"This is the last slide","a11yCarouselPaginationBulletMessage":"Go to slide"},"is_rtl":false,"breakpoints":{"xs":0,"sm":480,"md":768,"lg":1025,"xl":1440,"xxl":1600},"responsive":{"breakpoints":{"mobile":{"label":"Mobile Portrait","value":767,"default_value":767,"direction":"max","is_enabled":true},"mobile_extra":{"label":"Mobile Landscape","value":880,"default_value":880,"direction":"max","is_enabled":false},"tablet":{"label":"Tablet Portrait","value":1024,"default_value":1024,"direction":"max","is_enabled":true},"tablet_extra":{"label":"Tablet Landscape","value":1200,"default_value":1200,"direction":"max","is_enabled":true},"laptop":{"label":"Laptop","value":1366,"default_value":1366,"direction":"max","is_enabled":false},"widescreen":{"label":"Widescreen","value":2400,"default_value":2400,"direction":"min","is_enabled":false}},"hasCustomBreakpoints":true},"version":"4.2.4","is_static":false,"experimentalFeatures":{"e_font_icon_svg":true,"additional_custom_breakpoints":true,"container":true,"e_panel_promotions":true,"nested-elements":true,"global_classes_should_enforce_capabilities":true,"e_variables":true,"e_opt_in_v4_page":true,"e_components":true,"e_interactions":true,"e_widget_creation":true,"import-export-customization":true},"urls":{"assets":"https:\/\/july.finestwp.com\/newwp\/fortradex\/wp-content\/plugins\/elementor\/assets\/","ajaxurl":"https:\/\/july.finestwp.com\/newwp\/fortradex\/wp-admin\/admin-ajax.php","uploadUrl":"https:\/\/july.finestwp.com\/newwp\/fortradex\/wp-content\/uploads"},"nonces":{"floatingButtonsClickTracking":"b63dd1a65b","atomicFormsSendForm":"b8177b6b88"},"swiperClass":"swiper","settings":{"page":[],"editorPreferences":[]},"kit":{"active_breakpoints":["viewport_mobile","viewport_tablet","viewport_tablet_extra"],"global_image_lightbox":"yes","lightbox_enable_counter":"yes","lightbox_enable_fullscreen":"yes","lightbox_enable_zoom":"yes","lightbox_enable_share":"yes","lightbox_title_src":"title","lightbox_description_src":"description"},"post":{"id":1809,"title":"Blog%20Grid%20%E2%80%93%20Fortradex","excerpt":"","featuredImage":false}};
//# sourceURL=elementor-frontend-js-before
</script>
<script id="elementor-frontend-js" src="https://july.finestwp.com/newwp/fortradex/wp-content/plugins/elementor/assets/js/frontend.min.js?ver=4.2.4"></script>
<script id="wp-emoji-settings" type="application/json">
{"baseUrl":"https://s.w.org/images/core/emoji/17.0.2/72x72/","ext":".png","svgUrl":"https://s.w.org/images/core/emoji/17.0.2/svg/","svgExt":".svg","source":{"concatemoji":"https://july.finestwp.com/newwp/fortradex/wp-includes/js/wp-emoji-release.min.js?ver=7.1"}}
</script>
<script type="module">
/*! This file is auto-generated */
var e="script#wp-emoji-settings",t=document.querySelector(e);if(!(t instanceof HTMLScriptElement))throw new Error("Element missing: "+e);const r=JSON.parse(t.text),s=(window._wpemojiSettings=r,"wpEmojiSettingsSupports"),o=["flag","emoji"];function i(e){try{var t={supportTests:e,timestamp:(new Date).valueOf()};sessionStorage.setItem(s,JSON.stringify(t))}catch(e){}}function c(e,t,n){e.clearRect(0,0,e.canvas.width,e.canvas.height),e.fillText(t,0,0);t=new Uint32Array(e.getImageData(0,0,e.canvas.width,e.canvas.height).data);e.clearRect(0,0,e.canvas.width,e.canvas.height),e.fillText(n,0,0);const r=new Uint32Array(e.getImageData(0,0,e.canvas.width,e.canvas.height).data);return t.every((e,t)=>e===r[t])}function p(e,t){e.clearRect(0,0,e.canvas.width,e.canvas.height),e.fillText(t,0,0);var n=e.getImageData(16,16,1,1);for(let e=0;e<n.data.length;e++)if(0!==n.data[e])return!1;return!0}function u(e,t,n,r){switch(t){case"flag":return n(e,"\ud83c\udff3\ufe0f\u200d\u26a7\ufe0f","\ud83c\udff3\ufe0f\u200b\u26a7\ufe0f")?!1:!n(e,"\ud83c\udde8\ud83c\uddf6","\ud83c\udde8\u200b\ud83c\uddf6")&&!n(e,"\ud83c\udff4\udb40\udc67\udb40\udc62\udb40\udc65\udb40\udc6e\udb40\udc67\udb40\udc7f","\ud83c\udff4\u200b\udb40\udc67\u200b\udb40\udc62\u200b\udb40\udc65\u200b\udb40\udc6e\u200b\udb40\udc67\u200b\udb40\udc7f");case"emoji":return!r(e,"\ud83e\u1fac8")}return!1}function f(e,t,n,r){let a;const s=(a="undefined"!=typeof WorkerGlobalScope&&self instanceof WorkerGlobalScope?new OffscreenCanvas(300,150):document.createElement("canvas")).getContext("2d",{willReadFrequently:!0}),o=(s.textBaseline="top",s.font="600 32px Arial",{});return e.forEach(e=>{o[e]=t(s,e,n,r)}),o}function a(e){var t=document.createElement("script");t.src=e,t.defer=!0,document.head.appendChild(t)}r.supports={everything:!0,everythingExceptFlag:!0},new Promise(t=>{let n=function(){try{var e=JSON.parse(sessionStorage.getItem(s));if("object"==typeof e&&"number"==typeof e.timestamp&&(new Date).valueOf()<e.timestamp+604800&&"object"==typeof e.supportTests)return e.supportTests}catch(e){}return null}();if(!n){if("undefined"!=typeof Worker&&"undefined"!=typeof OffscreenCanvas&&"undefined"!=typeof URL&&URL.createObjectURL&&"undefined"!=typeof Blob)try{var e="postMessage("+f.toString()+"("+[JSON.stringify(o),u.toString(),c.toString(),p.toString()].join(",")+"));",r=new Blob([e],{type:"text/javascript"});const a=new Worker(URL.createObjectURL(r),{name:"wpTestEmojiSupports"});return void(a.onmessage=e=>{i(n=e.data),a.terminate(),t(n)})}catch(e){}i(n=f(o,u,c,p))}t(n)}).then(e=>{for(const n in e)r.supports[n]=e[n],r.supports.everything=r.supports.everything&&r.supports[n],"flag"!==n&&(r.supports.everythingExceptFlag=r.supports.everythingExceptFlag&&r.supports[n]);var t;r.supports.everythingExceptFlag=r.supports.everythingExceptFlag&&!r.supports.flag,r.supports.everything||((t=r.source||{}).concatemoji?a(t.concatemoji):t.wpemoji&&t.twemoji&&(a(t.twemoji),a(t.wpemoji)))});
//# sourceURL=https://july.finestwp.com/newwp/fortradex/wp-includes/js/wp-emoji-loader.min.js
</script>
</body>
</html>

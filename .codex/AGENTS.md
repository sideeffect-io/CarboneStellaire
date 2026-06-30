# Carbone Stellaire Agent Guide

This repository contains the Carbone Stellaire static Astro website and a
local-only admin app. Treat `Website/src` as the only source of truth for public
site content, catalog data, logo, carousel images, and product images.

The old root-level bridge is obsolete. Do not recreate or rely on
`carbonestellaire.md`, `Products/`, `Carrousel/`, root `Logo.png`,
`Website/src/data/*.generated.json`, `Website/public/content/**`,
`sync-content`, or `validate:catalog`.

## Read Order

Start with these files before making changes:

1. `HOWTO.md` for manual maintenance, admin usage, and publishing commands.
2. `Website/README.md` for the Astro project overview.
3. `Website/docs/publishing-new-knife.md` for product creation details.
4. `Website/src/lib/catalog.ts` before changing content loading, image
   resolution, prices, products, categories, or carousel behavior.
5. `Website/src/lib/i18n.ts` before changing UI labels, route helpers, locale
   behavior, or price formatting.
6. `Admin/README.md`, `Admin/src/server.mjs`, and
   `Admin/src/content-store.mjs` before changing the admin app or write paths.
7. `Website/scripts/validate-content.mjs` before changing content schema rules.

Use `rg` / `rg --files` for exploration. In zsh, quote Astro route paths that
contain brackets, for example:

```bash
sed -n '1,220p' 'Website/src/pages/couteaux/[handle].astro'
```

## Project Shape

- `Website/` is the Astro project.
- `Admin/` is a local-only Node admin app that edits `Website/src` directly.
- `Website/src/content/site.json` stores global site copy and
  `settings.showPrices`.
- `Website/src/content/catalog/categories.json` stores category metadata,
  handle suggestion prefixes, fallback status, and localized range copy.
- `Website/src/content/products/<handle>.json` stores one product's localized
  title/description, shared price, explicit category id, and image order.
- `Website/src/content/carousel.json` stores carousel order and localized alt
  text.
- `Website/src/assets/logo.png` is the logo and favicon source.
- `Website/src/assets/carousel/` stores carousel images.
- `Website/src/assets/products/<handle>/` stores product images.
- `Website/dist/` is generated output. Do not edit it.

## Commands

Install dependencies from the repository root:

```bash
npm --prefix Website install
npm --prefix Admin install
```

Run the public website:

```bash
npm --prefix Website run dev
```

Validate editable content:

```bash
npm --prefix Website run validate:content
```

Build and preview the public site:

```bash
npm --prefix Website run build
npm --prefix Website run preview:local
```

Run the local admin:

```bash
npm --prefix Admin start
```

Open `http://127.0.0.1:4317/`. Use `ADMIN_PORT=<port>` if the default admin
port is busy, and `ADMIN_PREVIEW_PORT=<port>` to change the preview port used
by the admin deploy tab.

Primary validation for code or content changes:

```bash
npm --prefix Admin test
npm --prefix Website run validate:content
npm --prefix Website run build
git diff --check
```

For documentation-only changes, run a focused whitespace check. Remember that
new untracked files are not covered by plain `git diff --check`; use
`git diff --no-index --check /dev/null <file>` for untracked docs.

## Content Contract

All localized editable content must include both `fr` and `en` values before it
is saved. French and English product/category content are strict requirements,
not optional enhancement fields.

Supported Markdown in content strings is intentionally small:

- paragraphs
- bullet lists beginning with `- `
- `**bold**`
- inline code
- Markdown links

Avoid raw HTML in JSON content.

### Site

`Website/src/content/site.json` contains:

- `settings.showPrices`: boolean public price visibility.
- `sections.fr`: French home page sections.
- `sections.en`: English home page sections.

Keep section ids stable unless the page code is intentionally changed.

### Categories

`Website/src/content/catalog/categories.json` contains category objects with:

- `id`: route id for `/gammes/<id>/` and `/en/ranges/<id>/`.
- `prefix`: admin handle suggestion prefix only.
- `name`: display name.
- `short.fr` and `short.en`: category card summaries.
- `detail.fr` and `detail.en`: long range stories.
- `fallback`: exactly one category must be `true`.

Products use explicit `categoryId`; category assignment is not inferred from
handle prefixes anymore. If a category is added manually, assign at least one
product to it before finishing, because validation fails empty categories.

### Products

Each product has:

```text
Website/src/content/products/<handle>.json
Website/src/assets/products/<handle>/
```

The JSON shape is:

```json
{
  "handle": "le-sciotot-example",
  "categoryId": "le-sciotot",
  "price": "000.00 EUR TTC",
  "title": {
    "fr": "French title",
    "en": "English title"
  },
  "description": {
    "fr": "French Markdown description.",
    "en": "English Markdown description."
  },
  "images": ["image-001.jpg", "image-002.jpg"]
}
```

Rules:

- The JSON filename must be `<handle>.json`.
- Handles are public ids; keep them stable after creation unless redirects are
  handled separately.
- `categoryId` must match an existing category id.
- `images` controls gallery order; the first image is the card/product lead.
- Every referenced image must exist in
  `Website/src/assets/products/<handle>/`.
- Image names must be plain filenames, not paths.
- Prices and images are shared between locales.

### Carousel And Logo

`Website/src/content/carousel.json` controls carousel order and alt text. Every
referenced file must exist in `Website/src/assets/carousel/`, with both
`alt.fr` and `alt.en`.

Replace `Website/src/assets/logo.png` to change the logo and favicon source,
then build so Astro regenerates asset URLs.

## Admin Contract

The admin is local-only and unauthenticated. It binds to `127.0.0.1`; do not
proxy it publicly or expose it as part of the Astro site.

The admin writes only allowlisted paths under `Website/src/content` and
`Website/src/assets`. It never writes `Website/dist/`.

Admin tabs:

- `Contenu`: edit localized site sections and toggle price visibility.
- `Gammes`: create/edit categories and localized range copy.
- `Couteaux`: create/edit products, upload product images, and reorder image
  filenames.
- `Deploiement`: run `validate:content`, `build`, then `preview:local`.

Current admin limitations:

- Existing product handles are read-only in the UI.
- Carousel and logo are maintained manually, not through admin controls.
- New products must upload every image listed in the image order field.

## Website Implementation Notes

- The site is static Astro with TypeScript strict mode and the `@/*` alias
  mapped to `Website/src/*`.
- French routes are rooted at `/`; English routes live under `/en/`.
- Product routes are `Website/src/pages/couteaux/[handle].astro` and
  `Website/src/pages/en/knives/[handle].astro`.
- Range routes are `Website/src/pages/gammes/[category].astro` and
  `Website/src/pages/en/ranges/[category].astro`.
- `Website/src/lib/catalog.ts` imports JSON directly from `Website/src/content`
  and asset URLs directly from `Website/src/assets` using eager
  `import.meta.glob`.
- `Website/src/lib/i18n.ts` owns UI labels, path helpers, SEO fallbacks, and
  locale-specific formatting.
- `Website/src/styles/global.css` owns global styling. The current visual
  system is dark, industrial, image-led, cyan/orange accented, and uses tight
  radii. Avoid introducing a second design language for isolated changes.
- Contact pages use static Netlify Forms. Preserve the generated form structure
  when changing `Website/src/pages/contact/index.astro` or
  `Website/src/pages/en/contact/index.astro`.

## Publishing

Netlify target:

```text
Base directory: Website
Build command: npm run build
Publish directory: dist
Node version: 22
```

After deployment, verify `/`, `/en/`, one category page in each locale, one
product page in each locale, `/contact/`, and `/en/contact/`.

## Working Safely

- Check `git status --short` before editing. User changes may already be
  present; do not revert them unless explicitly asked.
- Keep edits scoped. This repo contains many content and image files, so broad
  rewrites create noisy diffs quickly.
- Prefer source-level changes in `Website/src/content` or `Website/src/assets`
  over generated output changes.
- Do not restore the old sync pipeline unless the user explicitly asks for a
  rollback.
- Before finishing, report which validation command was run. If validation is
  skipped for a docs-only change, say so.

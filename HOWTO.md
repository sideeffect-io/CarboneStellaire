# Carbone Stellaire Website HOWTO

The public website is a static Astro site in `Website/`. The source of truth is
now entirely inside `Website/src`.

Do not recreate or edit the old root-level source bridge. These are obsolete:
`carbonestellaire.md`, `Products/`, `Carrousel/`, root `Logo.png`, generated
catalog JSON, and `Website/public/content/`.

## Requirements

- Node.js `>=22.12.0`
- npm

Install dependencies when needed:

```bash
npm --prefix Website install
npm --prefix Admin install
```

## Website Commands

Run the public website in development:

```bash
npm --prefix Website run dev
```

Validate all editable content:

```bash
npm --prefix Website run validate:content
```

Build the static site:

```bash
npm --prefix Website run build
```

Preview the last build locally:

```bash
npm --prefix Website run preview:local
```

`npm run build` already runs `validate:content` first.

## Manual Maintenance

Editable content lives under `Website/src/content/`. Editable binary assets live
under `Website/src/assets/`.

Never edit `Website/dist/`; it is generated output.

### Site Copy

Edit:

```text
Website/src/content/site.json
```

This file contains:

- `settings.showPrices`: boolean price visibility for the public site.
- `sections.fr`: French home page sections.
- `sections.en`: English home page sections.

Each section has:

```json
{
  "id": "section-id",
  "title": "Visible title",
  "body": "Markdown body"
}
```

Keep section ids stable unless the page code is intentionally changed. The
French and English section lists should stay equivalent in meaning.

### Categories

Edit:

```text
Website/src/content/catalog/categories.json
```

Each category has:

- `id`: public route id for `/gammes/<id>/` and `/en/ranges/<id>/`.
- `prefix`: handle suggestion prefix used by the admin only.
- `name`: display name.
- `short.fr` and `short.en`: short category card text.
- `detail.fr` and `detail.en`: long range story.
- `fallback`: exactly one category must be `true`.

Products use explicit `categoryId`; category assignment is not inferred from the
handle prefix anymore.

If you create a category manually, also create or move at least one product to
that `categoryId`. Validation fails when a category has no products.

### Products

Each knife has one JSON file and one asset folder:

```text
Website/src/content/products/<handle>.json
Website/src/assets/products/<handle>/
```

Product JSON shape:

```json
{
  "handle": "le-sciotot-example",
  "categoryId": "le-sciotot",
  "price": "000.00 EUR TTC",
  "title": {
    "fr": "Titre francais",
    "en": "English title"
  },
  "description": {
    "fr": "Description francaise en Markdown.",
    "en": "English Markdown description."
  },
  "images": ["image-001.jpg", "image-002.jpg"]
}
```

Rules:

- The filename must be `<handle>.json`.
- The `handle` is public and should stay stable after creation.
- `categoryId` must match an existing category id.
- `title.fr`, `title.en`, `description.fr`, and `description.en` are required.
- `images` controls gallery order.
- Every image listed in `images` must exist in
  `Website/src/assets/products/<handle>/`.
- Image filenames must be plain filenames, not paths.

To create a product manually:

1. Create `Website/src/content/products/<handle>.json`.
2. Create `Website/src/assets/products/<handle>/`.
3. Add product images to that folder.
4. List the image filenames in the JSON in display order.
5. Run `npm --prefix Website run validate:content`.

To reorder product images, reorder the `images` array only.

To remove a product, remove its JSON file and asset folder, then validate. Be
careful: removing or renaming a handle removes the existing public URL unless a
redirect is added separately.

### Carousel

Edit:

```text
Website/src/content/carousel.json
Website/src/assets/carousel/
```

Each carousel entry has:

```json
{
  "filename": "image.jpg",
  "alt": {
    "fr": "Texte alternatif francais",
    "en": "English alt text"
  }
}
```

`carousel.json` controls order. Every referenced file must exist in
`Website/src/assets/carousel/`, and both alt texts are required.

### Logo

Replace this file to change the site logo and favicon source:

```text
Website/src/assets/logo.png
```

Run a build after replacing it so Astro can regenerate optimized asset URLs.

### UI Labels And Routes

Edit UI strings and route helpers in:

```text
Website/src/lib/i18n.ts
```

Content JSON is for editable site/catalog content. Navigation labels, form
labels, SEO fallbacks, and route helpers stay in TypeScript.

### Markdown Support

Content strings support a deliberately small Markdown subset:

- paragraphs
- bullet lists beginning with `- `
- `**bold**`
- inline code
- Markdown links

Avoid raw HTML in JSON content.

## Validation Checklist

After manual edits, run:

```bash
npm --prefix Website run validate:content
npm --prefix Website run build
```

Then preview:

```bash
npm --prefix Website run preview:local
```

Check at least:

- `/`
- `/en/`
- `/gammes/<category>/`
- `/en/ranges/<category>/`
- `/couteaux/<handle>/`
- `/en/knives/<handle>/`
- `/contact/`
- `/en/contact/`

## Local Admin

The local admin app lives in `Admin/`. It edits the same source files under
`Website/src/content` and `Website/src/assets`.

Start it with:

```bash
npm --prefix Admin start
```

Open:

```text
http://127.0.0.1:4317/
```

The admin is local-only and unauthenticated. It binds to `127.0.0.1`; do not
proxy it publicly.

To use another admin port:

```bash
ADMIN_PORT=4319 npm --prefix Admin start
```

### Admin Tabs

- `Contenu`: edit site sections in French and English, and toggle price
  visibility.
- `Gammes`: create or edit categories, including bilingual short text and long
  range story.
- `Couteaux`: create or edit knives, upload product images, and reorder the
  published image list.
- `Deploiement`: run the local validation/build/preview pipeline and inspect
  logs.

The admin does not currently expose carousel or logo editing controls. Maintain
those manually in `Website/src/content/carousel.json`,
`Website/src/assets/carousel/`, and `Website/src/assets/logo.png`.

### Admin Product Rules

- Existing product handles are read-only in the admin.
- New product handles are suggested from the selected category prefix and French
  title.
- New products must upload every image listed in the image order field.
- Existing products can add uploads and reorder the image list.
- Prices and images are shared by both locales.
- French and English titles/descriptions are required.

### Admin Local Deploy

The `Deploiement` tab runs:

```text
npm run validate:content
npm run build
npm run preview:local -- --port <preview-port>
```

The default preview URL is:

```text
http://127.0.0.1:4322/
```

To use another preview port:

```bash
ADMIN_PREVIEW_PORT=4330 npm --prefix Admin start
```

Stop the admin with `Ctrl-C`. Stopping the admin also stops the preview process
it started.

## Publishing

Netlify target:

```text
Base directory: Website
Build command: npm run build
Publish directory: dist
Node version: 22
```

Before publishing, run the validation checklist and inspect representative pages
in both locales.

## Troubleshooting

- Missing image: check the filename in JSON exactly matches the file in
  `Website/src/assets`.
- Unknown category: update the product `categoryId` or add the category.
- Empty category: assign at least one product to that category.
- Duplicate handle: each product JSON must have a unique `handle`.
- Admin port already in use: start with `ADMIN_PORT=<port>`.
- Preview port already in use: start the admin with `ADMIN_PREVIEW_PORT=<port>`.

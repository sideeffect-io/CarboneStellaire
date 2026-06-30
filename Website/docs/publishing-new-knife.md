# Publishing A New Knife

The website source of truth lives inside `Website/src`. Product handles remain
stable public ids and generate these routes:

- French: `/couteaux/<handle>/`
- English: `/en/knives/<handle>/`

## 1. Create Product Content

Create:

```text
Website/src/content/products/<handle>.json
```

Use lowercase ASCII letters, numbers, and hyphens for `<handle>`.

```json
{
  "handle": "<handle>",
  "categoryId": "le-sciotot",
  "price": "000.00 EUR TTC",
  "title": {
    "fr": "Titre français",
    "en": "English title"
  },
  "description": {
    "fr": "Description française.",
    "en": "English description."
  },
  "images": ["image-001.jpg", "image-002.jpg"]
}
```

`categoryId` must match an id in `Website/src/content/catalog/categories.json`.
Category `prefix` values are only used by the admin to suggest new handles.

## 2. Add Product Images

Place source images in:

```text
Website/src/assets/products/<handle>/
```

The filenames must match the `images` list in the product JSON. The first image
is the catalog thumbnail and product hero image.

## 3. Validate Locally

From `Website/`:

```bash
npm run validate:content
npm run build
```

## 4. Related Content

- Price visibility: `Website/src/content/site.json`, `settings.showPrices`.
- Category copy and range stories:
  `Website/src/content/catalog/categories.json`.
- Carousel order and alt text: `Website/src/content/carousel.json`.
- Carousel images: `Website/src/assets/carousel/`.
- Logo: `Website/src/assets/logo.png`.

## 5. Preview

From `Website/`:

```bash
npm run preview
```

Check:

- the French category page,
- the English category page,
- the French product page,
- the English product page,
- the contact CTA with the product name prefilled.

## 6. Deploy On Netlify

In Netlify, configure the site with:

```text
Base directory: Website
Build command: npm run build
Publish directory: dist
```

Netlify Forms will detect the generated contact forms during the build. After
deployment, submit one test message from `/contact/` and one from `/en/contact/`.

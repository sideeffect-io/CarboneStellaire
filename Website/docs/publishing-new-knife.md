# Publishing A New Knife

This guide keeps the catalog strict: the French product file and images remain the source of truth, and the website build fails if the English translation is missing.

## 1. Create The Product Folder

Create a new folder under `Products/` at the repository root:

```text
Products/<category-prefix>-<short-product-name>/
```

Use one of these prefixes:

```text
le-sciotot-
edge-of-space-
cyber-edge-
```

Products that do not use one of those prefixes are published under `SciFi Legends`.

The folder name is the product handle. Use lowercase ASCII letters, numbers, and hyphens only.

## 2. Add Images

Place product images in the folder and name them in display order:

```text
image-001.jpg
image-002.jpg
image-003.jpg
image-004.png
```

Use `.jpg` for photos and `.png` for dimension diagrams or transparent images. The first image becomes the catalog thumbnail and product hero image.

## 3. Add The French Product File

Create `Products/<handle>/index.md` using this shape:

```md
# Product title

Handle: `<handle>`
Price: 000.00 EUR TTC

## Description

French product description.

## Images

1. `image-001.jpg`
2. `image-002.jpg`
3. `image-003.jpg`
```

The `Handle` value must exactly match the folder name.

## 4. Add The English Translation

Create:

```text
Website/src/content/i18n/products/<handle>.en.md
```

Use this shape:

```md
---
title: "English product title"
---

English product description.
```

Do not copy the French description into the English page. If a translation is missing, `npm run sync-content` and `npm run build` fail intentionally.

## 5. Validate Locally

From the `Website/` folder, run:

```bash
npm run sync-content
npm run validate:catalog
npm run build
```

The sync step copies and optimizes product images into `Website/public/content/` and regenerates typed catalog data.

## 6. Toggle Price Display

The public site reads the global price display setting from the `# Prix` section in `carbonestellaire.md`:

```md
# Prix

true
```

Use `true` to show prices on product cards and product pages. Use `false` to hide prices everywhere on the generated site while keeping the source prices in each `Products/<handle>/index.md`.

After changing the value, run:

```bash
npm run sync-content
npm run build
```

## 7. Preview

From the `Website/` folder:

```bash
npm run preview
```

Check:

- the French category page,
- the English category page,
- the French product page,
- the English product page,
- the contact CTA with the product name prefilled.

## 8. Deploy On Netlify

In Netlify, configure the site with:

```text
Base directory: Website
Build command: npm run build
Publish directory: dist
Node version: 20
```

Netlify Forms will detect the generated contact forms during the build. After deployment, submit one test message from `/contact/` and one from `/en/contact/`.

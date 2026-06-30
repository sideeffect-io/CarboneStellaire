# Carbone Stellaire Website

Bilingual Astro static site for Carbone Stellaire, designed for Netlify.

## Commands

```bash
npm install
npm run dev
npm run validate:content
npm run build
npm run preview
```

## Content

The Astro app is the source of truth:

- site copy and price visibility: `src/content/site.json`
- categories and range stories: `src/content/catalog/categories.json`
- products: `src/content/products/*.json`
- carousel order and alt text: `src/content/carousel.json`
- logo and images: `src/assets/`

The local admin writes those same files directly. See
`docs/publishing-new-knife.md` before adding a new catalog item manually.

# Carbone Stellaire Local Admin

Local-only editing app for the Carbone Stellaire source files.

## Commands

```bash
npm --prefix Admin start
npm --prefix Admin test
```

The server binds to `127.0.0.1:4317` by default. Set `ADMIN_PORT` to use another
admin port, and `ADMIN_PREVIEW_PORT` to change the local Astro preview port.

## Edited Sources

- `Website/src/content/site.json`
- `Website/src/content/catalog/categories.json`
- `Website/src/content/products/<handle>.json`
- `Website/src/content/carousel.json`
- `Website/src/assets/products/<handle>/image-*`
- `Website/src/assets/carousel/*`
- `Website/src/assets/logo.png`

The admin never writes generated website output under `Website/dist/`.

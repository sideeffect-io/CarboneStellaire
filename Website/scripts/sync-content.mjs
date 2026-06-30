import { copyFile, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(siteRoot, "..");
const productsRoot = path.join(repoRoot, "Products");
const carouselRoot = path.join(repoRoot, "Carrousel");
const publicRoot = path.join(siteRoot, "public", "content");
const dataRoot = path.join(siteRoot, "src", "data");
const productTranslationsRoot = path.join(siteRoot, "src", "content", "i18n", "products");

const categories = [
  {
    id: "le-sciotot",
    prefix: "le-sciotot",
    name: "Le Sciotot",
    fr: "Couteaux compacts inspirés par la plage de Sciotot.",
    en: "Compact knives inspired by Sciotot beach."
  },
  {
    id: "edge-of-space",
    prefix: "edge-of-space",
    name: "Edge Of Space",
    fr: "Lignes élégantes, aciers feuilletés et matériaux expressifs.",
    en: "Elegant lines, laminated steel, and expressive materials."
  },
  {
    id: "cyber-edge",
    prefix: "cyber-edge",
    name: "Cyber Edge",
    fr: "Une gamme radicale aux détails résine, inserts et cybernétique.",
    en: "A radical range with resin, inserts, and cybernetic details."
  },
  {
    id: "scifi-legends",
    prefix: "",
    name: "SciFi Legends",
    fr: "Pièces de collection forgées autour d'icônes de science-fiction.",
    en: "Collector pieces forged around science-fiction icons."
  }
];

const carouselFiles = [
  "IMG_1060.jpg",
  "IMG_1328.jpg",
  "IMG_2346.jpg",
  "IMG_2888.jpg",
  "IMG_2911.jpg",
  "IMG_3071.jpg",
  "IMG_3238.jpg",
  "IMG_3246.jpg",
  "copie-0_IMG_9464.jpg",
  "copie-0_IMG_9505.jpg"
];

function categoryFor(handle) {
  const category = categories.find((candidate) => candidate.prefix && handle.startsWith(candidate.prefix));
  return category?.id ?? "scifi-legends";
}

function slugifyHeading(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function inlineMarkdown(value) {
  let html = escapeHtml(value);
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
  return html;
}

function markdownToHtml(raw) {
  const blocks = raw
    .trim()
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  return blocks
    .map((block) => {
      if (block.startsWith("- ")) {
        const items = block
          .split("\n")
          .map((line) => line.replace(/^-\s*/, "").trim())
          .filter(Boolean)
          .map((line) => `<li>${inlineMarkdown(line)}</li>`)
          .join("");
        return `<ul>${items}</ul>`;
      }
      return `<p>${inlineMarkdown(block).replace(/\n/g, "<br>")}</p>`;
    })
    .join("\n");
}

function parseSections(raw) {
  const sections = [];
  const matches = [...raw.matchAll(/^#\s+(.+)$/gm)];
  for (let index = 0; index < matches.length; index += 1) {
    const current = matches[index];
    const next = matches[index + 1];
    const title = current[1].trim();
    const start = current.index + current[0].length;
    const end = next?.index ?? raw.length;
    const body = raw.slice(start, end).trim();
    sections.push({
      id: slugifyHeading(title),
      title,
      body,
      html: markdownToHtml(body)
    });
  }
  return sections;
}

function parseShowPrices(sections) {
  const section = sections.find((candidate) => candidate.id === "prix");
  if (!section) return true;
  const value = section.body.trim().toLowerCase();
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error('The "Prix" section in carbonestellaire.md must contain exactly "true" or "false".');
}

function categoryDetailFromSite(site, locale, category) {
  const section = site[locale].find((candidate) => candidate.id === category.id);
  if (section) {
    return {
      body: section.body,
      html: section.html
    };
  }
  const fallback = category[locale];
  return {
    body: fallback,
    html: markdownToHtml(fallback)
  };
}

function categoriesWithDetails(site) {
  return categories.map((category) => ({
    ...category,
    detail: {
      fr: categoryDetailFromSite(site, "fr", category),
      en: categoryDetailFromSite(site, "en", category)
    }
  }));
}

function parseFrontmatter(raw) {
  if (!raw.startsWith("---")) return { data: {}, body: raw.trim() };
  const end = raw.indexOf("\n---", 3);
  if (end === -1) return { data: {}, body: raw.trim() };
  const frontmatter = raw.slice(3, end).trim();
  const body = raw.slice(end + 4).trim();
  const data = {};
  for (const line of frontmatter.split("\n")) {
    const [key, ...rest] = line.split(":");
    if (!key || rest.length === 0) continue;
    let value = rest.join(":").trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    data[key.trim()] = value;
  }
  return { data, body };
}

function parseProductMarkdown(raw, folder) {
  const title = raw.match(/^#\s+(.+)$/m)?.[1]?.trim();
  const handle = raw.match(/^Handle:\s*`([^`]+)`/m)?.[1]?.trim();
  const price = raw.match(/^Price:\s*(.+)$/m)?.[1]?.trim();
  const description = raw.match(/## Description\s*\n([\s\S]*?)\n## Images/m)?.[1]?.trim();
  const imageSection = raw.match(/## Images\s*\n([\s\S]*)$/m)?.[1] ?? "";
  const images = [...imageSection.matchAll(/^\d+\.\s*`([^`]+)`/gm)].map((match) => match[1]);

  if (!title || !handle || !price || !description || images.length === 0) {
    throw new Error(`${folder}/index.md is missing title, handle, price, description, or image list.`);
  }
  if (handle !== folder) {
    throw new Error(`${folder}/index.md handle "${handle}" does not match its folder name.`);
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(handle)) {
    throw new Error(`${folder}/index.md has an invalid handle "${handle}".`);
  }

  return { title, handle, price, description, images };
}

async function optimizeImage(sourcePath, destinationPath) {
  await mkdir(path.dirname(destinationPath), { recursive: true });
  const [sourceInfo, destinationInfo] = await Promise.all([
    stat(sourcePath),
    stat(destinationPath).catch(() => null)
  ]);
  if (destinationInfo && destinationInfo.mtimeMs >= sourceInfo.mtimeMs) {
    return;
  }

  const extension = path.extname(destinationPath).toLowerCase();
  const image = sharp(sourcePath, { failOn: "none" }).rotate();
  const metadata = await image.metadata();
  const shouldResize = Math.max(metadata.width ?? 0, metadata.height ?? 0) > 1800;
  const resized = shouldResize ? image.resize({ width: 1800, height: 1800, fit: "inside", withoutEnlargement: true }) : image;

  if (extension === ".jpg" || extension === ".jpeg") {
    await resized.jpeg({ quality: 82, mozjpeg: true }).toFile(destinationPath);
    return;
  }
  if (extension === ".png") {
    await resized.png({ compressionLevel: 9 }).toFile(destinationPath);
    return;
  }
  await copyFile(sourcePath, destinationPath);
}

async function fileExists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function syncSiteContent() {
  const frRaw = await readFile(path.join(repoRoot, "carbonestellaire.md"), "utf8");
  const enRaw = await readFile(path.join(siteRoot, "src", "content", "i18n", "site.en.md"), "utf8");
  const frSections = parseSections(frRaw);
  const site = {
    fr: frSections.filter((section) => section.id !== "prix"),
    en: parseSections(enRaw),
    settings: {
      showPrices: parseShowPrices(frSections)
    }
  };
  await writeFile(path.join(dataRoot, "site.generated.json"), `${JSON.stringify(site, null, 2)}\n`, "utf8");
  return site;
}

async function syncCarousel() {
  const entries = [];
  for (const filename of carouselFiles) {
    const sourcePath = path.join(carouselRoot, filename);
    if (!(await fileExists(sourcePath))) {
      throw new Error(`Missing carousel image: ${filename}`);
    }
    const destinationPath = path.join(publicRoot, "carousel", filename);
    await optimizeImage(sourcePath, destinationPath);
    entries.push({
      filename,
      src: `/content/carousel/${filename}`,
      alt: {
        fr: "Détail d'atelier et de forge Carbone Stellaire",
        en: "Carbone Stellaire workshop and forging detail"
      }
    });
  }
  await writeFile(path.join(dataRoot, "carousel.generated.json"), `${JSON.stringify(entries, null, 2)}\n`, "utf8");
  return entries;
}

async function syncProducts(site) {
  const folders = (await readdir(productsRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  const fr = [];
  const en = [];
  const missingTranslations = [];

  for (const folder of folders) {
    const raw = await readFile(path.join(productsRoot, folder, "index.md"), "utf8");
    const product = parseProductMarkdown(raw, folder);
    const category = categoryFor(product.handle);
    const productImages = [];

    for (const imageName of product.images) {
      const sourcePath = path.join(productsRoot, folder, imageName);
      if (!(await fileExists(sourcePath))) {
        throw new Error(`Missing image referenced by ${folder}/index.md: ${imageName}`);
      }
      const destinationPath = path.join(publicRoot, "products", product.handle, imageName);
      await optimizeImage(sourcePath, destinationPath);
      productImages.push({
        filename: imageName,
        src: `/content/products/${product.handle}/${imageName}`,
        alt: product.title
      });
    }

    fr.push({
      locale: "fr",
      handle: product.handle,
      title: product.title,
      price: product.price,
      category,
      descriptionHtml: markdownToHtml(product.description),
      images: productImages
    });

    const translationPath = path.join(productTranslationsRoot, `${product.handle}.en.md`);
    if (!(await fileExists(translationPath))) {
      missingTranslations.push(path.relative(siteRoot, translationPath));
      continue;
    }
    const translation = parseFrontmatter(await readFile(translationPath, "utf8"));
    if (!translation.data.title || !translation.body.trim()) {
      throw new Error(`${path.relative(siteRoot, translationPath)} must contain frontmatter title and body text.`);
    }

    en.push({
      locale: "en",
      handle: product.handle,
      title: translation.data.title,
      price: product.price,
      category,
      descriptionHtml: markdownToHtml(translation.body),
      images: productImages.map((image) => ({ ...image, alt: translation.data.title }))
    });
  }

  if (missingTranslations.length > 0) {
    throw new Error(`Missing English product translations:\n${missingTranslations.map((item) => `- ${item}`).join("\n")}`);
  }

  const catalog = { settings: site.settings, categories: categoriesWithDetails(site), products: { fr, en } };
  await writeFile(path.join(dataRoot, "catalog.generated.json"), `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
  return catalog;
}

async function main() {
  await mkdir(dataRoot, { recursive: true });
  await mkdir(publicRoot, { recursive: true });
  const [site, carousel] = await Promise.all([syncSiteContent(), syncCarousel()]);
  const catalog = await syncProducts(site);
  console.log(
    `Synced ${catalog.products.fr.length} products, ${carousel.length} carousel images, and ${site.fr.length}/${site.en.length} site sections.`
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

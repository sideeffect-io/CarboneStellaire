import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contentRoot = path.join(siteRoot, "src", "content");
const assetsRoot = path.join(siteRoot, "src", "assets");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function assertFileExists(filePath) {
  try {
    const info = await stat(filePath);
    assert(info.isFile(), `Expected file: ${filePath}`);
  } catch {
    throw new Error(`Missing file: ${filePath}`);
  }
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function validSlug(value) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value ?? "");
}

function assertLocalizedText(value, label) {
  assert(typeof value?.fr === "string" && value.fr.trim(), `${label} is missing French text.`);
  assert(typeof value?.en === "string" && value.en.trim(), `${label} is missing English text.`);
}

async function main() {
  const site = await readJson(path.join(contentRoot, "site.json"));
  const categories = await readJson(path.join(contentRoot, "catalog", "categories.json"));
  const carousel = await readJson(path.join(contentRoot, "carousel.json"));
  const productFiles = (await readdir(path.join(contentRoot, "products")))
    .filter((filename) => filename.endsWith(".json"))
    .sort((a, b) => a.localeCompare(b));

  assert(typeof site.settings?.showPrices === "boolean", "site.settings.showPrices must be a boolean.");
  assert(Array.isArray(site.sections?.fr) && site.sections.fr.length >= 3, "site.sections.fr must contain homepage sections.");
  assert(Array.isArray(site.sections?.en) && site.sections.en.length >= 3, "site.sections.en must contain homepage sections.");
  for (const locale of ["fr", "en"]) {
    for (const section of site.sections[locale]) {
      assert(validSlug(section.id), `${locale} site section has invalid id: ${section.id}`);
      assert(section.title, `${locale} site section ${section.id} is missing a title.`);
      assert(section.body, `${locale} site section ${section.id} is missing a body.`);
    }
  }

  assert(Array.isArray(categories) && categories.length > 0, "categories.json must contain categories.");
  const categoryIds = new Set();
  const fallbackCategories = categories.filter((category) => category.fallback === true);
  assert(fallbackCategories.length === 1, "Exactly one category must be marked fallback.");
  for (const category of categories) {
    assert(validSlug(category.id), `Invalid category id: ${category.id}`);
    assert(!categoryIds.has(category.id), `Duplicate category id: ${category.id}`);
    categoryIds.add(category.id);
    assert(typeof category.prefix === "string", `${category.id} must define a prefix.`);
    assert(category.name, `${category.id} is missing a name.`);
    assertLocalizedText(category.short, `${category.id}.short`);
    assertLocalizedText(category.detail, `${category.id}.detail`);
  }

  assert(Array.isArray(carousel) && carousel.length > 0, "carousel.json must contain images.");
  for (const image of carousel) {
    assert(image.filename, "Carousel entry is missing filename.");
    assertLocalizedText(image.alt, `carousel ${image.filename} alt`);
    await assertFileExists(path.join(assetsRoot, "carousel", image.filename));
  }
  await assertFileExists(path.join(assetsRoot, "logo.png"));

  assert(productFiles.length > 0, "No product JSON files found.");
  const productHandles = new Set();
  const counts = Object.fromEntries([...categoryIds].map((id) => [id, 0]));
  let imageCount = 0;
  for (const filename of productFiles) {
    const product = await readJson(path.join(contentRoot, "products", filename));
    assert(validSlug(product.handle), `${filename} has invalid handle: ${product.handle}`);
    assert(filename === `${product.handle}.json`, `${filename} does not match product handle ${product.handle}.`);
    assert(!productHandles.has(product.handle), `Duplicate product handle: ${product.handle}`);
    productHandles.add(product.handle);
    assert(categoryIds.has(product.categoryId), `${product.handle} has unknown category ${product.categoryId}.`);
    assert(product.price, `${product.handle} is missing price.`);
    assertLocalizedText(product.title, `${product.handle}.title`);
    assertLocalizedText(product.description, `${product.handle}.description`);
    assert(Array.isArray(product.images) && product.images.length > 0, `${product.handle} must list images.`);
    assert(new Set(product.images).size === product.images.length, `${product.handle} contains duplicate images.`);
    counts[product.categoryId] += 1;
    imageCount += product.images.length;
    for (const image of product.images) {
      assert(!image.includes("/") && !image.includes("\\"), `${product.handle} has unsafe image filename: ${image}`);
      await assertFileExists(path.join(assetsRoot, "products", product.handle, image));
    }
  }

  for (const [categoryId, count] of Object.entries(counts)) {
    assert(count > 0, `Category ${categoryId} has no products.`);
  }

  console.log(`Content valid: ${productFiles.length} products, ${imageCount} product images, ${carousel.length} carousel images.`);
  console.log(Object.entries(counts).map(([category, count]) => `- ${category}: ${count}`).join("\n"));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

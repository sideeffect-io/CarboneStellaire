import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function assertFileExists(filePath) {
  try {
    await stat(filePath);
  } catch {
    throw new Error(`Missing generated asset: ${filePath}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const catalogPath = path.join(siteRoot, "src", "data", "catalog.generated.json");
  const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
  assert(typeof catalog.settings?.showPrices === "boolean", "Catalog setting showPrices must be a boolean.");
  const categoryIds = catalog.categories.map((category) => category.id);
  assert(categoryIds.length === 4, "Expected exactly four categories.");
  assert(categoryIds.includes("le-sciotot"), "Missing Le Sciotot category.");
  assert(categoryIds.includes("edge-of-space"), "Missing Edge Of Space category.");
  assert(categoryIds.includes("cyber-edge"), "Missing Cyber Edge category.");
  assert(categoryIds.includes("scifi-legends"), "Missing SciFi Legends category.");
  for (const category of catalog.categories) {
    assert(category.detail?.fr?.html, `${category.id} is missing a French range detail.`);
    assert(category.detail?.en?.html, `${category.id} is missing an English range detail.`);
  }

  const fr = catalog.products.fr;
  const en = catalog.products.en;
  assert(fr.length > 0, "French catalog is empty.");
  assert(fr.length === en.length, `French/English product count mismatch: ${fr.length} vs ${en.length}.`);

  const enHandles = new Set(en.map((product) => product.handle));
  for (const product of fr) {
    assert(enHandles.has(product.handle), `Missing English product for ${product.handle}.`);
    assert(categoryIds.includes(product.category), `${product.handle} has invalid category ${product.category}.`);
    assert(product.price, `${product.handle} has no price.`);
    assert(product.images.length > 0, `${product.handle} has no images.`);
    for (const image of product.images) {
      await assertFileExists(path.join(siteRoot, "public", image.src.replace(/^\//, "")));
    }
  }

  const counts = Object.fromEntries(categoryIds.map((category) => [category, 0]));
  for (const product of fr) counts[product.category] += 1;
  for (const [category, count] of Object.entries(counts)) {
    assert(count > 0, `Category ${category} has no products.`);
  }

  console.log(`Catalog valid: ${fr.length} products across ${categoryIds.length} categories.`);
  console.log(Object.entries(counts).map(([category, count]) => `- ${category}: ${count}`).join("\n"));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

import { mkdir, mkdtemp, readFile, readdir, rename, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const adminRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultRepoRoot = path.resolve(adminRoot, "..");

export function createStore(options = {}) {
  const repoRoot = path.resolve(options.repoRoot ?? defaultRepoRoot);
  const siteRoot = path.join(repoRoot, "Website");
  const contentRoot = path.join(siteRoot, "src", "content");
  const assetsRoot = path.join(siteRoot, "src", "assets");
  const sitePath = path.join(contentRoot, "site.json");
  const categoriesPath = path.join(contentRoot, "catalog", "categories.json");
  const productContentRoot = path.join(contentRoot, "products");
  const productAssetsRoot = path.join(assetsRoot, "products");

  return {
    repoRoot,
    siteRoot,
    contentRoot,
    assetsRoot,
    sitePath,
    categoriesPath,
    productContentRoot,
    productAssetsRoot,
    readState: () => readState({ sitePath, categoriesPath, productContentRoot, productAssetsRoot }),
    readSite: () => readSite(sitePath),
    saveSite: (input) => saveSite(sitePath, input),
    readCategories: () => readCategories(categoriesPath),
    createCategory: (input) => createCategory({ categoriesPath }, input),
    updateCategory: (id, input) => updateCategory({ categoriesPath }, id, input),
    createProduct: (input) => createProduct({ categoriesPath, productContentRoot, productAssetsRoot }, input),
    updateProduct: (handle, input) => updateProduct({ categoriesPath, productContentRoot, productAssetsRoot }, handle, input)
  };
}

export function slugify(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function isValidSlug(value) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value ?? "");
}

export function validateHandle(handle) {
  if (!isValidSlug(handle)) {
    throw new Error("Handle must contain lowercase ASCII letters, numbers, and hyphens only.");
  }
  return handle;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

function ensureInside(root, targetPath) {
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(targetPath);
  const relative = path.relative(resolvedRoot, resolvedTarget);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Unsafe path outside allowed root: ${targetPath}`);
  }
  return resolvedTarget;
}

export function safeProductPath(productAssetsRoot, handle, filename = "") {
  validateHandle(handle);
  if (filename && (filename.includes("/") || filename.includes("\\") || filename === "." || filename === "..")) {
    throw new Error(`Unsafe product filename: ${filename}`);
  }
  return ensureInside(path.join(productAssetsRoot, handle), path.join(productAssetsRoot, handle, filename));
}

function productJsonPath(productContentRoot, handle) {
  validateHandle(handle);
  return ensureInside(productContentRoot, path.join(productContentRoot, `${handle}.json`));
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeTextAtomic(filePath, content) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "carbone-admin-"));
  const tempPath = path.join(tempDir, path.basename(filePath));
  await writeFile(tempPath, content, "utf8");
  await rename(tempPath, filePath);
}

async function writeJsonAtomic(filePath, content) {
  await writeTextAtomic(filePath, `${JSON.stringify(content, null, 2)}\n`);
}

async function writeBufferAtomic(filePath, content) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "carbone-admin-"));
  const tempPath = path.join(tempDir, path.basename(filePath));
  await writeFile(tempPath, content);
  await rename(tempPath, filePath);
}

export function parseSections(raw) {
  const sections = [];
  const matches = [...String(raw).matchAll(/^#\s+(.+)$/gm)];
  for (let index = 0; index < matches.length; index += 1) {
    const current = matches[index];
    const next = matches[index + 1];
    const title = current[1].trim();
    const start = current.index + current[0].length;
    const end = next?.index ?? raw.length;
    sections.push({
      id: slugify(title),
      title,
      body: raw.slice(start, end).trim()
    });
  }
  return sections;
}

export function stringifySections(sections) {
  return `${sections
    .map((section) => `# ${section.title.trim()}\n\n${section.body.trim()}`)
    .join("\n\n")}\n`;
}

function validateLocalizedSections(sections, locale) {
  assert(Array.isArray(sections), `${locale} sections must be an array.`);
  return sections.map((section) => {
    const id = String(section.id ?? slugify(section.title ?? "")).trim();
    const title = String(section.title ?? "").trim();
    const body = String(section.body ?? "").trim();
    assert(isValidSlug(id), `${locale} section has invalid id: ${id}`);
    assert(title, `${locale} section title is required.`);
    assert(body, `${locale} section "${title}" body is required.`);
    return { id, title, body };
  });
}

export async function readSite(sitePath) {
  const site = await readJson(sitePath);
  assert(typeof site.settings?.showPrices === "boolean", "showPrices must be a boolean.");
  return {
    showPrices: site.settings.showPrices,
    sections: {
      fr: validateLocalizedSections(site.sections?.fr, "French"),
      en: validateLocalizedSections(site.sections?.en, "English")
    }
  };
}

export async function saveSite(sitePath, input) {
  assert(typeof input?.showPrices === "boolean", "showPrices must be a boolean.");
  const site = {
    settings: {
      showPrices: input.showPrices
    },
    sections: {
      fr: validateLocalizedSections(input?.sections?.fr, "French"),
      en: validateLocalizedSections(input?.sections?.en, "English")
    }
  };
  await writeJsonAtomic(sitePath, site);
  return readSite(sitePath);
}

function assertLocalizedText(value, label) {
  assert(typeof value?.fr === "string" && value.fr.trim(), `${label} French text is required.`);
  assert(typeof value?.en === "string" && value.en.trim(), `${label} English text is required.`);
}

export function validateCategories(categories) {
  assert(Array.isArray(categories), "Categories must be an array.");
  const ids = new Set();
  const prefixes = new Set();

  const normalized = categories.map((candidate) => {
    const category = normalizeCategory(candidate);
    assert(!ids.has(category.id), `Duplicate category id: ${category.id}`);
    ids.add(category.id);

    if (category.prefix) {
      assert(!prefixes.has(category.prefix), `Duplicate category prefix: ${category.prefix}`);
      prefixes.add(category.prefix);
    }
    return category;
  });

  assertOneFallback(normalized);
  return normalized;
}

function normalizeCategory(candidate) {
  const category = {
    id: String(candidate.id ?? "").trim(),
    prefix: String(candidate.prefix ?? "").trim(),
    name: String(candidate.name ?? "").trim(),
    short: {
      fr: String(candidate.short?.fr ?? "").trim(),
      en: String(candidate.short?.en ?? "").trim()
    },
    detail: {
      fr: String(candidate.detail?.fr ?? "").trim(),
      en: String(candidate.detail?.en ?? "").trim()
    },
    fallback: candidate.fallback === true
  };

  assert(isValidSlug(category.id), `Invalid category id: ${category.id}`);
  if (category.prefix) assert(isValidSlug(category.prefix), `Invalid category prefix for ${category.id}.`);
  assert(category.name, `${category.id} name is required.`);
  assertLocalizedText(category.short, `${category.id}.short`);
  assertLocalizedText(category.detail, `${category.id}.detail`);
  return category;
}

export function assertOneFallback(categories) {
  const fallbackCount = categories.filter((category) => category.fallback === true).length;
  assert(fallbackCount === 1, "Exactly one category must be marked as fallback.");
}

export async function readCategories(categoriesPath) {
  return validateCategories(await readJson(categoriesPath));
}

async function writeCategories(categoriesPath, categories) {
  const validated = validateCategories(categories);
  await writeJsonAtomic(categoriesPath, validated);
  return validated;
}

export function categoryFor(categories, product) {
  return categories.find((category) => category.id === product.categoryId);
}

function normalizeCategoryInput(input, forcedId) {
  const id = forcedId ?? String(input?.id ?? "").trim();
  return normalizeCategory({
    id,
    prefix: input?.prefix ?? "",
    name: input?.name ?? "",
    short: input?.short ?? {},
    detail: input?.detail ?? {},
    fallback: input?.fallback === true
  });
}

export async function createCategory(paths, input) {
  const categories = await readCategories(paths.categoriesPath);
  const category = normalizeCategoryInput(input);
  assert(!categories.some((candidate) => candidate.id === category.id), `Category already exists: ${category.id}`);
  assert(!category.fallback || !categories.some((candidate) => candidate.fallback), "A fallback category already exists.");
  const next = await writeCategories(paths.categoriesPath, [...categories, category]);
  return next.find((candidate) => candidate.id === category.id);
}

export async function updateCategory(paths, id, input) {
  assert(isValidSlug(id), "Invalid category id.");
  const categories = await readCategories(paths.categoriesPath);
  const index = categories.findIndex((candidate) => candidate.id === id);
  assert(index !== -1, `Unknown category: ${id}`);
  const category = normalizeCategoryInput(input, id);
  const next = categories.slice();
  next[index] = category;
  await writeCategories(paths.categoriesPath, next);
  return category;
}

export function parseProductMarkdown(raw, folder = "") {
  const title = raw.match(/^#\s+(.+)$/m)?.[1]?.trim();
  const handle = raw.match(/^Handle:\s*`([^`]+)`/m)?.[1]?.trim();
  const price = raw.match(/^Price:\s*(.+)$/m)?.[1]?.trim();
  const description = raw.match(/## Description\s*\n([\s\S]*?)\n## Images/m)?.[1]?.trim();
  const imageSection = raw.match(/## Images\s*\n([\s\S]*)$/m)?.[1] ?? "";
  const images = [...imageSection.matchAll(/^\d+\.\s*`([^`]+)`/gm)].map((match) => match[1]);

  assert(title, `${folder || "Product"} is missing a title.`);
  assert(handle, `${folder || "Product"} is missing a handle.`);
  assert(price, `${folder || "Product"} is missing a price.`);
  assert(description, `${folder || "Product"} is missing a French description.`);
  assert(images.length > 0, `${folder || "Product"} must reference at least one image.`);
  validateHandle(handle);
  if (folder) assert(handle === folder, `${folder}/index.md handle "${handle}" does not match its folder name.`);
  return { title, handle, price, description, images };
}

export function stringifyProductMarkdown(product) {
  const images = product.images.map((filename, index) => `${index + 1}. \`${filename}\``).join("\n");
  return `# ${product.title.fr.trim()}\n\nHandle: \`${product.handle}\`\nPrice: ${product.price.trim()}\n\n## Description\n\n${product.description.fr.trim()}\n\n## Images\n\n${images}\n`;
}

function validateImageFilename(filename) {
  assert(typeof filename === "string", "Image filename must be a string.");
  assert(!filename.includes("/") && !filename.includes("\\"), `Unsafe image filename: ${filename}`);
  assert(/^[A-Za-z0-9._-]+\.(jpe?g|png|webp)$/i.test(filename), `Unsupported image filename: ${filename}`);
  return filename;
}

function normalizeProductInput(input, forcedHandle) {
  const handle = validateHandle(forcedHandle ?? String(input?.handle ?? "").trim());
  const product = {
    handle,
    categoryId: String(input?.categoryId ?? "").trim(),
    price: String(input?.price ?? "").trim(),
    title: {
      fr: String(input?.title?.fr ?? "").trim(),
      en: String(input?.title?.en ?? "").trim()
    },
    description: {
      fr: String(input?.description?.fr ?? "").trim(),
      en: String(input?.description?.en ?? "").trim()
    },
    images: (input?.images ?? []).map(validateImageFilename),
    uploads: (input?.uploads ?? []).map((upload) => ({
      filename: validateImageFilename(upload.filename),
      dataBase64: String(upload.dataBase64 ?? "")
    }))
  };

  assert(isValidSlug(product.categoryId), "Product category is required.");
  assert(product.title.fr, "French product title is required.");
  assert(product.title.en, "English product title is required.");
  assert(product.price, "Product price is required.");
  assert(product.description.fr, "French product description is required.");
  assert(product.description.en, "English product description is required.");
  assert(product.images.length > 0, "At least one product image is required.");
  assert(new Set(product.images).size === product.images.length, "Product image list contains duplicates.");
  assert(new Set(product.uploads.map((upload) => upload.filename)).size === product.uploads.length, "Uploaded image filenames contain duplicates.");
  return product;
}

function decodeUpload(upload) {
  const cleaned = upload.dataBase64.includes(",") ? upload.dataBase64.split(",").pop() : upload.dataBase64;
  assert(cleaned, `${upload.filename} upload is empty.`);
  return Buffer.from(cleaned, "base64");
}

async function writeUploads(productAssetsRoot, handle, uploads) {
  for (const upload of uploads) {
    await writeBufferAtomic(safeProductPath(productAssetsRoot, handle, upload.filename), decodeUpload(upload));
  }
}

async function assertImagesExist(productAssetsRoot, handle, images) {
  for (const filename of images) {
    const filePath = safeProductPath(productAssetsRoot, handle, filename);
    assert(await exists(filePath), `Missing product image: ${filename}`);
  }
}

function productResponse(product, files) {
  return {
    handle: product.handle,
    title: product.title,
    price: product.price,
    category: product.categoryId,
    categoryId: product.categoryId,
    description: product.description,
    images: product.images,
    files
  };
}

export async function readProduct(paths, handle) {
  validateHandle(handle);
  const product = await readJson(productJsonPath(paths.productContentRoot, handle));
  const files = (await readdir(path.join(paths.productAssetsRoot, handle)).catch(() => []))
    .filter((filename) => /\.(jpe?g|png|webp)$/i.test(filename))
    .sort((a, b) => a.localeCompare(b));
  return productResponse(product, files);
}

export async function readProducts(paths) {
  const files = (await readdir(paths.productContentRoot))
    .filter((filename) => filename.endsWith(".json"))
    .sort((a, b) => a.localeCompare(b));
  return Promise.all(files.map((filename) => readProduct(paths, filename.replace(/\.json$/, ""))));
}

async function assertCategoryExists(categoriesPath, categoryId) {
  const categories = await readCategories(categoriesPath);
  assert(categories.some((category) => category.id === categoryId), `Unknown product category: ${categoryId}`);
}

function productJson(product) {
  return {
    handle: product.handle,
    categoryId: product.categoryId,
    price: product.price,
    title: product.title,
    description: product.description,
    images: product.images
  };
}

export async function createProduct(paths, input) {
  const product = normalizeProductInput(input);
  await assertCategoryExists(paths.categoriesPath, product.categoryId);
  const jsonPath = productJsonPath(paths.productContentRoot, product.handle);
  assert(!(await exists(jsonPath)), `Product already exists: ${product.handle}`);
  for (const filename of product.images) {
    assert(product.uploads.some((upload) => upload.filename === filename), `New product image must be uploaded: ${filename}`);
  }
  await writeUploads(paths.productAssetsRoot, product.handle, product.uploads);
  await assertImagesExist(paths.productAssetsRoot, product.handle, product.images);
  await writeJsonAtomic(jsonPath, productJson(product));
  return readProduct(paths, product.handle);
}

export async function updateProduct(paths, handle, input) {
  validateHandle(handle);
  const product = normalizeProductInput(input, handle);
  await assertCategoryExists(paths.categoriesPath, product.categoryId);
  const jsonPath = productJsonPath(paths.productContentRoot, handle);
  assert(await exists(jsonPath), `Unknown product: ${handle}`);
  await writeUploads(paths.productAssetsRoot, handle, product.uploads);
  await assertImagesExist(paths.productAssetsRoot, handle, product.images);
  await writeJsonAtomic(jsonPath, productJson(product));
  return readProduct(paths, handle);
}

async function readState(paths) {
  const [site, categories, products] = await Promise.all([
    readSite(paths.sitePath),
    readCategories(paths.categoriesPath),
    readProducts(paths)
  ]);
  return { site, categories, products };
}

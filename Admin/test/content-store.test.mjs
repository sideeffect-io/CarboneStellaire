import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  categoryFor,
  createStore,
  parseSections,
  safeProductPath,
  stringifySections,
  validateCategories,
  validateHandle
} from "../src/content-store.mjs";

async function fixture() {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), "carbone-admin-test-"));
  const siteRoot = path.join(repoRoot, "Website");
  await mkdir(path.join(siteRoot, "src", "content", "catalog"), { recursive: true });
  await mkdir(path.join(siteRoot, "src", "content", "products"), { recursive: true });
  await mkdir(path.join(siteRoot, "src", "assets", "products", "sample-knife"), { recursive: true });

  await writeFile(
    path.join(siteRoot, "src", "content", "site.json"),
    `${JSON.stringify(
      {
        settings: { showPrices: false },
        sections: {
          fr: [{ id: "carbone-stellaire", title: "Carbone Stellaire", body: "Texte FR." }],
          en: [{ id: "carbone-stellaire", title: "Carbone Stellaire", body: "Text EN." }]
        }
      },
      null,
      2
    )}\n`,
    "utf8"
  );
  await writeFile(
    path.join(siteRoot, "src", "content", "catalog", "categories.json"),
    `${JSON.stringify(
      [
        {
          id: "sample",
          prefix: "sample",
          name: "Sample",
          short: { fr: "Court FR", en: "Short EN" },
          detail: { fr: "Histoire FR", en: "Story EN" },
          fallback: false
        },
        {
          id: "fallback",
          prefix: "",
          name: "Fallback",
          short: { fr: "Fallback FR", en: "Fallback EN" },
          detail: { fr: "Fallback histoire", en: "Fallback story" },
          fallback: true
        }
      ],
      null,
      2
    )}\n`,
    "utf8"
  );
  await writeFile(path.join(siteRoot, "src", "assets", "products", "sample-knife", "image-001.jpg"), "jpg", "utf8");
  await writeFile(
    path.join(siteRoot, "src", "content", "products", "sample-knife.json"),
    `${JSON.stringify(
      {
        handle: "sample-knife",
        categoryId: "sample",
        price: "120.00 EUR TTC",
        title: { fr: "Couteau test", en: "Test knife" },
        description: { fr: "Description FR.", en: "Description EN." },
        images: ["image-001.jpg"]
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  return { repoRoot, siteRoot, store: createStore({ repoRoot }) };
}

test("site section parser and writer round trip headings and bodies", () => {
  const raw = "# A\n\nBody A.\n\n# B Title\n\n- one\n- two\n";
  const sections = parseSections(raw);
  assert.deepEqual(
    sections.map((section) => [section.id, section.title, section.body]),
    [
      ["a", "A", "Body A."],
      ["b-title", "B Title", "- one\n- two"]
    ]
  );
  assert.equal(stringifySections(sections), raw);
});

test("saveSite writes the new JSON source and preserves the price switch", async () => {
  const { siteRoot, store } = await fixture();
  const site = await store.saveSite({
    showPrices: true,
    sections: {
      fr: [{ id: "carbone-stellaire", title: "Carbone Stellaire", body: "Nouveau FR." }],
      en: [{ id: "carbone-stellaire", title: "Carbone Stellaire", body: "New EN." }]
    }
  });
  assert.equal(site.showPrices, true);
  assert.equal(site.sections.fr[0].body, "Nouveau FR.");
  const raw = JSON.parse(await readFile(path.join(siteRoot, "src", "content", "site.json"), "utf8"));
  assert.equal(raw.settings.showPrices, true);
});

test("category matching uses explicit product category ids", () => {
  const categories = validateCategories([
    { id: "edge", prefix: "edge", name: "Edge", short: { fr: "fr", en: "en" }, detail: { fr: "fr", en: "en" }, fallback: false },
    {
      id: "edge-of-space",
      prefix: "edge-of-space",
      name: "Edge Of Space",
      short: { fr: "fr", en: "en" },
      detail: { fr: "fr", en: "en" },
      fallback: false
    },
    { id: "fallback", prefix: "", name: "Fallback", short: { fr: "fr", en: "en" }, detail: { fr: "fr", en: "en" }, fallback: true }
  ]);
  assert.equal(categoryFor(categories, { categoryId: "edge" }).id, "edge");
  assert.equal(categoryFor(categories, { categoryId: "edge-of-space" }).id, "edge-of-space");
  assert.equal(categoryFor(categories, { categoryId: "missing" }), undefined);
});

test("category create and update require localized details", async () => {
  const { store } = await fixture();
  await assert.rejects(
    () =>
      store.createCategory({
        id: "new-range",
        prefix: "new-range",
        name: "New Range",
        short: { fr: "Court", en: "Short" },
        detail: { fr: "", en: "Story" },
        fallback: false
      }),
    /detail French/
  );
  const created = await store.createCategory({
    id: "new-range",
    prefix: "new-range",
    name: "New Range",
    short: { fr: "Court", en: "Short" },
    detail: { fr: "Histoire", en: "Story" },
    fallback: false
  });
  assert.equal(created.id, "new-range");
  const updated = await store.updateCategory("new-range", {
    prefix: "new-range",
    name: "New Range",
    short: { fr: "Court 2", en: "Short 2" },
    detail: { fr: "Histoire 2", en: "Story 2" },
    fallback: false
  });
  assert.equal(updated.detail.en, "Story 2");
});

test("validation rejects invalid handles and duplicate categories", () => {
  assert.throws(() => validateHandle("../bad"), /Handle/);
  assert.throws(
    () =>
      validateCategories([
        { id: "same", prefix: "a", name: "A", short: { fr: "fr", en: "en" }, detail: { fr: "fr", en: "en" }, fallback: true },
        { id: "same", prefix: "b", name: "B", short: { fr: "fr", en: "en" }, detail: { fr: "fr", en: "en" }, fallback: false }
      ]),
    /Duplicate category id/
  );
});

test("product writes reject unsafe paths and duplicate handles", async () => {
  const { siteRoot, store } = await fixture();
  const productAssetsRoot = path.join(siteRoot, "src", "assets", "products");
  assert.throws(() => safeProductPath(productAssetsRoot, "sample-knife", "../escape.jpg"), /Unsafe/);
  await assert.rejects(
    () =>
      store.createProduct({
        handle: "sample-knife",
        categoryId: "sample",
        title: { fr: "Titre", en: "Title" },
        price: "120.00 EUR TTC",
        description: { fr: "FR", en: "EN" },
        images: ["image-001.jpg"],
        uploads: [{ filename: "image-001.jpg", dataBase64: Buffer.from("jpg").toString("base64") }]
      }),
    /Product already exists/
  );
  await assert.rejects(
    () =>
      store.updateProduct("sample-knife", {
        categoryId: "sample",
        title: { fr: "Titre", en: "Title" },
        price: "120.00 EUR TTC",
        description: { fr: "FR", en: "EN" },
        images: ["../escape.jpg"],
        uploads: []
      }),
    /Unsafe image filename/
  );
});

test("product create and update write JSON and uploaded images inside Website/src", async () => {
  const { siteRoot, store } = await fixture();
  const created = await store.createProduct({
    handle: "sample-new",
    categoryId: "sample",
    title: { fr: "Nouveau", en: "New" },
    price: "150.00 EUR TTC",
    description: { fr: "Description FR", en: "Description EN" },
    images: ["image-001.jpg"],
    uploads: [{ filename: "image-001.jpg", dataBase64: Buffer.from("jpg").toString("base64") }]
  });
  assert.equal(created.categoryId, "sample");
  const jsonPath = path.join(siteRoot, "src", "content", "products", "sample-new.json");
  const raw = JSON.parse(await readFile(jsonPath, "utf8"));
  assert.equal(raw.title.en, "New");

  const updated = await store.updateProduct("sample-new", {
    categoryId: "fallback",
    title: { fr: "Nouveau 2", en: "New 2" },
    price: "160.00 EUR TTC",
    description: { fr: "Description FR 2", en: "Description EN 2" },
    images: ["image-001.jpg", "image-002.png"],
    uploads: [{ filename: "image-002.png", dataBase64: Buffer.from("png").toString("base64") }]
  });
  assert.deepEqual(updated.images, ["image-001.jpg", "image-002.png"]);
  assert.equal(updated.categoryId, "fallback");
});

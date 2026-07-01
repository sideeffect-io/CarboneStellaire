import carouselSource from "@/content/carousel.json";
import categoriesSource from "@/content/catalog/categories.json";
import siteSource from "@/content/site.json";
import type { Locale } from "./i18n";

export type CategoryId = string;

export interface SiteSection {
  id: string;
  title: string;
  body: string;
  html: string;
}

export interface CategoryDetail {
  body: string;
  html: string;
}

export interface Category {
  id: CategoryId;
  prefix: string;
  name: string;
  short: Record<Locale, string>;
  fr: string;
  en: string;
  fallback: boolean;
  detail: Record<Locale, CategoryDetail>;
}

export interface ProductImage {
  filename: string;
  src: string;
  alt: string;
}

export interface Product {
  locale: Locale;
  handle: string;
  title: string;
  price: string;
  category: CategoryId;
  descriptionHtml: string;
  images: ProductImage[];
}

export interface CatalogSettings {
  showPrices: boolean;
}

interface ProductSource {
  handle: string;
  categoryId: string;
  price: string;
  title: Record<Locale, string>;
  description: Record<Locale, string>;
  images: string[];
}

interface CarouselSource {
  filename: string;
  alt: Record<Locale, string>;
}

const productSources = import.meta.glob("../content/products/*.json", {
  eager: true,
  import: "default"
}) as Record<string, ProductSource>;

const productAssetSources = import.meta.glob("../assets/products/**/*.{jpg,jpeg,png,webp}", {
  eager: true,
  import: "default",
  query: "?url"
}) as Record<string, string>;

const carouselAssetSources = import.meta.glob("../assets/carousel/*.{jpg,jpeg,png,webp}", {
  eager: true,
  import: "default",
  query: "?url"
}) as Record<string, string>;

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function inlineMarkdown(value: string) {
  let html = escapeHtml(value);
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
  return html;
}

export function markdownToHtml(raw: string) {
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

function requireAsset(assets: Record<string, string>, key: string) {
  const asset = assets[key];
  if (!asset) throw new Error(`Missing content asset: ${key}`);
  return asset;
}

function productImageSrc(handle: string, filename: string) {
  return requireAsset(productAssetSources, `../assets/products/${handle}/${filename}`);
}

function carouselImageSrc(filename: string) {
  return requireAsset(carouselAssetSources, `../assets/carousel/${filename}`);
}

function productForLocale(source: ProductSource, locale: Locale): Product {
  const title = source.title[locale];
  return {
    locale,
    handle: source.handle,
    title,
    price: source.price,
    category: source.categoryId,
    descriptionHtml: markdownToHtml(source.description[locale]),
    images: source.images.map((filename) => ({
      filename,
      src: productImageSrc(source.handle, filename),
      alt: title
    }))
  };
}

export const siteContent = {
  fr: siteSource.sections.fr.map((section) => ({ ...section, html: markdownToHtml(section.body) })),
  en: siteSource.sections.en.map((section) => ({ ...section, html: markdownToHtml(section.body) }))
} satisfies Record<Locale, SiteSection[]>;

export const carouselImages = (carouselSource as CarouselSource[]).map((image) => ({
  filename: image.filename,
  src: carouselImageSrc(image.filename),
  alt: image.alt
}));

export const catalogSettings = siteSource.settings as CatalogSettings;

export const categories = categoriesSource.map((category) => ({
  ...category,
  fr: category.short.fr,
  en: category.short.en,
  detail: {
    fr: {
      body: category.detail.fr,
      html: markdownToHtml(category.detail.fr)
    },
    en: {
      body: category.detail.en,
      html: markdownToHtml(category.detail.en)
    }
  }
})) as Category[];

const productSourceList = Object.values(productSources).sort((a, b) => a.handle.localeCompare(b.handle));

export const productsByLocale = {
  fr: productSourceList.map((product) => productForLocale(product, "fr")),
  en: productSourceList.map((product) => productForLocale(product, "en"))
} satisfies Record<Locale, Product[]>;

export function getProducts(locale: Locale) {
  return productsByLocale[locale];
}

export function getCategory(categoryId: CategoryId) {
  const category = categories.find((candidate) => candidate.id === categoryId);
  if (!category) throw new Error(`Unknown category: ${categoryId}`);
  return category;
}

export function getProductsByCategory(locale: Locale, categoryId: CategoryId) {
  return getProducts(locale).filter((product) => product.category === categoryId);
}

export function getProduct(locale: Locale, handle: string) {
  const product = getProducts(locale).find((candidate) => candidate.handle === handle);
  if (!product) throw new Error(`Unknown product: ${handle} (${locale})`);
  return product;
}

export function getFeaturedProducts(locale: Locale) {
  return categories
    .map((category) => getProductsByCategory(locale, category.id)[0])
    .filter(Boolean)
    .slice(0, 4);
}

export function categoryDescription(category: Category, locale: Locale) {
  return category.short[locale];
}

export function categoryDetailHtml(category: Category, locale: Locale) {
  return category.detail?.[locale]?.html ?? "";
}

export function shouldShowPrices() {
  return catalogSettings.showPrices;
}

export function shouldShowProductPrice(product: Pick<Product, "price">) {
  return shouldShowPrices() && Boolean(product.price.trim());
}

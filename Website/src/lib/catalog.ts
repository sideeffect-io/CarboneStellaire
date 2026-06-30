import catalogData from "@/data/catalog.generated.json";
import type { Locale } from "./i18n";

export type CategoryId = "le-sciotot" | "edge-of-space" | "cyber-edge" | "scifi-legends";

export interface CategoryDetail {
  body: string;
  html: string;
}

export interface Category {
  id: CategoryId;
  prefix: string;
  name: string;
  fr: string;
  en: string;
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

export const categories = catalogData.categories as Category[];
export const productsByLocale = catalogData.products as Record<Locale, Product[]>;
export const catalogSettings = catalogData.settings as CatalogSettings;

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
  return locale === "fr" ? category.fr : category.en;
}

export function categoryDetailHtml(category: Category, locale: Locale) {
  return category.detail?.[locale]?.html ?? "";
}

export function shouldShowPrices() {
  return catalogSettings.showPrices;
}

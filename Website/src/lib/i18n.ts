export type Locale = "fr" | "en";

export const defaultLocale: Locale = "fr";
export const locales: Locale[] = ["fr", "en"];

export const ui = {
  fr: {
    localeName: "FR",
    alternateLocaleName: "EN",
    nav: {
      ranges: "Gammes",
      workshop: "Atelier",
      process: "Processus",
      contact: "Contact"
    },
    hero: {
      kicker: "Forge artisanale dans le nord Cotentin",
      headline: "Couteaux forgés à la main, entre acier brut et imaginaire stellaire.",
      primary: "Explorer les gammes",
      secondary: "Projet sur mesure"
    },
    sections: {
      ranges: "Les gammes",
      rangesIntro: "Quatre univers pour parcourir les pièces disponibles, des couteaux de table compacts aux créations de collection.",
      process: "Du feu à la main",
      workshop: "L'atelier",
      carousel: "Matière, feu, finition",
      selected: "Pièces sélectionnées",
      catalog: "Catalogue",
      rangeStory: "L'esprit de la gamme",
      contactCta: "Discuter d'un projet"
    },
    product: {
      details: "Détails",
      gallery: "Galerie",
      contact: "Demander cette pièce",
      backToRange: "Retour à la gamme",
      from: "Gamme"
    },
    contact: {
      title: "Contact",
      intro: "Pour une pièce disponible, une commande personnalisée ou une question d'entretien, envoyez-moi un message.",
      name: "Nom",
      email: "Email",
      interest: "Couteau ou projet",
      message: "Message",
      submit: "Envoyer",
      fallback: "Ou écrire directement à",
      thanksTitle: "Merci",
      thanksBody: "Votre message a bien été envoyé. Je vous répondrai dès que possible."
    }
  },
  en: {
    localeName: "EN",
    alternateLocaleName: "FR",
    nav: {
      ranges: "Ranges",
      workshop: "Workshop",
      process: "Process",
      contact: "Contact"
    },
    hero: {
      kicker: "Handmade forge in north Cotentin",
      headline: "Hand-forged knives shaped from raw steel and stellar imagination.",
      primary: "Explore ranges",
      secondary: "Custom project"
    },
    sections: {
      ranges: "Knife ranges",
      rangesIntro: "Four worlds to browse available pieces, from compact table knives to collector creations.",
      process: "From fire to hand",
      workshop: "The workshop",
      carousel: "Matter, fire, finish",
      selected: "Selected pieces",
      catalog: "Catalog",
      rangeStory: "Range story",
      contactCta: "Discuss a project"
    },
    product: {
      details: "Details",
      gallery: "Gallery",
      contact: "Ask about this piece",
      backToRange: "Back to range",
      from: "Range"
    },
    contact: {
      title: "Contact",
      intro: "For an available piece, a custom order, or care advice, send me a message.",
      name: "Name",
      email: "Email",
      interest: "Knife or project",
      message: "Message",
      submit: "Send",
      fallback: "Or write directly to",
      thanksTitle: "Thank you",
      thanksBody: "Your message has been sent. I will reply as soon as possible."
    }
  }
} as const;

export function homePath(locale: Locale) {
  return locale === "fr" ? "/" : "/en/";
}

export function categoryPath(locale: Locale, category: string) {
  return locale === "fr" ? `/gammes/${category}/` : `/en/ranges/${category}/`;
}

export function productPath(locale: Locale, handle: string) {
  return locale === "fr" ? `/couteaux/${handle}/` : `/en/knives/${handle}/`;
}

export function contactPath(locale: Locale) {
  return locale === "fr" ? "/contact/" : "/en/contact/";
}

export function thanksPath(locale: Locale) {
  return locale === "fr" ? "/merci/" : "/en/thanks/";
}

export function alternateLocale(locale: Locale): Locale {
  return locale === "fr" ? "en" : "fr";
}

export function formatPrice(price: string, locale: Locale) {
  const amount = Number(price.match(/[\d.]+/)?.[0] ?? 0);
  const formatted = new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2
  }).format(amount);
  return locale === "fr" ? `${formatted} TTC` : `${formatted} incl. VAT`;
}

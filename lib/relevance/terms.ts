export type SearchTermSet = {
  original: string;
  normalized: string;
  phrases: string[];
  tokens: string[];
  terms: string[];
  strongTerms: string[];
  relatedTerms: string[];
};

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "around",
  "at",
  "best",
  "by",
  "for",
  "from",
  "in",
  "near",
  "of",
  "on",
  "or",
  "the",
  "to",
  "with",
  "company",
  "companies",
  "business",
  "businesses",
  "service",
  "services",
]);

/**
 * Normalize text before matching.
 */
export function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Conservative token normalization.
 *
 * This helps:
 *   designer -> designer
 *   designers -> designer
 *   restaurants -> restaurant
 *   companies -> company
 */
function normalizeToken(token: string): string {
  const value = token.trim().toLowerCase();

  if (value.length <= 3) {
    return value;
  }

  if (value.endsWith("ies") && value.length > 5) {
    return `${value.slice(0, -3)}y`;
  }

  if (value.endsWith("sses")) {
    return value.slice(0, -2);
  }

  if (value.endsWith("ing") && value.length > 6) {
    return value.slice(0, -3);
  }

  if (value.endsWith("ers") && value.length > 5) {
    return value.slice(0, -1);
  }

  if (value.endsWith("es") && value.length > 5) {
    return value.slice(0, -2);
  }

  if (value.endsWith("s") && value.length > 4) {
    return value.slice(0, -1);
  }

  return value;
}

/**
 * High-confidence semantic relationships.
 *
 * These are supporting relationships, not hard-coded industries.
 * Unknown searches still work through generic token and phrase matching.
 */
const RELATED_TERMS: Record<string, string[]> = {
  interior: [
    "interior",
    "interiors",
    "interior design",
    "interior designer",
    "interior designers",
    "interior studio",
    "interior design studio",
  ],

  design: [
    "design",
    "designer",
    "designers",
    "design studio",
    "design agency",
  ],

  dentist: [
    "dental",
    "dentist",
    "dentistry",
    "dental clinic",
    "dental care",
  ],

  dermatology: [
    "dermatology",
    "dermatologist",
    "skin clinic",
    "skin care",
    "derma clinic",
  ],

  restaurant: [
    "restaurant",
    "restaurants",
    "dining",
    "eatery",
    "food",
  ],

  cafe: [
    "cafe",
    "coffee",
    "coffee shop",
    "coffeehouse",
  ],

  hotel: [
    "hotel",
    "hotels",
    "resort",
    "hospitality",
    "lodging",
  ],

  gym: [
    "gym",
    "fitness",
    "fitness center",
    "fitness centre",
    "health club",
  ],

  salon: [
    "salon",
    "hair salon",
    "beauty salon",
    "hairdresser",
  ],

  spa: [
    "spa",
    "wellness",
    "wellness center",
    "wellness centre",
  ],

  pharmacy: [
    "pharmacy",
    "chemist",
    "drugstore",
    "medical store",
  ],

  "real estate": [
    "real estate",
    "property",
    "properties",
    "realtor",
    "realty",
  ],

  lawyer: [
    "lawyer",
    "lawyers",
    "attorney",
    "legal",
    "law firm",
  ],

  marketing: [
    "marketing",
    "digital marketing",
    "marketing agency",
    "advertising",
    "advertising agency",
  ],

  photographer: [
    "photographer",
    "photography",
    "photo studio",
    "photography studio",
  ],

  "wedding photographer": [
    "wedding photographer",
    "wedding photography",
    "bridal photography",
    "wedding studio",
  ],

  software: [
    "software",
    "software company",
    "software development",
    "technology",
    "tech",
  ],

  saas: [
    "saas",
    "software as a service",
    "software",
    "platform",
  ],

  ecommerce: [
    "ecommerce",
    "e-commerce",
    "online store",
    "online shop",
    "retail",
  ],

  "clothing brand": [
    "clothing",
    "apparel",
    "fashion",
    "fashion brand",
    "clothing brand",
  ],

  skincare: [
    "skincare",
    "skin care",
    "cosmetics",
    "beauty",
    "beauty brand",
  ],
};

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function findRelatedTerms(normalizedQuery: string): string[] {
  const matches: string[] = [];

  for (const [key, terms] of Object.entries(RELATED_TERMS)) {
    const keyMatches =
      normalizedQuery === key ||
      normalizedQuery.includes(key);

    const termMatches = terms.some((term) =>
      normalizedQuery.includes(normalizeSearchText(term)),
    );

    if (keyMatches || termMatches) {
      matches.push(...terms);
    }
  }

  return unique(matches.map(normalizeSearchText));
}

/**
 * Build reusable search terminology.
 *
 * Works with known and unknown categories.
 *
 * Examples:
 *
 *   interior designers
 *   plastic manufacturers
 *   wedding planners
 *   cybersecurity companies
 *   boutique furniture stores
 */
export function buildSearchTermSet(query: string): SearchTermSet {
  const normalized = normalizeSearchText(query);

  const rawTokens = normalized
    .split(" ")
    .map(normalizeToken)
    .filter(Boolean);

  const tokens = unique(
    rawTokens.filter(
      (token) =>
        !STOP_WORDS.has(token) &&
        token.length >= 2,
    ),
  );

  const phrases: string[] = [];

  /**
   * Full search phrase.
   *
   * Example:
   * "interior designers"
   */
  if (normalized && normalized.split(" ").length > 1) {
    phrases.push(normalized);
  }

  /**
   * Two-word combinations.
   */
  for (let i = 0; i < tokens.length - 1; i += 1) {
    phrases.push(`${tokens[i]} ${tokens[i + 1]}`);
  }

  /**
   * Individual meaningful tokens.
   */
  phrases.push(...tokens);

  const uniquePhrases = unique(phrases);

  const relatedTerms = findRelatedTerms(normalized);

  /**
   * Strong terms are phrases that carry more intent.
   */
  const strongTerms = unique([
    normalized,
    ...uniquePhrases.filter(
      (phrase) => phrase.split(" ").length > 1,
    ),
    ...relatedTerms.filter(
      (term) => term.split(" ").length > 1,
    ),
  ]);

  /**
   * `terms` is kept for compatibility with the existing
   * relevance scoring engine.
   *
   * It combines:
   *   - tokens
   *   - phrases
   *   - related semantic terms
   */
  const terms = unique([
    ...tokens,
    ...uniquePhrases,
    ...relatedTerms,
  ]);

  return {
    original: query,
    normalized,
    phrases: uniquePhrases,
    tokens,
    terms,
    strongTerms,
    relatedTerms,
  };
}
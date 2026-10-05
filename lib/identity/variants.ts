import type { Lead } from "@/lib/leads/types";
import type { BusinessIdentityVariant } from "./types";

const GENERIC_WORDS = new Set([
  "the",
  "and",
  "of",
  "in",
  "at",
  "for",
  "a",
  "an",

  "clinic",
  "hospital",
  "center",
  "centre",
  "studio",
  "agency",
  "company",
  "co",
  "ltd",
  "limited",
  "llp",
  "group",

  "skin",
  "beauty",
  "aesthetic",
  "aesthetics",
  "medical",
  "health",
  "healthcare",
  "wellness",
  "dental",
  "dermatology",
  "cosmetic",
  "cosmetics",
]);

const CATEGORY_WORDS = [
  "skin",
  "beauty",
  "aesthetic",
  "aesthetics",
  "dental",
  "dermatology",
  "cosmetic",
  "cosmetics",
  "medical",
  "health",
  "healthcare",
  "wellness",
];

const BUSINESS_TYPE_WORDS = [
  "clinic",
  "hospital",
  "center",
  "centre",
  "studio",
  "agency",
  "company",
  "group",
];

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map(
      (word) =>
        word.charAt(0).toUpperCase() +
        word.slice(1).toLowerCase(),
    )
    .join(" ");
}

function tokenize(value: string): string[] {
  return normalize(value)
    .split(" ")
    .filter(Boolean);
}

function distinctiveTokens(
  value: string,
): string[] {
  return tokenize(value).filter(
    (token) =>
      token.length >= 3 &&
      !GENERIC_WORDS.has(token),
  );
}

function addVariant(
  variants: BusinessIdentityVariant[],
  seen: Set<string>,
  value: string,
  source: BusinessIdentityVariant["source"],
  confidence: number,
  reason: string,
): void {
  const cleaned = value
    .replace(/\s+/g, " ")
    .trim();

  const normalized = normalize(cleaned);

  if (!normalized || seen.has(normalized)) {
    return;
  }

  seen.add(normalized);

  variants.push({
    value: cleaned,
    source,
    confidence,
    reason,
  });
}

/**
 * Build conservative public-web identity variants.
 *
 * These variants are search hypotheses only.
 * They do NOT establish that two names belong
 * to the same business.
 */
export function buildIdentityVariants(
  lead: Lead,
): BusinessIdentityVariant[] {
  const variants: BusinessIdentityVariant[] = [];
  const seen = new Set<string>();

  const originalName =
    lead.companyName.trim();

  if (!originalName) {
    return variants;
  }

  const normalized =
    normalize(originalName);

  const tokens =
    tokenize(originalName);

  const distinctive =
    distinctiveTokens(originalName);

  /*
   * 1. Original discovery name
   *
   * Highest-confidence search variant because
   * this came directly from the discovery provider.
   */
  addVariant(
    variants,
    seen,
    originalName,
    "lead_name",
    1,
    "Original business name supplied by the discovery provider.",
  );

  /*
   * 2. Normalized capitalization
   */
  addVariant(
    variants,
    seen,
    titleCase(normalized),
    "derived",
    0.95,
    "Normalized capitalization of the discovered business name.",
  );

  /*
   * If there are no distinctive terms, don't
   * generate speculative variants.
   */
  if (distinctive.length === 0) {
    return variants.slice(0, 12);
  }

  const base =
    titleCase(distinctive.join(" "));

  /*
   * 3. Distinctive business name
   *
   * Example:
   *
   * Nital Skin Clinic
   *       ↓
   * Nital
   */
  if (distinctive.length < tokens.length) {
    addVariant(
      variants,
      seen,
      base,
      "derived",
      0.55,
      "Removed generic business-category words to expose the distinctive business name.",
    );
  }

  /*
   * 4. Common business-type combinations
   *
   * These are intentionally medium/low confidence.
   */
  const businessTypeVariants = [
    `${base} Clinic`,
    `${base} Center`,
    `${base} Centre`,
    `${base} Studio`,
    `${base} Agency`,
  ];

  for (const variant of businessTypeVariants) {
    addVariant(
      variants,
      seen,
      variant,
      "derived",
      0.42,
      "Combined the distinctive business name with a common business type.",
    );
  }

  /*
   * 5. Category-specific variants
   *
   * This is the important part for businesses that
   * publicly operate under a slightly different category.
   *
   * Example:
   *
   * Nital Skin Clinic
   *
   * → Nital Aesthetic Clinic
   * → Nital Aesthetics
   * → Nital Skin & Beauty Clinic
   */
  const foundCategories =
    tokens.filter((token) =>
      CATEGORY_WORDS.includes(token),
    );

  const categoryVariants = [
    `${base} Aesthetic Clinic`,
    `${base} Aesthetics`,
    `${base} Skin Clinic`,
    `${base} Skin & Beauty Clinic`,
    `${base} Beauty Clinic`,
    `${base} Dermatology Clinic`,
  ];

  /*
   * Only generate these when the original business
   * already contains a related category.
   *
   * This prevents a random company such as:
   *
   * "Nital Furniture"
   *
   * from becoming:
   *
   * "Nital Aesthetic Clinic"
   */
  if (foundCategories.length > 0) {
    for (const variant of categoryVariants) {
      addVariant(
        variants,
        seen,
        variant,
        "derived",
        0.45,
        "Generated a related category variant from a category already present in the discovered business name.",
      );
    }
  }

  /*
   * 6. Preserve the original category with the
   * distinctive business name.
   *
   * Example:
   *
   * Nital Skin Clinic
   * → Nital Skin
   */
  for (const category of foundCategories) {
    const formattedCategory =
      titleCase(category);

    addVariant(
      variants,
      seen,
      `${base} ${formattedCategory}`,
      "derived",
      0.5,
      "Recombined the distinctive business name with a category term found in the original name.",
    );
  }

  /*
   * 7. Special handling for common healthcare/
   * aesthetic naming patterns.
   *
   * These remain low-confidence because they are
   * search expansions, not identity evidence.
   */
  const hasHealthcareCategory =
    foundCategories.some((category) =>
      [
        "skin",
        "beauty",
        "aesthetic",
        "aesthetics",
        "dermatology",
        "cosmetic",
        "medical",
        "health",
        "healthcare",
        "dental",
      ].includes(category),
    );

  if (hasHealthcareCategory) {
    addVariant(
      variants,
      seen,
      `${base} Aesthetic`,
      "derived",
      0.4,
      "Generated a shorter healthcare/aesthetic naming variant for public-web discovery.",
    );

    addVariant(
      variants,
      seen,
      `${base} Skin & Beauty`,
      "derived",
      0.4,
      "Generated a related skin and beauty naming variant for public-web discovery.",
    );
  }

  /*
   * 8. Keep the output deliberately small.
   *
   * Search quality matters more than generating
   * hundreds of speculative names.
   */
  return variants.slice(0, 16);
}
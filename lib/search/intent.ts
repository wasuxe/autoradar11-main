import type { SearchIntent } from "./types";

const LOCATION_PATTERNS = [
  /\bin\s+(.+)$/i,
  /\bnear\s+(.+)$/i,
  /\baround\s+(.+)$/i,
  /\bat\s+(.+)$/i,
];

const QUALIFIER_WORDS = new Set([
  "premium",
  "luxury",
  "affordable",
  "cheap",
  "local",
  "small",
  "large",
  "growing",
  "new",
  "established",
  "boutique",
  "modern",
  "professional",
  "top",
  "best",
  "leading",
  "specialized",
  "specialist",
  "specialised",
  "startup",
  "startups",
  "startup-friendly",
  "b2b",
  "b2c",
  "d2c",
]);

const COUNTRY_NAMES = [
  "india",
  "usa",
  "united states",
  "uk",
  "united kingdom",
  "canada",
  "australia",
  "uae",
  "united arab emirates",
  "dubai",
  "singapore",
  "germany",
  "france",
  "italy",
  "spain",
  "japan",
  "south korea",
];

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s&-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractLocation(
  query: string
): {
  queryWithoutLocation: string;
  city: string | null;
  country: string | null;
} {
  const normalized = normalize(query);

  for (const pattern of LOCATION_PATTERNS) {
    const match = normalized.match(pattern);

    if (!match?.[1]) {
      continue;
    }

    const locationText = match[1].trim();

    if (!locationText) {
      continue;
    }

    const countryMatch = COUNTRY_NAMES.find(
      (country) =>
        locationText === country ||
        locationText.endsWith(` ${country}`)
    );

    if (countryMatch) {
      const city = locationText
        .slice(
          0,
          locationText.length -
            countryMatch.length
        )
        .trim();

      return {
        queryWithoutLocation: normalized
          .slice(
            0,
            normalized.length -
              match[1].length
          )
          .trim(),

        city: city || null,

        country: countryMatch,
      };
    }

    return {
      queryWithoutLocation: normalized
        .slice(
          0,
          normalized.length -
            match[1].length
        )
        .trim(),

      city: locationText,

      country: null,
    };
  }

  return {
    queryWithoutLocation: normalized,
    city: null,
    country: null,
  };
}

function extractQualifiers(
  query: string
): {
  cleanedQuery: string;
  qualifiers: string[];
} {
  const words = query.split(/\s+/);

  const qualifiers: string[] = [];
  const remaining: string[] = [];

  for (const word of words) {
    if (
      QUALIFIER_WORDS.has(word)
    ) {
      qualifiers.push(word);
    } else {
      remaining.push(word);
    }
  }

  return {
    cleanedQuery: remaining.join(" ").trim(),
    qualifiers,
  };
}

function inferCategory(
  query: string
): string | null {
  const cleaned = query.trim();

  if (!cleaned) {
    return null;
  }

  /*
   * We intentionally DO NOT try to map every possible
   * category to a hard-coded list.
   *
   * The user's category itself becomes the search intent.
   */

  return cleaned;
}

export function parseSearchIntent(
  input: string
): SearchIntent {
  const originalQuery = input.trim();

  const normalizedQuery =
    normalize(originalQuery);

  const location =
    extractLocation(
      normalizedQuery
    );

  const qualifierResult =
    extractQualifiers(
      location.queryWithoutLocation
    );

  const category =
    inferCategory(
      qualifierResult.cleanedQuery
    );

  const keywords =
    qualifierResult.cleanedQuery
      .split(/\s+/)
      .filter(Boolean);

  return {
    originalQuery,

    category,

    location: {
      city: location.city,
      country: location.country,
    },

    qualifiers:
      qualifierResult.qualifiers,

    keywords,

    normalizedQuery,
  };
}
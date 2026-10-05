import type {
  DiscoveryProvider,
  DiscoveryQuery,
  DiscoveryResult,
} from "@/lib/providers/types";

import { DiscoveryProviderError } from "../types";

const NOMINATIM_URL =
  "https://nominatim.openstreetmap.org/search";

const REQUEST_TIMEOUT = 8_000;
const MAX_LIMIT = 50;

type NominatimPlace = {
  place_id?: number;
  osm_type?: string;
  osm_id?: number;

  name?: string;
  display_name?: string;

  type?: string;
  category?: string;

  lat?: string;
  lon?: string;

  address?: {
    house_number?: string;
    road?: string;
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    county?: string;
    state?: string;
    postcode?: string;
    country?: string;
    country_code?: string;
  };

  extratags?: Record<string, string>;
  namedetails?: Record<string, string>;
};

/* -------------------------------------------------------------------------- */
/* BASIC HELPERS                                                              */
/* -------------------------------------------------------------------------- */

function clean(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const result = value.trim();

  return result.length > 0 ? result : null;
}

function normalizeText(
  value: string | null | undefined,
): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\s+/g, " ");
}

function normalizeCompact(
  value: string | null | undefined,
): string {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function clampLimit(limit?: number): number {
  if (!Number.isFinite(limit)) {
    return 10;
  }

  return Math.min(
    MAX_LIMIT,
    Math.max(
      1,
      Math.floor(limit as number),
    ),
  );
}

/* -------------------------------------------------------------------------- */
/* LOCATION                                                                   */
/* -------------------------------------------------------------------------- */

function getCity(
  place: NominatimPlace,
): string | null {
  return (
    clean(place.address?.city) ??
    clean(place.address?.town) ??
    clean(place.address?.village) ??
    clean(place.address?.municipality)
  );
}

function getCountry(
  place: NominatimPlace,
): string | null {
  return (
    clean(place.address?.country) ??
    clean(place.address?.country_code)?.toUpperCase() ??
    null
  );
}

function getAddress(
  place: NominatimPlace,
): string | null {
  const address = place.address;

  if (!address) {
    return clean(place.display_name);
  }

  const parts = [
    address.house_number,
    address.road,
    getCity(place),
    address.state,
    address.postcode,
    address.country,
  ]
    .map(clean)
    .filter(
      (value): value is string =>
        value !== null,
    );

  return parts.length > 0
    ? parts.join(", ")
    : clean(place.display_name);
}

/* -------------------------------------------------------------------------- */
/* WEBSITE / CONTACT                                                          */
/* -------------------------------------------------------------------------- */

function getWebsite(
  place: NominatimPlace,
): string | null {
  return (
    clean(place.extratags?.website) ??
    clean(place.extratags?.contact_website) ??
    clean(place.extratags?.url)
  );
}

function getPhone(
  place: NominatimPlace,
): string | null {
  return (
    clean(place.extratags?.phone) ??
    clean(place.extratags?.contact_phone)
  );
}

function getSocialUrl(
  place: NominatimPlace,
  key: string,
): string | null {
  return clean(place.extratags?.[key]);
}

/* -------------------------------------------------------------------------- */
/* INDUSTRY SEARCH TERMS                                                      */
/* -------------------------------------------------------------------------- */

const INDUSTRY_VARIANTS: Record<
  string,
  string[]
> = {
  "skin care": [
    "skin clinic",
    "dermatology clinic",
    "dermatologist",
    "skin specialist",
    "aesthetic clinic",
    "cosmetic clinic",
  ],

  skincare: [
    "skin clinic",
    "dermatology clinic",
    "dermatologist",
    "skin specialist",
    "aesthetic clinic",
    "cosmetic clinic",
  ],

  dermatology: [
    "dermatology clinic",
    "dermatologist",
    "skin clinic",
    "skin specialist",
  ],

  dentist: [
    "dental clinic",
    "dentist",
    "dental hospital",
    "orthodontist",
  ],

  dentistry: [
    "dental clinic",
    "dentist",
    "dental hospital",
    "orthodontist",
  ],

  restaurant: [
    "restaurant",
    "food restaurant",
    "fine dining",
    "family restaurant",
  ],

  cafe: [
    "cafe",
    "coffee shop",
    "coffee house",
    "restaurant cafe",
  ],

  hotel: [
    "hotel",
    "resort",
    "guest house",
    "boutique hotel",
  ],

  gym: [
    "gym",
    "fitness center",
    "fitness club",
    "health club",
  ],

  salon: [
    "beauty salon",
    "hair salon",
    "salon",
    "beauty parlour",
  ],

  beauty: [
    "beauty salon",
    "beauty clinic",
    "aesthetic clinic",
    "salon",
  ],

  "real estate": [
    "real estate agency",
    "property dealer",
    "real estate",
    "property consultant",
  ],

  lawyer: [
    "lawyer",
    "law firm",
    "advocate",
    "legal services",
  ],

  photographer: [
    "photographer",
    "photography studio",
    "photo studio",
  ],

  marketing: [
    "marketing agency",
    "digital marketing agency",
    "advertising agency",
    "marketing consultant",
  ],

  agency: [
    "marketing agency",
    "advertising agency",
    "creative agency",
    "digital agency",
  ],
};

function getIndustryVariants(
  industry: string | null,
): string[] {
  if (!industry) {
    return [];
  }

  const normalized = normalizeText(industry);

  return (
    INDUSTRY_VARIANTS[normalized] ??
    [industry]
  );
}

/* -------------------------------------------------------------------------- */
/* BUSINESS ENTITY DETECTION                                                  */
/* -------------------------------------------------------------------------- */

/**
 * These are never valid business names for discovery.
 *
 * This is intentionally conservative.
 * If a result looks like an article/page/topic rather than an entity,
 * we reject it instead of trying to enrich it later.
 */
const BLOCKED_NAME_PATTERNS = [
  "anatomy",
  "structure and function",
  "structure of skin",
  "function of skin",
  "diagram",
  "significance",
  "definition",
  "meaning of",
  "what is",
  "how to",
  "guide to",
  "symptoms of",
  "causes of",
  "treatment of",
  "diagnosis of",
  "overview of",
  "introduction to",
  "research paper",
  "journal article",
  "medical article",
  "wikipedia",
  "webmd",
  "healthline",
  "mayoclinic",
  "cleveland clinic article",
];

const BLOCKED_NAME_EXACT = new Set([
  "skin",
  "skin care",
  "skincare",
  "dermatology",
  "dermatologist",
  "clinic",
  "hospital",
  "doctor",
  "doctors",
  "restaurant",
  "cafe",
  "hotel",
  "gym",
  "salon",
  "business",
  "businesses",
  "company",
  "companies",
]);

const BUSINESS_NAME_TERMS = [
  "clinic",
  "hospital",
  "medical",
  "health",
  "healthcare",
  "dermatology",
  "dermatologist",
  "skin care",
  "skincare",
  "aesthetic",
  "aesthetics",
  "cosmetic",
  "cosmetics",
  "dental",
  "dentist",
  "restaurant",
  "cafe",
  "coffee",
  "hotel",
  "resort",
  "gym",
  "fitness",
  "salon",
  "beauty",
  "studio",
  "agency",
  "law",
  "lawyer",
  "advocate",
  "real estate",
  "property",
  "photography",
  "photographer",
];

const NON_BUSINESS_TYPES = new Set([
  "article",
  "blog",
  "book",
  "books",
  "chapter",
  "collection",
  "company",
  "continent",
  "country",
  "county",
  "district",
  "document",
  "education",
  "island",
  "locality",
  "map",
  "news",
  "page",
  "postcode",
  "region",
  "research",
  "state",
  "town",
  "village",
  "wiki",
]);

const BUSINESS_CATEGORIES = new Set([
  "amenity",
  "healthcare",
  "shop",
  "office",
  "tourism",
  "leisure",
  "craft",
  "man_made",
]);

const HEALTHCARE_TYPES = new Set([
  "clinic",
  "doctors",
  "doctor",
  "hospital",
  "dentist",
  "pharmacy",
  "laboratory",
]);

const BUSINESS_TYPES = new Set([
  "restaurant",
  "cafe",
  "fast_food",
  "food_court",
  "hotel",
  "guest_house",
  "hostel",
  "motel",
  "gym",
  "fitness_centre",
  "beauty",
  "hairdresser",
  "barber",
  "photographer",
  "studio",
  "office",
  "lawyer",
]);

function containsAnyTerm(
  value: string,
  terms: string[],
): boolean {
  return terms.some((term) =>
    value.includes(normalizeCompact(term)),
  );
}

function nameLooksLikeContent(
  name: string,
): boolean {
  const normalized = normalizeCompact(name);

  if (!normalized) {
    return true;
  }

  if (BLOCKED_NAME_EXACT.has(normalized)) {
    return true;
  }

  return BLOCKED_NAME_PATTERNS.some(
    (pattern) =>
      normalized.includes(
        normalizeCompact(pattern),
      ),
  );
}

function nameLooksLikeBusiness(
  name: string,
): boolean {
  const normalized = normalizeCompact(name);

  if (!normalized) {
    return false;
  }

  if (nameLooksLikeContent(name)) {
    return false;
  }

  return containsAnyTerm(
    normalized,
    BUSINESS_NAME_TERMS,
  );
}

function getPlaceType(
  place: NominatimPlace,
): string {
  return normalizeText(
    place.type,
  );
}

function getPlaceCategory(
  place: NominatimPlace,
): string {
  return normalizeText(
    place.category,
  );
}

/* -------------------------------------------------------------------------- */
/* INDUSTRY MATCHING                                                          */
/* -------------------------------------------------------------------------- */

function matchesRequestedIndustry(
  place: NominatimPlace,
  query: DiscoveryQuery,
): boolean {
  const industry = normalizeText(
    query.industry,
  );

  if (!industry) {
    return true;
  }

  const name = normalizeCompact(
    place.name,
  );

  const category = getPlaceCategory(place);
  const type = getPlaceType(place);

  const variants = getIndustryVariants(
    industry,
  ).map(normalizeCompact);

  const nameMatches = variants.some(
    (variant) =>
      variant.length > 0 &&
      name.includes(variant),
  );

  /*
   * Healthcare businesses can legitimately have names
   * such as "ABC Hospital" or "ABC Clinic" without the
   * word "dermatology" in their name.
   */
  const healthcarePlace =
    category === "healthcare" ||
    (
      category === "amenity" &&
      HEALTHCARE_TYPES.has(type)
    );

  if (
    industry === "skin care" ||
    industry === "skincare" ||
    industry === "dermatology"
  ) {
    if (nameMatches) {
      return true;
    }

    if (healthcarePlace) {
      return true;
    }

    /*
     * Cosmetics/beauty businesses can be relevant to skincare,
     * but only when OSM actually classifies them as a business.
     */
    if (
      (
        category === "shop" &&
        (
          type === "cosmetics" ||
          type === "beauty"
        )
      ) ||
      (
        category === "beauty" &&
        (
          type === "beauty" ||
          type === "clinic"
        )
      )
    ) {
      return true;
    }

    return false;
  }

  if (
    industry === "dentist" ||
    industry === "dentistry"
  ) {
    return (
      nameMatches ||
      type === "dentist" ||
      (
        category === "healthcare" &&
        type === "dentist"
      )
    );
  }

  if (industry === "restaurant") {
    return (
      nameMatches ||
      BUSINESS_TYPES.has(type) &&
      (
        type === "restaurant" ||
        type === "fast_food" ||
        type === "food_court"
      )
    );
  }

  if (industry === "cafe") {
    return (
      nameMatches ||
      type === "cafe"
    );
  }

  if (industry === "hotel") {
    return (
      nameMatches ||
      type === "hotel" ||
      type === "guest_house" ||
      type === "hostel" ||
      type === "motel"
    );
  }

  if (industry === "gym") {
    return (
      nameMatches ||
      type === "gym" ||
      type === "fitness_centre"
    );
  }

  if (
    industry === "salon" ||
    industry === "beauty"
  ) {
    return (
      nameMatches ||
      type === "beauty" ||
      type === "hairdresser" ||
      type === "barber"
    );
  }

  if (industry === "photographer") {
    return (
      nameMatches ||
      type === "photographer"
    );
  }

  if (industry === "lawyer") {
    return (
      nameMatches ||
      type === "lawyer"
    );
  }

  /*
   * For less structured industries, require either:
   *
   * 1. a matching business name, or
   * 2. an actual business category.
   *
   * Never accept a result merely because the user searched for it.
   */
  return (
    nameMatches ||
    BUSINESS_CATEGORIES.has(category)
  );
}

/* -------------------------------------------------------------------------- */
/* BUSINESS ENTITY GATE                                                       */
/* -------------------------------------------------------------------------- */

function isRealBusinessPlace(
  place: NominatimPlace,
  query: DiscoveryQuery,
): boolean {
  const name = clean(place.name);

  if (!name) {
    return false;
  }

  if (nameLooksLikeContent(name)) {
    return false;
  }

  const category = getPlaceCategory(place);
  const type = getPlaceType(place);

  if (
    NON_BUSINESS_TYPES.has(type)
  ) {
    return false;
  }

  const hasBusinessCategory =
    BUSINESS_CATEGORIES.has(category);

  const hasBusinessType =
    BUSINESS_TYPES.has(type) ||
    HEALTHCARE_TYPES.has(type);

  const hasBusinessName =
    nameLooksLikeBusiness(name);

  /*
   * Industry-specific matching is mandatory whenever
   * the user supplied an industry.
   */
  if (
    query.industry &&
    !matchesRequestedIndustry(
      place,
      query,
    )
  ) {
    return false;
  }

  /*
   * Strongest case:
   * OSM explicitly classifies the result as a business/health entity.
   */
  if (
    hasBusinessCategory ||
    hasBusinessType
  ) {
    return true;
  }

  /*
   * If OSM classification is weak, require strong business
   * naming evidence plus a real address.
   */
  if (
    hasBusinessName &&
    (
      getCity(place) !== null ||
      clean(place.address?.road) !== null
    )
  ) {
    return true;
  }

  return false;
}

/* -------------------------------------------------------------------------- */
/* INDUSTRY INFERENCE                                                         */
/* -------------------------------------------------------------------------- */

function inferIndustry(
  place: NominatimPlace,
  query: DiscoveryQuery,
): string | null {
  const explicit = clean(query.industry);

  if (explicit) {
    return explicit;
  }

  const type = getPlaceType(place);
  const category = getPlaceCategory(place);

  if (
    type === "dentist" ||
    (
      category === "healthcare" &&
      type === "dentist"
    )
  ) {
    return "dentistry";
  }

  if (
    type === "restaurant" ||
    type === "fast_food"
  ) {
    return "restaurant";
  }

  if (type === "cafe") {
    return "cafe";
  }

  if (
    type === "hotel" ||
    type === "guest_house" ||
    type === "hostel"
  ) {
    return "hotel";
  }

  if (
    type === "gym" ||
    type === "fitness_centre"
  ) {
    return "gym";
  }

  if (
    type === "beauty" ||
    type === "hairdresser" ||
    type === "barber"
  ) {
    return "beauty";
  }

  return (
    clean(place.category) ??
    clean(place.type)
  );
}

/* -------------------------------------------------------------------------- */
/* SEARCH QUERY GENERATION                                                    */
/* -------------------------------------------------------------------------- */

function buildSearchQueries(
  query: DiscoveryQuery,
): string[] {
  const city = clean(query.city);
  const country = clean(query.country);
  const industry = clean(query.industry);
  const text = clean(query.text);

  const locationParts = [
    city,
    country,
  ].filter(
    (value): value is string =>
      Boolean(value),
  );

  const location =
    locationParts.join(", ");

  const queries: string[] = [];

  if (text && location) {
    queries.push(
      `${text}, ${location}`,
    );
  }

  const industryVariants =
    getIndustryVariants(industry);

  for (const variant of industryVariants) {
    if (location) {
      queries.push(
        `${variant}, ${location}`,
      );
    } else {
      queries.push(variant);
    }
  }

  if (
    industry &&
    location
  ) {
    queries.push(
      `${industry}, ${location}`,
    );
  }

  if (
    text &&
    !industry &&
    !location
  ) {
    queries.push(text);
  }

  /*
   * IMPORTANT:
   *
   * Do NOT use a generic:
   * "businesses, Vadodara, India"
   *
   * That query creates a huge amount of noise and
   * defeats industry-specific discovery.
   */
  if (
    queries.length === 0 &&
    city &&
    country
  ) {
    queries.push(
      city,
      country,
    );
  }

  if (queries.length === 0) {
    queries.push(
      text ??
      industry ??
      "business",
    );
  }

  return [
    ...new Set(
      queries
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}

/* -------------------------------------------------------------------------- */
/* PLACE → LEAD                                                               */
/* -------------------------------------------------------------------------- */

function mapPlace(
  place: NominatimPlace,
  query: DiscoveryQuery,
): Record<string, unknown> | null {
  const companyName = clean(place.name);

  if (!companyName) {
    return null;
  }

  /*
   * THIS IS THE CRITICAL GATE.
   *
   * Never turn an arbitrary Nominatim search result
   * into a lead.
   */
  if (
    !isRealBusinessPlace(
      place,
      query,
    )
  ) {
    return null;
  }

  const lat = clean(place.lat);
  const lon = clean(place.lon);

  const osmId = place.osm_id;
  const osmType = clean(place.osm_type);

  const sourceUrl =
    osmId && osmType
      ? `https://www.openstreetmap.org/${osmType}/${osmId}`
      : lat && lon
        ? `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}`
        : "https://www.openstreetmap.org/";

  const website = getWebsite(place);

  return {
    companyName,

    /*
     * IMPORTANT:
     *
     * This is an OSM-provided website only.
     * It is NOT treated as verified official website.
     * The downstream identity/research pipeline must verify it.
     */
    website,

    industry:
      inferIndustry(
        place,
        query,
      ),

    country:
      getCountry(place),

    city:
      getCity(place),

    address:
      getAddress(place),

    phone:
      getPhone(place),

    employeeRange:
      null,

    serviceTrack:
      null,

    source:
      "openstreetmap",

    sourceUrl,

    description:
      clean(place.display_name),

    linkedinUrl:
      getSocialUrl(
        place,
        "contact:linkedin",
      ),

    instagramUrl:
      getSocialUrl(
        place,
        "contact:instagram",
      ),

    facebookUrl:
      getSocialUrl(
        place,
        "contact:facebook",
      ),

    foundedYear:
      null,

    latitude:
      lat ? Number(lat) : null,

    longitude:
      lon ? Number(lon) : null,
  };
}

/* -------------------------------------------------------------------------- */
/* DEDUPLICATION                                                              */
/* -------------------------------------------------------------------------- */

function dedupeCandidates(
  candidates: Record<string, unknown>[],
): Record<string, unknown>[] {
  const seen = new Set<string>();
  const result: Record<string, unknown>[] = [];

  for (const candidate of candidates) {
    const name = normalizeText(
      clean(candidate.companyName),
    );

    const city = normalizeText(
      clean(candidate.city),
    );

    const website = normalizeText(
      clean(candidate.website),
    );

    const sourceUrl = normalizeText(
      clean(candidate.sourceUrl),
    );

    /*
     * Prefer actual website identity, then the
     * OSM entity, then name + city.
     */
    const key =
      website ||
      sourceUrl ||
      `${name}|${city}`;

    if (
      !key ||
      seen.has(key)
    ) {
      continue;
    }

    seen.add(key);
    result.push(candidate);
  }

  return result;
}

/* -------------------------------------------------------------------------- */
/* NOMINATIM REQUEST                                                          */
/* -------------------------------------------------------------------------- */

async function searchNominatim(
  searchQuery: string,
  limit: number,
): Promise<NominatimPlace[]> {
  const url =
    new URL(NOMINATIM_URL);

  url.searchParams.set(
    "q",
    searchQuery,
  );

  url.searchParams.set(
    "format",
    "jsonv2",
  );

  url.searchParams.set(
    "addressdetails",
    "1",
  );

  url.searchParams.set(
    "extratags",
    "1",
  );

  url.searchParams.set(
    "namedetails",
    "1",
  );

  url.searchParams.set(
    "limit",
    String(
      Math.min(
        limit,
        50,
      ),
    ),
  );

  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () => controller.abort(),
      REQUEST_TIMEOUT,
    );

  try {
    const response =
      await fetch(
        url.toString(),
        {
          method: "GET",

          headers: {
            Accept:
              "application/json",

            "User-Agent":
              "SoleTrust-AutoRadar/1.0",
          },

          cache:
            "no-store",

          signal:
            controller.signal,
        },
      );

    if (!response.ok) {
      if (
        response.status === 429
      ) {
        throw new DiscoveryProviderError(
          "OpenStreetMap rate limit reached. Try again later.",
        );
      }

      throw new DiscoveryProviderError(
        `OpenStreetMap request failed with status ${response.status}.`,
      );
    }

    const data =
      (await response.json()) as unknown;

    if (!Array.isArray(data)) {
      throw new DiscoveryProviderError(
        "OpenStreetMap returned an invalid response.",
      );
    }

    return data as NominatimPlace[];
  } catch (error) {
    if (
      error instanceof
      DiscoveryProviderError
    ) {
      throw error;
    }

    if (
      error instanceof Error &&
      error.name === "AbortError"
    ) {
      throw new DiscoveryProviderError(
        "OpenStreetMap request timed out.",
      );
    }

    throw new DiscoveryProviderError(
      "Unable to connect to OpenStreetMap.",
      {
        cause: error,
      },
    );
  } finally {
    clearTimeout(timeout);
  }
}

/* -------------------------------------------------------------------------- */
/* PROVIDER                                                                   */
/* -------------------------------------------------------------------------- */

export const openStreetMapProvider:
  DiscoveryProvider = {
    id: "openstreetmap",

    async discover(
      query: DiscoveryQuery,
    ): Promise<DiscoveryResult> {
      const requestedLimit =
        clampLimit(
          query.limit,
        );

      const searchQueries =
        buildSearchQueries(
          query,
        );

      const perQueryLimit =
        Math.min(
          10,
          Math.max(
            5,
            requestedLimit,
          ),
        );

      const allCandidates:
        Record<string, unknown>[] = [];

      let successfulQueries = 0;
      let rejectedCandidates = 0;

      console.log(
        "[OpenStreetMap] Search queries:",
        searchQueries,
      );

      for (
        const searchQuery of
          searchQueries
      ) {
        try {
          const places =
            await searchNominatim(
              searchQuery,
              perQueryLimit,
            );

          successfulQueries++;

          console.log(
            `[OpenStreetMap] "${searchQuery}" returned ${places.length} places`,
          );

          for (
            const place of places
          ) {
            const candidate =
              mapPlace(
                place,
                query,
              );

            if (candidate) {
              allCandidates.push(
                candidate,
              );
            } else {
              rejectedCandidates++;
            }
          }
        } catch (error) {
          console.warn(
            `[OpenStreetMap] Search failed for "${searchQuery}"`,
            error,
          );
        }
      }

      const candidates =
        dedupeCandidates(
          allCandidates,
        ).slice(
          0,
          Math.min(
            MAX_LIMIT,
            requestedLimit * 3,
          ),
        );

      console.log(
        `[OpenStreetMap] Discovery completed: ${candidates.length} unique business candidates; rejected ${rejectedCandidates} non-business results from ${successfulQueries}/${searchQueries.length} queries`,
      );

      if (
        successfulQueries === 0 &&
        searchQueries.length > 0
      ) {
        throw new DiscoveryProviderError(
          "OpenStreetMap discovery failed for all search queries.",
        );
      }

      return {
        candidates,
        nextCursor: null,
      };
    },
  };
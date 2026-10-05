import type {
  DiscoveryProvider,
  DiscoveryQuery,
  DiscoveryResult,
} from "@/lib/providers/types";

import type { LeadInput } from "@/lib/leads/types";

/* -------------------------------------------------------------------------- */
/* CONFIG                                                                     */
/* -------------------------------------------------------------------------- */

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

const SEARCH_RESULTS_PER_QUERY = 20;
const MAX_QUERIES = 12;
const REQUEST_TIMEOUT_MS = 10_000;

const SEARXNG_URL =
  process.env.SEARXNG_URL?.replace(/\/$/, "") ||
  "http://localhost:8080";

/* -------------------------------------------------------------------------- */
/* HOST CLASSIFICATION                                                        */
/* -------------------------------------------------------------------------- */

const SOCIAL_HOSTS = [
  "instagram.com",
  "facebook.com",
  "linkedin.com",
  "twitter.com",
  "x.com",
  "youtube.com",
  "tiktok.com",
];

const DIRECTORY_HOSTS = [
  "justdial.com",
  "sulekha.com",
  "practo.com",
  "docindia.org",
  "spotmedics.com",
  "yelp.com",
  "tripadvisor.com",
  "foursquare.com",
  "yellowpages.com",
  "indiamart.com",
  "tradeindia.com",
  "magicpin.in",
  "zaubacorp.com",
  "webindia123.com",
  "dentee.com",
  "bewtee.com",
  "hexahealth.com",
  "rocketreach.co",
  "zoominfo.com",
  "apollo.io",
  "crunchbase.com",
  "eyehospitalnearme.in",
  "near-me",
  "findnearby",
];

const CONTENT_HOSTS = [
  "wikipedia.org",
  "wikimedia.org",
  "webmd.com",
  "healthline.com",
  "mayoclinic.org",
  "clevelandclinic.org",
  "verywellhealth.org",
  "verywellhealth.com",
  "medicalnewstoday.com",
  "nhs.uk",
  "medium.com",
  "forbes.com",
  "businessinsider.com",
  "reddit.com",
  "quora.com",
  "vietnam.travel",
  "willflyforfood.net",
  "tasteatlas.com",
  "wordunscrambler.net",
  "support.microsoft.com",
  "minecraft.net",
  "novaskin.me",
  "namemc.com",
  "skindex.pro",
];

const SEARCH_ENGINE_HOSTS = [
  "google.com",
  "google.co.in",
  "bing.com",
  "duckduckgo.com",
  "search.yahoo.com",
];

/* -------------------------------------------------------------------------- */
/* BLOCKED RESULT PATTERNS                                                    */
/* -------------------------------------------------------------------------- */

const BLOCKED_TITLE_PATTERNS = [
  "wikipedia",
  "webmd",
  "healthline",
  "mayo clinic",
  "cleveland clinic",
  "verywell health",
  "medical news today",
  "nhs",
  "minecraft",
  "skin editor",
  "skin catalog",
  "skin database",
  "how to",
  "what is",
  "guide",
  "tutorial",
  "article",
  "news",
  "blog",
  "review",
  "reviews",
  "best places",
  "top 10",
  "top 20",
  "ranking",
  "directory",
  "near me",
  "find a",
  "find the best",
  "support",
  "microsoft",
  "copilot",
  "unscramble",
  "tourism",
  "travel",
  "street food",
  "must try",
  "dishes",
];

const BLOCKED_PATH_PATTERNS = [
  "/search",
  "/tag/",
  "/category/",
  "/author/",
  "/blog/",
  "/article/",
  "/articles/",
  "/news/",
  "/wiki/",
  "/how-to/",
  "/guides/",
  "/reviews/",
  "/ranking/",
  "/list/",
  "/support/",
];

/* -------------------------------------------------------------------------- */
/* TEXT HELPERS                                                               */
/* -------------------------------------------------------------------------- */

function normalizeText(
  value: string | null | undefined,
): string {
  return (value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeForComparison(
  value: string | null | undefined,
): string {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(
  value: string | null | undefined,
): string[] {
  return normalizeForComparison(value)
    .split(" ")
    .filter((token) => token.length >= 2);
}

/* -------------------------------------------------------------------------- */
/* URL HELPERS                                                                */
/* -------------------------------------------------------------------------- */

function normalizeUrl(
  value: string | null | undefined,
): string | null {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);

    if (
      url.protocol !== "http:" &&
      url.protocol !== "https:"
    ) {
      return null;
    }

    url.hash = "";

    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function getHostname(
  value: string | null | undefined,
): string {
  if (!value) {
    return "";
  }

  try {
    return new URL(value)
      .hostname
      .toLowerCase()
      .replace(/^www\./, "");
  } catch {
    return "";
  }
}

function getPath(
  value: string | null | undefined,
): string {
  if (!value) {
    return "";
  }

  try {
    return new URL(value).pathname.toLowerCase();
  } catch {
    return "";
  }
}

function hostMatches(
  hostname: string,
  host: string,
): boolean {
  return (
    hostname === host ||
    hostname.endsWith(`.${host}`)
  );
}

function isSocialUrl(url: string): boolean {
  const hostname = getHostname(url);

  return SOCIAL_HOSTS.some((host) =>
    hostMatches(hostname, host),
  );
}

function isDirectoryUrl(url: string): boolean {
  const hostname = getHostname(url);

  return DIRECTORY_HOSTS.some((host) =>
    hostMatches(hostname, host),
  );
}

function isContentUrl(url: string): boolean {
  const hostname = getHostname(url);

  if (
    CONTENT_HOSTS.some((host) =>
      hostMatches(hostname, host),
    )
  ) {
    return true;
  }

  const path = getPath(url);

  return BLOCKED_PATH_PATTERNS.some((pattern) =>
    path.includes(pattern),
  );
}

function isSearchEngineUrl(url: string): boolean {
  const hostname = getHostname(url);

  return SEARCH_ENGINE_HOSTS.some((host) =>
    hostMatches(hostname, host),
  );
}

/* -------------------------------------------------------------------------- */
/* LOCATION / CITY VALIDATION                                                 */
/* -------------------------------------------------------------------------- */

/*
 * Search engines can return a legitimate business from another city even
 * when the query contains the requested city. We therefore validate explicit
 * location signals before turning a result into a lead.
 *
 * This is intentionally conservative:
 * - A city appearing in a title or URL is treated as a strong location signal.
 * - A city appearing only in generic descriptive text is not enough by itself.
 * - We support common Indian city aliases.
 */

const LOCALITY_TO_CITY: Record<string, string> = {
  sholinganallur: "chennai",
  omr: "chennai",
  adyar: "chennai",
  "anna nagar": "chennai",
  "anna nagar west": "chennai",
  "anna nagar east": "chennai",
  "t nagar": "chennai",
  tynampet: "chennai",
  velachery: "chennai",
  tambaram: "chennai",
  porur: "chennai",
  guindy: "chennai",
  "mount road": "chennai",
  "ecr": "chennai",

  whitefield: "bangalore",
  bengaluru: "bangalore",
  koramangala: "bangalore",
  indiranagar: "bangalore",
  "hsr layout": "bangalore",
  "electronic city": "bangalore",
  marathahalli: "bangalore",
  "jayanagar": "bangalore",
  "malleshwaram": "bangalore",
  yelahanka: "bangalore",

  andheri: "mumbai",
  "andheri east": "mumbai",
  "andheri west": "mumbai",
  bandra: "mumbai",
  "bandra west": "mumbai",
  "bandra east": "mumbai",
  powai: "mumbai",
  borivali: "mumbai",
  goregaon: "mumbai",
  malad: "mumbai",
  chembur: "mumbai",
  colaba: "mumbai",
  "lower parel": "mumbai",

  "banjara hills": "hyderabad",
  "jubilee hills": "hyderabad",
  gachibowli: "hyderabad",
  madhapur: "hyderabad",
  kondapur: "hyderabad",
  "hitech city": "hyderabad",

  "saket": "delhi",
  dwarka: "delhi",
  rohini: "delhi",
  "greater kailash": "delhi",
  "lajpat nagar": "delhi",
  "karol bagh": "delhi",
  "connaught place": "delhi",

  "sector 18": "noida",
  "sector 62": "noida",
  "sector 63": "noida",
  "sector 50": "noida",

  "gurgaon sector": "gurgaon",
  "golf course road": "gurgaon",
  "mg road": "gurgaon",
  sohna: "gurgaon",

  "kalyani nagar": "pune",
  "koregaon park": "pune",
  "baner": "pune",
  "wakad": "pune",
  "hinjewadi": "pune",
  "viman nagar": "pune",
  "hadapsar": "pune",

  "salt lake": "kolkata",
  "new town": "kolkata",
  "park street": "kolkata",
  "ballygunge": "kolkata",

  "navrangpura": "ahmedabad",
  "satellite": "ahmedabad",
  "prahlad nagar": "ahmedabad",
  "bodakdev": "ahmedabad",

};

const CITY_ALIASES: Record<string, string[]> = {
  ahmedabad: ["ahmedabad"],
  amritsar: ["amritsar"],
  aurangabad: ["aurangabad", "chhatrapati sambhajinagar"],
  bangalore: ["bangalore", "bengaluru"],
  bengaluru: ["bangalore", "bengaluru"],
  bhopal: ["bhopal"],
  bhubaneswar: ["bhubaneswar"],
  chandigarh: ["chandigarh"],
  chennai: ["chennai", "madras"],
  coimbatore: ["coimbatore"],
  dehradun: ["dehradun"],
  delhi: ["delhi", "new delhi"],
  faridabad: ["faridabad"],
  ghaziabad: ["ghaziabad"],
  goa: ["goa", "panaji", "panjim"],
  gurgaon: ["gurgaon", "gurugram"],
  gurugram: ["gurgaon", "gurugram"],
  guwahati: ["guwahati"],
  hyderabad: ["hyderabad"],
  indore: ["indore"],
  jaipur: ["jaipur"],
  jalandhar: ["jalandhar"],
  jammu: ["jammu"],
  kanpur: ["kanpur"],
  kochi: ["kochi", "cochin"],
  kolkata: ["kolkata", "calcutta"],
  lucknow: ["lucknow"],
  ludhiana: ["ludhiana"],
  madurai: ["madurai"],
  mangalore: ["mangalore", "mangaluru"],
  meerut: ["meerut"],
  mohali: ["mohali", "sahibzada ajit singh nagar"],
  mumbai: ["mumbai", "bombay"],
  mysore: ["mysore", "mysuru"],
  nagpur: ["nagpur"],
  nashik: ["nashik", "nasik"],
  noida: ["noida"],
  patna: ["patna"],
  pondicherry: ["pondicherry", "puducherry"],
  prayagraj: ["prayagraj", "allahabad"],
  pune: ["pune"],
  raipur: ["raipur"],
  rajkot: ["rajkot"],
  ranchi: ["ranchi"],
  surat: ["surat"],
  thane: ["thane"],
  thiruvananthapuram: ["thiruvananthapuram", "trivandrum"],
  udaipur: ["udaipur"],
  vadodara: ["vadodara", "baroda"],
  varanasi: ["varanasi", "banaras", "kashi"],
  vijayawada: ["vijayawada"],
  visakhapatnam: ["visakhapatnam", "vizag"],
};

function getCityVariants(city: string | null | undefined): string[] {
  const normalized = normalizeForComparison(city);

  if (!normalized) {
    return [];
  }

  const directAliases = CITY_ALIASES[normalized];

  if (directAliases) {
    return directAliases.map(normalizeForComparison);
  }

  for (const aliases of Object.values(CITY_ALIASES)) {
    const normalizedAliases = aliases.map(normalizeForComparison);

    if (normalizedAliases.includes(normalized)) {
      return normalizedAliases;
    }
  }

  return [normalized];
}

function containsWholePhrase(
  text: string,
  phrase: string,
): boolean {
  const normalizedText = normalizeForComparison(text);
  const normalizedPhrase = normalizeForComparison(phrase);

  if (!normalizedText || !normalizedPhrase) {
    return false;
  }

  const escaped = normalizedPhrase.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
  );

  return new RegExp(
    `(?:^|\\s)${escaped}(?:$|\\s)`,
    "i",
  ).test(normalizedText);
}

function getKnownCityMatches(
  value: string | null | undefined,
): string[] {
  const normalized = normalizeForComparison(value);

  if (!normalized) {
    return [];
  }

  const matches = new Set<string>();

  for (const [canonical, aliases] of Object.entries(
    CITY_ALIASES,
  )) {
    for (const alias of aliases) {
      if (containsWholePhrase(normalized, alias)) {
        matches.add(canonical);
        break;
      }
    }
  }

  return Array.from(matches);
}

function getParentCityForLocality(
  value: string | null | undefined,
): string | null {
  const normalized = normalizeForComparison(value);

  if (!normalized) {
    return null;
  }

  const direct = LOCALITY_TO_CITY[normalized];

  if (direct) {
    return direct;
  }

  for (const [locality, parentCity] of Object.entries(
    LOCALITY_TO_CITY,
  )) {
    if (containsWholePhrase(normalized, locality)) {
      return parentCity;
    }
  }

  return null;
}

function getLocationEntities(
  value: string | null | undefined,
): string[] {
  const normalized = normalizeForComparison(value);

  if (!normalized) {
    return [];
  }

  const entities = new Set<string>();

  for (const city of getKnownCityMatches(normalized)) {
    entities.add(city);
  }

  for (const [locality, parentCity] of Object.entries(
    LOCALITY_TO_CITY,
  )) {
    if (containsWholePhrase(normalized, locality)) {
      entities.add(parentCity);
    }
  }

  return Array.from(entities);
}

function hasExplicitLocationConflict(
  result: {
    url: string;
    title: string;
    description: string;
  },
  query: DiscoveryQuery,
): boolean {
  const requestedCity =
    getCityVariants(query.city)[0] ?? null;

  if (!requestedCity) {
    return false;
  }

  const strongText =
    `${result.title} ${getPath(result.url)} ${getHostname(result.url)}`;

  const strongLocations =
    getLocationEntities(strongText);

  return strongLocations.some(
    (location) => location !== requestedCity,
  );
}

function hasExplicitConflictingCity(
  result: {
    url: string;
    title: string;
    description: string;
  },
  query: DiscoveryQuery,
): boolean {
  const requestedCity = normalizeForComparison(
    query.city,
  );

  if (!requestedCity) {
    return false;
  }

  const requestedVariants = new Set(
    getCityVariants(query.city),
  );

  const strongText =
    `${result.title} ${getPath(result.url)} ${getHostname(result.url)}`;

  const explicitLocations =
    getLocationEntities(strongText);

  if (
    explicitLocations.some(
      (location) => !requestedVariants.has(location),
    )
  ) {
    return true;
  }

  /*
   * Title and URL are strong identity/location signals.
   * This catches pages such as:
   * "Oliva Clinic - Sholinganallur, Chennai"
   * when the requested city is Vadodara.
   */
  const strongLocationText =
    `${result.title} ${getPath(result.url)} ${getHostname(result.url)}`;

  const strongCities =
    getKnownCityMatches(strongLocationText);

  const hasDifferentStrongCity =
    strongCities.some(
      (city) => !requestedVariants.has(city),
    );

  if (hasDifferentStrongCity) {
    return true;
  }

  /*
   * Descriptions can contain broader service-area information.
   * Only treat a non-target city in the description as a conflict when
   * it appears near explicit location/address wording.
   */
  const description =
    normalizeForComparison(result.description);

  if (!description) {
    return false;
  }

  const locationPrefixes = [
    "located in",
    "based in",
    "situated in",
    "clinic in",
    "hospital in",
    "office in",
    "branch in",
    "at ",
    "address ",
  ];

  for (const prefix of locationPrefixes) {
    const prefixIndex = description.indexOf(
      normalizeForComparison(prefix),
    );

    if (prefixIndex === -1) {
      continue;
    }

    const nearbyText = description.slice(
      prefixIndex,
      prefixIndex + 100,
    );

    const nearbyCities =
      getKnownCityMatches(nearbyText);

    if (
      nearbyCities.some(
        (city) => !requestedVariants.has(city),
      )
    ) {
      return true;
    }
  }

  return false;
}

/* -------------------------------------------------------------------------- */
/* SEARCH RESULT TYPES                                                        */
/* -------------------------------------------------------------------------- */

type SearXNGResult = {
  url?: unknown;
  title?: unknown;
  content?: unknown;
  description?: unknown;
  engine?: unknown;
  category?: unknown;
};

type SearXNGResponse = {
  results?: unknown;
};

/* -------------------------------------------------------------------------- */
/* INDUSTRY / QUERY EXPANSION                                                 */
/* -------------------------------------------------------------------------- */

function inferIndustry(
  query: DiscoveryQuery,
): string | null {
  if (query.industry?.trim()) {
    return query.industry.trim();
  }

  const text = normalizeForComparison(query.text);

  const mappings: Array<{
    keywords: string[];
    industry: string;
  }> = [
    {
      keywords: [
        "skin care",
        "skincare",
        "skin clinic",
        "dermatology",
        "dermatologist",
        "skin specialist",
        "aesthetic clinic",
        "cosmetic clinic",
      ],
      industry: "dermatology",
    },
    {
      keywords: [
        "dentist",
        "dental",
        "dentistry",
        "dental clinic",
      ],
      industry: "dental",
    },
    {
      keywords: [
        "restaurant",
        "restaurants",
        "fine dining",
      ],
      industry: "restaurant",
    },
    {
      keywords: [
        "cafe",
        "cafes",
        "coffee shop",
        "coffee",
      ],
      industry: "cafe",
    },
    {
      keywords: [
        "hotel",
        "hotels",
        "resort",
        "hospitality",
      ],
      industry: "hospitality",
    },
    {
      keywords: [
        "gym",
        "fitness",
        "fitness center",
      ],
      industry: "fitness",
    },
    {
      keywords: [
        "salon",
        "beauty",
        "beauty salon",
      ],
      industry: "beauty",
    },
    {
      keywords: [
        "real estate",
        "property",
        "property dealer",
      ],
      industry: "real estate",
    },
    {
      keywords: [
        "lawyer",
        "law firm",
        "legal",
        "advocate",
      ],
      industry: "legal",
    },
    {
      keywords: [
        "marketing agency",
        "digital agency",
        "creative agency",
        "marketing",
      ],
      industry: "marketing",
    },
    {
      keywords: [
        "photographer",
        "photography",
        "photo studio",
      ],
      industry: "photography",
    },
  ];

  for (const mapping of mappings) {
    if (
      mapping.keywords.some((keyword) =>
        text.includes(
          normalizeForComparison(keyword),
        ),
      )
    ) {
      return mapping.industry;
    }
  }

  return null;
}

function getIndustryTerms(
  query: DiscoveryQuery,
): string[] {
  const industry = normalizeForComparison(
    query.industry ?? query.text,
  );

  if (!industry) {
    return ["business", "company"];
  }

  const mappings: Record<string, string[]> = {
    "skin care": [
      "skin clinic",
      "dermatologist",
      "dermatology clinic",
      "skin specialist",
      "aesthetic clinic",
      "cosmetic clinic",
      "skin care",
      "skincare",
      "skin",
    ],

    skincare: [
      "skin clinic",
      "dermatologist",
      "dermatology clinic",
      "skin specialist",
      "aesthetic clinic",
      "cosmetic clinic",
      "skin care",
      "skincare",
      "skin",
    ],

    dermatology: [
      "dermatologist",
      "dermatology clinic",
      "skin clinic",
      "skin specialist",
      "aesthetic clinic",
      "cosmetic clinic",
      "skin care",
      "skincare",
    ],

    dental: [
      "dentist",
      "dental clinic",
      "dental hospital",
      "orthodontist",
    ],

    dentistry: [
      "dentist",
      "dental clinic",
      "dental hospital",
      "orthodontist",
    ],

    restaurant: [
      "restaurant",
      "fine dining",
      "family restaurant",
      "food restaurant",
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
      "boutique hotel",
      "guest house",
    ],

    hospitality: [
      "hotel",
      "resort",
      "boutique hotel",
      "guest house",
    ],

    gym: [
      "gym",
      "fitness center",
      "fitness club",
      "health club",
    ],

    fitness: [
      "gym",
      "fitness center",
      "fitness club",
      "health club",
    ],

    salon: [
      "salon",
      "beauty salon",
      "hair salon",
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

    "law firm": [
      "law firm",
      "lawyer",
      "advocate",
      "legal services",
    ],

    legal: [
      "law firm",
      "lawyer",
      "advocate",
      "legal services",
    ],

    marketing: [
      "marketing agency",
      "digital marketing agency",
      "creative agency",
      "advertising agency",
    ],

    "marketing agency": [
      "marketing agency",
      "digital marketing agency",
      "creative agency",
      "advertising agency",
    ],

    agency: [
      "marketing agency",
      "creative agency",
      "digital agency",
      "advertising agency",
    ],

    photography: [
      "photographer",
      "photography studio",
      "photo studio",
    ],

    photographer: [
      "photographer",
      "photography studio",
      "photo studio",
    ],
  };

  return (
    mappings[industry] ?? [
      query.industry?.trim() ?? "business",
      "company",
    ]
  );
}

/* -------------------------------------------------------------------------- */
/* QUERY BUILDING                                                             */
/* -------------------------------------------------------------------------- */

function buildDiscoveryQueries(
  query: DiscoveryQuery,
): string[] {
  const city = normalizeText(query.city);
  const country = normalizeText(query.country);
  const industryTerms = getIndustryTerms(query);

  const queries: string[] = [];

  const specificBusiness = normalizeText(
    query.text,
  );

  const genericTerms = new Set([
    "business",
    "businesses",
    "company",
    "companies",
    "restaurant",
    "restaurants",
    "cafe",
    "cafes",
    "hotel",
    "hotels",
    "gym",
    "gyms",
    "salon",
    "salons",
    "clinic",
    "clinics",
    "dentist",
    "dentists",
    "skincare",
    "skin care",
    "dermatology",
    "marketing agency",
    "digital agency",
    "real estate",
    "law firm",
    "lawyer",
  ]);

  const normalizedSpecific =
    normalizeForComparison(
      specificBusiness,
    );

  const isSpecificBusiness =
    normalizedSpecific.length > 0 &&
    !genericTerms.has(normalizedSpecific);

  if (isSpecificBusiness && city) {
    queries.push(
      `"${specificBusiness}" "${city}"`,
    );

    queries.push(
      `"${specificBusiness}" "${city}" official website`,
    );
  }

  for (const term of industryTerms) {
    if (city && country) {
      queries.push(
        `"${term}" "${city}" "${country}"`,
      );
    }

    if (city) {
      queries.push(
        `"${term}" "${city}"`,
      );

      queries.push(
        `"${term}" "${city}" "official website"`,
      );

      queries.push(
        `"${term}" "${city}" contact`,
      );
    }
  }

  if (city) {
    queries.push(
      `"${city}" "${industryTerms[0]}" "about us"`,
    );

    queries.push(
      `"${city}" "${industryTerms[0]}" "contact us"`,
    );

    queries.push(
      `"${city}" "${industryTerms[0]}" "our services"`,
    );
  }

  return Array.from(
    new Set(
      queries
        .map((value) =>
          value
            .replace(/\s+/g, " ")
            .trim(),
        )
        .filter(Boolean),
    ),
  ).slice(0, MAX_QUERIES);
}

/* -------------------------------------------------------------------------- */
/* BUSINESS NAME EXTRACTION                                                   */
/* -------------------------------------------------------------------------- */

function cleanTitle(title: string): string {
  let result = normalizeText(title);

  result = result
    .replace(
      /\s*[|–—-]\s*(official website|official site|homepage|home|contact|contact us|about us|about)$/i,
      "",
    )
    .trim();

  return result;
}

function titleLooksLikeContent(
  title: string,
): boolean {
  const normalized =
    normalizeForComparison(title);

  if (!normalized) {
    return true;
  }

  return BLOCKED_TITLE_PATTERNS.some(
    (pattern) =>
      normalized.includes(
        normalizeForComparison(pattern),
      ),
  );
}

function titleLooksLikeBusiness(
  title: string,
  query: DiscoveryQuery,
): boolean {
  const cleaned = cleanTitle(title);

  if (!cleaned) {
    return false;
  }

  const normalized =
    normalizeForComparison(cleaned);

  if (normalized.length < 2) {
    return false;
  }

  if (titleLooksLikeContent(cleaned)) {
    return false;
  }

  const blocked = new Set([
    "search",
    "home",
    "homepage",
    "welcome",
    "login",
    "sign in",
    "sign up",
    "contact us",
    "about us",
    "services",
    "our services",
    "official website",
    "official site",
    "business",
    "businesses",
    "companies",
    "company",
  ]);

  if (blocked.has(normalized)) {
    return false;
  }

  const requested = tokenize(query.text);

  if (
    requested.length > 0 &&
    requested.length <= 5
  ) {
    const titleTokens =
      new Set(tokenize(cleaned));

    const overlap =
      requested.filter((token) =>
        titleTokens.has(token),
      ).length;

    if (
      overlap === 0 &&
      query.industry
    ) {
      const industryTerms =
        getIndustryTerms(query);

      const industryOverlap =
        industryTerms.some((term) =>
          normalized.includes(
            normalizeForComparison(term),
          ),
        );

      /*
       * IMPORTANT:
       * For a generic industry search, a real business
       * may have a brand name that contains none of the
       * requested industry words.
       *
       * We therefore DO NOT reject the title here.
       *
       * The business gate below uses the URL, snippet,
       * industry terms and business signals instead.
       */
      if (
        !industryOverlap &&
        normalized.length < 4
      ) {
        return false;
      }
    }
  }

  return true;
}

/* -------------------------------------------------------------------------- */
/* BUSINESS SIGNAL DETECTION                                                  */
/* -------------------------------------------------------------------------- */

function businessSignalScore(
  result: {
    url: string;
    title: string;
    description: string;
  },
  query: DiscoveryQuery,
): number {
  let score = 0;

  const title =
    normalizeForComparison(result.title);

  const description =
    normalizeForComparison(
      result.description,
    );

  const combined =
    `${title} ${description}`;

  const industry =
    normalizeForComparison(
      query.industry ?? query.text,
    );

  const city =
    normalizeForComparison(query.city);

  const industryTerms =
    getIndustryTerms(query);

  /* Industry signal */

  if (
    industry &&
    combined.includes(industry)
  ) {
    score += 15;
  }

  for (const term of industryTerms) {
    if (
      combined.includes(
        normalizeForComparison(term),
      )
    ) {
      score += 20;
      break;
    }
  }

  /* Location signal */

  if (
    city &&
    combined.includes(city)
  ) {
    score += 15;
  }

  /* Business-page signals */

  const businessSignals = [
    "contact",
    "appointment",
    "book appointment",
    "our services",
    "services",
    "about us",
    "location",
    "visit us",
    "call us",
    "opening hours",
    "hours",
    "team",
    "clinic",
    "hospital",
    "restaurant",
    "cafe",
    "hotel",
    "salon",
    "agency",
    "studio",
    "law firm",
    "dentist",
    "dermatologist",
    "doctor",
    "physician",
    "consultant",
    "company",
  ];

  let matchedBusinessSignals = 0;

  for (const signal of businessSignals) {
    if (
      combined.includes(
        normalizeForComparison(signal),
      )
    ) {
      matchedBusinessSignals += 1;
    }
  }

  score += Math.min(
    matchedBusinessSignals * 5,
    25,
  );

  /* Source strength */

  if (isSocialUrl(result.url)) {
    score += 5;
  }

  if (
    !isDirectoryUrl(result.url) &&
    !isSocialUrl(result.url)
  ) {
    score += 15;
  }

  return Math.min(score, 100);
}

/* -------------------------------------------------------------------------- */
/* BUSINESS RESULT GATE                                                       */
/* -------------------------------------------------------------------------- */

function hasClearlyNonBusinessSignal(
  title: string,
  description: string,
): boolean {
  const combined =
    normalizeForComparison(
      `${title} ${description}`,
    );

  const hardRejectSignals = [
    "microsoft support",
    "microsoft copilot",
    "support microsoft",
    "unscramble",
    "unscrambled",
    "word unscrambler",
    "vietnam tourism",
    "vietnamese food",
    "street food",
    "must try",
    "travel guide",
    "tourism",
    "wikipedia",
    "healthline",
    "webmd",
    "medical news today",
    "minecraft",
    "skin editor",
    "skin catalog",
    "skin database",
    "recipe",
    "recipes",
    "how to",
    "tutorial",
    "article",
    "news",
    "blog",
  ];

  return hardRejectSignals.some((signal) =>
    combined.includes(
      normalizeForComparison(signal),
    ),
  );
}

function hasStrongBusinessEntitySignal(
  title: string,
  description: string,
  query: DiscoveryQuery,
): boolean {
  const combined =
    normalizeForComparison(
      `${title} ${description}`,
    );

  const businessTerms = [
    "clinic",
    "hospital",
    "dermatologist",
    "dermatology",
    "skin clinic",
    "skin specialist",
    "skin care",
    "skincare",
    "aesthetic clinic",
    "cosmetic clinic",
    "dentist",
    "dental clinic",
    "doctor",
    "physician",
    "restaurant",
    "cafe",
    "coffee shop",
    "hotel",
    "resort",
    "salon",
    "spa",
    "gym",
    "fitness",
    "agency",
    "studio",
    "law firm",
    "lawyer",
    "advocate",
    "real estate",
    "property",
    "photographer",
    "photography",
    "marketing agency",
    "consultant",
    "company",
    "services",
    "store",
    "shop",
  ];

  if (
    businessTerms.some((term) =>
      combined.includes(
        normalizeForComparison(term),
      ),
    )
  ) {
    return true;
  }

  const industryTerms =
    getIndustryTerms(query);

  return industryTerms.some((term) =>
    combined.includes(
      normalizeForComparison(term),
    ),
  );
}

/* -------------------------------------------------------------------------- */
/* BUSINESS DOMAIN SIGNAL                                                     */
/* -------------------------------------------------------------------------- */

function isGenericBusinessHost(
  hostname: string,
): boolean {
  const genericHosts = [
    "facebook.com",
    "instagram.com",
    "linkedin.com",
    "youtube.com",
    "twitter.com",
    "x.com",
    "tiktok.com",
    "reddit.com",
    "google.com",
    "bing.com",
    "yahoo.com",
  ];

  return genericHosts.some((host) =>
    hostMatches(hostname, host),
  );
}

function hasDedicatedBusinessDomain(
  url: string,
): boolean {
  const hostname = getHostname(url);

  if (!hostname) {
    return false;
  }

  if (isGenericBusinessHost(hostname)) {
    return false;
  }

  if (isDirectoryUrl(url)) {
    return false;
  }

  if (isContentUrl(url)) {
    return false;
  }

  if (isSearchEngineUrl(url)) {
    return false;
  }

  return true;
}

/* -------------------------------------------------------------------------- */
/* BUSINESS RESULT GATE                                                       */
/* -------------------------------------------------------------------------- */

function passesBusinessGate(
  result: {
    url: string;
    title: string;
    description: string;
  },
  query: DiscoveryQuery,
): boolean {
  const title =
    normalizeForComparison(result.title);

  const description =
    normalizeForComparison(result.description);

  const combined =
    `${title} ${description}`;

  /* ------------------------------------------------------------------------ */
  /* 1. Reject obvious non-business/content results                           */
  /* ------------------------------------------------------------------------ */

  if (
    hasClearlyNonBusinessSignal(
      result.title,
      result.description,
    )
  ) {
    return false;
  }

  /* ------------------------------------------------------------------------ */
  /* 2. Reject obvious listing / marketplace / category pages                 */
  /* ------------------------------------------------------------------------ */

  const listingSignals = [
    "dermatologists in ",
    "dentists in ",
    "doctors in ",
    "clinics in ",
    "restaurants in ",
    "salons in ",
    "gyms in ",
    "hotels in ",
    "photographers in ",
    "agencies in ",
    "lawyers in ",
    "specialists in ",
    "near you",
    "near me",
    "book appointment online",
    "book online",
    "find a doctor",
    "find doctors",
    "find a dermatologist",
    "find dermatologists",
    "find a clinic",
    "compare doctors",
    "compare clinics",
    "listing page",
    "listing",
    "directory",
    "marketplace",
    "browse doctors",
    "browse clinics",
    "browse specialists",
  ];

  /*
   * We deliberately DO NOT reject generic words such as
   * "specialty", "category", or "services".
   *
   * Those words can legitimately appear on a business website.
   */

  if (
    listingSignals.some((signal) =>
      combined.includes(
        normalizeForComparison(signal),
      ),
    )
  ) {
    return false;
  }

  /* ------------------------------------------------------------------------ */
  /* 3. Reject known directory / marketplace domains                          */
  /* ------------------------------------------------------------------------ */

  if (isDirectoryUrl(result.url)) {
    return false;
  }

  /* ------------------------------------------------------------------------ */
  /* 4. Reject content URLs                                                    */
  /* ------------------------------------------------------------------------ */

  if (isContentUrl(result.url)) {
    return false;
  }

  /* ------------------------------------------------------------------------ */
  /* 5. Search engine result URLs                                              */
  /* ------------------------------------------------------------------------ */

  if (isSearchEngineUrl(result.url)) {
    return false;
  }

  /* ------------------------------------------------------------------------ */
  /* 6. Reject media/video pages that are not business profiles                */
  /* ------------------------------------------------------------------------ */

  const hostname =
    getHostname(result.url);

  const path =
    getPath(result.url);

  if (
    hostMatches(hostname, "youtube.com") ||
    hostMatches(hostname, "youtu.be")
  ) {
    const normalizedTitle =
      normalizeForComparison(result.title);

    const normalizedDescription =
      normalizeForComparison(result.description);

    const mediaSignals = [
      "lyric video",
      "official lyric",
      "official video",
      "music video",
      "song",
      "lyrics",
      "trailer",
      "episode",
      "short film",
      "full video",
      "live performance",
      "official audio",
      "album",
      "track",
      "vevo",
    ];

    const combinedMediaText =
      `${normalizedTitle} ${normalizedDescription}`;

    if (
      mediaSignals.some((signal) =>
        combinedMediaText.includes(
          normalizeForComparison(signal),
        ),
      ) ||
      path.includes("/watch") ||
      path.includes("/shorts/")
    ) {
      return false;
    }

    /*
     * YouTube is only allowed through when it looks like a
     * genuine business/channel profile rather than media content.
     */
    const youtubeBusinessSignals = [
      "official website",
      "clinic",
      "hospital",
      "dermatologist",
      "dentist",
      "restaurant",
      "cafe",
      "hotel",
      "salon",
      "gym",
      "agency",
      "studio",
      "law firm",
      "real estate",
      "photographer",
    ];

    if (
      !youtubeBusinessSignals.some((signal) =>
        combined.includes(
          normalizeForComparison(signal),
        ),
      )
    ) {
      return false;
    }
  }

  /* ------------------------------------------------------------------------ */
  /* 7. Social pages                                                           */
  /* ------------------------------------------------------------------------ */

  if (isSocialUrl(result.url)) {
    const path = getPath(result.url);

    const blockedSocialPaths = [
      "/search",
      "/share",
      "/sharer",
      "/dialog",
      "/intent/",
      "/hashtag/",
      "/explore/",
      "/topics/",
      "/groups/",
      "/events/",
    ];

    if (
      blockedSocialPaths.some((pattern) =>
        path.includes(pattern),
      )
    ) {
      return false;
    }

    const socialBusinessTerms = [
      "clinic",
      "dermatologist",
      "skin clinic",
      "skin specialist",
      "skin care",
      "skincare",
      "aesthetic clinic",
      "cosmetic clinic",
      "dentist",
      "dental clinic",
      "restaurant",
      "cafe",
      "hotel",
      "salon",
      "spa",
      "gym",
      "fitness",
      "agency",
      "studio",
      "law firm",
      "lawyer",
      "photographer",
      "marketing",
      "real estate",
      "official",
    ];

    return socialBusinessTerms.some((term) =>
      combined.includes(
        normalizeForComparison(term),
      ),
    );
  }

  /* ------------------------------------------------------------------------ */
  /* 8. Require a business entity signal                                      */
  /* ------------------------------------------------------------------------ */

  const hasBusinessEntity =
    hasStrongBusinessEntitySignal(
      result.title,
      result.description,
      query,
    );

  /*
   * A dedicated business domain can be enough when the
   * title/content clearly matches the requested industry.
   *
   * This fixes legitimate homepages such as:
   *
   * https://www.skinsioclinics.com/
   *
   * where SearXNG may return a short snippet without
   * "contact us" / "about us".
   */

  const dedicatedDomain =
    hasDedicatedBusinessDomain(
      result.url,
    );

  const industryTerms =
    getIndustryTerms(query);

  const hasIndustrySignal =
    industryTerms.some((term) =>
      combined.includes(
        normalizeForComparison(term),
      ),
    );

  if (
    dedicatedDomain &&
    hasIndustrySignal &&
    hasBusinessEntity
  ) {
    return true;
  }

  /*
   * For non-domain/social results we still require a
   * strong business entity signal.
   */

  if (!hasBusinessEntity) {
    return false;
  }

  /* ------------------------------------------------------------------------ */
  /* 9. Score the result                                                       */
  /* ------------------------------------------------------------------------ */

  const score = businessSignalScore(
    result,
    query,
  );

  return score >= 45;
}

/* -------------------------------------------------------------------------- */
/* RESULT FILTERING                                                           */
/* -------------------------------------------------------------------------- */

function shouldRejectResult(
  url: string,
  title: string,
): boolean {
  if (!url) {
    return true;
  }

  if (isSearchEngineUrl(url)) {
    return true;
  }

  if (isContentUrl(url)) {
    return true;
  }

  if (titleLooksLikeContent(title)) {
    return true;
  }

  return false;
}

/* -------------------------------------------------------------------------- */
/* SEARXNG REQUEST                                                            */
/* -------------------------------------------------------------------------- */

async function searchSearXNG(
  queryText: string,
): Promise<SearXNGResult[]> {
  const params = new URLSearchParams({
    q: queryText,
    format: "json",
    categories: "general",
    language: "en",
    safesearch: "0",
  });

  const controller =
    new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS,
  );

  try {
    const response = await fetch(
      `${SEARXNG_URL}/search?${params.toString()}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          "User-Agent":
            "SoleTrust-AutoRadar/1.0 (+public-business-discovery)",
        },
        signal: controller.signal,
        cache: "no-store",
      },
    );

    if (!response.ok) {
      throw new Error(
        `SearXNG returned HTTP ${response.status}`,
      );
    }

    const data =
      (await response.json()) as SearXNGResponse;

    if (!Array.isArray(data.results)) {
      return [];
    }

    return data.results
      .filter(
        (
          result,
        ): result is Record<
          string,
          unknown
        > =>
          typeof result === "object" &&
          result !== null,
      )
      .map((result) => ({
        url: result.url,
        title: result.title,
        content: result.content,
        description: result.description,
        engine: result.engine,
        category: result.category,
      }));
  } finally {
    clearTimeout(timeout);
  }
}

/* -------------------------------------------------------------------------- */
/* RESULT NORMALIZATION                                                       */
/* -------------------------------------------------------------------------- */

function getString(
  value: unknown,
): string | null {
  return typeof value === "string" &&
    value.trim()
    ? value.trim()
    : null;
}

function mapResultToCandidate(
  result: SearXNGResult,
  query: DiscoveryQuery,
): LeadInput | null {
  const rawUrl =
    getString(result.url);

  const title =
    getString(result.title);

  const description =
    getString(
      result.content ??
        result.description,
    );

  if (!rawUrl || !title) {
    return null;
  }

  const url =
    normalizeUrl(rawUrl);

  if (!url) {
    return null;
  }

  if (
    shouldRejectResult(
      url,
      title,
    )
  ) {
    return null;
  }

  if (
    hasExplicitConflictingCity(
      {
        url,
        title,
        description:
          description ?? "",
      },
      query,
    )
  ) {
    return null;
  }

  if (
    !titleLooksLikeBusiness(
      title,
      query,
    )
  ) {
    return null;
  }

  if (
    !passesBusinessGate(
      {
        url,
        title,
        description:
          description ?? "",
      },
      query,
    )
  ) {
    return null;
  }

  const sourceType =
    isSocialUrl(url)
      ? "searxng_social"
      : "searxng";

  /*
   * IMPORTANT:
   *
   * Search result URL is NOT automatically treated
   * as the official company website.
   *
   * Website identity is resolved downstream.
   */

  return {
    companyName:
      cleanTitle(title),

    website: null,

    industry:
      inferIndustry(query),

    country:
      query.country?.trim() ??
      null,

    city:
      query.city?.trim() ??
      null,

    employeeRange:
      null,

    serviceTrack:
      query.serviceTrack ??
      null,

    source:
      sourceType,

    sourceUrl:
      url,

    description:
      description || null,

    linkedinUrl:
      isSocialUrl(url) &&
      hostMatches(
        getHostname(url),
        "linkedin.com",
      )
        ? url
        : null,

    instagramUrl:
      isSocialUrl(url) &&
      hostMatches(
        getHostname(url),
        "instagram.com",
      )
        ? url
        : null,

    facebookUrl:
      isSocialUrl(url) &&
      hostMatches(
        getHostname(url),
        "facebook.com",
      )
        ? url
        : null,

    foundedYear:
      null,
  };
}

/* -------------------------------------------------------------------------- */
/* DEDUPLICATION                                                              */
/* -------------------------------------------------------------------------- */

function candidateKey(
  candidate: LeadInput,
): string {
  const companyName =
    typeof candidate.companyName ===
    "string"
      ? normalizeForComparison(
          candidate.companyName,
        )
      : "";

  const city =
    typeof candidate.city ===
    "string"
      ? normalizeForComparison(
          candidate.city,
        )
      : "";

  const sourceUrl =
    typeof candidate.sourceUrl ===
    "string"
      ? getHostname(
          candidate.sourceUrl,
        )
      : "";

  return [
    companyName,
    city,
    sourceUrl,
  ].join("|");
}

function candidateQuality(
  candidate: LeadInput,
  query: DiscoveryQuery,
): number {
  const companyName =
    typeof candidate.companyName ===
    "string"
      ? candidate.companyName
      : "";

  const description =
    typeof candidate.description ===
    "string"
      ? candidate.description
      : "";

  const sourceUrl =
    typeof candidate.sourceUrl ===
    "string"
      ? candidate.sourceUrl
      : "";

  return businessSignalScore(
    {
      url: sourceUrl,
      title: companyName,
      description,
    },
    query,
  );
}

/* -------------------------------------------------------------------------- */
/* PROVIDER                                                                   */
/* -------------------------------------------------------------------------- */

export class SearXNGDiscoveryProvider
  implements DiscoveryProvider
{
  readonly id = "searxng";

  async discover(
    query: DiscoveryQuery,
  ): Promise<DiscoveryResult> {
    const requestedLimit =
      Math.min(
        MAX_LIMIT,
        Math.max(
          1,
          Math.floor(
            Number(
              query.limit ??
                DEFAULT_LIMIT,
            ),
          ),
        ),
      );

    const queries =
      buildDiscoveryQueries(query);

    if (queries.length === 0) {
      return {
        candidates: [],
        nextCursor: null,
      };
    }

    console.log(
      `[SearXNG] Running ${queries.length} business discovery queries`,
    );

    let successfulQueries = 0;

    const queryResults =
      await Promise.all(
        queries.map(async (searchQuery) => {
          try {
            const results =
              await searchSearXNG(
                searchQuery,
              );

            successfulQueries += 1;

            console.log(
              `[SearXNG] "${searchQuery}" returned ${results.length} results`,
            );

            return results.slice(
              0,
              SEARCH_RESULTS_PER_QUERY,
            );
          } catch (error) {
            console.warn(
              `[SearXNG] Query failed: "${searchQuery}"`,
              error instanceof Error
                ? error.message
                : String(error),
            );

            return [];
          }
        }),
      );

    if (successfulQueries === 0) {
      throw new Error(
        `SearXNG could not complete any web searches. Check that it is running at ${SEARXNG_URL}.`,
      );
    }

    const rawResults =
      queryResults.flat();

    const candidates: LeadInput[] =
      [];

    let rejectedByLocation = 0;

    for (const result of rawResults) {
      try {
        const rawUrl =
          getString(result.url);

        const rawTitle =
          getString(result.title);

        const rawDescription =
          getString(
            result.content ??
              result.description,
          ) ?? "";

        if (
          rawUrl &&
          rawTitle &&
          hasExplicitConflictingCity(
            {
              url: normalizeUrl(rawUrl) ?? rawUrl,
              title: rawTitle,
              description: rawDescription,
            },
            query,
          )
        ) {
          rejectedByLocation += 1;
        }

        const candidate =
          mapResultToCandidate(
            result,
            query,
          );

        if (!candidate) {
          continue;
        }

        candidates.push(candidate);
      } catch {
        continue;
      }
    }

    const unique =
      new Map<
        string,
        LeadInput
      >();

    for (const candidate of candidates) {
      const key =
        candidateKey(candidate);

      if (!key) {
        continue;
      }

      const existing =
        unique.get(key);

      if (!existing) {
        unique.set(
          key,
          candidate,
        );

        continue;
      }

      const existingScore =
        candidateQuality(
          existing,
          query,
        );

      const newScore =
        candidateQuality(
          candidate,
          query,
        );

      if (
        newScore >
        existingScore
      ) {
        unique.set(
          key,
          candidate,
        );
      }
    }

    const ranked =
      Array.from(
        unique.values(),
      ).sort(
        (a, b) =>
          candidateQuality(
            b,
            query,
          ) -
          candidateQuality(
            a,
            query,
          ),
      );

    const discoveryLimit =
      Math.min(
        MAX_LIMIT,
        Math.max(
          requestedLimit * 3,
          requestedLimit,
        ),
      );

    const finalCandidates =
      ranked.slice(
        0,
        discoveryLimit,
      );

    console.log(
      `[SearXNG] Discovery completed: ${finalCandidates.length} candidates from ${rawResults.length} raw search results. Rejected by location: ${rejectedByLocation}`,
    );

    return {
      candidates:
        finalCandidates,

      nextCursor:
        null,
    };
  }
}

/* -------------------------------------------------------------------------- */
/* SINGLETON                                                                  */
/* -------------------------------------------------------------------------- */

export const searxngProvider =
  new SearXNGDiscoveryProvider();
  
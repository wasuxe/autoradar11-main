import type {
  BusinessResearchInput,
  ResearchCandidate,
  ResearchSourceType,
} from "@/lib/research/types";

type SearXNGResult = {
  url?: unknown;
  title?: unknown;
  content?: unknown;
};

type SearXNGResponse = {
  results?: unknown;
};

export interface SearXNGSearchOptions {
  limit?: number;
  timeoutMs?: number;
}

export interface SearXNGSearchResult {
  candidates: ResearchCandidate[];
  warnings: string[];
  query: string;
  searchedAt: string;
}

const DEFAULT_SEARXNG_URL = "http://localhost:8080";
const DEFAULT_LIMIT = 20;
const DEFAULT_TIMEOUT_MS = 12_000;

const MAX_RESULTS_PER_QUERY = 30;
const MAX_QUERIES = 18;

/* -------------------------------------------------------------------------- */
/* HOST FILTERS                                                               */
/* -------------------------------------------------------------------------- */

const SOCIAL_HOSTS = [
  "instagram.com",
  "facebook.com",
  "linkedin.com",
  "x.com",
  "twitter.com",
  "youtube.com",
  "tiktok.com",
];

const DIRECTORY_HOSTS = [
  "justdial.com",
  "sulekha.com",
  "practo.com",
  "yelp.com",
  "tripadvisor.com",
  "foursquare.com",
  "yellowpages.com",
  "indiamart.com",
  "tradeindia.com",
  "magicpin.in",
  "zaubacorp.com",
  "webindia123.com",
  "medindia.net",
  "dentee.com",
  "bewtee.com",
  "hexahealth.com",
  "rocketreach.co",
  "zoominfo.com",
  "apollo.io",
  "crunchbase.com",
  "near-me",
];

const SEARCH_ENGINE_HOSTS = [
  "google.com",
  "google.co.in",
  "bing.com",
  "yahoo.com",
  "duckduckgo.com",
];

const CONTENT_HOSTS = [
  "wikipedia.org",
  "wikimedia.org",
  "medium.com",
  "webmd.com",
  "healthline.com",
  "mayoclinic.org",
  "clevelandclinic.org",
  "verywellhealth.com",
  "medicalnewstoday.com",
  "nhs.uk",
];

/* -------------------------------------------------------------------------- */
/* GENERIC TERMS                                                              */
/* -------------------------------------------------------------------------- */

const GENERIC_BUSINESS_TERMS = new Set([
  "the",
  "and",
  "of",
  "in",
  "at",
  "for",
  "a",
  "an",
  "clinic",
  "clinics",
  "hospital",
  "hospitals",
  "centre",
  "center",
  "studio",
  "agency",
  "company",
  "co",
  "limited",
  "ltd",
  "llp",
  "pvt",
  "private",
  "skin",
  "care",
  "health",
  "healthcare",
  "medical",
  "medicine",
  "beauty",
  "aesthetic",
  "aesthetics",
  "cosmetic",
  "cosmetics",
  "services",
  "service",
  "group",
  "wellness",
  "dental",
  "dermatology",
  "dermatologist",
]);

const BUSINESS_TERMS = [
  "clinic",
  "hospital",
  "dermatologist",
  "dermatology",
  "skin",
  "skincare",
  "skin care",
  "aesthetic",
  "aesthetics",
  "cosmetic",
  "beauty",
  "doctor",
  "medical",
  "health",
  "dental",
  "dentist",
  "restaurant",
  "cafe",
  "coffee",
  "hotel",
  "resort",
  "salon",
  "gym",
  "fitness",
  "agency",
  "studio",
  "law",
  "lawyer",
  "real estate",
  "property",
  "photography",
  "photographer",
  "marketing",
  "advertising",
  "services",
];

const NON_BUSINESS_TITLE_PATTERNS = [
  "lyrics",
  "lyric video",
  "official audio",
  "music video",
  "song",
  "trailer",
  "episode",
  "movie",
  "film",
  "wikipedia",
  "meaning",
  "definition",
  "what is",
  "how to",
  "best ",
  "top ",
  "list of",
  "near me",
  "reviews of",
  "review of",
];

/* -------------------------------------------------------------------------- */
/* MEDIA                                                                      */
/* -------------------------------------------------------------------------- */

const MEDIA_HOSTS = [
  "youtube.com",
  "youtu.be",
  "spotify.com",
  "soundcloud.com",
  "vimeo.com",
];

const MEDIA_PATHS = [
  "/watch",
  "/shorts/",
  "/video/",
  "/videos/",
  "/music/",
  "/playlist",
  "/clip/",
];

const MEDIA_TEXT = [
  "lyric video",
  "official lyric",
  "official audio",
  "music video",
  "full video",
  "live performance",
  "trailer",
  "episode",
  "album",
  "track",
  "lyrics",
];

/* -------------------------------------------------------------------------- */
/* BASIC HELPERS                                                              */
/* -------------------------------------------------------------------------- */

function getSearXNGUrl(): string {
  const configured = process.env.SEARXNG_URL?.trim();

  if (!configured) {
    return DEFAULT_SEARXNG_URL;
  }

  return configured.replace(/\/+$/, "");
}

function cleanString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const cleaned = value.trim();

  return cleaned.length > 0 ? cleaned : null;
}

function normalizeText(
  value: string | null | undefined,
): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

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

function getHostname(value: string): string {
  try {
    return new URL(value)
      .hostname
      .toLowerCase()
      .replace(/^www\./, "");
  } catch {
    return "";
  }
}

function getPath(value: string): string {
  try {
    return new URL(value)
      .pathname
      .toLowerCase();
  } catch {
    return "";
  }
}

function matchesHost(
  hostname: string,
  hosts: string[],
): boolean {
  return hosts.some(
    (host) =>
      hostname === host ||
      hostname.endsWith(`.${host}`),
  );
}

function isSocialHost(url: string): boolean {
  return matchesHost(
    getHostname(url),
    SOCIAL_HOSTS,
  );
}

function isDirectoryHost(url: string): boolean {
  return matchesHost(
    getHostname(url),
    DIRECTORY_HOSTS,
  );
}

function isSearchEngineHost(url: string): boolean {
  return matchesHost(
    getHostname(url),
    SEARCH_ENGINE_HOSTS,
  );
}

function isContentHost(url: string): boolean {
  return matchesHost(
    getHostname(url),
    CONTENT_HOSTS,
  );
}

function isMediaUrl(
  url: string,
  title: string | null,
  description: string | null,
): boolean {
  const hostname = getHostname(url);
  const path = getPath(url);

  if (matchesHost(hostname, MEDIA_HOSTS)) {
    if (
      MEDIA_PATHS.some((item) =>
        path.includes(item),
      )
    ) {
      return true;
    }

    const text = normalizeText(
      `${title ?? ""} ${description ?? ""}`,
    );

    if (
      MEDIA_TEXT.some((item) =>
        text.includes(item),
      )
    ) {
      return true;
    }
  }

  return false;
}

function isBlockedSearchResult(url: string): boolean {
  return (
    isSearchEngineHost(url) ||
    isSocialHost(url) ||
    isMediaUrl(url, null, null)
  );
}

function getMeaningfulTokens(
  businessName: string,
): string[] {
  return normalizeText(businessName)
    .split(" ")
    .filter(
      (token) =>
        token.length >= 3 &&
        !GENERIC_BUSINESS_TERMS.has(token),
    );
}

function getAllBusinessTokens(
  businessName: string,
): string[] {
  return normalizeText(businessName)
    .split(" ")
    .filter((token) => token.length >= 2);
}

function exactBusinessMatch(
  businessName: string,
  text: string,
): boolean {
  const business = normalizeText(businessName);
  const candidate = normalizeText(text);

  return (
    business.length > 0 &&
    candidate.includes(business)
  );
}

function businessTokenRatio(
  businessName: string,
  text: string,
): number {
  const tokens = getMeaningfulTokens(
    businessName,
  );

  if (tokens.length === 0) {
    return 0;
  }

  const normalized = normalizeText(text);

  const matched = tokens.filter((token) =>
    normalized.includes(token),
  );

  return matched.length / tokens.length;
}

function domainTokenRatio(
  businessName: string,
  url: string,
): number {
  const hostname = getHostname(url);

  if (!hostname) {
    return 0;
  }

  const domainPart = hostname
    .split(".")[0]
    .replace(/[-_]/g, " ");

  const tokens = getMeaningfulTokens(
    businessName,
  );

  if (tokens.length === 0) {
    return 0;
  }

  const matched = tokens.filter((token) =>
    domainPart.includes(token),
  );

  return matched.length / tokens.length;
}

function hasBusinessSignal(
  title: string | null,
  description: string | null,
  input: BusinessResearchInput,
): boolean {
  const text = normalizeText(
    `${title ?? ""} ${description ?? ""} ${
      input.businessName
    } ${input.industry ?? ""}`,
  );

  return BUSINESS_TERMS.some((term) =>
    text.includes(normalizeText(term)),
  );
}

function looksLikeContentTitle(
  title: string | null,
): boolean {
  const normalized = normalizeText(title);

  if (!normalized) {
    return false;
  }

  return NON_BUSINESS_TITLE_PATTERNS.some(
    (pattern) =>
      normalized.includes(
        normalizeText(pattern),
      ),
  );
}

/* -------------------------------------------------------------------------- */
/* QUERY GENERATION                                                           */
/* -------------------------------------------------------------------------- */

function uniqueQueries(
  queries: string[],
): string[] {
  return [
    ...new Set(
      queries
        .map((query) => query.trim())
        .filter(Boolean),
    ),
  ];
}

function buildSearchQueries(
  input: BusinessResearchInput,
): string[] {
  const business =
    input.businessName.trim();

  const city =
    input.city?.trim() ?? "";

  const country =
    input.country?.trim() ?? "";

  const industry =
    input.industry?.trim() ?? "";

  const queries: string[] = [];

  /*
   * EXACT IDENTITY QUERIES
   *
   * These come first because the official domain is often
   * returned by an exact-name search even when it is absent
   * from broad industry searches.
   */

  if (business && city && country) {
    queries.push(
      `"${business}" "${city}" "${country}"`,
    );
  }

  if (business && city) {
    queries.push(
      `"${business}" "${city}"`,
    );

    queries.push(
      `"${business}" "${city}" website`,
    );

    queries.push(
      `"${business}" "${city}" official website`,
    );

    queries.push(
      `"${business}" "${city}" official`,
    );

    queries.push(
      `"${business}" "${city}" contact`,
    );
  }

  if (business && country) {
    queries.push(
      `"${business}" "${country}"`,
    );
  }

  /*
   * DOMAIN-DISCOVERY QUERIES
   *
   * These are deliberately different from normal
   * business searches.
   */

  if (business && city) {
    queries.push(
      `"${business}" "${city}" -justdial -practo -sulekha`,
    );

    queries.push(
      `"${business}" "${city}" -facebook -instagram -linkedin`,
    );
  }

  if (business) {
    queries.push(
      `"${business}" official website`,
    );

    queries.push(
      `"${business}" official site`,
    );

    queries.push(
      `"${business}" website`,
    );

    queries.push(
      `"${business}" contact`,
    );
  }

  /*
   * INDUSTRY CONTEXT
   */

  if (business && city && industry) {
    queries.push(
      `"${business}" "${city}" "${industry}"`,
    );

    queries.push(
      `"${business}" ${city} ${industry}`,
    );
  }

  /*
   * SEARCH ENGINE FRIENDLY VARIANT
   *
   * Some engines perform better when only the business
   * name is quoted.
   */

  if (business && city) {
    queries.push(
      `"${business}" ${city} ${country}`,
    );
  }

  /*
   * STRIPPED GENERIC-NAME VARIANT
   *
   * Example:
   * "Krishna ENT and Skin Hospital"
   * -> "Krishna ENT"
   *
   * This can find a domain whose title omits
   * "Skin Hospital".
   */

  const meaningful =
    getMeaningfulTokens(business);

  if (
    meaningful.length >= 1 &&
    city
  ) {
    const shortened =
      meaningful.join(" ");

    queries.push(
      `"${shortened}" "${city}"`,
    );

    queries.push(
      `"${shortened}" "${city}" website`,
    );

    queries.push(
      `"${shortened}" "${city}" official`,
    );
  }

  return uniqueQueries(queries).slice(
    0,
    MAX_QUERIES,
  );
}

/* -------------------------------------------------------------------------- */
/* SEARXNG HTTP                                                               */
/* -------------------------------------------------------------------------- */

async function fetchSearXNG(
  query: string,
  timeoutMs: number,
): Promise<SearXNGResponse> {
  const baseUrl =
    getSearXNGUrl();

  const url = new URL(
    "/search",
    `${baseUrl}/`,
  );

  url.searchParams.set(
    "q",
    query,
  );

  url.searchParams.set(
    "format",
    "json",
  );

  url.searchParams.set(
    "categories",
    "general",
  );

  url.searchParams.set(
    "language",
    "en",
  );

  url.searchParams.set(
    "safesearch",
    "0",
  );

  const controller =
    new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    timeoutMs,
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
              "SoleTrust-AutoRadar/1.0 (+public-business-research)",
          },
          signal:
            controller.signal,
          cache: "no-store",
        },
      );

    if (!response.ok) {
      throw new Error(
        `SearXNG returned HTTP ${response.status} ${response.statusText}`,
      );
    }

    return (await response.json()) as SearXNGResponse;
  } finally {
    clearTimeout(timeout);
  }
}

function extractResults(
  data: SearXNGResponse,
): SearXNGResult[] {
  if (!Array.isArray(data.results)) {
    return [];
  }

  return data.results.filter(
    (
      result,
    ): result is SearXNGResult =>
      typeof result === "object" &&
      result !== null,
  );
}

/* -------------------------------------------------------------------------- */
/* RESULT MAPPING                                                             */
/* -------------------------------------------------------------------------- */

function classifySourceType(
  url: string,
): ResearchSourceType {
  const hostname =
    getHostname(url);

  if (
    matchesHost(
      hostname,
      DIRECTORY_HOSTS,
    )
  ) {
    return "public_directory";
  }

  if (
    matchesHost(
      hostname,
      SOCIAL_HOSTS,
    )
  ) {
    return "public_social";
  }

  return "public_web";
}

function mapResult(
  result: SearXNGResult,
  input: BusinessResearchInput,
): ResearchCandidate | null {
  const rawUrl =
    cleanString(result.url);

  if (!rawUrl) {
    return null;
  }

  const url =
    normalizeUrl(rawUrl);

  if (!url) {
    return null;
  }

  const title =
    cleanString(result.title);

  const description =
    cleanString(result.content);

  /*
   * Never pass search engines, social pages or media
   * pages into identity verification.
   */
  if (
    isBlockedSearchResult(url) ||
    isMediaUrl(
      url,
      title,
      description,
    )
  ) {
    return null;
  }

  /*
   * Content sites can occasionally contain a real business
   * profile, but only retain it when the exact business name
   * appears.
   */
  if (isContentHost(url)) {
    const text =
      `${title ?? ""} ${description ?? ""}`;

    if (
      !exactBusinessMatch(
        input.businessName,
        text,
      )
    ) {
      return null;
    }
  }

  /*
   * Don't throw away an official site just because the title
   * contains words such as "best" or "services".
   *
   * Only reject obvious content results when there is also
   * no meaningful business identity.
   */
  if (
    looksLikeContentTitle(title) &&
    !exactBusinessMatch(
      input.businessName,
      `${title ?? ""} ${description ?? ""}`,
    ) &&
    !hasBusinessSignal(
      title,
      description,
      input,
    )
  ) {
    return null;
  }

  return {
    url,
    title,
    description,
    sourceType:
      classifySourceType(url),
    confidence: "medium",
    evidenceText:
      [title, description]
        .filter(Boolean)
        .join(" — ")
        .slice(0, 1_000) ||
      null,
  };
}

/* -------------------------------------------------------------------------- */
/* RANKING                                                                    */
/* -------------------------------------------------------------------------- */

function scoreCandidate(
  input: BusinessResearchInput,
  candidate: ResearchCandidate,
): number {
  const title =
    normalizeText(
      candidate.title,
    );

  const description =
    normalizeText(
      candidate.description,
    );

  const combined =
    `${title} ${description} ${normalizeText(candidate.url)}`;

  const business =
    normalizeText(
      input.businessName,
    );

  let score = 0;

  /*
   * EXACT BUSINESS NAME
   */

  if (
    title === business
  ) {
    score += 100;
  } else if (
    title.includes(business)
  ) {
    score += 85;
  } else if (
    combined.includes(business)
  ) {
    score += 70;
  }

  /*
   * MEANINGFUL NAME TOKENS
   */

  const tokenRatio =
    businessTokenRatio(
      input.businessName,
      combined,
    );

  if (tokenRatio >= 1) {
    score += 40;
  } else if (
    tokenRatio >= 0.75
  ) {
    score += 30;
  } else if (
    tokenRatio >= 0.5
  ) {
    score += 18;
  } else if (
    tokenRatio > 0
  ) {
    score += 8;
  }

  /*
   * DOMAIN IDENTITY
   */

  const domainRatio =
    domainTokenRatio(
      input.businessName,
      candidate.url,
    );

  if (domainRatio >= 1) {
    score += 50;
  } else if (
    domainRatio >= 0.75
  ) {
    score += 35;
  } else if (
    domainRatio >= 0.5
  ) {
    score += 22;
  } else if (
    domainRatio > 0
  ) {
    score += 10;
  }

  /*
   * LOCATION
   */

  const city =
    normalizeText(input.city);

  const country =
    normalizeText(input.country);

  if (
    city &&
    combined.includes(city)
  ) {
    score += 30;
  }

  if (
    country &&
    combined.includes(country)
  ) {
    score += 10;
  }

  /*
   * INDUSTRY
   */

  const industry =
    normalizeText(input.industry);

  if (
    industry &&
    combined.includes(industry)
  ) {
    score += 15;
  }

  /*
   * SOURCE TYPE
   */

  if (
    candidate.sourceType ===
    "public_web"
  ) {
    score += 35;
  }

  if (
    candidate.sourceType ===
    "public_directory"
  ) {
    score -= 25;
  }

  /*
   * ROOT DOMAIN BONUS
   */

  const path =
    getPath(candidate.url);

  if (
    path === "" ||
    path === "/"
  ) {
    score += 20;
  }

  /*
   * DIRECTORY-LIKE URL PATHS
   *
   * Do not completely discard them here because they
   * can still be useful evidence, but keep them below
   * genuine business domains.
   */

  const directoryPathPatterns = [
    "/directory/",
    "/directories/",
    "/listing/",
    "/listings/",
    "/profile/",
    "/profiles/",
    "/providers/",
    "/doctors/",
    "/business/",
    "/businesses/",
  ];

  if (
    directoryPathPatterns.some(
      (pattern) =>
        path.includes(pattern),
    )
  ) {
    score -= 30;
  }

  return Math.max(
    0,
    score,
  );
}

/* -------------------------------------------------------------------------- */
/* DOMAIN-FIRST CANDIDATE SELECTION                                           */
/* -------------------------------------------------------------------------- */

function candidateIdentityStrength(
  input: BusinessResearchInput,
  candidate: ResearchCandidate,
): number {
  const title =
    normalizeText(
      candidate.title,
    );

  const description =
    normalizeText(
      candidate.description,
    );

  const combined =
    `${title} ${description}`;

  const exact =
    exactBusinessMatch(
      input.businessName,
      combined,
    );

  const nameRatio =
    businessTokenRatio(
      input.businessName,
      combined,
    );

  const domainRatio =
    domainTokenRatio(
      input.businessName,
      candidate.url,
    );

  let score = 0;

  if (exact) {
    score += 100;
  }

  score +=
    Math.round(
      nameRatio * 50,
    );

  score +=
    Math.round(
      domainRatio * 80,
    );

  if (
    candidate.sourceType ===
    "public_web"
  ) {
    score += 30;
  }

  if (
    getPath(candidate.url) ===
      "" ||
    getPath(candidate.url) ===
      "/"
  ) {
    score += 20;
  }

  return score;
}

function selectCandidatesForVerification(
  input: BusinessResearchInput,
  candidates: ResearchCandidate[],
): ResearchCandidate[] {
  const ranked =
    [...candidates].sort(
      (a, b) =>
        scoreCandidate(
          input,
          b,
        ) -
        scoreCandidate(
          input,
          a,
        ),
    );

  /*
   * First collect strong identity candidates.
   *
   * This prevents a pile of directory results from
   * consuming all verification slots.
   */
  const strong =
    ranked.filter(
      (candidate) =>
        candidate.sourceType ===
          "public_web" &&
        candidateIdentityStrength(
          input,
          candidate,
        ) >= 80,
    );

  /*
   * Then add the normal ranked pool.
   */
  const combined = [
    ...strong,
    ...ranked,
  ];

  const seen =
    new Set<string>();

  const output:
    ResearchCandidate[] = [];

  for (
    const candidate of combined
  ) {
    const normalized =
      normalizeUrl(
        candidate.url,
      );

    if (!normalized) {
      continue;
    }

    if (
      seen.has(normalized)
    ) {
      continue;
    }

    seen.add(normalized);

    output.push(candidate);

    /*
     * Give verification a much larger pool than before.
     */
    if (
      output.length >= 30
    ) {
      break;
    }
  }

  return output;
}

/* -------------------------------------------------------------------------- */
/* DEDUPLICATION                                                              */
/* -------------------------------------------------------------------------- */

function dedupeCandidates(
  candidates: ResearchCandidate[],
): ResearchCandidate[] {
  const seen =
    new Set<string>();

  const output:
    ResearchCandidate[] = [];

  for (
    const candidate of candidates
  ) {
    const normalized =
      normalizeUrl(
        candidate.url,
      );

    if (!normalized) {
      continue;
    }

    if (
      seen.has(normalized)
    ) {
      continue;
    }

    seen.add(normalized);

    output.push({
      ...candidate,
      url: normalized,
    });
  }

  return output;
}

/* -------------------------------------------------------------------------- */
/* DIAGNOSTICS                                                                */
/* -------------------------------------------------------------------------- */

function logTopCandidates(
  input: BusinessResearchInput,
  candidates: ResearchCandidate[],
): void {
  console.log(
    `[AutoRadar] SearXNG candidates for "${input.businessName}":`,
    candidates
      .slice(0, 15)
      .map((candidate) => ({
        url: candidate.url,
        host:
          getHostname(
            candidate.url,
          ),
        title:
          candidate.title,
        source:
          candidate.sourceType,
        score:
          scoreCandidate(
            input,
            candidate,
          ),
        identity:
          candidateIdentityStrength(
            input,
            candidate,
          ),
      })),
  );
}

/* -------------------------------------------------------------------------- */
/* MAIN SEARCH                                                                */
/* -------------------------------------------------------------------------- */

export async function searchSearXNG(
  input: BusinessResearchInput,
  options: SearXNGSearchOptions = {},
): Promise<SearXNGSearchResult> {
  const limit =
    Math.max(
      1,
      Math.min(
        options.limit ??
          DEFAULT_LIMIT,
        50,
      ),
    );

  const timeoutMs =
    Math.max(
      2_000,
      options.timeoutMs ??
        DEFAULT_TIMEOUT_MS,
    );

  const queries =
    buildSearchQueries(input);

  const warnings: string[] = [];

  const allCandidates:
    ResearchCandidate[] = [];

  let successfulQueries = 0;

  console.log(
    `[AutoRadar] Starting SearXNG research for "${input.businessName}"`,
  );

  console.log(
    `[AutoRadar] Research queries:`,
    queries,
  );

  for (
    const query of queries
  ) {
    try {
      console.log(
        `[AutoRadar] SearXNG query: ${query}`,
      );

      const data =
        await fetchSearXNG(
          query,
          timeoutMs,
        );

      successfulQueries += 1;

      const results =
        extractResults(
          data,
        ).slice(
          0,
          MAX_RESULTS_PER_QUERY,
        );

      console.log(
        `[AutoRadar] SearXNG returned ${results.length} results for "${query}"`,
      );

      for (
        const result of results
      ) {
        const candidate =
          mapResult(
            result,
            input,
          );

        if (candidate) {
          allCandidates.push(
            candidate,
          );
        }
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unknown SearXNG error";

      warnings.push(
        `Search failed for "${query}": ${message}`,
      );

      console.warn(
        `[AutoRadar] SearXNG query failed: ${query}`,
        error,
      );
    }
  }

  const deduped =
    dedupeCandidates(
      allCandidates,
    );

  /*
   * IMPORTANT:
   *
   * Do not simply take the first 30 search results.
   * Give exact-name/domain candidates priority first.
   */
  const candidates =
    selectCandidatesForVerification(
      input,
      deduped,
    );

  /*
   * Keep enough candidates for public-web.ts while still
   * avoiding an unnecessarily huge verification workload.
   */
  const finalCandidates =
    candidates.slice(
      0,
      Math.max(
        limit * 2,
        30,
      ),
    );

  if (
    finalCandidates.length === 0
  ) {
    warnings.push(
      "SearXNG returned no usable public-web candidates for this business.",
    );
  }

  if (
    successfulQueries === 0 &&
    queries.length > 0
  ) {
    warnings.push(
      "All SearXNG public-web queries failed.",
    );
  }

  logTopCandidates(
    input,
    finalCandidates,
  );

  console.log(
    `[AutoRadar] SearXNG research complete: ${finalCandidates.length} candidates for "${input.businessName}"`,
  );

  return {
    candidates:
      finalCandidates,
    warnings,
    query:
      queries[0] ??
      `"${input.businessName}"`,
    searchedAt:
      new Date().toISOString(),
  };
}

/* -------------------------------------------------------------------------- */
/* OPTIONAL INPUT BUILDER                                                      */
/* -------------------------------------------------------------------------- */

export function createSearXNGResearchInput(
  lead: BusinessResearchInput["lead"],
  address: string | null = null,
): BusinessResearchInput {
  return {
    lead,
    businessName:
      lead.companyName,
    city:
      lead.city ?? null,
    country:
      lead.country ?? null,
    industry:
      lead.industry ?? null,
    address,
  };
}
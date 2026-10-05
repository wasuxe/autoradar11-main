import type { Lead } from "@/lib/leads/types";
import type {
  BusinessIdentityVariant,
  IdentityCandidate,
  IdentityEvidence,
  IdentityMatchConfidence,
} from "./types";

function normalize(
  value: string | null | undefined,
): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value: string): string[] {
  return normalize(value)
    .split(" ")
    .filter((token) => token.length >= 2);
}

function distinctiveTokens(value: string): string[] {
  const generic = new Set([
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

  return tokenize(value).filter(
    (token) =>
      !generic.has(token) &&
      token.length >= 3,
  );
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname
      .toLowerCase()
      .replace(/^www\./, "");
  } catch {
    return "";
  }
}

function getDomainName(url: string): string {
  const domain = getDomain(url);

  if (!domain) {
    return "";
  }

  return domain
    .split(".")[0]
    .replace(/[-_]/g, " ");
}

const DIRECTORY_HOSTS = new Set([
  "justdial.com",
  "sulekha.com",
  "yelp.com",
  "tripadvisor.com",
  "foursquare.com",
  "yellowpages.com",
  "practo.com",
  "indiamart.com",
  "tradeindia.com",
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
  "genericdrugscan.com",
  "esi.in",
]);

const SEARCH_ENGINE_HOSTS = new Set([
  "google.com",
  "google.co.in",
  "bing.com",
  "yahoo.com",
  "duckduckgo.com",
  "search.brave.com",
  "brave.com",
  "ecosia.org",
]);

const SOCIAL_HOSTS = new Set([
  "facebook.com",
  "instagram.com",
  "linkedin.com",
  "x.com",
  "twitter.com",
  "youtube.com",
  "youtu.be",
]);

const CONTENT_HOSTS = new Set([
  "wikipedia.org",
  "wikimedia.org",
  "webmd.com",
  "healthline.com",
  "mayoclinic.org",
  "clevelandclinic.org",
  "verywellhealth.com",
  "verywellhealth.org",
  "medicalnewstoday.com",
  "nhs.uk",
]);

const DIRECTORY_PATH_PATTERNS = [
  "/directory/",
  "/directories/",
  "/listing/",
  "/listings/",
  "/business/",
  "/businesses/",
  "/company/",
  "/companies/",
  "/hospitals-directory/",
  "/hospital-directory/",
  "/clinic-directory/",
  "/doctor-directory/",
  "/doctors/",
  "/providers/",
  "/profile/",
  "/profiles/",
];

const SEARCH_PATH_PATTERNS = [
  "/search",
  "/results",
  "/find",
  "/query",
];

const CONTENT_PATH_PATTERNS = [
  "/blog/",
  "/article/",
  "/articles/",
  "/news/",
  "/category/",
  "/tag/",
  "/tags/",
  "/wiki/",
];

const SOCIAL_SHARE_PATTERNS = [
  "/share",
  "/sharing/",
  "/sharer",
  "/sharearticle",
  "/share-offsite",
  "/intent/",
];

function getHostRoot(
  hostname: string,
): string {
  const parts = hostname
    .split(".")
    .filter(Boolean);

  if (parts.length < 2) {
    return hostname;
  }

  if (
    parts.length >= 3 &&
    [
      "co",
      "com",
      "net",
      "org",
      "gov",
      "edu",
    ].includes(
      parts[parts.length - 2],
    )
  ) {
    return parts.slice(-3).join(".");
  }

  return parts.slice(-2).join(".");
}

function isHostInSet(
  hostname: string,
  hosts: Set<string>,
): boolean {
  const normalized = hostname
    .toLowerCase()
    .replace(/^www\./, "");

  for (const host of hosts) {
    if (
      normalized === host ||
      normalized.endsWith(`.${host}`)
    ) {
      return true;
    }
  }

  return false;
}

type UrlQuality =
  | "official"
  | "directory"
  | "search"
  | "social"
  | "content"
  | "unknown";

function classifyUrl(
  url: string,
): UrlQuality {
  try {
    const parsed = new URL(url);

    const hostname = parsed.hostname
      .toLowerCase()
      .replace(/^www\./, "");

    const pathname =
      parsed.pathname.toLowerCase();

    if (
      isHostInSet(
        hostname,
        DIRECTORY_HOSTS,
      )
    ) {
      return "directory";
    }

    if (
      isHostInSet(
        hostname,
        SEARCH_ENGINE_HOSTS,
      )
    ) {
      return "search";
    }

    if (
      isHostInSet(
        hostname,
        SOCIAL_HOSTS,
      )
    ) {
      if (
        SOCIAL_SHARE_PATTERNS.some(
          (pattern) =>
            pathname.includes(pattern),
        )
      ) {
        return "content";
      }

      return "social";
    }

    if (
      isHostInSet(
        hostname,
        CONTENT_HOSTS,
      )
    ) {
      return "content";
    }

    if (
      DIRECTORY_PATH_PATTERNS.some(
        (pattern) =>
          pathname.includes(pattern),
      )
    ) {
      return "directory";
    }

    if (
      SEARCH_PATH_PATTERNS.some(
        (pattern) =>
          pathname === pattern ||
          pathname.startsWith(
            `${pattern}/`,
          ) ||
          pathname.startsWith(
            `${pattern}?`,
          ),
      )
    ) {
      return "search";
    }

    if (
      CONTENT_PATH_PATTERNS.some(
        (pattern) =>
          pathname.includes(pattern),
      )
    ) {
      return "content";
    }

    return "official";
  } catch {
    return "unknown";
  }
}

function getUrlQualityPenalty(
  url: string,
): number {
  switch (classifyUrl(url)) {
    case "directory":
      return 80;

    case "search":
      return 80;

    case "content":
      return 70;

    case "social":
      return 55;

    case "unknown":
      return 20;

    case "official":
    default:
      return 0;
  }
}

function scoreName(
  leadName: string,
  candidateName: string | null,
): number {
  if (!candidateName) {
    return 0;
  }

  const lead = normalize(leadName);
  const candidate =
    normalize(candidateName);

  if (!lead || !candidate) {
    return 0;
  }

  if (lead === candidate) {
    return 60;
  }

  const leadTokens =
    distinctiveTokens(lead);

  const candidateTokens =
    distinctiveTokens(candidate);

  if (
    leadTokens.length === 0 ||
    candidateTokens.length === 0
  ) {
    return 0;
  }

  const matched = leadTokens.filter(
    (token) =>
      candidateTokens.includes(token),
  );

  const ratio =
    matched.length / leadTokens.length;

  if (ratio === 1) {
    return 50;
  }

  if (ratio >= 0.75) {
    return 40;
  }

  if (ratio >= 0.5) {
    return 25;
  }

  if (ratio > 0) {
    return 10;
  }

  return 0;
}

function scoreDomain(
  leadName: string,
  url: string,
): number {
  const domainName =
    getDomainName(url);

  if (!domainName) {
    return 0;
  }

  const leadTokens =
    distinctiveTokens(leadName);

  const domainTokens =
    distinctiveTokens(domainName);

  if (
    leadTokens.length === 0 ||
    domainTokens.length === 0
  ) {
    return 0;
  }

  const matched = leadTokens.filter(
    (token) =>
      domainTokens.includes(token),
  );

  if (
    matched.length ===
    leadTokens.length
  ) {
    return 30;
  }

  if (
    matched.length >=
    Math.ceil(
      leadTokens.length / 2,
    )
  ) {
    return 20;
  }

  if (matched.length > 0) {
    return 10;
  }

  return 0;
}

const CITY_ALIASES: Record<
  string,
  string[]
> = {
  bangalore: [
    "bangalore",
    "bengaluru",
  ],

  bengaluru: [
    "bangalore",
    "bengaluru",
  ],

  vadodara: [
    "vadodara",
    "baroda",
  ],

  baroda: [
    "vadodara",
    "baroda",
  ],

  mumbai: [
    "mumbai",
    "bombay",
  ],

  bombay: [
    "mumbai",
    "bombay",
  ],

  delhi: [
    "delhi",
    "new delhi",
  ],

  "new delhi": [
    "delhi",
    "new delhi",
  ],

  calcutta: [
    "calcutta",
    "kolkata",
  ],

  kolkata: [
    "calcutta",
    "kolkata",
  ],

  madras: [
    "madras",
    "chennai",
  ],

  chennai: [
    "madras",
    "chennai",
  ],
};

const KNOWN_CITIES = [
  "pune",
  "mumbai",
  "bombay",
  "delhi",
  "new delhi",
  "surat",
  "ahmedabad",
  "bangalore",
  "bengaluru",
  "hyderabad",
  "chennai",
  "madras",
  "kolkata",
  "calcutta",
  "jaipur",
  "rajkot",
  "indore",
  "nagpur",
  "vadodara",
  "baroda",
];

function getCityAliases(
  city: string,
): string[] {
  const normalizedCity =
    normalize(city);

  return (
    CITY_ALIASES[
      normalizedCity
    ] ?? [normalizedCity]
  );
}

function containsCity(
  text: string,
  city: string,
): boolean {
  const normalizedText =
    normalize(text);

  const aliases =
    getCityAliases(city);

  return aliases.some((alias) => {
    if (!alias) {
      return false;
    }

    return normalizedText.includes(
      alias,
    );
  });
}

/*
 * Detect a competing city only when the
 * requested city itself is not present.
 *
 * This prevents false rejection when a legitimate
 * business website mentions multiple cities,
 * branches, service areas, nearby cities, etc.
 */
function detectLocationConflict(
  leadCity: string | null,
  text: string,
): string | null {
  if (!leadCity) {
    return null;
  }

  const normalizedLeadCity =
    normalize(leadCity);

  const normalizedText =
    normalize(text);

  if (
    !normalizedLeadCity ||
    !normalizedText
  ) {
    return null;
  }

  /*
   * Requested city is present.
   *
   * Do not reject merely because another city
   * also appears in the candidate content.
   */
  if (
    containsCity(
      normalizedText,
      normalizedLeadCity,
    )
  ) {
    return null;
  }

  /*
   * Requested city is absent.
   *
   * Now look for a known competing city.
   */
  for (const city of KNOWN_CITIES) {
    const aliases =
      getCityAliases(city);

    const isLeadCity =
      aliases.includes(
        normalizedLeadCity,
      ) ||
      normalizedLeadCity === city;

    if (isLeadCity) {
      continue;
    }

    const conflictingAlias =
      aliases.find((alias) =>
        alias &&
        normalizedText.includes(alias),
      );

    if (conflictingAlias) {
      return city;
    }
  }

  return null;
}

function scoreLocation(
  lead: Lead,
  locationText:
    | string
    | null
    | undefined,
): number {
  if (!locationText) {
    return 0;
  }

  const location =
    normalize(locationText);

  if (!location) {
    return 0;
  }

  let score = 0;

  if (lead.city) {
    const city =
      normalize(lead.city);

    if (
      containsCity(
        location,
        city,
      )
    ) {
      score += 25;
    }
  }

  if (lead.country) {
    const country =
      normalize(lead.country);

    if (
      country &&
      location.includes(country)
    ) {
      score += 5;
    }
  }

  return Math.min(score, 30);
}

function scoreIndustry(
  lead: Lead,
  text:
    | string
    | null
    | undefined,
): number {
  if (!lead.industry || !text) {
    return 0;
  }

  const industry =
    normalize(lead.industry);

  const content =
    normalize(text);

  if (!industry || !content) {
    return 0;
  }

  const industryTokens =
    distinctiveTokens(industry);

  if (industryTokens.length === 0) {
    return content.includes(
      industry,
    )
      ? 10
      : 0;
  }

  const matched =
    industryTokens.filter(
      (token) =>
        content.includes(token),
    );

  if (
    matched.length ===
    industryTokens.length
  ) {
    return 15;
  }

  if (matched.length > 0) {
    return 8;
  }

  return 0;
}

function getConfidence(
  totalScore: number,
  locationConflict: string | null,
  locationScore: number,
  urlQuality: UrlQuality,
): IdentityMatchConfidence {
  if (
    urlQuality === "directory" ||
    urlQuality === "search"
  ) {
    return "rejected";
  }

  if (urlQuality === "content") {
    return "rejected";
  }

  /*
   * A competing city is still important.
   *
   * If there is no matching location evidence,
   * reject it.
   *
   * If some location evidence exists, downgrade
   * instead of automatically rejecting.
   */
  if (locationConflict) {
    if (locationScore === 0) {
      return "rejected";
    }

    return "low";
  }

  if (totalScore >= 80) {
    return "high";
  }

  if (totalScore >= 60) {
    return "medium";
  }

  if (totalScore >= 40) {
    return "low";
  }

  return "rejected";
}

function buildEvidence(
  lead: Lead,
  candidate: {
    url: string;
    title: string | null;
    description: string | null;
    matchedVariant: string | null;
    locationText?: string | null;
    locationConflict?: string | null;
    urlQuality?: UrlQuality;
  },
  scores: {
    name: number;
    domain: number;
    location: number;
    industry: number;
  },
): IdentityEvidence[] {
  const evidence: IdentityEvidence[] =
    [];

  if (
    scores.name > 0 &&
    candidate.title
  ) {
    evidence.push({
      type: "business_name",
      value: candidate.title,
      sourceUrl: candidate.url,
      confidence: Math.min(
        scores.name / 60,
        1,
      ),
      explanation:
        "The candidate page contains a business name that overlaps with the discovered business identity.",
    });
  }

  if (scores.domain > 0) {
    evidence.push({
      type: "domain",
      value: getDomain(
        candidate.url,
      ),
      sourceUrl: candidate.url,
      confidence: Math.min(
        scores.domain / 30,
        1,
      ),
      explanation:
        "The candidate domain contains distinctive terms associated with the business name.",
    });
  }

  if (
    scores.location > 0 &&
    candidate.locationText
  ) {
    evidence.push({
      type: "location",
      value:
        candidate.locationText,
      sourceUrl: candidate.url,
      confidence: Math.min(
        scores.location / 30,
        1,
      ),
      explanation:
        "The candidate content contains location information matching the lead location.",
    });
  }

  if (
    candidate.locationConflict
  ) {
    evidence.push({
      type: "location",
      value:
        candidate.locationConflict,
      sourceUrl: candidate.url,
      confidence: 1,
      explanation:
        `The candidate contains a location (${candidate.locationConflict}) that conflicts with the lead location (${lead.city ?? "unknown"}).`,
    });
  }

  if (
    scores.industry > 0 &&
    candidate.description
  ) {
    evidence.push({
      type: "industry",
      value:
        candidate.description,
      sourceUrl: candidate.url,
      confidence: Math.min(
        scores.industry / 15,
        1,
      ),
      explanation:
        "The candidate content contains terminology related to the lead's industry.",
    });
  }

  if (candidate.matchedVariant) {
    evidence.push({
      type: "name_variant",
      value:
        candidate.matchedVariant,
      sourceUrl: candidate.url,
      confidence: 0.6,
      explanation:
        "The candidate matched one of the identity variants generated for public-web discovery.",
    });
  }

  if (
    candidate.urlQuality &&
    candidate.urlQuality !==
      "official"
  ) {
    evidence.push({
      type: "website_content",
      value:
        candidate.urlQuality,
      sourceUrl: candidate.url,
      confidence: 1,
      explanation:
        `The candidate URL was classified as ${candidate.urlQuality} rather than a direct official business website.`,
    });
  }

  return evidence;
}

export interface ScoreIdentityCandidateInput {
  lead: Lead;

  candidate: {
    url: string;
    title: string | null;
    description: string | null;
    locationText?: string | null;
  };

  variants?: BusinessIdentityVariant[];
}

export function scoreIdentityCandidate(
  input: ScoreIdentityCandidateInput,
): IdentityCandidate {
  const {
    lead,
    candidate,
    variants = [],
  } = input;

  const candidateText = [
    candidate.title,
    candidate.description,
    candidate.locationText,
  ]
    .filter(Boolean)
    .join(" ");

  const locationConflict =
    detectLocationConflict(
      lead.city,
      candidateText,
    );

  const urlQuality =
    classifyUrl(
      candidate.url,
    );

  const variantScores =
    variants.map((variant) => ({
      variant,
      score: scoreName(
        variant.value,
        candidate.title,
      ),
    }));

  const bestVariant =
    variantScores.sort(
      (a, b) =>
        b.score - a.score,
    )[0];

  const directNameScore =
    scoreName(
      lead.companyName,
      candidate.title,
    );

  const nameScore = Math.max(
    directNameScore,
    bestVariant?.score ?? 0,
  );

  const domainScore =
    scoreDomain(
      lead.companyName,
      candidate.url,
    );

  const locationScore =
    scoreLocation(
      lead,
      candidateText,
    );

  const industryScore =
    scoreIndustry(
      lead,
      candidateText,
    );

  const locationConflictPenalty =
    locationConflict
      ? 60
      : 0;

  const urlQualityPenalty =
    getUrlQualityPenalty(
      candidate.url,
    );

  const totalScore =
    Math.max(
      0,
      nameScore +
        domainScore +
        locationScore +
        industryScore -
        locationConflictPenalty -
        urlQualityPenalty,
    );

  const confidence =
    getConfidence(
      totalScore,
      locationConflict,
      locationScore,
      urlQuality,
    );

  const evidence =
    buildEvidence(
      lead,
      {
        ...candidate,
        matchedVariant:
          bestVariant &&
          bestVariant.score > 0
            ? bestVariant.variant
                .value
            : null,
        locationConflict,
        urlQuality,
      },
      {
        name: nameScore,
        domain: domainScore,
        location: locationScore,
        industry: industryScore,
      },
    );

  return {
    url: candidate.url,
    domain: getDomain(
      candidate.url,
    ),
    title: candidate.title,
    description:
      candidate.description,

    matchedVariant:
      bestVariant &&
      bestVariant.score > 0
        ? bestVariant.variant
            .value
        : null,

    nameScore,
    domainScore,
    locationScore,
    industryScore,

    totalScore,
    confidence,

    evidence,
  };
}
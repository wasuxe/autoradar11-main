import type { Lead } from "@/lib/leads/types";

export type PublicWebSearchResult = {
  title: string;
  url: string;
  content: string;
  engine?: string;
  score?: number;
};

export type PublicWebDecisionMakerCandidate = {
  name: string;
  role: string | null;
  companyName: string;
  profileUrl: string | null;
  sourceUrl: string;
  sourceTitle: string;
  sourceType:
    | "official_company"
    | "professional_profile"
    | "press_release"
    | "industry_association"
    | "conference"
    | "interview"
    | "other_public";
  discoveryConfidence: "high" | "medium" | "low";
  evidence: string[];
};

export type PublicWebDecisionMakerResult = {
  candidates: PublicWebDecisionMakerCandidate[];
  searches: string[];
  results: PublicWebSearchResult[];
};

const DEFAULT_SEARXNG_URL =
  process.env.SEARXNG_URL?.trim() || "http://localhost:8080";

const SEARCH_LIMIT = 8;
const REQUEST_TIMEOUT_MS = 8_000;

const BLOCKED_HOSTS = new Set([
  // Social platforms
  "facebook.com",
  "www.facebook.com",
  "instagram.com",
  "www.instagram.com",
  "linkedin.com",
  "www.linkedin.com",
  "x.com",
  "www.x.com",
  "twitter.com",
  "www.twitter.com",
  "youtube.com",
  "www.youtube.com",
  "tiktok.com",
  "www.tiktok.com",

  // Business directories / listing platforms
  "justdial.com",
  "www.justdial.com",
  "sulekha.com",
  "www.sulekha.com",
  "yelp.com",
  "www.yelp.com",
  "tripadvisor.com",
  "www.tripadvisor.com",
  "foursquare.com",
  "www.foursquare.com",
  "yellowpages.com",
  "www.yellowpages.com",
  "practo.com",
  "www.practo.com",
  "magicpin.in",
  "www.magicpin.in",
  "indiamart.com",
  "www.indiamart.com",
  "tradeindia.com",
  "www.tradeindia.com",
  "deldure.com",
  "www.deldure.com",
  "bdir.in",
  "www.bdir.in",
  "indiainfo.net",
  "www.indiainfo.net",
  "asklaila.com",
  "www.asklaila.com",
  "urbanpro.com",
  "www.urbanpro.com",
  "top-rated.online",
  "www.top-rated.online",
  "lybrate.com",
  "www.lybrate.com",
  "credihealth.com",
  "www.credihealth.com",
  "zaubacorp.com",
  "www.zaubacorp.com",
  "webindia123.com",
  "www.webindia123.com",
  "medindia.net",
  "www.medindia.net",
  "dentee.com",
  "www.dentee.com",
  "hexahealth.com",
  "www.hexahealth.com",

  // Additional directory / aggregator sites
  "helloindia.co",
  "www.helloindia.co",
  "promallu.com",
  "www.promallu.com",
  "worldplaces.me",
  "www.worldplaces.me",
  "kivihealth.com",
  "www.kivihealth.com",
  "infobel.com",
  "www.infobel.com",
  "near-me.in",
  "www.near-me.in",
  "findnearby.in",
  "www.findnearby.in",
  "businesslisting.com",
  "www.businesslisting.com",

  // Generic publishing / hosted platforms
  "medium.com",
  "www.medium.com",
  "wordpress.com",
  "www.wordpress.com",
  "blogspot.com",
  "www.blogspot.com",

  // Hosted/demo platforms
  "vercel.app",
  "netlify.app",
  "github.io",
  "pages.dev",
  "web.app",
  "firebaseapp.com",
  "wixsite.com",
  "weebly.com",
]);

const BLOCKED_PATHS = [
  "/search",
  "/results",
  "/query",
  "/find",
  "/directory/",
  "/directories/",
  "/listing/",
  "/listings/",
  "/profile/",
  "/profiles/",
  "/providers/",
  "/doctor-directory/",
  "/clinic-directory/",
  "/hospital-directory/",
  "/business-directory/",
  "/company-directory/",
  "/local-business/",
  "/local-businesses/",
  "/hospital-list/",
  "/clinic-list/",
  "/doctor-list/",
  "/conference/",
  "/conferences/",
  "/events/",
  "/event/",
  "/summit/",
  "/expo/",
  "/blog/",
  "/article/",
  "/articles/",
  "/news/",
  "/category/",
  "/tag/",
  "/tags/",
  "/wiki/",
];

const NON_PERSON_PHRASES = [
  "google maps",
  "google business",
  "get directions",
  "view map",
  "read more",
  "contact us",
  "book appointment",
  "our services",
  "view profile",
  "call now",
  "directions",
  "accessibility",
  "wheelchair",
  "reviews",
  "rating",
  "street view",
  "business profile",
  "company profile",
];

const ROLE_PATTERNS: Array<{
  role: string;
  pattern: RegExp;
}> = [
  { role: "founder", pattern: /\bfounder\b/i },
  { role: "co-founder", pattern: /\bco[- ]?founder\b/i },
  { role: "owner", pattern: /\bowner\b/i },
  { role: "ceo", pattern: /\bchief executive officer\b|\bceo\b/i },
  { role: "coo", pattern: /\bchief operating officer\b|\bcoo\b/i },
  {
    role: "cmo",
    pattern: /\bchief marketing officer\b|\bcmo\b/i,
  },
  {
    role: "marketing_head",
    pattern: /\bhead of marketing\b|\bmarketing head\b/i,
  },
  {
    role: "marketing_manager",
    pattern: /\bmarketing manager\b/i,
  },
  {
    role: "brand_head",
    pattern: /\bhead of brand\b|\bbrand head\b/i,
  },
  {
    role: "growth_head",
    pattern: /\bhead of growth\b|\bgrowth head\b/i,
  },
  {
    role: "operations_head",
    pattern: /\bhead of operations\b|\boperations head\b/i,
  },
  {
    role: "director",
    pattern: /\bdirector\b/i,
  },
];

function cleanText(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/\u00a0/g, " ")
    .trim();
}

function normalizeHost(host: string): string {
  return host.toLowerCase().replace(/^www\./, "");
}

function getHost(url: string): string | null {
  try {
    return normalizeHost(new URL(url).hostname);
  } catch {
    return null;
  }
}

function isBlockedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = normalizeHost(parsed.hostname);

    if (BLOCKED_HOSTS.has(host)) {
      return true;
    }

    const pathname = parsed.pathname.toLowerCase();

    return BLOCKED_PATHS.some((blockedPath) =>
      pathname.includes(blockedPath),
    );
  } catch {
    return true;
  }
}

function isAllowedUrl(url: string): boolean {
  if (!/^https?:\/\//i.test(url)) {
    return false;
  }

  if (isBlockedUrl(url)) {
    return false;
  }

  return true;
}

function isLinkedInProfile(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = normalizeHost(parsed.hostname);

    return (
      host === "linkedin.com" &&
      /^\/in\/[^/]+/i.test(parsed.pathname)
    );
  } catch {
    return false;
  }
}

function isInstagramProfile(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = normalizeHost(parsed.hostname);

    if (host !== "instagram.com") {
      return false;
    }

    const path = parsed.pathname.replace(/^\/+|\/+$/g, "");

    if (!path) {
      return false;
    }

    const blocked = new Set([
      "accounts",
      "about",
      "developer",
      "direct",
      "explore",
      "reels",
      "stories",
      "web",
    ]);

    return !blocked.has(path.split("/")[0].toLowerCase());
  } catch {
    return false;
  }
}

function detectSourceType(
  url: string,
  title: string,
  content: string,
): PublicWebDecisionMakerCandidate["sourceType"] {
  const host = getHost(url);
  const combined = `${title} ${content}`.toLowerCase();

  if (isLinkedInProfile(url)) {
    return "professional_profile";
  }

  if (
    combined.includes("press release") ||
    combined.includes("news release") ||
    combined.includes("announced that")
  ) {
    return "press_release";
  }

  if (
    combined.includes("speaker") ||
    combined.includes("conference") ||
    combined.includes("summit") ||
    combined.includes("keynote")
  ) {
    return "conference";
  }

  if (
    combined.includes("association") ||
    combined.includes("member of") ||
    combined.includes("industry association")
  ) {
    return "industry_association";
  }

  if (
    combined.includes("interview") ||
    combined.includes("podcast") ||
    combined.includes("featured")
  ) {
    return "interview";
  }

  if (
    host &&
    (combined.includes("about us") ||
      combined.includes("our team") ||
      combined.includes("leadership") ||
      combined.includes("founder"))
  ) {
    return "official_company";
  }

  return "other_public";
}

function getRole(text: string): string | null {
  for (const item of ROLE_PATTERNS) {
    if (item.pattern.test(text)) {
      return item.role;
    }
  }

  return null;
}

function normalizePersonName(name: string): string {
  return cleanText(
    name
      .replace(
        /^(mr|mrs|ms|dr|prof|sir)\.?\s+/i,
        "",
      )
      .replace(/\s+/g, " "),
  );
}

function looksLikePersonName(name: string): boolean {
  const normalized = normalizePersonName(name);

  if (!normalized) {
    return false;
  }

  if (normalized.length < 4 || normalized.length > 80) {
    return false;
  }

  const words = normalized.split(/\s+/);

  if (words.length < 2 || words.length > 4) {
    return false;
  }

  if (/\d/.test(normalized)) {
    return false;
  }

  if (!/^[A-Za-zÀ-ÖØ-öø-ÿ.'-]+(?:\s+[A-Za-zÀ-ÖØ-öø-ÿ.'-]+){1,3}$/.test(normalized)) {
    return false;
  }

  const normalizedWords = words.map((word) =>
    word
      .toLowerCase()
      .replace(/[.,]/g, ""),
  );

  /*
   * A decision maker must be a person.
   *
   * These words are strong indicators that the extracted
   * "name" is actually a company, clinic, organization,
   * directory, department, or generic business phrase.
   */
  const NON_PERSON_WORDS = new Set([
    "limited",
    "ltd",
    "llc",
    "llp",
    "inc",
    "incorporated",
    "company",
    "corporation",
    "corp",
    "group",
    "groups",
    "holdings",
    "enterprise",
    "enterprises",
    "organization",
    "organisation",
    "business",
    "businesses",
    "firm",
    "firms",

    "clinic",
    "clinics",
    "hospital",
    "hospitals",
    "center",
    "centre",
    "studio",
    "agency",
    "agencies",
    "store",
    "shop",
    "salon",
    "restaurant",
    "cafe",
    "hotel",
    "institute",
    "school",
    "college",

    "official",
    "team",
    "staff",
    "management",
    "department",
    "services",
    "solutions",
    "health",
    "medical",
    "medicine",
    "skin",
    "beauty",
    "aesthetic",
    "aesthetics",
    "dental",
    "care",

    "directory",
    "directories",
    "listing",
    "listings",
    "search",
    "results",
    "result",
    "reviews",
    "review",
    "rating",
    "ratings",
    "contact",
    "appointment",
    "appointments",
    "profile",
    "profiles",
    "website",
    "web",
    "page",
    "pages",
  ]);

  if (
    normalizedWords.some((word) =>
      NON_PERSON_WORDS.has(word),
    )
  ) {
    return false;
  }

  if (
    NON_PERSON_PHRASES.some((phrase) =>
      normalized
        .toLowerCase()
        .includes(phrase),
    )
  ) {
    return false;
  }

  return true;
}

function extractNameFromRoleSentence(
  text: string,
): string | null {
  const patterns = [
    /\b(?:founder|co-founder|owner|ceo|director|chief executive officer)\s+(?:is\s+)?([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){1,3})/i,

    /\b([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){1,3})\s+(?:is|,)\s+(?:the\s+)?(?:founder|co-founder|owner|ceo|director)\b/i,

    /\b(?:founded|started|established)\s+by\s+([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){1,3})/i,

    /\b(?:led|headed)\s+by\s+([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){1,3})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (!match?.[1]) {
      continue;
    }

    const name = normalizePersonName(match[1]);

    if (looksLikePersonName(name)) {
      return name;
    }
  }

  return null;
}

function extractNamesFromTitle(
  title: string,
  companyName: string,
): string[] {
  const cleanedTitle = cleanText(title);

  const companyTokens = companyName
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => token.length > 2);

  const names: string[] = [];

  const possibleNames =
    cleanedTitle.match(
      /\b[A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){1,3}\b/g,
    ) ?? [];

  for (const possibleName of possibleNames) {
    const normalized = normalizePersonName(possibleName);

    if (!looksLikePersonName(normalized)) {
      continue;
    }

    const lower = normalized.toLowerCase();

    if (
      companyTokens.length > 0 &&
      companyTokens.every((token) => lower.includes(token))
    ) {
      continue;
    }

    if (!names.includes(normalized)) {
      names.push(normalized);
    }
  }

  return names;
}

function extractProfileUrl(
  results: PublicWebSearchResult[],
): string | null {
  for (const result of results) {
    if (isLinkedInProfile(result.url)) {
      return result.url;
    }

    if (isInstagramProfile(result.url)) {
      return result.url;
    }
  }

  return null;
}

function companyEvidence(
  lead: Lead,
  title: string,
  content: string,
): string[] {
  const evidence: string[] = [];

  const companyName = cleanText(lead.companyName);
  const haystack = `${title} ${content}`.toLowerCase();

  if (companyName && haystack.includes(companyName.toLowerCase())) {
    evidence.push("Company name appears in public source");
  }

  if (lead.website) {
    const websiteHost = getHost(lead.website);

    if (websiteHost) {
      evidence.push(`Target website domain: ${websiteHost}`);
    }
  }

  const role = getRole(`${title} ${content}`);

  if (role) {
    evidence.push(`Role signal detected: ${role}`);
  }

  return evidence;
}

function scoreCandidate(
  candidate: PublicWebDecisionMakerCandidate,
): number {
  let score = 0;

  if (candidate.name) {
    score += 20;
  }

  if (candidate.role) {
    score += 20;
  }

  if (candidate.profileUrl) {
    score += 15;
  }

  if (candidate.sourceType === "official_company") {
    score += 30;
  }

  if (candidate.sourceType === "professional_profile") {
    score += 25;
  }

  if (
    candidate.sourceType === "press_release" ||
    candidate.sourceType === "industry_association"
  ) {
    score += 20;
  }

  if (
    candidate.sourceType === "conference" ||
    candidate.sourceType === "interview"
  ) {
    score += 15;
  }

  score += Math.min(candidate.evidence.length * 5, 20);

  return score;
}

function confidenceFromScore(
  score: number,
): PublicWebDecisionMakerCandidate["discoveryConfidence"] {
  if (score >= 75) {
    return "high";
  }

  if (score >= 45) {
    return "medium";
  }

  return "low";
}

async function fetchJson(
  url: string,
): Promise<unknown> {
  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "AutoRadar/1.0",
      },
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function parseSearchResults(
  payload: unknown,
): PublicWebSearchResult[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const results = Array.isArray(
    (payload as { results?: unknown }).results,
  )
    ? (payload as { results: unknown[] }).results
    : [];

  const parsed: PublicWebSearchResult[] = [];

  for (const item of results) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const record = item as Record<string, unknown>;

    const title =
      typeof record.title === "string"
        ? cleanText(record.title)
        : "";

    const url =
      typeof record.url === "string"
        ? record.url.trim()
        : "";

    const content =
      typeof record.content === "string"
        ? cleanText(record.content)
        : "";

    const engine =
      typeof record.engine === "string"
        ? record.engine
        : undefined;

    const score =
      typeof record.score === "number"
        ? record.score
        : undefined;

    if (!title || !url || !isAllowedUrl(url)) {
      continue;
    }

    parsed.push({
      title,
      url,
      content,
      engine,
      score,
    });
  }

  return parsed;
}

async function searchPublicWeb(
  query: string,
): Promise<PublicWebSearchResult[]> {
  const endpoint = `${DEFAULT_SEARXNG_URL.replace(
    /\/+$/,
    "",
  )}/search`;

  const url = new URL(endpoint);

  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("language", "en");
  url.searchParams.set("safesearch", "0");

  const payload = await fetchJson(url.toString());

  return parseSearchResults(payload).slice(
    0,
    SEARCH_LIMIT,
  );
}

function buildQueries(lead: Lead): string[] {
  const company = cleanText(lead.companyName);

  if (!company) {
    return [];
  }

  const queries = [
    `"${company}" founder`,
    `"${company}" owner`,
    `"${company}" CEO`,
    `"${company}" director`,
    `"${company}" LinkedIn`,
    `"${company}" "co-founder"`,
    `"${company}" "head of marketing"`,
    `"${company}" "managing director"`,
  ];

  if (lead.city) {
    queries.push(
      `"${company}" "${cleanText(lead.city)}" founder`,
    );
  }

  return [...new Set(queries)];
}

function dedupeResults(
  results: PublicWebSearchResult[],
): PublicWebSearchResult[] {
  const seen = new Set<string>();
  const output: PublicWebSearchResult[] = [];

  for (const result of results) {
    try {
      const parsed = new URL(result.url);

      parsed.hash = "";
      parsed.search = "";

      const key = parsed.toString().replace(/\/+$/, "");

      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      output.push(result);
    } catch {
      continue;
    }
  }

  return output;
}

function buildCandidates(
  lead: Lead,
  results: PublicWebSearchResult[],
): PublicWebDecisionMakerCandidate[] {
  const candidates: PublicWebDecisionMakerCandidate[] = [];

  const groupedByName = new Map<
    string,
    PublicWebDecisionMakerCandidate
  >();

  for (const result of results) {
    const combined = `${result.title}. ${result.content}`;

    if (
      NON_PERSON_PHRASES.some((phrase) =>
        combined.toLowerCase().includes(phrase),
      )
    ) {
      // Do not reject the entire result because some pages
      // contain generic phrases. We only reject extracted names
      // containing those phrases.
    }

    const role = getRole(combined);

    const names = [
      extractNameFromRoleSentence(combined),
      ...extractNamesFromTitle(
        result.title,
        lead.companyName,
      ),
    ].filter((name): name is string => Boolean(name));

    const profileUrl =
      isLinkedInProfile(result.url) ||
      isInstagramProfile(result.url)
        ? result.url
        : null;

    for (const name of names) {
      const normalizedName = normalizePersonName(name);

      if (!looksLikePersonName(normalizedName)) {
        continue;
      }

      const evidence = companyEvidence(
        lead,
        result.title,
        result.content,
      );

      if (role) {
        evidence.push(`Public source associates ${normalizedName} with role ${role}`);
      }

      if (profileUrl) {
        evidence.push("Public professional/social profile discovered");
      }

      const sourceType = detectSourceType(
        result.url,
        result.title,
        result.content,
      );

      const candidate: PublicWebDecisionMakerCandidate = {
        name: normalizedName,
        role,
        companyName: lead.companyName,
        profileUrl,
        sourceUrl: result.url,
        sourceTitle: result.title,
        sourceType,
        discoveryConfidence: "low",
        evidence,
      };

      const score = scoreCandidate(candidate);

      candidate.discoveryConfidence =
        confidenceFromScore(score);

      const key = normalizedName.toLowerCase();

      const existing = groupedByName.get(key);

      if (!existing) {
        groupedByName.set(key, candidate);
        continue;
      }

      const existingScore = scoreCandidate(existing);

      if (score > existingScore) {
        groupedByName.set(key, candidate);
      } else {
        existing.evidence = [
          ...new Set([
            ...existing.evidence,
            ...candidate.evidence,
          ]),
        ];
      }
    }
  }

  for (const candidate of groupedByName.values()) {
    candidates.push(candidate);
  }

  return candidates
    .sort(
      (a, b) =>
        scoreCandidate(b) - scoreCandidate(a),
    )
    .slice(0, 10);
}

export async function discoverPublicWebDecisionMakers(
  lead: Lead,
): Promise<PublicWebDecisionMakerResult> {
  const searches = buildQueries(lead);

  if (searches.length === 0) {
    return {
      candidates: [],
      searches: [],
      results: [],
    };
  }

  const allResults: PublicWebSearchResult[] = [];

  for (const query of searches) {
    const results = await searchPublicWeb(query);

    allResults.push(...results);
  }

  const results = dedupeResults(allResults);

  const candidates = buildCandidates(
    lead,
    results,
  );

  return {
    candidates,
    searches,
    results,
  };
}

export async function discoverPublicWebDecisionMaker(
  lead: Lead,
): Promise<PublicWebDecisionMakerCandidate | null> {
  const result =
    await discoverPublicWebDecisionMakers(lead);

  if (result.candidates.length === 0) {
    return null;
  }

  /*
   * Public-web discovery is a discovery layer.
   * It must NOT turn a weak search result into a
   * verified decision maker.
   *
   * Only return a candidate when there is enough
   * direct evidence to justify passing it into the
   * verification pipeline.
   */

  const verifiedCandidates =
    result.candidates.filter((candidate) => {
      if (!candidate.name) {
        return false;
      }

      if (!candidate.role) {
        return false;
      }

      if (
        candidate.discoveryConfidence !==
          "high"
      ) {
        return false;
      }

      /*
       * A professional profile by itself is not enough.
       * We need actual evidence connecting the person
       * with the business.
       */
      const evidenceText =
        candidate.evidence
          .join(" ")
          .toLowerCase();

      const hasCompanyEvidence =
        evidenceText.includes(
          "company name appears",
        ) ||
        evidenceText.includes(
          "target website domain",
        );

      if (!hasCompanyEvidence) {
        return false;
      }

      /*
       * Require an explicit role association.
       */
      const hasRoleEvidence =
        evidenceText.includes(
          "role signal detected",
        ) ||
        evidenceText.includes(
          "associates",
        );

      if (!hasRoleEvidence) {
        return false;
      }

      return true;
    });

  if (verifiedCandidates.length === 0) {
    /*
     * UNKNOWN > WRONG.
     *
     * Do not return a random public-web candidate
     * merely because it received the highest score.
     */
    return null;
  }

  /*
   * Deterministic selection:
   * 1. More evidence
   * 2. Official company source
   * 3. Professional profile
   * 4. Stable alphabetical fallback
   */
  return [...verifiedCandidates].sort(
    (a, b) => {
      const evidenceDifference =
        b.evidence.length -
        a.evidence.length;

      if (evidenceDifference !== 0) {
        return evidenceDifference;
      }

      const sourcePriority = (
        candidate: PublicWebDecisionMakerCandidate,
      ): number => {
        if (
          candidate.sourceType ===
          "official_company"
        ) {
          return 4;
        }

        if (
          candidate.sourceType ===
          "professional_profile"
        ) {
          return 3;
        }

        if (
          candidate.sourceType ===
          "press_release"
        ) {
          return 2;
        }

        return 1;
      };

      const sourceDifference =
        sourcePriority(b) -
        sourcePriority(a);

      if (sourceDifference !== 0) {
        return sourceDifference;
      }

      return a.name.localeCompare(
        b.name,
      );
    },
  )[0] ?? null;
}
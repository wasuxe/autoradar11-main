import type { Lead } from "@/lib/leads/types";

import type {
  ContactConfidence,
  ContactEvidence,
  DecisionMaker,
  DecisionMakerRole,
} from "./types";

const REQUEST_TIMEOUT = 8_000;
const MAX_HTML_LENGTH = 400_000;
const MAX_PAGES = 6;

type Page = {
  url: string;
  html: string;
};

type PageCandidate = {
  url: string;
  priority: number;
};

type PersonCandidate = {
  name: string;
  role: DecisionMakerRole;
  roleLabel: string;
  sourceUrl: string;
  evidenceText: string;
  profileUrl: string | null;
  confidence: ContactConfidence;
  evidenceStrength: number;
};

const ROLE_PATTERNS: Array<{
  role: DecisionMakerRole;
  label: string;
  patterns: RegExp[];
  priority: number;
}> = [
  {
    role: "founder",
    label: "Founder",
    patterns: [
      /\bfounder\b/i,
      /\bco[-\s]?founder\b/i,
      /\bfounded by\b/i,
    ],
    priority: 100,
  },
  {
    role: "owner",
    label: "Owner",
    patterns: [
      /\bowner\b/i,
      /\bproprietor\b/i,
    ],
    priority: 98,
  },
  {
    role: "ceo",
    label: "CEO",
    patterns: [
      /\bchief executive officer\b/i,
      /\bCEO\b/i,
    ],
    priority: 96,
  },
  {
    role: "cmo",
    label: "CMO",
    patterns: [
      /\bchief marketing officer\b/i,
      /\bCMO\b/i,
    ],
    priority: 92,
  },
  {
    role: "marketing_head",
    label: "Marketing Head",
    patterns: [
      /\bhead of marketing\b/i,
      /\bmarketing head\b/i,
    ],
    priority: 90,
  },
  {
    role: "marketing_manager",
    label: "Marketing Manager",
    patterns: [
      /\bmarketing manager\b/i,
    ],
    priority: 82,
  },
  {
    role: "brand_head",
    label: "Brand Head",
    patterns: [
      /\bhead of brand\b/i,
      /\bbrand head\b/i,
    ],
    priority: 80,
  },
  {
    role: "growth_head",
    label: "Growth Head",
    patterns: [
      /\bhead of growth\b/i,
      /\bgrowth head\b/i,
    ],
    priority: 78,
  },
  {
    role: "operations_head",
    label: "Operations Head",
    patterns: [
      /\bhead of operations\b/i,
      /\boperations head\b/i,
    ],
    priority: 75,
  },
  {
    role: "coo",
    label: "COO",
    patterns: [
      /\bchief operating officer\b/i,
      /\bCOO\b/i,
    ],
    priority: 74,
  },
];

const BLOCKED_SOURCE_HOSTS = new Set([
  "eyehospitalnearme.in",
  "proceed.fit",
  "justdial.com",
  "sulekha.com",
  "yelp.com",
  "tripadvisor.com",
  "yellowpages.com",
  "foursquare.com",
  "practo.com",
  "magicpin.in",
  "indiamart.com",
  "tradeindia.com",
  "zaubacorp.com",
  "webindia123.com",
  "medindia.net",
  "dentee.com",
  "hexahealth.com",
  "top-rated.online",
  "lybrate.com",
  "credihealth.com",
  "askapollo.com",
  "bdir.in",
  "indiainfo.net",
  "deldure.com",
]);

const NON_PERSON_PHRASES = [
  "street view",
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
  "privacy policy",
  "terms and conditions",
];

const NON_PERSON_WORDS = new Set([
  "co",
  "company",
  "companies",
  "corporation",
  "corp",
  "inc",
  "incorporated",
  "llc",
  "llp",
  "limited",
  "ltd",
  "group",
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
  "solutions",
  "services",
  "health",
  "medical",
  "medicine",
  "skin",
  "beauty",
  "aesthetic",
  "aesthetics",
  "dental",
  "care",
  "find",
  "local",
  "near",
  "nearby",
  "directory",
  "directories",
  "search",
  "results",
  "result",
  "listing",
  "listings",
  "maps",
  "map",
  "street",
  "view",
  "views",
  "directions",
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
  "of",
  "the",
  "and",
  "for",
  "with",
  "at",
  "in",
]);

const BUSINESS_STOP_WORDS = new Set([
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
  "center",
  "centre",
  "studio",
  "agency",
  "company",
  "skin",
  "beauty",
  "aesthetic",
  "aesthetics",
  "medical",
  "health",
  "healthcare",
  "dental",
  "dermatology",
  "dermatologist",
  "cosmetic",
  "cosmetics",
  "care",
  "services",
  "service",
]);

function cleanText(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeHostname(value: string): string {
  try {
    return new URL(value)
      .hostname
      .toLowerCase()
      .replace(/^www\./, "");
  } catch {
    return "";
  }
}

function isBlockedSourceUrl(value: string): boolean {
  const host = normalizeHostname(value);

  if (!host) {
    return true;
  }

  for (const blocked of BLOCKED_SOURCE_HOSTS) {
    if (
      host === blocked ||
      host.endsWith(`.${blocked}`)
    ) {
      return true;
    }
  }

  return false;
}

function isSameWebsiteHost(
  website: string,
  sourceUrl: string,
): boolean {
  const websiteHost = normalizeHostname(website);
  const sourceHost = normalizeHostname(sourceUrl);

  if (!websiteHost || !sourceHost) {
    return false;
  }

  return (
    websiteHost === sourceHost ||
    websiteHost.endsWith(`.${sourceHost}`) ||
    sourceHost.endsWith(`.${websiteHost}`)
  );
}

function containsRejectedPersonPhrase(
  value: string,
): boolean {
  const normalized = cleanText(value).toLowerCase();

  return NON_PERSON_PHRASES.some((phrase) =>
    normalized.includes(phrase),
  );
}

function normalizeName(value: string): string {
  return cleanText(
    value
      .replace(
        /^(mr|mrs|ms|miss|dr|prof)\.?\s+/i,
        "",
      )
      .replace(/\s+/g, " "),
  );
}

function looksLikePersonName(
  value: string,
): boolean {
  const name = normalizeName(value);

  if (name.length < 4 || name.length > 80) {
    return false;
  }

  if (
    /@|https?:\/\/|www\.|[0-9]{2,}/i.test(name)
  ) {
    return false;
  }

  if (containsRejectedPersonPhrase(name)) {
    return false;
  }

  const words = name.split(/\s+/);

  if (words.length < 2 || words.length > 4) {
    return false;
  }

  const normalizedWords = words.map((word) =>
    word
      .toLowerCase()
      .replace(/[.,]/g, ""),
  );

  if (
    normalizedWords.some((word) =>
      NON_PERSON_WORDS.has(word),
    )
  ) {
    return false;
  }

  return words.every((word) =>
    /^[A-Za-zÀ-ÖØ-öø-ÿ'’-]+$/.test(word),
  );
}

function getRoleMatch(
  text: string,
): {
  role: DecisionMakerRole;
  label: string;
  priority: number;
} | null {
  let best:
    | {
        role: DecisionMakerRole;
        label: string;
        priority: number;
      }
    | null = null;

  for (const definition of ROLE_PATTERNS) {
    const matches = definition.patterns.some(
      (pattern) => pattern.test(text),
    );

    if (!matches) {
      continue;
    }

    if (
      !best ||
      definition.priority > best.priority
    ) {
      best = {
        role: definition.role,
        label: definition.label,
        priority: definition.priority,
      };
    }
  }

  return best;
}

function extractVisibleText(
  html: string,
): string {
  return cleanText(
    html
      .replace(
        /<script[\s\S]*?<\/script>/gi,
        " ",
      )
      .replace(
        /<style[\s\S]*?<\/style>/gi,
        " ",
      )
      .replace(
        /<noscript[\s\S]*?<\/noscript>/gi,
        " ",
      )
      .replace(
        /<svg[\s\S]*?<\/svg>/gi,
        " ",
      )
      .replace(/<[^>]+>/g, " "),
  );
}

function extractHeadingTexts(
  html: string,
): string[] {
  const results: string[] = [];

  const regex =
    /<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/gi;

  let match: RegExpExecArray | null;

  while ((match = regex.exec(html)) !== null) {
    const heading = cleanText(
      match[1].replace(/<[^>]+>/g, " "),
    );

    if (heading) {
      results.push(heading);
    }
  }

  return results;
}

function extractLinks(
  html: string,
  baseUrl: string,
): PageCandidate[] {
  const results: PageCandidate[] = [];

  const regex =
    /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

  let match: RegExpExecArray | null;

  while ((match = regex.exec(html)) !== null) {
    const href = match[1];

    const anchorText = cleanText(
      match[2].replace(/<[^>]+>/g, " "),
    );

    let url: URL;

    try {
      url = new URL(href, baseUrl);
    } catch {
      continue;
    }

    if (
      url.protocol !== "http:" &&
      url.protocol !== "https:"
    ) {
      continue;
    }

    if (
      !isSameWebsiteHost(
        baseUrl,
        url.toString(),
      )
    ) {
      continue;
    }

    const combined =
      `${anchorText} ${url.pathname}`.toLowerCase();

    let priority = 0;

    if (
      /team|our-team|leadership|people|founder|about-us|about/i.test(
        combined,
      )
    ) {
      priority = 100;
    } else if (
      /company|who-we-are|about/i.test(
        combined,
      )
    ) {
      priority = 70;
    } else if (/contact/i.test(combined)) {
      priority = 30;
    }

    if (priority > 0) {
      results.push({
        url: url.toString(),
        priority,
      });
    }
  }

  return results;
}

function buildPageQueue(
  website: string,
  homepageHtml: string,
): PageCandidate[] {
  let origin: string;

  try {
    origin = new URL(website).origin;
  } catch {
    return [];
  }

  const queue: PageCandidate[] = [];

  const commonPaths = [
    "/about",
    "/about-us",
    "/team",
    "/our-team",
    "/leadership",
    "/people",
    "/founders",
    "/contact",
  ];

  for (const path of commonPaths) {
    queue.push({
      url: `${origin}${path}`,
      priority:
        /team|leadership|people|founder/i.test(
          path,
        )
          ? 100
          : /about/i.test(path)
            ? 80
            : 30,
    });
  }

  queue.push(
    ...extractLinks(
      homepageHtml,
      website,
    ),
  );

  const seen = new Set<string>();

  return queue
    .sort(
      (a, b) => b.priority - a.priority,
    )
    .filter((candidate) => {
      const normalized = candidate.url
        .split("#")[0]
        .replace(/\/+$/, "")
        .toLowerCase();

      if (seen.has(normalized)) {
        return false;
      }

      seen.add(normalized);

      return true;
    })
    .slice(0, MAX_PAGES - 1);
}

async function fetchPage(
  url: string,
): Promise<string | null> {
  const controller = new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT,
  );

  try {
    const response = await fetch(url, {
      headers: {
        Accept:
          "text/html,application/xhtml+xml",
        "User-Agent":
          "SoleTrust-AutoRadar/1.0",
      },
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const contentType =
      response.headers.get("content-type") ?? "";

    if (
      !contentType.includes("text/html") &&
      !contentType.includes(
        "application/xhtml+xml",
      )
    ) {
      return null;
    }

    const html = await response.text();

    return html.slice(0, MAX_HTML_LENGTH);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function getBusinessTokens(
  companyName: string,
): string[] {
  return companyName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(
      (token) =>
        token.length >= 3 &&
        !BUSINESS_STOP_WORDS.has(token),
    );
}

/**
 * The source page must belong to the official website.
 *
 * We intentionally do NOT require the company name to appear
 * in the exact same sentence as the person's name.
 *
 * A legitimate About/Team page commonly has:
 *
 *   Our Team
 *   Rahul Sharma
 *   Founder
 *
 * while the company name appears in the page title,
 * navigation, header, or another nearby section.
 */
function isOfficialBusinessSource(
  lead: Lead,
  sourceUrl: string,
): boolean {
  if (!lead.website) {
    return false;
  }

  if (isBlockedSourceUrl(sourceUrl)) {
    return false;
  }

  return isSameWebsiteHost(
    lead.website,
    sourceUrl,
  );
}

function hasBusinessContext(
  lead: Lead,
  pageText: string,
): boolean {
  const tokens = getBusinessTokens(
    lead.companyName,
  );

  if (tokens.length === 0) {
    return true;
  }

  const normalized = pageText.toLowerCase();

  const matched = tokens.filter((token) =>
    normalized.includes(token),
  );

  if (tokens.length >= 3) {
    return matched.length >= 2;
  }

  return matched.length >= 1;
}

function extractNameFromRoleSentence(
  sentence: string,
): string | null {
  const role =
    "(?:founder|co-founder|owner|proprietor|ceo|chief executive officer|cmo|chief marketing officer|marketing head|head of marketing|marketing manager|brand head|head of brand|growth head|head of growth|operations head|head of operations|coo|chief operating officer)";

  const patterns = [
    new RegExp(
      `(?:^|\\b)([A-Z][A-Za-zÀ-ÖØ-öø-ÿ'’-]+(?:\\s+[A-Z][A-Za-zÀ-ÖØ-öø-ÿ'’-]+){1,3})\\s*[-–—,:|]\\s*(?:the\\s+)?${role}\\b`,
      "i",
    ),

    new RegExp(
      `${role}\\s*[-–—,:|]\\s*([A-Z][A-Za-zÀ-ÖØ-öø-ÿ'’-]+(?:\\s+[A-Z][A-Za-zÀ-ÖØ-öø-ÿ'’-]+){1,3})`,
      "i",
    ),

    new RegExp(
      `\\b([A-Z][A-Za-zÀ-ÖØ-öø-ÿ'’-]+(?:\\s+[A-Z][A-Za-zÀ-ÖØ-öø-ÿ'’-]+){1,3})\\s*,?\\s+(?:is|was|serves as)\\s+(?:the\\s+)?${role}\\b`,
      "i",
    ),

    new RegExp(
      `\\b${role}\\s+(?:is\\s+)?(?:held by|by)\\s+([A-Z][A-Za-zÀ-ÖØ-öø-ÿ'’-]+(?:\\s+[A-Z][A-Za-zÀ-ÖØ-öø-ÿ'’-]+){1,3})`,
      "i",
    ),

    /\bfounded\s+by\s+([A-Z][A-Za-zÀ-ÖØ-öø-ÿ'’-]+(?:\s+[A-Z][A-Za-zÀ-ÖØ-öø-ÿ'’-]+){1,3})\b/i,

    /\bstarted\s+by\s+([A-Z][A-Za-zÀ-ÖØ-öø-ÿ'’-]+(?:\s+[A-Z][A-Za-zÀ-ÖØ-öø-ÿ'’-]+){1,3})\b/i,

    /\bled\s+by\s+([A-Z][A-Za-zÀ-ÖØ-öø-ÿ'’-]+(?:\s+[A-Z][A-Za-zÀ-ÖØ-öø-ÿ'’-]+){1,3})\b/i,
  ];

  for (const pattern of patterns) {
    const match = sentence.match(pattern);

    if (!match?.[1]) {
      continue;
    }

    const name = normalizeName(match[1]);

    if (looksLikePersonName(name)) {
      return name;
    }
  }

  return null;
}

function extractCandidatesFromText(
  lead: Lead,
  text: string,
  sourceUrl: string,
  profileUrl: string | null,
  pageHasBusinessContext: boolean,
): PersonCandidate[] {
  const candidates: PersonCandidate[] = [];

  if (
    !isOfficialBusinessSource(
      lead,
      sourceUrl,
    )
  ) {
    return candidates;
  }

  if (!pageHasBusinessContext) {
    return candidates;
  }

  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map(cleanText)
    .filter(Boolean);

  for (const sentence of sentences) {
    const role = getRoleMatch(sentence);

    if (!role) {
      continue;
    }

    if (containsRejectedPersonPhrase(sentence)) {
      continue;
    }

    const name =
      extractNameFromRoleSentence(
        sentence,
      );

    if (!name) {
      continue;
    }

    /*
     * The strongest evidence is an explicit relationship
     * such as:
     *
     * "Rahul Sharma - Founder"
     * "Founder: Rahul Sharma"
     * "Rahul Sharma is the Founder"
     * "Founded by Rahul Sharma"
     */
    candidates.push({
      name,
      role: role.role,
      roleLabel: role.label,
      sourceUrl,
      evidenceText: sentence.slice(0, 500),
      profileUrl,
      confidence: "high",
      evidenceStrength: 100,
    });
  }

  return candidates;
}

function extractCandidatesFromHeadings(
  lead: Lead,
  headings: string[],
  sourceUrl: string,
  profileUrl: string | null,
  pageHasBusinessContext: boolean,
): PersonCandidate[] {
  const candidates: PersonCandidate[] = [];

  if (
    !isOfficialBusinessSource(
      lead,
      sourceUrl,
    )
  ) {
    return candidates;
  }

  if (!pageHasBusinessContext) {
    return candidates;
  }

  for (const heading of headings) {
    const role = getRoleMatch(heading);

    if (!role) {
      continue;
    }

    /*
     * Only accept headings where the role and name are
     * clearly separated.
     *
     * Examples:
     *   "Rahul Sharma - Founder"
     *   "Founder: Rahul Sharma"
     *   "Dr. Rahul Sharma | Founder"
     */
    const name =
      extractNameFromRoleSentence(
        heading,
      );

    if (!name) {
      continue;
    }

    candidates.push({
      name,
      role: role.role,
      roleLabel: role.label,
      sourceUrl,
      evidenceText: heading.slice(0, 500),
      profileUrl,
      confidence: "high",
      evidenceStrength: 95,
    });
  }

  return candidates;
}

function profileUrlMatchesName(
  profileUrl: string,
  name: string,
): boolean {
  let pathname = "";

  try {
    pathname = new URL(profileUrl)
      .pathname
      .toLowerCase();
  } catch {
    return false;
  }

  const nameTokens = name
    .toLowerCase()
    .split(/\s+/)
    .filter(
      (token) =>
        token.length >= 3,
    );

  if (nameTokens.length === 0) {
    return false;
  }

  const normalizedPath =
    pathname.replace(
      /[^a-z0-9]/g,
      " ",
    );

  const matches = nameTokens.filter(
    (token) =>
      normalizedPath.includes(token),
  );

  return matches.length >= Math.min(
    2,
    nameTokens.length,
  );
}

function extractProfessionalProfileUrl(
  html: string,
  baseUrl: string,
  candidateName?: string,
): string | null {
  const regex =
    /<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi;

  let match: RegExpExecArray | null;

  const possibleUrls: string[] = [];

  while ((match = regex.exec(html)) !== null) {
    let url: URL;

    try {
      url = new URL(
        match[1],
        baseUrl,
      );
    } catch {
      continue;
    }

    const host = url.hostname
      .toLowerCase()
      .replace(/^www\./, "");

    const path =
      url.pathname.toLowerCase();

    if (
      host === "linkedin.com" &&
      /^\/in\/[^/]+/i.test(path)
    ) {
      possibleUrls.push(
        url.toString(),
      );
    }

    if (
      host === "instagram.com" &&
      /^\/[a-z0-9._-]+\/?$/i.test(path)
    ) {
      possibleUrls.push(
        url.toString(),
      );
    }
  }

  if (
    !candidateName ||
    possibleUrls.length === 0
  ) {
    return null;
  }

  return (
    possibleUrls.find((url) =>
      profileUrlMatchesName(
        url,
        candidateName,
      ),
    ) ?? null
  );
}

function dedupeCandidates(
  candidates: PersonCandidate[],
): PersonCandidate[] {
  const map = new Map<
    string,
    PersonCandidate
  >();

  for (const candidate of candidates) {
    const key =
      `${candidate.name.toLowerCase()}|${candidate.role}`;

    const existing = map.get(key);

    if (!existing) {
      map.set(key, candidate);
      continue;
    }

    if (
      candidate.evidenceStrength >
      existing.evidenceStrength
    ) {
      map.set(key, candidate);
      continue;
    }

    if (
      !existing.profileUrl &&
      candidate.profileUrl
    ) {
      map.set(key, candidate);
    }
  }

  return [...map.values()];
}

function chooseBestCandidate(
  candidates: PersonCandidate[],
): PersonCandidate | null {
  if (candidates.length === 0) {
    return null;
  }

  const priorityByRole = new Map(
    ROLE_PATTERNS.map((item) => [
      item.role,
      item.priority,
    ]),
  );

  return [...candidates].sort(
    (a, b) => {
      const evidenceDifference =
        b.evidenceStrength -
        a.evidenceStrength;

      if (evidenceDifference !== 0) {
        return evidenceDifference;
      }

      const roleDifference =
        (priorityByRole.get(b.role) ?? 0) -
        (priorityByRole.get(a.role) ?? 0);

      if (roleDifference !== 0) {
        return roleDifference;
      }

      return (
        a.name.localeCompare(
          b.name,
        )
      );
    },
  )[0] ?? null;
}

function buildEvidence(
  candidate: PersonCandidate,
): ContactEvidence[] {
  const evidence: ContactEvidence[] = [
    {
      field: "name",
      value: candidate.name,
      sourceType: "company_website",
      sourceUrl: candidate.sourceUrl,
      confidence: candidate.confidence,
      verified: true,
      evidenceText:
        candidate.evidenceText,
    },
    {
      field: "role",
      value: candidate.roleLabel,
      sourceType: "company_website",
      sourceUrl: candidate.sourceUrl,
      confidence: candidate.confidence,
      verified: true,
      evidenceText:
        candidate.evidenceText,
    },
  ];

  if (candidate.profileUrl) {
    const isLinkedIn =
      candidate.profileUrl.includes(
        "linkedin.com",
      );

    evidence.push({
      field: isLinkedIn
        ? "linkedin"
        : "instagram",
      value: candidate.profileUrl,
      sourceType: isLinkedIn
        ? "public_professional_profile"
        : "public_social_profile",
      sourceUrl:
        candidate.profileUrl,
      confidence: "medium",
      verified: true,
      evidenceText:
        "The professional or social profile was directly linked from the official company website and its URL matches the identified person's name.",
    });
  }

  return evidence;
}

export async function researchDecisionMaker(
  lead: Lead,
): Promise<DecisionMaker | null> {
  if (
    !lead.website ||
    !lead.website.trim()
  ) {
    return null;
  }

  const website =
    lead.website.trim();

  if (isBlockedSourceUrl(website)) {
    return null;
  }

  const homepageHtml =
    await fetchPage(website);

  if (!homepageHtml) {
    return null;
  }

  const pages: Page[] = [
    {
      url: website,
      html: homepageHtml,
    },
  ];

  const queue = buildPageQueue(
    website,
    homepageHtml,
  );

  for (const candidate of queue) {
    if (pages.length >= MAX_PAGES) {
      break;
    }

    /*
     * Never leave the official domain.
     */
    if (
      !isSameWebsiteHost(
        website,
        candidate.url,
      )
    ) {
      continue;
    }

    const html =
      await fetchPage(
        candidate.url,
      );

    if (!html) {
      continue;
    }

    pages.push({
      url: candidate.url,
      html,
    });
  }

  const candidates: PersonCandidate[] =
    [];

  for (const page of pages) {
    if (
      !isOfficialBusinessSource(
        lead,
        page.url,
      )
    ) {
      continue;
    }

    const text =
      extractVisibleText(
        page.html,
      );

    const headings =
      extractHeadingTexts(
        page.html,
      );

    /*
     * The page must contain at least some evidence
     * of the business identity.
     */
    const pageHasBusinessContext =
      hasBusinessContext(
        lead,
        text,
      );

    if (!pageHasBusinessContext) {
      continue;
    }

    /*
     * We first extract explicit person/role
     * relationships without trusting arbitrary
     * social links.
     */
    const textCandidates =
      extractCandidatesFromText(
        lead,
        text,
        page.url,
        null,
        pageHasBusinessContext,
      );

    candidates.push(
      ...textCandidates,
    );

    /*
     * Headings are weaker than full sentences,
     * but still acceptable when they explicitly
     * contain both a person's name and role.
     */
    const headingCandidates =
      extractCandidatesFromHeadings(
        lead,
        headings,
        page.url,
        null,
        pageHasBusinessContext,
      );

    candidates.push(
      ...headingCandidates,
    );
  }

  const unique =
    dedupeCandidates(
      candidates,
    );

  const best =
    chooseBestCandidate(
      unique,
    );

  if (!best) {
    /*
     * UNKNOWN > WRONG.
     *
     * If the official website does not explicitly
     * identify a person with a decision-maker role,
     * return null instead of guessing.
     */
    return null;
  }

  /*
   * Only now look for a matching professional/social
   * profile. This prevents an unrelated LinkedIn link
   * from becoming the decision maker.
   */
  const bestPage =
    pages.find(
      (page) =>
        page.url ===
        best.sourceUrl,
    );

  if (bestPage) {
    const matchingProfileUrl =
      extractProfessionalProfileUrl(
        bestPage.html,
        bestPage.url,
        best.name,
      );

    if (matchingProfileUrl) {
      best.profileUrl =
        matchingProfileUrl;
    }
  }

  const evidence =
    buildEvidence(best);

  return {
    name: best.name,
    role: best.role,
    roleLabel: best.roleLabel,
    profileUrl:
      best.profileUrl,
    sourceUrl:
      best.sourceUrl,
    sourceType:
      "company_website",
    confidence:
      best.confidence,
    verificationStatus:
      "verified",
    evidence,
    reason:
      `The official company website explicitly identifies ${best.name} as ${best.roleLabel}.`,
  };
}
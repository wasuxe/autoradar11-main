import type { Lead } from "@/lib/leads/types";
import { normalizeLead } from "@/lib/leads/normalize";

import type {
  DiscoveryProvider,
  DiscoveryQuery,
  DiscoveryResult,
} from "@/lib/providers/types";

import { dedupeLeads } from "./dedupe";

import { analyzeWebsite } from "@/lib/intelligence/website";
import { extractWebsiteContacts } from "@/lib/enrichment/website-contact";
import { qualifyLead } from "@/lib/qualification";
import { scoreLeadRelevance } from "@/lib/relevance/score";
import { researchContactIntelligence } from "@/lib/contacts/research";

import { researchBusinessOnPublicWeb } from "@/lib/research/public-web";

import type { QualifiedLead } from "@/lib/qualification/qualified-lead";
import type { WebsiteIntelligence } from "@/lib/intelligence/types";
import type { EnrichmentResult } from "@/lib/enrichment/types";
import type { RelevanceResult } from "@/lib/relevance/types";
import type { ContactIntelligence } from "@/lib/contacts/types";
import type { SourceEvidence } from "@/lib/sources/types";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;
const DISCOVERY_MULTIPLIER = 5;
const MIN_RELEVANCE_SCORE = 45;
const ENABLE_PUBLIC_WEB_RESEARCH = true;

type CandidateQualityStatus =
  | "accepted"
  | "review"
  | "rejected";

interface CandidateQualityResult {
  status: CandidateQualityStatus;
  score: number;
  reasons: string[];
}

const GENERIC_RESULT_PATTERNS = [
  /^best\s+/i,
  /^top\s+/i,
  /^list of\s+/i,
  /^directory/i,
  /^find\s+/i,
  /^near me/i,
];

const DIRECTORY_PATTERNS = [
  "justdial",
  "sulekha",
  "yelp",
  "tripadvisor",
  "yellowpages",
  "foursquare",
  "practo",
  "magicpin",
  "indiamart",
  "deldure",
  "bdir",
  "indiainfo",
  "asklaila",
  "urbanpro",
  "top-rated.online",
  "lybrate",
  "credihealth",
  "zaubacorp",
  "webindia123",
  "medindia",
  "dentee",
  "hexahealth",
];

const CONTENT_PATTERNS = [
  "blog",
  "article",
  "news",
  "guide",
  "tips",
  "review",
  "reviews",
  "best places",
  "top places",
  "ranking",
  "anatomy",
  "structure and function",
  "diagram",
  "significance",
  "definition",
  "research paper",
  "journal article",
  "medical article",
  "wikipedia",
];

const BUSINESS_ENTITY_PATTERNS = [
  "llp",
  "ltd",
  "limited",
  "pvt",
  "private",
  "inc",
  "incorporated",
  "company",
  "clinic",
  "hospital",
  "restaurant",
  "cafe",
  "hotel",
  "salon",
  "studio",
  "agency",
  "store",
  "shop",
  "centre",
  "center",
  "institute",
];

const BLOCKED_WEBSITE_HOSTS = new Set([
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
  "eka.care",
  "www.eka.care",
  "apollo247.com",
  "www.apollo247.com",
  "365doctor.in",
  "www.365doctor.in",
  "threebestrated.in",
  "www.threebestrated.in",
  "bdir.in",
  "www.bdir.in",
  "promallu.com",
  "www.promallu.com",
  "helloindia.co",
  "www.helloindia.co",
  "yappe.in",
  "www.yappe.in",
  "findglocal.com",
  "www.findglocal.com",
  "idbf.in",
  "www.idbf.in",
  "onefivenine.com",
  "www.onefivenine.com",
  "companydetails.in",
  "www.companydetails.in",
  "falconebiz.com",
  "www.falconebiz.com",
  "compworth.com",
  "www.compworth.com",
  "f6s.com",
  "www.f6s.com",
  "wellfound.com",
  "www.wellfound.com",
  "filesure.in",
  "www.filesure.in",
  "medindia.net",
  "www.medindia.net",
  "companieshouse.blog.gov.uk",
  "facebook.com",
  "www.facebook.com",
  "instagram.com",
  "www.instagram.com",
  "linkedin.com",
  "www.linkedin.com",
  "x.com",
  "twitter.com",
  "www.twitter.com",
  "youtube.com",
  "www.youtube.com",
  "tiktok.com",
  "www.tiktok.com",
]);

function normalizeQualityText(
  value: string | null | undefined,
): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function containsAny(
  value: string,
  patterns: string[],
): string | null {
  for (const pattern of patterns) {
    if (value.includes(pattern)) {
      return pattern;
    }
  }

  return null;
}

function matchesAnyPattern(
  value: string,
  patterns: RegExp[],
): RegExp | null {
  for (const pattern of patterns) {
    if (pattern.test(value)) {
      return pattern;
    }
  }

  return null;
}

function getHostname(
  url: string | null | undefined,
): string | null {
  if (!url?.trim()) {
    return null;
  }

  try {
    const normalized =
      /^https?:\/\//i.test(url.trim())
        ? url.trim()
        : `https://${url.trim()}`;

    return new URL(normalized)
      .hostname
      .toLowerCase()
      .replace(/^www\./, "");
  } catch {
    return null;
  }
}

function isBlockedWebsite(
  website: string | null | undefined,
): boolean {
  const host = getHostname(website);

  if (!host) {
    return true;
  }

  if (BLOCKED_WEBSITE_HOSTS.has(host)) {
    return true;
  }

  const blockedHostFragments = [
    "directory",
    "directories",
    "yellowpages",
    "top-rated",
    "findnearby",
    "near-me",
    "businesslisting",
    "business-listing",
  ];

  return blockedHostFragments.some(
    (fragment) => host.includes(fragment),
  );
}

function hasUsableWebsite(
  lead: Lead,
): boolean {
  return (
    Boolean(lead.website?.trim()) &&
    !isBlockedWebsite(lead.website)
  );
}

function isDirectorySource(
  lead: Lead,
): boolean {
  const source = normalizeQualityText(
    lead.source,
  );

  const sourceUrl = normalizeQualityText(
    lead.sourceUrl,
  );

  return (
    containsAny(
      source,
      DIRECTORY_PATTERNS,
    ) !== null ||
    containsAny(
      sourceUrl,
      DIRECTORY_PATTERNS,
    ) !== null
  );
}

function isGenericBusinessResult(
  lead: Lead,
): boolean {
  const name = normalizeQualityText(
    lead.companyName,
  );

  return (
    matchesAnyPattern(
      name,
      GENERIC_RESULT_PATTERNS,
    ) !== null
  );
}

function isContentResult(
  lead: Lead,
): boolean {
  const name = normalizeQualityText(
    lead.companyName,
  );

  const description =
    normalizeQualityText(
      lead.description,
    );

  const combined =
    `${name} ${description}`;

  return (
    containsAny(
      combined,
      CONTENT_PATTERNS,
    ) !== null
  );
}

function hasBusinessSignals(
  lead: Lead,
): boolean {
  const name = normalizeQualityText(
    lead.companyName,
  );

  const description =
    normalizeQualityText(
      lead.description,
    );

  const combined =
    `${name} ${description}`;

  return (
    containsAny(
      combined,
      BUSINESS_ENTITY_PATTERNS,
    ) !== null
  );
}

function hasStrongIdentity(
  lead: Lead,
): boolean {
  const name =
    normalizeQualityText(
      lead.companyName,
    );

  if (name.length < 3) {
    return false;
  }

  const hasLocation =
    Boolean(
      normalizeQualityText(
        lead.city,
      ),
    );

  const hasWebsite =
    hasUsableWebsite(lead);

  const hasSource =
    Boolean(
      normalizeQualityText(
        lead.sourceUrl,
      ),
    );

  return (
    hasWebsite ||
    (hasLocation && hasSource)
  );
}

function assessCandidateQuality(
  lead: Lead,
): CandidateQualityResult {
  let score = 50;

  const reasons: string[] = [];

  if (isDirectorySource(lead)) {
    return {
      status: "rejected",
      score: 0,
      reasons: [
        "Candidate appears to come from a business directory rather than a business identity.",
      ],
    };
  }

  if (isGenericBusinessResult(lead)) {
    return {
      status: "rejected",
      score: 0,
      reasons: [
        "Candidate appears to be a generic category or search result.",
      ],
    };
  }

  if (isContentResult(lead)) {
    score -= 35;

    reasons.push(
      "Candidate contains content or article-like terminology.",
    );
  }

  if (hasBusinessSignals(lead)) {
    score += 20;

    reasons.push(
      "Business entity terminology detected.",
    );
  }

  if (hasUsableWebsite(lead)) {
    score += 15;

    reasons.push(
      "Website is available.",
    );
  } else if (lead.website) {
    score -= 20;

    reasons.push(
      "Provided website appears to be a directory or non-business source.",
    );
  }

  if (
    normalizeQualityText(lead.city)
  ) {
    score += 10;

    reasons.push(
      "Business location is available.",
    );
  }

  if (
    normalizeQualityText(
      lead.sourceUrl,
    )
  ) {
    score += 5;

    reasons.push(
      "Source URL is available.",
    );
  }

  const strongIdentity =
    hasStrongIdentity(lead);

  if (!strongIdentity) {
    score -= 20;

    reasons.push(
      "Business identity is weakly substantiated.",
    );
  } else {
    reasons.push(
      "Business identity has sufficient initial evidence.",
    );
  }

  score = Math.max(
    0,
    Math.min(100, score),
  );

  if (score < 35) {
    return {
      status: "rejected",
      score,
      reasons,
    };
  }

  if (!strongIdentity) {
    return {
      status: "review",
      score,
      reasons,
    };
  }

  if (score < 60) {
    return {
      status: "review",
      score,
      reasons,
    };
  }

  return {
    status: "accepted",
    score,
    reasons,
  };
}

function filterCandidateQuality(
  leads: Lead[],
): {
  accepted: Lead[];
  review: Lead[];
  rejected: Lead[];
  results: CandidateQualityResult[];
} {
  const accepted: Lead[] = [];
  const review: Lead[] = [];
  const rejected: Lead[] = [];
  const results: CandidateQualityResult[] = [];

  for (const lead of leads) {
    const result =
      assessCandidateQuality(lead);

    results.push(result);

    if (
      result.status ===
      "accepted"
    ) {
      accepted.push(lead);
    } else if (
      result.status ===
      "review"
    ) {
      review.push(lead);
    } else {
      rejected.push(lead);
    }
  }

  return {
    accepted,
    review,
    rejected,
    results,
  };
}

function clampLimit(
  limit?: number,
): number {
  if (!Number.isFinite(limit)) {
    return DEFAULT_LIMIT;
  }

  return Math.min(
    MAX_LIMIT,
    Math.max(
      1,
      Math.floor(limit as number),
    ),
  );
}

function getCandidateLimit(
  requestedLimit: number,
): number {
  return Math.min(
    MAX_LIMIT,
    Math.max(
      requestedLimit,
      requestedLimit *
        DISCOVERY_MULTIPLIER,
    ),
  );
}

function hasWebsite(
  lead: Lead,
): boolean {
  return hasUsableWebsite(lead);
}

function getRelevanceScore(
  result: QualifiedLead,
): number {
  return (
    result.relevance?.score ??
    0
  );
}

function getQualificationScore(
  result: QualifiedLead,
): number {
  return (
    result.qualification?.score ??
    0
  );
}

function buildRelevanceQuery(
  query: DiscoveryQuery,
  lead: Lead,
): string {
  const parts = [
    query.text,
    query.industry,
    query.city,
    query.country,
    lead.companyName,
    lead.industry,
    lead.description,
  ];

  return parts
    .filter(
      (
        value,
      ): value is string =>
        typeof value ===
          "string" &&
        value.trim().length >
          0,
    )
    .join(" ");
}

async function safeAnalyzeWebsite(
  lead: Lead,
): Promise<WebsiteIntelligence | null> {
  if (!hasWebsite(lead)) {
    return null;
  }

  try {
    return await analyzeWebsite(
      lead.website as string,
    );
  } catch (error) {
    console.warn(
      `[AutoRadar] Website analysis failed for "${lead.companyName}"`,
      error,
    );

    return null;
  }
}

async function safeExtractContacts(
  lead: Lead,
): Promise<EnrichmentResult | null> {
  if (!hasWebsite(lead)) {
    return null;
  }

  try {
    return await extractWebsiteContacts(
      lead,
    );
  } catch (error) {
    console.warn(
      `[AutoRadar] Website contact extraction failed for "${lead.companyName}"`,
      error,
    );

    return null;
  }
}

async function safeResearchContacts(
  lead: Lead,
): Promise<ContactIntelligence | null> {
  try {
    return await researchContactIntelligence(
      lead,
    );
  } catch (error) {
    console.warn(
      `[AutoRadar] Contact research failed for "${lead.companyName}"`,
      error,
    );

    return null;
  }
}

function buildContactEvidence(
  contactIntelligence:
    | ContactIntelligence
    | null,
): SourceEvidence[] {
  if (!contactIntelligence) {
    return [];
  }

  return contactIntelligence.evidence.map(
    (item) => ({
      field: item.field,
      value: item.value,

      sourceType:
        item.sourceType ===
        "company_website"
          ? "company_website"
          : item.sourceType ===
              "company_about"
            ? "company_about"
            : item.sourceType ===
                "company_team"
              ? "company_team"
              : item.sourceType ===
                  "company_contact"
                ? "company_contact"
                : item.sourceType ===
                    "public_professional_profile"
                  ? "public_search"
                  : item.sourceType ===
                      "public_social_profile"
                    ? "public_social"
                    : item.sourceType ===
                        "public_business_directory"
                      ? "public_directory"
                      : item.sourceType ===
                          "licensed_enrichment"
                        ? "licensed_provider"
                        : "manual",

      sourceUrl:
        item.sourceUrl ?? null,

      confidence:
        item.confidence,

      verification:
        item.verified
          ? "verified"
          : "unverified",

      evidenceText:
        item.evidenceText ?? null,

      discoveredAt:
        new Date().toISOString(),
    }),
  );
}

async function safeScoreRelevance(
  lead: Lead,
  query: DiscoveryQuery,
  websiteIntelligence:
    | WebsiteIntelligence
    | null,
): Promise<RelevanceResult | null> {
  try {
    return await scoreLeadRelevance(
      lead,
      buildRelevanceQuery(
        query,
        lead,
      ),
      websiteIntelligence ??
        undefined,
    );
  } catch (error) {
    console.warn(
      `[AutoRadar] Relevance scoring failed for "${lead.companyName}"`,
      error,
    );

    return null;
  }
}

async function safeQualifyLead(
  lead: Lead,
  websiteIntelligence:
    | WebsiteIntelligence
    | null,
): Promise<
  QualifiedLead["qualification"]
> {
  try {
    return await qualifyLead(
      lead,
      websiteIntelligence ??
        undefined,
    );
  } catch (error) {
    console.warn(
      `[AutoRadar] Qualification failed for "${lead.companyName}"`,
      error,
    );

    return {
      score: 0,
      status: "low",
      signals: [],
    };
  }
}

function normalizeCandidates(
  candidates: Record<
    string,
    unknown
  >[],
): Lead[] {
  return candidates
    .map((candidate) => {
      try {
        return normalizeLead(
          candidate,
        );
      } catch (error) {
        console.warn(
          "[AutoRadar] Failed to normalize discovery candidate",
          error,
        );

        return null;
      }
    })
    .filter(
      (
        lead,
      ): lead is Lead =>
        lead !== null,
    );
}

async function safePublicWebResearch(
  lead: Lead,
): Promise<Lead> {
  if (
    !ENABLE_PUBLIC_WEB_RESEARCH
  ) {
    return lead;
  }

  /*
   * Never trust a directory/social/listing URL
   * as an official website.
   */
  const leadForResearch =
    hasUsableWebsite(lead)
      ? lead
      : {
          ...lead,
          website: null,
        };

  try {
    const research =
      await researchBusinessOnPublicWeb(
        {
          lead: leadForResearch,
          businessName:
            lead.companyName,
          city:
            lead.city ?? null,
          country:
            lead.country ?? null,
          industry:
            lead.industry ?? null,
          address: null,
        },
      );

    if (
      research.website &&
      !isBlockedWebsite(
        research.website,
      ) &&
      research.candidates.some(
        (candidate) =>
          candidate.url ===
          research.website,
      )
    ) {
      return {
        ...lead,
        website:
          research.website,
      };
    }

    return {
      ...lead,
      website:
        hasUsableWebsite(lead)
          ? lead.website
          : null,
    };
  } catch (error) {
    console.warn(
      `[AutoRadar] Public-web research failed for "${lead.companyName}"`,
      error,
    );

    return {
      ...lead,
      website:
        hasUsableWebsite(lead)
          ? lead.website
          : null,
    };
  }
}

async function processLead(
  lead: Lead,
  query: DiscoveryQuery,
): Promise<QualifiedLead> {
  const researchedLead =
    await safePublicWebResearch(
      lead,
    );

  /*
   * Website research is allowed to improve the
   * business name, but only after we have a
   * usable researched website.
   *
   * This prevents SEO/search-result titles such as
   * "Dermatologist in Vadodara | Best..." from
   * becoming CRM company names.
   */
  const websiteIntelligence =
    await safeAnalyzeWebsite(
      researchedLead,
    );

  const canonicalLead =
    canonicalizeResearchedLead(
      researchedLead,
      websiteIntelligence,
    );

  const enrichment =
    await safeExtractContacts(
      canonicalLead,
    );

  const contactIntelligence =
    await safeResearchContacts(
      canonicalLead,
    );

  const evidence =
    buildContactEvidence(
      contactIntelligence,
    );

  const relevance =
    await safeScoreRelevance(
      canonicalLead,
      query,
      websiteIntelligence,
    );

  const qualification =
    await safeQualifyLead(
      canonicalLead,
      websiteIntelligence,
    );

  return {
    lead: canonicalLead,
    websiteIntelligence,
    qualification,
    enrichment,
    relevance,
    contactIntelligence,
    evidence,
  };
}

function looksLikeSearchResultTitle(
  value: string | null | undefined,
): boolean {
  const name =
    normalizeQualityText(value);

  if (!name) {
    return false;
  }

  const patterns = [
    /^best\s+/i,
    /^top\s+/i,
    /^list of\s+/i,
    /^find\s+/i,
    /^near me/i,

    /\b(best|top|leading|trusted)\b.*\b(dermatologist|skin specialist|skin clinic|doctor|hospital|clinic)\b/i,

    /\b(dermatologist|skin specialist|skin clinic|doctor)\b.*\b(best|top|trusted|advanced|treatment)\b.*\|/i,

    /\b(dermatologist|skin specialist|skin clinic)\s+in\s+[a-z\s]+(?:\s*[:|-]|$)/i,
    /\b(dermatologist|skin specialist|skin clinic)\s+in\s+[a-z\s]+.*\b(your|our)\b.*\b(partner|care|treatment|services?)\b/i,
    /\b(your|our)\s+(skin|health|healthcare|medical)\s+(care|treatment)\s+(partner|specialist|clinic)\b/i,

    /company\s+search/i,
    /business\s+search/i,
    /business\s+directory/i,
    /company\s+directory/i,
    /company\s+list/i,
    /companies\s+in/i,
    /company\s+list\s+for/i,
    /100\s+top\s+companies/i,
    /top\s+companies\s+in/i,

    /digital\s+marketing.*seo.*social\s+media/i,
    /social\s+media\s+company/i,

    /companies\s+house/i,

    /^about\s+dr\.?\s+[^-]+\s+-/i,
    /^contact\s+(us|best)/i,

    /\bdermacon\b/i,
    /\bpower[-\s]?outages?\b/i,
    /\bsolo\s+cruis/i,
    /\bcruise\b.*\bdeals?\b/i,
  ];

  return patterns.some(
    (pattern) =>
      pattern.test(name),
  );
}

const IDENTITY_STOPWORDS = new Set([
  "the",
  "and",
  "of",
  "for",
  "in",
  "at",
  "on",
  "by",
  "with",
  "official",
  "india",
  "indian",
  "vadodara",
  "ahmedabad",
  "surat",
  "gujarat",
  "best",
  "top",
  "leading",
  "trusted",
  "advanced",
  "premium",
  "specialist",
  "specialists",
  "dermatologist",
  "dermatologists",
  "doctor",
  "doctors",
  "skin",
  "hair",
  "laser",
  "clinic",
  "clinics",
  "hospital",
  "hospitals",
  "centre",
  "center",
  "treatment",
  "treatments",
  "care",
  "health",
  "medical",
  "medicine",
  "cosmetic",
  "cosmetics",
  "aesthetic",
  "aesthetics",
  "surgery",
  "surgeries",
  "services",
  "service",
  "solutions",
  "welcome",
  "about",
  "contact",
  "home",
  "city",
  "near",
  "me",
]);

function getIdentityTokens(
  value: string | null | undefined,
): string[] {
  return normalizeQualityText(value)
    .replace(/https?:\/\/|www\./g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(
      (token) =>
        token.length >= 3 &&
        !IDENTITY_STOPWORDS.has(token),
    );
}

function hasIdentityTokenOverlap(
  businessName: string | null | undefined,
  website: string | null | undefined,
): boolean {
  const nameTokens =
    getIdentityTokens(businessName);

  const host =
    getHostname(website);

  if (
    nameTokens.length === 0 ||
    !host
  ) {
    return false;
  }

  const hostTokens =
    getIdentityTokens(host);

  if (hostTokens.length === 0) {
    return false;
  }

  return nameTokens.some((token) =>
    hostTokens.some(
      (hostToken) =>
        token === hostToken ||
        token.includes(hostToken) ||
        hostToken.includes(token),
    ),
  );
}

function looksLikeGenericSeoHost(
  website: string | null | undefined,
): boolean {
  const host =
    getHostname(website);

  if (!host) {
    return true;
  }

  const normalizedHost =
    host.replace(/^www\./, "");

  /*
   * Search/SEO domains often encode the entire query rather
   * than the actual business brand, e.g.
   * bestdermatologistvadodara.com.
   */
  const genericSeoPatterns = [
    /^best[-_]/i,
    /^top[-_]/i,
    /best.*(dermatologist|doctor|clinic|skin|hospital)/i,
    /(dermatologist|doctor|clinic|skin|hospital).*(vadodara|ahmedabad|surat|gujarat)/i,
    /(vadodara|ahmedabad|surat|gujarat).*(dermatologist|doctor|clinic|skin|hospital)/i,
    /^(near|find)[-_]/i,
    /helpline/i,
    /directory/i,
    /listing/i,
    /toprated/i,
  ];

  return genericSeoPatterns.some(
    (pattern) =>
      pattern.test(normalizedHost),
  );
}

function extractNameFromWebsiteTitle(
  title: string | null | undefined,
  website?: string | null,
): string | null {
  const normalized =
    title?.trim();

  if (!normalized) {
    return null;
  }

  const parts =
    normalized
      .split(/\s*[|•·]\s*/)
      .map((part) => part.trim())
      .filter(Boolean);

  const candidates =
    parts.length > 1
      ? parts
      : normalized
          .split(/\s+-\s+/)
          .map((part) => part.trim())
          .filter(Boolean);

  /*
   * Prefer a title fragment whose non-generic tokens actually
   * occur in the website hostname. This prevents an SEO phrase
   * such as "Skin Specialist in Vadodara" from becoming the
   * company name.
   */
  for (
    const candidate of candidates
  ) {
    const value =
      candidate
        .replace(/\s+/g, " ")
        .replace(/^(about|welcome to)\s+/i, "")
        .trim();

    if (
      value.length >= 3 &&
      value.length <= 100 &&
      !looksLikeSearchResultTitle(value) &&
      !/^(home|about|contact|services|welcome)$/i.test(value) &&
      hasIdentityTokenOverlap(
        value,
        website,
      )
    ) {
      return value;
    }
  }

  return null;
}

function deriveNameFromHostname(
  website:
    | string
    | null
    | undefined,
): string | null {
  const host =
    getHostname(website);

  if (!host) {
    return null;
  }

  const label =
    host
      .split(".")[0]
      .replace(
        /^(www|m|en)$/i,
        "",
      )
      .replace(
        /[-_]+/g,
        " ",
      )
      .replace(
        /\b(official|india|in|vadodara|ahmedabad|surat|gujarat)\b/gi,
        " ",
      )
      .replace(
        /\s+/g,
        " ",
      )
      .trim();

  if (
    label.length < 3 ||
    label.length > 80
  ) {
    return null;
  }

  /*
   * Never invent a brand from a domain made only of generic
   * SEO/service/location terms.
   */
  if (
    getIdentityTokens(label).length === 0
  ) {
    return null;
  }

  return label
    .split(" ")
    .map(
      (word) =>
        word
          ? word.charAt(0).toUpperCase() +
            word.slice(1)
          : word,
    )
    .join(" ");
}

function canonicalizeResearchedLead(
  lead: Lead,
  websiteIntelligence:
    | WebsiteIntelligence
    | null,
): Lead {
  if (
    !hasUsableWebsite(lead)
  ) {
    return lead;
  }

  const currentName =
    lead.companyName?.trim();

  /*
   * If discovery already supplied a plausible business name,
   * keep it. The final identity gate will still require the
   * name/domain relationship for public-web results.
   */
  const normalizedCurrentName =
    normalizeQualityText(currentName);

  const hasTitleDecorators =
    /\||•|·/u.test(currentName ?? "") ||
    /^(about|welcome to|contact)\b/i.test(
      normalizedCurrentName,
    ) ||
    /\b(specialist|dermatologist|skin specialist|doctor)\b.*\b(in|vadodara|ahmedabad|surat|gujarat)\b/i.test(
      normalizedCurrentName,
    );

  if (
    currentName &&
    !hasTitleDecorators &&
    !looksLikeSearchResultTitle(
      currentName,
    ) &&
    hasIdentityTokenOverlap(
      currentName,
      lead.website,
    )
  ) {
    return lead;
  }

  const titleName =
    extractNameFromWebsiteTitle(
      websiteIntelligence?.title,
      lead.website,
    );

  /*
   * Only use a hostname-derived name when the hostname itself
   * contains a non-generic brand token. Never turn
   * "bestdermatologistvadodara.com" into a fake company.
   */
  const hostnameName =
    !looksLikeGenericSeoHost(
      lead.website,
    )
      ? deriveNameFromHostname(
          lead.website,
        )
      : null;

  const canonicalName =
    titleName ??
    hostnameName;

  if (!canonicalName) {
    return {
      ...lead,
      companyName:
        currentName ?? lead.companyName,
    };
  }

  return {
    ...lead,
    companyName:
      canonicalName,
  };
}

function canonicalWebsiteKey(
  website:
    | string
    | null
    | undefined,
): string | null {
  const host =
    getHostname(website);

  if (
    !host ||
    isBlockedWebsite(website)
  ) {
    return null;
  }

  return host;
}

function normalizeBusinessKey(
  value:
    | string
    | null
    | undefined,
): string {
  return normalizeQualityText(
    value,
  )
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getPostResearchIdentityKey(
  result: QualifiedLead,
): string {
  const websiteKey =
    canonicalWebsiteKey(
      result.lead.website,
    );

  if (websiteKey) {
    const city =
      normalizeBusinessKey(
        result.lead.city,
      );

    return city
      ? `website:${websiteKey}|city:${city}`
      : `website:${websiteKey}`;
  }

  const name =
    normalizeBusinessKey(
      result.lead.companyName,
    );

  const city =
    normalizeBusinessKey(
      result.lead.city,
    );

  const country =
    normalizeBusinessKey(
      result.lead.country,
    );

  if (
    name &&
    (city || country)
  ) {
    return `business:${name}|city:${city}|country:${country}`;
  }

  return `unresolved:${name || "unknown"}:${city || "unknown"}:${country || "unknown"}:${result.lead.sourceUrl ?? "no-source"}`;
}

function getResultDataQualityScore(
  result: QualifiedLead,
): number {
  let score = 0;

  const website =
    canonicalWebsiteKey(
      result.lead.website,
    );

  if (website) {
    score += 20;
  }

  if (
    result.contactIntelligence
      ?.decisionMaker
      ?.verificationStatus ===
    "verified"
  ) {
    score += 30;
  }

  if (
    result.contactIntelligence?.emails?.some(
      (item) =>
        item.verificationStatus ===
        "verified",
    )
  ) {
    score += 20;
  }

  if (
    result.contactIntelligence?.phones?.some(
      (item) =>
        item.verificationStatus ===
        "verified",
    )
  ) {
    score += 15;
  }

  if (result.lead.city) {
    score += 5;
  }

  if (result.lead.sourceUrl) {
    score += 5;
  }

  if (result.evidence?.length) {
    score += 5;
  }

  return Math.min(
    score,
    100,
  );
}

function dedupeProcessedResults(
  results: QualifiedLead[],
): QualifiedLead[] {
  const groups =
    new Map<
      string,
      QualifiedLead[]
    >();

  for (const result of results) {
    const key =
      getPostResearchIdentityKey(
        result,
      );

    const existing =
      groups.get(key);

    if (existing) {
      existing.push(result);
    } else {
      groups.set(key, [
        result,
      ]);
    }
  }

  const output: QualifiedLead[] =
    [];

  for (
    const candidates of groups.values()
  ) {
    candidates.sort(
      (a, b) => {
        const dataDifference =
          getResultDataQualityScore(
            b,
          ) -
          getResultDataQualityScore(
            a,
          );

        if (
          dataDifference !== 0
        ) {
          return dataDifference;
        }

        const relevanceDifference =
          getRelevanceScore(b) -
          getRelevanceScore(a);

        if (
          relevanceDifference !== 0
        ) {
          return relevanceDifference;
        }

        const qualificationDifference =
          getQualificationScore(b) -
          getQualificationScore(a);

        if (
          qualificationDifference !==
          0
        ) {
          return qualificationDifference;
        }

        const aName =
          normalizeBusinessKey(
            a.lead.companyName,
          );

        const bName =
          normalizeBusinessKey(
            b.lead.companyName,
          );

        return aName.localeCompare(
          bName,
        );
      },
    );

    const best =
      candidates[0];

    if (best) {
      output.push(best);
    }
  }

  return output;
}

function rankLeads(
  leads: QualifiedLead[],
): QualifiedLead[] {
  return [...leads].sort(
    (a, b) => {
      const relevanceDifference =
        getRelevanceScore(b) -
        getRelevanceScore(a);

      if (
        relevanceDifference !== 0
      ) {
        return relevanceDifference;
      }

      const qualificationDifference =
        getQualificationScore(b) -
        getQualificationScore(a);

      if (
        qualificationDifference !==
        0
      ) {
        return qualificationDifference;
      }

      return (
        Number(
          hasWebsite(b.lead),
        ) -
        Number(
          hasWebsite(a.lead),
        )
      );
    },
  );
}

function isPublicWebDiscoveryLead(
  lead: Lead,
): boolean {
  const source =
    normalizeQualityText(
      lead.source,
    );

  const sourceUrl =
    normalizeQualityText(
      lead.sourceUrl,
    );

  return (
    source === "public_web" ||
    source === "searxng" ||
    source.includes("public_web") ||
    source.includes("searxng") ||
    sourceUrl.includes("searxng")
  );
}

function hasValidBusinessIdentity(
  result: QualifiedLead,
): boolean {
  const lead = result.lead;

  const companyName =
    normalizeQualityText(
      lead.companyName,
    );

  if (
    companyName.length < 3
  ) {
    return false;
  }

  /*
   * Public-web/search results must have a
   * verified usable official website.
   *
   * A city + search-result URL is NOT enough.
   * This is the exact condition that allowed
   * "Quanta Process", "Dermacon", "MGVCL",
   * company-list pages, etc. through the gate.
   */
  if (
    isPublicWebDiscoveryLead(
      lead,
    ) &&
    !hasUsableWebsite(lead)
  ) {
    return false;
  }

  if (
    looksLikeSearchResultTitle(
      companyName,
    )
  ) {
    return false;
  }

  const website =
    lead.website?.trim() ?? "";

  /*
   * Public-web candidates need an actual business/domain
   * relationship. A valid HTTP page is not proof that the
   * page belongs to the business we searched for.
   *
   * Examples:
   *   "Sakhiya Skin Clinic" -> sakhiyaskinclinic.com  ✓
   *   "Dr. Nidhi Patel" -> drnidhipatel.com          ✓
   *   "Skin Treatment Vadodara" -> bestdermatologist... ✗
   *   "Acura Skin Clinic" -> vadodarahelpline.com     ✗
   */
  if (website) {
    /*
     * Any discovered website must have a plausible brand/domain
     * relationship. This deliberately does not depend on the
     * provider label because the routed discovery layer can
     * return SearXNG results through an Overpass-labelled route.
     */
    if (
      !hasIdentityTokenOverlap(
        companyName,
        website,
      )
    ) {
      return false;
    }

    if (
      looksLikeGenericSeoHost(
        website,
      )
    ) {
      return false;
    }
  }

  const hostname =
    getHostname(website);

  if (
    hostname &&
    isBlockedWebsite(website)
  ) {
    return false;
  }

  const pathname = (() => {
    if (!website) {
      return "";
    }

    try {
      return new URL(
        website.startsWith("http")
          ? website
          : `https://${website}`,
      )
        .pathname
        .toLowerCase();
    } catch {
      return "";
    }
  })();

  const blockedOfficialSourceHosts = [
    "gov.uk",
    "gov.in",
    "gov",
    "companieshouse.gov.uk",
    "mca.gov.in",
  ];

  if (
    hostname &&
    blockedOfficialSourceHosts.some(
      (blocked) =>
        hostname === blocked ||
        hostname.endsWith(
          `.${blocked}`,
        ),
    )
  ) {
    return false;
  }

  const blockedPathFragments = [
    "/search",
    "/results",
    "/query",
    "/find",
    "/directory",
    "/directories",
    "/listing",
    "/listings",
    "/company-search",
    "/business-search",
    "/business-directory",
    "/company-directory",
    "/doctor-directory",
    "/clinic-directory",
    "/hospital-directory",
    "/local-business",
    "/local-businesses",
    "/power-outages",
    "/power-outages.php",
    "/companies/",
    "/companies_",
    "/top-100",
    "/toprated/",
    "/dermatologist/",
    "/doctors/",
  ];

  if (
    blockedPathFragments.some(
      (fragment) =>
        pathname === fragment ||
        pathname.startsWith(
          fragment,
        ),
    )
  ) {
    return false;
  }

  /*
   * If this is a public-web lead and we don't
   * have a canonical name after website research,
   * do not invent one from the search snippet.
   */
  if (
    isPublicWebDiscoveryLead(
      lead,
    ) &&
    !hostname
  ) {
    return false;
  }

  /*
   * For provider-backed geographic discovery
   * (OSM/Overpass), a real business may legitimately
   * have no website. In that case strong identity
   * may come from the provider's place record.
   */
  if (
    !hasStrongIdentity(lead)
  ) {
    return false;
  }

  return true;
}

export async function runDiscovery(
  provider: DiscoveryProvider,
  query: DiscoveryQuery,
): Promise<{
  leads: Lead[];
  leadResults: QualifiedLead[];
  qualifiedLeads: QualifiedLead[];
  nextCursor?: string | null;
}> {
  const requestedLimit =
    clampLimit(
      query.limit,
    );

  const candidateLimit =
    getCandidateLimit(
      requestedLimit,
    );

  const providerQuery:
    DiscoveryQuery = {
    ...query,
    limit: candidateLimit,
  };

  const discoveryResult:
    DiscoveryResult =
    await provider.discover(
      providerQuery,
    );

  const normalizedLeads =
    normalizeCandidates(
      discoveryResult.candidates,
    );

  console.log(
    "[AutoRadar] Normalized candidates:",
    normalizedLeads.length,
  );

  const uniqueLeads =
    dedupeLeads(
      normalizedLeads,
    );

  console.log(
    "[AutoRadar] After discovery deduplication:",
    uniqueLeads.length,
  );

  const quality =
    filterCandidateQuality(
      uniqueLeads,
    );

  console.log(
    "[AutoRadar] Candidate quality",
    {
      total:
        uniqueLeads.length,
      accepted:
        quality.accepted.length,
      review:
        quality.review.length,
      rejected:
        quality.rejected.length,
    },
  );

  const candidatesToProcess = [
    ...quality.accepted,
    ...quality.review,
  ];

  const processedResults =
    await Promise.allSettled(
      candidatesToProcess.map(
        (lead) =>
          processLead(
            lead,
            query,
          ),
      ),
    );

  const processedLeads =
    processedResults
      .filter(
        (
          result,
        ): result is PromiseFulfilledResult<QualifiedLead> =>
          result.status ===
          "fulfilled",
      )
      .map(
        (result) =>
          result.value,
      );

  console.log(
    "[AutoRadar] Processed candidates:",
    processedLeads.length,
  );

  const identityUniqueLeads =
    dedupeProcessedResults(
      processedLeads,
    );

  console.log(
    "[AutoRadar] After post-research identity deduplication:",
    identityUniqueLeads.length,
  );

  console.log(
    "[AutoRadar] Final identity/relevance gate:",
    identityUniqueLeads.map(
      (result) => ({
        company:
          result.lead.companyName,

        website:
          result.lead.website ??
          null,

        source:
          result.lead.source ??
          null,

        relevance:
          getRelevanceScore(
            result,
          ),

        qualification:
          getQualificationScore(
            result,
          ),

        validBusinessIdentity:
          hasValidBusinessIdentity(
            result,
          ),

        strongIdentity:
          hasStrongIdentity(
            result.lead,
          ),
      }),
    ),
  );

  const relevantLeads =
    identityUniqueLeads.filter(
      (result) => {
        if (
          !hasValidBusinessIdentity(
            result,
          )
        ) {
          return false;
        }

        if (
          getRelevanceScore(
            result,
          ) <
          MIN_RELEVANCE_SCORE
        ) {
          return false;
        }

        return true;
      },
    );

  console.log(
    "[AutoRadar] Relevant leads:",
    relevantLeads.length,
    "of",
    identityUniqueLeads.length,
    "using minimum relevance score:",
    MIN_RELEVANCE_SCORE,
  );

  const rankedLeads =
    rankLeads(
      relevantLeads,
    );

  const finalResults =
    rankedLeads.slice(
      0,
      requestedLimit,
    );

  const qualifiedLeads =
    finalResults.filter(
      (result) =>
        result.qualification
          .status ===
        "qualified",
    );

  console.log(
    "[AutoRadar] Final results:",
    {
      requested:
        requestedLimit,
      returned:
        finalResults.length,
      qualified:
        qualifiedLeads.length,
    },
  );

  return {
    leads:
      finalResults.map(
        (result) =>
          result.lead,
      ),

    leadResults:
      finalResults,

    qualifiedLeads,

    nextCursor:
      discoveryResult.nextCursor ??
      null,
  };
}
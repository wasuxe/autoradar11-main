import type { Lead } from "@/lib/leads/types";

/**
 * Contact verification layer.
 *
 * Core rule:
 * UNKNOWN > WRONG
 *
 * This module validates contact data and evidence quality.
 * It does not guess missing information.
 */

export type VerificationLevel =
  | "verified"
  | "partially_verified"
  | "unverified"
  | "rejected";

export type ContactKind =
  | "business_email"
  | "personal_email"
  | "company_phone"
  | "direct_phone"
  | "whatsapp"
  | "linkedin"
  | "instagram"
  | "website_profile"
  | "unknown";

export type ContactVerification = {
  value: string;
  kind: ContactKind;
  level: VerificationLevel;
  score: number;
  reasons: string[];
  sourceUrls: string[];
};

export type PersonEvidence = {
  personName?: string | null;
  role?: string | null;
  companyName?: string | null;
  sourceUrl?: string | null;
  sourceType?: string | null;
  evidenceText?: string | null;
  observedAt?: string | null;
};

export type PersonVerification = {
  identityScore: number;
  companyScore: number;
  roleScore: number;
  freshnessScore: number;
  crossSourceScore: number;
  overallScore: number;
  level: VerificationLevel;
  reasons: string[];
};

export type ContactVerificationSummary = {
  email: ContactVerification | null;
  phone: ContactVerification | null;
  whatsapp: ContactVerification | null;
  linkedin: ContactVerification | null;
  instagram: ContactVerification | null;
  overallScore: number;
  level: VerificationLevel;
  reasons: string[];
};

const FREE_EMAIL_HOSTS = new Set([
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "msn.com",
  "yahoo.com",
  "yahoo.co.in",
  "ymail.com",
  "icloud.com",
  "me.com",
  "proton.me",
  "protonmail.com",
  "mail.com",
  "aol.com",
  "gmx.com",
  "zoho.com",
]);

const DISPOSABLE_EMAIL_HOSTS = new Set([
  "10minutemail.com",
  "10minutemail.net",
  "guerrillamail.com",
  "guerrillamail.net",
  "mailinator.com",
  "tempmail.com",
  "temp-mail.org",
  "throwawaymail.com",
  "yopmail.com",
  "sharklasers.com",
  "getnada.com",
  "emailondeck.com",
]);

const BLOCKED_PROFILE_HOSTS = new Set([
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
  "webindia123.com",
  "medindia.net",
  "bdir.in",
  "indiainfo.net",
  "deldure.com",
  "proceed.fit",
  "top-rated.online",
  "lybrate.com",
  "credihealth.com",
]);

/**
 * Only terms that independently indicate authority.
 *
 * Do NOT use generic department/function words such as:
 * marketing, growth, brand, operations.
 *
 * Those words can appear in normal page copy and must not
 * establish that somebody is a decision maker.
 */
const CURRENT_ROLE_TERMS = [
  "founder",
  "co-founder",
  "cofounder",
  "owner",
  "ceo",
  "chief executive",
  "chief executive officer",
  "managing director",
  "executive director",
  "director",
  "partner",
  "principal",
  "president",
  "vice president",
  "vp",
  "chief",
  "head of",
];

const STALE_ROLE_TERMS = [
  "former",
  "ex-",
  "ex ",
  "previously",
  "past",
  "was the",
  "was a",
  "worked as",
  "previous role",
  "previous position",
  "formerly",
];

function normalizeText(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeHost(value: string | null | undefined): string {
  if (!value) return "";

  try {
    const url = value.includes("://")
      ? new URL(value)
      : new URL(`https://${value}`);

    return url.hostname
      .toLowerCase()
      .replace(/^www\./, "");
  } catch {
    return "";
  }
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function normalizePhone(value: string): string {
  return value.replace(/[^\d+]/g, "");
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);

    return (
      url.protocol === "http:" ||
      url.protocol === "https:"
    );
  } catch {
    return false;
  }
}

function isBlockedHost(value: string): boolean {
  const host = normalizeHost(value);

  if (!host) return true;

  for (const blocked of BLOCKED_PROFILE_HOSTS) {
    if (
      host === blocked ||
      host.endsWith(`.${blocked}`)
    ) {
      return true;
    }
  }

  return false;
}

function getEmailHost(email: string): string {
  const normalized = normalizeEmail(email);
  const at = normalized.lastIndexOf("@");

  if (at === -1) return "";

  return normalized.slice(at + 1);
}

function getEmailLocalPart(email: string): string {
  const normalized = normalizeEmail(email);
  const at = normalized.lastIndexOf("@");

  if (at === -1) return "";

  return normalized.slice(0, at);
}

function isValidEmailSyntax(email: string): boolean {
  const normalized = normalizeEmail(email);

  if (normalized.length > 254) {
    return false;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return false;
  }

  const [local, host] = normalized.split("@");

  if (!local || !host) {
    return false;
  }

  if (local.length > 64) {
    return false;
  }

  if (
    host.startsWith(".") ||
    host.endsWith(".") ||
    host.includes("..")
  ) {
    return false;
  }

  return true;
}

function isDisposableEmail(email: string): boolean {
  const host = getEmailHost(email);

  if (!host) return true;

  return DISPOSABLE_EMAIL_HOSTS.has(host);
}

function isFreeEmail(email: string): boolean {
  const host = getEmailHost(email);

  if (!host) return false;

  return FREE_EMAIL_HOSTS.has(host);
}

function looksLikeRoleMailbox(email: string): boolean {
  const local = getEmailLocalPart(email);

  return [
    "info",
    "contact",
    "hello",
    "support",
    "admin",
    "office",
    "sales",
    "marketing",
    "enquiry",
    "enquiries",
    "help",
    "reception",
    "appointments",
    "appointment",
    "bookings",
    "booking",
    "careers",
    "hr",
    "team",
  ].includes(local);
}

function looksLikePersonalMailbox(email: string): boolean {
  const local = getEmailLocalPart(email);

  if (!local) return false;

  return !looksLikeRoleMailbox(email);
}

function scoreEmailAgainstLead(
  email: string,
  lead: Lead,
): ContactVerification {
  const normalized = normalizeEmail(email);
  const reasons: string[] = [];

  if (!isValidEmailSyntax(normalized)) {
    return {
      value: email,
      kind: "unknown",
      level: "rejected",
      score: 0,
      reasons: ["Invalid email syntax."],
      sourceUrls: [],
    };
  }

  if (isDisposableEmail(normalized)) {
    return {
      value: normalized,
      kind: "unknown",
      level: "rejected",
      score: 0,
      reasons: ["Disposable email provider detected."],
      sourceUrls: [],
    };
  }

  const emailHost = getEmailHost(normalized);
  const websiteHost = normalizeHost(lead.website);

  /*
   * Matching the verified business domain proves that the
   * mailbox belongs to the domain.
   *
   * It does NOT prove that the mailbox currently exists.
   */
  if (
    websiteHost &&
    emailHost === websiteHost
  ) {
    reasons.push(
      "Email domain matches the business website domain.",
    );

    if (looksLikePersonalMailbox(normalized)) {
      reasons.push(
        "Mailbox appears to belong to an individual rather than a generic company inbox.",
      );

      return {
        value: normalized,
        kind: "business_email",
        level: "verified",
        score: 100,
        reasons,
        sourceUrls: lead.website
          ? [lead.website]
          : [],
      };
    }

    reasons.push(
      "Mailbox appears to be a generic business mailbox.",
    );

    return {
      value: normalized,
      kind: "business_email",
      level: "verified",
      score: 90,
      reasons,
      sourceUrls: lead.website
        ? [lead.website]
        : [],
    };
  }

  if (isFreeEmail(normalized)) {
    reasons.push(
      "Free email provider detected.",
    );

    return {
      value: normalized,
      kind: "personal_email",
      level: "partially_verified",
      score: 45,
      reasons,
      sourceUrls: [],
    };
  }

  if (websiteHost) {
    reasons.push(
      "Email domain does not match the currently verified business website domain.",
    );

    return {
      value: normalized,
      kind: "business_email",
      level: "partially_verified",
      score: 55,
      reasons,
      sourceUrls: [],
    };
  }

  reasons.push(
    "Business website domain is unavailable, so company-domain matching cannot be confirmed.",
  );

  return {
    value: normalized,
    kind: "business_email",
    level: "unverified",
    score: 30,
    reasons,
    sourceUrls: [],
  };
}

function normalizePhoneForComparison(
  value: string,
): string {
  const digits = value.replace(/\D/g, "");

  if (digits.startsWith("0091")) {
    return `+91${digits.slice(4)}`;
  }

  if (
    digits.startsWith("91") &&
    digits.length === 12
  ) {
    return `+${digits}`;
  }

  if (digits.length === 10) {
    return `+91${digits}`;
  }

  if (
    digits.startsWith("0") &&
    digits.length === 11
  ) {
    return `+91${digits.slice(1)}`;
  }

  return value.startsWith("+")
    ? `+${digits}`
    : digits;
}

function isValidIndianPhone(
  value: string,
): boolean {
  const digits = value.replace(/\D/g, "");

  if (digits.length === 10) {
    return /^[6-9]\d{9}$/.test(digits);
  }

  if (
    digits.length === 12 &&
    digits.startsWith("91")
  ) {
    return /^[6-9]\d{9}$/.test(
      digits.slice(2),
    );
  }

  if (
    digits.length === 11 &&
    digits.startsWith("0")
  ) {
    return /^[6-9]\d{9}$/.test(
      digits.slice(1),
    );
  }

  return false;
}

function isObviouslyFakePhone(
  value: string,
): boolean {
  const digits = value.replace(/\D/g, "");

  if (!digits) {
    return true;
  }

  if (/^(\d)\1+$/.test(digits)) {
    return true;
  }

  if (
    digits.includes("1234567890") ||
    digits.includes("0123456789") ||
    digits.includes("9876543210")
  ) {
    return true;
  }

  return false;
}

export function verifyPhone(
  phone: string,
  options?: {
    country?: string | null;
    direct?: boolean;
    sourceUrls?: string[];
  },
): ContactVerification {
  const normalized = normalizePhone(phone);
  const sourceUrls =
    options?.sourceUrls ?? [];

  if (
    !normalized ||
    isObviouslyFakePhone(normalized)
  ) {
    return {
      value: phone,
      kind: "unknown",
      level: "rejected",
      score: 0,
      reasons: [
        "Phone number failed basic validity checks.",
      ],
      sourceUrls,
    };
  }

  const country = normalizeText(
    options?.country,
  );

  /*
   * India-specific structural validation.
   *
   * Format validity alone is NOT ownership verification.
   * Therefore a phone number discovered from a website
   * remains partially verified until stronger evidence exists.
   */
  if (
    country === "india" ||
    country === "in"
  ) {
    if (!isValidIndianPhone(normalized)) {
      return {
        value: phone,
        kind: "unknown",
        level: "rejected",
        score: 0,
        reasons: [
          "Number does not match a valid Indian phone format.",
        ],
        sourceUrls,
      };
    }

    const normalizedIndian =
      normalizePhoneForComparison(
        normalized,
      );

    return {
      value: normalizedIndian,
      kind: options?.direct
        ? "direct_phone"
        : "company_phone",
      level: "partially_verified",
      score: options?.direct ? 75 : 70,
      reasons: [
        "Number matches a valid Indian phone format.",
        options?.direct
          ? "Source identifies the number as a direct/person contact."
          : "Number is treated as a business contact based on the supplied source.",
        "Format validation does not prove current ownership or reachability.",
      ],
      sourceUrls,
    };
  }

  const digits = normalized.replace(
    /\D/g,
    "",
  );

  if (
    digits.length < 7 ||
    digits.length > 15
  ) {
    return {
      value: phone,
      kind: "unknown",
      level: "rejected",
      score: 0,
      reasons: [
        "Phone number length is outside the supported range.",
      ],
      sourceUrls,
    };
  }

  return {
    value: normalizePhoneForComparison(
      normalized,
    ),
    kind: options?.direct
      ? "direct_phone"
      : "company_phone",
    level: "partially_verified",
    score: options?.direct ? 75 : 65,
    reasons: [
      "International phone number has a plausible length.",
      "Country-specific validation was not available for this country.",
      "Format validation does not prove current ownership or reachability.",
    ],
    sourceUrls,
  };
}

export function verifyEmail(
  email: string,
  lead: Lead,
): ContactVerification {
  return scoreEmailAgainstLead(
    email,
    lead,
  );
}

function getDistinctiveCompanyTokens(
  companyName: string,
): string[] {
  const stopWords = new Set([
    "the",
    "and",
    "of",
    "for",
    "in",
    "at",
    "on",
    "a",
    "an",
    "clinic",
    "hospital",
    "center",
    "centre",
    "company",
    "co",
    "ltd",
    "limited",
    "llp",
    "inc",
    "private",
    "pvt",
    "services",
    "service",
    "group",
    "studio",
    "agency",
    "skin",
    "care",
    "beauty",
    "health",
    "medical",
  ]);

  return normalizeText(companyName)
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(
      (token) =>
        token.length >= 3 &&
        !stopWords.has(token),
    );
}

function companyNamesMatch(
  leadCompany: string,
  evidenceCompany: string,
): boolean {
  const leadTokens =
    getDistinctiveCompanyTokens(
      leadCompany,
    );

  const evidenceTokens =
    getDistinctiveCompanyTokens(
      evidenceCompany,
    );

  if (
    !leadTokens.length ||
    !evidenceTokens.length
  ) {
    return false;
  }

  /*
   * Require meaningful overlap.
   *
   * For longer names, at least two distinctive
   * tokens must overlap.
   */
  const overlap = leadTokens.filter(
    (token) =>
      evidenceTokens.includes(token),
  ).length;

  if (
    leadTokens.length >= 3 &&
    evidenceTokens.length >= 3
  ) {
    return overlap >= 2;
  }

  return overlap >= 1;
}

function sourceReliability(
  sourceType:
    | string
    | null
    | undefined,
): number {
  const source =
    normalizeText(sourceType);

  if (
    source.includes("company_website") ||
    source.includes("company_about") ||
    source.includes("company_team") ||
    source.includes("company_contact")
  ) {
    return 100;
  }

  if (
    source.includes("professional") ||
    source.includes("linkedin")
  ) {
    return 90;
  }

  if (
    source.includes("association") ||
    source.includes("conference") ||
    source.includes("press") ||
    source.includes("speaker")
  ) {
    return 80;
  }

  if (source.includes("directory")) {
    return 35;
  }

  return 50;
}

function isCurrentRoleEvidence(
  role: string | null | undefined,
  evidenceText:
    | string
    | null
    | undefined,
): boolean {
  const normalizedRole =
    normalizeText(role);

  const normalizedEvidence =
    normalizeText(evidenceText);

  /*
   * A stale indicator anywhere in the role/evidence
   * invalidates the current-role claim.
   */
  if (
    STALE_ROLE_TERMS.some(
      (term) =>
        normalizedRole.includes(term) ||
        normalizedEvidence.includes(term),
    )
  ) {
    return false;
  }

  /*
   * Prefer the explicit role field.
   *
   * Page body text alone should not casually establish
   * a person's decision-making role.
   */
  if (normalizedRole) {
    return CURRENT_ROLE_TERMS.some(
      (term) =>
        normalizedRole === term ||
        normalizedRole.startsWith(`${term} `) ||
        normalizedRole.endsWith(` ${term}`) ||
        normalizedRole.includes(` ${term} `),
    );
  }

  /*
   * If no explicit role exists, require a strong role
   * phrase in the evidence text.
   */
  return CURRENT_ROLE_TERMS.some(
    (term) =>
      normalizedEvidence.includes(
        ` ${term} `,
      ) ||
      normalizedEvidence.startsWith(
        `${term} `,
      ) ||
      normalizedEvidence.endsWith(
        ` ${term}`,
      ),
  );
}

function isRecentDate(
  value: string | null | undefined,
): boolean {
  if (!value) return false;

  const timestamp = Date.parse(value);

  if (Number.isNaN(timestamp)) {
    return false;
  }

  const age = Date.now() - timestamp;

  return (
    age >= 0 &&
    age <=
      1000 *
        60 *
        60 *
        24 *
        730
  );
}

export function verifyPerson(
  lead: Lead,
  evidence: PersonEvidence[],
): PersonVerification {
  const reasons: string[] = [];

  const validEvidence =
    evidence.filter(
      (item) =>
        Boolean(item.personName?.trim()) &&
        Boolean(item.sourceUrl?.trim()),
    );

  if (!validEvidence.length) {
    return {
      identityScore: 0,
      companyScore: 0,
      roleScore: 0,
      freshnessScore: 0,
      crossSourceScore: 0,
      overallScore: 0,
      level: "rejected",
      reasons: [
        "No usable person evidence was provided.",
      ],
    };
  }

  /*
   * One host/domain = one independent source.
   *
   * company.com/about
   * company.com/team
   *
   * must NOT count as two independent sources.
   */
  const sourceGroups =
    new Map<string, PersonEvidence[]>();

  for (const item of validEvidence) {
    const host = normalizeHost(
      item.sourceUrl,
    );

    if (!host) continue;

    const existing =
      sourceGroups.get(host);

    if (existing) {
      existing.push(item);
    } else {
      sourceGroups.set(host, [item]);
    }
  }

  /*
   * Select the strongest evidence from each
   * independent source.
   */
  const independentEvidence =
    Array.from(
      sourceGroups.values(),
    ).map((items) =>
      [...items].sort(
        (a, b) =>
          sourceReliability(
            b.sourceType,
          ) -
          sourceReliability(
            a.sourceType,
          ),
      )[0],
    );

  if (!independentEvidence.length) {
    return {
      identityScore: 0,
      companyScore: 0,
      roleScore: 0,
      freshnessScore: 0,
      crossSourceScore: 0,
      overallScore: 0,
      level: "rejected",
      reasons: [
        "No usable independent person evidence was found.",
      ],
    };
  }

  /*
   * ---------------------------------------------------------
   * IDENTITY
   * ---------------------------------------------------------
   */

  const canonicalName =
    normalizeText(
      independentEvidence[0].personName,
    );

  const identityMatches =
    independentEvidence.filter(
      (item) =>
        normalizeText(
          item.personName,
        ) === canonicalName,
    ).length;

  let identityScore: number;

  if (identityMatches >= 2) {
    identityScore = 100;

    reasons.push(
      "Person identity is corroborated across independent sources.",
    );
  } else if (
    sourceReliability(
      independentEvidence[0]
        .sourceType,
    ) >= 80
  ) {
    identityScore = 80;

    reasons.push(
      "Person identity is supported by one reliable independent source.",
    );
  } else {
    identityScore = 50;

    reasons.push(
      "Person identity currently relies on a single lower-confidence source.",
    );
  }

  /*
   * ---------------------------------------------------------
   * COMPANY
   * ---------------------------------------------------------
   */

  const companyMatches =
  independentEvidence.filter(
    (item) => {
      if (!item.companyName) {
        return false;
      }

      return companyNamesMatch(
        lead.companyName,
        item.companyName,
      );
    },
  ).length;

  let companyScore: number;

  if (companyMatches >= 2) {
    companyScore = 100;

    reasons.push(
      "Person/company relationship is corroborated across independent sources.",
    );
  } else if (companyMatches === 1) {
    companyScore = 85;

    reasons.push(
      "Person has evidence connecting them to the target company.",
    );
  } else {
    companyScore = 0;

    reasons.push(
      "Person could not be reliably matched to the target company.",
    );
  }

  /*
   * ---------------------------------------------------------
   * CURRENT ROLE
   * ---------------------------------------------------------
   */

  const roleMatches =
    independentEvidence.filter(
      (item) =>
        isCurrentRoleEvidence(
          item.role,
          item.evidenceText,
        ),
    ).length;

  let roleScore: number;

  if (roleMatches >= 2) {
    roleScore = 100;

    reasons.push(
      "Current role is corroborated across independent sources.",
    );
  } else if (roleMatches === 1) {
    roleScore = 85;

    reasons.push(
      "Current role is supported by one independent source.",
    );
  } else {
    roleScore = 0;

    reasons.push(
      "Current decision-making role is not sufficiently established.",
    );
  }

  /*
   * ---------------------------------------------------------
   * FRESHNESS
   * ---------------------------------------------------------
   */

  const recentEvidence =
    independentEvidence.filter(
      (item) =>
        isRecentDate(
          item.observedAt,
        ),
    ).length;

  const freshnessScore =
    recentEvidence >= 2
      ? 100
      : recentEvidence === 1
        ? 75
        : 40;

  /*
   * ---------------------------------------------------------
   * CROSS SOURCE
   * ---------------------------------------------------------
   */

  const uniqueSources = unique(
    independentEvidence
      .map(
        (item) =>
          item.sourceUrl ?? "",
      )
      .map((url) =>
        normalizeHost(url),
      )
      .filter(Boolean),
  );

  const crossSourceScore =
    uniqueSources.length >= 3
      ? 100
      : uniqueSources.length === 2
        ? 85
        : 45;

  if (uniqueSources.length >= 2) {
    reasons.push(
      "Evidence agrees across multiple independent sources.",
    );
  } else {
    reasons.push(
      "Evidence currently relies on a single independent source.",
    );
  }

  /*
   * ---------------------------------------------------------
   * OVERALL
   * ---------------------------------------------------------
   */

  const overallScore = Math.round(
    identityScore * 0.25 +
      companyScore * 0.30 +
      roleScore * 0.25 +
      freshnessScore * 0.05 +
      crossSourceScore * 0.15,
  );

  /*
   * ---------------------------------------------------------
   * FINAL LEVEL
   * ---------------------------------------------------------
   *
   * VERIFIED requires:
   *
   * - strong overall score
   * - at least 2 independent sources
   * - identity corroboration
   * - company corroboration
   * - role corroboration
   *
   * This prevents one generated source from becoming
   * a false verified decision maker.
   */

  let level: VerificationLevel;

  if (
    companyScore === 0 ||
    roleScore === 0 ||
    overallScore < 40
  ) {
    level = "rejected";
  } else if (
    overallScore >= 85 &&
    uniqueSources.length >= 2 &&
    identityMatches >= 2 &&
    companyMatches >= 2 &&
    roleMatches >= 2
  ) {
    level = "verified";
  } else if (overallScore >= 60) {
    level = "partially_verified";
  } else {
    level = "unverified";
  }

  return {
    identityScore,
    companyScore,
    roleScore,
    freshnessScore,
    crossSourceScore,
    overallScore,
    level,
    reasons,
  };
}

export function verifyLinkedIn(
  url: string,
): ContactVerification {
  if (
    !isValidUrl(url) ||
    isBlockedHost(url)
  ) {
    return {
      value: url,
      kind: "linkedin",
      level: "rejected",
      score: 0,
      reasons: [
        "URL is invalid or belongs to a blocked source.",
      ],
      sourceUrls: [],
    };
  }

  const host = normalizeHost(url);

  if (
    host !== "linkedin.com" &&
    !host.endsWith(".linkedin.com")
  ) {
    return {
      value: url,
      kind: "linkedin",
      level: "rejected",
      score: 0,
      reasons: [
        "URL is not a LinkedIn profile URL.",
      ],
      sourceUrls: [],
    };
  }

  try {
    const parsed = new URL(url);
    const path =
      parsed.pathname.toLowerCase();

    if (
      !/^\/in\/[^/]+\/?$/.test(path)
    ) {
      return {
        value: url,
        kind: "linkedin",
        level: "rejected",
        score: 0,
        reasons: [
          "LinkedIn URL is not a direct public person profile.",
        ],
        sourceUrls: [],
      };
    }
  } catch {
    return {
      value: url,
      kind: "linkedin",
      level: "rejected",
      score: 0,
      reasons: [
        "Invalid LinkedIn URL.",
      ],
      sourceUrls: [],
    };
  }

  return {
    value: url,
    kind: "linkedin",
    level: "partially_verified",
    score: 75,
    reasons: [
      "URL is a direct LinkedIn person profile.",
      "Profile URL structure is valid; person/company association still requires independent evidence.",
    ],
    sourceUrls: [url],
  };
}

export function verifyInstagram(
  url: string,
): ContactVerification {
  if (
    !isValidUrl(url) ||
    isBlockedHost(url)
  ) {
    return {
      value: url,
      kind: "instagram",
      level: "rejected",
      score: 0,
      reasons: [
        "URL is invalid or belongs to a blocked source.",
      ],
      sourceUrls: [],
    };
  }

  const host = normalizeHost(url);

  if (
    host !== "instagram.com" &&
    !host.endsWith(".instagram.com")
  ) {
    return {
      value: url,
      kind: "instagram",
      level: "rejected",
      score: 0,
      reasons: [
        "URL is not an Instagram profile URL.",
      ],
      sourceUrls: [],
    };
  }

  try {
    const parsed = new URL(url);
    const path =
      parsed.pathname.toLowerCase();

    if (
      !/^\/[a-z0-9._]+\/?$/.test(path) ||
      path.includes("/share")
    ) {
      return {
        value: url,
        kind: "instagram",
        level: "rejected",
        score: 0,
        reasons: [
          "Instagram URL does not appear to be a direct profile.",
        ],
        sourceUrls: [],
      };
    }
  } catch {
    return {
      value: url,
      kind: "instagram",
      level: "rejected",
      score: 0,
      reasons: [
        "Invalid Instagram URL.",
      ],
      sourceUrls: [],
    };
  }

  return {
    value: url,
    kind: "instagram",
    level: "partially_verified",
    score: 65,
    reasons: [
      "URL appears to be a direct Instagram profile.",
      "Person/company association still requires independent evidence.",
    ],
    sourceUrls: [url],
  };
}

export function verifyWebsiteProfile(
  url: string,
  lead: Lead,
): ContactVerification {
  if (
    !isValidUrl(url) ||
    isBlockedHost(url)
  ) {
    return {
      value: url,
      kind: "website_profile",
      level: "rejected",
      score: 0,
      reasons: [
        "Profile URL is invalid or belongs to a blocked source.",
      ],
      sourceUrls: [],
    };
  }

  const websiteHost =
    normalizeHost(lead.website);

  const profileHost =
    normalizeHost(url);

  if (
    !websiteHost ||
    !profileHost
  ) {
    return {
      value: url,
      kind: "website_profile",
      level: "unverified",
      score: 30,
      reasons: [
        "Unable to establish a company-domain relationship.",
      ],
      sourceUrls: [url],
    };
  }

  if (
    profileHost === websiteHost ||
    profileHost.endsWith(
      `.${websiteHost}`,
    )
  ) {
    return {
      value: url,
      kind: "website_profile",
      level: "verified",
      score: 95,
      reasons: [
        "Profile is hosted on the verified business website domain.",
      ],
      sourceUrls: [url],
    };
  }

  return {
    value: url,
    kind: "website_profile",
    level: "partially_verified",
    score: 60,
    reasons: [
      "Profile is valid but is hosted on a different domain.",
      "Independent company/person association is required.",
    ],
    sourceUrls: [url],
  };
}

export function buildContactVerificationSummary(
  lead: Lead,
  input: {
    email?: string | null;
    phone?: string | null;
    whatsapp?: string | null;
    linkedin?: string | null;
    instagram?: string | null;
  },
): ContactVerificationSummary {
  const email = input.email
    ? verifyEmail(
        input.email,
        lead,
      )
    : null;

  const phone = input.phone
    ? verifyPhone(
        input.phone,
        {
          country: lead.country,
          direct: false,
        },
      )
    : null;

  const whatsapp = input.whatsapp
    ? verifyPhone(
        input.whatsapp,
        {
          country: lead.country,
          direct: false,
        },
      )
    : null;

  const linkedin = input.linkedin
    ? verifyLinkedIn(
        input.linkedin,
      )
    : null;

  const instagram = input.instagram
    ? verifyInstagram(
        input.instagram,
      )
    : null;

  const allValues = [
    email,
    phone,
    whatsapp,
    linkedin,
    instagram,
  ].filter(
    (
      value,
    ): value is ContactVerification =>
      value !== null &&
      value.level !== "rejected",
  );

  /*
   * Overall score is informational.
   *
   * It must not upgrade partially verified data
   * into a verified result.
   */
  const score =
    allValues.length === 0
      ? 0
      : Math.round(
          allValues.reduce(
            (total, value) =>
              total + value.score,
            0,
          ) / allValues.length,
        );

  const reasons: string[] = [];

  if (
    email?.level === "verified"
  ) {
    reasons.push(
      "Business email domain matches the verified business website domain.",
    );
  }

  if (
    email?.level ===
    "partially_verified"
  ) {
    reasons.push(
      "Email has some supporting evidence but is not fully verified.",
    );
  }

  if (
    phone?.level ===
    "partially_verified"
  ) {
    reasons.push(
      "Phone number passed format validation but ownership/reachability is not independently confirmed.",
    );
  }

  if (
    linkedin?.level ===
    "partially_verified"
  ) {
    reasons.push(
      "LinkedIn profile URL is structurally valid but person/company association still needs evidence.",
    );
  }

  if (
    instagram?.level ===
    "partially_verified"
  ) {
    reasons.push(
      "Instagram profile URL is structurally valid but person/company association still needs evidence.",
    );
  }

  /*
   * Only actual "verified" values can contribute
   * to a verified summary.
   *
   * Two partially verified values must NOT become
   * verified merely because their average score is high.
   */
  const fullyVerifiedValues =
    allValues.filter(
      (value) =>
        value.level === "verified",
    );

  let level: VerificationLevel;

  if (
    fullyVerifiedValues.length >= 2 &&
    fullyVerifiedValues.some(
      (value) =>
        value.kind ===
          "business_email" ||
        value.kind ===
          "direct_phone" ||
        value.kind ===
          "company_phone",
    )
  ) {
    level = "verified";
  } else if (
    allValues.some(
      (value) =>
        value.level ===
        "partially_verified",
    )
  ) {
    level = "partially_verified";
  } else if (
    fullyVerifiedValues.length > 0
  ) {
    level = "partially_verified";
  } else if (score > 0) {
    level = "unverified";
  } else {
    level = "rejected";
  }

  return {
    email,
    phone,
    whatsapp,
    linkedin,
    instagram,
    overallScore: score,
    level,
    reasons,
  };
}

export function getSourceReliability(
  sourceType:
    | string
    | null
    | undefined,
): number {
  return sourceReliability(
    sourceType,
  );
}

export function isBlockedContactSource(
  url:
    | string
    | null
    | undefined,
): boolean {
  if (!url) return true;

  return isBlockedHost(url);
}

export function isCompanyDomainEmail(
  email: string,
  website:
    | string
    | null
    | undefined,
): boolean {
  const emailHost =
    getEmailHost(email);

  const websiteHost =
    normalizeHost(website);

  if (
    !emailHost ||
    !websiteHost
  ) {
    return false;
  }

  return (
    emailHost === websiteHost ||
    emailHost.endsWith(
      `.${websiteHost}`,
    )
  );
}

export function normalizeVerifiedPhone(
  phone: string,
  country?: string | null,
): string | null {
  const verification =
    verifyPhone(phone, {
      country,
    });

  if (
    verification.level ===
      "rejected" ||
    verification.score === 0
  ) {
    return null;
  }

  return verification.value;
}
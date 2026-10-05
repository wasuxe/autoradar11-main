import * as cheerio from "cheerio";
import type { Lead } from "@/lib/leads/types";
import type {
  BusinessContact,
  EnrichmentResult,
} from "./types";

const SOCIAL_DOMAINS = {
  linkedin: ["linkedin.com"],
  instagram: ["instagram.com"],
  facebook: ["facebook.com"],
};

const MAX_PAGES = 8;
const PAGE_TIMEOUT_MS = 8_000;

const CONTACT_PATH_PATTERNS = [
  "/contact",
  "/contact-us",
  "/contactus",
  "/get-in-touch",
  "/reach-us",
];

const ABOUT_PATH_PATTERNS = [
  "/about",
  "/about-us",
  "/aboutus",
  "/company",
];

const TEAM_PATH_PATTERNS = [
  "/team",
  "/our-team",
  "/meet-the-team",
  "/leadership",
  "/management",
];

const BLOCKED_EMAIL_PREFIXES = [
  "noreply",
  "no-reply",
  "donotreply",
  "do-not-reply",
];

const BLOCKED_EMAIL_DOMAINS = [
  "example.com",
  "example.org",
  "example.net",
];

function normalizeUrl(value: string): string {
  const trimmed = value.trim();

  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://")
  ) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

function isDomainMatch(
  url: string,
  domains: string[],
): boolean {
  try {
    const hostname = new URL(url)
      .hostname
      .toLowerCase()
      .replace(/^www\./, "");

    return domains.some(
      (domain) =>
        hostname === domain ||
        hostname.endsWith(`.${domain}`),
    );
  } catch {
    return false;
  }
}

function getHostname(url: string): string {
  try {
    return new URL(url)
      .hostname
      .toLowerCase()
      .replace(/^www\./, "");
  } catch {
    return "";
  }
}

function isSameDomain(
  url: string,
  website: string,
): boolean {
  const sourceHost = getHostname(website);
  const targetHost = getHostname(url);

  if (!sourceHost || !targetHost) {
    return false;
  }

  return (
    targetHost === sourceHost ||
    targetHost.endsWith(`.${sourceHost}`) ||
    sourceHost.endsWith(`.${targetHost}`)
  );
}

function isSocialShareUrl(url: string): boolean {
  const lower = url.toLowerCase();

  return (
    lower.includes("/share") ||
    lower.includes("/sharer") ||
    lower.includes("/dialog") ||
    lower.includes("/intent/") ||
    lower.includes("/sharing/") ||
    lower.includes("/login") ||
    lower.includes("/accounts/login")
  );
}

function isValidEmail(email: string): boolean {
  const normalized = email
    .trim()
    .toLowerCase();

  if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(normalized)) {
    return false;
  }

  const [localPart, domain] =
    normalized.split("@");

  if (!localPart || !domain) {
    return false;
  }

  if (
    BLOCKED_EMAIL_PREFIXES.some(
      (prefix) =>
        localPart === prefix ||
        localPart.startsWith(`${prefix}.`) ||
        localPart.startsWith(`${prefix}-`),
    )
  ) {
    return false;
  }

  if (
    BLOCKED_EMAIL_DOMAINS.includes(domain)
  ) {
    return false;
  }

  return true;
}

function extractEmails(
  html: string,
): string[] {
  const matches =
    html.match(
      /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
    ) ?? [];

  return unique(
    matches
      .map((email) =>
        email
          .trim()
          .toLowerCase()
          .replace(/[),.;:]+$/, ""),
      )
      .filter(isValidEmail),
  );
}

function normalizePhone(
  value: string,
): string | null {
  const cleaned = value
    .replace(/[^\d+]/g, "");

  if (!cleaned) {
    return null;
  }

  let digits = cleaned.replace(/\D/g, "");

  if (
    digits.length === 10 &&
    /^[6-9]/.test(digits)
  ) {
    return `+91${digits}`;
  }

  if (
    digits.length === 11 &&
    digits.startsWith("0") &&
    /^[6-9]/.test(digits.slice(1))
  ) {
    return `+91${digits.slice(1)}`;
  }

  if (
    digits.length === 12 &&
    digits.startsWith("91") &&
    /^[6-9]/.test(digits.slice(2))
  ) {
    return `+${digits}`;
  }

  if (
    cleaned.startsWith("+") &&
    digits.length >= 8 &&
    digits.length <= 15
  ) {
    return `+${digits}`;
  }

  return null;
}

function looksLikeInvalidPhone(
  value: string,
): boolean {
  const digits = value.replace(/\D/g, "");

  if (
    digits.length < 8 ||
    digits.length > 15
  ) {
    return true;
  }

  if (
    /^(\d)\1+$/.test(digits)
  ) {
    return true;
  }

  if (
    /^\d{4}$/.test(digits) ||
    /^\d{6}$/.test(digits)
  ) {
    return true;
  }

  return false;
}

function extractPhones(
  text: string,
): string[] {
  const matches =
    text.match(
      /(?:\+\d{1,3}[\s().-]*)?(?:\d[\s().-]*){8,14}/g,
    ) ?? [];

  const phones: string[] = [];

  for (const match of matches) {
    if (looksLikeInvalidPhone(match)) {
      continue;
    }

    const normalized =
      normalizePhone(match);

    if (normalized) {
      phones.push(normalized);
    }
  }

  return unique(phones);
}

function extractWhatsApp(
  urls: string[],
): string | null {
  const match = urls.find((url) => {
    const lower = url.toLowerCase();

    return (
      lower.includes("wa.me/") ||
      lower.includes("whatsapp.com/") ||
      lower.includes("api.whatsapp.com/")
    );
  });

  return match ?? null;
}

function isContactPage(
  url: string,
): boolean {
  const lower = url.toLowerCase();

  return CONTACT_PATH_PATTERNS.some(
    (pattern) => lower.includes(pattern),
  );
}

function isAboutPage(
  url: string,
): boolean {
  const lower = url.toLowerCase();

  return ABOUT_PATH_PATTERNS.some(
    (pattern) => lower.includes(pattern),
  );
}

function isTeamPage(
  url: string,
): boolean {
  const lower = url.toLowerCase();

  return TEAM_PATH_PATTERNS.some(
    (pattern) => lower.includes(pattern),
  );
}

function pagePriority(url: string): number {
  if (isContactPage(url)) {
    return 100;
  }

  if (isTeamPage(url)) {
    return 90;
  }

  if (isAboutPage(url)) {
    return 80;
  }

  return 10;
}

function findBestPage(
  urls: string[],
  predicate: (url: string) => boolean,
): string | null {
  return (
    urls
      .filter(predicate)
      .sort(
        (a, b) =>
          pagePriority(b) -
          pagePriority(a),
      )[0] ?? null
  );
}

function findSocial(
  urls: string[],
  domains: string[],
): string | null {
  return (
    urls.find(
      (url) =>
        !isSocialShareUrl(url) &&
        isDomainMatch(url, domains),
    ) ?? null
  );
}

function collectInternalLinks(
  html: string,
  website: string,
): string[] {
  const $ = cheerio.load(html);
  const urls: string[] = [];

  $("a[href]").each((_, element) => {
    const href = $(element).attr("href");

    if (!href) {
      return;
    }

    try {
      const absoluteUrl = new URL(
        href,
        website,
      ).toString();

      if (
        !/^https?:$/i.test(
          new URL(absoluteUrl).protocol,
        )
      ) {
        return;
      }

      if (!isSameDomain(
        absoluteUrl,
        website,
      )) {
        return;
      }

      if (
        isSocialShareUrl(absoluteUrl)
      ) {
        return;
      }

      urls.push(
        absoluteUrl.split("#")[0],
      );
    } catch {
      // Ignore malformed URLs.
    }
  });

  return unique(urls);
}

async function fetchHtml(
  url: string,
): Promise<{
  html: string;
  finalUrl: string;
} | null> {
  const controller =
    new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    PAGE_TIMEOUT_MS,
  );

  try {
    const response = await fetch(
      url,
      {
        method: "GET",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; SoleTrustAutoRadar/1.0)",
          Accept:
            "text/html,application/xhtml+xml",
        },
        redirect: "follow",
        cache: "no-store",
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      return null;
    }

    const contentType =
      response.headers.get(
        "content-type",
      ) ?? "";

    if (
      !contentType
        .toLowerCase()
        .includes("text/html")
    ) {
      return null;
    }

    const html =
      await response.text();

    if (!html.trim()) {
      return null;
    }

    return {
      html,
      finalUrl: response.url || url,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function extractWebsiteContacts(
  lead: Lead,
): Promise<EnrichmentResult> {
  const emptyContact: BusinessContact = {
    email: null,
    phone: null,
    whatsapp: null,
    contactPage: null,
    linkedinUrl: null,
    instagramUrl: null,
    facebookUrl: null,
    source: null,
    confidence: null,
  };

  if (!lead.website) {
    return {
      companyName: lead.companyName,
      website: null,
      contact: emptyContact,
      signals: ["no_website"],
      enrichedAt: new Date().toISOString(),
    };
  }

  const website =
    normalizeUrl(lead.website);

  const homepage =
    await fetchHtml(website);

  if (!homepage) {
    return {
      companyName: lead.companyName,
      website,
      contact: emptyContact,
      signals: ["website_unreachable"],
      enrichedAt: new Date().toISOString(),
    };
  }

  const pageQueue = [
    homepage.finalUrl,
    ...collectInternalLinks(
      homepage.html,
      homepage.finalUrl,
    ),
  ];

  const pagesToVisit =
    unique(pageQueue)
      .sort(
        (a, b) =>
          pagePriority(b) -
          pagePriority(a),
      )
      .slice(0, MAX_PAGES);

  const visited = new Set<string>();

  const allEmails: string[] = [];
  const allPhones: string[] = [];
  const allUrls: string[] = [];

  let contactPage: string | null = null;

  for (const pageUrl of pagesToVisit) {
    if (visited.has(pageUrl)) {
      continue;
    }

    visited.add(pageUrl);

    const page =
      pageUrl === homepage.finalUrl
        ? homepage
        : await fetchHtml(pageUrl);

    if (!page) {
      continue;
    }

    const $ =
      cheerio.load(page.html);

    const pageLinks =
      collectInternalLinks(
        page.html,
        homepage.finalUrl,
      );

    allUrls.push(
      ...pageLinks,
    );

    $("a[href]").each(
      (_, element) => {
        const href =
          $(element).attr("href");

        if (!href) {
          return;
        }

        if (
          href
            .toLowerCase()
            .startsWith("mailto:")
        ) {
          const email =
            href
              .slice(7)
              .split("?")[0]
              .trim()
              .toLowerCase();

          if (isValidEmail(email)) {
            allEmails.push(email);
          }
        }

        try {
          const absolute =
            new URL(
              href,
              page.finalUrl,
            ).toString();

          allUrls.push(absolute);
        } catch {
          // Ignore malformed URLs.
        }
      },
    );

    const pageText =
      $("body")
        .text()
        .replace(/\s+/g, " ")
        .trim();

    allEmails.push(
      ...extractEmails(page.html),
    );

    allPhones.push(
      ...extractPhones(pageText),
    );

    if (
      !contactPage &&
      isContactPage(page.finalUrl)
    ) {
      contactPage =
        page.finalUrl;
    }
  }

  const uniqueEmails =
    unique(allEmails)
      .filter(isValidEmail);

  const uniquePhones =
    unique(allPhones);

  const uniqueUrls =
    unique(allUrls);

  const whatsapp =
    extractWhatsApp(uniqueUrls);

  const linkedinUrl =
    findSocial(
      uniqueUrls,
      SOCIAL_DOMAINS.linkedin,
    );

  const instagramUrl =
    findSocial(
      uniqueUrls,
      SOCIAL_DOMAINS.instagram,
    );

  const facebookUrl =
    findSocial(
      uniqueUrls,
      SOCIAL_DOMAINS.facebook,
    );

  const bestContactPage =
    contactPage ??
    findBestPage(
      uniqueUrls,
      isContactPage,
    );

  const signals: string[] = [];

  if (uniqueEmails.length > 0) {
    signals.push(
      "business_email_found",
    );
  }

  if (uniquePhones.length > 0) {
    signals.push(
      "business_phone_found",
    );
  }

  if (whatsapp) {
    signals.push("whatsapp_found");
  }

  if (bestContactPage) {
    signals.push(
      "contact_page_found",
    );
  }

  if (linkedinUrl) {
    signals.push("linkedin_found");
  }

  if (instagramUrl) {
    signals.push("instagram_found");
  }

  if (facebookUrl) {
    signals.push("facebook_found");
  }

  if (signals.length === 0) {
    signals.push(
      "no_contact_data_found",
    );
  }

  const hasContactData =
    uniqueEmails.length > 0 ||
    uniquePhones.length > 0 ||
    Boolean(whatsapp) ||
    Boolean(bestContactPage) ||
    Boolean(linkedinUrl) ||
    Boolean(instagramUrl) ||
    Boolean(facebookUrl);

  const contact: BusinessContact = {
    email:
      uniqueEmails[0] ?? null,

    phone:
      uniquePhones[0] ?? null,

    whatsapp,

    contactPage:
      bestContactPage,

    linkedinUrl,

    instagramUrl,

    facebookUrl,

    source:
      hasContactData
        ? "website"
        : null,

    confidence:
      uniqueEmails.length > 0 ||
      uniquePhones.length > 0
        ? "high"
        : hasContactData
          ? "medium"
          : null,
  };

  return {
    companyName:
      lead.companyName,

    website,

    contact,

    signals,

    enrichedAt:
      new Date().toISOString(),
  };
}
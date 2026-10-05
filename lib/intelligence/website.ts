import * as cheerio from "cheerio";

import type {
  WebsiteIntelligence,
  WebsiteLink,
} from "./types";

const SOCIAL_DOMAINS = [
  "instagram.com",
  "facebook.com",
  "linkedin.com",
  "youtube.com",
  "x.com",
  "twitter.com",
  "tiktok.com",
];

const CTA_WORDS = [
  "contact",
  "contact us",
  "book",
  "book now",
  "schedule",
  "get started",
  "request",
  "request a quote",
  "call us",
  "enquire",
  "inquire",
  "shop now",
  "buy now",
  "learn more",
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

function isSocialUrl(value: string): boolean {
  try {
    const hostname = new URL(value)
      .hostname
      .toLowerCase();

    return SOCIAL_DOMAINS.some(
      (domain) =>
        hostname === domain ||
        hostname.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
}

function isContactUrl(value: string): boolean {
  const lower = value.toLowerCase();

  return (
    lower.includes("/contact") ||
    lower.includes("/contact-us") ||
    lower.includes("/get-in-touch") ||
    lower.includes("/contactus")
  );
}

function containsCallToAction(value: string): boolean {
  const lower = value.toLowerCase();

  return CTA_WORDS.some((word) =>
    lower.includes(word)
  );
}

function uniqueLinks(
  links: WebsiteLink[]
): WebsiteLink[] {
  const map = new Map<string, WebsiteLink>();

  for (const link of links) {
    if (!map.has(link.url)) {
      map.set(link.url, link);
    }
  }

  return Array.from(map.values());
}

export async function analyzeWebsite(
  website: string
): Promise<WebsiteIntelligence> {
  const url = normalizeUrl(website);

  const result: WebsiteIntelligence = {
    url,
    reachable: false,
    statusCode: null,
    title: null,
    description: null,
    headings: [],
    links: [],
    socialLinks: [],
    hasHttps: url.startsWith("https://"),
    hasContactPage: false,
    hasCallToAction: false,
    signals: [],
    fetchedAt: new Date().toISOString(),
  };

  let response: Response;

  try {
    response = await fetch(url, {
      method: "GET",

      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; SoleTrustAutoRadar/1.0)",

        Accept:
          "text/html,application/xhtml+xml",
      },

      redirect: "follow",

      cache: "no-store",
    });
  } catch {
    return {
      ...result,
      signals: [
        "website_unreachable",
      ],
    };
  }

  result.statusCode = response.status;

  if (!response.ok) {
    return {
      ...result,
      signals: [
        "website_http_error",
      ],
    };
  }

  result.reachable = true;

  const contentType =
    response.headers.get("content-type") ?? "";

  if (!contentType.toLowerCase().includes("text/html")) {
    return {
      ...result,
      signals: [
        "website_not_html",
      ],
    };
  }

  let html: string;

  try {
    html = await response.text();
  } catch {
    return {
      ...result,
      signals: [
        "website_body_unreadable",
      ],
    };
  }

  const $ = cheerio.load(html);

  /*
   * TITLE
   */

  const title =
    $("title")
      .first()
      .text()
      .replace(/\s+/g, " ")
      .trim();

  /*
   * META DESCRIPTION
   */

  const description =
    $('meta[name="description"]')
      .attr("content")
      ?.replace(/\s+/g, " ")
      .trim() ?? "";

  /*
   * HEADINGS
   */

  const headings = $("h1, h2, h3")
    .map((_, element) =>
      $(element)
        .text()
        .replace(/\s+/g, " ")
        .trim()
    )
    .get()
    .filter(Boolean)
    .slice(0, 30);

  /*
   * LINKS
   */

  const links: WebsiteLink[] = [];

  $("a[href]").each((_, element) => {
    const href =
      $(element).attr("href");

    if (!href) {
      return;
    }

    try {
      const absoluteUrl =
        new URL(href, url).toString();

      const label =
        $(element)
          .text()
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 120);

      links.push({
        label,
        url: absoluteUrl,
      });
    } catch {
      // Ignore invalid URLs.
    }
  });

  const cleanedLinks =
    uniqueLinks(links);

  /*
   * SOCIAL LINKS
   */

  const socialLinks =
    cleanedLinks
      .map((link) => link.url)
      .filter(isSocialUrl);

  /*
   * CONTACT PAGE
   */

  const hasContactPage =
    cleanedLinks.some((link) =>
      isContactUrl(link.url)
    );

  /*
   * PAGE TEXT
   */

  const bodyText =
    $("body")
      .text()
      .replace(/\s+/g, " ")
      .trim();

  /*
   * CTA
   */

  const hasCallToAction =
    containsCallToAction(bodyText) ||
    cleanedLinks.some((link) =>
      containsCallToAction(link.label)
    );

  /*
   * SALES / WEBSITE SIGNALS
   */

  const signals: string[] = [];

  if (!result.hasHttps) {
    signals.push("no_https");
  }

  if (!title) {
    signals.push("missing_title");
  }

  if (!description) {
    signals.push("missing_meta_description");
  }

  if (headings.length === 0) {
    signals.push("no_headings");
  }

  if (!hasContactPage) {
    signals.push("no_obvious_contact_page");
  }

  if (!hasCallToAction) {
    signals.push("no_obvious_call_to_action");
  }

  if (socialLinks.length === 0) {
    signals.push("no_detected_social_links");
  }

  if (cleanedLinks.length < 5) {
    signals.push("low_link_count");
  }

  /*
   * FINAL RESULT
   */

  return {
    ...result,

    title: title || null,

    description:
      description || null,

    headings,

    links:
      cleanedLinks.slice(0, 100),

    socialLinks:
      Array.from(
        new Set(socialLinks)
      ),

    hasContactPage,

    hasCallToAction,

    signals,
  };
}
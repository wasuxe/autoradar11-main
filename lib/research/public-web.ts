import dotenv from "dotenv";



dotenv.config({

  path: ".env.local",

});



import type { Lead } from "@/lib/leads/types";



import {

  resolveBusinessIdentity,

} from "@/lib/identity";



import type {

  BusinessEmail,

  BusinessPhone,

  DecisionMaker,

  SocialContact,

} from "@/lib/contacts/types";



import type { SourceEvidence } from "@/lib/sources/types";



import type {

  BusinessResearchInput,

  BusinessResearchResult,

  ResearchCandidate,

} from "./types";



import {

  searchSearXNG,

} from "./providers/searxng";






const REQUEST_TIMEOUT_MS = 12_000;



const MAX_CANDIDATES_TO_VERIFY = 12;



const MIN_RESEARCH_SCORE = 20;




const REQUIRE_LOCATION_ON_WEBSITE = false;






const BLOCKED_HOSTS = new Set([


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

  "indiamart.com",

  "www.indiamart.com",

  "tradeindia.com",

  "www.tradeindia.com",

  "zaubacorp.com",

  "www.zaubacorp.com",

  "webindia123.com",

  "www.webindia123.com",

  "medindia.net",

  "www.medindia.net",

  "dentee.com",

  "www.dentee.com",

  "bewtee.com",

  "www.bewtee.com",

  "hexahealth.com",

  "www.hexahealth.com",




  "medium.com",

  "www.medium.com",

  "wordpress.com",

  "www.wordpress.com",

  "blogspot.com",

  "www.blogspot.com",

  /* Generic hosted/demo platforms */
  "vercel.app",
  "netlify.app",
  "github.io",
  "pages.dev",
  "web.app",
  "firebaseapp.com",
  "wixsite.com",
  "weebly.com",

  /* Additional business-listing / aggregator platforms */
  "top-rated.online",
  "www.top-rated.online",
  "lybrate.com",
  "www.lybrate.com",
  "credihealth.com",
  "www.credihealth.com",
  "askapollo.com",
  "www.askapollo.com",

  "ibphub.com",
  "www.ibphub.com",
  "enquiryfinder.com",
  "www.enquiryfinder.com",
  "findlocal.com",
  "www.findlocal.com",
  "find-local.com",
  "www.find-local.com",
  "bdir.in",
  "www.bdir.in",
  "indiainfo.net",
  "www.indiainfo.net",
  "deldure.com",
  "www.deldure.com",
  "cashlesshospitalindia.com",
  "www.cashlesshospitalindia.com",
  "genericdrugscan.com",
  "www.genericdrugscan.com",
  "eyehospitalnearme.in",
  "www.eyehospitalnearme.in",
  "near-me.in",
  "www.near-me.in",
  "findnearby.in",
  "www.findnearby.in",
  "asklaila.com",
  "www.asklaila.com",

  "proceed.fit",
"www.proceed.fit",

"365doctor.in",
"www.365doctor.in",

"zmedhealth.com",
"www.zmedhealth.com",

"apabuka.com",
"www.apabuka.com",

"top-rated.online",
"www.top-rated.online",

"justdial.com",
"www.justdial.com",

"practo.com",
"www.practo.com",

"sulekha.com",
"www.sulekha.com",

"credihealth.com",
"www.credihealth.com",

"lybrate.com",
"www.lybrate.com",

"hexahealth.com",
"www.hexahealth.com",

  /* Additional directories / aggregators observed in research results */
  "whatclinic.com",
  "www.whatclinic.com",

  "trabajo.org",
  "www.trabajo.org",

  "infobel.com",
  "www.infobel.com",

  "helloindia.co",
  "www.helloindia.co",

  "promallu.com",
  "www.promallu.com",

  "worldplaces.me",
  "www.worldplaces.me",

  "threebestrated.in",
  "www.threebestrated.in",

  "docindia.org",
  "www.docindia.org",

  "doctar.in",
  "www.doctar.in",

  "myupchar.com",
  "www.myupchar.com",

  "datagemba.com",
  "www.datagemba.com",

]);






const GENERIC_BUSINESS_TOKENS = new Set([

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

  "skin",

  "beauty",

  "aesthetic",

  "aesthetics",

  "medical",

  "medicine",

  "health",

  "healthcare",

  "wellness",

  "dental",

  "dermatology",

  "dermatologist",

  "cosmetic",

  "cosmetics",

  "hospital",

  "care",

  "center",

  "centre",

  "doctor",

  "specialist",

  "specialists",

  "studio",

  "agency",

  "company",

  "services",

  "service",

  "group",

  "private",

  "limited",

  "ltd",

  "llp",

  "pvt",

]);






const CITY_ALIASES: Record<string, string[]> = {

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



  kolkata: [

    "kolkata",

    "calcutta",

  ],



  calcutta: [

    "kolkata",

    "calcutta",

  ],



  chennai: [

    "chennai",

    "madras",

  ],



  madras: [

    "chennai",

    "madras",

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



function tokenize(

  value: string,

): string[] {

  return normalize(value)

    .split(" ")

    .filter(Boolean);

}



function getBusinessTokens(

  value: string,

): string[] {

  return tokenize(value).filter(

    (token) =>

      token.length >= 3 &&

      !GENERIC_BUSINESS_TOKENS.has(token),

  );

}






function getHostname(

  url: string,

): string {

  try {

    return new URL(url)

      .hostname

      .toLowerCase()

      .replace(/^www\\./, "");

  } catch {

    return "";

  }

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



    return url

      .toString()

      .replace(/\/$/, "");

  } catch {

    return null;

  }

}



function isBlockedHost(

  url: string,

): boolean {

  const hostname =

    getHostname(url);



  if (!hostname) {

    return true;

  }



  if (

    BLOCKED_HOSTS.has(hostname)

  ) {

    return true;

  }



  for (const blockedHost of BLOCKED_HOSTS) {

    if (

      hostname.endsWith(

        `.${blockedHost}`,

      )

    ) {

      return true;

    }

  }



  return false;

}



function isLikelyContentUrl(

  url: string,

): boolean {

  try {

    const pathname =

      new URL(url)

        .pathname

        .toLowerCase();



    const blockedPaths = [

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



    return blockedPaths.some(

      (path) =>

        pathname === path ||

        pathname.startsWith(path),

    );

  } catch {

    return true;

  }

}






const DIRECTORY_HOST_PATTERNS = [
  "directory",
  "directories",
  "listing",
  "listings",
  "localbusiness",
  "local-business",
  "findlocal",
  "find-local",
  "enquiryfinder",
  "ibphub",
];

const NON_BUSINESS_TITLE_PATTERNS = [
  "directory",
  "find local businesses",
  "find businesses",
  "business listings",
  "business listing",
  "best skin clinic",
  "best skin clinics",
  "top skin clinic",
  "top skin clinics",
  "list of skin clinics",
  "list of dermatologists",
  "conference",
  "conferences",
  "congress",
  "summit",
  "expo",
  "exhibition",
  "convention",
  "conference highlights",
  "event highlights",
  "event registration",
  "register now",
  "agenda",
  "schedule",
  "speakers",
  "tickets",
  "ticket booking",
];

const NON_BUSINESS_BODY_PATTERNS = [
  "register for the conference",
  "conference registration",
  "event registration",
  "conference highlights",
  "conference schedule",
  "conference speakers",
  "summit agenda",
  "expo registration",
  "buy tickets",
  "book tickets",
  "find local businesses",
  "business directory",
  "business listings",
  "doctor directory",
  "clinic directory",
  "hospital directory",
];

function isDirectoryOrAggregatorHost(url: string): boolean {
  const hostname = getHostname(url);
  if (!hostname) return true;
  if (isBlockedHost(url)) return true;

  const compact = hostname.replace(/[^a-z0-9]/g, "");
  return DIRECTORY_HOST_PATTERNS.some((pattern) =>
    compact.includes(pattern.replace(/[^a-z0-9]/g, "")),
  );
}

function isNonBusinessEntityText(title: string, body = ""): boolean {
  const normalizedTitle = normalize(title);
  const normalizedBody = normalize(body.slice(0, 12_000));

  if (
    NON_BUSINESS_TITLE_PATTERNS.some((pattern) =>
      normalizedTitle === normalize(pattern) ||
      normalizedTitle.includes(normalize(pattern)),
    )
  ) {
    return true;
  }

  const matchedBodySignals = NON_BUSINESS_BODY_PATTERNS.filter((pattern) =>
    normalizedBody.includes(normalize(pattern)),
  ).length;

  return matchedBodySignals >= 2;
}

function isLikelyEventOrConference(
  url: string,
  title: string,
  body = "",
): boolean {
  const normalizedUrl = normalize(url);
  const normalizedTitle = normalize(title);
  const normalizedBody = normalize(body.slice(0, 12_000));

  const eventWords = [
    "conference",
    "congress",
    "summit",
    "expo",
    "exhibition",
    "convention",
    "event",
  ];

  const titleEvent = eventWords.some((word) =>
    normalizedTitle.includes(word),
  );

  const urlEvent = eventWords.some((word) =>
    normalizedUrl.includes(word),
  );

  const bodyEventSignals = [
    "registration",
    "register now",
    "speakers",
    "agenda",
    "conference highlights",
    "event schedule",
    "ticket",
    "venue",
  ].filter((signal) => normalizedBody.includes(signal)).length;

  return titleEvent || urlEvent || bodyEventSignals >= 3;
}

function isObviousNonBusinessContent(
  url: string,
  title: string,
  body: string,
): boolean {
  const normalizedTitle = normalize(title);
  const normalizedBody = normalize(body.slice(0, 12_000));
  const normalizedUrl = normalize(url);

  if (isDirectoryOrAggregatorHost(url)) return true;
  if (isNonBusinessEntityText(title, body)) return true;
  if (isLikelyEventOrConference(url, title, body)) return true;

  const titlePatterns = [
    "anatomy structure",
    "structure and function",
    "diagram",
    "significance",
    "definition",
    "wikipedia",
    "research paper",
    "journal article",
    "medical article",
    "article about",
    "how to",
    "step by step guide",
    "complete guide",
    "overview of",
    "introduction to",
    "symptoms causes",
    "causes symptoms",
    "treatment options",
  ];

  if (
    titlePatterns.some((pattern) =>
      normalizedTitle.includes(pattern),
    )
  ) {
    return true;
  }

  const contentSignals = [
    "anatomy",
    "diagram",
    "structure and function",
    "definition",
    "significance",
    "research paper",
    "journal article",
    "wikipedia",
    "medical article",
    "how to",
    "complete guide",
  ];

  const matchedContentSignals = contentSignals.filter((signal) =>
    normalizedBody.includes(signal),
  ).length;

  if (matchedContentSignals >= 3) {
    return true;
  }

  const path = (() => {
    try {
      return new URL(url).pathname.toLowerCase();
    } catch {
      return "";
    }
  })();

  const contentPathPatterns = [
    "/wiki/",
    "/article/",
    "/articles/",
    "/research/",
    "/journal/",
    "/encyclopedia/",
    "/anatomy/",
  ];

  if (
    contentPathPatterns.some(
      (pattern) =>
        path === pattern ||
        path.startsWith(pattern),
    )
  ) {
    return true;
  }

  if (
    normalizedUrl.includes("anatomy.co.uk") ||
    normalizedUrl.includes("wikipedia.org")
  ) {
    return true;
  }

  return false;
}

function isGenericHostedDomain(url: string): boolean {
  const hostname = getHostname(url);

  if (!hostname) {
    return true;
  }

  const genericHosts = [
    "vercel.app",
    "netlify.app",
    "github.io",
    "pages.dev",
    "web.app",
    "firebaseapp.com",
    "wixsite.com",
    "weebly.com",
  ];

  return genericHosts.some(
    (host) =>
      hostname === host ||
      hostname.endsWith(`.${host}`),
  );
}

function businessNameMatchScore(

  businessName: string,

  candidateText: string,

): number {

  const business =

    normalize(businessName);



  const candidate =

    normalize(candidateText);



  if (

    !business ||

    !candidate

  ) {

    return 0;

  }



  if (business === candidate) {

    return 60;

  }



  if (

    candidate.includes(business)

  ) {

    return 55;

  }



  const businessTokens =

    getBusinessTokens(

      businessName,

    );



  if (

    businessTokens.length === 0

  ) {

    return 0;

  }



  const matched =

    businessTokens.filter(

      (token) =>

        candidate.includes(token),

    );



  const ratio =

    matched.length /

    businessTokens.length;



  if (ratio >= 1) {

    return 45;

  }



  if (ratio >= 0.75) {

    return 38;

  }



  if (ratio >= 0.5) {

    return 28;

  }



  if (ratio > 0) {

    return 12;

  }



  return 0;

}






function domainIdentityScore(

  businessName: string,

  url: string,

): number {

  const hostname =

    getHostname(url);



  if (!hostname) {

    return 0;

  }



  const domainPart =

    hostname

      .split(".")[0]

      .replace(/[-\_]/g, " ");



  const businessTokens =

    getBusinessTokens(

      businessName,

    );



  if (

    businessTokens.length === 0

  ) {

    return 0;

  }



  const matched =

    businessTokens.filter(

      (token) =>

        domainPart.includes(token),

    );



  if (

    matched.length ===

    businessTokens.length

  ) {

    return 30;

  }



  if (

    matched.length >=

    Math.ceil(

      businessTokens.length / 2,

    )

  ) {

    return 22;

  }



  if (matched.length > 0) {

    return 12;

  }



  return 0;

}






function getCityAliases(

  city: string,

): string[] {

  const normalized =

    normalize(city);



  return (

    CITY_ALIASES[normalized] ?? [

      normalized,

    ]

  );

}



function containsCity(

  text: string,

  city: string,

): boolean {

  const normalizedText =

    normalize(text);



  return getCityAliases(city).some(

    (alias) =>

      alias.length > 0 &&

      normalizedText.includes(alias),

  );

}



function locationMatchScore(

  city: string | null,

  country: string | null,

  text: string,

): number {

  const normalizedText =

    normalize(text);



  let score = 0;



  if (city) {

    if (

      containsCity(

        normalizedText,

        city,

      )

    ) {

      score += 25;

    }

  }



  if (country) {

    const normalizedCountry =

      normalize(country);



    if (

      normalizedCountry &&

      normalizedText.includes(

        normalizedCountry,

      )

    ) {

      score += 5;

    }

  }



  return Math.min(score, 30);

}




function locationMismatchPenalty(

  city: string | null,

  title: string,

  body: string,

): number {

  if (!city) {

    return 0;

  }



  const requestedAliases =

    getCityAliases(city);



  const focusedText =

    normalize(

      `${title} ${body.slice(

        0,

        5000,

      )}`,

    );




  if (

    requestedAliases.some(

      (alias) =>

        alias &&

        focusedText.includes(alias),

    )

  ) {

    return 0;

  }




  for (const knownCity of KNOWN_CITIES) {

    if (

      requestedAliases.includes(

        knownCity,

      )

    ) {

      continue;

    }



    if (

      focusedText.includes(

        knownCity,

      )

    ) {

      return 50;

    }

  }



  return 0;

}






function industryMatchScore(

  industry: string | null,

  text: string,

): number {

  if (!industry) {

    return 0;

  }



  const normalizedIndustry =

    normalize(industry);



  const normalizedText =

    normalize(text);



  if (

    !normalizedIndustry ||

    !normalizedText

  ) {

    return 0;

  }



  if (

    normalizedText.includes(

      normalizedIndustry,

    )

  ) {

    return 15;

  }



  const tokens =

    getBusinessTokens(industry);



  if (tokens.length === 0) {

    return 0;

  }



  const matched =

    tokens.filter(

      (token) =>

        normalizedText.includes(token),

    );



  if (

    matched.length ===

    tokens.length

  ) {

    return 15;

  }



  if (matched.length > 0) {

    return 8;

  }



  return 0;

}






function scoreCandidate(

  input: BusinessResearchInput,

  candidate: {

    url: string;

    title: string | null;

    description: string | null;

  },

): number {

  const combinedText = [

    candidate.title,

    candidate.description,

    candidate.url,

  ]

    .filter(Boolean)

    .join(" ");



  const nameScore =

    businessNameMatchScore(

      input.businessName,

      combinedText,

    );



  const domainScore =

    domainIdentityScore(

      input.businessName,

      candidate.url,

    );



  const locationScore =

    locationMatchScore(

      input.city,

      input.country,

      combinedText,

    );



  const industryScore =

    industryMatchScore(

      input.industry,

      combinedText,

    );



  const contentPenalty =

    isLikelyContentUrl(

      candidate.url,

    )

      ? 35

      : 0;



  return Math.max(

    0,

    nameScore +

      domainScore +

      locationScore +

      industryScore -

      contentPenalty,

  );

}






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

      normalizeUrl(candidate.url);



    if (!normalized) {

      continue;

    }



    if (

      isBlockedHost(normalized)

    ) {

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






async function fetchWithTimeout(

  url: string,

  init?: RequestInit,

): Promise<Response> {

  const controller =

    new AbortController();



  const timeout =

    setTimeout(

      () =>

        controller.abort(),

      REQUEST_TIMEOUT_MS,

    );



  try {

    return await fetch(

      url,

      {

        ...init,

        signal:

          controller.signal,

        redirect: "follow",

        headers: {

          "User-Agent":

            "SoleTrust-AutoRadar/1.0 (+public-business-research)",

          Accept:

            "text/html,application/xhtml+xml",

          ...(init?.headers ?? {}),

        },

        cache: "no-store",

      },

    );

  } finally {

    clearTimeout(timeout);

  }

}






type WebsiteVerification = {

  verified: boolean;



  confidence:

    | "high"

    | "medium"

    | "low";



  reason: string;



  evidenceText:

    | string

    | null;



  locationText:

    | string

    | null;



  finalUrl: string;

};



async function verifyWebsite(

  input: BusinessResearchInput,

  candidate: ResearchCandidate,

): Promise<WebsiteVerification> {

  const normalizedUrl =

    normalizeUrl(candidate.url);



  if (!normalizedUrl) {

    return {

      verified: false,

      confidence: "low",

      reason:

        "Invalid candidate URL.",

      evidenceText: null,

      locationText: null,

      finalUrl: candidate.url,

    };

  }



  if (

    isBlockedHost(normalizedUrl)

  ) {

    return {

      verified: false,

      confidence: "low",

      reason:

        "Candidate is hosted on a blocked search, social, map, directory, or prospecting platform.",

      evidenceText: null,

      locationText: null,

      finalUrl: normalizedUrl,

    };

  }



  try {

    const response =

      await fetchWithTimeout(

        normalizedUrl,

        {

          method: "GET",

        },

      );



    const finalUrl =

      normalizeUrl(response.url) ??

      normalizedUrl;



    if (

      isBlockedHost(finalUrl)

    ) {

      return {

        verified: false,

        confidence: "low",

        reason:

          "Candidate redirected to a blocked platform.",

        evidenceText: null,

        locationText: null,

        finalUrl,

      };

    }



    if (!response.ok) {

      return {

        verified: false,

        confidence: "low",

        reason:

          `Website returned HTTP ${response.status}.`,

        evidenceText: null,

        locationText: null,

        finalUrl,

      };

    }



    const contentType =

      response.headers.get(

        "content-type",

      ) ?? "";



    const isHtml =

      contentType.includes(

        "text/html",

      ) ||

      contentType.includes(

        "application/xhtml+xml",

      );



    if (!isHtml) {

      return {

        verified: false,

        confidence: "low",

        reason:

          `Website did not return HTML. Content-Type: ${contentType || "unknown"}.`,

        evidenceText: null,

        locationText: null,

        finalUrl,

      };

    }



    const html =

      await response.text();



    if (!html.trim()) {

      return {

        verified: false,

        confidence: "low",

        reason:

          "Website returned an empty HTML document.",

        evidenceText: null,

        locationText: null,

        finalUrl,

      };

    }




    const titleMatch =

      html.match(

        /<title[^>]\*>([\s\S]*?)<\/title>/i,

      );



    const title =

      titleMatch?.[1]

        ?.replace(

          /<[^>]+>/g,

          " ",

        )

        .replace(

          /\s+/g,

          " ",

        )

        .trim() ?? "";




    const body =

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

        .replace(

          /<[^>]+>/g,

          " ",

        )

        .replace(

          / /gi,

          " ",

        )

        .replace(

          /&/gi,

          "&",

        )

        .replace(

          /\s+/g,

          " ",

        )

        .trim()

        .slice(0, 50_000);



    const combinedText =

      `${title} ${body}`;

    if (isDirectoryOrAggregatorHost(finalUrl)) {
      return {
        verified: false,
        confidence: "low",
        reason: "Candidate is a directory, listing, aggregator, or prospecting source and cannot be used as the official business website.",
        evidenceText: null,
        locationText: null,
        finalUrl,
      };
    }

    if (isNonBusinessEntityText(title, body)) {
      return {
        verified: false,
        confidence: "low",
        reason: "Candidate represents a directory, list, generic search result, or non-business entity rather than the target business.",
        evidenceText: null,
        locationText: null,
        finalUrl,
      };
    }

    if (isLikelyEventOrConference(finalUrl, title, body)) {
      return {
        verified: false,
        confidence: "low",
        reason: "Candidate appears to represent a conference, event, summit, expo, or other event entity rather than a business.",
        evidenceText: null,
        locationText: null,
        finalUrl,
      };
    }

    if (
      isGenericHostedDomain(finalUrl)
    ) {
      return {
        verified: false,
        confidence: "low",
        reason:
          "Candidate uses a generic hosted/demo domain and is not accepted as an official business website.",
        evidenceText: null,
        locationText: null,
        finalUrl,
      };
    }

    if (
      isObviousNonBusinessContent(
        finalUrl,
        title,
        body,
      )
    ) {
      return {
        verified: false,
        confidence: "low",
        reason:
          "Candidate appears to be an informational/content page rather than the official business website.",
        evidenceText: null,
        locationText: null,
        finalUrl,
      };
    }

    const titleNameScore =

      businessNameMatchScore(

        input.businessName,

        title,

      );



    const bodyNameScore =

      businessNameMatchScore(

        input.businessName,

        body,

      );



    const nameScore =

      Math.max(

        titleNameScore,

        bodyNameScore,

      );



    const domainScore =

      domainIdentityScore(

        input.businessName,

        finalUrl,

      );




    const locationScore =

      locationMatchScore(

        input.city,

        input.country,

        combinedText,

      );



    const locationPenalty =

      locationMismatchPenalty(

        input.city,

        title,

        body,

      );

    const industryScore =

      industryMatchScore(

        input.industry,

        combinedText,

      );

    const exactBusinessNameInTitle =

      normalize(title).includes(

        normalize(input.businessName),

      );

    const businessTokens =

      getBusinessTokens(

        input.businessName,

      );

    const hasDistinctiveDomainEvidence =

      domainScore >= 22;

    const hasStrongPageIdentity =

      nameScore >= 45 &&

      (

        exactBusinessNameInTitle ||

        titleNameScore >= 45

      ) &&

      industryScore >= 8;

    const hasStrongLocationIdentity =

      nameScore >= 45 &&

      locationScore >= 25 &&

      industryScore >= 8;

    const hasSingleTokenIdentity =

      businessTokens.length <= 1 &&

      nameScore >= 40;




    if (

      locationPenalty >= 50 &&

      locationScore === 0

    ) {

      return {

        verified: false,

        confidence: "low",

        reason:

          `Website appears associated with another city and does not contain evidence for ${input.city ?? "the requested city"}.`,

        evidenceText: null,

        locationText: null,

        finalUrl,

      };

    }




    const strongNameIdentity =

      hasStrongPageIdentity ||

      hasStrongLocationIdentity;



    const strongDomainIdentity =

      hasDistinctiveDomainEvidence &&

      nameScore >= 40;



    if (

      hasSingleTokenIdentity &&

      !strongDomainIdentity &&

      !hasStrongPageIdentity &&

      !hasStrongLocationIdentity

    ) {
      return {
        verified: false,
        confidence: "low",
        reason:
          "Business name has insufficient independent identity evidence for this domain.",
        evidenceText: null,
        locationText: null,
        finalUrl,
      };
    }



    if (

      !strongNameIdentity &&

      !strongDomainIdentity

    ) {

      return {

        verified: false,

        confidence: "low",

        reason:

          `Insufficient business identity evidence. Name score=${nameScore}, domain score=${domainScore}.`,

        evidenceText: null,

        locationText: null,

        finalUrl,

      };

    }




    if (

      REQUIRE_LOCATION_ON_WEBSITE &&

      input.city &&

      locationScore === 0

    ) {

      return {

        verified: false,

        confidence: "low",

        reason:

          `Business identity matched, but ${input.city} was not found on the website.`,

        evidenceText: null,

        locationText: null,

        finalUrl,

      };

    }




    let confidence:

      | "high"

      | "medium"

      | "low";



    if (

      hasStrongLocationIdentity ||

      (

        hasDistinctiveDomainEvidence &&

        nameScore >= 45 &&

        industryScore >= 8

      )

    ) {

      confidence = "high";

    } else if (

      hasStrongPageIdentity ||

      (

        domainScore >= 12 &&

        nameScore >= 40 &&

        industryScore >= 8

      )

    ) {

      confidence = "medium";

    } else {

      confidence = "low";

    }



    const evidenceParts: string[] =

      [];



    evidenceParts.push(

      `name=${nameScore}`,

    );



    evidenceParts.push(

      `domain=${domainScore}`,

    );



    evidenceParts.push(

      `location=${locationScore}`,

    );

    evidenceParts.push(

      `industry=${industryScore}`,

    );



    if (

      locationScore === 0 &&

      input.city

    ) {

      evidenceParts.push(

        `homepage does not explicitly mention ${input.city}`,

      );

    }



    return {

      verified: true,

      confidence,

      reason:

        "Website passed identity and accessibility verification.",

      evidenceText:

        `Verified using ${evidenceParts.join(

          ", ",

        )}.`,

      locationText:

        locationScore > 0

          ? combinedText

          : null,

      finalUrl,

    };

  } catch (error) {

    return {

      verified: false,

      confidence: "low",

      reason:

        error instanceof Error

          ? `Website request failed: ${error.message}`

          : "Website request failed.",

      evidenceText: null,

      locationText: null,

      finalUrl: normalizedUrl,

    };

  }

}






function getSourceType(

  url: string,

): ResearchCandidate["sourceType"] {

  const hostname =

    getHostname(url);



  if (

    hostname.endsWith(".gov.in") ||

    hostname.endsWith(".gov")

  ) {

    return "public_registry";

  }



  if (

    hostname.includes("instagram") ||

    hostname.includes("facebook") ||

    hostname.includes("linkedin") ||

    hostname.includes("youtube") ||

    hostname === "x.com"

  ) {

    return "public_social";

  }



  return "public_web";

}






function buildEvidence(

  input: BusinessResearchInput,

  candidate: ResearchCandidate,

  verification: WebsiteVerification,

): SourceEvidence {

  return {

    field: "officialWebsite",

    value: verification.finalUrl,

    sourceType: "company_website",

    sourceUrl: verification.finalUrl,

    confidence: verification.confidence,

    verification:

      verification.confidence ===

      "high"

        ? "verified"

        : "partially_verified",

    evidenceText:

      verification.evidenceText ??

      `The public-web candidate was evaluated against ${input.businessName}.`,

    discoveredAt:

      new Date().toISOString(),

  };

}


function selectOfficialWebsite(
  input: BusinessResearchInput,
  verifiedCandidates: ResearchCandidate[],
  verificationMap: Map<
    string,
    WebsiteVerification
  >,
  identityCandidates: ReturnType<
    typeof resolveBusinessIdentity
  >["candidates"],
): string | null {
  if (verifiedCandidates.length === 0) {
    return null;
  }

  const identityByUrl = new Map(
    identityCandidates.map(
      (candidate) => [
        candidate.url,
        candidate,
      ],
    ),
  );

  /*
   * A candidate may appear in verifiedCandidates because it passed
   * an earlier verification attempt, while verificationMap may later
   * contain a failed verification for the same URL.
   *
   * Never select such a URL.
   *
   * Also re-check the blocked-host rule at the final selection
   * boundary. This keeps directory/social/aggregator URLs from
   * becoming an "official website" even if an upstream verifier
   * accidentally lets them through.
   */
  const eligibleCandidates =
    verifiedCandidates.filter(
      (candidate) => {
        const verification =
          verificationMap.get(
            candidate.url,
          );

        if (
          !verification?.verified
        ) {
          return false;
        }

        if (
          isBlockedHost(
            candidate.url,
          )
        ) {
          return false;
        }

        if (
          isBlockedHost(
            verification.finalUrl,
          )
        ) {
          return false;
        }

        return true;
      },
    );

  if (
    eligibleCandidates.length === 0
  ) {
    return null;
  }

  const ranked =
    [...eligibleCandidates].sort(
      (a, b) => {
        const aVerification =
          verificationMap.get(
            a.url,
          );

        const bVerification =
          verificationMap.get(
            b.url,
          );

        const aConfidenceScore =
          aVerification?.confidence ===
          "high"
            ? 30
            : aVerification?.confidence ===
                "medium"
              ? 20
              : 10;

        const bConfidenceScore =
          bVerification?.confidence ===
          "high"
            ? 30
            : bVerification?.confidence ===
                "medium"
              ? 20
              : 10;

        const aIdentity =
          identityByUrl.get(a.url);

        const bIdentity =
          identityByUrl.get(b.url);

        const aIdentityScore =
          aIdentity?.totalScore ?? 0;

        const bIdentityScore =
          bIdentity?.totalScore ?? 0;

        const aNameScore =
          businessNameMatchScore(
            input.businessName,
            [
              a.title,
              a.description,
            ]
              .filter(Boolean)
              .join(" "),
          );

        const bNameScore =
          businessNameMatchScore(
            input.businessName,
            [
              b.title,
              b.description,
            ]
              .filter(Boolean)
              .join(" "),
          );

        const aDomainScore =
          domainIdentityScore(
            input.businessName,
            a.url,
          );

        const bDomainScore =
          domainIdentityScore(
            input.businessName,
            b.url,
          );

        const aLocationScore =
          locationMatchScore(
            input.city,
            input.country,
            [
              a.title,
              a.description,
            ]
              .filter(Boolean)
              .join(" "),
          );

        const bLocationScore =
          locationMatchScore(
            input.city,
            input.country,
            [
              b.title,
              b.description,
            ]
              .filter(Boolean)
              .join(" "),
          );

        const aFinalScore =
          aConfidenceScore +
          aIdentityScore +
          aNameScore +
          aDomainScore +
          aLocationScore;

        const bFinalScore =
          bConfidenceScore +
          bIdentityScore +
          bNameScore +
          bDomainScore +
          bLocationScore;

        return (
          bFinalScore -
          aFinalScore
        );
      },
    );

  return (
    ranked[0]?.url ??
    null
  );
}






export async function researchBusinessOnPublicWeb(

  input: BusinessResearchInput,

): Promise<BusinessResearchResult> {

  const warnings: string[] =

    [];



  let candidates:

    ResearchCandidate[] = [];




  try {

    const searchResult =

      await searchSearXNG(

        input,

        {

          limit: 20,

          timeoutMs:

            REQUEST_TIMEOUT_MS,

        },

      );



    candidates =

      searchResult.candidates;



    warnings.push(

      ...searchResult.warnings,

    );



    console.log(

      `[AutoRadar][RESEARCH] SearXNG found ${candidates.length} candidates for "${input.businessName}"`,

    );

  } catch (error) {

    const message =

      error instanceof Error

        ? error.message

        : "unknown error";



    warnings.push(

      `SearXNG public-web search failed: ${message}`,

    );



    console.warn(

      `[AutoRadar][RESEARCH] SearXNG failed for "${input.businessName}": ${message}`,

    );

  }




  candidates =

    dedupeCandidates(

      candidates.filter((candidate) => {
        if (isBlockedHost(candidate.url)) {
          console.log(`[AutoRadar][RESEARCH][REJECT] blocked source: ${candidate.url}`);
          return false;
        }

        if (isDirectoryOrAggregatorHost(candidate.url)) {
          console.log(`[AutoRadar][RESEARCH][REJECT] directory/aggregator source: ${candidate.url}`);
          return false;
        }

        if (isLikelyContentUrl(candidate.url)) {
          console.log(`[AutoRadar][RESEARCH][REJECT] content/listing URL: ${candidate.url}`);
          return false;
        }

        if (isNonBusinessEntityText(candidate.title ?? "", candidate.description ?? "")) {
          console.log(`[AutoRadar][RESEARCH][REJECT] non-business entity: ${candidate.title ?? candidate.url}`);
          return false;
        }

        if (isLikelyEventOrConference(candidate.url, candidate.title ?? "", candidate.description ?? "")) {
          console.log(`[AutoRadar][RESEARCH][REJECT] event/conference: ${candidate.title ?? candidate.url}`);
          return false;
        }

        return true;
      }),

    );



  console.log(

    `[AutoRadar][RESEARCH] ${candidates.length} usable candidates remain`,

  );




  const rankedCandidates =

    candidates

      .map((candidate) => ({

        candidate,



        score:

          scoreCandidate(

            input,

            {

              url: candidate.url,

              title:

                candidate.title,

              description:

                candidate.description,

            },

          ),

      }))

      .sort(

        (a, b) =>

          b.score - a.score,

      );



  console.log(

    `[AutoRadar][RESEARCH] Ranked candidates:`,

    rankedCandidates.map(

      (item) => ({

        url:

          item.candidate.url,

        title:

          item.candidate.title,

        score:

          item.score,

      }),

    ),

  );



  const candidatesToVerify =

    rankedCandidates

      .filter(

        ({ score }) =>

          score >=

          MIN_RESEARCH_SCORE,

      )

      .slice(

        0,

        MAX_CANDIDATES_TO_VERIFY,

      )

      .map(

        ({ candidate }) =>

          candidate,

      );



  console.log(

    `[AutoRadar][RESEARCH] Verifying ${candidatesToVerify.length} candidates`,

  );




  const identityCandidates =

    candidatesToVerify.map(

      (candidate) => ({

        url: candidate.url,



        title:

          candidate.title,



        description:

          candidate.description,



        locationText:

          [

            candidate.title,

            candidate.description,

          ]

            .filter(Boolean)

            .join(" "),

      }),

    );



  const identityResult =

    resolveBusinessIdentity(

      input.lead,

      identityCandidates,

    );



  console.log(

    `[AutoRadar][IDENTITY] ${input.businessName}`,

    {

      confidence:

        identityResult.confidence,



      officialWebsite:

        identityResult.officialWebsite,



      candidates:

        identityResult.candidates.map(

          (candidate) => ({

            url:

              candidate.url,

            score:

              candidate.totalScore,

            name:

              candidate.nameScore,

            domain:

              candidate.domainScore,

            location:

              candidate.locationScore,

            confidence:

              candidate.confidence,

          }),

        ),

    },

  );




  const verifiedCandidates:

    ResearchCandidate[] = [];



  const verificationMap =

    new Map<

      string,

      WebsiteVerification

    >();



  const evidence:

    SourceEvidence[] = [];



  for (

    const candidate of candidatesToVerify

  ) {

    const verification =

      await verifyWebsite(

        input,

        candidate,

      );




    verificationMap.set(

      candidate.url,

      verification,

    );



    verificationMap.set(

      verification.finalUrl,

      verification,

    );



    console.log(

      `[AutoRadar][VERIFY] ${candidate.url}`,

      {

        verified:

          verification.verified,



        confidence:

          verification.confidence,



        reason:

          verification.reason,



        finalUrl:

          verification.finalUrl,

      },

    );



    if (

      !verification.verified

    ) {

      continue;

    }



    const updatedCandidate:

      ResearchCandidate = {

      ...candidate,



      url:

        verification.finalUrl,



      sourceType:

        getSourceType(

          verification.finalUrl,

        ),



      confidence:

        verification.confidence,



      evidenceText:

        verification.evidenceText,

    };



    verifiedCandidates.push(

      updatedCandidate,

    );



    evidence.push(

      buildEvidence(

        input,

        updatedCandidate,

        verification,

      ),

    );

  }




  const officialWebsite =

    selectOfficialWebsite(

      input,

      verifiedCandidates,

      verificationMap,

      identityResult.candidates,

    );



  if (officialWebsite) {

    console.log(

      `[AutoRadar][SUCCESS] Official website selected for "${input.businessName}": ${officialWebsite}`,

    );

  } else {

    console.warn(

      `[AutoRadar][FAIL] No verified official website selected for "${input.businessName}"`,

    );



    warnings.push(

      "No sufficiently substantiated official business website was discovered from the public web.",

    );

  }




  const phones:

    BusinessPhone[] = [];



  const emails:

    BusinessEmail[] = [];



  const socialProfiles:

    SocialContact[] = [];



  const decisionMakerCandidates:

    DecisionMaker[] = [];



  return {

    leadId: null,



    website:

      officialWebsite,



    phones,



    emails,



    socialProfiles,



    decisionMakerCandidates,



    candidates:

      verifiedCandidates,



    evidence,



    warnings: [

      ...warnings,

      ...identityResult.warnings,

    ],



    researchedAt:

      new Date().toISOString(),

  };

}






export function buildBusinessResearchInput(

  lead: Lead,

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



    address: null,

  };

}
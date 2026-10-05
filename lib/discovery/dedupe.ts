type LeadLike = {
  name?: string | null;
  companyName?: string | null;
  address?: string | null;
  phone?: string | null;
  website?: string | null;
  email?: string | null;
  linkedin?: string | null;
  instagram?: string | null;
  source?: string | null;
  provider?: string | null;
  evidence?: string[] | null;
  [key: string]: unknown;
};

const DIRECTORY_DOMAINS = new Set([
  "webmd.com",
  "yelp.com",
  "yellowpages.com",
  "justdial.com",
  "sulekha.com",
  "practo.com",
  "healthgrades.com",
  "zocdoc.com",
  "facebook.com",
  "instagram.com",
  "linkedin.com",
  "mapquest.com",
  "foursquare.com",
  "tripadvisor.com",
  "indiamart.com",
  "tradeindia.com",
]);

function normalize(value?: string | null): string {
  return (value ?? "")
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
}

function getDomain(website?: string | null): string {
  return normalize(website);
}

function isDirectoryWebsite(website?: string | null): boolean {
  const domain = getDomain(website);

  if (!domain) {
    return false;
  }

  for (const blocked of DIRECTORY_DOMAINS) {
    if (domain === blocked || domain.endsWith(`.${blocked}`)) {
      return true;
    }
  }

  return false;
}

function cleanText(value?: string | null): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getLeadName(lead: LeadLike): string {
  return lead.name?.trim() || lead.companyName?.trim() || "";
}

function getIdentityKey(lead: LeadLike): string {
  const website = getDomain(lead.website);

  // Official website is the strongest identity signal.
  if (website && !isDirectoryWebsite(lead.website)) {
    return `website:${website}`;
  }

  const name = cleanText(getLeadName(lead));
  const address = cleanText(lead.address);

  if (!name && !address) {
    return "";
  }

  return `name:${name}|address:${address}`;
}

function completenessScore(lead: LeadLike): number {
  const fields = [
    getLeadName(lead),
    lead.address,
    lead.phone,
    lead.website,
    lead.email,
    lead.linkedin,
    lead.instagram,
    lead.source,
    lead.provider,
  ];

  return fields.reduce((score, value) => {
    return score + (typeof value === "string" && value.trim() ? 1 : 0);
  }, 0);
}

export function filterDirectoryCandidates<T extends LeadLike>(
  candidates: T[],
): T[] {
  return candidates.filter((candidate) => {
    if (!getLeadName(candidate)) {
      return false;
    }

    if (isDirectoryWebsite(candidate.website)) {
      return false;
    }

    return true;
  });
}

export function dedupeCandidates<T extends LeadLike>(
  candidates: T[],
): T[] {
  const seen = new Map<string, T>();

  for (const candidate of candidates) {
    const key = getIdentityKey(candidate);

    if (!key) {
      continue;
    }

    const existing = seen.get(key);

    if (!existing) {
      seen.set(key, candidate);
      continue;
    }

    const existingScore = completenessScore(existing);
    const candidateScore = completenessScore(candidate);

    if (candidateScore > existingScore) {
      seen.set(key, {
        ...existing,
        ...candidate,
      });
    } else {
      seen.set(key, {
        ...candidate,
        ...existing,
      });
    }
  }

  return Array.from(seen.values());
}

/**
 * Backwards-compatible API used by pipeline.ts.
 *
 * Generic return type guarantees:
 * Lead[] in -> Lead[] out
 */
export function dedupeLeads<T extends LeadLike>(
  leads: T[],
): T[] {
  const filtered = filterDirectoryCandidates(leads);

  return dedupeCandidates(filtered);
}

export function processCandidates<T extends LeadLike>(
  candidates: T[],
): T[] {
  return dedupeLeads(candidates);
}
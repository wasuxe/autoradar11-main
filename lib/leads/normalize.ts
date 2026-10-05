import { leadSchema } from "./schema";
import type { Lead, LeadInput } from "./types";

function trimToNull(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  return s === "" ? null : s;
}

function normalizeSource(value: unknown): string {
  const s = String(value ?? "")
    .trim()
    .toLowerCase();
  return s.replace(/\s+/g, "-");
}

/**
 * Light website cleanup. Incomplete hostnames are kept.
 * Does not require a scheme; does not reject non-URLs.
 */
export function normalizeWebsite(value: unknown): string | null {
  const raw = trimToNull(value);
  if (!raw) return null;

  let s = raw.replace(/\/+$/, "");

  try {
    const hasScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(s);
    const url = new URL(hasScheme ? s : `https://${s}`);
    url.hostname = url.hostname.replace(/^www\./i, "");
    const path = url.pathname === "/" ? "" : url.pathname.replace(/\/+$/, "");
    const search = url.search;
    const host = url.host;
    if (hasScheme) {
      return `${url.protocol}//${host}${path}${search}`;
    }
    return `${host}${path}${search}`;
  } catch {
    s = s.replace(/^www\./i, "").replace(/\/+$/, "");
    return s || null;
  }
}

function normalizeFoundedYear(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const n = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isInteger(n)) return null;
  return n;
}

export function normalizeLead(input: LeadInput): Lead {
  const candidate = {
    companyName: trimToNull(input.companyName) ?? "",
    website: normalizeWebsite(input.website),
    industry: trimToNull(input.industry),
    country: trimToNull(input.country),
    city: trimToNull(input.city),
    employeeRange: trimToNull(input.employeeRange),
    serviceTrack: trimToNull(input.serviceTrack),
    source: normalizeSource(input.source),
    sourceUrl: trimToNull(input.sourceUrl),
    description: trimToNull(input.description),
    linkedinUrl: trimToNull(input.linkedinUrl),
    instagramUrl: trimToNull(input.instagramUrl),
    facebookUrl: trimToNull(input.facebookUrl),
    foundedYear: normalizeFoundedYear(input.foundedYear),
  };

  const parsed = leadSchema.parse(candidate);

  return {
    companyName: parsed.companyName,
    website: parsed.website ?? null,
    industry: parsed.industry ?? null,
    country: parsed.country ?? null,
    city: parsed.city ?? null,
    employeeRange: parsed.employeeRange ?? null,
    serviceTrack: parsed.serviceTrack ?? null,
    source: parsed.source,
    sourceUrl: parsed.sourceUrl ?? null,
    description: parsed.description ?? null,
    linkedinUrl: parsed.linkedinUrl ?? null,
    instagramUrl: parsed.instagramUrl ?? null,
    facebookUrl: parsed.facebookUrl ?? null,
    foundedYear: parsed.foundedYear ?? null,
  };
}

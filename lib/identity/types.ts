import type { Lead } from "@/lib/leads/types";

export type IdentityMatchConfidence =
  | "high"
  | "medium"
  | "low"
  | "rejected";

export type IdentityEvidenceType =
  | "business_name"
  | "name_variant"
  | "domain"
  | "location"
  | "industry"
  | "address"
  | "phone"
  | "website_content"
  | "public_profile"
  | "other";

export interface BusinessIdentityVariant {
  value: string;
  source: "lead_name" | "derived" | "public_source";
  confidence: number;
  reason: string;
}

export interface IdentityEvidence {
  type: IdentityEvidenceType;
  value: string;
  sourceUrl: string | null;
  confidence: number;
  explanation: string;
}

export interface IdentityCandidate {
  url: string;
  domain: string;
  title: string | null;
  description: string | null;

  matchedVariant: string | null;

  nameScore: number;
  domainScore: number;
  locationScore: number;
  industryScore: number;

  totalScore: number;

  confidence: IdentityMatchConfidence;

  evidence: IdentityEvidence[];
}

export interface BusinessIdentityResult {
  lead: Lead;

  variants: BusinessIdentityVariant[];

  candidates: IdentityCandidate[];

  officialWebsite: string | null;

  confidence: IdentityMatchConfidence;

  evidence: IdentityEvidence[];

  warnings: string[];

  resolvedAt: string;
}
export type SourceType =
  | "company_website"
  | "company_about"
  | "company_team"
  | "company_contact"
  | "public_search"
  | "public_directory"
  | "public_registry"
  | "public_social"
  | "openstreetmap"
  | "overpass"
  | "licensed_provider"
  | "manual";

export type EvidenceConfidence =
  | "high"
  | "medium"
  | "low";

export type EvidenceVerification =
  | "verified"
  | "partially_verified"
  | "unverified";

export interface SourceEvidence {
  field: string;
  value: string;
  sourceType: SourceType;
  sourceUrl: string | null;
  confidence: EvidenceConfidence;
  verification: EvidenceVerification;
  evidenceText: string | null;
  discoveredAt: string;
}

export interface SourceRecord {
  sourceType: SourceType;
  sourceUrl: string | null;
  title: string | null;
  retrievedAt: string;
  evidence: SourceEvidence[];
}
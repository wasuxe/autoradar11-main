export type RelevanceStatus =
  | "verified"
  | "likely"
  | "review"
  | "rejected";

export type RelevanceEvidenceSource =
  | "business-name"
  | "category"
  | "description"
  | "website"
  | "website-title"
  | "website-description"
  | "website-heading"
  | "social"
  | "provider";

export type RelevanceEvidence = {
  source: RelevanceEvidenceSource;
  field: string;
  value: string;
  matchedTerms: string[];
  weight: number;
};

export type RelevanceResult = {
  score: number;
  status: RelevanceStatus;
  reasons: string[];
  matchedTerms: string[];
  negativeSignals: string[];
  evidence: RelevanceEvidence[];
};
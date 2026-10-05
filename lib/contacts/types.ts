export type ContactVerificationStatus =
  | "verified"
  | "partially_verified"
  | "unverified"
  | "not_found";

export type ContactConfidence =
  | "high"
  | "medium"
  | "low";

export type ContactSourceType =
  | "company_website"
  | "company_about"
  | "company_team"
  | "company_contact"
  | "public_professional_profile"
  | "public_social_profile"
  | "public_business_directory"
  | "licensed_enrichment"
  | "unknown";

export type DecisionMakerRole =
  | "founder"
  | "co_founder"
  | "owner"
  | "ceo"
  | "coo"
  | "cmo"
  | "marketing_head"
  | "marketing_manager"
  | "brand_head"
  | "growth_head"
  | "operations_head"
  | "other"
  | "unknown";

export interface ContactEvidence {
  field:
    | "name"
    | "role"
    | "email"
    | "phone"
    | "whatsapp"
    | "linkedin"
    | "instagram";

  value: string;

  sourceType: ContactSourceType;

  sourceUrl: string | null;

  confidence: ContactConfidence;

  verified: boolean;

  evidenceText?: string | null;
}

export interface DecisionMaker {
  name: string | null;

  role: DecisionMakerRole;

  roleLabel: string | null;

  profileUrl: string | null;

  sourceUrl: string | null;

  sourceType: ContactSourceType;

  confidence: ContactConfidence;

  verificationStatus: ContactVerificationStatus;

  evidence: ContactEvidence[];

  reason: string | null;
}

export interface BusinessPhone {
  raw: string;

  normalized: string | null;

  display: string | null;

  countryCode: string | null;

  country: string | null;

  type:
    | "business"
    | "mobile"
    | "landline"
    | "whatsapp"
    | "unknown";

  sourceUrl: string | null;

  sourceType: ContactSourceType;

  confidence: ContactConfidence;

  verificationStatus: ContactVerificationStatus;
}

export interface BusinessEmail {
  value: string;

  normalized: string;

  type:
    | "business"
    | "generic"
    | "personal"
    | "unknown";

  sourceUrl: string | null;

  sourceType: ContactSourceType;

  confidence: ContactConfidence;

  verificationStatus: ContactVerificationStatus;
}

export interface SocialContact {
  platform:
    | "linkedin"
    | "instagram"
    | "facebook"
    | "x"
    | "youtube"
    | "unknown";

  url: string;

  sourceUrl: string | null;

  confidence: ContactConfidence;

  verificationStatus: ContactVerificationStatus;
}

export interface ContactIntelligence {
  decisionMaker: DecisionMaker | null;

  phones: BusinessPhone[];

  emails: BusinessEmail[];

  socialProfiles: SocialContact[];

  contactabilityScore: number;

  dataConfidenceScore: number;

  verificationStatus:
    | "verified"
    | "partially_verified"
    | "unverified"
    | "not_found";

  evidence: ContactEvidence[];

  researchedAt: string;

  warnings: string[];
}
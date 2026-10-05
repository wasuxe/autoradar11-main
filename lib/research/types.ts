import type { Lead } from "@/lib/leads/types";
import type {
  BusinessEmail,
  BusinessPhone,
  DecisionMaker,
  SocialContact,
} from "@/lib/contacts/types";
import type { SourceEvidence } from "@/lib/sources/types";

export type ResearchSourceType =
  | "public_web"
  | "public_directory"
  | "public_registry"
  | "public_social"
  | "company_website";

export interface ResearchCandidate {
  url: string;
  title: string | null;
  description: string | null;
  sourceType: ResearchSourceType;
  confidence: "high" | "medium" | "low";
  evidenceText: string | null;
}

export interface BusinessResearchResult {
  leadId: string | null;

  website: string | null;

  phones: BusinessPhone[];
  emails: BusinessEmail[];
  socialProfiles: SocialContact[];

  decisionMakerCandidates: DecisionMaker[];

  candidates: ResearchCandidate[];

  evidence: SourceEvidence[];

  warnings: string[];

  researchedAt: string;
}

export interface BusinessResearchInput {
  lead: Lead;

  /**
   * Optional additional search context.
   * These values should come from the discovered lead,
   * never from guessed information.
   */
  businessName: string;
  city: string | null;
  country: string | null;
  industry: string | null;
  address: string | null;
}
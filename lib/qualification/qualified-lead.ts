import type { Lead } from "@/lib/leads/types";
import type { WebsiteIntelligence } from "@/lib/intelligence/types";
import type { EnrichmentResult } from "@/lib/enrichment/types";
import type { QualificationResult } from "./types";
import type { RelevanceResult } from "@/lib/relevance/types";
import type { ContactIntelligence } from "@/lib/contacts/types";
import type { SourceEvidence } from "@/lib/sources/types";

export interface QualifiedLead {
  lead: Lead;

  websiteIntelligence: WebsiteIntelligence | null;

  qualification: QualificationResult;

  enrichment: EnrichmentResult | null;

  relevance: RelevanceResult | null;

  /**
   * Evidence-backed contact intelligence.
   *
   * This contains:
   * - decision maker
   * - verified/partially verified phones
   * - emails
   * - public social profiles
   * - confidence
   * - verification status
   */
  contactIntelligence: ContactIntelligence | null;

  /**
   * Evidence supporting important lead fields.
   */
  evidence: SourceEvidence[];
}
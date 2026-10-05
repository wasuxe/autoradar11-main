import type { Lead } from "../leads/types";
import type { WebsiteIntelligence } from "../intelligence/types";

export interface QualificationSignal {
  id: string;
  label: string;
  points: number;
  type: "positive" | "negative" | "neutral";
  evidence?: string;
}

export interface QualificationResult {
  score: number;
  status: "qualified" | "review" | "low";
  signals: QualificationSignal[];
}

export interface QualificationInput {
  lead: Lead;
  website?: WebsiteIntelligence | null;
}
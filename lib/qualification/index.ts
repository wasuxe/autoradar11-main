import type { Lead } from "@/lib/leads/types";
import type { WebsiteIntelligence } from "@/lib/intelligence/types";
import { evaluateQualification } from "@/lib/qualification/rules";
import type {
  QualificationResult,
  QualificationSignal,
} from "@/lib/qualification/types";

const QUALIFIED_THRESHOLD = 60;
const REVIEW_THRESHOLD = 35;

function clampScore(score: number): number {
  return Math.min(100, Math.max(0, score));
}

function getStatus(
  score: number
): QualificationResult["status"] {
  if (score >= QUALIFIED_THRESHOLD) return "qualified";
  if (score >= REVIEW_THRESHOLD) return "review";
  return "low";
}

export function qualifyLead(
  lead: Lead,
  website?: WebsiteIntelligence | null
): QualificationResult {
  const signals: QualificationSignal[] =
    evaluateQualification({ lead, website });

  const score = clampScore(
    signals.reduce((total, signal) => total + signal.points, 0)
  );

  return {
    score,
    status: getStatus(score),
    signals,
  };
}
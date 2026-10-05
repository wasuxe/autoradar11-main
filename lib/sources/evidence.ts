import type {
    EvidenceConfidence,
    EvidenceVerification,
    SourceEvidence,
    SourceType,
  } from "./types";
  
  export function createEvidence(
    field: string,
    value: string,
    options: {
      sourceType: SourceType;
      sourceUrl?: string | null;
      confidence?: EvidenceConfidence;
      verification?: EvidenceVerification;
      evidenceText?: string | null;
    }
  ): SourceEvidence {
    return {
      field,
      value,
      sourceType: options.sourceType,
      sourceUrl: options.sourceUrl ?? null,
      confidence: options.confidence ?? "medium",
      verification: options.verification ?? "unverified",
      evidenceText: options.evidenceText ?? null,
      discoveredAt: new Date().toISOString(),
    };
  }
  
  export function dedupeEvidence(
    evidence: SourceEvidence[]
  ): SourceEvidence[] {
    const seen = new Set<string>();
  
    return evidence.filter((item) => {
      const key = [
        item.field,
        item.value.trim().toLowerCase(),
        item.sourceUrl ?? "",
      ].join("|");
  
      if (seen.has(key)) {
        return false;
      }
  
      seen.add(key);
      return true;
    });
  }
  
  export function getHighestConfidence(
    evidence: SourceEvidence[]
  ): EvidenceConfidence {
    if (evidence.some((item) => item.confidence === "high")) {
      return "high";
    }
  
    if (evidence.some((item) => item.confidence === "medium")) {
      return "medium";
    }
  
    return "low";
  }
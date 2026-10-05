import type { Lead } from "@/lib/leads/types";
import type {
  BusinessIdentityResult,
  IdentityCandidate,
  IdentityMatchConfidence,
} from "./types";

import { buildIdentityVariants } from "./variants";
import { scoreIdentityCandidate } from "./score";

export { buildIdentityVariants } from "./variants";

export interface IdentityResolutionCandidate {
  url: string;
  title: string | null;
  description: string | null;
  locationText?: string | null;
}

function sortCandidates(
  candidates: IdentityCandidate[],
): IdentityCandidate[] {
  return [...candidates].sort((a, b) => {
    if (b.totalScore !== a.totalScore) {
      return b.totalScore - a.totalScore;
    }

    if (b.locationScore !== a.locationScore) {
      return b.locationScore - a.locationScore;
    }

    if (b.domainScore !== a.domainScore) {
      return b.domainScore - a.domainScore;
    }

    return b.nameScore - a.nameScore;
  });
}

function selectConfidence(
  candidate: IdentityCandidate | undefined,
): IdentityMatchConfidence {
  if (!candidate) {
    return "rejected";
  }

  if (
    candidate.totalScore >= 80 &&
    candidate.locationScore >= 20 &&
    (candidate.nameScore >= 40 ||
      candidate.domainScore >= 20)
  ) {
    return "high";
  }

  if (
    candidate.totalScore >= 60 &&
    (candidate.nameScore >= 25 ||
      candidate.domainScore >= 20)
  ) {
    return "medium";
  }

  if (candidate.totalScore >= 40) {
    return "low";
  }

  return "rejected";
}

function selectOfficialWebsite(
  candidate: IdentityCandidate | undefined,
): string | null {
  if (!candidate) {
    return null;
  }

  const confidence = selectConfidence(candidate);

  if (confidence === "high") {
    return candidate.url;
  }

  return null;
}

export function resolveBusinessIdentity(
  lead: Lead,
  candidates: IdentityResolutionCandidate[],
): BusinessIdentityResult {
  const variants = buildIdentityVariants(lead);

  const scoredCandidates = candidates.map((candidate) =>
    scoreIdentityCandidate({
      lead,
      candidate,
      variants,
    }),
  );

  const sortedCandidates = sortCandidates(
    scoredCandidates,
  );

  const bestCandidate = sortedCandidates[0];

  const confidence = selectConfidence(bestCandidate);

  const officialWebsite = selectOfficialWebsite(
    bestCandidate,
  );

  const evidence = bestCandidate?.evidence ?? [];

  const warnings: string[] = [];

  if (sortedCandidates.length === 0) {
    warnings.push(
      "No public-web identity candidates were available for evaluation.",
    );
  }

  if (
    sortedCandidates.length > 0 &&
    confidence === "rejected"
  ) {
    warnings.push(
      "Public-web candidates were found, but none had sufficient identity evidence.",
    );
  }

  if (confidence === "low") {
    warnings.push(
      "A possible identity match was found, but the evidence is too weak to automatically assign an official website.",
    );
  }

  if (confidence === "medium") {
    warnings.push(
      "A probable identity match was found, but additional evidence is recommended before treating the website as confirmed.",
    );
  }

  if (
    bestCandidate &&
    bestCandidate.locationScore === 0 &&
    lead.city
  ) {
    warnings.push(
      "The strongest candidate did not provide sufficient matching location evidence.",
    );
  }

  return {
    lead,
    variants,
    candidates: sortedCandidates,
    officialWebsite,
    confidence,
    evidence,
    warnings,
    resolvedAt: new Date().toISOString(),
  };
}
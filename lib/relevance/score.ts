import type { Lead } from "@/lib/leads/types";
import type { WebsiteIntelligence } from "@/lib/intelligence/types";
import type {
  RelevanceEvidence,
  RelevanceResult,
  RelevanceStatus,
} from "./types";
import {
  buildSearchTermSet,
  normalizeSearchText,
  type SearchTermSet,
} from "./terms";

type EvidenceCandidate = {
  source: RelevanceEvidence["source"];
  field: string;
  value: string | null | undefined;
  weight: number;
};

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function containsPhrase(
  text: string,
  phrase: string,
): boolean {
  if (!text || !phrase) {
    return false;
  }

  return text.includes(normalizeSearchText(phrase));
}

function matchingTerms(
  text: string,
  search: SearchTermSet,
): string[] {
  const normalized = normalizeSearchText(text);

  if (!normalized) {
    return [];
  }

  const matches = search.terms.filter((term) => {
    const normalizedTerm = normalizeSearchText(term);

    if (!normalizedTerm) {
      return false;
    }

    if (normalizedTerm.includes(" ")) {
      return normalized.includes(normalizedTerm);
    }

    const words = normalized.split(" ");
    return words.includes(normalizedTerm);
  });

  return unique(matches);
}

function hasStrongMatch(
  text: string,
  search: SearchTermSet,
): boolean {
  const normalized = normalizeSearchText(text);

  if (!normalized) {
    return false;
  }

  return search.strongTerms.some((term) => {
    const normalizedTerm = normalizeSearchText(term);

    if (!normalizedTerm) {
      return false;
    }

    return normalized.includes(normalizedTerm);
  });
}

function addEvidence(
  evidence: RelevanceEvidence[],
  candidate: EvidenceCandidate,
  search: SearchTermSet,
): string[] {
  const value = candidate.value?.trim();

  if (!value) {
    return [];
  }

  const matches = matchingTerms(value, search);

  if (matches.length === 0) {
    return [];
  }

  evidence.push({
    source: candidate.source,
    field: candidate.field,
    value,
    matchedTerms: matches,
    weight: candidate.weight,
  });

  return matches;
}

function getWebsiteText(
  websiteIntelligence: WebsiteIntelligence | null,
): {
  title: string;
  description: string;
  headings: string;
  links: string;
} {
  if (!websiteIntelligence) {
    return {
      title: "",
      description: "",
      headings: "",
      links: "",
    };
  }

  return {
    title: websiteIntelligence.title ?? "",
    description: websiteIntelligence.description ?? "",
    headings: Array.isArray(websiteIntelligence.headings)
      ? websiteIntelligence.headings.join(" ")
      : "",
    links: Array.isArray(websiteIntelligence.links)
      ? websiteIntelligence.links.join(" ")
      : "",
  };
}

function buildStatus(
  score: number,
  strongEvidence: boolean,
  negativeSignals: string[],
): RelevanceStatus {
  /**
   * A high score without strong evidence should not automatically
   * become "verified".
   */
  if (
    score >= 80 &&
    strongEvidence &&
    negativeSignals.length === 0
  ) {
    return "verified";
  }

  if (score >= 60) {
    return "likely";
  }

  if (score >= 35) {
    return "review";
  }

  return "rejected";
}

function addOpportunityEvidence(
  lead: Lead,
  evidence: RelevanceEvidence[],
  reasons: string[],
  score: { value: number },
): void {
  /**
   * A known industry is useful evidence, but it should not override
   * stronger business-name or website evidence.
   */
  if (lead.industry) {
    evidence.push({
      source: "category",
      field: "industry",
      value: lead.industry,
      matchedTerms: [],
      weight: 5,
    });

    reasons.push(`Business category is available: ${lead.industry}.`);
    score.value += 5;
  }

  if (lead.website) {
    evidence.push({
      source: "provider",
      field: "website",
      value: lead.website,
      matchedTerms: [],
      weight: 5,
    });

    score.value += 5;
  }

  if (lead.city) {
    evidence.push({
      source: "provider",
      field: "city",
      value: lead.city,
      matchedTerms: [],
      weight: 3,
    });

    score.value += 3;
  }
}

export function scoreLeadRelevance(
  lead: Lead,
  query: string,
  websiteIntelligence: WebsiteIntelligence | null = null,
): RelevanceResult {
  const search = buildSearchTermSet(query);

  const evidence: RelevanceEvidence[] = [];
  const reasons: string[] = [];
  const negativeSignals: string[] = [];
  const matchedTerms: string[] = [];

  const score = {
    value: 0,
  };

  const websiteText = getWebsiteText(
    websiteIntelligence,
  );

  /**
   * ------------------------------------------------------------
   * 1. COMPANY NAME
   * ------------------------------------------------------------
   *
   * Business names are one of our strongest deterministic signals.
   */
  const companyName = lead.companyName ?? "";

  const companyMatches = addEvidence(
    evidence,
    {
      source: "business-name",
      field: "companyName",
      value: companyName,
      weight: 30,
    },
    search,
  );

  if (companyMatches.length > 0) {
    matchedTerms.push(...companyMatches);

    const exactPhrase =
      search.phrases.some((phrase) =>
        containsPhrase(companyName, phrase),
      );

    const strongMatch = hasStrongMatch(
      companyName,
      search,
    );

    if (exactPhrase) {
      score.value += 30;
      reasons.push(
        "The business name directly matches the requested search.",
      );
    } else if (strongMatch) {
      score.value += 25;
      reasons.push(
        "The business name contains a strong related search term.",
      );
    } else {
      score.value += 15;
      reasons.push(
        "The business name contains a relevant search term.",
      );
    }
  }

  /**
   * ------------------------------------------------------------
   * 2. INDUSTRY / CATEGORY
   * ------------------------------------------------------------
   */
  if (lead.industry) {
    const industryMatches = addEvidence(
      evidence,
      {
        source: "category",
        field: "industry",
        value: lead.industry,
        weight: 30,
      },
      search,
    );

    if (industryMatches.length > 0) {
      matchedTerms.push(...industryMatches);
      score.value += 30;

      reasons.push(
        `The business category matches the requested search.`,
      );
    }
  }

  /**
   * ------------------------------------------------------------
   * 3. DESCRIPTION
   * ------------------------------------------------------------
   */
  if (lead.description) {
    const descriptionMatches = addEvidence(
      evidence,
      {
        source: "description",
        field: "description",
        value: lead.description,
        weight: 20,
      },
      search,
    );

    if (descriptionMatches.length > 0) {
      matchedTerms.push(...descriptionMatches);

      const descriptionStrong =
        hasStrongMatch(
          lead.description,
          search,
        );

      score.value += descriptionStrong ? 20 : 10;

      reasons.push(
        "The business description contains relevant search terms.",
      );
    }
  }

  /**
   * ------------------------------------------------------------
   * 4. WEBSITE TITLE
   * ------------------------------------------------------------
   */
  if (websiteText.title) {
    const titleMatches = addEvidence(
      evidence,
      {
        source: "website-title",
        field: "title",
        value: websiteText.title,
        weight: 30,
      },
      search,
    );

    if (titleMatches.length > 0) {
      matchedTerms.push(...titleMatches);

      const exactPhrase =
        search.phrases.some((phrase) =>
          containsPhrase(
            websiteText.title,
            phrase,
          ),
        );

      score.value += exactPhrase ? 30 : 20;

      reasons.push(
        "The website title supports the requested business category.",
      );
    }
  }

  /**
   * ------------------------------------------------------------
   * 5. WEBSITE DESCRIPTION
   * ------------------------------------------------------------
   */
  if (websiteText.description) {
    const websiteDescriptionMatches =
      addEvidence(
        evidence,
        {
          source: "website-description",
          field: "description",
          value: websiteText.description,
          weight: 20,
        },
        search,
      );

    if (
      websiteDescriptionMatches.length > 0
    ) {
      matchedTerms.push(
        ...websiteDescriptionMatches,
      );

      score.value += 15;

      reasons.push(
        "The website description supports the requested category.",
      );
    }
  }

  /**
   * ------------------------------------------------------------
   * 6. WEBSITE HEADINGS
   * ------------------------------------------------------------
   */
  if (websiteText.headings) {
    const headingMatches = addEvidence(
      evidence,
      {
        source: "website-heading",
        field: "headings",
        value: websiteText.headings,
        weight: 20,
      },
      search,
    );

    if (headingMatches.length > 0) {
      matchedTerms.push(...headingMatches);

      score.value += 15;

      reasons.push(
        "Website headings contain relevant business terminology.",
      );
    }
  }

  /**
   * ------------------------------------------------------------
   * 7. SOCIAL LINKS
   * ------------------------------------------------------------
   *
   * Social presence is supporting evidence, not category proof.
   */
  const socialValues = [
    lead.instagramUrl,
    lead.facebookUrl,
    lead.linkedinUrl,
  ].filter(Boolean);

  if (socialValues.length > 0) {
    const socialMatches = socialValues.flatMap(
      (value) =>
        matchingTerms(value ?? "", search),
    );

    if (socialMatches.length > 0) {
      matchedTerms.push(...socialMatches);

      evidence.push({
        source: "social",
        field: "socialLinks",
        value: socialValues.join(" "),
        matchedTerms: unique(
          socialMatches,
        ),
        weight: 5,
      });

      score.value += 5;

      reasons.push(
        "Public social information contains relevant search terms.",
      );
    }
  }

  /**
   * ------------------------------------------------------------
   * 8. GENERIC BUSINESS SIGNALS
   * ------------------------------------------------------------
   */
  addOpportunityEvidence(
    lead,
    evidence,
    reasons,
    score,
  );

  /**
   * ------------------------------------------------------------
   * 9. NEGATIVE SIGNALS
   * ------------------------------------------------------------
   *
   * Important:
   * Missing website information is NOT treated as proof
   * that a business is irrelevant.
   */
  const allBusinessText = normalizeSearchText(
    [
      lead.companyName,
      lead.industry,
      lead.description,
      websiteText.title,
      websiteText.description,
      websiteText.headings,
    ]
      .filter(Boolean)
      .join(" "),
  );

  const hasCategoryEvidence =
    matchedTerms.length > 0;

  if (!hasCategoryEvidence) {
    negativeSignals.push(
      "No meaningful evidence matched the requested search category.",
    );

    score.value -= 35;
  }

  /**
   * Detect obvious mismatch when category information exists.
   *
   * Example:
   * requested = dermatology
   * industry = fast food
   */
  if (
    lead.industry &&
    search.normalized &&
    !containsPhrase(
      lead.industry,
      search.normalized,
    ) &&
    matchingTerms(
      lead.industry,
      search,
    ).length === 0 &&
    matchingTerms(
      lead.companyName,
      search,
    ).length === 0 &&
    !hasStrongMatch(
      allBusinessText,
      search,
    )
  ) {
    negativeSignals.push(
      "The available business category does not support the requested search.",
    );

    score.value -= 20;
  }

  /**
   * ------------------------------------------------------------
   * 10. FINAL SCORE
   * ------------------------------------------------------------
   */
  const finalScore = clamp(
    Math.round(score.value),
  );

  const strongEvidence =
    evidence.some(
      (item) =>
        item.source === "business-name" ||
        item.source === "category" ||
        item.source === "website-title" ||
        item.source === "website-description",
    );

  const status = buildStatus(
    finalScore,
    strongEvidence,
    negativeSignals,
  );

  /**
   * Remove duplicate reasons while preserving order.
   */
  const uniqueReasons = unique(reasons);

  /**
   * Make sure every result has an understandable explanation.
   */
  if (uniqueReasons.length === 0) {
    if (status === "rejected") {
      uniqueReasons.push(
        "Insufficient evidence to verify relevance.",
      );
    } else {
      uniqueReasons.push(
        "Relevance determined from available business evidence.",
      );
    }
  }

  return {
    score: finalScore,
    status,
    reasons: uniqueReasons,
    matchedTerms: unique(matchedTerms),
    negativeSignals: unique(
      negativeSignals,
    ),
    evidence,
  };
}
import type {
  DiscoveryProvider,
  DiscoveryQuery,
  DiscoveryResult,
} from "@/lib/providers/types";

export type DiscoveryAttempt = {
  provider: string;
  success: boolean;
  candidateCount: number;
  error?: string;
};

export type RoutedDiscoveryResult =
  DiscoveryResult & {
    attempts: DiscoveryAttempt[];
  };

type RoutedCandidate =
  Record<string, unknown> & {
    discoveryProvider?: string;
  };

function normalizeValue(
  value: unknown
): string {
  return typeof value === "string"
    ? value.trim().toLowerCase()
    : "";
}

function uniqueCandidates(
  candidates: RoutedCandidate[]
): RoutedCandidate[] {
  const seen = new Set<string>();
  const result: RoutedCandidate[] = [];

  for (const candidate of candidates) {
    const companyName =
      normalizeValue(
        candidate.companyName
      );

    const city =
      normalizeValue(
        candidate.city
      );

    const website =
      normalizeValue(
        candidate.website
      );

    const sourceUrl =
      normalizeValue(
        candidate.sourceUrl
      );

    /*
     * Prefer the official website as the
     * strongest deduplication identity.
     */
    let key = "";

    if (website) {
      key = `website:${website}`;
    } else if (
      companyName &&
      city
    ) {
      key = `company:${companyName}|city:${city}`;
    } else if (companyName) {
      key = `company:${companyName}`;
    } else if (sourceUrl) {
      key = `source:${sourceUrl}`;
    }

    /*
     * A completely unidentified candidate
     * should not be treated as a unique lead.
     */
    if (!key) {
      continue;
    }

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(candidate);
  }

  return result;
}

export async function runDiscoveryRouter(
  providers: DiscoveryProvider[],
  query: DiscoveryQuery
): Promise<RoutedDiscoveryResult> {
  const requestedLimit =
    Math.min(
      50,
      Math.max(
        1,
        query.limit ?? 10
      )
    );

  const attempts:
    DiscoveryAttempt[] = [];

  const allCandidates:
    RoutedCandidate[] = [];

  /*
   * Run providers independently.
   *
   * One provider failing must never
   * destroy the entire discovery request.
   */
  for (const provider of providers) {
    try {
      console.log(
        `[Discovery Router] Trying provider: ${provider.id}`
      );

      const result =
        await provider.discover({
          ...query,

          /*
           * Ask each provider for extra raw
           * candidates because the intelligence
           * pipeline will filter weak results.
           */
          limit: Math.min(
            50,
            requestedLimit * 3
          ),
        });

      const candidates =
        Array.isArray(
          result.candidates
        )
          ? result.candidates
          : [];

      /*
       * Preserve the provider that actually
       * discovered each candidate.
       *
       * This is important because after routing,
       * the pipeline sees "discovery-router" as
       * the provider unless we preserve the
       * original source here.
       */
      const taggedCandidates:
        RoutedCandidate[] =
        candidates.map(
          (candidate) => ({
            ...candidate,
            discoveryProvider:
              provider.id,
          })
        );

      allCandidates.push(
        ...taggedCandidates
      );

      attempts.push({
        provider:
          provider.id,

        success: true,

        candidateCount:
          candidates.length,
      });

      console.log(
        `[Discovery Router] ${provider.id} returned ${candidates.length} candidates`
      );

    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unknown provider error.";

      console.warn(
        `[Discovery Router] ${provider.id} failed: ${message}`
      );

      attempts.push({
        provider:
          provider.id,

        success: false,

        candidateCount: 0,

        error: message,
      });
    }
  }

  /*
   * Deduplicate only after all providers have
   * contributed their candidates.
   */
  const candidates =
    uniqueCandidates(
      allCandidates
    ).slice(
      0,
      requestedLimit * 3
    );

  /*
   * Report which providers actually supplied
   * candidates. This is useful for debugging
   * and prevents the API layer from claiming
   * that the originally selected provider
   * supplied all results.
   */
  const providersUsed =
    Array.from(
      new Set(
        candidates
          .map(
            (candidate) =>
              candidate.discoveryProvider
          )
          .filter(
            (
              provider
            ): provider is string =>
              typeof provider ===
                "string" &&
              provider.length > 0
          )
      )
    );

  console.log(
    "[Discovery Router] Completed",
    {
      requestedProvider:
        providers[0]?.id ??
        null,

      providersUsed,

      totalRawCandidates:
        allCandidates.length,

      uniqueCandidates:
        candidates.length,

      attempts,
    }
  );

  return {
    candidates,

    nextCursor: null,

    attempts,
  };
}
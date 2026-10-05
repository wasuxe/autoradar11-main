import { NextResponse } from "next/server";
import { z } from "zod";

import type {
  DiscoveryProvider,
  DiscoveryQuery,
} from "@/lib/providers/types";

import { runDiscoveryRouter } from "@/lib/discovery/router";

import { developmentProvider } from "@/lib/discovery/providers/development";
import { openStreetMapProvider } from "@/lib/discovery/providers/openstreetmap";
import { overpassProvider } from "@/lib/discovery/providers/overpass";
import { searxngProvider } from "@/lib/discovery/providers/searxng";

import { SERVICE_TRACKS } from "@/lib/leads/types";

const providers: Record<
  string,
  DiscoveryProvider
> = {
  searxng: searxngProvider,
  openstreetmap: openStreetMapProvider,
  overpass: overpassProvider,
  development: developmentProvider,
};

const requestSchema = z.object({
  provider: z.enum([
    "development",
    "openstreetmap",
    "overpass",
    "searxng",
  ]),

  text: z.string().optional(),

  industry: z.string().optional(),

  country: z.string().optional(),

  city: z.string().optional(),

  serviceTrack:
    z.enum(SERVICE_TRACKS)
      .optional()
      .or(z.literal("")),

  limit:
    z.coerce
      .number()
      .int()
      .min(1)
      .max(50)
      .optional(),
});

function cleanOptionalString(
  value: string | undefined
): string | undefined {
  const cleaned =
    value?.trim();

  return cleaned
    ? cleaned
    : undefined;
}

function getProviderOrder(
  selectedProvider: string
): DiscoveryProvider[] {
  const selected =
    providers[selectedProvider];

  if (!selected) {
    return [];
  }

  const fallbackOrder:
    DiscoveryProvider[] = [
      selected,
      openStreetMapProvider,
      searxngProvider,
      overpassProvider,
    ];

  const unique:
    DiscoveryProvider[] = [];

  const seen =
    new Set<string>();

  for (const provider of fallbackOrder) {
    if (seen.has(provider.id)) {
      continue;
    }

    seen.add(provider.id);
    unique.push(provider);
  }

  return unique;
}

/**
 * Determine which providers actually contributed
 * candidates to the routed discovery result.
 *
 * The user's selected provider is NOT necessarily
 * the provider that produced the final candidates.
 */
function getProvidersUsed(
  attempts: Array<{
    provider: string;
    success: boolean;
    candidateCount: number;
    error?: string;
  }>
): string[] {
  return attempts
    .filter(
      (attempt) =>
        attempt.success &&
        attempt.candidateCount > 0
    )
    .map(
      (attempt) =>
        attempt.provider
    );
}

/**
 * A routed search can contain candidates from
 * multiple providers, so a single provider name
 * is misleading.
 *
 * Only return a concrete provider when exactly
 * one provider actually contributed candidates.
 */
function getResultProviderLabel(
  providersUsed: string[]
): string {
  if (
    providersUsed.length === 1
  ) {
    return providersUsed[0];
  }

  if (
    providersUsed.length > 1
  ) {
    return "discovery-router";
  }

  return "discovery-router";
}

export async function POST(
  request: Request
) {
  try {
    const body =
      await request.json();

    const parsed =
      requestSchema.safeParse(
        body
      );

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid discovery request.",
          details:
            parsed.error.flatten(),
        },
        {
          status: 400,
        }
      );
    }

    const data =
      parsed.data;

    const providerOrder =
      getProviderOrder(
        data.provider
      );

    if (
      providerOrder.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            `Discovery provider "${data.provider}" is not configured.`,
        },
        {
          status: 400,
        }
      );
    }

    const query:
      DiscoveryQuery = {
      text:
        cleanOptionalString(
          data.text
        ),

      industry:
        cleanOptionalString(
          data.industry
        ),

      country:
        cleanOptionalString(
          data.country
        ),

      city:
        cleanOptionalString(
          data.city
        ),

      serviceTrack:
        data.serviceTrack || null,

      limit:
        data.limit ?? 10,

      cursor:
        null,
    };

    console.log(
      "[Discovery] Starting routed search",
      {
        selectedProvider:
          data.provider,

        providers:
          providerOrder.map(
            (provider) =>
              provider.id
          ),

        query,
      }
    );

    /*
     * The router discovers raw candidates.
     *
     * The selected provider is only the first
     * provider attempted. It is NOT necessarily
     * the source of the final candidates.
     */
    const routedResult =
      await runDiscoveryRouter(
        providerOrder,
        query
      );

    const providersUsed =
      getProvidersUsed(
        routedResult.attempts
      );

    const resultProvider =
      getResultProviderLabel(
        providersUsed
      );

    console.log(
      "[Discovery] Providers used",
      {
        selectedProvider:
          data.provider,

        providersUsed,

        resultProvider,
      }
    );

    /*
     * If no provider produced candidates,
     * return a useful response rather than
     * pretending there are simply no businesses.
     */
    if (
      routedResult.candidates
        .length === 0
    ) {
      const failedProviders =
        routedResult.attempts
          .filter(
            (attempt) =>
              !attempt.success
          )
          .map(
            (attempt) =>
              `${attempt.provider}: ${
                attempt.error ??
                "unknown error"
              }`
          );

      return NextResponse.json(
        {
          success: true,

          /*
           * IMPORTANT:
           *
           * provider is now the actual result
           * source label, not merely the user's
           * selected provider.
           */
          provider:
            resultProvider,

          /*
           * Preserve what the user originally
           * selected separately.
           */
          selectedProvider:
            data.provider,

          leads: [],

          leadResults: [],

          qualifiedLeads: [],

          nextCursor: null,

          discovery: {
            candidates: 0,

            selectedProvider:
              data.provider,

            providersUsed,

            resultProvider,

            attempts:
              routedResult.attempts,

            warnings:
              failedProviders.length > 0
                ? failedProviders
                : [
                    "No discovery candidates were returned by the configured providers.",
                  ],
          },
        },
        {
          status: 200,
        }
      );
    }

    /*
     * Feed routed candidates into the existing
     * AutoRadar intelligence pipeline.
     *
     * The temporary provider preserves the
     * existing runDiscovery() architecture.
     */
    const routedProvider:
      DiscoveryProvider = {
      id:
        "discovery-router",

      async discover() {
        return {
          candidates:
            routedResult.candidates,

          nextCursor:
            routedResult.nextCursor ??
            null,
        };
      },
    };

    const {
      runDiscovery,
    } =
      await import(
        "@/lib/discovery/pipeline"
      );

    const result =
      await runDiscovery(
        routedProvider,
        query
      );

    console.log(
      "[Discovery] Routed search completed",
      {
        selectedProvider:
          data.provider,

        providersUsed,

        resultProvider,

        discovered:
          result.leads.length,

        qualified:
          result
            .qualifiedLeads
            .length,

        attempts:
          routedResult.attempts,
      }
    );

    return NextResponse.json(
      {
        success: true,

        /*
         * This now represents the actual
         * discovery source(s), rather than
         * blindly echoing the selected provider.
         */
        provider:
          resultProvider,

        /*
         * Keep the original selection available
         * for debugging/UI if needed.
         */
        selectedProvider:
          data.provider,

        leads:
          result.leads,

        leadResults:
          result.leadResults,

        qualifiedLeads:
          result.qualifiedLeads,

        nextCursor:
          result.nextCursor ??
          null,

        discovery: {
          candidates:
            routedResult
              .candidates
              .length,

          selectedProvider:
            data.provider,

          providersUsed,

          resultProvider,

          attempts:
            routedResult.attempts,

          warnings:
            routedResult.attempts
              .filter(
                (attempt) =>
                  !attempt.success
              )
              .map(
                (attempt) =>
                  `${attempt.provider}: ${
                    attempt.error ??
                    "unknown error"
                  }`
              ),
        },
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    if (
      error instanceof Error
    ) {
      console.error(
        "[Discovery] Error:",
        error.message
      );

      return NextResponse.json(
        {
          success: false,

          error:
            error.message ||
            "Discovery failed.",
        },
        {
          status: 502,
        }
      );
    }

    console.error(
      "[Discovery] Unknown error:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          "An unexpected discovery error occurred.",
      },
      {
        status: 500,
      }
    );
  }
}
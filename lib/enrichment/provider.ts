import type { Lead } from "@/lib/leads/types";
import type { EnrichmentResult } from "./types";

export type EnrichmentQuery = {
  lead: Lead;
};

export interface EnrichmentProvider {
  id: string;

  enrich(
    query: EnrichmentQuery
  ): Promise<EnrichmentResult>;
}
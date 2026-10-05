import type { Lead, LeadInput, ServiceTrack } from "@/lib/leads/types";

export type DiscoveryQuery = {
  text?: string;
  industry?: string;
  country?: string;
  city?: string;
  serviceTrack?: ServiceTrack | null;
  limit?: number;
  cursor?: string | null;
};

export type DiscoveryResult = {
  /** Provider-mapped candidates. Call normalizeLead() before persistence/UI. */
  candidates: Record<string, unknown>[];
  nextCursor?: string | null;
};

export interface DiscoveryProvider {
  readonly id: string;
  discover(query: DiscoveryQuery): Promise<DiscoveryResult>;
}

/** Optional later: providers that already map fields into LeadInput. */
export type MappedDiscoveryResult = {
  candidates: LeadInput[];
  nextCursor?: string | null;
};

export type NormalizedDiscoveryResult = {
  leads: Lead[];
  nextCursor?: string | null;
};

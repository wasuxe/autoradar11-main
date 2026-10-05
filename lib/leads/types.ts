export const SERVICE_TRACKS = ["technical", "creative", "both"] as const;

export type ServiceTrack = (typeof SERVICE_TRACKS)[number];

export type Lead = {
  companyName: string;
  website: string | null;
  industry: string | null;
  country: string | null;
  city: string | null;
  employeeRange: string | null;
  serviceTrack: ServiceTrack | null;
  source: string;
  sourceUrl: string | null;
  description?: string | null;
  linkedinUrl?: string | null;
  instagramUrl?: string | null;
  facebookUrl?: string | null;
  foundedYear?: number | null;
};

/** Loose input from any discovery provider before normalize + parse. */
export type LeadInput = {
  companyName?: unknown;
  website?: unknown;
  industry?: unknown;
  country?: unknown;
  city?: unknown;
  employeeRange?: unknown;
  serviceTrack?: unknown;
  source?: unknown;
  sourceUrl?: unknown;
  description?: unknown;
  linkedinUrl?: unknown;
  instagramUrl?: unknown;
  facebookUrl?: unknown;
  foundedYear?: unknown;
};

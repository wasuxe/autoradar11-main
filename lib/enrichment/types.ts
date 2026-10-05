export type ContactSource =
  | "website"
  | "public-search"
  | "provider"
  | "manual";

export type BusinessContact = {
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  contactPage: string | null;
  linkedinUrl: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;
  source: ContactSource | null;
  confidence: "high" | "medium" | "low" | null;
};

export type EnrichmentResult = {
  companyName: string;
  website: string | null;
  contact: BusinessContact;
  signals: string[];
  enrichedAt: string;
};
export type WebsiteLink = {
  label: string;
  url: string;
};

export type WebsiteIntelligence = {
  url: string;
  reachable: boolean;
  statusCode: number | null;
  title: string | null;
  description: string | null;
  headings: string[];
  links: WebsiteLink[];
  socialLinks: string[];
  hasHttps: boolean;
  hasContactPage: boolean;
  hasCallToAction: boolean;
  signals: string[];
  fetchedAt: string;
};
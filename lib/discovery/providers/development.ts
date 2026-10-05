import type { DiscoveryCandidate } from "@/lib/discovery/types";
import type { ServiceTrack } from "@/lib/leads/types";
import type {
  DiscoveryProvider,
  DiscoveryQuery,
  DiscoveryResult,
} from "@/lib/providers/types";

const DEV_NOTICE =
  "[DEVELOPMENT TEST RECORD] Fictional AutoRadar fixture. Not a real company or prospect.";

type DevCompany = {
  companyName: string;
  website: string | null;
  industry: string;
  country: string | null;
  city: string | null;
  employeeRange: string;
  serviceTrack: ServiceTrack;
  foundedYear: number | null;
  extraDescription?: string;
};

/**
 * Fictional .example companies only. Includes deliberate duplicates
 * (www/trailing slash, whitespace, name+city, name-only) for pipeline tests.
 */
const DEV_COMPANIES: DevCompany[] = [
  {
    companyName: "Harborline Creative Agency (DEV)",
    website: "https://harborline-creative.example",
    industry: "Marketing",
    country: "India",
    city: "Mumbai",
    employeeRange: "11-50",
    serviceTrack: "creative",
    foundedYear: 2016,
    extraDescription: "creative agency fixture",
  },
  {
    companyName: "  Harborline Creative Agency (DEV)  ",
    website: "https://www.harborline-creative.example/",
    industry: "Marketing",
    country: "India",
    city: "Mumbai",
    employeeRange: "11-50",
    serviceTrack: "creative",
    foundedYear: 2016,
    extraDescription: "creative agency duplicate by domain",
  },
  {
    companyName: "Harborline Creative Agency (DEV)",
    website: null,
    industry: "Marketing",
    country: "India",
    city: " Mumbai ",
    employeeRange: "11-50",
    serviceTrack: "creative",
    foundedYear: 2016,
    extraDescription: "creative agency duplicate by name and city",
  },
  {
    companyName: "Lotus Pixel Studio (DEV)",
    website: "lotus-pixel.example/",
    industry: "Marketing",
    country: "India",
    city: "Mumbai",
    employeeRange: "1-10",
    serviceTrack: "creative",
    foundedYear: 2021,
    extraDescription: "creative agency fixture",
  },
  {
    companyName: "Monsoon Brand Lab (DEV)",
    website: "https://www.monsoon-brand.example",
    industry: "Marketing",
    country: "India",
    city: "Mumbai",
    employeeRange: "51-200",
    serviceTrack: "creative",
    foundedYear: 2012,
    extraDescription: "creative agency fixture",
  },
  {
    companyName: "Bandra Narrative Co (DEV)",
    website: "https://bandra-narrative.example",
    industry: "Marketing",
    country: "India",
    city: "Mumbai",
    employeeRange: "11-50",
    serviceTrack: "both",
    foundedYear: 2018,
    extraDescription: "creative agency fixture",
  },
  {
    companyName: "Colaba Type Works (DEV)",
    website: "https://colaba-type.example",
    industry: "Marketing",
    country: "India",
    city: "Mumbai",
    employeeRange: "1-10",
    serviceTrack: "creative",
    foundedYear: 2019,
    extraDescription: "creative agency fixture",
  },
  {
    companyName: "Marine Drive Media (DEV)",
    website: "https://marine-drive-media.example",
    industry: "Marketing",
    country: "India",
    city: "Mumbai",
    employeeRange: "201-500",
    serviceTrack: "creative",
    foundedYear: 2009,
    extraDescription: "creative agency fixture",
  },
  {
    companyName: "Andheri Motion Shop (DEV)",
    website: "https://andheri-motion.example",
    industry: "Marketing",
    country: "India",
    city: "Mumbai",
    employeeRange: "51-200",
    serviceTrack: "creative",
    foundedYear: 2014,
    extraDescription: "creative agency fixture",
  },
  {
    companyName: "Worli Studio Collective (DEV)",
    website: "https://worli-studio.example",
    industry: "Marketing",
    country: "India",
    city: "Mumbai",
    employeeRange: "11-50",
    serviceTrack: "creative",
    foundedYear: 2017,
    extraDescription: "creative agency fixture",
  },
  {
    companyName: "Powai Campaign Desk (DEV)",
    website: "https://powai-campaign.example",
    industry: "Marketing",
    country: "India",
    city: "Mumbai",
    employeeRange: "1-10",
    serviceTrack: "creative",
    foundedYear: 2022,
    extraDescription: "creative agency fixture",
  },
  {
    companyName: "Juhu Content Atelier (DEV)",
    website: "https://juhu-content.example",
    industry: "Marketing",
    country: "India",
    city: "Mumbai",
    employeeRange: "11-50",
    serviceTrack: "creative",
    foundedYear: 2015,
    extraDescription: "creative agency fixture",
  },
  {
    companyName: "Nameless City Press (DEV)",
    website: null,
    industry: "Marketing",
    country: "India",
    city: "Mumbai",
    employeeRange: "1-10",
    serviceTrack: "creative",
    foundedYear: null,
    extraDescription: "creative agency fixture without website",
  },
  {
    companyName: "Nameless City Press (DEV)",
    website: null,
    industry: "Marketing",
    country: "India",
    city: "Mumbai",
    employeeRange: "1-10",
    serviceTrack: "creative",
    foundedYear: null,
    extraDescription: "duplicate name+city without website",
  },
  {
    companyName: "Gateway Systems Lab (DEV)",
    website: "https://gateway-systems.example",
    industry: "Software",
    country: "India",
    city: "Mumbai",
    employeeRange: "51-200",
    serviceTrack: "technical",
    foundedYear: 2011,
    extraDescription: "software engineering fixture",
  },
  {
    companyName: "Pune Circuit Studio (DEV)",
    website: "https://pune-circuit.example",
    industry: "Design",
    country: "India",
    city: "Pune",
    employeeRange: "11-50",
    serviceTrack: "both",
    foundedYear: 2013,
    extraDescription: "product design fixture",
  },
  {
    companyName: "Unlocated Dev Sample Co (DEV)",
    website: null,
    industry: "Marketing",
    country: null,
    city: null,
    employeeRange: "1-10",
    serviceTrack: "creative",
    foundedYear: 2020,
    extraDescription: "creative agency fixture with no location",
  },
  {
    companyName: "Unlocated Dev Sample Co (DEV)",
    website: null,
    industry: "Marketing",
    country: null,
    city: null,
    employeeRange: "1-10",
    serviceTrack: "creative",
    foundedYear: 2020,
    extraDescription: "duplicate name-only fixture with no location",
  },
  {
    companyName: "Unlocated Dev Sample Co Ltd (DEV)",
    website: null,
    industry: "Marketing",
    country: null,
    city: null,
    employeeRange: "11-50",
    serviceTrack: "creative",
    foundedYear: 2020,
    extraDescription: "creative agency fixture with a similar name that must not merge",
  },
];

function eqText(left: string | null | undefined, right: string): boolean {
  if (!left) return false;
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

function matchesQuery(company: DevCompany, query: DiscoveryQuery): boolean {
  if (query.city && !eqText(company.city, query.city)) return false;
  if (query.country && !eqText(company.country, query.country)) return false;
  if (query.industry && !eqText(company.industry, query.industry)) return false;

  if (query.serviceTrack) {
    const track = company.serviceTrack;
    if (track !== query.serviceTrack && track !== "both") return false;
  }

  if (query.text) {
    const tokens = query.text
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
    const haystack = [
      company.companyName,
      company.industry,
      company.extraDescription ?? "",
      DEV_NOTICE,
    ]
      .join(" ")
      .toLowerCase();
    if (!tokens.every((token) => haystack.includes(token))) return false;
  }

  return true;
}

function toCandidate(company: DevCompany): DiscoveryCandidate {
  const slug = company.companyName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return {
    companyName: company.companyName,
    website: company.website,
    industry: company.industry,
    country: company.country,
    city: company.city,
    employeeRange: company.employeeRange,
    serviceTrack: company.serviceTrack,
    source: "development",
    sourceUrl: `https://development.autoradar.example/records/${slug}`,
    description: `${DEV_NOTICE} ${company.extraDescription ?? ""}`.trim(),
    foundedYear: company.foundedYear,
  };
}

export const developmentProvider: DiscoveryProvider = {
  id: "development",

  async discover(query: DiscoveryQuery): Promise<DiscoveryResult> {
    const candidates = DEV_COMPANIES.filter((company) =>
      matchesQuery(company, query)
    ).map(toCandidate);

    return {
      candidates,
      nextCursor: null,
    };
  },
};

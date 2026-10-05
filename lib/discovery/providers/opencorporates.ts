import type {
    DiscoveryProvider,
    DiscoveryQuery,
    DiscoveryResult,
  } from "@/lib/providers/types";
  
  type OpenCorporatesCompany = {
    company?: {
      name?: string;
      company_number?: string;
      jurisdiction_code?: string;
      current_status?: string;
      incorporation_date?: string | null;
      registered_address_in_full?: string | null;
      opencorporates_url?: string;
    };
  };
  
  type OpenCorporatesResponse = {
    results?: {
      companies?: OpenCorporatesCompany[];
    };
  };
  
  function getApiToken(): string {
    const token = process.env.OPENCORPORATES_API_TOKEN;
  
    if (!token) {
      throw new Error(
        "OPENCORPORATES_API_TOKEN is not configured"
      );
    }
  
    return token;
  }
  
  function buildSearchQuery(
    query: DiscoveryQuery
  ): string {
    const parts: string[] = [];
  
    if (query.text?.trim()) {
      parts.push(query.text.trim());
    }
  
    if (query.industry?.trim()) {
      parts.push(query.industry.trim());
    }
  
    if (query.city?.trim()) {
      parts.push(query.city.trim());
    }
  
    return parts.join(" ");
  }
  
  export const openCorporatesProvider: DiscoveryProvider = {
    id: "opencorporates",
  
    async discover(
      query: DiscoveryQuery
    ): Promise<DiscoveryResult> {
      const token = getApiToken();
  
      const searchQuery = buildSearchQuery(query);
  
      if (!searchQuery) {
        return {
          candidates: [],
          nextCursor: null,
        };
      }
  
      const params = new URLSearchParams();
  
      params.set("q", searchQuery);
      params.set(
        "per_page",
        String(Math.min(query.limit ?? 10, 50))
      );
      params.set("page", "1");
      params.set("exclude_inactive", "true");
      params.set("api_token", token);
  
      const response = await fetch(
        `https://api.opencorporates.com/v0.4/companies/search?${params.toString()}`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
            "User-Agent":
              "SoleTrust-AutoRadar/1.0",
          },
          cache: "no-store",
        }
      );
  
      if (!response.ok) {
        throw new Error(
          `OpenCorporates request failed: ${response.status}`
        );
      }
  
      const data =
        (await response.json()) as OpenCorporatesResponse;
  
      const companies =
        data.results?.companies ?? [];
  
      const candidates: Record<string, unknown>[] = [];
  
      for (const item of companies) {
        const company = item.company;
  
        if (!company?.name) {
          continue;
        }
  
        const candidate: Record<string, unknown> = {
          companyName: company.name,
          website: null,
          industry: query.industry ?? null,
          country: query.country ?? null,
          city: query.city ?? null,
          employeeRange: null,
          serviceTrack:
            query.serviceTrack ?? "both",
          source: "opencorporates",
          sourceUrl:
            company.opencorporates_url ?? null,
          description:
            company.current_status ?? null,
          foundedYear:
            company.incorporation_date
              ? Number(
                  company.incorporation_date.slice(
                    0,
                    4
                  )
                )
              : null,
        };
  
        candidates.push(candidate);
      }
  
      return {
        candidates,
        nextCursor: null,
      };
    },
  };
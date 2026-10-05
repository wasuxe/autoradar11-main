"use client";

import {
  FormEvent,
  useState,
} from "react";

type Lead = {
  companyName: string;
  website?: string | null;
  industry?: string | null;
  country?: string | null;
  city?: string | null;
  employeeRange?: string | null;
  serviceTrack?: string | null;
  source?: string | null;
  sourceUrl?: string | null;
  description?: string | null;
  linkedinUrl?: string | null;
  instagramUrl?: string | null;
  facebookUrl?: string | null;
  foundedYear?: number | null;
};

type QualificationSignal = {
  id?: string;
  label?: string;
  points?: number;
  type?: string;
  evidence?: string;
};

type Qualification = {
  score?: number;
  status?: string;
  signals?: QualificationSignal[];
};

type WebsiteIntelligence = {
  url?: string;
  reachable?: boolean;
  statusCode?: number | null;
  title?: string | null;
  description?: string | null;
  hasHttps?: boolean;
  hasContactPage?: boolean;
  hasCallToAction?: boolean;
  signals?: string[];
};

type Relevance = {
  score?: number;
  status?: string;
  reasons?: string[];
  matchedTerms?: string[];
  negativeSignals?: string[];
};

type EnrichmentContact = {
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  contactPage?: string | null;
  linkedinUrl?: string | null;
  instagramUrl?: string | null;
  facebookUrl?: string | null;
};

type Enrichment = {
  contact?: EnrichmentContact;
  confidence?: string;
  signals?: string[];
};

type BusinessPhone = {
  raw?: string | null;
  normalized?: string | null;
  display?: string | null;
  countryCode?: string | null;
  country?: string | null;
  type?: string | null;
  sourceUrl?: string | null;
  sourceType?: string | null;
  confidence?: string | null;
  verificationStatus?: string | null;
};

type BusinessEmail = {
  value?: string | null;
  normalized?: string | null;
  type?: string | null;
  sourceUrl?: string | null;
  sourceType?: string | null;
  confidence?: string | null;
  verificationStatus?: string | null;
};

type SocialContact = {
  platform?: string | null;
  url?: string | null;
  sourceUrl?: string | null;
  confidence?: string | null;
  verificationStatus?: string | null;
};

type DecisionMakerEvidence = {
  field?: string;
  value?: string;
  sourceType?: string;
  sourceUrl?: string | null;
  confidence?: string;
  verified?: boolean;
  evidenceText?: string;
};

type DecisionMaker = {
  name?: string | null;
  roleLabel?: string | null;
  profileUrl?: string | null;
  sourceUrl?: string | null;
  sourceType?: string | null;
  confidence?: string | null;
  verificationStatus?: string | null;
  reason?: string | null;
  evidence?: DecisionMakerEvidence[];
};

type ContactEvidence = {
  field?: string;
  value?: string;
  sourceType?: string;
  sourceUrl?: string | null;
  confidence?: string;
  verified?: boolean;
  evidenceText?: string;
};

type ContactIntelligence = {
  decisionMaker?: DecisionMaker | null;
  phones?: BusinessPhone[];
  emails?: BusinessEmail[];
  socialProfiles?: SocialContact[];
  contactabilityScore?: number;
  dataConfidenceScore?: number;
  verificationStatus?: string;
  evidence?: ContactEvidence[];
  researchedAt?: string;
  warnings?: string[];
};

type QualifiedLead = {
  lead: Lead;
  websiteIntelligence?: WebsiteIntelligence | null;
  qualification?: Qualification | null;
  enrichment?: Enrichment | null;
  relevance?: Relevance | null;
  contactIntelligence?: ContactIntelligence | null;
  evidence?: ContactEvidence[];
};

type DiscoveryResponse = {
  leads?: Lead[];

  /*
   * IMPORTANT:
   * leadResults contains ALL processed results,
   * including "review" and "low" leads.
   *
   * qualifiedLeads contains ONLY leads whose
   * qualification.status === "qualified".
   */
  leadResults?: QualifiedLead[];

  qualifiedLeads?: QualifiedLead[];

  nextCursor?: string | null;
  discovery?: {
    warnings?: string[];
  };
  error?: string;
  message?: string;
};

type Provider =
  | "development"
  | "openstreetmap"
  | "overpass"
  | "searxng";

const initialForm = {
  provider: "overpass" as Provider,
  industry: "interior designers",
  city: "mumbai",
  country: "India",
  serviceTrack: "both",
  limit: "10",
};

function getVerificationTone(
  status?: string | null
): string {
  switch (status) {
    case "verified":
      return "text-emerald-400 border-emerald-500/20 bg-emerald-500/5";
    case "partially_verified":
      return "text-amber-400 border-amber-500/20 bg-amber-500/5";
    case "unverified":
      return "text-orange-400 border-orange-500/20 bg-orange-500/5";
    case "rejected":
      return "text-red-400 border-red-500/20 bg-red-500/5";
    default:
      return "text-gray-400 border-white/10 bg-white/5";
  }
}

function formatStatus(
  status?: string | null
): string {
  if (!status) {
    return "Not found";
  }

  return status
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) =>
      character.toUpperCase()
    );
}

export default function Home() {
  const [provider, setProvider] =
    useState<Provider>(
      initialForm.provider
    );

  const [industry, setIndustry] =
    useState(initialForm.industry);

  const [city, setCity] =
    useState(initialForm.city);

  const [country, setCountry] =
    useState(initialForm.country);

  const [serviceTrack, setServiceTrack] =
    useState(initialForm.serviceTrack);

  const [limit, setLimit] =
    useState(initialForm.limit);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [leads, setLeads] =
    useState<Lead[]>([]);

  /*
   * ALL processed leads.
   *
   * This is what the result cards use for:
   * - relevance
   * - qualification
   * - website intelligence
   * - enrichment
   */
  const [leadResults, setLeadResults] =
    useState<QualifiedLead[]>([]);

  /*
   * ONLY genuinely qualified leads.
   *
   * This is used for the "Qualified: X" count.
   */
  const [qualifiedLeads, setQualifiedLeads] =
    useState<QualifiedLead[]>([]);

  const [hasSearched, setHasSearched] =
    useState(false);

  const [searchWarnings, setSearchWarnings] =
    useState<string[]>([]);

  const [selectedLead, setSelectedLead] =
    useState<QualifiedLead | null>(null);

  async function handleSearch(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (loading) {
      return;
    }

    setLoading(true);
    setError(null);
    setSearchWarnings([]);
    setHasSearched(true);
    setSelectedLead(null);

    /*
     * Clear old results immediately.
     * This prevents stale intelligence from
     * appearing while a new search is running.
     */
    setLeads([]);
    setLeadResults([]);
    setQualifiedLeads([]);

    try {
      const response =
        await fetch(
          "/api/discovery",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              provider,

              industry:
                industry.trim() ||
                undefined,

              city:
                city.trim() ||
                undefined,

              country:
                country.trim() ||
                undefined,

              serviceTrack,

              limit:
                Number(limit) || 10,
            }),
          }
        );

      const data =
        (await response.json()
          .catch(() => null)) as
          | DiscoveryResponse
          | null;

      if (!response.ok) {
        throw new Error(
          data?.error ||
            data?.message ||
            `Discovery request failed with HTTP ${response.status}`
        );
      }

      /*
       * Raw discovered businesses.
       */
      const discovered =
        Array.isArray(data?.leads)
          ? data.leads
          : [];

      /*
       * ALL processed lead intelligence.
       *
       * This is the critical field that was
       * previously not being stored in the UI.
       */
      const processed =
        Array.isArray(
          data?.leadResults
        )
          ? data.leadResults
          : [];

      /*
       * ONLY actually qualified leads.
       */
      const qualified =
        Array.isArray(
          data?.qualifiedLeads
        )
          ? data.qualifiedLeads
          : [];

      setLeads(discovered);

      setLeadResults(
        processed
      );

      setQualifiedLeads(
        qualified
      );
      setSearchWarnings(
        Array.isArray(data?.discovery?.warnings)
          ? data.discovery.warnings
          : []
      );
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Discovery failed. Please try again.";

      setError(message);

      setLeads([]);
      setLeadResults([]);
      setQualifiedLeads([]);
    } finally {
      setLoading(false);
    }
  }

  /*
   * IMPORTANT:
   *
   * Use leadResults here, NOT qualifiedLeads.
   *
   * qualifiedLeads only contains status="qualified".
   * A lead with status="review" still has perfectly
   * valid relevance/qualification intelligence.
   */
  function getQualifiedData(
    lead: Lead
  ): QualifiedLead | null {
    return (
      leadResults.find(
        (item) =>
          item.lead.companyName ===
          lead.companyName
      ) ?? null
    );
  }

  function getRelevanceScore(
    lead: Lead
  ): number | null {
    const result =
      getQualifiedData(
        lead
      );

    const score =
      result?.relevance?.score;

    return typeof score ===
      "number"
      ? score
      : null;
  }

  function getQualificationScore(
    lead: Lead
  ): number | null {
    const result =
      getQualifiedData(
        lead
      );

    const score =
      result?.qualification?.score;

    return typeof score ===
      "number"
      ? score
      : null;
  }

  function getVerificationTone(
    status?: string | null
  ): string {
    switch (status) {
      case "verified":
        return "text-emerald-400 border-emerald-500/20 bg-emerald-500/5";
      case "partially_verified":
        return "text-amber-400 border-amber-500/20 bg-amber-500/5";
      case "unverified":
        return "text-orange-400 border-orange-500/20 bg-orange-500/5";
      case "rejected":
        return "text-red-400 border-red-500/20 bg-red-500/5";
      default:
        return "text-gray-400 border-white/10 bg-white/5";
    }
  }

  function formatStatus(
    status?: string | null
  ): string {
    if (!status) {
      return "Not found";
    }

    return status
      .replaceAll("_", " ")
      .replace(/\b\w/g, (character) =>
        character.toUpperCase()
      );
  }

  return (
    <main className="min-h-screen bg-[#07080c] text-white">

      {/* Header */}
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-[1470px] items-center justify-between px-6 py-6 lg:px-16">

          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              SoleTrust{" "}
              <span className="text-indigo-400">
                AutoRadar
              </span>
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              Lead intelligence &
              qualification engine
            </p>
          </div>

          <div className="rounded-full border border-emerald-500/30 bg-emerald-500/5 px-4 py-2 text-sm text-emerald-400">
            System Online
          </div>

        </div>
      </header>

      <div className="mx-auto max-w-[1470px] px-6 py-10 lg:px-16">

        {/* Search Card */}
        <section className="rounded-2xl border border-white/10 bg-[#0d0f15] p-8 shadow-2xl">

          <div className="mb-8">
            <h2 className="text-3xl font-bold">
              Find businesses
            </h2>

            <p className="mt-2 text-gray-500">
              Discover businesses and
              automatically analyze their
              digital presence.
            </p>
          </div>

          <form
            onSubmit={handleSearch}
            className="grid grid-cols-1 gap-5 lg:grid-cols-4"
          >

            {/* Provider */}
            <div>
              <label className="mb-2 block text-sm text-gray-400">
                Provider
              </label>

              <select
                value={provider}
                onChange={(event) =>
                  setProvider(
                    event.target
                      .value as Provider
                  )
                }
                disabled={loading}
                className="h-14 w-full rounded-xl border border-white/10 bg-[#171922] px-4 text-white outline-none transition focus:border-indigo-500"
              >
                <option value="overpass">
                  Real Businesses
                </option>

                <option value="development">
                  Development Test
                </option>

                <option value="openstreetmap">
                  OpenStreetMap
                </option>

                <option value="searxng">
                  Web Search (SearXNG)
                </option>
              </select>
            </div>

            {/* Industry */}
            <div>
              <label className="mb-2 block text-sm text-gray-400">
                Industry
              </label>

              <input
                value={industry}
                onChange={(event) =>
                  setIndustry(
                    event.target.value
                  )
                }
                disabled={loading}
                placeholder="e.g. dentists"
                className="h-14 w-full rounded-xl border border-white/10 bg-[#171922] px-4 text-white outline-none transition placeholder:text-gray-600 focus:border-indigo-500"
              />
            </div>

            {/* City */}
            <div>
              <label className="mb-2 block text-sm text-gray-400">
                City
              </label>

              <input
                value={city}
                onChange={(event) =>
                  setCity(
                    event.target.value
                  )
                }
                disabled={loading}
                placeholder="e.g. Mumbai"
                className="h-14 w-full rounded-xl border border-white/10 bg-[#171922] px-4 text-white outline-none transition placeholder:text-gray-600 focus:border-indigo-500"
              />
            </div>

            {/* Country */}
            <div>
              <label className="mb-2 block text-sm text-gray-400">
                Country
              </label>

              <input
                value={country}
                onChange={(event) =>
                  setCountry(
                    event.target.value
                  )
                }
                disabled={loading}
                placeholder="e.g. India"
                className="h-14 w-full rounded-xl border border-white/10 bg-[#171922] px-4 text-white outline-none transition placeholder:text-gray-600 focus:border-indigo-500"
              />
            </div>

            {/* Service */}
            <div>
              <label className="mb-2 block text-sm text-gray-400">
                Service fit
              </label>

              <select
                value={serviceTrack}
                onChange={(event) =>
                  setServiceTrack(
                    event.target.value
                  )
                }
                disabled={loading}
                className="h-14 w-full rounded-xl border border-white/10 bg-[#171922] px-4 text-white outline-none transition focus:border-indigo-500"
              >
                <option value="both">
                  Creative + Technical
                </option>

                <option value="creative">
                  Creative
                </option>

                <option value="technical">
                  Technical
                </option>
              </select>
            </div>

            {/* Limit */}
            <div>
              <label className="mb-2 block text-sm text-gray-400">
                Lead limit
              </label>

              <select
                value={limit}
                onChange={(event) =>
                  setLimit(
                    event.target.value
                  )
                }
                disabled={loading}
                className="h-14 w-full rounded-xl border border-white/10 bg-[#171922] px-4 text-white outline-none transition focus:border-indigo-500"
              >
                <option value="5">
                  5
                </option>

                <option value="10">
                  10
                </option>

                <option value="20">
                  20
                </option>

                <option value="30">
                  30
                </option>

                <option value="50">
                  50
                </option>
              </select>
            </div>

            {/* Search button */}
            <div className="lg:col-span-2 flex items-end">
              <button
                type="submit"
                disabled={loading}
                className="h-14 w-full rounded-xl bg-indigo-600 px-6 font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading
                  ? "Scanning businesses..."
                  : "Find Leads"}
              </button>
            </div>

          </form>
        </section>

        {/* Error */}
        {error && (
          <div className="mt-6 rounded-xl border border-red-500/30 bg-red-950/30 px-6 py-5 text-red-400">
            <div className="font-semibold">
              {error}
            </div>
          </div>
        )}

        {/* Results */}
        {hasSearched &&
          !loading &&
          leads.length > 0 && (
            <section className="mt-10">

              {/* Results header */}
              <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">

                <div>
                  <p className="text-sm uppercase tracking-widest text-indigo-400">
                    Discovery Results
                  </p>

                  <h2 className="mt-2 text-3xl font-bold">
                    {leads.length} businesses
                    found
                  </h2>

                  <p className="mt-2 text-gray-500">
                    Qualified:{" "}
                    <span className="text-white">
                      {qualifiedLeads.length}
                    </span>
                  </p>
                </div>

                <div className="rounded-xl border border-white/10 bg-[#0d0f15] px-5 py-3 text-sm text-gray-400">
                  Source:{" "}
                  <span className="text-white">
                    {provider ===
                    "overpass"
                      ? "OpenStreetMap / Overpass"
                      : provider}
                  </span>
                </div>

              </div>

              {/* Lead grid */}
              <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">

                {leads.map(
                  (
                    lead,
                    index
                  ) => {

                    const intelligence =
                      getQualifiedData(
                        lead
                      );

                    const relevance =
                      getRelevanceScore(
                        lead
                      );

                    const qualification =
                      getQualificationScore(
                        lead
                      );

                    const emailAddresses =
                      Array.from(
                        new Set(
                          [
                            ...(intelligence?.contactIntelligence?.emails ?? []).map(
                              (email) =>
                                email.normalized ||
                                email.value
                            ),
                            intelligence?.enrichment?.contact?.email,
                          ].filter(
                            (value): value is string =>
                              Boolean(value)
                          )
                        )
                      );

                    const phoneNumbers =
                      Array.from(
                        new Set(
                          [
                            ...(intelligence?.contactIntelligence?.phones ?? []).map(
                              (phone) =>
                                phone.display ||
                                phone.normalized ||
                                phone.raw
                            ),
                            intelligence?.enrichment?.contact?.phone,
                          ].filter(
                            (value): value is string =>
                              Boolean(value)
                          )
                        )
                      );

                    const linkedinUrl =
                      intelligence?.contactIntelligence?.socialProfiles?.find(
                        (profile) =>
                          profile.platform ===
                          "linkedin"
                      )?.url ??
                      intelligence?.enrichment?.contact?.linkedinUrl ??
                      lead.linkedinUrl ??
                      (intelligence?.contactIntelligence?.decisionMaker?.profileUrl?.includes(
                        "linkedin.com"
                      )
                        ? intelligence.contactIntelligence.decisionMaker.profileUrl
                        : null);

                    const contactPage =
                      intelligence?.enrichment?.contact?.contactPage;

                    return (
                      <article
                        key={`${lead.companyName}-${index}`}
                        className="rounded-2xl border border-white/10 bg-[#0d0f15] p-6 transition hover:border-indigo-500/40"
                      >

                        {/* Top */}
                        <div className="flex items-start justify-between gap-4">

                          <div className="min-w-0">

                            <h3 className="truncate text-xl font-bold">
                              {lead.companyName}
                            </h3>

                            <p className="mt-1 text-sm text-gray-500">
                              {[
                                lead.industry,
                                lead.city,
                                lead.country,
                              ]
                                .filter(
                                  Boolean
                                )
                                .join(
                                  " · "
                                )}
                            </p>

                          </div>

                          {relevance !==
                            null && (
                            <div className="shrink-0 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 py-2 text-center">

                              <div className="text-lg font-bold text-indigo-400">
                                {relevance}
                              </div>

                              <div className="text-[10px] uppercase tracking-wider text-gray-500">
                                relevance
                              </div>

                            </div>
                          )}

                        </div>

                        {/* Website */}
                        {lead.website && (
                          <div className="mt-5 rounded-xl border border-white/5 bg-black/20 p-4">

                            <div className="text-xs uppercase tracking-wider text-gray-600">
                              Website
                            </div>

                            <a
                              href={
                                lead.website
                              }
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-1 block truncate text-sm text-indigo-400 hover:text-indigo-300"
                            >
                              {lead.website}
                            </a>

                          </div>
                        )}

                        {/* Scores */}
                        <div className="mt-5 grid grid-cols-2 gap-3">

                          <div className="rounded-xl border border-white/5 bg-[#151720] p-4">

                            <div className="text-xs text-gray-500">
                              Relevance
                            </div>

                            <div className="mt-1 text-2xl font-bold">
                              {relevance ??
                                "—"}
                            </div>

                          </div>

                          <div className="rounded-xl border border-white/5 bg-[#151720] p-4">

                            <div className="text-xs text-gray-500">
                              Qualification
                            </div>

                            <div className="mt-1 text-2xl font-bold">
                              {qualification ??
                                "—"}
                            </div>

                          </div>

                        </div>

                        {/* Contact details */}
                        <div className="mt-5 rounded-xl border border-white/5 bg-black/20 p-4">
                          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                            <div className="text-xs uppercase tracking-wider text-gray-500">
                              Public contact details
                            </div>

                            {intelligence?.contactIntelligence?.verificationStatus && (
                              <span
                                className={`rounded-full border px-2 py-1 text-[10px] ${getVerificationTone(
                                  intelligence.contactIntelligence.verificationStatus
                                )}`}
                              >
                                {formatStatus(
                                  intelligence.contactIntelligence.verificationStatus
                                )}
                              </span>
                            )}
                          </div>

                          <div className="space-y-2 text-sm">
                            {emailAddresses.map((email) => (
                              <a
                                key={email}
                                href={`mailto:${email}`}
                                className="block break-all text-emerald-400 hover:text-emerald-300"
                              >
                                Email: {email}
                              </a>
                            ))}

                            {phoneNumbers.map((phone) => (
                              <a
                                key={phone}
                                href={`tel:${phone.replace(/[^\d+]/g, "")}`}
                                className="block text-sky-300 hover:text-sky-200"
                              >
                                Phone: {phone}
                              </a>
                            ))}

                            {linkedinUrl && (
                              <a
                                href={linkedinUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block break-all text-blue-300 hover:text-blue-200"
                              >
                                LinkedIn profile
                              </a>
                            )}

                            {contactPage && (
                              <a
                                href={contactPage}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block text-gray-300 hover:text-white"
                              >
                                Contact page
                              </a>
                            )}

                            {emailAddresses.length === 0 &&
                              phoneNumbers.length === 0 &&
                              !linkedinUrl &&
                              !contactPage && (
                                <p className="text-sm text-gray-500">
                                  No public email, phone, or LinkedIn was found.
                                </p>
                              )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="mt-6 flex gap-3">

                          <button
                            type="button"
                            onClick={() =>
                              setSelectedLead(
                                intelligence
                              )
                            }
                            disabled={
                              !intelligence
                            }
                            className="flex-1 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-30"
                          >
                            View Intelligence
                          </button>

                          {lead.sourceUrl && (
                            <a
                              href={
                                lead.sourceUrl
                              }
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded-xl border border-white/10 px-4 py-3 text-sm text-gray-400 transition hover:border-white/20 hover:text-white"
                            >
                              Source
                            </a>
                          )}

                        </div>

                      </article>
                    );
                  }
                )}

              </div>
            </section>
          )}

        {/* Empty state */}
        {hasSearched &&
          !loading &&
          !error &&
          leads.length === 0 && (
            <div className="mt-10 rounded-2xl border border-white/10 bg-[#0d0f15] p-8">

              <h2 className="text-lg font-semibold">
                Search completed
              </h2>

              <p className="mt-2 text-sm text-gray-400">
                No businesses passed identity and relevance checks for {city || "the selected location"}. Try a different discovery source, industry, or city spelling.
              </p>

              {searchWarnings.length > 0 && (
                <ul className="mt-4 space-y-1 text-sm text-amber-300">
                  {searchWarnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              )}

            </div>
          )}

      </div>

      {/* Intelligence modal */}
      {selectedLead && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5 backdrop-blur-sm"
          onClick={() =>
            setSelectedLead(null)
          }
        >

          <div
            className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-white/10 bg-[#0d0f15] p-7 shadow-2xl"
            onClick={(event) =>
              event.stopPropagation()
            }
          >

            <div className="flex items-start justify-between gap-5">

              <div>

                <p className="text-xs uppercase tracking-widest text-indigo-400">
                  Lead Intelligence
                </p>

                <h2 className="mt-2 text-2xl font-bold">
                  {
                    selectedLead
                      .lead
                      .companyName
                  }
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  {[
                    selectedLead.lead
                      .industry,
                    selectedLead.lead
                      .city,
                    selectedLead.lead
                      .country,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>

              </div>

              <button
                type="button"
                onClick={() =>
                  setSelectedLead(null)
                }
                className="rounded-lg border border-white/10 px-3 py-2 text-gray-400 hover:text-white"
              >
                Close
              </button>

            </div>

            {/* Score */}
            <div className="mt-7 grid grid-cols-2 gap-4">

              <div className="rounded-xl border border-white/10 bg-[#151720] p-5">

                <div className="text-sm text-gray-500">
                  Relevance
                </div>

                <div className="mt-1 text-3xl font-bold text-indigo-400">
                  {selectedLead
                    .relevance
                    ?.score ??
                    "—"}
                </div>

                <div className="mt-1 text-xs text-gray-600">
                  {selectedLead
                    .relevance
                    ?.status ??
                    "unknown"}
                </div>

              </div>

              <div className="rounded-xl border border-white/10 bg-[#151720] p-5">

                <div className="text-sm text-gray-500">
                  Qualification
                </div>

                <div className="mt-1 text-3xl font-bold">
                  {selectedLead
                    .qualification
                    ?.score ??
                    "—"}
                </div>

                <div className="mt-1 text-xs text-gray-600">
                  {selectedLead
                    .qualification
                    ?.status ??
                    "unknown"}
                </div>

              </div>

            </div>

            {/* Website intelligence */}
            <div className="mt-7">

              <h3 className="text-lg font-semibold">
                Website intelligence
              </h3>

              <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-5">

                {selectedLead
                  .websiteIntelligence ? (
                  <>

                    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">

                      <Metric
                        label="Reachable"
                        value={
                          selectedLead
                            .websiteIntelligence
                            .reachable
                            ? "Yes"
                            : "No"
                        }
                      />

                      <Metric
                        label="HTTPS"
                        value={
                          selectedLead
                            .websiteIntelligence
                            .hasHttps
                            ? "Yes"
                            : "No"
                        }
                      />

                      <Metric
                        label="Contact page"
                        value={
                          selectedLead
                            .websiteIntelligence
                            .hasContactPage
                            ? "Yes"
                            : "No"
                        }
                      />

                      <Metric
                        label="CTA"
                        value={
                          selectedLead
                            .websiteIntelligence
                            .hasCallToAction
                            ? "Yes"
                            : "No"
                        }
                      />

                    </div>

                    {selectedLead
                      .websiteIntelligence
                      .signals &&
                      selectedLead
                        .websiteIntelligence
                        .signals
                        .length >
                        0 && (
                        <div className="mt-5">

                          <p className="mb-2 text-xs uppercase tracking-wider text-gray-600">
                            Signals
                          </p>

                          <div className="flex flex-wrap gap-2">

                            {selectedLead
                              .websiteIntelligence
                              .signals.map(
                                (
                                  signal
                                ) => (
                                  <span
                                    key={
                                      signal
                                    }
                                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-gray-400"
                                  >
                                    {
                                      signal
                                    }
                                  </span>
                                )
                              )}

                          </div>
                        </div>
                      )}

                  </>
                ) : (
                  <p className="text-sm text-gray-500">
                    No website intelligence
                    available for this
                    business.
                  </p>
                )}

              </div>
            </div>

            {/* Qualification signals */}
            {selectedLead
              .qualification
              ?.signals &&
              selectedLead
                .qualification
                .signals
                .length > 0 && (
                <div className="mt-7">

                  <h3 className="text-lg font-semibold">
                    Qualification signals
                  </h3>

                  <div className="mt-3 space-y-2">

                    {selectedLead
                      .qualification
                      .signals.map(
                        (
                          signal,
                          index
                        ) => (
                          <div
                            key={
                              signal.id ??
                              index
                            }
                            className="rounded-xl border border-white/10 bg-black/20 p-4"
                          >

                            <div className="flex items-center justify-between gap-4">

                              <span className="text-sm font-medium">
                                {
                                  signal.label
                                }
                              </span>

                              <span className="text-sm text-emerald-400">
                                {signal.points !==
                                undefined
                                  ? signal.points >=
                                    0
                                    ? `+${signal.points}`
                                    : signal.points
                                  : ""}
                              </span>

                            </div>

                            {signal.evidence && (
                              <p className="mt-1 text-xs text-gray-500">
                                {
                                  signal.evidence
                                }
                              </p>
                            )}

                          </div>
                        )
                      )}

                  </div>
                </div>
              )}

            {/* Relevance reasons */}
            {selectedLead
              .relevance
              ?.reasons &&
              selectedLead
                .relevance
                .reasons
                .length > 0 && (
                <div className="mt-7">

                  <h3 className="text-lg font-semibold">
                    Why this lead matched
                  </h3>

                  <div className="mt-3 space-y-2">

                    {selectedLead
                      .relevance
                      .reasons.map(
                        (
                          reason
                        ) => (
                          <div
                            key={
                              reason
                            }
                            className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-gray-400"
                          >
                            {reason}
                          </div>
                        )
                      )}

                  </div>
                </div>
              )}

            {/* Contact intelligence */}
            <div className="mt-7">
              <div className="flex items-center justify-between gap-4">
                <h3 className="text-lg font-semibold">
                  Contact intelligence
                </h3>

                {selectedLead.contactIntelligence && (
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-medium ${getVerificationTone(
                      selectedLead.contactIntelligence
                        .verificationStatus
                    )}`}
                  >
                    {formatStatus(
                      selectedLead.contactIntelligence
                        .verificationStatus
                    )}
                  </span>
                )}
              </div>

              {selectedLead.contactIntelligence ? (
                <>
                  <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
                    <Metric
                      label="Contactability"
                      value={
                        selectedLead.contactIntelligence
                          .contactabilityScore !== undefined
                          ? `${selectedLead.contactIntelligence.contactabilityScore}/100`
                          : "—"
                      }
                    />
                    <Metric
                      label="Data confidence"
                      value={
                        selectedLead.contactIntelligence
                          .dataConfidenceScore !== undefined
                          ? `${selectedLead.contactIntelligence.dataConfidenceScore}/100`
                          : "—"
                      }
                    />
                    <Metric
                      label="Phones"
                      value={`${selectedLead.contactIntelligence.phones?.length ?? 0}`}
                    />
                    <Metric
                      label="Emails"
                      value={`${selectedLead.contactIntelligence.emails?.length ?? 0}`}
                    />
                  </div>

                  <div className="mt-5 rounded-xl border border-white/10 bg-black/20 p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-wider text-gray-600">
                          Decision maker
                        </p>
                        <h4 className="mt-1 text-xl font-semibold">
                          {selectedLead.contactIntelligence
                            .decisionMaker?.name ||
                            "Not found"}
                        </h4>
                        {selectedLead.contactIntelligence
                          .decisionMaker?.roleLabel && (
                          <p className="mt-1 text-sm text-gray-400">
                            {
                              selectedLead.contactIntelligence
                                .decisionMaker.roleLabel
                            }
                          </p>
                        )}
                      </div>

                      {selectedLead.contactIntelligence
                        .decisionMaker && (
                        <span
                          className={`rounded-full border px-3 py-1 text-xs ${getVerificationTone(
                            selectedLead.contactIntelligence
                              .decisionMaker
                              .verificationStatus
                          )}`}
                        >
                          {formatStatus(
                            selectedLead.contactIntelligence
                              .decisionMaker
                              .verificationStatus
                          )}
                        </span>
                      )}
                    </div>

                    {selectedLead.contactIntelligence
                      .decisionMaker?.profileUrl && (
                      <a
                        href={
                          selectedLead.contactIntelligence
                            .decisionMaker.profileUrl
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-4 block break-all text-sm text-indigo-400 hover:text-indigo-300"
                      >
                        {
                          selectedLead.contactIntelligence
                            .decisionMaker.profileUrl
                        }
                      </a>
                    )}

                    {selectedLead.contactIntelligence
                      .decisionMaker?.reason && (
                      <p className="mt-4 text-sm leading-6 text-gray-400">
                        {
                          selectedLead.contactIntelligence
                            .decisionMaker.reason
                        }
                      </p>
                    )}
                  </div>

                  <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
                    {(selectedLead.contactIntelligence
                      .emails ?? []
                    ).map((email, index) => (
                      <ContactIntelligenceCard
                        key={`email-${email.normalized ?? index}`}
                        label="Business email"
                        value={
                          email.normalized ||
                          email.value ||
                          null
                        }
                        status={email.verificationStatus}
                        confidence={email.confidence}
                        sourceUrl={email.sourceUrl}
                      />
                    ))}

                    {(selectedLead.contactIntelligence
                      .phones ?? []
                    ).map((phone, index) => (
                      <ContactIntelligenceCard
                        key={`phone-${phone.normalized ?? index}`}
                        label={
                          phone.type === "mobile"
                            ? "Mobile phone"
                            : "Business phone"
                        }
                        value={
                          phone.display ||
                          phone.normalized ||
                          phone.raw ||
                          null
                        }
                        status={phone.verificationStatus}
                        confidence={phone.confidence}
                        sourceUrl={phone.sourceUrl}
                      />
                    ))}

                    {(selectedLead.contactIntelligence
                      .socialProfiles ?? []
                    ).map((profile, index) => (
                      <ContactIntelligenceCard
                        key={`social-${profile.url ?? index}`}
                        label={
                          profile.platform
                            ? profile.platform
                                .charAt(0)
                                .toUpperCase() +
                              profile.platform.slice(1)
                            : "Social profile"
                        }
                        value={profile.url}
                        status={profile.verificationStatus}
                        confidence={profile.confidence}
                        sourceUrl={profile.sourceUrl}
                      />
                    ))}
                  </div>

                  {selectedLead.contactIntelligence
                    .warnings &&
                    selectedLead.contactIntelligence
                      .warnings.length > 0 && (
                      <div className="mt-5 rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">
                        <p className="text-xs uppercase tracking-wider text-amber-500/70">
                          Research warnings
                        </p>
                        <div className="mt-3 space-y-2">
                          {selectedLead.contactIntelligence
                            .warnings.map(
                              (warning, index) => (
                                <p
                                  key={`${warning}-${index}`}
                                  className="text-sm leading-6 text-amber-200/70"
                                >
                                  {warning}
                                </p>
                              )
                            )}
                        </div>
                      </div>
                    )}
                </>
              ) : (
                <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-5">
                  <p className="text-sm text-gray-500">
                    No contact intelligence was returned for this business.
                  </p>
                </div>
              )}
            </div>

            {/* Website contact signals */}
            {selectedLead.enrichment?.contact && (
              <div className="mt-7">
                <h3 className="text-lg font-semibold">
                  Website contact signals
                </h3>

                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <ContactField
                    label="Email"
                    value={selectedLead.enrichment.contact.email}
                  />
                  <ContactField
                    label="Phone"
                    value={selectedLead.enrichment.contact.phone}
                  />
                  <ContactField
                    label="WhatsApp"
                    value={selectedLead.enrichment.contact.whatsapp}
                  />
                  <ContactField
                    label="Contact page"
                    value={selectedLead.enrichment.contact.contactPage}
                  />
                  <ContactField
                    label="LinkedIn"
                    value={selectedLead.enrichment.contact.linkedinUrl}
                  />
                  <ContactField
                    label="Instagram"
                    value={selectedLead.enrichment.contact.instagramUrl}
                  />
                </div>
              </div>
            )}

            {/* Evidence */}
            <div className="mt-7">
              <h3 className="text-lg font-semibold">
                Evidence
              </h3>

              <div className="mt-3 space-y-3">
                {(
                  selectedLead.contactIntelligence?.evidence ??
                  selectedLead.evidence ??
                  []
                ).length > 0 ? (
                  (
                    selectedLead.contactIntelligence?.evidence ??
                    selectedLead.evidence ??
                    []
                  ).map((item, index) => (
                    <div
                      key={`${item.field ?? "evidence"}-${item.value ?? index}-${index}`}
                      className="rounded-xl border border-white/10 bg-black/20 p-4"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] uppercase tracking-wider text-gray-400">
                          {item.field || "evidence"}
                        </span>

                        {item.verified !== undefined && (
                          <span
                            className={`rounded-full border px-2.5 py-1 text-[11px] ${getVerificationTone(
                              item.verified
                                ? "verified"
                                : "unverified"
                            )}`}
                          >
                            {item.verified
                              ? "Verified"
                              : "Not independently verified"}
                          </span>
                        )}

                        {item.confidence && (
                          <span className="text-[11px] text-gray-600">
                            confidence: {item.confidence}
                          </span>
                        )}
                      </div>

                      {item.value && (
                        <p className="mt-3 break-all text-sm text-gray-200">
                          {item.value}
                        </p>
                      )}

                      {item.evidenceText && (
                        <p className="mt-2 text-sm leading-6 text-gray-500">
                          {item.evidenceText}
                        </p>
                      )}

                      {item.sourceUrl && (
                        <a
                          href={item.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-3 block break-all text-xs text-indigo-400 hover:text-indigo-300"
                        >
                          {item.sourceUrl}
                        </a>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border border-white/10 bg-black/20 p-5">
                    <p className="text-sm text-gray-500">
                      No contact evidence was returned.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Links */}
            <div className="mt-7 flex flex-wrap gap-3">

              {selectedLead.lead
                .website && (
                <a
                  href={
                    selectedLead.lead
                      .website
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black hover:bg-gray-200"
                >
                  Open Website
                </a>
              )}

              {selectedLead.lead
                .instagramUrl && (
                <a
                  href={
                    selectedLead.lead
                      .instagramUrl
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl border border-white/10 px-4 py-3 text-sm text-gray-400 hover:text-white"
                >
                  Instagram
                </a>
              )}

              {selectedLead.lead
                .linkedinUrl && (
                <a
                  href={
                    selectedLead.lead
                      .linkedinUrl
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl border border-white/10 px-4 py-3 text-sm text-gray-400 hover:text-white"
                >
                  LinkedIn
                </a>
              )}

              {selectedLead.lead
                .sourceUrl && (
                <a
                  href={
                    selectedLead.lead
                      .sourceUrl
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl border border-white/10 px-4 py-3 text-sm text-gray-400 hover:text-white"
                >
                  Source
                </a>
              )}

            </div>

          </div>
        </div>
      )}

    </main>
  );
}

/* -------------------------------------------------------------------------- */
/* Small UI components                                                        */
/* -------------------------------------------------------------------------- */

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <div className="text-xs text-gray-600">
        {label}
      </div>

      <div className="mt-1 text-sm font-semibold text-white">
        {value}
      </div>
    </div>
  );
}

function ContactIntelligenceCard({
  label,
  value,
  status,
  confidence,
  sourceUrl,
}: {
  label: string;
  value?: string | null;
  status?: string | null;
  confidence?: string | null;
  sourceUrl?: string | null;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs uppercase tracking-wider text-gray-600">
          {label}
        </div>

        {status && (
          <span
            className={`rounded-full border px-2.5 py-1 text-[10px] ${getVerificationTone(
              status
            )}`}
          >
            {formatStatus(status)}
          </span>
        )}
      </div>

      <div className="mt-2 break-all text-sm text-gray-200">
        {value || "Not found"}
      </div>

      {confidence && (
        <div className="mt-2 text-[11px] text-gray-600">
          Confidence: {confidence}
        </div>
      )}

      {sourceUrl && (
        <a
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 block truncate text-xs text-indigo-400 hover:text-indigo-300"
        >
          Source
        </a>
      )}
    </div>
  );
}

function ContactField({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-4">

      <div className="text-xs text-gray-600">
        {label}
      </div>

      <div className="mt-1 break-all text-sm text-gray-300">
        {value || "Not found"}
      </div>

    </div>
  );
}
import type {
  QualificationInput,
  QualificationSignal,
} from "./types";

export function evaluateQualification(
  input: QualificationInput
): QualificationSignal[] {
  const { lead, website } = input;
  const signals: QualificationSignal[] = [];

  /*
   * WEBSITE / OPPORTUNITY SIGNALS
   *
   * These are positive because they identify potential work
   * for SoleTrust Media.
   */

  if (website?.reachable) {
    signals.push({
      id: "website_reachable",
      label: "Website is reachable",
      points: 5,
      type: "positive",
      evidence: `HTTP ${website.statusCode ?? "unknown"}`,
    });
  }

  if (website?.hasHttps === false) {
    signals.push({
      id: "no_https",
      label: "Website does not use HTTPS",
      points: 15,
      type: "positive",
      evidence: "Public website was detected without HTTPS.",
    });
  }

  if (website?.hasContactPage === false) {
    signals.push({
      id: "no_contact_page",
      label: "No obvious contact page detected",
      points: 10,
      type: "positive",
      evidence: "Website links did not contain an obvious contact page.",
    });
  }

  if (website?.hasCallToAction === false) {
    signals.push({
      id: "weak_cta",
      label: "No obvious call-to-action detected",
      points: 10,
      type: "positive",
      evidence: "No common CTA language was detected.",
    });
  }

  if (website?.signals.includes("missing_title")) {
    signals.push({
      id: "missing_title",
      label: "Missing page title",
      points: 8,
      type: "positive",
      evidence: "The website does not expose a clear page title.",
    });
  }

  if (website?.signals.includes("missing_meta_description")) {
    signals.push({
      id: "missing_meta_description",
      label: "Missing meta description",
      points: 6,
      type: "positive",
      evidence: "The website does not expose a clear meta description.",
    });
  }

  if (website?.signals.includes("no_detected_social_links")) {
    signals.push({
      id: "missing_social_links",
      label: "No social links detected",
      points: 5,
      type: "positive",
      evidence: "No public social links were detected on the website.",
    });
  }

  /*
   * BUSINESS IDENTITY SIGNALS
   *
   * These are stronger than individual website-quality signals.
   */

  if (lead.companyName.trim()) {
    signals.push({
      id: "known_company",
      label: "Business identity identified",
      points: 10,
      type: "positive",
      evidence: lead.companyName,
    });
  }

  if (lead.website) {
    signals.push({
      id: "has_website",
      label: "Business has a website",
      points: 8,
      type: "positive",
      evidence: lead.website,
    });
  }

  if (lead.industry) {
    signals.push({
      id: "known_industry",
      label: "Industry identified",
      points: 8,
      type: "positive",
      evidence: lead.industry,
    });
  }

  if (lead.city) {
    signals.push({
      id: "known_location",
      label: "Business location identified",
      points: 5,
      type: "positive",
      evidence: lead.city,
    });
  }

  if (lead.country) {
    signals.push({
      id: "known_country",
      label: "Business country identified",
      points: 3,
      type: "positive",
      evidence: lead.country,
    });
  }

  /*
   * SERVICE FIT
   *
   * These signals indicate that the business matches
   * one or both SoleTrust Media service tracks.
   */

  if (lead.serviceTrack === "creative") {
    signals.push({
      id: "creative_fit",
      label: "Creative service fit",
      points: 12,
      type: "positive",
      evidence: "Business matches the creative service track.",
    });
  }

  if (lead.serviceTrack === "technical") {
    signals.push({
      id: "technical_fit",
      label: "Technical service fit",
      points: 12,
      type: "positive",
      evidence: "Business matches the technical service track.",
    });
  }

  if (lead.serviceTrack === "both") {
    signals.push({
      id: "dual_service_fit",
      label: "Creative + technical service fit",
      points: 20,
      type: "positive",
      evidence: "Business matches both SoleTrust Media service tracks.",
    });
  }

  /*
   * CONTACT / DISCOVERY SIGNALS
   */

  if (lead.linkedinUrl) {
    signals.push({
      id: "linkedin_present",
      label: "LinkedIn presence detected",
      points: 4,
      type: "positive",
      evidence: lead.linkedinUrl,
    });
  }

  if (lead.instagramUrl) {
    signals.push({
      id: "instagram_present",
      label: "Instagram presence detected",
      points: 4,
      type: "positive",
      evidence: lead.instagramUrl,
    });
  }

  if (lead.facebookUrl) {
    signals.push({
      id: "facebook_present",
      label: "Facebook presence detected",
      points: 3,
      type: "positive",
      evidence: lead.facebookUrl,
    });
  }

  /*
   * NEGATIVE IDENTITY SIGNALS
   */

  if (!lead.companyName.trim()) {
    signals.push({
      id: "missing_company_name",
      label: "Missing company name",
      points: -30,
      type: "negative",
      evidence: "No usable business name was found.",
    });
  }

  if (!lead.website && !lead.city) {
    signals.push({
      id: "weak_identity",
      label: "Limited company identification data",
      points: -15,
      type: "negative",
      evidence: "Neither a website nor a location was identified.",
    });
  }

  return signals;
}
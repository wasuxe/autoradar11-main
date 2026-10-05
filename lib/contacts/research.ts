import type { Lead } from "@/lib/leads/types";

import type { EnrichmentResult } from "@/lib/enrichment/types";

import { extractWebsiteContacts } from "@/lib/enrichment/website-contact";



import { researchDecisionMaker } from "./decision-maker";
import { discoverPublicWebDecisionMaker } from "./providers/public-web";

import { normalizePhone } from "./phone";

import {
  verifyEmail,
  verifyPhone,
  verifyLinkedIn,
  verifyInstagram,
  verifyPerson,
} from "./verification";

import type { PersonEvidence } from "./verification";



import type {

  BusinessEmail,

  BusinessPhone,

  ContactConfidence,

  ContactEvidence,

  ContactIntelligence,

  ContactVerificationStatus,

  DecisionMaker,

  SocialContact,

} from "./types";



/* =========================================================*

*   EMAIL*

*   ========================================================= */



function normalizeEmail(

  value: string | null | undefined

): string | null {

  if (!value) {

    return null;

  }



  const email = value.trim().toLowerCase();



  if (!email) {

    return null;

  }



  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {

    return null;

  }



  return email;

}



function getEmailType(

  email: string

): BusinessEmail["type"] {

  const localPart =

    email.split("@")[0]?.toLowerCase() ?? "";



  const genericPrefixes = new Set([

    "info",

    "hello",

    "contact",

    "support",

    "sales",

    "admin",

    "office",

    "enquiry",

    "inquiry",

    "marketing",

    "business",

    "care",

    "help",

    "team",

  ]);



  if (genericPrefixes.has(localPart)) {

    return "generic";

  }



  return "business";

}



/* =========================================================*

*   PHONE*

*   ========================================================= */



function buildPhone(

  value: string | null,

  sourceUrl: string | null,

  confidence: ContactConfidence

): BusinessPhone | null {

  if (!value) {

    return null;

  }



  const raw = value.trim();



  if (!raw) {

    return null;

  }



  const result = normalizePhone(raw);



  if (!result) {

    return null;

  }



  return {

    raw,



    normalized:

      result.normalized ?? null,



    display:

      result.display ?? raw,



    countryCode:

      result.countryCode ?? null,



    country:

      result.country ?? null,



    type:

      result.type ?? "unknown",



    sourceUrl,



    sourceType:

      "company_website",



    confidence,



    /**

*     \* We know the number was published by the source.*

*     \* We do NOT claim that it is currently reachable.*

*     */

    verificationStatus:

      "partially_verified",

  };

}



/* =========================================================*

*   EMAIL OBJECT*

*   ========================================================= */



function buildEmail(

  value: string | null,

  sourceUrl: string | null,

  confidence: ContactConfidence

): BusinessEmail | null {

  const normalized = normalizeEmail(value);



  if (!normalized) {

    return null;

  }



  return {

    value:

      value?.trim() ?? normalized,



    normalized,



    type:

      getEmailType(normalized),



    sourceUrl,



    sourceType:

      "company_website",



    confidence,



    verificationStatus:

      "partially_verified",

  };

}



/* =========================================================*

*   DEDUPE*

*   ========================================================= */



function dedupePhones(

  phones: BusinessPhone[]

): BusinessPhone[] {

  const seen = new Set<string>();

  const result: BusinessPhone[] = [];



  for (const phone of phones) {

    const key =

      phone.normalized ??

      phone.raw.replace(/\D/g, "");



    if (!key) {

      continue;

    }



    if (seen.has(key)) {

      continue;

    }



    seen.add(key);

    result.push(phone);

  }



  return result;

}



function dedupeEmails(

  emails: BusinessEmail[]

): BusinessEmail[] {

  const seen = new Set<string>();

  const result: BusinessEmail[] = [];



  for (const email of emails) {

    const key =

      email.normalized.toLowerCase();



    if (seen.has(key)) {

      continue;

    }



    seen.add(key);

    result.push(email);

  }



  return result;

}



/* =========================================================*

*   URL*

*   ========================================================= */



function normalizeUrl(

  value: string | null | undefined

): string | null {

  if (!value) {

    return null;

  }



  const raw = value.trim();



  if (!raw) {

    return null;

  }



  try {

    const url = new URL(

      raw.startsWith("http\://") ||

        raw.startsWith("https\://")

        ? raw

        : `https\://${raw}`

    );



    return url.toString();

  } catch {

    return null;

  }

}



/* =========================================================*

*   SOCIAL PLATFORM*

*   ========================================================= */



function detectSocialPlatform(

  url: string

): SocialContact["platform"] {

  const value = url.toLowerCase();



  if (value.includes("linkedin.com")) {

    return "linkedin";

  }



  if (

    value.includes("instagram.com") ||

    value.includes("instagr.am")

  ) {

    return "instagram";

  }



  if (

    value.includes("facebook.com") ||

    value.includes("fb.com")

  ) {

    return "facebook";

  }



  if (

    value.includes("twitter.com") ||

    value.includes("x.com")

  ) {

    return "x";

  }



  if (

    value.includes("youtube.com") ||

    value.includes("youtu.be")

  ) {

    return "youtube";

  }



  return "unknown";

}



/* =========================================================*

*   SOCIAL PROFILES*

*   ========================================================= */



function buildSocialProfiles(

  enrichment: EnrichmentResult | null,

  decisionMaker: DecisionMaker | null

): SocialContact[] {

  const candidates: Array<{

    url: string | null;

    sourceUrl: string | null;

    confidence: ContactConfidence;

    verificationStatus: ContactVerificationStatus;

  }> = [];



  if (enrichment?.contact.linkedinUrl) {

    candidates.push({

      url: enrichment.contact.linkedinUrl,

      sourceUrl:

        enrichment.contact.contactPage ??

        enrichment.website ??

        null,

      confidence: "medium",

      verificationStatus:

        "partially_verified",

    });

  }



  if (enrichment?.contact.instagramUrl) {

    candidates.push({

      url: enrichment.contact.instagramUrl,

      sourceUrl:

        enrichment.contact.contactPage ??

        enrichment.website ??

        null,

      confidence: "medium",

      verificationStatus:

        "partially_verified",

    });

  }



  if (enrichment?.contact.facebookUrl) {

    candidates.push({

      url: enrichment.contact.facebookUrl,

      sourceUrl:

        enrichment.contact.contactPage ??

        enrichment.website ??

        null,

      confidence: "medium",

      verificationStatus:

        "partially_verified",

    });

  }



  if (decisionMaker?.profileUrl) {

    candidates.push({

      url: decisionMaker.profileUrl,

      sourceUrl:

        decisionMaker.sourceUrl,

      confidence:

        decisionMaker.confidence,

      verificationStatus:

        decisionMaker.verificationStatus,

    });

  }



  const result: SocialContact[] = [];

  const seen = new Set<string>();



  for (const candidate of candidates) {

    const normalized =

      normalizeUrl(candidate.url);



    if (!normalized) {

      continue;

    }



    const key = normalized.toLowerCase();



    if (seen.has(key)) {

      continue;

    }



    seen.add(key);



    result.push({

      platform:

        detectSocialPlatform(normalized),



      url: normalized,



      sourceUrl:

        candidate.sourceUrl,



      confidence:

        candidate.confidence,



      verificationStatus:

        candidate.verificationStatus,

    });

  }



  return result;

}



/* =========================================================*

*   EVIDENCE*

*   ========================================================= */



function buildPhoneEvidence(

  phone: BusinessPhone

): ContactEvidence {

  return {

    field: "phone",



    value:

      phone.display ??

      phone.raw,



    sourceType:

      phone.sourceType,



    sourceUrl:

      phone.sourceUrl,



    confidence:

      phone.confidence,



    verified:

      phone.verificationStatus ===

      "verified",



    evidenceText:

      "Phone number was published by the business website/source. This does not confirm that the number is currently reachable.",

  };

}



function buildEmailEvidence(

  email: BusinessEmail

): ContactEvidence {

  return {

    field: "email",



    value:

      email.normalized,



    sourceType:

      email.sourceType,



    sourceUrl:

      email.sourceUrl,



    confidence:

      email.confidence,



    verified:

      email.verificationStatus ===

      "verified",



    evidenceText:

      "Email address was published by the business website/source.",

  };

}



function buildSocialEvidence(

  profile: SocialContact

): ContactEvidence | null {

  let field:

    | "linkedin"

    | "instagram";



  if (

    profile.platform ===

    "linkedin"

  ) {

    field = "linkedin";

  } else if (

    profile.platform ===

    "instagram"

  ) {

    field = "instagram";

  } else {

    return null;

  }



  return {

    field,



    value:

      profile.url,



    sourceType:

      profile.sourceUrl

        ? "company_website"

        : "unknown",



    sourceUrl:

      profile.sourceUrl,



    confidence:

      profile.confidence,



    verified:

      profile.verificationStatus ===

      "verified",



    evidenceText:

      "Public social/profile URL discovered from an allowed source.",

  };

}



/* =========================================================*

*   CONTACTABILITY SCORE*

*   ========================================================= */



function calculateContactabilityScore(
  decisionMaker: DecisionMaker | null,
  phones: BusinessPhone[],
  emails: BusinessEmail[],
  socialProfiles: SocialContact[],
): number {
  let score = 0;

  // Only a verified decision maker contributes.
  if (
    decisionMaker?.name &&
    decisionMaker.verificationStatus === "verified"
  ) {
    score += 35;
  }

  // Only independently verified phone numbers contribute.
  if (
    phones.some(
      (phone) => phone.verificationStatus === "verified",
    )
  ) {
    score += 25;
  }

  // Only independently verified email addresses contribute.
  if (
    emails.some(
      (email) => email.verificationStatus === "verified",
    )
  ) {
    score += 20;
  }

  // Only verified social/professional profiles contribute.
  if (
    socialProfiles.some(
      (profile) => profile.verificationStatus === "verified",
    )
  ) {
    score += 10;
  }

  return Math.min(100, score);
}



/* =========================================================*

*   DATA CONFIDENCE SCORE*

*   ========================================================= */



function calculateDataConfidenceScore(
  decisionMaker: DecisionMaker | null,
  phones: BusinessPhone[],
  emails: BusinessEmail[],
  socialProfiles: SocialContact[],
): number {
  let score = 0;

  /*
   * Decision maker
   * Confidence contributes only when the person has actually
   * passed verification.
   */
  if (
    decisionMaker?.verificationStatus === "verified"
  ) {
    if (decisionMaker.confidence === "high") {
      score += 40;
    } else if (decisionMaker.confidence === "medium") {
      score += 25;
    } else {
      score += 10;
    }
  }

  /*
   * Phone
   * Only verified phone numbers contribute to data confidence.
   */
  const verifiedPhone = phones.find(
    (phone) => phone.verificationStatus === "verified",
  );

  if (verifiedPhone) {
    if (verifiedPhone.confidence === "high") {
      score += 25;
    } else if (verifiedPhone.confidence === "medium") {
      score += 18;
    } else {
      score += 8;
    }
  }

  /*
   * Email
   * Only verified email addresses contribute to data confidence.
   */
  const verifiedEmail = emails.find(
    (email) => email.verificationStatus === "verified",
  );

  if (verifiedEmail) {
    if (verifiedEmail.confidence === "high") {
      score += 20;
    } else if (verifiedEmail.confidence === "medium") {
      score += 12;
    } else {
      score += 5;
    }
  }

  /*
   * Social profiles
   * Only verified profiles contribute.
   */
  const verifiedSocialProfiles = socialProfiles.filter(
    (profile) => profile.verificationStatus === "verified",
  );

  if (verifiedSocialProfiles.length > 0) {
    const hasVerifiedLinkedIn = verifiedSocialProfiles.some(
      (profile) => profile.platform === "linkedin",
    );

    score += hasVerifiedLinkedIn ? 15 : 5;
  }

  return Math.min(100, score);
}



/* =========================================================*

*   VERIFICATION STATUS*

*   ========================================================= */



function getVerificationStatus(

  decisionMaker: DecisionMaker | null,

  phones: BusinessPhone[],

  emails: BusinessEmail[],

  socialProfiles: SocialContact[]

): ContactVerificationStatus {

  const decisionMakerVerified =

    decisionMaker?.verificationStatus ===

    "verified";



  const phoneVerified =

    phones.some(

      (phone) =>

        phone.verificationStatus ===

        "verified"

    );



  const emailVerified =

    emails.some(

      (email) =>

        email.verificationStatus ===

        "verified"

    );



  const socialVerified =

    socialProfiles.some(

      (profile) =>

        profile.verificationStatus ===

        "verified"

    );



  if (

    decisionMakerVerified &&

    (

      phoneVerified ||

      emailVerified ||

      socialVerified

    )

  ) {

    return "verified";

  }



  if (

    decisionMaker ||

    phones.length > 0 ||

    emails.length > 0 ||

    socialProfiles.length > 0

  ) {

    return "partially_verified";

  }



  return "not_found";

}



/* =========================================================*

*   WARNINGS*

*   ========================================================= */



function buildWarnings(

  decisionMaker: DecisionMaker | null,

  phones: BusinessPhone[],

  emails: BusinessEmail[],

  socialProfiles: SocialContact[]

): string[] {

  const warnings: string[] = [];



  if (!decisionMaker) {

    warnings.push(

      "No decision maker was substantiated from the available allowed sources."

    );

  }



  if (phones.length === 0) {

    warnings.push(

      "No usable business phone number was found."

    );

  } else {

    const onlyPartial =

      phones.every(

        (phone) =>

          phone.verificationStatus !==

          "verified"

      );



    if (onlyPartial) {

      warnings.push(

        "Phone numbers were sourced from public business information but were not independently verified as currently reachable."

      );

    }

  }



  if (emails.length === 0) {

    warnings.push(

      "No business email address was found."

    );

  }



  const hasLinkedIn =

    socialProfiles.some(

      (profile) =>

        profile.platform ===

        "linkedin"

    );



  if (!hasLinkedIn) {

    warnings.push(

      "No LinkedIn profile was substantiated from the available allowed sources."

    );

  }



  return warnings;

}



/* =========================================================*

*   MAIN RESEARCH FUNCTION*

*   ========================================================= */




function mapPublicWebRoleToDecisionMakerRole(
  role: string | null,
): DecisionMaker["roleLabel"] {
  if (!role) {
    return "unknown" as DecisionMaker["roleLabel"];
  }

  const normalized = role.toLowerCase();

  if (normalized.includes("co-founder")) {
    return "co_founder" as DecisionMaker["roleLabel"];
  }

  if (normalized.includes("founder")) {
    return "founder" as DecisionMaker["roleLabel"];
  }

  if (normalized.includes("owner")) {
    return "owner" as DecisionMaker["roleLabel"];
  }

  if (normalized === "ceo") {
    return "ceo" as DecisionMaker["roleLabel"];
  }

  if (normalized === "coo") {
    return "coo" as DecisionMaker["roleLabel"];
  }

  if (normalized === "cmo") {
    return "cmo" as DecisionMaker["roleLabel"];
  }

  if (normalized.includes("marketing head")) {
    return "marketing_head" as DecisionMaker["roleLabel"];
  }

  if (normalized.includes("marketing manager")) {
    return "marketing_manager" as DecisionMaker["roleLabel"];
  }

  if (normalized.includes("brand head")) {
    return "brand_head" as DecisionMaker["roleLabel"];
  }

  if (normalized.includes("growth head")) {
    return "growth_head" as DecisionMaker["roleLabel"];
  }

  if (normalized.includes("operations head")) {
    return "operations_head" as DecisionMaker["roleLabel"];
  }

  if (normalized.includes("director")) {
    return "other" as DecisionMaker["roleLabel"];
  }

  return "unknown" as DecisionMaker["roleLabel"];
}

function publicWebSourceType(
  sourceUrl: string,
  sourceType: string,
): DecisionMaker["sourceType"] {
  const lowerUrl = sourceUrl.toLowerCase();

  if (lowerUrl.includes("linkedin.com/in/")) {
    return "public_professional_profile" as DecisionMaker["sourceType"];
  }

  if (lowerUrl.includes("instagram.com/")) {
    return "public_social_profile" as DecisionMaker["sourceType"];
  }

  if (sourceType === "official_company") {
    return "company_about" as DecisionMaker["sourceType"];
  }

  if (sourceType === "professional_profile") {
    return "public_professional_profile" as DecisionMaker["sourceType"];
  }

  return "unknown" as DecisionMaker["sourceType"];
}

function normalizeDecisionMakerName(
  value: string | null | undefined,
): string {
  return (
    value
      ?.toLowerCase()
      .replace(/^(mr|mrs|ms|dr|prof|sir)\.?\s+/i, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim() ?? ""
  );
}

function buildPublicWebDecisionMaker(
  lead: Lead,
  candidate: NonNullable<
    Awaited<
      ReturnType<typeof discoverPublicWebDecisionMaker>
    >
  >,
): DecisionMaker {
  const evidence: ContactEvidence[] = [
    {
      field: "name",
      value: candidate.name,
      sourceType: publicWebSourceType(
        candidate.sourceUrl,
        candidate.sourceType,
      ),
      sourceUrl: candidate.sourceUrl,
      confidence: candidate.discoveryConfidence,
      verified: false,
      evidenceText:
        candidate.evidence.join(" ") ||
        "Public-web source associates this person with the business.",
    },
  ];

  if (candidate.role) {
    evidence.push({
      field: "role",
      value: candidate.role,
      sourceType: publicWebSourceType(
        candidate.sourceUrl,
        candidate.sourceType,
      ),
      sourceUrl: candidate.sourceUrl,
      confidence: candidate.discoveryConfidence,
      verified: false,
      evidenceText:
        `Public-web source identifies ${candidate.name} as ${candidate.role} at ${lead.companyName}.`,
    });
  }

  if (candidate.profileUrl?.toLowerCase().includes("linkedin.com/in/")) {
    evidence.push({
      field: "linkedin",
      value: candidate.profileUrl,
      sourceType: "public_professional_profile",
      sourceUrl: candidate.profileUrl,
      confidence: candidate.discoveryConfidence,
      verified: false,
      evidenceText:
        "Public LinkedIn profile discovered during decision-maker research.",
    });
  }

  return {
    name: candidate.name,
    roleLabel: mapPublicWebRoleToDecisionMakerRole(
      candidate.role,
    ),
    profileUrl: candidate.profileUrl,
    sourceUrl: candidate.sourceUrl,
    sourceType: publicWebSourceType(
      candidate.sourceUrl,
      candidate.sourceType,
    ),
    confidence: candidate.discoveryConfidence,
    verificationStatus: "unverified",
    reason:
      `Discovered from public web research. ${candidate.evidence.join(" ")}`,
    evidence,
  } as DecisionMaker;
}

function mergePublicWebDecisionMaker(
  existing: DecisionMaker | null,
  candidate: NonNullable<
  Awaited<
    ReturnType<typeof discoverPublicWebDecisionMaker>
  >
>,
  lead: Lead,
): DecisionMaker | null {
  if (!candidate) {
    return existing;
  }

  if (!existing) {
    return buildPublicWebDecisionMaker(
      lead,
      candidate,
    );
  }

  const existingName =
    normalizeDecisionMakerName(existing.name);

  const publicName =
    normalizeDecisionMakerName(candidate.name);

  if (
    !existingName ||
    !publicName ||
    existingName !== publicName
  ) {
    return existing;
  }

  const sourceType = publicWebSourceType(
    candidate.sourceUrl,
    candidate.sourceType,
  );

  const publicEvidence: ContactEvidence[] = [
    {
      field: "name",
      value: candidate.name,
      sourceType,
      sourceUrl: candidate.sourceUrl,
      confidence: candidate.discoveryConfidence,
      verified: false,
      evidenceText:
        `Independent public-web source corroborates ${candidate.name} as associated with ${lead.companyName}.`,
    },
  ];

  if (candidate.role) {
    publicEvidence.push({
      field: "role",
      value: candidate.role,
      sourceType,
      sourceUrl: candidate.sourceUrl,
      confidence: candidate.discoveryConfidence,
      verified: false,
      evidenceText:
        `Independent public-web source reports the role ${candidate.role}.`,
    });
  }

  if (
    candidate.profileUrl &&
    candidate.profileUrl.toLowerCase().includes(
      "linkedin.com/in/",
    )
  ) {
    publicEvidence.push({
      field: "linkedin",
      value: candidate.profileUrl,
      sourceType: "public_professional_profile",
      sourceUrl: candidate.profileUrl,
      confidence: candidate.discoveryConfidence,
      verified: false,
      evidenceText:
        "Independent public-web research found a LinkedIn profile.",
    });
  }

  const existingEvidence =
    existing.evidence ?? [];

  const profileUrl =
    existing.profileUrl ?? candidate.profileUrl;

  const roleLabel =
    existing.roleLabel !== "unknown"
      ? existing.roleLabel
      : mapPublicWebRoleToDecisionMakerRole(
          candidate.role,
        );

  return {
    ...existing,
    profileUrl,
    roleLabel,
    evidence: [
      ...existingEvidence,
      ...publicEvidence,
    ],
    reason:
      `${existing.reason ?? ""} ` +
      `Public-web corroboration: ${candidate.evidence.join(" ")}`,
  };
}

async function discoverAndMergePublicWebDecisionMaker(
  lead: Lead,
  current: DecisionMaker | null,
): Promise<DecisionMaker | null> {
  try {
    const candidate =
      await discoverPublicWebDecisionMaker(lead);

    if (!candidate) {
      return current;
    }

    if (current) {
      const currentName =
        normalizeDecisionMakerName(current.name);

      const candidateName =
        normalizeDecisionMakerName(candidate.name);

      if (
        !currentName ||
        !candidateName ||
        currentName !== candidateName
      ) {
        return current;
      }

      return mergePublicWebDecisionMaker(
        current,
        candidate,
        lead,
      );
    }

    return mergePublicWebDecisionMaker(
      null,
      candidate,
      lead,
    );
  } catch {
    return current;
  }
}


function mapVerificationToConfidence(

  score: number,

  current: ContactConfidence,

): ContactConfidence {

  if (score >= 85) {

    return "high";

  }



  if (score >= 60) {

    return "medium";

  }



  return current === "high" ? "medium" : current;

}



function applyDecisionMakerVerification(
  lead: Lead,
  decisionMaker: DecisionMaker | null,
): DecisionMaker | null {
  if (!decisionMaker) {
    return null;
  }

  const evidence: PersonEvidence[] = (
    decisionMaker.evidence ?? []
  )
    .filter(
      (item) =>
        Boolean(item.value?.trim()) &&
        Boolean(item.sourceUrl?.trim()),
    )
    .map((item) => ({
      personName:
        item.field === "name"
          ? item.value
          : decisionMaker.name,
      role:
        item.field === "role"
          ? item.value
          : decisionMaker.roleLabel,
      companyName:
        lead.companyName,
      sourceUrl:
        item.sourceUrl,
      sourceType:
        item.sourceType,
      evidenceText:
        item.evidenceText ??
        decisionMaker.reason,
      observedAt:
        new Date().toISOString(),
    }));

  /*
   * If the original evidence is unavailable, fall back
   * to the decision maker's primary source.
   *
   * This keeps UNKNOWN > WRONG while still allowing
   * legitimate single-source candidates to remain
   * partially verified.
   */
  if (
    evidence.length === 0 &&
    decisionMaker.sourceUrl
  ) {
    evidence.push({
      personName:
        decisionMaker.name,
      role:
        decisionMaker.roleLabel,
      companyName:
        lead.companyName,
      sourceUrl:
        decisionMaker.sourceUrl,
      sourceType:
        decisionMaker.sourceType,
      evidenceText:
        decisionMaker.reason,
      observedAt:
        new Date().toISOString(),
    });
  }

  if (evidence.length === 0) {
    return {
      ...decisionMaker,
      verificationStatus: "unverified",
      confidence: "low",
    };
  }

  const verification = verifyPerson(
    lead,
    evidence,
  );

  if (
    verification.level === "rejected"
  ) {
    return null;
  }

  const confidence =
    mapVerificationToConfidence(
      verification.overallScore,
      decisionMaker.confidence,
    );

  const verificationStatus: ContactVerificationStatus =
    verification.level === "verified"
      ? "verified"
      : verification.level ===
          "partially_verified"
        ? "partially_verified"
        : "unverified";

  return {
    ...decisionMaker,
    confidence,
    verificationStatus,
    evidence:
      decisionMaker.evidence,
    reason:
      `${decisionMaker.reason ?? ""} ` +
      `Verification score: ${verification.overallScore}/100. ` +
      verification.reasons.join(" "),
  };
}



function verifyBusinessPhone(

  phone: BusinessPhone,

  lead: Lead,

): BusinessPhone | null {

  const result = verifyPhone(

    phone.normalized ?? phone.raw,

    {

      country: lead.country,

      direct: false,

      sourceUrls: phone.sourceUrl

        ? [phone.sourceUrl]

        : [],

    },

  );



  if (result.level === "rejected") {

    return null;

  }



  return {

    ...phone,

    normalized: result.value,

    confidence: mapVerificationToConfidence(

      result.score,

      phone.confidence,

    ),

    verificationStatus:

      result.level === "verified"

        ? "verified"

        : "partially_verified",

  };

}



function verifyBusinessEmailContact(

  email: BusinessEmail,

  lead: Lead,

): BusinessEmail | null {

  const result = verifyEmail(

    email.normalized,

    lead,

  );



  if (result.level === "rejected") {

    return null;

  }



  return {

    ...email,

    confidence: mapVerificationToConfidence(

      result.score,

      email.confidence,

    ),

    verificationStatus:

      result.level === "verified"

        ? "verified"

        : "partially_verified",

  };

}



function verifySocialProfile(

  profile: SocialContact,

): SocialContact | null {

  if (profile.platform === "linkedin") {

    const result = verifyLinkedIn(profile.url);



    if (result.level === "rejected") {

      return null;

    }



    return {

      ...profile,

      confidence: mapVerificationToConfidence(

        result.score,

        profile.confidence,

      ),

      verificationStatus:

        result.level === "verified"

          ? "verified"

          : "partially_verified",

    };

  }



  if (profile.platform === "instagram") {

    const result = verifyInstagram(profile.url);



    if (result.level === "rejected") {

      return null;

    }



    return {

      ...profile,

      confidence: mapVerificationToConfidence(

        result.score,

        profile.confidence,

      ),

      verificationStatus:

        result.level === "verified"

          ? "verified"

          : "partially_verified",

    };

  }



  return profile;

}



export async function researchContactIntelligence(

  lead: Lead

): Promise<ContactIntelligence> {

  const researchedAt =

    new Date().toISOString();



  /**

*   \* -------------------------------------------------------*

*   \* 1. WEBSITE ENRICHMENT*

*   \* -------------------------------------------------------*

*   */



  let enrichment:

    | EnrichmentResult

    | null = null;



  try {

    if (lead.website) {

      enrichment =

        await extractWebsiteContacts(

          lead

        );

    }

  } catch {

    enrichment = null;

  }



  /**

*   \* -------------------------------------------------------*

*   \* 2. DECISION MAKER*

*   \* -------------------------------------------------------*

*   \**

*   \* IMPORTANT:*

*   \* researchDecisionMaker() expects a Lead.*

*   \**

*   \* Correct:*

*   \*     researchDecisionMaker(lead)*

*   \**

*   \* NOT:*

*   \*     researchDecisionMaker(lead.website)*

*   */



  let decisionMaker:

    | DecisionMaker

    | null = null;



  try {

    if (lead.website) {

      decisionMaker =

        await researchDecisionMaker(

          lead

        );

    }

  } catch {

    decisionMaker = null;

  }


  decisionMaker =
  await discoverAndMergePublicWebDecisionMaker(
    lead,
    decisionMaker,
  );

/*
 * Public-web discovery is discovery only.
 *
 * A public search result must NOT become a decision maker
 * merely because it contains a role word such as "founder"
 * or "owner".
 *
 * If we don't already have a substantiated company/person
 * relationship, keep the decision maker as NOT FOUND.
 */
if (
  decisionMaker &&
  decisionMaker.sourceType ===
    "public_professional_profile" &&
  !decisionMaker.profileUrl
) {
  decisionMaker = null;
}

decisionMaker = applyDecisionMakerVerification(
  lead,
  decisionMaker,
);



  /**

*   \* -------------------------------------------------------*

*   \* 3. PHONE*

*   \* -------------------------------------------------------*

*   */



  const phones: BusinessPhone[] = [];



  if (

    enrichment?.contact?.phone

  ) {

    const sourceUrl =

      enrichment.contact.contactPage ??

      enrichment.website ??

      lead.website ??

      null;



    const phone =

      buildPhone(

        enrichment.contact.phone,

        sourceUrl,

        "medium"

      );



    if (phone) {

      phones.push(phone);

    }

  }



  /**

*   \* -------------------------------------------------------*

*   \* 4. EMAIL*

*   \* -------------------------------------------------------*

*   */



  const emails: BusinessEmail[] = [];



  if (

    enrichment?.contact?.email

  ) {

    const sourceUrl =

      enrichment.contact.contactPage ??

      enrichment.website ??

      lead.website ??

      null;



    const email =

      buildEmail(

        enrichment.contact.email,

        sourceUrl,

        "medium"

      );



    if (email) {

      emails.push(email);

    }

  }



  /**

*   \* -------------------------------------------------------*

*   \* 5. DEDUPE*

*   \* -------------------------------------------------------*

*   */



  const uniquePhones =

    dedupePhones(phones)

      .map((phone) =>

        verifyBusinessPhone(phone, lead),

      )

      .filter(

        (phone): phone is BusinessPhone =>

          phone !== null,

      );



  const uniqueEmails =

    dedupeEmails(emails)

      .map((email) =>

        verifyBusinessEmailContact(

          email,

          lead,

        ),

      )

      .filter(

        (email): email is BusinessEmail =>

          email !== null,

      );



  /**

*   \* -------------------------------------------------------*

*   \* 6. SOCIAL PROFILES*

*   \* -------------------------------------------------------*

*   */



  const socialProfiles =

    buildSocialProfiles(

      enrichment,

      decisionMaker

    )

      .map((profile) =>

        verifySocialProfile(profile),

      )

      .filter(

        (profile): profile is SocialContact =>

          profile !== null,

      );



  /**

*   \* -------------------------------------------------------*

*   \* 7. EVIDENCE*

*   \* -------------------------------------------------------*

*   */



  const evidence: ContactEvidence[] = [];



  if (decisionMaker) {

    evidence.push(

      ...(decisionMaker.evidence ?? [])

    );

  }



  for (

    const phone of uniquePhones

  ) {

    evidence.push(

      buildPhoneEvidence(phone)

    );

  }



  for (

    const email of uniqueEmails

  ) {

    evidence.push(

      buildEmailEvidence(email)

    );

  }



  for (

    const profile of socialProfiles

  ) {

    const socialEvidence =

      buildSocialEvidence(

        profile

      );



    if (socialEvidence) {

      evidence.push(

        socialEvidence

      );

    }

  }



  /**

*   \* -------------------------------------------------------*

*   \* 8. SCORES*

*   \* -------------------------------------------------------*

*   */



  const contactabilityScore =

    calculateContactabilityScore(

      decisionMaker,

      uniquePhones,

      uniqueEmails,

      socialProfiles

    );



  const dataConfidenceScore =

    calculateDataConfidenceScore(

      decisionMaker,

      uniquePhones,

      uniqueEmails,

      socialProfiles

    );



  /**

*   \* -------------------------------------------------------*

*   \* 9. VERIFICATION*

*   \* -------------------------------------------------------*

*   */



  const verificationStatus =

    getVerificationStatus(

      decisionMaker,

      uniquePhones,

      uniqueEmails,

      socialProfiles

    );



  /**

*   \* -------------------------------------------------------*

*   \* 10. WARNINGS*

*   \* -------------------------------------------------------*

*   */



  const warnings =

    buildWarnings(

      decisionMaker,

      uniquePhones,

      uniqueEmails,

      socialProfiles

    );



  /**

*   \* -------------------------------------------------------*

*   \* 11. FINAL RESULT*

*   \* -------------------------------------------------------*

*   */



  return {

    decisionMaker,



    phones:

      uniquePhones,



    emails:

      uniqueEmails,



    socialProfiles,



    contactabilityScore,



    dataConfidenceScore,



    verificationStatus,



    evidence,



    researchedAt,



    warnings,

  };

}
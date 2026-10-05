import type {
  BusinessPhone,
  ContactConfidence,
  ContactSourceType,
  ContactVerificationStatus,
} from "./types";

const INDIA_COUNTRY_CODE = "91";

function cleanPhone(value: string): string {
  return value
    .replace(
      /(?:ext|extension|x)\s*[:.]?\s*\d+$/i,
      ""
    )
    .replace(/[^\d+]/g, "")
    .trim();
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * Reject values that are very likely dates, years,
 * timestamps, IDs, postal codes, etc.
 *
 * This is intentionally conservative.
 * A false negative is preferable to storing a
 * non-phone value as a business phone.
 */
function looksLikeNonPhone(value: string): boolean {
  const trimmed = value.trim();

  if (!trimmed) {
    return true;
  }

  /*
   * ISO-style date:
   * 2025-04-19
   * 2024/08/22
   * 2025.04.19
   */
  if (
    /^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}$/.test(
      trimmed
    )
  ) {
    return true;
  }

  /*
   * Common date formats:
   * 19-04-2025
   * 19/04/2025
   * 04-19-2025
   */
  if (
    /^\d{1,2}[-/.]\d{1,2}[-/.]\d{4}$/.test(
      trimmed
    )
  ) {
    return true;
  }

  /*
   * Four-digit year.
   */
  if (/^\d{4}$/.test(trimmed)) {
    return true;
  }

  /*
   * Date/time-looking strings.
   */
  if (
    /\b\d{4}[-/.]\d{1,2}[-/.]\d{1,2}\b/.test(
      trimmed
    ) ||
    /\b\d{1,2}[-/.]\d{1,2}[-/.]\d{4}\b/.test(
      trimmed
    )
  ) {
    return true;
  }

  /*
   * URLs should never become phone numbers.
   */
  if (
    /^https?:\/\//i.test(trimmed) ||
    /^www\./i.test(trimmed)
  ) {
    return true;
  }

  /*
   * Email addresses are not phone numbers.
   */
  if (trimmed.includes("@")) {
    return true;
  }

  /*
   * Extremely long digit runs are usually IDs,
   * timestamps or tracking values rather than
   * ordinary business telephone numbers.
   */
  const digits = digitsOnly(trimmed);

  if (
    digits.length > 15
  ) {
    return true;
  }

  /*
   * Values containing a large amount of text
   * around a numeric sequence are not reliable
   * phone candidates.
   */
  const letters =
    trimmed.replace(
      /[^A-Za-z]/g,
      ""
    );

  if (
    letters.length > 6 &&
    digits.length < 8
  ) {
    return true;
  }

  return false;
}

function inferIndiaNumber(
  raw: string
): string | null {
  if (
    looksLikeNonPhone(raw)
  ) {
    return null;
  }

  const digits =
    digitsOnly(raw);

  /*
   * 10-digit Indian mobile/landline-style
   * number supplied without country code.
   */
  if (
    digits.length === 10
  ) {
    /*
     * Indian mobile numbers normally start
     * with 6, 7, 8 or 9.
     *
     * Do not force every 10-digit value to be
     * an Indian phone number.
     */
    if (
      /^[6-9]/.test(digits)
    ) {
      return `+${INDIA_COUNTRY_CODE}${digits}`;
    }

    /*
     * Indian landline numbers may begin with
     * a geographic STD code, but without the
     * area code context we avoid guessing here.
     */
    return null;
  }

  /*
   * 91 + 10 digits.
   */
  if (
    digits.length === 12 &&
    digits.startsWith(
      INDIA_COUNTRY_CODE
    )
  ) {
    return `+${digits}`;
  }

  /*
   * 0 + 10 digits.
   */
  if (
    digits.length === 11 &&
    digits.startsWith("0")
  ) {
    const local =
      digits.slice(1);

    if (
      /^[6-9]/.test(local)
    ) {
      return `+${INDIA_COUNTRY_CODE}${local}`;
    }

    /*
     * Keep Indian landline handling conservative.
     * We don't know the city/STD code here.
     */
    return null;
  }

  return null;
}

function normalizeInternationalNumber(
  raw: string
): string | null {
  if (
    looksLikeNonPhone(raw)
  ) {
    return null;
  }

  const cleaned =
    cleanPhone(raw);

  if (!cleaned) {
    return null;
  }

  /*
   * Already has an international prefix.
   */
  if (
    cleaned.startsWith("+")
  ) {
    const digits =
      digitsOnly(cleaned);

    /*
     * Basic E.164 structural guard.
     *
     * This does NOT prove the number is live.
     */
    if (
      digits.length >= 8 &&
      digits.length <= 15
    ) {
      return `+${digits}`;
    }

    return null;
  }

  /*
   * AutoRadar currently prioritizes India.
   */
  return inferIndiaNumber(
    cleaned
  );
}

function detectPhoneType(
  normalized: string | null
): BusinessPhone["type"] {
  if (!normalized) {
    return "unknown";
  }

  const digits =
    digitsOnly(normalized);

  /*
   * Indian mobile numbers normally begin
   * with 6, 7, 8 or 9 after +91.
   */
  if (
    digits.length === 12 &&
    digits.startsWith(
      "916"
    ) ||
    digits.startsWith(
      "917"
    ) ||
    digits.startsWith(
      "918"
    ) ||
    digits.startsWith(
      "919"
    )
  ) {
    return "mobile";
  }

  return "unknown";
}

function displayPhone(
  normalized: string | null
): string | null {
  if (!normalized) {
    return null;
  }

  const digits =
    digitsOnly(normalized);

  /*
   * India:
   * +91 98765 43210
   */
  if (
    digits.length === 12 &&
    digits.startsWith(
      INDIA_COUNTRY_CODE
    )
  ) {
    const local =
      digits.slice(2);

    return `+91 ${local.slice(
      0,
      5
    )} ${local.slice(5)}`;
  }

  return normalized;
}

export function normalizePhone(
  raw: string,
  options?: {
    country?: string | null;
    sourceUrl?: string | null;
    sourceType?: ContactSourceType;
    confidence?: ContactConfidence;
    verificationStatus?: ContactVerificationStatus;
  }
): BusinessPhone {
  const sourceType =
    options?.sourceType ??
    "unknown";

  const confidence =
    options?.confidence ??
    "low";

  const verificationStatus =
    options?.verificationStatus ??
    "unverified";

  const normalized =
    normalizeInternationalNumber(
      raw
    );

  const type =
    detectPhoneType(
      normalized
    );

  return {
    raw,

    normalized,

    display:
      displayPhone(
        normalized
      ),

    countryCode:
      normalized?.startsWith(
        "+91"
      )
        ? "91"
        : null,

    country:
      normalized?.startsWith(
        "+91"
      )
        ? "IN"
        : options?.country ??
          null,

    type,

    sourceUrl:
      options?.sourceUrl ??
      null,

    sourceType,

    confidence,

    verificationStatus,
  };
}

export function isPlausiblePhone(
  value: string | null | undefined
): boolean {
  if (!value) {
    return false;
  }

  const normalized =
    normalizeInternationalNumber(
      value
    );

  if (!normalized) {
    return false;
  }

  const digits =
    digitsOnly(normalized);

  return (
    digits.length >= 8 &&
    digits.length <= 15
  );
}

export function dedupePhones(
  phones: BusinessPhone[]
): BusinessPhone[] {
  const seen =
    new Set<string>();

  const result: BusinessPhone[] =
    [];

  for (const phone of phones) {
    const key =
      phone.normalized ??
      cleanPhone(
        phone.raw
      );

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
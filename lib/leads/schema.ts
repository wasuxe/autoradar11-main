import { z } from "zod";
import { SERVICE_TRACKS } from "./types";

const emptyToNull = (value: unknown) => {
  if (value === undefined || value === null) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  return value;
};

const optionalText = z.preprocess(
  emptyToNull,
  z.string().trim().min(1).nullable().optional()
);

export const leadSchema = z.object({
  companyName: z.string().trim().min(1),
  website: optionalText,
  industry: optionalText,
  country: optionalText,
  city: optionalText,
  employeeRange: optionalText,
  serviceTrack: z.preprocess(
    emptyToNull,
    z.enum(SERVICE_TRACKS).nullable().optional()
  ),
  source: z.string().trim().min(1),
  sourceUrl: optionalText,
  description: optionalText,
  linkedinUrl: optionalText,
  instagramUrl: optionalText,
  facebookUrl: optionalText,
  foundedYear: z.preprocess((value) => {
    if (value === undefined || value === null || value === "") return null;
    if (typeof value === "string" && value.trim() === "") return null;
    const n = typeof value === "number" ? value : Number(value);
    return Number.isFinite(n) ? n : value;
  }, z.number().int().min(1800).max(2100).nullable().optional()),
});

export type ParsedLead = z.infer<typeof leadSchema>;

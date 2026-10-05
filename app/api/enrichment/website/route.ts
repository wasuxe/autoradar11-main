import { extractWebsiteContacts } from "@/lib/enrichment/website-contact";
import { normalizeLead } from "@/lib/leads/normalize";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !("website" in body) ||
    typeof body.website !== "string" ||
    body.website.trim() === ""
  ) {
    return NextResponse.json(
      { success: false, error: "website is required" },
      { status: 400 }
    );
  }

  const companyName =
    "companyName" in body &&
    typeof body.companyName === "string" &&
    body.companyName.trim() !== ""
      ? body.companyName
      : "Website Test";

  const rawLead = {
    companyName,
    website: body.website,
    source: "manual",
  };

  try {
    const lead = normalizeLead(rawLead);
    const result = await extractWebsiteContacts(lead);

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error) {
    console.error("Website enrichment error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Website enrichment failed",
      },
      { status: 500 }
    );
  }
}
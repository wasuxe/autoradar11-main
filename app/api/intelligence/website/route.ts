import { analyzeWebsite } from "@/lib/intelligence/website";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: "Invalid JSON body",
      },
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
      {
        success: false,
        error: "website is required",
      },
      { status: 400 }
    );
  }

  try {
    const intelligence = await analyzeWebsite(body.website);

    return NextResponse.json({
      success: true,
      intelligence,
    });
  } catch (error) {
    console.error("Website intelligence error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Website analysis failed",
      },
      { status: 500 }
    );
  }
}
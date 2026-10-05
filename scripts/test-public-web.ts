import dotenv from "dotenv";

dotenv.config({
  path: ".env.local",
});

import {
  researchBusinessOnPublicWeb,
  buildBusinessResearchInput,
} from "../lib/research/public-web";

async function main() {
  console.log(
    "TAVILY KEY LOADED:",
    Boolean(process.env.TAVILY_API_KEY),
  );

  const lead = {
    companyName: "Nital skin clinic",
    website: null,
    industry: "clinic",
    country: "India",
    city: "Vadodara",
    employeeRange: null,
    serviceTrack: "both" as const,
    source: "overpass",
    sourceUrl:
      "https://www.openstreetmap.org/node/4275241789",
    description: null,
    linkedinUrl: null,
    instagramUrl: null,
    facebookUrl: null,
    foundedYear: null,
  };

  const input =
    buildBusinessResearchInput(lead);

  console.log(
    "RESEARCH INPUT:",
    JSON.stringify(input, null, 2),
  );

  const result =
    await researchBusinessOnPublicWeb(input);

  console.log(
    "RESEARCH RESULT:",
    JSON.stringify(
      result,
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(
    "PUBLIC WEB TEST FAILED:",
    error,
  );

  process.exit(1);
});
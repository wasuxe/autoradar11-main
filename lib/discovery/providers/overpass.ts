import type {



  DiscoveryProvider,



  DiscoveryQuery,



  DiscoveryResult,



} from "@/lib/providers/types";





import { parseSearchIntent } from "@/lib/search/intent";





type NominatimResult = {



  lat?: string;



  lon?: string;



};





type OverpassElement = {



  type?: string;



  id?: number;



  tags?: Record<string, string>;



  center?: {



    lat?: number;



    lon?: number;



  };



};





type OverpassResponse = {



  elements?: OverpassElement[];



};





const OVERPASS_ENDPOINTS = [



  "https://overpass-api.de/api/interpreter",



  "https://overpass.kumi.systems/api/interpreter",



  "https://overpass.private.coffee/api/interpreter",



];





const NOMINATIM_URL =



  "https://nominatim.openstreetmap.org/search";





const DEFAULT_LIMIT = 10;



const MAX_RESULTS = 100;





const REQUEST_TIMEOUT = 6_000;



function normalizeText(value: string): string {



  return value



    .toLowerCase()



    .replace(/[^\p{L}\p{N}\s-]/gu, " ")



    .replace(/\s+/g, " ")



    .trim();



}





function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");



}



function buildBoundingBox(



  lat: number,



  lon: number



): string {



  const radius = 0.08;





  return [



    lat - radius,



    lon - radius,



    lat + radius,



    lon + radius,



  ].join(",");



}





async function geocodeCity(



  city: string,



  country?: string



): Promise<{



  lat: number;



  lon: number;



} | null> {



  const search = [



    city.trim(),



    country?.trim(),



  ]



    .filter(Boolean)



    .join(", ");





  const params = new URLSearchParams({



    q: search,



    format: "json",



    limit: "1",



  });





  const controller = new AbortController();





  const timeout = setTimeout(() => {



    controller.abort();



  }, REQUEST_TIMEOUT);





  try {



    const response = await fetch(



      `${NOMINATIM_URL}?${params.toString()}`,



      {



        headers: {



          Accept: "application/json",



          "User-Agent": "SoleTrust-AutoRadar/1.0",



        },



        signal: controller.signal,



        cache: "no-store",



      }



    );





    if (!response.ok) {



      throw new Error(



        `City geocoding failed: ${response.status}`



      );



    }





    const data =



      (await response.json()) as NominatimResult[];





    const first = data[0];





    if (!first?.lat || !first?.lon) {



      return null;



    }





    const lat = Number(first.lat);



    const lon = Number(first.lon);





    if (



      !Number.isFinite(lat) ||



      !Number.isFinite(lon)



    ) {



      return null;



    }





    return {



      lat,



      lon,



    };



  } catch (error) {



    if (



      error instanceof Error &&



      error.name === "AbortError"



    ) {



      throw new Error(



        `City geocoding timed out after ${



          REQUEST_TIMEOUT / 1000



        } seconds`



      );



    }





    throw error;



  } finally {



    clearTimeout(timeout);



  }



}



function firstTag(



  tags: Record<string, string>,



  keys: string[]



): string | null {



  for (const key of keys) {



    const value = tags[key]?.trim();





    if (value) {



      return value;



    }



  }





  return null;



}





function normalizeWebsite(



  value: string | null



): string | null {



  if (!value) {



    return null;



  }





  const trimmed = value.trim();





  if (!trimmed) {



    return null;



  }





  if (



    trimmed.startsWith("http\://") ||



    trimmed.startsWith("https://")



  ) {



    return trimmed;



  }





  return `https://${trimmed}`;



}



function inferIndustry(



  tags: Record<string, string>



): string | null {



  return firstTag(tags, [



    "healthcare:speciality",



    "amenity",



    "shop",



    "craft",



    "office",



    "tourism",



    "leisure",



    "sport",



  ]);



}



type IndustryProfile = {



  aliases: string[];



  allowedTags: Array<{



    key: string;



    values: string[];



  }>;



  strongNameTerms: string[];



  blockedNameTerms: string[];



};





function getIndustryProfile(



  searchText: string



): IndustryProfile | null {



  const value = normalizeText(searchText);





  if (



    value.includes("skin care") ||



    value.includes("skincare") ||



    value.includes("skin clinic") ||



    value.includes("aesthetic") ||



    value.includes("cosmetic clinic") ||



    value.includes("beauty clinic")



  ) {



    return {



      aliases: [



        "skin care",



        "skincare",



        "skin clinic",



        "dermatology",



        "dermatologist",



        "aesthetic clinic",



        "aesthetic",



        "cosmetic clinic",



        "cosmetic",



        "beauty clinic",



      ],





      allowedTags: [



        {



          key: "healthcare:speciality",



          values: [



            "dermatology",



          ],



        },



        {



          key: "healthcare",



          values: [



            "dermatology",



          ],



        },



        {



          key: "shop",



          values: [



            "beauty",



          ],



        },



      ],





      strongNameTerms: [



        "skin",



        "skincare",



        "dermat",



        "aesthetic",



        "aesthetics",



        "cosmetic",



        "beauty",



      ],





      blockedNameTerms: [



        "hospital",



        "pediatric",



        "paediatric",



        "child",



        "neonatal",



        "maternity",



        "trauma",



        "orthopedic",



        "orthopaedic",



        "cardiac",



        "cardiology",



        "neurology",



        "neurosurgery",



        "ent",



        "dental",



        "dentist",



        "ophthalm",



        "eye care",



        "physiotherapy",



        "pathology",



        "diagnostic",



        "laboratory",



        "blood bank",



        "nursing home",



        "ambulance",



      ],



    };



  }





  if (



    value.includes("dermatology") ||



    value.includes("dermatologist")



  ) {



    return {



      aliases: [



        "dermatology",



        "dermatologist",



        "dermatology clinic",



        "skin clinic",



      ],





      allowedTags: [



        {



          key: "healthcare:speciality",



          values: ["dermatology"],



        },



        {



          key: "healthcare",



          values: ["dermatology"],



        },



      ],





      strongNameTerms: [



        "dermat",



        "skin",



      ],





      blockedNameTerms: [



        "hospital",



        "pediatric",



        "paediatric",



        "child",



        "neonatal",



        "maternity",



        "trauma",



        "dental",



        "dentist",



        "eye",



        "cardiac",



        "cardiology",



        "orthopedic",



        "orthopaedic",



        "ent",



      ],



    };



  }





  if (



    value.includes("dentist") ||



    value.includes("dental")



  ) {



    return {



      aliases: [



        "dentist",



        "dental",



        "dental clinic",



        "orthodontist",



      ],





      allowedTags: [



        {



          key: "amenity",



          values: ["dentist"],



        },



        {



          key: "healthcare:speciality",



          values: ["dentistry"],



        },



      ],





      strongNameTerms: [



        "dental",



        "dentist",



        "orthodont",



        "tooth",



      ],





      blockedNameTerms: [



        "hospital",



        "dermatology",



        "dermatologist",



        "skin",



        "pediatric",



        "paediatric",



        "eye",



        "cardiac",



        "trauma",



      ],



    };



  }





  if (value.includes("restaurant")) {



    return {



      aliases: [



        "restaurant",



        "dining",



        "food",



      ],





      allowedTags: [



        {



          key: "amenity",



          values: ["restaurant"],



        },



      ],





      strongNameTerms: [



        "restaurant",



        "dining",



        "kitchen",



        "grill",



        "cafe",



        "food",



      ],





      blockedNameTerms: [



        "hospital",



        "clinic",



        "school",



        "college",



        "hotel",



      ],



    };



  }





  if (



    value.includes("cafe") ||



    value.includes("coffee")



  ) {



    return {



      aliases: [



        "cafe",



        "coffee",



        "coffee shop",



      ],





      allowedTags: [



        {



          key: "amenity",



          values: ["cafe"],



        },



      ],





      strongNameTerms: [



        "cafe",



        "coffee",



        "espresso",



        "bakery",



      ],





      blockedNameTerms: [



        "hospital",



        "clinic",



        "school",



        "college",



      ],



    };



  }





  if (value.includes("hotel")) {



    return {



      aliases: [



        "hotel",



        "resort",



        "guest house",



      ],





      allowedTags: [



        {



          key: "tourism",



          values: [



            "hotel",



            "resort",



            "guest_house",



          ],



        },



      ],





      strongNameTerms: [



        "hotel",



        "resort",



        "inn",



        "lodge",



        "guest house",



      ],





      blockedNameTerms: [



        "hospital",



        "clinic",



        "school",



        "college",



      ],



    };



  }





  if (



    value.includes("gym") ||



    value.includes("fitness")



  ) {



    return {



      aliases: [



        "gym",



        "fitness",



        "fitness centre",



        "fitness center",



      ],





      allowedTags: [



        {



          key: "leisure",



          values: ["fitness_centre"],



        },



      ],





      strongNameTerms: [



        "gym",



        "fitness",



        "crossfit",



        "strength",



      ],





      blockedNameTerms: [



        "hospital",



        "clinic",



        "school",



        "college",



      ],



    };



  }





  if (



    value.includes("salon") ||



    value.includes("beauty")



  ) {



    return {



      aliases: [



        "salon",



        "beauty",



        "beauty salon",



        "hair salon",



      ],





      allowedTags: [



        {



          key: "shop",



          values: [



            "beauty",



            "hairdresser",



          ],



        },



      ],





      strongNameTerms: [



        "salon",



        "beauty",



        "hair",



        "spa",



      ],





      blockedNameTerms: [



        "hospital",



        "clinic",



        "school",



        "college",



      ],



    };



  }





  if (



    value.includes("real estate") ||



    value.includes("property")



  ) {



    return {



      aliases: [



        "real estate",



        "property",



        "realty",



      ],





      allowedTags: [



        {



          key: "office",



          values: ["estate_agent"],



        },



      ],





      strongNameTerms: [



        "real estate",



        "property",



        "realty",



        "estate",



      ],





      blockedNameTerms: [



        "hospital",



        "clinic",



        "school",



        "college",



      ],



    };



  }





  if (



    value.includes("lawyer") ||



    value.includes("law firm")



  ) {



    return {



      aliases: [



        "lawyer",



        "law firm",



        "legal",



      ],





      allowedTags: [



        {



          key: "office",



          values: ["lawyer"],



        },



      ],





      strongNameTerms: [



        "lawyer",



        "law",



        "legal",



        "advocate",



      ],





      blockedNameTerms: [



        "hospital",



        "clinic",



        "school",



        "college",



      ],



    };



  }





  if (



    value.includes("photographer") ||



    value.includes("photography")



  ) {



    return {



      aliases: [



        "photographer",



        "photography",



        "photo studio",



      ],





      allowedTags: [



        {



          key: "craft",



          values: ["photographer"],



        },



      ],





      strongNameTerms: [



        "photograph",



        "photography",



        "photo studio",



        "studio",



      ],





      blockedNameTerms: [



        "hospital",



        "clinic",



        "school",



        "college",



      ],



    };



  }





  if (value.includes("marketing")) {



    return {



      aliases: [



        "marketing",



        "advertising",



        "digital marketing",



        "marketing agency",



      ],





      allowedTags: [



        {



          key: "office",



          values: [



            "advertising_agency",



          ],



        },



      ],





      strongNameTerms: [



        "marketing",



        "advertising",



        "digital",



        "agency",



      ],





      blockedNameTerms: [



        "hospital",



        "clinic",



        "school",



        "college",



      ],



    };



  }





  return null;



}





/* -------------------------------------------------------------------------- */

/* BUSINESS ENTITY GATE */

/* -------------------------------------------------------------------------- */



const NON_BUSINESS_NAME_PATTERNS = [
  "anatomy",
  "structure and function",
  "structure of skin",
  "function of skin",
  "skin structure",
  "skin layer",
  "layers of skin",
  "diagram",
  "significance",
  "definition",
  "meaning of",
  "what is",
  "how to",
  "guide to",
  "symptoms of",
  "causes of",
  "treatment of",
  "diagnosis of",
  "overview of",
  "introduction to",
  "research paper",
  "research article",
  "journal article",
  "medical article",
  "educational article",
  "medical encyclopedia",
  "wikipedia",
  "webmd",
  "healthline",
];

const GENERIC_BUSINESS_NAMES = new Set([
  "skin clinic",
  "skin care",
  "skin care clinic",
  "skincare",
  "dermatology",
  "dermatology clinic",
  "dermatologist",
  "skin specialist",
  "skin specialists",
  "beauty clinic",
  "aesthetic clinic",
  "cosmetic clinic",
  "clinic",
  "hospital",
  "medical clinic",
  "dental clinic",
  "dentist",
  "restaurant",
  "cafe",
  "coffee shop",
  "hotel",
  "gym",
  "fitness centre",
  "fitness center",
  "salon",
  "beauty salon",
]);

const BUSINESS_TAGS: Array<{
  key: string;
  values?: string[];
}> = [
  {
    key: "amenity",
    values: [
      "restaurant",
      "cafe",
      "fast_food",
      "food_court",
      "dentist",
      "clinic",
      "hospital",
      "doctors",
      "pharmacy",
      "veterinary",
    ],
  },
  {
    key: "healthcare",
    values: [
      "doctor",
      "clinic",
      "hospital",
      "centre",
      "center",
    ],
  },
  {
    key: "healthcare:speciality",
  },
  {
    key: "shop",
    values: [
      "beauty",
      "cosmetics",
      "hairdresser",
    ],
  },
  {
    key: "office",
    values: [
      "advertising_agency",
      "lawyer",
      "estate_agent",
    ],
  },
  {
    key: "tourism",
    values: [
      "hotel",
      "resort",
      "guest_house",
      "hostel",
    ],
  },
  {
    key: "leisure",
    values: [
      "fitness_centre",
    ],
  },
  {
    key: "craft",
    values: [
      "photographer",
    ],
  },
];

function isBlockedBusinessName(
  companyName: string,
): boolean {
  const name = normalizeText(companyName);

  if (!name) {
    return true;
  }

  return NON_BUSINESS_NAME_PATTERNS.some(
    (pattern) => name.includes(normalizeText(pattern)),
  );
}

function isGenericBusinessName(
  companyName: string,
): boolean {
  const name = normalizeText(companyName);

  if (!name) {
    return true;
  }

  return GENERIC_BUSINESS_NAMES.has(name);
}

function hasBusinessOsmTag(
  tags: Record<string, string>,
): boolean {
  for (const rule of BUSINESS_TAGS) {
    const rawValue = tags[rule.key]?.trim().toLowerCase();

    if (!rawValue) {
      continue;
    }

    if (!rule.values) {
      return true;
    }

    if (
      rule.values.some(
        (value) => rawValue === value.toLowerCase(),
      )
    ) {
      return true;
    }
  }

  return false;
}

function hasIndependentBusinessSignal(
  tags: Record<string, string>,
): boolean {
  const hasWebsite = Boolean(
    tags.website ||
      tags["contact:website"] ||
      tags.url,
  );

  const hasPhone = Boolean(
    tags.phone ||
      tags["contact:phone"],
  );

  const hasEmail = Boolean(
    tags.email ||
      tags["contact:email"],
  );

  const hasAddress = Boolean(
    tags["addr:street"] ||
      tags["addr:housenumber"] ||
      tags["addr:city"] ||
      tags["addr:postcode"],
  );

  const hasOpeningHours = Boolean(tags.opening_hours);

  let signals = 0;

  if (hasWebsite) signals += 1;
  if (hasPhone) signals += 1;
  if (hasEmail) signals += 1;
  if (hasAddress) signals += 1;
  if (hasOpeningHours) signals += 1;

  return signals >= 1;
}

function hasBusinessEvidence(
  tags: Record<string, string>,
): boolean {
  const name = normalizeText(tags.name ?? "");

  if (!name || isBlockedBusinessName(name)) {
    return false;
  }

  const hasStructuredBusinessTag = hasBusinessOsmTag(tags);
  const hasIndependentSignal = hasIndependentBusinessSignal(tags);
  const genericName = isGenericBusinessName(name);

  // A generic label such as "Skin Clinic" is not a business identity
  // by itself. Require an independent OSM business signal as well.
  if (genericName) {
    return hasStructuredBusinessTag && hasIndependentSignal;
  }

  // Structured business classification is strong evidence, but names that
  // look like articles/content still need an independent business signal.
  if (hasStructuredBusinessTag) {
    const wordCount = name.split(/\s+/).filter(Boolean).length;

    if (wordCount >= 8 && !hasIndependentSignal) {
      return false;
    }

    return true;
  }

  const businessNameTerms = [
    "clinic",
    "hospital",
    "medical",
    "health",
    "healthcare",
    "dermatology",
    "dermatologist",
    "skin care",
    "skincare",
    "aesthetic",
    "aesthetics",
    "cosmetic",
    "cosmetics",
    "dental",
    "dentist",
    "restaurant",
    "cafe",
    "coffee",
    "hotel",
    "resort",
    "gym",
    "fitness",
    "salon",
    "beauty",
    "studio",
    "agency",
    "law",
    "lawyer",
    "advocate",
    "real estate",
    "property",
    "photography",
    "photographer",
  ];

  const strongBusinessName = businessNameTerms.some(
    (term) => name.includes(normalizeText(term)),
  );

  return strongBusinessName && hasIndependentSignal;
}

function isBusinessElement(
  tags: Record<string, string>,
  companyName: string,
): boolean {
  if (isBlockedBusinessName(companyName)) {
    return false;
  }

  return hasBusinessEvidence({
    ...tags,
    name: companyName,
  });
}

function matchesIndustryProfile(

  tags: Record<string, string>,

  companyName: string,

  profile: IndustryProfile | null,

): boolean {

  if (!isBusinessElement(tags, companyName)) {

    return false;

  }



  if (!profile) {

    return true;

  }



  const normalizedName =

    normalizeText(companyName);



  const blocked =

    profile.blockedNameTerms.some(

      (term) =>

        normalizedName.includes(

          normalizeText(term),

        ),

    );



  if (blocked) {

    const hasRequestedSpecialty =

      profile.strongNameTerms.some(

        (term) =>

          normalizedName.includes(

            normalizeText(term),

          ),

      );



    if (!hasRequestedSpecialty) {

      return false;

    }

  }



  for (const allowed of profile.allowedTags) {

    const rawValue =

      tags[allowed.key]

        ?.trim()

        .toLowerCase();



    if (!rawValue) {

      continue;

    }



    if (

      allowed.values.some(

        (value) =>

          rawValue === value.toLowerCase(),

      )

    ) {

      return true;

    }

  }



  const hasStrongName =

    profile.strongNameTerms.some(

      (term) =>

        normalizedName.includes(

          normalizeText(term),

        ),

    );



  if (!hasStrongName) {

    return false;

  }



  const skincareProfile =

    profile.strongNameTerms.some(

      (term) =>

        [

          "skin",

          "skincare",

          "dermat",

          "aesthetic",

          "aesthetics",

          "cosmetic",

          "beauty",

        ].includes(term),

    );



  if (skincareProfile) {

    const hasSpecialty =

      [

        "skin",

        "skincare",

        "dermat",

        "aesthetic",

        "aesthetics",

        "cosmetic",

        "beauty",

      ].some(

        (term) =>

          normalizedName.includes(term),

      );



    if (!hasSpecialty) {

      return false;

    }

  }



  return true;

}



function inferServiceTrack(



  category: string | null,



  searchText: string



): "technical" | "creative" | "both" {



  const value =



    `${category ?? ""} ${searchText}`.toLowerCase();





  const creativeTerms = [



    "marketing",



    "design",



    "interior",



    "beauty",



    "salon",



    "restaurant",



    "cafe",



    "photography",



    "fashion",



    "skincare",



    "hotel",



    "hospitality",



  ];





  const technicalTerms = [



    "software",



    "technology",



    "saas",



    "startup",



    "app",



    "web development",



    "automation",



    "ai",



    "data",



    "it services",



  ];





  const creative = creativeTerms.some(



    (term) => value.includes(term)



  );





  const technical = technicalTerms.some(



    (term) => value.includes(term)



  );





  if (creative && technical) {



    return "both";



  }





  if (creative) {



    return "creative";



  }





  if (technical) {



    return "technical";



  }





  return "both";



}



type SearchProfile = {



  nameTerms: string[];



  tagQueries: string[];



};





function getSearchProfile(



  searchText: string



): SearchProfile {



  const value =



    normalizeText(searchText);





  if (



    value.includes("skin care") ||



    value.includes("skincare") ||



    value.includes("skin clinic") ||



    value.includes("aesthetic") ||



    value.includes("cosmetic clinic") ||



    value.includes("beauty clinic")



  ) {



    return {



      nameTerms: [



        "skin",



        "skincare",



        "dermatology",



        "dermatologist",



        "aesthetic",



        "aesthetics",



        "cosmetic",



        "beauty clinic",



      ],





      tagQueries: [



        `nwr["healthcare:speciality"="dermatology"]`,



        `nwr["healthcare"="dermatology"]`,



        `nwr["shop"="beauty"]`,



      ],



    };



  }





  if (



    value.includes("dermatology") ||



    value.includes("dermatologist") ||



    value.includes("skin clinic")



  ) {



    return {



      nameTerms: [



        "dermatology",



        "dermatologist",



        "dermat",



        "skin",



      ],





      tagQueries: [



        `nwr["healthcare:speciality"="dermatology"]`,



        `nwr["healthcare"="dermatology"]`,



      ],



    };



  }





  if (



    value.includes("dentist") ||



    value.includes("dental")



  ) {



    return {



      nameTerms: [



        "dentist",



        "dental",



        "dental clinic",



      ],





      tagQueries: [



        `nwr["amenity"="dentist"]`,



        `nwr["healthcare:speciality"="dentistry"]`,



      ],



    };



  }





  if (value.includes("restaurant")) {



    return {



      nameTerms: [



        "restaurant",



        "dining",



      ],





      tagQueries: [



        `nwr["amenity"="restaurant"]`,



      ],



    };



  }





  if (



    value.includes("cafe") ||



    value.includes("coffee")



  ) {



    return {



      nameTerms: [



        "cafe",



        "coffee",



      ],





      tagQueries: [



        `nwr["amenity"="cafe"]`,



      ],



    };



  }





  if (value.includes("hotel")) {



    return {



      nameTerms: [



        "hotel",



        "resort",



      ],





      tagQueries: [



        `nwr["tourism"="hotel"]`,



        `nwr["tourism"="resort"]`,



        `nwr["tourism"="guest_house"]`,



      ],



    };



  }





  if (



    value.includes("gym") ||



    value.includes("fitness")



  ) {



    return {



      nameTerms: [



        "gym",



        "fitness",



      ],





      tagQueries: [



        `nwr["leisure"="fitness_centre"]`,



      ],



    };



  }





  if (



    value.includes("salon") ||



    value.includes("beauty")



  ) {



    return {



      nameTerms: [



        "salon",



        "beauty",



        "spa",



      ],





      tagQueries: [



        `nwr["shop"="beauty"]`,



        `nwr["shop"="hairdresser"]`,



      ],



    };



  }





  if (



    value.includes("real estate") ||



    value.includes("property")



  ) {



    return {



      nameTerms: [



        "real estate",



        "property",



        "realty",



      ],





      tagQueries: [



        `nwr["office"="estate_agent"]`,



      ],



    };



  }





  if (



    value.includes("lawyer") ||



    value.includes("law firm")



  ) {



    return {



      nameTerms: [



        "lawyer",



        "law firm",



        "legal",



      ],





      tagQueries: [



        `nwr["office"="lawyer"]`,



      ],



    };



  }





  if (



    value.includes("photographer") ||



    value.includes("photography")



  ) {



    return {



      nameTerms: [



        "photographer",



        "photography",



      ],





      tagQueries: [



        `nwr["craft"="photographer"]`,



      ],



    };



  }





  if (value.includes("marketing")) {



    return {



      nameTerms: [



        "marketing",



        "advertising",



      ],





      tagQueries: [



        `nwr["office"="advertising_agency"]`,



      ],



    };



  }





  return {



    nameTerms: value



      .split(/\s+/)



      .filter(



        (term) => term.length >= 3



      )



      .slice(0, 6),





    tagQueries: [],



  };



}



function buildQuery(



  bbox: string,



  searchText: string,



  limit: number



): string {



  const profile =



    getSearchProfile(searchText);





  const nameRegex =



    profile.nameTerms



      .map(normalizeText)



      .filter(



        (term) => term.length >= 2



      )



      .map(escapeRegex)



      .join("|");





  const maxElements =



    Math.min(



      60,



      Math.max(



        limit * 3,



        20



      )



    );





  const queries: string[] = [];





  if (nameRegex) {



    queries.push(



      `nwr["name"\\\~"${nameRegex}",i]\\(${bbox});`



    );



  }





  for (



    const tagQuery of profile.tagQueries



  ) {



    queries.push(



      `${tagQuery}(${bbox});`



    );



  }





  if (queries.length === 0) {



    return `



      [out:json][timeout:8];





      (



        nwr["name"]\\(${bbox});



      );





      out center tags ${maxElements};



    `;



  }





  return `



    [out:json][timeout:8];





    (



      ${queries.join("\n")}



    );





    out center tags ${maxElements};



  `;



}



async function requestOverpass(



  endpoint: string,



  query: string



): Promise<OverpassResponse> {



  const controller =



    new AbortController();





  const timeout = setTimeout(



    () => {



      controller.abort();



    },



    REQUEST_TIMEOUT



  );





  try {



    const response =



      await fetch(



        endpoint,



        {



          method: "POST",





          headers: {



            "Content-Type":



              "application/x-www-form-urlencoded",





            Accept:



              "application/json",





            "User-Agent":



              "SoleTrust-AutoRadar/1.0",



          },





          body:



            new URLSearchParams({



              data: query,



            }).toString(),





          signal:



            controller.signal,





          cache: "no-store",



        }



      );





    if (!response.ok) {



      const responseText =



        await response



          .text()



          .catch(() => "");





      throw new Error(



        `HTTP ${response.status}${



          responseText



            ? ` - ${responseText.slice(



                0,



                200



              )}`



            : ""



        }`



      );



    }





    const data =



      (await response.json()) as OverpassResponse;





    console.log(



      `[Overpass] Success: ${endpoint} — ${



        data.elements?.length ?? 0



      } elements`



    );





    return data;



  } catch (error) {



    if (



      error instanceof Error &&



      error.name === "AbortError"



    ) {



      throw new Error(



        `Request timed out after ${



          REQUEST_TIMEOUT / 1000



        } seconds`



      );



    }





    throw (



      error instanceof Error



        ? error



        : new Error(



            "Unknown Overpass error"



          )



    );



  } finally {



    clearTimeout(timeout);



  }



}



async function queryOverpass(



  query: string



): Promise<OverpassResponse> {



  const requests =



    OVERPASS_ENDPOINTS.map(



      async (endpoint) => {



        try {



          return await requestOverpass(



            endpoint,



            query



          );



        } catch (error) {



          console.warn(



            `[Overpass] Endpoint failed: ${endpoint}`,



            error instanceof Error



              ? error.message



              : error



          );





          throw error;



        }



      }



    );





  try {



    return await Promise.any(



      requests



    );



  } catch {



    console.warn(



      "[Overpass] All endpoints unavailable"



    );





    return {



      elements: [],



    };



  }



}



function buildSourceUrl(



  element: OverpassElement



): string | null {



  if (



    !element.type ||



    !element.id



  ) {



    return null;



  }





  return `https://www\\.openstreetmap.org/${element.type}/${element.id}`;



}



function getCoordinates(



  element: OverpassElement



): {



  lat: number | null;



  lon: number | null;



} {



  const lat =



    element.center?.lat ??



    null;





  const lon =



    element.center?.lon ??



    null;





  return {



    lat:



      typeof lat === "number" &&



      Number.isFinite(lat)



        ? lat



        : null,





    lon:



      typeof lon === "number" &&



      Number.isFinite(lon)



        ? lon



        : null,



  };



}



export const overpassProvider:



  DiscoveryProvider = {



  id: "overpass",





  async discover(



    query: DiscoveryQuery



  ): Promise<DiscoveryResult> {



    const rawSearch = [



      query.text,



      query.industry,



    ]



      .filter(



        (



          value



        ): value is string =>



          typeof value === "string" &&



          value.trim().length > 0



      )



      .join(" ");





    const intent =



      parseSearchIntent(



        rawSearch



      );



    const city =



      query.city?.trim() ||



      intent.location.city;





    const country =



      query.country?.trim() ||



      intent.location.country ||



      undefined;





    if (!city) {



      throw new Error(



        "A city is required for Overpass discovery"



      );



    }





    const location =



      await geocodeCity(



        city,



        country



      );





    if (!location) {



      throw new Error(



        `Could not locate city: ${city}`



      );



    }



    const searchText = [



      query.industry,



      query.text,



      intent.category,



      ...(intent.keywords ?? []),



    ]



      .filter(



        (



          value



        ): value is string =>



          typeof value === "string" &&



          value.trim().length > 0



      )



      .join(" ");





    const industryProfile =



      getIndustryProfile(



        searchText



      );



    const bbox =



      buildBoundingBox(



        location.lat,



        location.lon



      );



    const overpassQuery =



      buildQuery(



        bbox,



        searchText,



        query.limit ??



          DEFAULT_LIMIT



      );



    const data =



      await queryOverpass(



        overpassQuery



      );



    const candidates:



      Record<string, unknown>[] =



      [];





    const seen =



      new Set<string>();





    const candidateLimit =



      Math.min(



        MAX_RESULTS,



        Math.max(



          (query.limit ??



            DEFAULT_LIMIT) * 5,



          20



        )



      );





    let rejectedByIndustry = 0;





    for (



      const element of



        data.elements ?? []



    ) {



      const tags =



        element.tags ?? {};





      const companyName =



        tags.name?.trim();





      if (!companyName) {



        continue;



      }



      if (

        !isBusinessElement(

          tags,

          companyName,

        )

      ) {

        rejectedByIndustry += 1;



        console.log(

          `[Overpass] Rejected non-business entity: "${companyName}"`,

        );



        continue;

      }



      if (

        !matchesIndustryProfile(

          tags,

          companyName,

          industryProfile,

        )

      ) {

        rejectedByIndustry += 1;



        console.log(

          `[Overpass] Rejected industry mismatch: "${companyName}"`,

        );



        continue;

      }



      const website =



        normalizeWebsite(



          firstTag(



            tags,



            [



              "website",



              "contact:website",



              "url",



            ]



          )



        );



      const phone =



        firstTag(



          tags,



          [



            "phone",



            "contact:phone",



          ]



        );



      const sourceUrl =



        buildSourceUrl(



          element



        );



      const key =



        website



          ? `website:${normalizeText(



              website



            )}`



          : phone



          ? `phone:${normalizeText(



              phone



            )}`



          : sourceUrl



          ? `source:${sourceUrl}`



          : `name:${normalizeText(



              companyName



            )}`;





      if (



        seen.has(key)



      ) {



        continue;



      }





      seen.add(key);



      const actualIndustry =



        inferIndustry(tags);



      const linkedinUrl =



        firstTag(



          tags,



          [



            "contact:linkedin",



            "linkedin",



          ]



        );





      const instagramUrl =



        firstTag(



          tags,



          [



            "contact:instagram",



            "instagram",



          ]



        );





      const facebookUrl =



        firstTag(



          tags,



          [



            "contact:facebook",



            "facebook",



          ]



        );



      const addressParts = [



        tags["addr:housenumber"],



        tags["addr:street"],



        tags["addr:suburb"],



        tags["addr:city"],



      ].filter(Boolean);





      const address =



        addressParts.length



          ? addressParts.join(", ")



          : null;



      const coordinates =



        getCoordinates(



          element



        );



      candidates.push({



        companyName,





        website,





        industry:



          actualIndustry,





        country:



          firstTag(



            tags,



            [



              "addr:country",



            ]



          ) ??



          country ??



          null,





        city:



          firstTag(



            tags,



            [



              "addr:city",



            ]



          ) ??



          city,





        address,





        phone,





        employeeRange:



          null,





        serviceTrack:



          query.serviceTrack ??



          inferServiceTrack(



            actualIndustry,



            searchText



          ),





        source:



          "overpass",





        sourceUrl,





        description:



          firstTag(



            tags,



            [



              "description",



              "official_name",



              "short_name",



            ]



          ),





        linkedinUrl,



        instagramUrl,



        facebookUrl,





        foundedYear:



          null,





        latitude:



          coordinates.lat,





        longitude:



          coordinates.lon,



      });





      if (



        candidates.length >=



        candidateLimit



      ) {



        break;



      }



    }





    console.log(



      `[Overpass] Discovery completed: ${candidates.length} candidates for "${searchText}" in ${city}. Rejected by industry gate: ${rejectedByIndustry}`



    );





    return {



      candidates,





      nextCursor:



        null,



    };



  },



};

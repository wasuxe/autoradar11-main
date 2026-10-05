export type SearchIntent = {
    originalQuery: string;
  
    category: string | null;
  
    location: {
      city: string | null;
      country: string | null;
    };
  
    qualifiers: string[];
  
    keywords: string[];
  
    normalizedQuery: string;
  };
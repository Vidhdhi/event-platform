export const CATEGORIES = [
  "Photography",
  "Catering",
  "Venue",
  "Decoration",
  "Music & DJ",
  "Makeup",
  "Other",
] as const;

export const CATEGORY_ICONS: Record<string, string> = {
  Photography: "📷",
  Catering: "🍽️",
  Venue: "🏛️",
  Decoration: "🎈",
  "Music & DJ": "🎧",
  Makeup: "💄",
  Other: "✨",
};

// Same cities the AI service has coordinates for
export const CITIES = [
  "Colombo",
  "Negombo",
  "Kalutara",
  "Galle",
  "Matara",
  "Kandy",
  "Nuwara Eliya",
  "Ratnapura",
  "Kurunegala",
  "Anuradhapura",
  "Jaffna",
  "Trincomalee",
  "Batticaloa",
];

export const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "rating", label: "Top rated" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
];

export const RATING_OPTIONS = [
  { value: "", label: "Any rating" },
  { value: "3", label: "3 and up" },
  { value: "4", label: "4 and up" },
  { value: "4.5", label: "4.5 and up" },
];
export interface Service {
  service_id: string;
  category: string;
  title: string;
  description: string | null;
  price: number;
  currency: string;
  is_negotiable: boolean;
  city: string;
  image_urls: string[] | null;
  business_name: string;
  average_rating: number;
  review_count: number;
}

export interface Recommendation extends Service {
  match_score: number;
  breakdown: {
    budget: number;
    location: number;
    rating: number;
    text: number;
  };
  within_budget: boolean;
  distance_km: number | null;
  reasons: string[];
}

export interface EventSummary {
  event_id: string;
  title: string;
  event_type: string;
  event_date: string;
  city: string;
  guest_count: number;
  total_budget: string;
}

export interface BookingSummary {
  booking_id: string;
  status: string;
  service_id: string;
  event_id: string;
}
export interface BookingDetail {
  booking_id: string;
  status: "pending" | "accepted" | "rejected" | "completed" | "cancelled";
  message: string | null;
  booking_date: string;
  agreed_price: number | null;
  event_id: string;
  event_title: string;
  event_type: string;
  event_date: string;
  event_city: string;
  guest_count: number;
  planner_name: string;
  service_id: string;
  service_title: string;
  category: string;
  price: number;
  business_name: string;
}
import math
from typing import Optional

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from schemas import EventInput, Recommendation, ScoreBreakdown, ServiceInput

# ---------- Settings (tune these during testing) ----------
WEIGHTS = {"budget": 0.35, "location": 0.25, "rating": 0.25, "text": 0.15}

# Typical share of the total event budget for each category
CATEGORY_BUDGET_SHARE = {
    "Venue": 0.30,
    "Catering": 0.30,
    "Photography": 0.12,
    "Decoration": 0.12,
    "Music & DJ": 0.08,
    "Makeup": 0.05,
    "Other": 0.05,
}
DEFAULT_SHARE = 0.10

NEGOTIABLE_DISCOUNT = 0.90      # assume negotiable prices can drop about 10%
OVER_BUDGET_LIMIT = 0.50        # budget score reaches 0 when 50% over
MAX_DISTANCE_KM = 200           # location score reaches 0 at this distance
UNKNOWN_LOCATION_SCORE = 0.30   # when a city is not in our table
PRIOR_MEAN = 3.5                # Bayesian rating: assumed average
PRIOR_WEIGHT = 3                # ...worth this many reviews
GOOD_TEXT_MATCH = 0.7           # text score above this is called "a close match"

# Extra words that describe each event type (helps match descriptions)
EVENT_KEYWORDS = {
    "wedding": "wedding bride groom reception ceremony marriage",
    "birthday": "birthday party celebration kids cake",
    "corporate": "corporate business conference company professional office",
    "other": "event celebration",
}

# (latitude, longitude) of Sri Lankan cities
CITY_COORDS = {
    "colombo": (6.9271, 79.8612),
    "negombo": (7.2008, 79.8737),
    "kalutara": (6.5854, 79.9607),
    "galle": (6.0535, 80.2210),
    "matara": (5.9549, 80.5550),
    "kandy": (7.2906, 80.6337),
    "nuwara eliya": (6.9497, 80.7891),
    "ratnapura": (6.7056, 80.3847),
    "kurunegala": (7.4863, 80.3647),
    "anuradhapura": (8.3114, 80.4037),
    "jaffna": (9.6615, 80.0255),
    "trincomalee": (8.5874, 81.2152),
    "batticaloa": (7.7310, 81.6747),
}


# ---------- Distance ----------
def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = p2 - p1
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlambda / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def distance_km(city_a: str, city_b: str) -> Optional[float]:
    a, b = city_a.strip().lower(), city_b.strip().lower()
    if a == b:
        return 0.0
    if a not in CITY_COORDS or b not in CITY_COORDS:
        return None
    return haversine_km(*CITY_COORDS[a], *CITY_COORDS[b])


# ---------- Budget, location, rating ----------
def allowed_budget(event: EventInput, category: str) -> float:
    if event.category_budget is not None:
        return event.category_budget
    share = CATEGORY_BUDGET_SHARE.get(category, DEFAULT_SHARE)
    return event.total_budget * share


def budget_score(price: float, allowed: float, negotiable: bool) -> float:
    effective = price * NEGOTIABLE_DISCOUNT if negotiable else price
    if allowed <= 0:
        return 1.0 if effective == 0 else 0.0
    ratio = effective / allowed
    if ratio <= 1:
        return 1.0
    return max(0.0, 1 - (ratio - 1) / OVER_BUDGET_LIMIT)


def location_score(distance: Optional[float]) -> float:
    if distance is None:
        return UNKNOWN_LOCATION_SCORE
    return max(0.0, 1 - distance / MAX_DISTANCE_KM)


def rating_score(average: float, count: int) -> float:
    # Bayesian average: few reviews pull the rating toward PRIOR_MEAN
    bayesian = (count * average + PRIOR_WEIGHT * PRIOR_MEAN) / (count + PRIOR_WEIGHT)
    return bayesian / 5


# ---------- Text similarity (TF-IDF + cosine) ----------
def build_query(event: EventInput) -> str:
    parts = [
        event.event_type,
        EVENT_KEYWORDS.get(event.event_type.lower(), ""),
        event.category or "",
        event.preferences or "",
    ]
    return " ".join(p for p in parts if p)


def service_text(s: ServiceInput) -> str:
    return f"{s.title} {s.category} {s.description or ''}"


def text_scores(query: str, services: list[ServiceInput]) -> list[float]:
    """Cosine similarity (0 to 1) between the query and each service text."""
    if not services:
        return []
    docs = [service_text(s) for s in services]
    try:
        vectorizer = TfidfVectorizer(
            stop_words="english", ngram_range=(1, 2), sublinear_tf=True
        )
        matrix = vectorizer.fit_transform(docs + [query])
    except ValueError:
        # Happens when there are no usable words at all
        return [0.0] * len(services)
    sims = cosine_similarity(matrix[-1], matrix[:-1]).ravel()
    return [float(x) for x in sims]


# ---------- Explanations ----------
def build_reasons(
    s: ServiceInput,
    allowed: float,
    effective_price: float,
    dist: Optional[float],
    event: EventInput,
    text: float,
) -> list[str]:
    reasons = []

    if effective_price <= allowed:
        reasons.append(
            f"Price LKR {s.price:,.0f} fits the estimated {s.category.lower()} budget of LKR {allowed:,.0f}"
        )
    elif allowed > 0:
        over = (effective_price / allowed - 1) * 100
        reasons.append(
            f"Price is about {over:.0f}% above the estimated budget of LKR {allowed:,.0f}"
        )
    else:
        reasons.append("No budget is set for this category")

    if s.is_negotiable:
        reasons.append("Price is negotiable")

    if dist is None:
        reasons.append(f"Distance from {event.city} could not be calculated")
    elif dist == 0:
        reasons.append(f"Located in {s.city}, same city as your event")
    else:
        reasons.append(f"About {dist:.0f} km from your event ({s.city})")

    if s.review_count == 0:
        reasons.append("No reviews yet")
    else:
        reasons.append(f"Rated {s.average_rating:.1f}/5 from {s.review_count} reviews")

    if text >= GOOD_TEXT_MATCH:
        reasons.append(f"Description closely matches your {event.event_type} event")

    return reasons


# ---------- Main function ----------
def recommend(
    event: EventInput, services: list[ServiceInput], top_n: int = 10
) -> list[Recommendation]:
    candidates = [
        s
        for s in services
        if not event.category or s.category.lower() == event.category.lower()
    ]
    if not candidates:
        return []

    # Text scores, scaled so the best match among the candidates is 1.0
    raw_text = text_scores(build_query(event), candidates)
    top = max(raw_text) if raw_text else 0.0
    texts = [(x / top if top > 0 else 0.0) for x in raw_text]

    results: list[Recommendation] = []

    for s, t in zip(candidates, texts):
        allowed = allowed_budget(event, s.category)
        effective_price = s.price * NEGOTIABLE_DISCOUNT if s.is_negotiable else s.price

        b = budget_score(s.price, allowed, s.is_negotiable)
        dist = distance_km(event.city, s.city)
        loc = location_score(dist)
        rat = rating_score(s.average_rating, s.review_count)

        total = (
            WEIGHTS["budget"] * b
            + WEIGHTS["location"] * loc
            + WEIGHTS["rating"] * rat
            + WEIGHTS["text"] * t
        )

        results.append(
            Recommendation(
                service_id=s.service_id,
                match_score=round(total * 100, 1),
                breakdown=ScoreBreakdown(
                    budget=round(b, 3),
                    location=round(loc, 3),
                    rating=round(rat, 3),
                    text=round(t, 3),
                ),
                within_budget=effective_price <= allowed,
                distance_km=round(dist, 1) if dist is not None else None,
                reasons=build_reasons(s, allowed, effective_price, dist, event, t),
            )
        )

    results.sort(key=lambda r: r.match_score, reverse=True)
    return results[:top_n]
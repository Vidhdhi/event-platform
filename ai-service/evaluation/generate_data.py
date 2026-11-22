"""Builds a synthetic benchmark with planted ground truth.

Every vendor has a hidden true quality that the ranker never sees. The ranker
only sees noisy signals: an average rating built from a few random reviews, a
price, a city and a description. The relevance labels come from the hidden
quality and from the planner's real needs (real category budget, real travel
limit, wanted specialty), which the ranker does not fully know either.

Run from the ai-service folder:  python -m evaluation.generate_data
"""
import json
import random
from pathlib import Path

from recommender import CATEGORY_BUDGET_SHARE, CITY_COORDS, distance_km

SEED = 2026
N_SERVICES = 600
N_SCENARIOS = 40
OUT = Path(__file__).parent / "benchmark.json"

CATEGORIES = ["Photography", "Catering", "Venue", "Decoration", "Music & DJ", "Makeup"]

SPECIALTIES = {
    "Photography": ["candid outdoor", "studio portraits", "drone aerial", "cinematic video", "traditional ceremony"],
    "Catering": ["vegetarian buffet", "seafood grill", "traditional rice and curry", "western plated dinner", "street food stalls"],
    "Venue": ["beachfront garden", "hotel ballroom", "rooftop terrace", "heritage hall", "conference centre"],
    "Decoration": ["floral arrangements", "balloon arches", "kandyan traditional", "modern minimal", "fairy lights"],
    "Music & DJ": ["live band", "dance DJ", "classical orchestra", "baila party", "acoustic duo"],
    "Makeup": ["bridal makeup", "party glam", "natural look", "kandyan bridal", "airbrush"],
}

BASE_PRICE = {
    "Photography": 150_000,
    "Catering": 350_000,
    "Venue": 450_000,
    "Decoration": 150_000,
    "Music & DJ": 90_000,
    "Makeup": 60_000,
}

FILLERS = [
    "experienced and reliable team",
    "flexible packages for every budget",
    "free consultation before booking",
    "island wide service available",
    "trusted by hundreds of clients",
    "on time and professional",
]

CITIES = ["colombo", "kandy", "galle", "negombo", "jaffna", "kalutara", "matara",
          "kurunegala", "anuradhapura", "nuwara eliya", "ratnapura", "trincomalee", "batticaloa"]
CITY_WEIGHTS = [30, 15, 10, 8, 7, 5, 4, 5, 4, 3, 3, 3, 3]

EVENT_TYPES = ["wedding", "birthday", "corporate"]
EVENT_WEIGHTS = [50, 25, 25]
EVENT_WORDS = {"wedding": "weddings", "birthday": "birthday parties", "corporate": "corporate events"}


def title_case(city: str) -> str:
    return " ".join(w.capitalize() for w in city.split())


def make_service(rng: random.Random, i: int) -> dict:
    category = rng.choice(CATEGORIES)
    specialty = rng.choice(SPECIALTIES[category])
    city = rng.choices(CITIES, CITY_WEIGHTS)[0]
    quality = rng.betavariate(4, 2)  # hidden, mean about 0.67

    # Ratings are noisy and many vendors have few reviews
    count = min(80, int(rng.expovariate(1 / 10)))
    if count == 0:
        average = 0.0
    else:
        stars = [min(5, max(1, round(1 + 4 * quality + rng.gauss(0, 0.9)))) for _ in range(count)]
        average = round(sum(stars) / count, 2)

    price = BASE_PRICE[category] * (0.5 + quality) * rng.lognormvariate(0, 0.25)
    price = max(5_000, round(price / 1_000) * 1_000)

    served = rng.sample(EVENT_TYPES, rng.randint(1, 3))
    description = (
        f"{specialty} {category.lower()} for "
        + " and ".join(EVENT_WORDS[e] for e in served)
        + ". "
        + ". ".join(rng.sample(FILLERS, 2))
    )

    return {
        "service_id": f"S{i:04d}",
        "title": f"{title_case(city)} {category} {i}",
        "description": description,
        "category": category,
        "price": float(price),
        "city": title_case(city),
        "is_negotiable": rng.random() < 0.4,
        "average_rating": average,
        "review_count": count,
        # hidden fields, used only for the labels
        "_quality": round(quality, 4),
        "_specialty": specialty,
    }


def grade(service: dict, scenario: dict) -> int:
    """2 = highly relevant, 1 = acceptable, 0 = not relevant."""
    price = service["price"] * (0.9 if service["is_negotiable"] else 1.0)
    dist = distance_km(scenario["city"], service["city"])
    quality = service["_quality"]
    wants = scenario["wants"]
    specialty_ok = wants is None or service["_specialty"] == wants

    if price <= scenario["true_budget"] and dist <= 100 and quality >= 0.6 and specialty_ok:
        return 2
    if price <= scenario["true_budget"] * 1.15 and dist <= 150 and quality >= 0.5:
        return 1
    return 0


def make_scenario(rng: random.Random, services: list[dict], idx: int) -> dict:
    for _ in range(200):
        category = rng.choice(CATEGORIES)
        city = rng.choices(CITIES, CITY_WEIGHTS)[0]
        event_type = rng.choices(EVENT_TYPES, EVENT_WEIGHTS)[0]
        total = round(rng.uniform(400_000, 3_000_000) / 50_000) * 50_000

        # The planner's real budget for this category differs from the default share
        true_share = CATEGORY_BUDGET_SHARE[category] * rng.uniform(0.6, 1.5)
        wants = rng.choice(SPECIALTIES[category]) if rng.random() < 0.7 else None

        scenario = {
            "id": f"E{idx:02d}",
            "event_type": event_type,
            "city": title_case(city),
            "category": category,
            "total_budget": float(total),
            "true_budget": round(total * true_share),
            "wants": wants,
            "preferences": wants,  # a planner who wants something says so
        }

        pool = [s for s in services if s["category"] == category]
        grades = [grade(s, scenario) for s in pool]
        if grades.count(2) >= 2 and sum(1 for g in grades if g >= 1) >= 5:
            return scenario
    raise RuntimeError("Could not build a scenario with enough relevant vendors")


def main():
    rng = random.Random(SEED)
    services = [make_service(rng, i) for i in range(N_SERVICES)]
    scenarios = [make_scenario(rng, services, i + 1) for i in range(N_SCENARIOS)]

    for sc in scenarios:
        sc["labels"] = {
            s["service_id"]: grade(s, sc) for s in services if s["category"] == sc["category"]
        }

    OUT.write_text(json.dumps({"seed": SEED, "services": services, "scenarios": scenarios}, indent=1))

    graded = [sum(1 for g in sc["labels"].values() if g == 2) for sc in scenarios]
    print(f"Wrote {OUT}")
    print(f"{len(services)} services, {len(scenarios)} scenarios")
    print(f"Highly relevant vendors per scenario: min {min(graded)}, "
          f"median {sorted(graded)[len(graded) // 2]}, max {max(graded)}")
    print(f"Scenarios where the planner typed a preference: "
          f"{sum(1 for sc in scenarios if sc['preferences'])} of {len(scenarios)}")


if __name__ == "__main__":
    main()

import time

from fastapi.testclient import TestClient

from main import app

client = TestClient(app)

EVENT = {
    "event_type": "wedding",
    "city": "Colombo",
    "total_budget": 1_500_000,
    "category": "Photography",
}


def service(i, **overrides):
    base = {
        "service_id": f"s{i}",
        "title": f"Photographer {i}",
        "description": "Wedding photography",
        "category": "Photography",
        "price": 100_000,
        "city": "Colombo",
        "average_rating": 4.0,
        "review_count": 10,
    }
    base.update(overrides)
    return base


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_recommend_returns_ranked_results_with_reasons():
    payload = {
        "event": EVENT,
        "services": [service(1, city="Jaffna"), service(2), service(3, price=900_000)],
        "top_n": 10,
    }
    r = client.post("/recommend", json=payload)
    assert r.status_code == 200
    body = r.json()
    assert body["count"] == 3
    assert body["recommendations"][0]["service_id"] == "s2"
    scores = [x["match_score"] for x in body["recommendations"]]
    assert scores == sorted(scores, reverse=True)
    assert body["recommendations"][0]["reasons"]


def test_missing_event_returns_422():
    r = client.post("/recommend", json={"services": []})
    assert r.status_code == 422


def test_empty_service_list_returns_no_results():
    r = client.post("/recommend", json={"event": EVENT, "services": []})
    assert r.status_code == 200
    assert r.json()["count"] == 0


def test_top_n_is_respected():
    services = [service(i) for i in range(20)]
    r = client.post("/recommend", json={"event": EVENT, "services": services, "top_n": 5})
    assert r.json()["count"] == 5


def test_500_services_are_ranked_in_under_2_seconds():
    cities = ["Colombo", "Kandy", "Galle", "Jaffna"]
    services = [
        service(
            i,
            price=50_000 + i * 1_000,
            city=cities[i % 4],
            description=f"Wedding photography package number {i} with albums",
        )
        for i in range(500)
    ]
    start = time.perf_counter()
    r = client.post("/recommend", json={"event": EVENT, "services": services, "top_n": 10})
    elapsed = time.perf_counter() - start
    assert r.status_code == 200
    assert elapsed < 2.0
    print(f"500 services ranked in {elapsed * 1000:.0f} ms")
    
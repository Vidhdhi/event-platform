from recommender import (
    budget_score,
    build_query,
    distance_km,
    rating_score,
    recommend,
    text_scores,
)
from schemas import EventInput, ServiceInput

EVENT = EventInput(
    event_type="wedding", city="Colombo", total_budget=1_500_000, category="Photography"
)


def make_service(**overrides):
    base = dict(
        service_id="s1",
        title="Test",
        category="Photography",
        price=100_000,
        city="Colombo",
        average_rating=4.0,
        review_count=10,
    )
    base.update(overrides)
    return ServiceInput(**base)


def test_budget_within_limit_is_full_score():
    assert budget_score(100_000, 180_000, False) == 1.0


def test_budget_slightly_over_is_reduced():
    assert 0 < budget_score(200_000, 180_000, False) < 1.0


def test_budget_far_over_is_zero():
    assert budget_score(400_000, 180_000, False) == 0.0


def test_negotiable_scores_higher_when_slightly_over():
    assert budget_score(190_000, 180_000, True) > budget_score(190_000, 180_000, False)


def test_few_reviews_are_pulled_toward_average():
    assert rating_score(5.0, 1) < rating_score(5.0, 50)


def test_distance_same_city_is_zero():
    assert distance_km("Colombo", "colombo") == 0.0


def test_distance_colombo_kandy_is_realistic():
    d = distance_km("Colombo", "Kandy")
    assert 80 < d < 120


def test_distance_unknown_city_is_none():
    assert distance_km("Colombo", "Atlantis") is None


def test_nearer_vendor_ranks_higher():
    near = make_service(service_id="near", city="Colombo")
    far = make_service(service_id="far", city="Jaffna")
    result = recommend(EVENT, [far, near])
    assert result[0].service_id == "near"


def test_over_budget_vendor_ranks_lower():
    ok = make_service(service_id="ok", price=100_000)
    expensive = make_service(service_id="expensive", price=400_000)
    result = recommend(EVENT, [expensive, ok])
    assert result[0].service_id == "ok"
    assert result[1].within_budget is False


def test_category_filter():
    photo = make_service(service_id="photo")
    food = make_service(service_id="food", category="Catering")
    result = recommend(EVENT, [photo, food])
    assert [r.service_id for r in result] == ["photo"]


def test_top_n_limit():
    services = [make_service(service_id=str(i)) for i in range(10)]
    assert len(recommend(EVENT, services, top_n=3)) == 3


def test_scores_are_between_0_and_100():
    services = [make_service(service_id=str(i), price=i * 50_000) for i in range(8)]
    for r in recommend(EVENT, services):
        assert 0 <= r.match_score <= 100


def test_text_scores_prefer_relevant_description():
    event = EventInput(
        event_type="wedding",
        city="Colombo",
        total_budget=1_000_000,
        category="Photography",
        preferences="candid outdoor photos",
    )
    good = make_service(
        service_id="good",
        description="Candid outdoor wedding photography with natural light",
    )
    bad = make_service(
        service_id="bad", description="Studio passport photos and ID pictures"
    )
    scores = text_scores(build_query(event), [good, bad])
    assert scores[0] > scores[1]


def test_text_scores_with_no_usable_words_does_not_crash():
    s = make_service(title="the", category="of", description=None)
    assert text_scores("and", [s]) == [0.0]


def test_preferences_change_the_ranking():
    event = EventInput(
        event_type="wedding",
        city="Colombo",
        total_budget=1_500_000,
        category="Photography",
        preferences="drone aerial shots",
    )
    drone = make_service(
        service_id="drone", description="Drone and aerial wedding photography"
    )
    plain = make_service(
        service_id="plain", description="Traditional studio portraits"
    )
    result = recommend(event, [plain, drone])
    assert result[0].service_id == "drone"
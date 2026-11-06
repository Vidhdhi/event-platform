from typing import Optional

from pydantic import BaseModel, Field


class EventInput(BaseModel):
    event_type: str
    city: str
    total_budget: float = Field(ge=0)
    guest_count: int = Field(default=0, ge=0)
    category: Optional[str] = None          # only recommend this category
    category_budget: Optional[float] = Field(default=None, ge=0)  # overrides the default budget share
    preferences: Optional[str] = None       # free text, e.g. "candid outdoor photos"


class ServiceInput(BaseModel):
    service_id: str
    title: str
    description: Optional[str] = None
    category: str
    price: float = Field(ge=0)
    city: str
    is_negotiable: bool = False
    average_rating: float = Field(default=0, ge=0, le=5)
    review_count: int = Field(default=0, ge=0)


class RecommendRequest(BaseModel):
    event: EventInput
    services: list[ServiceInput]
    top_n: int = Field(default=10, ge=1, le=50)


class ScoreBreakdown(BaseModel):
    budget: float
    location: float
    rating: float
    text: float


class Recommendation(BaseModel):
    service_id: str
    match_score: float                      # 0 to 100
    breakdown: ScoreBreakdown
    within_budget: bool
    distance_km: Optional[float] = None
    reasons: list[str]


class RecommendResponse(BaseModel):
    count: int
    recommendations: list[Recommendation]
    elapsed_ms: float
import os
import secrets
import time
from typing import Optional

from fastapi import Depends, FastAPI, Header, HTTPException

from recommender import recommend
from schemas import RecommendRequest, RecommendResponse

app = FastAPI(title="Event Recommendation Service")


def check_key(x_api_key: Optional[str] = Header(default=None)):
    """If AI_API_KEY is set, every /recommend call must send the same key."""
    expected = os.getenv("AI_API_KEY")
    if expected and not secrets.compare_digest(x_api_key or "", expected):
        raise HTTPException(status_code=401, detail="Invalid API key")


@app.get("/health")
def health():
    return {"status": "ok", "service": "ai"}


@app.post(
    "/recommend",
    response_model=RecommendResponse,
    dependencies=[Depends(check_key)],
)
def recommend_endpoint(req: RecommendRequest):
    start = time.perf_counter()
    recs = recommend(req.event, req.services, req.top_n)
    elapsed_ms = (time.perf_counter() - start) * 1000
    return RecommendResponse(
        count=len(recs),
        recommendations=recs,
        elapsed_ms=round(elapsed_ms, 2),
    )
import time

from fastapi import FastAPI

from recommender import recommend
from schemas import RecommendRequest, RecommendResponse

app = FastAPI(title="Event Recommendation Service")


@app.get("/health")
def health():
    return {"status": "ok", "service": "ai"}


@app.post("/recommend", response_model=RecommendResponse)
def recommend_endpoint(req: RecommendRequest):
    start = time.perf_counter()
    recs = recommend(req.event, req.services, req.top_n)
    elapsed_ms = (time.perf_counter() - start) * 1000
    return RecommendResponse(
        count=len(recs),
        recommendations=recs,
        elapsed_ms=round(elapsed_ms, 2),
    )
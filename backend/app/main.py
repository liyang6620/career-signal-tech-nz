from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .schemas import DimensionScoreRequest, DimensionScoreResponse, RoleFamily
from .scoring import calculate_dimension_score

settings = get_settings()
app = FastAPI(title=settings.app_name, version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "career-signal-api"}


@app.get("/api/v1/roles", response_model=list[RoleFamily])
def roles() -> list[RoleFamily]:
    return [
        RoleFamily(id="software-engineer", label="Software Engineer", status="active"),
        RoleFamily(id="data-bi-analyst", label="Data & BI Analyst", status="active"),
        RoleFamily(id="data-engineer", label="Data Engineer / Analytics Engineer", status="active"),
        RoleFamily(id="ai-application-engineer", label="AI Application Engineer", status="active"),
        RoleFamily(id="cloud-devops", label="Cloud / DevOps", status="planned"),
        RoleFamily(id="qa", label="Quality Engineering", status="planned"),
    ]


@app.post("/api/v1/scoring/dimension", response_model=DimensionScoreResponse)
def score_dimension(payload: DimensionScoreRequest) -> DimensionScoreResponse:
    result = calculate_dimension_score(payload)
    return DimensionScoreResponse(
        **result.__dict__,
        context={
            "target_role": payload.target_role,
            "location": payload.location,
            "seniority": payload.seniority,
            "market_window_days": payload.market_window_days,
        },
    )

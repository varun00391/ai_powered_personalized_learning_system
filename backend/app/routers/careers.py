from fastapi import APIRouter

from app.schemas import CareerOption
from app.services.path_engine import list_careers

router = APIRouter(prefix="/api/v1", tags=["careers"])


@router.get("/careers", response_model=list[CareerOption])
async def careers() -> list[CareerOption]:
    preset = [CareerOption(id=c.id, title=c.title, domain=c.domain, blurb=c.blurb) for c in list_careers()]
    custom = CareerOption(
        id="custom",
        title="Something else…",
        domain="Custom",
        blurb="Describe your own goal in plain language. With GROQ_API_KEY set, we generate a tailored multi-phase path.",
    )
    return preset + [custom]

from fastapi import APIRouter

from app.schemas import CareerOption
from app.services.path_engine import get_career_skill_intake, list_careers

router = APIRouter(prefix="/api/v1", tags=["careers"])


@router.get("/careers", response_model=list[CareerOption])
async def careers() -> list[CareerOption]:
    preset = []
    for c in list_careers():
        ask_py, ask_sql = get_career_skill_intake(c.id)
        preset.append(
            CareerOption(
                id=c.id,
                title=c.title,
                domain=c.domain,
                blurb=c.blurb,
                asks_python=ask_py,
                asks_sql=ask_sql,
            )
        )
    custom = CareerOption(
        id="custom",
        title="Something else…",
        domain="Custom",
        blurb="Describe your own goal in plain language. With GROQ_API_KEY set, we generate a tailored multi-phase path.",
        asks_python=True,
        asks_sql=True,
    )
    return preset + [custom]

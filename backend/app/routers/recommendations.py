import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models import LearningPath, User
from app.schemas import RecommendationItem
from app.services.path_engine import CAREERS

router = APIRouter(prefix="/api/v1", tags=["recommendations"])


@router.get("/recommendations", response_model=list[RecommendationItem])
async def recommendations(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[RecommendationItem]:
    """Cold-start friendly suggestions anchored to the learner's path (including custom goals)."""
    result = await db.execute(
        select(LearningPath).where(LearningPath.user_id == user.id).order_by(LearningPath.created_at.desc())
    )
    lp = result.scalars().first()
    first_skills: list[str] = []
    if lp and lp.phase_nodes and isinstance(lp.phase_nodes, list) and len(lp.phase_nodes) > 0:
        p0 = lp.phase_nodes[0]
        if isinstance(p0, dict):
            sk = p0.get("skills") or []
            if isinstance(sk, list):
                first_skills = [str(s) for s in sk[:3] if str(s).strip()]
    if not first_skills:
        cid = user.career_goal_id or "career_data_engineer"
        career = CAREERS.get(cid, CAREERS["career_data_engineer"])
        first_skills = list(career.phases[0][1][:3]) if career.phases else []

    items: list[RecommendationItem] = []
    for i, skill in enumerate(first_skills):
        items.append(
            RecommendationItem(
                content_id=str(uuid.uuid4()),
                title=f"{skill} — starter module",
                format="video" if (user.learning_style or "video") == "video" else "mixed",
                duration_minutes=25 + i * 10,
                match_reason="On your personalised path — unlocks the next prerequisite cluster.",
            )
        )
    items.append(
        RecommendationItem(
            content_id=str(uuid.uuid4()),
            title="Diagnostic quiz: baseline check-in",
            format="quiz",
            duration_minutes=12,
            match_reason="Replaces guesswork with mastery signals for the adaptive engine.",
        )
    )
    return items

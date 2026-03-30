from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models import LearningPath, User
from app.schemas import LearningPathOut, PhaseOut, PhaseStudyGuideOut
from app.services.path_engine import CAREERS
from app.services.phase_enrichment import enrich_phase_if_needed
from app.services.study_guide import generate_phase_study_guide

router = APIRouter(prefix="/api/v1", tags=["learning-path"])


def _phase_dict_from_path(raw: list, phase_index: int) -> dict | None:
    for p in raw:
        if isinstance(p, dict) and int(p.get("phase_index") or -1) == phase_index:
            return p
    return None


@router.get("/learning-paths/current", response_model=LearningPathOut)
async def get_current_path(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> LearningPathOut:
    result = await db.execute(
        select(LearningPath).where(LearningPath.user_id == user.id).order_by(LearningPath.created_at.desc())
    )
    lp = result.scalars().first()
    if not lp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No learning path yet")
    career = CAREERS.get(lp.career_goal_id)
    title = lp.goal_label or (career.title if career else None)
    if not title and user.custom_goal_text:
        title = user.custom_goal_text.strip()[:120]
    if not title:
        title = lp.career_goal_id
    raw = lp.phase_nodes or []
    phases = [
        PhaseOut.model_validate(enrich_phase_if_needed(p, learning_style=user.learning_style))
        for p in raw
        if isinstance(p, dict)
    ]
    return LearningPathOut(
        id=lp.id,
        career_goal_id=lp.career_goal_id,
        career_title=title,
        phases=phases,
        total_skills=lp.total_skills,
        remaining_skills=lp.remaining_skills,
        total_estimated_hours=lp.total_estimated_hours,
        estimated_weeks_course=lp.estimated_weeks,
        personalization_notes=lp.personalization_notes,
        updated_at=lp.updated_at,
    )


@router.post(
    "/learning-paths/current/phase/{phase_index}/study-guide",
    response_model=PhaseStudyGuideOut,
)
async def post_phase_study_guide(
    phase_index: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> PhaseStudyGuideOut:
    if phase_index < 1:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invalid phase")
    result = await db.execute(
        select(LearningPath).where(LearningPath.user_id == user.id).order_by(LearningPath.created_at.desc())
    )
    lp = result.scalars().first()
    if not lp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No learning path yet")
    raw = lp.phase_nodes or []
    found = _phase_dict_from_path(raw, phase_index)
    if not found:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Phase not found")
    enriched = enrich_phase_if_needed(found, learning_style=user.learning_style)
    content, source = await generate_phase_study_guide(user, enriched)
    return PhaseStudyGuideOut(content=content, source=source)

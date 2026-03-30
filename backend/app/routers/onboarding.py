from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user
from app.models import LearningPath, User
from app.schemas import LearningPathOut, OnboardingAnswers, PhaseOut
from app.services.custom_path import build_custom_personalized_path
from app.services.path_engine import build_personalized_path

router = APIRouter(prefix="/api/v1", tags=["onboarding"])


@router.post("/learner/onboarding", response_model=LearningPathOut)
async def submit_onboarding(
    body: OnboardingAnswers,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> LearningPathOut:
    """Create or **replace** the user's learning path (safe to call again after changing goals)."""
    if body.career_goal_id == "custom":
        assert body.custom_goal_description is not None
        path = await build_custom_personalized_path(
            body.custom_goal_description,
            body.python_level,
            body.sql_level,
            body.learning_style,
            body.hours_per_week,
            body.schedule_flexibility,
            use_groq=bool(settings.groq_api_key),
        )
        user.custom_goal_text = body.custom_goal_description
    else:
        path = build_personalized_path(
            body.career_goal_id,
            body.python_level,
            body.sql_level,
            body.learning_style,
            body.hours_per_week,
            body.schedule_flexibility,
        )
        user.custom_goal_text = None

    user.career_goal_id = path["career_goal_id"]
    user.learning_style = body.learning_style
    user.hours_per_week = body.hours_per_week
    user.experience_band = path["experience_band"]
    user.skill_snapshot = {
        "python_level": body.python_level,
        "sql_level": body.sql_level,
    }
    user.preferred_study_windows = body.preferred_study_windows
    user.schedule_flexibility = body.schedule_flexibility
    user.timezone = body.timezone
    user.onboarding_complete = True

    await db.execute(delete(LearningPath).where(LearningPath.user_id == user.id))
    await db.flush()

    goal_label = path.get("goal_label") or path["career_title"]
    lp = LearningPath(
        user_id=user.id,
        career_goal_id=path["career_goal_id"],
        goal_label=goal_label,
        phase_nodes=path["phases"],
        total_skills=path["total_skills"],
        remaining_skills=path["remaining_skills"],
        total_estimated_hours=path["total_estimated_hours"],
        estimated_weeks=path["estimated_weeks_course"],
        personalization_notes=path["personalization_notes"],
        updated_at=datetime.utcnow(),
    )
    db.add(lp)
    await db.commit()
    await db.refresh(lp)

    return _path_to_out(lp, goal_label)


def _path_to_out(lp: LearningPath, career_title: str) -> LearningPathOut:
    raw = lp.phase_nodes or []
    phases = [PhaseOut.model_validate(p) for p in raw]
    return LearningPathOut(
        id=lp.id,
        career_goal_id=lp.career_goal_id,
        career_title=career_title,
        phases=phases,
        total_skills=lp.total_skills,
        remaining_skills=lp.remaining_skills,
        total_estimated_hours=lp.total_estimated_hours,
        estimated_weeks_course=lp.estimated_weeks,
        personalization_notes=lp.personalization_notes,
        updated_at=lp.updated_at,
    )

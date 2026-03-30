from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user
from app.models import LearningPath, PhaseKnowledgeProgress, User
from app.schemas import (
    KnowledgeCheckOut,
    LearningPathOut,
    PhaseKnowledgeBundleOut,
    PhaseOut,
    PhaseStudyGuideOut,
    QuizAnswerDetailOut,
    QuizResultOut,
    QuizSubmitIn,
    QuizSubmitOut,
)
from app.services.path_engine import CAREERS
from app.services.phase_enrichment import enrich_phase_if_needed
from app.services.study_guide import generate_mcqs_from_study_guide, generate_phase_study_guide

router = APIRouter(prefix="/api/v1", tags=["learning-path"])

_MAX_ATTEMPTS_HISTORY = 50


def _phase_dict_from_path(raw: list, phase_index: int) -> dict | None:
    for p in raw:
        if isinstance(p, dict) and int(p.get("phase_index") or -1) == phase_index:
            return p
    return None


async def _get_current_lp(db: AsyncSession, user_id: str) -> LearningPath | None:
    result = await db.execute(
        select(LearningPath).where(LearningPath.user_id == user_id).order_by(LearningPath.created_at.desc())
    )
    return result.scalars().first()


def _validated_checks_from_raw(raw_checks: list) -> list[KnowledgeCheckOut]:
    out: list[KnowledgeCheckOut] = []
    for item in raw_checks or []:
        if not isinstance(item, dict):
            continue
        try:
            out.append(KnowledgeCheckOut.model_validate(item))
        except ValidationError:
            continue
    return out


def _result_from_stored(d: dict) -> QuizResultOut:
    data = dict(d)
    if "details" not in data:
        data["details"] = []
    return QuizResultOut.model_validate(data)


def _bundle_from_row(row: PhaseKnowledgeProgress) -> PhaseKnowledgeBundleOut:
    raw_checks = row.knowledge_checks if isinstance(row.knowledge_checks, list) else []
    checks = _validated_checks_from_raw(raw_checks)
    last = _result_from_stored(row.last_result) if row.last_result else None
    hist_raw = row.attempts_history if isinstance(row.attempts_history, list) else []
    history: list[QuizResultOut] = []
    for h in hist_raw:
        if isinstance(h, dict):
            try:
                history.append(_result_from_stored(h))
            except ValidationError:
                continue
    return PhaseKnowledgeBundleOut(
        phase_index=row.phase_index,
        knowledge_checks=checks,
        mcq_aligned_to_guide=bool(row.mcq_aligned_to_guide),
        last_result=last,
        attempts_history=history,
    )


async def _upsert_knowledge_snapshot(
    db: AsyncSession,
    lp_id: str,
    phase_index: int,
    checks: list[dict],
    mcq_aligned: bool,
) -> None:
    result = await db.execute(
        select(PhaseKnowledgeProgress).where(
            PhaseKnowledgeProgress.learning_path_id == lp_id,
            PhaseKnowledgeProgress.phase_index == phase_index,
        )
    )
    row = result.scalar_one_or_none()
    now = datetime.utcnow()
    if row:
        row.knowledge_checks = checks
        row.mcq_aligned_to_guide = mcq_aligned
        row.last_result = None
        row.attempts_history = []
        row.updated_at = now
    else:
        db.add(
            PhaseKnowledgeProgress(
                learning_path_id=lp_id,
                phase_index=phase_index,
                knowledge_checks=checks,
                mcq_aligned_to_guide=mcq_aligned,
                last_result=None,
                attempts_history=[],
                updated_at=now,
            )
        )


@router.get("/learning-paths/current", response_model=LearningPathOut)
async def get_current_path(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> LearningPathOut:
    lp = await _get_current_lp(db, user.id)
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


@router.get(
    "/learning-paths/current/phase/{phase_index}/knowledge-checks",
    response_model=PhaseKnowledgeBundleOut,
)
async def get_phase_knowledge_checks(
    phase_index: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> PhaseKnowledgeBundleOut:
    if phase_index < 1:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invalid phase")
    lp = await _get_current_lp(db, user.id)
    if not lp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No learning path yet")
    raw = lp.phase_nodes or []
    if not _phase_dict_from_path(raw, phase_index):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Phase not found")
    result = await db.execute(
        select(PhaseKnowledgeProgress).where(
            PhaseKnowledgeProgress.learning_path_id == lp.id,
            PhaseKnowledgeProgress.phase_index == phase_index,
        )
    )
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Complete the study guide for this phase first.",
        )
    return _bundle_from_row(row)


@router.post(
    "/learning-paths/current/phase/{phase_index}/knowledge-checks/submit",
    response_model=QuizSubmitOut,
)
async def submit_phase_knowledge_checks(
    phase_index: int,
    body: QuizSubmitIn,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> QuizSubmitOut:
    if phase_index < 1:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invalid phase")
    lp = await _get_current_lp(db, user.id)
    if not lp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No learning path yet")
    raw = lp.phase_nodes or []
    if not _phase_dict_from_path(raw, phase_index):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Phase not found")
    result = await db.execute(
        select(PhaseKnowledgeProgress).where(
            PhaseKnowledgeProgress.learning_path_id == lp.id,
            PhaseKnowledgeProgress.phase_index == phase_index,
        )
    )
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Complete the study guide for this phase first.",
        )

    checks_raw = row.knowledge_checks if isinstance(row.knowledge_checks, list) else []
    checks = _validated_checks_from_raw(checks_raw)
    if not checks:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No questions for this phase")
    if len(body.answers) != len(checks):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Expected {len(checks)} answers, got {len(body.answers)}",
        )

    details: list[QuizAnswerDetailOut] = []
    correct = 0
    for i, chk in enumerate(checks):
        ans = body.answers[i]
        n_choices = len(chk.choices)
        if ans < 0 or ans >= n_choices:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid answer index for question {i + 1}",
            )
        is_ok = ans == chk.correct_index
        if is_ok:
            correct += 1
        details.append(
            QuizAnswerDetailOut(
                question_index=i,
                selected_index=ans,
                correct_index=chk.correct_index,
                is_correct=is_ok,
            )
        )

    total = len(checks)
    incorrect = total - correct
    pct = round(100.0 * correct / total, 1) if total else 0.0
    completed_at = datetime.utcnow().replace(microsecond=0).isoformat() + "Z"
    result_dict: dict = {
        "correct": correct,
        "incorrect": incorrect,
        "total": total,
        "score_percent": pct,
        "completed_at": completed_at,
        "answers": list(body.answers),
        "details": [d.model_dump() for d in details],
    }

    row.last_result = result_dict
    hist = list(row.attempts_history) if isinstance(row.attempts_history, list) else []
    hist.append(result_dict)
    row.attempts_history = hist[-_MAX_ATTEMPTS_HISTORY:]
    row.updated_at = datetime.utcnow()

    await db.commit()
    await db.refresh(row)

    qr = QuizResultOut.model_validate(result_dict)
    return QuizSubmitOut(result=qr, bundle=_bundle_from_row(row))


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
    lp = await _get_current_lp(db, user.id)
    if not lp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No learning path yet")
    raw = lp.phase_nodes or []
    found = _phase_dict_from_path(raw, phase_index)
    if not found:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Phase not found")
    enriched = enrich_phase_if_needed(found, learning_style=user.learning_style)
    content, source = await generate_phase_study_guide(user, enriched)

    title = str(enriched.get("title") or "Phase")
    skills = enriched.get("skills") or []
    if not isinstance(skills, list):
        skills = []
    skills = [str(s) for s in skills]

    guide_mcqs_raw: list[dict] = []
    if settings.groq_api_key:
        guide_mcqs_raw = await generate_mcqs_from_study_guide(content, title, skills)

    validated: list[KnowledgeCheckOut] = []
    for item in guide_mcqs_raw:
        try:
            validated.append(KnowledgeCheckOut.model_validate(item))
        except ValidationError:
            continue

    mcq_aligned = len(validated) >= 2
    if not mcq_aligned:
        for item in enriched.get("knowledge_checks") or []:
            if isinstance(item, dict):
                try:
                    validated.append(KnowledgeCheckOut.model_validate(item))
                except ValidationError:
                    continue

    check_dicts = [m.model_dump() for m in validated]
    await _upsert_knowledge_snapshot(db, lp.id, phase_index, check_dicts, mcq_aligned)
    await db.commit()

    return PhaseStudyGuideOut(
        content=content,
        source=source,
        knowledge_checks=validated,
        mcq_aligned_to_guide=mcq_aligned,
    )

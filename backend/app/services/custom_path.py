"""Build a learning path from free-text goals (Groq or offline fallback)."""

from __future__ import annotations

import logging
from typing import Any

from app.services.groq_client import groq_generate_custom_path_json
from app.services.phase_enrichment import enrich_phases_list
from app.services.path_engine import (
    _experience_band,
    _flexibility_week_multiplier,
    _format_mix,
    _skills_to_skip_fraction,
)

logger = logging.getLogger(__name__)

CUSTOM_CAREER_ID = "custom"


def _fallback_phases(goal_snippet: str) -> tuple[str, list[tuple[str, tuple[str, ...], float]]]:
    title = goal_snippet.strip()[:72] + ("…" if len(goal_snippet.strip()) > 72 else "")
    if not title:
        title = "Your learning goal"
    phases: tuple[tuple[str, tuple[str, ...], float], ...] = (
        ("Discovery & scope", ("Goal breakdown", "Success criteria", "Resources map", "Study plan"), 20),
        ("Foundations", ("Core concepts", "Vocabulary", "First exercises"), 36),
        ("Applied practice", ("Guided projects", "Deliberate drills", "Self-check quizzes"), 48),
        ("Depth & integration", ("Advanced topics", "Patterns", "Troubleshooting"), 40),
        ("Consolidation", ("Spaced review", "Teach-back", "Notes system"), 24),
        ("Capstone", (f"Project aligned to: {title[:40]}", "Portfolio / demo"), 28),
    )
    return title, list(phases)


def _normalize_groq_phases(data: dict[str, Any]) -> tuple[str, list[tuple[str, tuple[str, ...], float]]]:
    title = str(data.get("career_title") or "Custom goal").strip()[:120]
    raw_phases = data.get("phases")
    if not isinstance(raw_phases, list) or len(raw_phases) < 3:
        raise ValueError("Invalid phases from model")
    out: list[tuple[str, tuple[str, ...], float]] = []
    for i, p in enumerate(raw_phases[:8]):
        if not isinstance(p, dict):
            continue
        pt = str(p.get("title") or f"Phase {i + 1}").strip()
        skills_raw = p.get("skills")
        if not isinstance(skills_raw, list) or not skills_raw:
            continue
        skills = tuple(str(s).strip() for s in skills_raw if str(s).strip())[:12]
        if not skills:
            continue
        try:
            hrs = float(p.get("estimated_hours", 32))
        except (TypeError, ValueError):
            hrs = 32.0
        hrs = max(8.0, min(hrs, 120.0))
        out.append((pt, skills, hrs))
    if len(out) < 3:
        raise ValueError("Too few phases after normalize")
    return title, out


async def build_custom_personalized_path(
    custom_goal_description: str,
    python_level: str,
    sql_level: str,
    learning_style: str,
    hours_per_week: int,
    schedule_flexibility: str,
    *,
    use_groq: bool,
) -> dict[str, Any]:
    career_title = custom_goal_description.strip()[:120]
    phases_spec: list[tuple[str, tuple[str, ...], float]] = []

    if use_groq:
        try:
            raw = await groq_generate_custom_path_json(
                custom_goal_description.strip(),
                python_level,
                sql_level,
                learning_style,
                hours_per_week,
                schedule_flexibility,
            )
            career_title, spec = _normalize_groq_phases(raw)
            phases_spec = spec
            extra_note = str(raw.get("notes") or "").strip()
        except Exception as e:
            logger.warning("Groq custom path failed, using fallback: %s", e)
            career_title, phases_spec = _fallback_phases(custom_goal_description)
            extra_note = "Generated offline (Groq unavailable or returned invalid JSON)."
    else:
        career_title, phases_spec = _fallback_phases(custom_goal_description)
        extra_note = "Generated offline. Set GROQ_API_KEY for AI-generated paths from your description."

    skip_frac = _skills_to_skip_fraction(python_level.lower(), sql_level.lower())
    flex_m = _flexibility_week_multiplier(schedule_flexibility)
    experience = _experience_band(python_level.lower(), sql_level.lower())

    phases_out: list[dict[str, Any]] = []
    total_hours = 0.0
    total_skills = 0
    for idx, (title, skills, base_h) in enumerate(phases_spec):
        phase_discount = skip_frac * (0.85 if idx == 0 else 0.45 if idx == 1 else 0.2)
        est_hours = max(float(base_h) * (1 - phase_discount), float(base_h) * 0.5)
        weeks = (est_hours / max(hours_per_week, 1)) * flex_m
        total_hours += est_hours
        total_skills += len(skills)
        phases_out.append(
            {
                "phase_index": idx + 1,
                "title": title,
                "skills": list(skills),
                "estimated_hours": round(est_hours, 1),
                "estimated_weeks": round(weeks, 1),
                "suggested_formats": _format_mix(learning_style.lower()),
                "unlocked": idx == 0,
            }
        )

    phases_out = enrich_phases_list(phases_out, learning_style=learning_style.lower())

    course_weeks = round((total_hours / max(hours_per_week, 1)) * flex_m, 1)
    notes = (
        f"{extra_note} Calibrated for {experience} learners, ~{hours_per_week}h/week, "
        f"style {learning_style}. Your goal: «{custom_goal_description.strip()[:200]}»."
    )

    return {
        "career_goal_id": CUSTOM_CAREER_ID,
        "career_title": career_title,
        "goal_label": career_title,
        "phases": phases_out,
        "total_skills": total_skills,
        "remaining_skills": total_skills,
        "total_estimated_hours": round(total_hours, 1),
        "estimated_weeks_course": course_weeks,
        "personalization_notes": notes,
        "experience_band": experience,
    }

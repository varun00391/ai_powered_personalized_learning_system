"""
Knowledge-graph-inspired path generation (in-process MVP).
Maps career goals to phased skill trees and personalizes duration from
declared skill levels, weekly availability, and schedule flexibility.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app.services.phase_enrichment import enrich_phases_list


@dataclass(frozen=True)
class CareerDef:
    id: str
    title: str
    domain: str
    blurb: str
    phases: tuple[tuple[str, tuple[str, ...], float], ...]
    """Each phase: (title, skills, base_hours_for_phase)"""


CAREERS: dict[str, CareerDef] = {
    "career_data_engineer": CareerDef(
        id="career_data_engineer",
        title="Data Engineer",
        domain="Data & ML",
        blurb="Pipelines, warehouses, streaming, and cloud data platforms.",
        phases=(
            ("Foundation", ("Python", "SQL", "Git", "Linux CLI"), 48),
            ("Data fundamentals", ("Relational DBs", "NoSQL", "REST APIs", "Cloud basics"), 36),
            ("Core DE tools", ("Apache Kafka", "Apache Spark", "Airflow", "dbt"), 72),
            ("Cloud platforms", ("AWS data stack", "Data lakes", "Delta Lake"), 48),
            ("Advanced DE", ("Data mesh", "Feature stores", "Streaming pipelines"), 48),
            ("Capstone", ("End-to-end pipeline project", "Portfolio"), 24),
        ),
    ),
    "career_ml_engineer": CareerDef(
        id="career_ml_engineer",
        title="ML Engineer",
        domain="Data & ML",
        blurb="Model training, deployment, and reliable ML systems.",
        phases=(
            ("Math & Python", ("Linear algebra", "Probability", "Python for ML"), 40),
            ("ML foundations", ("Supervised learning", "Model evaluation", "Feature engineering"), 56),
            ("Deep learning", ("Neural nets", "PyTorch", "Transformers basics"), 64),
            ("MLOps", ("Experiment tracking", "Serving", "Monitoring", "CI/CD for ML"), 48),
            ("Production", ("Scaling", "Cost/latency tradeoffs", "Safety"), 32),
            ("Capstone", ("Deployed model + case study",), 24),
        ),
    ),
    "career_fullstack": CareerDef(
        id="career_fullstack",
        title="Full-Stack Developer",
        domain="Software",
        blurb="Modern web apps from database to polished UI.",
        phases=(
            ("Web foundations", ("HTML/CSS", "JavaScript", "HTTP", "Git"), 32),
            ("Frontend", ("React", "State management", "Accessibility"), 48),
            ("Backend", ("REST APIs", "Auth", "PostgreSQL"), 48),
            ("DevOps lite", ("Docker", "CI basics", "Cloud deploy"), 32),
            ("Polish", ("Testing", "Performance", "Security mindset"), 24),
            ("Capstone", ("Full-stack product",), 32),
        ),
    ),
    "career_cloud_architect": CareerDef(
        id="career_cloud_architect",
        title="Cloud Architect",
        domain="Infrastructure",
        blurb="Design resilient, cost-aware systems on major clouds.",
        phases=(
            ("Networking & IAM", ("VPC", "Identity", "Zero trust basics"), 28),
            ("Compute & storage", ("EC2/VMs", "Object storage", "Databases"), 36),
            ("Reliability", ("Load balancing", "Auto scaling", "Backups"), 32),
            ("Observability", ("Metrics", "Logs", "Tracing", "SLOs"), 24),
            ("Cost & governance", ("FinOps", "Landing zones", "Compliance"), 20),
            ("Capstone", ("Architecture doc + diagram set",), 20),
        ),
    ),
}


def list_careers() -> list[CareerDef]:
    return list(CAREERS.values())


def _experience_band(python_level: str, sql_level: str) -> str:
    scores = []
    for p in (python_level, sql_level):
        if p in ("beginner", "never"):
            scores.append(0)
        elif p in ("some", "basics"):
            scores.append(1)
        else:
            scores.append(2)
    avg = sum(scores) / len(scores)
    if avg < 0.7:
        return "beginner"
    if avg < 1.5:
        return "intermediate"
    return "advanced"


def _skills_to_skip_fraction(python_level: str, sql_level: str) -> float:
    """Approximate 'mastery overlay': higher skill → fewer remaining hours in early phases."""
    skip = 0.0
    if python_level == "comfortable":
        skip += 0.12
    elif python_level == "some":
        skip += 0.05
    if sql_level == "proficient":
        skip += 0.10
    elif sql_level == "basics":
        skip += 0.04
    return min(skip, 0.35)


def _flexibility_week_multiplier(flex: str) -> float:
    return {
        "rigid": 1.12,
        "somewhat_flexible": 1.0,
        "very_flexible": 0.94,
    }.get(flex, 1.0)


def _format_mix(learning_style: str) -> list[str]:
    base = ["video", "reading", "hands-on lab", "quiz checkpoints"]
    if learning_style == "video":
        return ["video-first modules", "short readings", "labs"]
    if learning_style == "reading":
        return ["deep-dive articles", "video supplements", "note-taking templates"]
    return ["project sprints", "pair-style prompts", "micro-videos"]


def build_personalized_path(
    career_goal_id: str,
    python_level: str,
    sql_level: str,
    learning_style: str,
    hours_per_week: int,
    schedule_flexibility: str,
) -> dict[str, Any]:
    career = CAREERS.get(career_goal_id)
    if not career:
        career = CAREERS["career_data_engineer"]

    skip_frac = _skills_to_skip_fraction(python_level.lower(), sql_level.lower())
    flex_m = _flexibility_week_multiplier(schedule_flexibility)
    experience = _experience_band(python_level.lower(), sql_level.lower())

    phases_out: list[dict[str, Any]] = []
    total_hours = 0.0
    total_skills = 0
    for idx, (title, skills, base_h) in enumerate(career.phases):
        phase_discount = skip_frac * (0.9 if idx == 0 else 0.5 if idx == 1 else 0.25)
        est_hours = max(base_h * (1 - phase_discount), base_h * 0.55)
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
        f"Calibrated for {experience} learners with ~{hours_per_week}h/week. "
        f"Style: {learning_style}. Flexibility factor applied for scheduling realism."
    )

    return {
        "career_goal_id": career.id,
        "career_title": career.title,
        "goal_label": career.title,
        "phases": phases_out,
        "total_skills": total_skills,
        "remaining_skills": total_skills,
        "total_estimated_hours": round(total_hours, 1),
        "estimated_weeks_course": course_weeks,
        "personalization_notes": notes,
        "experience_band": experience,
    }

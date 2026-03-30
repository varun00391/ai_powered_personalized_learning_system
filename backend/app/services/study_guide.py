"""AI-generated or templated study guide text for a single learning-path phase."""

from __future__ import annotations

import json
from typing import Any

from app.config import settings
from app.models import User
from app.services.groq_client import groq_chat_completion


def _template_guide(user: User, phase: dict[str, Any]) -> str:
    title = phase.get("title") or "This phase"
    skills = phase.get("skills") or []
    skills_txt = ", ".join(str(s) for s in skills) if skills else "the listed topics"
    goal = user.custom_goal_text or user.career_goal_id or "your learning goal"
    lines = [
        f"## Overview",
        f"This phase — **{title}** — supports **{goal}**. Focus on: {skills_txt}.",
        "",
        "## What you should be able to do",
    ]
    for o in phase.get("learning_objectives") or []:
        lines.append(f"- {o}")
    lines.extend(["", "## How to study", ""])
    for t in phase.get("study_tips") or []:
        lines.append(f"- {t}")
    lines.extend(["", "## Practice ideas", ""])
    for a in phase.get("key_activities") or []:
        lines.append(f"- {a}")
    lines.extend(
        [
            "",
            "## Before the quiz",
            "When you can explain the main ideas aloud and complete one small practice task without notes, move on to the knowledge checks on the next screen.",
        ]
    )
    return "\n".join(lines)


async def generate_phase_study_guide(user: User, phase: dict[str, Any]) -> tuple[str, str]:
    """
    Returns (content_markdown, source) where source is 'groq' or 'template'.
    """
    if not settings.groq_api_key:
        return _template_guide(user, phase), "template"

    title = str(phase.get("title") or "Phase")
    skills = phase.get("skills") or []
    goal = user.custom_goal_text or user.career_goal_id or "unspecified goal"
    payload = {
        "learner_goal": goal,
        "phase_title": title,
        "phase_skills": skills,
        "estimated_hours": phase.get("estimated_hours"),
        "learning_style": user.learning_style,
        "experience_band": user.experience_band,
    }
    system = """You write concise, practical study guides for adult self-learners.
Output plain Markdown only (no outer code fences). Use:
- ## for 3–5 section headings (Overview, Core concepts, Study plan, Pitfalls, Next steps)
- Short paragraphs and bullet lists
- No fluff; actionable steps and checkpoints
- Tie content explicitly to the phase skills listed
Keep total length roughly 400–700 words."""
    user_msg = "Generate a study guide for this phase:\n" + json.dumps(payload, ensure_ascii=False, indent=2)
    try:
        text = await groq_chat_completion(
            [{"role": "system", "content": system}, {"role": "user", "content": user_msg}],
            max_tokens=2000,
            temperature=0.4,
        )
        text = text.strip()
        if text.startswith("```"):
            lines = text.split("\n")
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            text = "\n".join(lines).strip()
        if len(text) < 80:
            return _template_guide(user, phase), "template"
        return text, "groq"
    except Exception:
        return _template_guide(user, phase), "template"

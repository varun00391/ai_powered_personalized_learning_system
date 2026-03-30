"""AI-generated or templated study guide text for a single learning-path phase."""

from __future__ import annotations

import json
import logging
import re
from typing import Any

from app.config import settings
from app.models import User
from app.services.groq_client import groq_chat_completion

logger = logging.getLogger(__name__)

_MAX_GUIDE_CHARS_FOR_MCQ = 28_000


def _strip_json_fence(text: str) -> str:
    t = text.strip()
    if t.startswith("```"):
        t = re.sub(r"^```(?:json)?\s*", "", t, flags=re.IGNORECASE)
        t = re.sub(r"\s*```$", "", t)
    return t.strip()


def _normalize_mcq_dict(raw: dict[str, Any]) -> dict[str, Any] | None:
    q = str(raw.get("question", "")).strip()
    choices_raw = raw.get("choices")
    if not isinstance(choices_raw, list) or len(choices_raw) < 2:
        return None
    choices = [str(c).strip() for c in choices_raw if str(c).strip()][:8]
    if len(choices) < 2:
        return None
    try:
        ci = int(raw.get("correct_index", 0))
    except (TypeError, ValueError):
        return None
    if ci < 0 or ci >= len(choices):
        return None
    exp = str(raw.get("explanation", "")).strip()
    if not q:
        return None
    return {"question": q, "choices": choices, "correct_index": ci, "explanation": exp}


async def generate_mcqs_from_study_guide(
    guide_markdown: str,
    phase_title: str,
    skills: list[str],
) -> list[dict[str, Any]]:
    """
    LLM-generated MCQs grounded in the study guide text (requires GROQ_API_KEY).
    """
    if not settings.groq_api_key or not (guide_markdown or "").strip():
        return []

    snippet = guide_markdown.strip()[:_MAX_GUIDE_CHARS_FOR_MCQ]
    skills_txt = ", ".join(str(s) for s in skills[:20]) if skills else "(see guide)"

    system = """You write multiple-choice questions for a learner who just read a study guide.
Return ONLY a JSON array (no markdown code fences). The array must have exactly 4 objects.
Each object must be:
{"question": "<string>", "choices": ["<A>","<B>","<C>","<D>"], "correct_index": <0-3>, "explanation": "<why the answer is correct>"}

Strict rules:
- Every question MUST test understanding of specific facts, definitions, steps, or ideas that appear in the STUDY GUIDE body below. Do not ask about topics that are not covered there.
- Do not copy section headings only — test substance (concepts, tradeoffs, procedures) from the paragraphs and bullets.
- exactly 4 choices per question; one clearly correct per the guide; plausible distractors.
- Vary question style: mix recall and short application.
- If the guide is thin on a topic, still only ask what the guide actually states."""

    user_msg = (
        f"Phase title: {phase_title}\n"
        f"Skill labels (context only; questions must still be answerable from the guide): {skills_txt}\n\n"
        f"--- STUDY GUIDE (sole source of truth for questions) ---\n{snippet}\n"
        f"--- END STUDY GUIDE ---\n\n"
        "Produce the JSON array now."
    )

    try:
        raw = await groq_chat_completion(
            [{"role": "system", "content": system}, {"role": "user", "content": user_msg}],
            max_tokens=1400,
            temperature=0.25,
        )
        parsed = json.loads(_strip_json_fence(raw))
    except (json.JSONDecodeError, TypeError, ValueError) as e:
        logger.warning("MCQ JSON parse failed: %s", e)
        return []
    except Exception as e:
        logger.warning("MCQ Groq call failed: %s", e)
        return []

    if not isinstance(parsed, list):
        return []

    out: list[dict[str, Any]] = []
    for item in parsed[:6]:
        if not isinstance(item, dict):
            continue
        norm = _normalize_mcq_dict(item)
        if norm:
            out.append(norm)
    return out[:4]


def _template_guide(user: User, phase: dict[str, Any]) -> str:
    title = phase.get("title") or "This phase"
    skills = phase.get("skills") or []
    skills = [str(s) for s in skills] if skills else []
    skills_txt = ", ".join(skills) if skills else "the listed topics"
    goal = user.custom_goal_text or user.career_goal_id or "your learning goal"
    objectives = phase.get("learning_objectives") or []
    tips = phase.get("study_tips") or []
    activities = phase.get("key_activities") or []

    lines: list[str] = [
        "## Phase introduction",
        f"This phase — **{title}** — supports **{goal}**.",
        f"You will work through **{len(skills) or 'several'} topic(s)** in order: {skills_txt}.",
        "Read each lesson below before moving on; use the knowledge checks after you finish all lessons.",
        "",
        "### Learning objectives for this phase",
    ]
    for o in objectives:
        lines.append(f"- {o}")
    if not objectives:
        lines.append("- Build a clear mental model of each topic and how it fits your goal.")
    lines.append("")

    for skill in skills:
        lines.extend(
            [
                f"## Topic: {skill}",
                "",
                "### What this is",
                f"**{skill}** is one building block of this phase. Define it in your own words after reading a short trusted overview (docs, course chapter, or article).",
                "",
                "### Why it matters",
                "Understand how this topic connects to the phase title and your overall goal. Note one real-world situation where it applies.",
                "",
                "### Core ideas to master",
                "- Main definitions and terminology.",
                "- Typical workflow or pipeline steps involving this topic.",
                "- How it depends on (or enables) other skills in this phase.",
                "",
                "### How to study it",
                "- Skim then re-read with notes; draw a simple diagram if it helps.",
                "- Complete one small exercise or example before the next lesson.",
                "",
                "### Check your understanding",
                "- Can you explain this topic to a peer in two minutes?",
                "- What is the most common mistake beginners make here?",
                "",
            ]
        )

    if not skills:
        lines.extend(
            [
                "## Topic: Phase focus",
                "",
                "### What to learn",
                f"Use external resources to go deep on: {skills_txt}.",
                "",
            ]
        )

    lines.extend(
        [
            "## Study habits and practice",
            "",
            "### Tips",
        ]
    )
    for t in tips:
        lines.append(f"- {t}")
    if not tips:
        lines.append("- Study in focused blocks; alternate reading with short practice.")
    lines.extend(["", "### Suggested activities", ""])
    for a in activities:
        lines.append(f"- {a}")
    if not activities:
        lines.append("- Build a minimal project or notebook that touches each major idea.")
    lines.extend(
        [
            "",
            "## Synthesis and next steps",
            "Review your notes across all topics. When you can summarize how the pieces fit together, proceed to the **knowledge checks** (MCQs) on the next step.",
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
    system = """You write in-depth study material for adult self-learners (tutorial quality, not a shallow overview).

Output **plain Markdown only** (no outer code fences). Structure is mandatory:

1. Start with exactly one section: `## Phase introduction`
   - What this phase covers and how it serves the learner's goal.
   - A short roadmap listing every phase skill and the order to study them.

2. For **each** item in `phase_skills` (same order as in JSON), add one top-level section:
   `## Topic: <skill name>` (use the skill string from the list; you may shorten slightly if redundant).
   Inside each topic, use these ### subsections in order (substantive paragraphs + bullets; not one-liners):
   - `### What it is` — clear definitions, scope, what is in/out of scope.
   - `### Why it matters` — motivation, links to the phase title and goal.
   - `### How it works` — mechanics, steps, architectures, or workflows as appropriate; use examples.
   - `### Connections` — how this skill relates to other skills in this phase (dependencies, contrasts).
   - `### Common pitfalls` — typical misconceptions and how to avoid them.
   - `### Check your understanding` — 2–3 reflective prompts (not multiple-choice) the learner answers in their head or notes.

3. End with `## Synthesis and next steps`
   - Integrate themes across topics; what to practice next; when they are ready for a knowledge check.

Rules:
- Top-level sections must use `##` only for: Phase introduction, each Topic: …, and Synthesis (no other stray `##`).
- Use `###` for subsections inside a topic.
- Teach thoroughly: a motivated beginner should finish with real understanding, not buzzwords.
- Cover **every** listed phase skill with comparable depth (do not skip or merge skills into one vague section).
- If a skill name is broad (e.g. "Deep Learning"), break concepts down inside that topic without adding extra top-level `##` sections.
- Prefer clarity over length, but this is **long-form** material: aim for roughly 250–500+ words per topic when there are multiple skills."""
    user_msg = "Generate the full multi-lesson study guide for this phase:\n" + json.dumps(
        payload, ensure_ascii=False, indent=2
    )
    try:
        text = await groq_chat_completion(
            [{"role": "system", "content": system}, {"role": "user", "content": user_msg}],
            max_tokens=8192,
            temperature=0.35,
        )
        text = text.strip()
        if text.startswith("```"):
            lines = text.split("\n")
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            text = "\n".join(lines).strip()
        if len(text) < 400:
            return _template_guide(user, phase), "template"
        return text, "groq"
    except Exception:
        return _template_guide(user, phase), "template"

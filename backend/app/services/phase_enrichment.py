"""
Rich phase content: objectives, study tips, activities, and knowledge-check MCQs.
Used when building paths and as a backfill for older stored paths (no video CMS yet).
"""

from __future__ import annotations

from typing import Any


def _skill_sample(skills: list[str], n: int) -> list[str]:
    out = [s for s in skills if s and str(s).strip()]
    return out[:n] if len(out) >= n else out + ["core topics"] * max(0, n - len(out))


def _objectives(phase_title: str, skills: list[str]) -> list[str]:
    a, b, c = _skill_sample(skills, 3)
    return [
        f"Explain how «{a}» supports outcomes in «{phase_title}».",
        f"Apply «{b}» in a small exercise or mini-project (1–2 hours).",
        f"Self-assess readiness to move on using a checklist covering «{c}» and related ideas.",
    ]


def _tips(learning_style_hint: str | None = None) -> list[str]:
    base = [
        "Spend 25–50% of phase time on active practice, not only reading or watching.",
        "After each session, write one paragraph: what changed in your mental model?",
        "Teach the hardest idea aloud in 2 minutes — gaps become obvious.",
    ]
    if learning_style_hint == "video":
        base.insert(0, "Take timestamped notes; pause and predict the next step before the instructor shows it.")
    elif learning_style_hint == "reading":
        base.insert(0, "For each chapter, end with 3 bullet takeaways and 1 question you still have.")
    elif learning_style_hint == "hands-on":
        base.insert(0, "Keep a running repo or notebook; commit after every working milestone.")
    return base


def _activities(phase_title: str, skills: list[str]) -> list[str]:
    s1, s2 = _skill_sample(skills, 2)
    return [
        f"Build a cheat-sheet (1 page) mapping terms in «{phase_title}» to short definitions.",
        f"Complete a focused drill on «{s1}» with a concrete input/output example.",
        f"Pair «{s1}» with «{s2}» in one integrated task relevant to your overall goal.",
    ]


def _mcq_why_in_phase(skill: str, phase_title: str) -> dict[str, Any]:
    return {
        "question": f"Why is «{skill}» typically part of the phase «{phase_title}»?",
        "choices": [
            "It is optional filler with no impact on later work",
            "It builds capability that other topics in this phase assume or extend",
            "It should be deferred until after the capstone project",
            "It replaces the need to practice with real examples",
        ],
        "correct_index": 1,
        "explanation": f"Phases group prerequisites together; «{skill}» usually unlocks or deepens adjacent skills.",
    }


def _mcq_best_activity(skill: str, phase_title: str) -> dict[str, Any]:
    return {
        "question": f"Which activity best deepens understanding of «{skill}» during «{phase_title}»?",
        "choices": [
            "Only re-reading definitions without examples",
            "Implementing a minimal end-to-end example and varying one parameter at a time",
            "Skipping exercises if the concepts feel familiar",
            "Memorizing acronyms without using them in context",
        ],
        "correct_index": 1,
        "explanation": "Deliberate practice with feedback loops beats passive review for technical skills.",
    }


def _mcq_synthesis(phase_title: str, skills: list[str]) -> dict[str, Any]:
    s1 = _skill_sample(skills, 1)[0]
    return {
        "question": f"What signals that you are ready to leave «{phase_title}»?",
        "choices": [
            "You finished all videos regardless of recall",
            "You can explain tradeoffs and complete a small task using «{s1}» without step-by-step help",
            "You read the syllabus once",
            "You compared your progress only to others’ timelines",
        ],
        "correct_index": 1,
        "explanation": "Mastery is demonstrated by explanation plus independent application, not consumption volume.",
    }


def _knowledge_checks(phase_title: str, skills: list[str]) -> list[dict[str, Any]]:
    sk = [str(s).strip() for s in skills if str(s).strip()]
    checks: list[dict[str, Any]] = []
    if sk:
        checks.append(_mcq_why_in_phase(sk[0], phase_title))
    if len(sk) > 1:
        checks.append(_mcq_best_activity(sk[1], phase_title))
    else:
        checks.append(_mcq_best_activity(sk[0], phase_title))
    checks.append(_mcq_synthesis(phase_title, sk or ["this phase’s skills"]))
    return checks[:4]


def enrich_phase(phase: dict[str, Any], *, learning_style: str | None = None) -> dict[str, Any]:
    """Return a new dict with objectives, tips, activities, and MCQs merged in."""
    title = str(phase.get("title") or "This phase")
    skills = phase.get("skills") or []
    if not isinstance(skills, list):
        skills = []
    skills = [str(s) for s in skills]

    style = (learning_style or "").lower() if learning_style else None
    if style not in ("video", "reading", "hands-on"):
        style = None

    out = dict(phase)
    out["learning_objectives"] = _objectives(title, skills)
    out["study_tips"] = _tips(style)
    out["key_activities"] = _activities(title, skills)
    out["knowledge_checks"] = _knowledge_checks(title, skills)
    return out


def enrich_phases_list(phases: list[dict[str, Any]], *, learning_style: str | None = None) -> list[dict[str, Any]]:
    return [enrich_phase(p, learning_style=learning_style) for p in phases]


def enrich_phase_if_needed(phase: dict[str, Any], *, learning_style: str | None = None) -> dict[str, Any]:
    """Backfill enrichment for paths stored before these fields existed."""
    existing = phase.get("knowledge_checks")
    if isinstance(existing, list) and len(existing) > 0:
        return phase
    return enrich_phase(phase, learning_style=learning_style)

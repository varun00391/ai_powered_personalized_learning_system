"""Groq OpenAI-compatible chat API."""

from __future__ import annotations

import json
import re

import httpx

from app.config import settings

GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions"


def _strip_json_fence(text: str) -> str:
    t = text.strip()
    if t.startswith("```"):
        t = re.sub(r"^```(?:json)?\s*", "", t, flags=re.IGNORECASE)
        t = re.sub(r"\s*```$", "", t)
    return t.strip()


async def groq_chat_completion(
    messages: list[dict[str, str]],
    *,
    max_tokens: int = 1024,
    temperature: float = 0.45,
) -> str:
    if not settings.groq_api_key:
        raise RuntimeError("GROQ_API_KEY is not set")
    payload = {
        "model": settings.groq_model,
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": temperature,
    }
    headers = {
        "Authorization": f"Bearer {settings.groq_api_key}",
        "Content-Type": "application/json",
    }
    async with httpx.AsyncClient(timeout=90.0) as client:
        r = await client.post(GROQ_CHAT_URL, json=payload, headers=headers)
    if r.status_code != 200:
        raise RuntimeError(f"Groq HTTP {r.status_code}: {r.text[:500]}")
    data = r.json()
    return str(data["choices"][0]["message"]["content"] or "").strip()


async def groq_generate_custom_path_json(
    learner_goal: str,
    python_level: str,
    sql_level: str,
    learning_style: str,
    hours_per_week: int,
    schedule_flexibility: str,
) -> dict:
    """Ask Groq for a strict JSON learning path. Raises on failure."""
    system = """You design concise, ordered learning roadmaps for adult learners.
Return ONLY valid JSON (no markdown fences, no commentary) with this shape:
{
  "career_title": "short human-readable title for the goal (max 80 chars)",
  "phases": [
    {
      "title": "phase name",
      "skills": ["skill or topic 1", "skill 2", "..."],
      "estimated_hours": 24
    }
  ],
  "notes": "one sentence tailoring hint"
}
Rules:
- Exactly 5 or 6 phases.
- Each phase: 3–7 specific skills/topics relevant to the learner's stated goal.
- estimated_hours per phase: integer, sum roughly 120–280 total depending on breadth of goal.
- Order prerequisites before advanced topics.
- Respect the learner's Python/SQL level: omit or de-emphasize basics in early phases if they are already strong (encode as fewer hours in early phases rather than empty phases)."""
    user = json.dumps(
        {
            "learner_goal": learner_goal,
            "python_level": python_level,
            "sql_level": sql_level,
            "preferred_style": learning_style,
            "hours_per_week": hours_per_week,
            "schedule_flexibility": schedule_flexibility,
        },
        ensure_ascii=False,
    )
    raw = await groq_chat_completion(
        [{"role": "system", "content": system}, {"role": "user", "content": user}],
        max_tokens=1800,
        temperature=0.35,
    )
    parsed = json.loads(_strip_json_fence(raw))
    if not isinstance(parsed, dict):
        raise ValueError("Groq path: not an object")
    return parsed

import httpx
from fastapi import APIRouter, Depends, HTTPException

from app.config import settings
from app.dependencies import get_current_user
from app.models import User
from app.schemas import TutorChatRequest, TutorPhaseContext, TutorReply

router = APIRouter(prefix="/api/v1/tutor", tags=["tutor"])

SYSTEM_PROMPT = """You are LearnGuide, a concise, friendly learning coach for a personalised platform.
Ground answers in sound pedagogy: short paragraphs, bullet steps when helpful, one clarifying question at the end if useful.
If the learner references earlier messages, stay consistent with the thread.
Learner profile and optional phase focus are included after this paragraph."""

MAX_HISTORY_TURNS = 24


def _trim_messages(messages: list) -> list:
    if len(messages) <= MAX_HISTORY_TURNS:
        return messages
    return messages[-MAX_HISTORY_TURNS:]


def _strip_leading_assistant_turns(messages: list) -> list:
    """Some chat models expect the first non-system role to be `user`."""
    i = 0
    while i < len(messages) and messages[i].role == "assistant":
        i += 1
    return messages[i:]


def _profile_block(user: User) -> str:
    goal_line = user.custom_goal_text or user.career_goal_id or "unspecified"
    return (
        "[Learner profile]\n"
        f"Goal: {goal_line}\n"
        f"preset_id: {user.career_goal_id}\n"
        f"learning_style: {user.learning_style}\n"
        f"hours_per_week: {user.hours_per_week}\n"
        f"experience_band: {user.experience_band}\n"
    )


def _phase_block(phase: TutorPhaseContext) -> str:
    skills = ", ".join(phase.skills[:24]) if phase.skills else "(none listed)"
    fmts = ", ".join(phase.suggested_formats or []) if phase.suggested_formats else ""
    hrs = phase.estimated_hours
    return (
        "[Phase focus]\n"
        f"The learner has selected Phase {phase.phase_index}: {phase.title}\n"
        f"Skills/topics: {skills}\n"
        f"Estimated hours (rough): {hrs}\n"
        f"Suggested formats: {fmts or 'mixed'}\n"
        "Prioritize help relevant to this phase when answering.\n"
    )


@router.post("/chat", response_model=TutorReply)
async def tutor_chat(body: TutorChatRequest, user: User = Depends(get_current_user)) -> TutorReply:
    if settings.groq_api_key:
        return await _groq_reply(user, body)
    return _offline_reply(user, body)


def _offline_reply(user: User, body: TutorChatRequest) -> TutorReply:
    last = body.messages[-1].content.strip()
    goal = user.custom_goal_text or user.career_goal_id or "your goal"
    style = user.learning_style or "mixed formats"
    hours = user.hours_per_week or 5
    thread_note = " (continuing your thread) " if len(body.messages) > 1 else " "
    phase_note = ""
    if body.phase_context:
        pc = body.phase_context
        phase_note = f"\n\nYou're focused on **Phase {pc.phase_index}: {pc.title}**."
    text = (
        f"I've noted you're working toward **{goal}** with about **{hours}h/week**, "
        f"preferring **{style}** learning.{phase_note}\n\n"
        f"On **{last[:500]}**{thread_note}: start with the smallest concrete step "
        f"(5–15 minutes), then self-check with one question or mini exercise. "
        f"If you share the exact topic or error message, I can go deeper.\n\n"
        "_Tip: set **GROQ_API_KEY** on the API for full multi-turn LLM tutoring via Groq._"
    )
    return TutorReply(reply=text, agent="LearnGuide (offline)")


async def _groq_reply(user: User, body: TutorChatRequest) -> TutorReply:
    system_extra = _profile_block(user)
    if body.phase_context:
        system_extra += "\n" + _phase_block(body.phase_context)

    trimmed = _strip_leading_assistant_turns(_trim_messages(body.messages))
    groq_messages: list[dict[str, str]] = [
        {"role": "system", "content": SYSTEM_PROMPT + "\n\n" + system_extra},
    ]
    for turn in trimmed:
        groq_messages.append({"role": turn.role, "content": turn.content})

    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.groq_api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": settings.groq_model,
        "messages": groq_messages,
        "max_tokens": 1024,
        "temperature": 0.55,
    }
    async with httpx.AsyncClient(timeout=90.0) as client:
        r = await client.post(url, json=payload, headers=headers)
    if r.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Tutor upstream error: {r.text[:300]}")
    data = r.json()
    try:
        reply = data["choices"][0]["message"]["content"].strip()
    except (KeyError, IndexError) as e:
        raise HTTPException(status_code=502, detail="Malformed tutor response") from e
    return TutorReply(reply=reply, agent=f"LearnGuide ({settings.groq_model})")

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
        "### Phase roadmap (template diagram)",
        "Adapt the nodes to your real stack:",
        "",
        "```mermaid",
        "flowchart TB",
        "  subgraph P[Phase scope]",
        "    A[Foundations] --> B[Core tools]",
        "    B --> C[Integration]",
        "    C --> D[Production]",
        "  end",
        "```",
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
                "### What it is (technical)",
                f"**{skill}** — write a precise definition: components, boundaries, and how practitioners measure success (latency, throughput, correctness, cost).",
                "",
                "### Why it matters",
                "Link to production scenarios: failure modes, trade-offs, and what breaks if this is done wrong.",
                "",
                "### How it works",
                "- Step-by-step data/control flow or lifecycle.",
                "- Key algorithms, protocols, file formats, or APIs (name them).",
                "- Example: a minimal concrete scenario (e.g. sample command, query shape, or config snippet in backticks).",
                "",
                "### Comparison or parameters",
                "Use a small Markdown **table** comparing 2–3 common options (pros/cons or when to choose each), if relevant.",
                "",
                "### Diagram",
                "Sketch the idea with a **Mermaid** diagram in a fenced block (` ```mermaid ` … ` ``` `). Example flowchart or sequenceDiagram tailored to this topic.",
                "",
                "### Pitfalls & operations",
                "- Sharp edges in real systems (versioning, security, observability).",
                "- What to monitor or test first.",
                "",
                "### Check your understanding",
                "- Can you draw the flow without looking?",
                "- What would you change under 10× load or stricter compliance?",
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
    system = """You write **technical, in-depth** study material for serious adult learners (engineering / data / CS level — not marketing blurbs or vague overviews).

Output **GitHub-flavored Markdown only** (no outer wrapper code fence around the whole document). Structure is mandatory:

1. `## Phase introduction`
   - Scope of the phase and how it advances `learner_goal`.
   - Explicit **roadmap**: list every `phase_skills` entry in study order.
   - Optional: one **Mermaid** diagram (` ```mermaid ` … ` ``` `) showing how phase topics connect (flowchart, graph, or sequenceDiagram). Use valid Mermaid only.

2. For **each** string in `phase_skills` (same order), one section: `## Topic: <skill name>`.
   Inside each topic, use **all** of these `###` subsections (dense paragraphs + bullets; include real terminology, metrics, and trade-offs):
   - `### What it is` — precise definition; boundaries; what is in/out of scope; key standards or ecosystems.
   - `### Why it matters` — production scenarios, failure modes, cost/latency/correctness angles tied to the learner goal.
   - `### How it works` — step-by-step mechanics: protocols, algorithms, data/control flow, APIs, file formats, or SQL/CLI patterns. Use **inline code** for commands, flags, types, and identifiers. Give at least one **concrete mini-example** (e.g. sample pseudocode, query sketch, or config fragment in a fenced ```text or ```sql block).
   - `### Comparisons` — a **Markdown table** comparing 2–4 relevant tools, patterns, or architectures (columns such as Use case | Pros | Cons | When to pick).
   - `### Diagram` — at least one **Mermaid** diagram per topic when it helps (architecture, sequence, ER, or pipeline). If a second diagram adds clarity, add it. Skip only if truly redundant.
   - `### Operations & pitfalls` — debugging, observability, security, versioning, and common mistakes practitioners make.
   - `### Check your understanding` — 2–3 hard **reflective** questions (design or reasoning, not trivia).

3. `## Synthesis and next steps` — integrate cross-topic themes; hands-on practice suggestions; readiness for assessment.

**Rich media rules:**
- Prefer **Mermaid** for figures. Syntax must be valid for **Mermaid v10+** (flowchart/graph).
- **Flowchart edge labels (critical):** write `SourceID -->|edge label| TargetID` with **exactly one** ASCII space before the target — e.g. `A -->|defines| B`. **Never** `-->|label|> B` (extra `>`) or `-->|label|  B` (double space); both break Mermaid 11. Use quoted node text when labels contain spaces or brackets: `A["Open file"] -->|reads| B["Data model"]`.
- You **may** add `![description](https://...)` **only** if you use a **stable, publicly accessible HTTPS URL** you know exists (e.g. well-known documentation or Wikimedia). Never invent URLs. If unsure, omit images and use Mermaid instead.

**Style:**
- Technical depth first: assume the reader wants to implement or reason about systems.
- Aim **400–800+ words per topic** when several skills are listed (more if the model budget allows).
- Top-level `##` headings only for: Phase introduction, each `Topic: …`, and Synthesis.

Cover **every** phase skill with comparable depth; do not merge multiple skills into one vague topic section."""
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
        if len(text) < 800:
            return _template_guide(user, phase), "template"
        return text, "groq"
    except Exception:
        return _template_guide(user, phase), "template"

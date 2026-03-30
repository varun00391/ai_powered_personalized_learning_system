from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, model_validator


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str = ""


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserPublic(BaseModel):
    id: str
    email: str
    full_name: str
    onboarding_complete: bool
    career_goal_id: str | None
    custom_goal_text: str | None = None
    learning_style: str | None
    hours_per_week: int | None
    experience_band: str | None
    skill_snapshot: dict | None = None
    preferred_study_windows: list[str] | None
    schedule_flexibility: str | None
    timezone: str | None

    class Config:
        from_attributes = True


class OnboardingAnswers(BaseModel):
    career_goal_id: str
    custom_goal_description: str | None = Field(
        default=None,
        max_length=4000,
        description="Required when career_goal_id is 'custom': what the learner wants to learn.",
    )
    python_level: str = Field(description="beginner | some | comfortable")
    sql_level: str = Field(description="never | basics | proficient")
    learning_style: str = Field(description="video | reading | hands-on")
    hours_per_week: int = Field(ge=1, le=40)
    preferred_study_windows: list[str] = Field(
        default_factory=list,
        description="morning, afternoon, evening, night",
    )
    schedule_flexibility: str = Field(
        description="rigid | somewhat_flexible | very_flexible"
    )
    timezone: str | None = None

    @model_validator(mode="after")
    def validate_custom_goal(self):
        if self.career_goal_id == "custom":
            t = (self.custom_goal_description or "").strip()
            if len(t) < 8:
                raise ValueError(
                    "When you choose Custom, describe your goal in your own words (at least 8 characters)."
                )
            return self.model_copy(update={"custom_goal_description": t})
        return self.model_copy(update={"custom_goal_description": None})


class KnowledgeCheckOut(BaseModel):
    question: str
    choices: list[str] = Field(..., min_length=2, max_length=8)
    correct_index: int = Field(ge=0)
    explanation: str = ""


class PhaseOut(BaseModel):
    phase_index: int
    title: str
    skills: list[str]
    estimated_hours: float
    estimated_weeks: float
    suggested_formats: list[str]
    unlocked: bool
    learning_objectives: list[str] = Field(default_factory=list)
    study_tips: list[str] = Field(default_factory=list)
    key_activities: list[str] = Field(default_factory=list)
    knowledge_checks: list[KnowledgeCheckOut] = Field(default_factory=list)


class PhaseStudyGuideOut(BaseModel):
    content: str
    source: Literal["groq", "template"]
    knowledge_checks: list[KnowledgeCheckOut] = Field(
        default_factory=list,
        description="Guide-aligned MCQs when Groq succeeds; else phase template checks.",
    )
    mcq_aligned_to_guide: bool = False


class QuizAnswerDetailOut(BaseModel):
    question_index: int
    selected_index: int
    correct_index: int
    is_correct: bool


class QuizResultOut(BaseModel):
    correct: int
    incorrect: int
    total: int
    score_percent: float
    completed_at: str
    answers: list[int]
    details: list[QuizAnswerDetailOut] = Field(default_factory=list)


class PhaseKnowledgeBundleOut(BaseModel):
    phase_index: int
    knowledge_checks: list[KnowledgeCheckOut]
    mcq_aligned_to_guide: bool
    last_result: QuizResultOut | None = None
    attempts_history: list[QuizResultOut] = Field(default_factory=list)


class QuizSubmitIn(BaseModel):
    answers: list[int]


class QuizSubmitOut(BaseModel):
    result: QuizResultOut
    bundle: PhaseKnowledgeBundleOut


class LearningPathOut(BaseModel):
    id: str
    career_goal_id: str
    career_title: str
    phases: list[PhaseOut]
    total_skills: int
    remaining_skills: int
    total_estimated_hours: float
    estimated_weeks_course: float
    personalization_notes: str | None
    updated_at: datetime | None = None

    class Config:
        from_attributes = True


class RecommendationItem(BaseModel):
    content_id: str
    title: str
    format: str
    duration_minutes: int
    match_reason: str


class TutorChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(..., max_length=16000)


class TutorPhaseContext(BaseModel):
    phase_index: int
    title: str
    skills: list[str] = Field(default_factory=list)
    estimated_hours: float | None = None
    suggested_formats: list[str] | None = None


class TutorChatRequest(BaseModel):
    """Full conversation for multi-turn chat; last message must be from the user."""

    messages: list[TutorChatTurn] = Field(..., min_length=1, max_length=48)
    phase_context: TutorPhaseContext | None = None

    @model_validator(mode="after")
    def last_turn_is_user(self):
        if self.messages[-1].role != "user":
            raise ValueError("The last message must be from the user.")
        return self


class TutorReply(BaseModel):
    reply: str
    agent: str = "LearnGuide"


class CareerOption(BaseModel):
    id: str
    title: str
    domain: str
    blurb: str

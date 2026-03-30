import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str] = mapped_column(String(255), default="")
    onboarding_complete: Mapped[bool] = mapped_column(Boolean, default=False)

    career_goal_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    custom_goal_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    learning_style: Mapped[str | None] = mapped_column(String(32), nullable=True)
    hours_per_week: Mapped[int | None] = mapped_column(Integer, nullable=True)
    experience_band: Mapped[str | None] = mapped_column(String(32), nullable=True)
    skill_snapshot: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    preferred_study_windows: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    schedule_flexibility: Mapped[str | None] = mapped_column(String(32), nullable=True)
    timezone: Mapped[str | None] = mapped_column(String(64), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    learning_paths: Mapped[list["LearningPath"]] = relationship(
        "LearningPath", back_populates="user", cascade="all, delete-orphan"
    )


class LearningPath(Base):
    __tablename__ = "learning_paths"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"))
    career_goal_id: Mapped[str] = mapped_column(String(64))
    goal_label: Mapped[str | None] = mapped_column(Text, nullable=True)
    phase_nodes: Mapped[list] = mapped_column(JSONB)
    total_skills: Mapped[int] = mapped_column(Integer)
    remaining_skills: Mapped[int] = mapped_column(Integer)
    total_estimated_hours: Mapped[float] = mapped_column(Float)
    estimated_weeks: Mapped[float] = mapped_column(Float)
    personalization_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user: Mapped["User"] = relationship("User", back_populates="learning_paths")
    phase_knowledge_rows: Mapped[list["PhaseKnowledgeProgress"]] = relationship(
        "PhaseKnowledgeProgress",
        back_populates="learning_path",
        cascade="all, delete-orphan",
    )


class PhaseKnowledgeProgress(Base):
    """Saved knowledge-check questions (from last study-guide run) and quiz scores per phase."""

    __tablename__ = "phase_knowledge_progress"
    __table_args__ = (UniqueConstraint("learning_path_id", "phase_index", name="uq_phase_knowledge_lp_phase"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    learning_path_id: Mapped[str] = mapped_column(String(36), ForeignKey("learning_paths.id", ondelete="CASCADE"))
    phase_index: Mapped[int] = mapped_column(Integer)
    knowledge_checks: Mapped[list] = mapped_column(JSONB, nullable=False)
    mcq_aligned_to_guide: Mapped[bool] = mapped_column(Boolean, default=False)
    last_result: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    attempts_history: Mapped[list] = mapped_column(JSONB, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    learning_path: Mapped["LearningPath"] = relationship("LearningPath", back_populates="phase_knowledge_rows")

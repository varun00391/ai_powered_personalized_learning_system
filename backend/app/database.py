from collections.abc import AsyncGenerator

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import settings

engine = create_async_engine(
    settings.database_url,
    echo=False,
    pool_pre_ping=True,
)
SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with SessionLocal() as session:
        yield session


async def init_db() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def patch_schema() -> None:
    """Add columns on existing Postgres volumes (create_all does not migrate)."""
    if "postgresql" not in settings.database_url:
        return
    async with engine.begin() as conn:
        await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS custom_goal_text TEXT"))
        await conn.execute(text("ALTER TABLE learning_paths ADD COLUMN IF NOT EXISTS goal_label TEXT"))
        await conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS phase_knowledge_progress (
                    id VARCHAR(36) PRIMARY KEY,
                    learning_path_id VARCHAR(36) NOT NULL REFERENCES learning_paths(id) ON DELETE CASCADE,
                    phase_index INTEGER NOT NULL,
                    knowledge_checks JSONB NOT NULL DEFAULT '[]',
                    mcq_aligned_to_guide BOOLEAN NOT NULL DEFAULT false,
                    last_result JSONB,
                    attempts_history JSONB NOT NULL DEFAULT '[]',
                    updated_at TIMESTAMP NOT NULL,
                    CONSTRAINT uq_phase_knowledge_lp_phase UNIQUE (learning_path_id, phase_index)
                )
                """
            )
        )

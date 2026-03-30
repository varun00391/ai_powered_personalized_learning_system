from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import init_db, patch_schema
from app.routers import auth, careers, learner, learning_path, onboarding, recommendations, tutor


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    await patch_schema()
    yield


app = FastAPI(title=settings.app_name, lifespan=lifespan)

origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(careers.router)
app.include_router(learner.router)
app.include_router(learning_path.router)
app.include_router(onboarding.router)
app.include_router(recommendations.router)
app.include_router(tutor.router)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}

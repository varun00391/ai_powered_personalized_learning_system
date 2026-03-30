from fastapi import APIRouter, Depends

from app.dependencies import get_current_user
from app.models import User
from app.schemas import UserPublic

router = APIRouter(prefix="/api/v1/learner", tags=["learner"])


@router.get("/profile", response_model=UserPublic)
async def profile(user: User = Depends(get_current_user)) -> User:
    return user

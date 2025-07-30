# app/api/v1/api.py
from fastapi import APIRouter

from .endpoints import auth, senior, family, schedule, calendar, daily_qa

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(senior.router, prefix="/senior", tags=["Senior Conversation"])
api_router.include_router(family.router, prefix="/family", tags=["Family App"])
api_router.include_router(schedule.router, prefix="/schedule", tags=["Schedule Management"])
api_router.include_router(calendar.router, prefix="/calendar", tags=["Calendar Management"])
api_router.include_router(daily_qa.router, prefix="/daily-qa", tags=["Daily Question"])
"""Voice agent module router aggregation."""

from fastapi import APIRouter

from modules.voice_agent.routers.signed_url import router as signed_url_router

voice_agent_router = APIRouter(prefix="/voice-agent")
voice_agent_router.include_router(signed_url_router)

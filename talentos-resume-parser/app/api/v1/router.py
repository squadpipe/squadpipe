from fastapi import APIRouter
from app.api.v1.endpoints import parse_resume, parse_email, match_skills, generate_pitch

api_router = APIRouter()

api_router.include_router(parse_resume.router, tags=["Resume Parser"])
api_router.include_router(parse_email.router, tags=["Email Intake Parser"])
api_router.include_router(match_skills.router, tags=["Skill Matcher"])
api_router.include_router(generate_pitch.router, tags=["Submission Pitch Writer"])


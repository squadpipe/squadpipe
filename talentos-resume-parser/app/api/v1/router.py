import hmac
from fastapi import APIRouter, Depends, Header, HTTPException, status
from app.core.config import settings
from app.api.v1.endpoints import parse_resume, parse_email, match_skills


def verify_internal_api_key(
    x_internal_api_key: str | None = Header(default=None, alias="X-Internal-API-Key"),
):
    expected_key = settings.INTERNAL_API_KEY.strip()
    if not expected_key:
        if settings.ENVIRONMENT.lower() == "production":
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Internal API authentication is not configured",
            )
        return

    if not x_internal_api_key or not hmac.compare_digest(x_internal_api_key, expected_key):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized internal service request",
        )


api_router = APIRouter(dependencies=[Depends(verify_internal_api_key)])

api_router.include_router(parse_resume.router, tags=["Resume Parser"])
api_router.include_router(parse_email.router, tags=["Email Intake Parser"])
api_router.include_router(match_skills.router, tags=["Skill Matcher"])


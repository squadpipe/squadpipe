from fastapi import APIRouter
from typing import List
from app.schemas.match import SkillMatchRequest, SkillMatchResponse, CandidateMatchItem

router = APIRouter()

@router.post("/match-skills", response_model=SkillMatchResponse)
async def match_bench_candidates(request: SkillMatchRequest):
    """
    Compares requirement skills against bench candidates and returns ranked match scores.
    """
    req_skills = [s.strip().lower() for s in request.skillsRequired.split(",") if s.strip()]
    if not req_skills:
        req_skills = ["aws", "cloud", "python"]

    results: List[CandidateMatchItem] = []

    for c in request.candidates:
        c_skills_str = c.get("skillset", "")
        c_skills = [s.strip().lower() for s in c_skills_str.split(",") if s.strip()]

        matched = []
        missing = []

        for rs in req_skills:
            if any(rs in cs or cs in rs for cs in c_skills):
                matched.append(rs.capitalize())
            else:
                missing.append(rs.capitalize())

        # Calculate percentage score
        score = int((len(matched) / max(len(req_skills), 1)) * 100)
        # Add slight boost for title similarity
        if any(w in c.get("currentTitle", "").lower() for w in ["lead", "architect", "senior", "principal"]):
            score = min(score + 5, 98)

        results.append(CandidateMatchItem(
            candidateId=c.get("id", ""),
            fullName=c.get("fullName", "Candidate"),
            currentTitle=c.get("currentTitle", "Engineer"),
            score=max(score, 45), # keep realistic floor
            matchingSkills=matched,
            missingSkills=missing,
            hourlyRate=c.get("hourlyRate", "$90/hr"),
            workAuth=c.get("workAuth", "US Citizen")
        ))

    # Sort descending by match score
    results.sort(key=lambda x: x.score, reverse=True)

    return SkillMatchResponse(
        success=True,
        requirementId=request.requirementId,
        matches=results
    )


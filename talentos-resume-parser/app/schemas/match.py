from pydantic import BaseModel
from typing import List, Optional

class SkillMatchRequest(BaseModel):
    requirementId: str
    skillsRequired: str
    candidates: List[dict]

class CandidateMatchItem(BaseModel):
    candidateId: str
    fullName: str
    currentTitle: str
    score: int
    matchingSkills: List[str]
    missingSkills: List[str]
    hourlyRate: Optional[str] = None
    workAuth: Optional[str] = None

class SkillMatchResponse(BaseModel):
    success: bool
    requirementId: str
    matches: List[CandidateMatchItem]

class PitchGenerateRequest(BaseModel):
    candidateName: str
    candidateTitle: str
    candidateSkills: str
    companyName: str
    jobTitle: str
    recruiterName: Optional[str] = None
    tone: str = "Professional" # "Professional", "High-Impact", "Technical Focus"

class PitchGenerateResponse(BaseModel):
    success: bool
    tone: str
    subject: str
    body: str


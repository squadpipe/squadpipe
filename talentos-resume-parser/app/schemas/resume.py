from pydantic import BaseModel, EmailStr
from typing import Optional, List

class ParsedProfile(BaseModel):
    fullName: str
    phone: Optional[str] = None
    email: Optional[str] = None
    workAuth: str
    education: Optional[str] = None
    currentTitle: str
    skillset: str
    hourlyRate: Optional[str] = None
    relocation: str = "Yes"
    recruiter: Optional[str] = None
    fileName: Optional[str] = None
    rawSnippet: Optional[str] = None

class ResumeParseResponse(BaseModel):
    success: bool
    data: ParsedProfile
    message: str = "Resume parsed successfully"


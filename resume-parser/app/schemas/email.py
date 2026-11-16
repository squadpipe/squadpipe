from pydantic import BaseModel
from typing import Optional

class EmailIntakeRequest(BaseModel):
    rawEmailText: str

class ExtractedRequirement(BaseModel):
    companyName: str
    opportunityTitle: str
    location: str
    clientContact: str
    clientContactTitle: str
    skillsRequired: str
    assignedRecruiter: Optional[str] = None
    initialStage: str = "Requirement"
    missingNotes: Optional[str] = None

class EmailIntakeResponse(BaseModel):
    success: bool
    data: ExtractedRequirement
    message: str = "Email requirement extracted successfully"


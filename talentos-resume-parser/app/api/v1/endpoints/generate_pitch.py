from fastapi import APIRouter
from app.schemas.match import PitchGenerateRequest, PitchGenerateResponse

router = APIRouter()

@router.post("/generate-pitch", response_model=PitchGenerateResponse)
async def generate_submission_pitch(request: PitchGenerateRequest):
    """
    Generates tailored candidate submission pitch emails matching the selected tone.
    """
    tone = request.tone
    name = request.candidateName
    title = request.candidateTitle
    skills = request.candidateSkills
    company = request.companyName
    job = request.jobTitle
    recruiter = request.recruiterName or "Talent Acquisition Team"

    if tone == "High-Impact":
        subject = f"Priority Candidate Submission: {name} for {job} @ {company}"
        body = f"""Hi Team,

I am writing to directly present {name} for your {job} opening. 

{name} is an exceptional {title} with an outstanding track record delivering high-throughput production infrastructure. Key competencies include:
• Core Expertise: {skills}
• Deployment Status: Immediately available, verified credentials, and fully briefed on {company}'s tech stack.

Please let me know your availability for a 30-minute introductory technical interview this week.

Best regards,
{recruiter}
Senior Recruitment Lead | SquadPipe Agency"""

    elif tone == "Technical Focus":
        subject = f"Technical Profile Submittal: {name} — {title}"
        body = f"""Dear Hiring Team,

Please review the attached technical dossier for {name}, submitting for the {job} position with {company}.

Technical Assessment Highlights:
1. Architecture & Hands-on Depth: Expert-level mastery of {skills}.
2. Problem Solving: Extensive enterprise background delivering resilient distributed systems and optimizing cloud infrastructure.
3. Availability & Authorization: Ready for technical round on 24 hours notice.

Attached is the complete unbranded resume. Looking forward to your technical feedback.

Sincerely,
{recruiter}
Technical Recruiter | SquadPipe Agency"""

    else: # Professional
        subject = f"Candidate Presentation: {name} - {job} - {company}"
        body = f"""Dear Hiring Manager,

I hope this email finds you well.

We are pleased to introduce {name} for your open {job} position at {company}. {name} currently serves as {title} and brings specialized hands-on experience in {skills}.

Key Candidate Qualifications:
• Role: {title}
• Core Skillset: {skills}
• Rate & Authorization: Fully verified and ready for client interview.

Please review the profile and let us know suitable interview windows.

Warm regards,
{recruiter}
Senior Technical Recruiter | SquadPipe Staffing"""

    return PitchGenerateResponse(
        success=True,
        tone=tone,
        subject=subject,
        body=body
    )


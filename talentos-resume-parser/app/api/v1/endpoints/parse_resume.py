from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import Optional
from app.schemas.resume import ResumeParseResponse, ParsedProfile
from app.parsers.pdf_parser import extract_text_from_pdf
from app.parsers.docx_parser import extract_text_from_docx
from app.parsers.text_parser import extract_text_from_raw
from app.extractors.contact_extractor import extract_contacts
from app.extractors.work_auth_extractor import extract_work_authorization
from app.extractors.skills_extractor import extract_skills, extract_current_title
from app.extractors.education_extractor import extract_education

router = APIRouter()

@router.post("/parse-resume", response_model=ResumeParseResponse)
async def parse_resume(
    file: Optional[UploadFile] = File(None),
    rawText: Optional[str] = Form(None),
    sampleKey: Optional[str] = Form(None)
):
    """
    Parses an uploaded resume file (PDF, DOCX) or raw snippet and extracts structured data.
    Supports instant prototype sample loads: 'anand', 'meera', 'tarun'.
    """
    if sampleKey:
        if sampleKey == "anand":
            profile = ParsedProfile(
                fullName="Anand Verma",
                phone="+1 (512) 555-0144",
                email="anand.verma@cloudmail.com",
                workAuth="US Citizen",
                currentTitle="Lead AWS Infrastructure Architect",
                skillset="AWS, Terraform, Kubernetes, Helm, Python, Docker",
                education="Master of Science in Computer Science",
                hourlyRate="$92/hr (W2)",
                relocation="Yes",
                recruiter="Marcus Brody",
                fileName="Anand_Verma_AWS_Lead_Resume.pdf",
                rawSnippet="Anand Verma | +1 (512) 555-0144 | anand.verma@cloudmail.com\nAustin, TX • Work Auth: US Citizen"
            )
            return ResumeParseResponse(success=True, data=profile)
        elif sampleKey == "meera":
            profile = ParsedProfile(
                fullName="Meera Krishnan",
                phone="+1 (408) 555-8910",
                email="meera.krishnan@dataeng.io",
                workAuth="Green Card",
                currentTitle="Principal Snowflake & PySpark Data Engineer",
                skillset="Snowflake, PySpark, Databricks, dbt, Airflow, SQL",
                education="Master of Science in Data Analytics",
                hourlyRate="$98/hr (W2)",
                relocation="Yes",
                recruiter="Sarah Jenkins",
                fileName="Meera_Krishnan_Snowflake_Lead.pdf",
                rawSnippet="Meera Krishnan | +1 (408) 555-8910 | meera.krishnan@dataeng.io\nSan Jose, CA • Work Auth: Green Card"
            )
            return ResumeParseResponse(success=True, data=profile)
        elif sampleKey == "tarun":
            profile = ParsedProfile(
                fullName="Tarun Sengupta",
                phone="+1 (732) 555-2201",
                email="tarun.sengupta.dev@gmail.com",
                workAuth="H-1B",
                currentTitle="Lead Java Microservices Engineer",
                skillset="Java 17, Spring Boot, Kafka, Microservices, AWS, React",
                education="Bachelor of Technology in Computer Science",
                hourlyRate="$85/hr (C2C)",
                relocation="Yes",
                recruiter="Elena Rostova",
                fileName="Tarun_Sengupta_Java_Microservices.docx",
                rawSnippet="Tarun Sengupta | +1 (732) 555-2201 | tarun.sengupta.dev@gmail.com\nEdison, NJ • Work Auth: H-1B"
            )
            return ResumeParseResponse(success=True, data=profile)

    # File or text extraction
    text = ""
    filename = "Pasted_Resume_Snippet.txt"
    if file:
        filename = file.filename or "uploaded_resume.pdf"
        file_bytes = await file.read()
        if filename.lower().endswith(".pdf"):
            text = extract_text_from_pdf(file_bytes)
        elif filename.lower().endswith(".docx"):
            text = extract_text_from_docx(file_bytes)
        else:
            text = extract_text_from_raw(file_bytes)
    elif rawText:
        text = extract_text_from_raw(rawText)
    else:
        raise HTTPException(status_code=400, detail="Either file, rawText, or sampleKey must be provided.")

    if not text.strip():
        raise HTTPException(status_code=422, detail="Unable to extract text from the provided resume.")

    full_name, email, phone = extract_contacts(text)
    work_auth = extract_work_authorization(text)
    skills = extract_skills(text)
    title = extract_current_title(text, skills)
    education = extract_education(text)

    # Dynamic hourly rate heuristic
    rate = "$90/hr (W2)" if "US Citizen" in work_auth or "Green Card" in work_auth else "$85/hr (C2C)"

    profile = ParsedProfile(
        fullName=full_name or "",
        phone=phone or None,
        email=email or None,
        workAuth=work_auth or "",
        education=education or None,
        currentTitle=title or "",
        skillset=", ".join(skills) if skills else "",
        hourlyRate=rate,
        relocation="Yes",
        recruiter=None,
        fileName=filename,
        rawSnippet=text[:8000]
    )

    return ResumeParseResponse(success=True, data=profile)


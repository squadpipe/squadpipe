import re
from fastapi import APIRouter, File, HTTPException, UploadFile
from app.schemas.email import EmailIntakeRequest, EmailIntakeResponse, ExtractedRequirement
from app.extractors.skills_extractor import extract_skills
from app.parsers.docx_parser import extract_text_from_docx
from app.parsers.pdf_parser import extract_text_from_pdf
from app.parsers.text_parser import extract_text_from_raw

router = APIRouter()

_PLACEHOLDER_RE = re.compile(
    r"^(?:not\s+(?:explicitly\s+)?(?:specified|mentioned|provided|stated|disclosed|available|found)|unknown|n/?a|none|tbd|missing|pending)$",
    re.IGNORECASE,
)

_CLAUSE_CUT_RE = re.compile(
    r"\s+(?:for\s+(?:one\s+of|our|their|this|the\s+(?:ongoing|new|client|project)|an?\s+(?:ongoing|contract|\d+[- ]?(?:month|mo|week|year)))\b|with\s+(?:\d+|around|experience|strong|good)\b|who\s+(?:can|has|is)\b|to\s+(?:join|work|support|build|lead)\b|based\s+in\b|located\s+in\b).*$",
    re.IGNORECASE,
)


def _clean_text(val: str) -> str:
    cleaned = re.sub(r"\s+", " ", (val or "").strip(" \t\r\n:•-–—\"'"))
    return "" if not cleaned or _PLACEHOLDER_RE.match(cleaned) else cleaned


@router.post("/parse-email", response_model=EmailIntakeResponse)
async def parse_email_intake(request: EmailIntakeRequest):
    """
    Extracts explicit structured fields from raw client email text without fabricating defaults.
    """
    text = request.rawEmailText or ""

    company_match = re.search(
        r"(?:Target\s*Company|Company(?:\s*Name)?|Client(?:\s*Company|\s*Name)?|End\s*Client|Organization)\s*:\s*([^\n\r]+)",
        text,
        re.IGNORECASE,
    )
    company = _clean_text(company_match.group(1)) if company_match else ""

    contact_match = re.search(
        r"(?:From|Hiring\s*Manager|Contact(?:\s*Name)?|POC)\s*:\s*([^<\n\r]+?)(?:<|$)",
        text,
        re.IGNORECASE | re.MULTILINE,
    )
    client_contact = _clean_text(contact_match.group(1)) if contact_match else ""

    title_header_match = re.search(
        r"(?:Job\s*Title|Position(?:\s*Title)?|Opportunity(?:\s*Title)?|Role(?:\s*Title)?|Opening)\s*:\s*([^\n\r]+)",
        text,
        re.IGNORECASE,
    )
    subject_match = re.search(
        r"Subject:\s*(?:Re:|Fwd:|Fw:|Urgent:|Contract:|Open\s*Req:|Requisition:)?\s*([^\n\r]+)",
        text,
        re.IGNORECASE,
    )
    raw_title = (
        title_header_match.group(1)
        if title_header_match
        else (subject_match.group(1) if subject_match else "")
    )
    opportunity_title = _clean_text(_CLAUSE_CUT_RE.sub("", raw_title))

    location_match = re.search(r"(?:Work\s*Location|Location)\s*:\s*([^\n\r]+)", text, re.IGNORECASE)
    location = _clean_text(location_match.group(1)) if location_match else ""

    contact_title_match = re.search(
        r"(?:Contact\s*Title|Designation|Hiring\s*Manager\s*Title)\s*:\s*([^\n\r]+)",
        text,
        re.IGNORECASE,
    )
    client_contact_title = _clean_text(contact_title_match.group(1)) if contact_title_match else ""

    skills = extract_skills(text)

    req = ExtractedRequirement(
        companyName=company,
        opportunityTitle=opportunity_title,
        location=location,
        clientContact=client_contact,
        clientContactTitle=client_contact_title,
        skillsRequired=", ".join(skills) if skills else "",
        assignedRecruiter=None,
        initialStage="Requirement",
        missingNotes=None,
    )

    return EmailIntakeResponse(success=True, data=req)


@router.post("/extract-text")
async def extract_document_text(file: UploadFile = File(...)):
    """Extracts plain readable text from an uploaded PDF, DOCX, DOC, TXT, RTF, or EML file."""
    file_bytes = await file.read()
    filename = file.filename or "document.pdf"
    lower = filename.lower()
    if lower.endswith(".pdf"):
        text = extract_text_from_pdf(file_bytes)
    elif lower.endswith(".docx"):
        text = extract_text_from_docx(file_bytes)
    else:
        text = extract_text_from_raw(file_bytes)

    if not text.strip():
        raise HTTPException(
            status_code=422,
            detail="Unable to extract selectable text from the uploaded document.",
        )

    return {"success": True, "fileName": filename, "text": text}

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

_DESIGNATION_HINT_RE = re.compile(
    r"\b(?:manager|director|lead|head|vp|vice\s+president|president|chief|officer|ceo|cto|cfo|cio|coo|partner|principal|architect|recruiter|coordinator|specialist|supervisor|executive|owner|founder|delivery|account|hiring|talent|acquisition|staffing|operations|practice|program|project|hr|vendor)\b",
    re.IGNORECASE,
)

_GENERIC_ROLE_RE = re.compile(
    r"^(?:consultants?|candidates?|contractors?|resources?|professionals?|talent|staff|personnel|workers?|positions?|roles?|openings?)$",
    re.IGNORECASE,
)

_ROLE_KEYWORD_RE = re.compile(
    r"\b(?:developers?|engineers?|architects?|consultants?|analysts?|managers?|directors?|leads?|specialists?|administrators?|designers?|coordinators?|technicians?|scientists?|strategists?)\b",
    re.IGNORECASE,
)


def _clean_text(val: str) -> str:
    cleaned = re.sub(r"\s+", " ", (val or "").strip(" \t\r\n:•-–—\"'"))
    return "" if not cleaned or _PLACEHOLDER_RE.match(cleaned) else cleaned


def _split_contact_and_title(raw_contact: str, raw_title: str) -> tuple[str, str]:
    name = _clean_text(re.sub(r"<[^>]*@[^>]*>", "", raw_contact or ""))
    title = _clean_text(raw_title)
    inferred = ""

    delim_match = re.match(
        r"^([A-Za-z][A-Za-z.'-]*(?:\s+[A-Za-z.'-]+){0,3})\s*(?:,\s*|\s+[-–—|]\s+)\s*(.+)$",
        name,
    )
    if delim_match:
        left = _clean_text(delim_match.group(1))
        rhs = _clean_text(delim_match.group(2))
        if left and rhs and _DESIGNATION_HINT_RE.search(rhs):
            name = left
            inferred = rhs

    return name, (title or inferred)


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
        r"(?:From|Hiring\s*Manager|Client\s*Contact|Contact(?:\s*Name)?|POC)\s*:\s*([^<\n\r]+?)(?:<|$)",
        text,
        re.IGNORECASE | re.MULTILINE,
    )
    raw_contact = _clean_text(contact_match.group(1)) if contact_match else ""

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
    numbered_role_match = re.search(
        r"^\s*(?:#?1\s*[.)])\s+([^\n\r]{3,80})$",
        text,
        re.IGNORECASE | re.MULTILINE,
    )
    numbered_role = ""
    if numbered_role_match:
        cand = _clean_text(numbered_role_match.group(1))
        if cand and _ROLE_KEYWORD_RE.search(cand) and not _GENERIC_ROLE_RE.match(cand):
            numbered_role = cand

    raw_title = (
        title_header_match.group(1)
        if title_header_match
        else (
            subject_match.group(1)
            if subject_match
            else numbered_role
        )
    )
    opportunity_title = _clean_text(_CLAUSE_CUT_RE.sub("", raw_title))
    if _GENERIC_ROLE_RE.match(opportunity_title):
        opportunity_title = numbered_role or ""

    location_match = re.search(r"(?:Work\s*Location|Location)\s*:\s*([^\n\r]+)", text, re.IGNORECASE)
    if not location_match:
        location_match = re.search(
            r"(?:^|\n|\|)\s*(?:Work\s*Location|Location)\s+([^\n\r]+)",
            text,
            re.IGNORECASE,
        )
    raw_location = _clean_text(location_match.group(1)) if location_match else ""
    location = _clean_text(
        re.sub(
            r"\s+(?:Work\s*model|Work\s*type|Experience|Duration|Client\s*bill\s*rate|Bill\s*rate|Target\s*pay\s*rate|Pay\s*rate)\b.*$",
            "",
            raw_location,
            flags=re.IGNORECASE,
        )
    )

    contact_title_match = re.search(
        r"(?:Contact\s*Title|Designation|Hiring\s*Manager\s*Title)\s*:\s*([^\n\r]+)",
        text,
        re.IGNORECASE,
    )
    raw_contact_title = _clean_text(contact_title_match.group(1)) if contact_title_match else ""
    client_contact, client_contact_title = _split_contact_and_title(raw_contact, raw_contact_title)

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

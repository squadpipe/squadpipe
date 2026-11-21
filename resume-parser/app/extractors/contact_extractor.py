import re
from typing import Optional, Tuple
from app.extractors.nlp_engine import get_nlp, split_resume_sections

EMAIL_REGEX = re.compile(
    r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,10}\b'
)

US_PHONE_REGEX = re.compile(
    r'(?<!\d)(?:\+?1[-.\s]?)?\(?([2-9][0-9]{2})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})(?!\d)'
)

INTL_PHONE_REGEX = re.compile(
    r'(?<!\d)(\+\d{1,3}[-.\s]?(?:\(?\d{1,4}\)?[-.\s]?){2,4}\d{2,5})(?!\d)'
)

NON_NAME_TERMS = {
    "resume", "curriculum", "vitae", "cv", "confidential", "profile",
    "summary", "phone", "email", "linkedin", "github", "portfolio",
    "address", "location", "objective", "experience", "skills", "education",
    "lead", "senior", "principal", "staff", "junior", "architect", "engineer",
    "developer", "manager", "director", "consultant", "specialist", "analyst",
    "cloud", "data", "software", "full", "stack", "nurse", "accountant",
    "technologies", "technology", "private", "limited", "pvt", "ltd", "inc",
    "llc", "corp", "corporation", "company", "enterprise", "enterprises",
    "solutions", "services", "systems", "system", "platform", "group",
    "knowledge", "base", "guide", "workflow", "manual", "handbook", "brochure",
    "overview", "complete", "features", "welcome", "contents", "section",
    "prepared", "table", "document", "report", "invoice", "agreement",
    "contract", "requisition", "requirement", "description", "client",
    "vendor", "staffing", "recruiting", "recruitment", "squadpipe",
    "financial", "healthcare", "clinical", "technical", "business", "operations",
}


def _is_valid_person_name(candidate: str) -> bool:
    words = candidate.strip().split()
    if not (2 <= len(words) <= 4):
        return False
    # Reject spaced single-letter headers like "S O" or "K N O W"
    clean_words = [w.strip(".'-") for w in words]
    if any(len(w) == 0 for w in clean_words):
        return False
    if sum(1 for w in clean_words if len(w) >= 2) < 2:
        return False
    if max(len(w) for w in clean_words) < 3:
        return False
    lower_words = {w.lower().strip(".") for w in words}
    if lower_words & NON_NAME_TERMS:
        return False
    return all(re.fullmatch(r"[A-Za-z][A-Za-z.'-]*", w) for w in words)


def _extract_phone(text: str) -> Optional[str]:
    intl_match = INTL_PHONE_REGEX.search(text)
    if intl_match:
        raw = intl_match.group(1).strip()
        digits = re.sub(r"\D", "", raw)
        if raw.startswith("+1") and len(digits) == 11:
            return f"+1 ({digits[1:4]}) {digits[4:7]}-{digits[7:]}"
        if 10 <= len(digits) <= 15:
            return re.sub(r"\s+", " ", raw)

    us_match = US_PHONE_REGEX.search(text)
    if us_match:
        return f"+1 ({us_match.group(1)}) {us_match.group(2)}-{us_match.group(3)}"

    return None


def extract_contacts(text: str) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """
    Extracts (full_name, email, phone) from resume text using regex + offline spaCy NER.
    """
    email_match = EMAIL_REGEX.search(text)
    email = email_match.group(0).lower() if email_match else None
    phone = _extract_phone(text)

    sections = split_resume_sections(text)
    # Scan up to 25 top lines so bulky/long CVs with cover summaries or multi-line headers are never missed
    header_lines = sections["header"][:25] if sections["header"] else [
        line.strip() for line in text.splitlines() if line.strip()
    ][:25]

    full_name: Optional[str] = None

    # 1. Clean line heuristic on top header lines (handles "Anand Verma | Austin, TX")
    cleaned_header_segments = []
    for line in header_lines:
        if "@" in line or "http" in line.lower():
            continue
        first_segment = re.split(r'\s*[|•·]\s*|\s+-\s+', line)[0].strip()
        first_segment = re.split(r'\s*,\s*', first_segment)[0].strip()
        if first_segment:
            cleaned_header_segments.append(first_segment)

    # 2. Try spaCy NER PERSON detection line-by-line over top header segments
    nlp = get_nlp()
    if "ner" in nlp.pipe_names and cleaned_header_segments:
        for segment in cleaned_header_segments[:15]:
            doc = nlp(segment)
            for ent in doc.ents:
                if ent.label_ == "PERSON":
                    candidate = " ".join(ent.text.split())
                    if _is_valid_person_name(candidate):
                        full_name = candidate
                        break
            if full_name:
                break

    # 3. Deterministic fallback on top header lines (only if it passes _is_valid_person_name)
    if not full_name:
        for segment in cleaned_header_segments[:12]:
            if _is_valid_person_name(segment):
                full_name = segment
                break

    return full_name, email, phone

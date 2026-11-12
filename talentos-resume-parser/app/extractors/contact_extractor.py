import re
from typing import Optional, Tuple

EMAIL_REGEX = re.compile(
    r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b'
)

PHONE_REGEX = re.compile(
    r'(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})\b'
)

def extract_contacts(text: str) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """
    Extracts (full_name, email, phone) from resume text.
    """
    # 1. Email extraction
    email_match = EMAIL_REGEX.search(text)
    email = email_match.group(0).lower() if email_match else None

    # 2. Phone extraction
    phone = None
    phone_match = PHONE_REGEX.search(text)
    if phone_match:
        phone = f"+1 ({phone_match.group(1)}) {phone_match.group(2)}-{phone_match.group(3)}"

    # 3. Name heuristic: First non-empty line without emails, URLs or headers
    full_name = None
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    for line in lines[:5]:
        # Skip lines that look like headers, emails, or phone numbers
        if "@" in line or "http" in line or "resume" in line.lower() or "curriculum" in line.lower():
            continue
        # Clean delimiters (e.g. "Anand Verma | Austin, TX")
        candidate_name = re.split(r'[\s]*[|•\-,][\s]*', line)[0].strip()
        # Ensure it has at least 2 words and contains alphabetical chars
        words = candidate_name.split()
        if 2 <= len(words) <= 4 and all(w.isalpha() for w in words):
            full_name = candidate_name
            break

    if not full_name and lines:
        first_words = lines[0].split()[:2]
        full_name = " ".join(first_words) if first_words else "Candidate Profile"

    return full_name, email, phone


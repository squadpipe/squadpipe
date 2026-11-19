import re
from app.extractors.nlp_engine import split_resume_sections

EDUCATION_PATTERNS = [
    (r'\b(ph\.?d\.?|doctor of philosophy|doctorate|m\.d\.|j\.d\.)\b', "Doctorate / Ph.D."),
    (r'\b(master of science|master of technology|master of business|m\.s\.|m\.sc\.?|m\.tech|master\'s|mba|m\.c\.a\.?|m\.com\.?|msn|pgdm)\b', "Master's Degree"),
    (r'\b(bachelor of technology|b\.tech|bachelor of engineering|b\.e\.|bachelor of science|b\.s\.|b\.sc\.?|bachelor of computer|b\.c\.a\.?|bachelor of arts|b\.a\.?|b\.b\.a\.?|b\.com\.?|bsn|bachelor\'s)\b', "Bachelor's Degree"),
    (r'\b(associate of science|associate of arts|a\.s\.|a\.a\.|associate degree)\b', "Associate Degree"),
]


def _search_lines_for_education(lines: list[str]) -> str | None:
    joined = "\n".join(lines)
    joined_lower = joined.lower()
    for pattern, label in EDUCATION_PATTERNS:
        match = re.search(pattern, joined_lower)
        if match:
            for line in lines:
                clean_line = re.sub(r'\(cid:\d+\)', '', line).strip(' •-|')
                if match.group(0) in clean_line.lower() and len(clean_line) < 90:
                    return clean_line
            return label
    return None


def extract_education(text: str) -> str:
    """Extracts degree level from the Education section first, then falls back to full text."""
    sections = split_resume_sections(text)
    if sections["education"]:
        found = _search_lines_for_education(sections["education"])
        if found:
            return found

    all_lines = [line.strip() for line in text.splitlines() if line.strip()]
    return _search_lines_for_education(all_lines) or ""

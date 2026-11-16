import re
from functools import lru_cache
from typing import Dict, List
import spacy
from spacy.language import Language

SECTION_HEADERS: Dict[str, tuple[str, ...]] = {
    "summary": (
        "summary",
        "professional summary",
        "executive summary",
        "profile",
        "objective",
        "career objective",
        "about",
        "about me",
    ),
    "skills": (
        "skills",
        "technical skills",
        "technical expertise",
        "core competencies",
        "competencies",
        "key skills",
        "areas of expertise",
        "technologies",
        "tech stack",
        "tools & technologies",
        "clinical skills",
        "skills & tools",
    ),
    "experience": (
        "experience",
        "work experience",
        "professional experience",
        "employment history",
        "career history",
        "work history",
        "relevant experience",
    ),
    "education": (
        "education",
        "academic background",
        "academics",
        "educational qualifications",
        "qualifications",
    ),
    "certifications": (
        "certifications",
        "certificates",
        "licenses",
        "licenses & certifications",
        "credentials",
        "training & certifications",
    ),
}


@lru_cache(maxsize=1)
def get_nlp() -> Language:
    """Loads the offline spaCy English pipeline once, with a blank fallback."""
    try:
        return spacy.load("en_core_web_sm")
    except OSError:
        return spacy.blank("en")


def _match_section_name(line: str) -> str | None:
    normalized = re.sub(r"[:\-–—|•]+$", "", line.strip()).strip().lower()
    if not normalized or len(normalized.split()) > 5:
        return None
    for section, aliases in SECTION_HEADERS.items():
        if normalized in aliases:
            return section
    return None


def split_resume_sections(text: str) -> Dict[str, List[str]]:
    """Splits resume text into logical sections (header, summary, skills, experience, education, certifications)."""
    sections: Dict[str, List[str]] = {
        "header": [],
        "summary": [],
        "skills": [],
        "experience": [],
        "education": [],
        "certifications": [],
    }
    current = "header"
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        matched = _match_section_name(line)
        if matched:
            current = matched
            continue
        sections[current].append(line)
    return sections

import re

EDUCATION_PATTERNS = [
    (r'\b(ph\.?d\.?|doctor of philosophy|doctorate)\b', "Ph.D. in Computer Science / Engineering"),
    (r'\b(master of science|master of technology|m\.s\.|m\.sc\.?|m\.tech|master\'s|mba|m\.c\.a\.?)\b', "Master's Degree"),
    (r'\b(bachelor of technology|b\.tech|bachelor of engineering|b\.e\.|bachelor of science|b\.s\.|b\.sc\.?|bachelor of computer|b\.c\.a\.?|bachelor of arts|b\.a\.?|b\.b\.a\.?|b\.com\.?|bachelor\'s)\b', "Bachelor's Degree"),
]

def extract_education(text: str) -> str:
    """Extracts degree level from resume text."""
    text_lower = text.lower()
    for pattern, label in EDUCATION_PATTERNS:
        match = re.search(pattern, text_lower)
        if match:
            for line in text.splitlines():
                clean_line = re.sub(r'\(cid:\d+\)', '', line).strip(' •-|')
                if match.group(0) in clean_line.lower() and len(clean_line) < 90:
                    return clean_line
            return label
    return "Bachelor's Degree"


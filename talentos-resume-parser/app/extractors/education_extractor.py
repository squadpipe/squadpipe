import re

EDUCATION_PATTERNS = [
    (r'\b(ph\.?d\.?|doctor of philosophy|doctorate)\b', "Ph.D. in Computer Science / Engineering"),
    (r'\b(master of science|m\.s\.|master\'s in computer|master of technology|m\.tech|mba)\b', "Master of Science in Information Technology"),
    (r'\b(bachelor of science|b\.s\.|bachelor of engineering|b\.e\.|b\.tech|bachelor\'s)\b', "Bachelor of Science in Computer Science"),
]

def extract_education(text: str) -> str:
    """Extracts degree level from resume text."""
    text_lower = text.lower()
    for pattern, label in EDUCATION_PATTERNS:
        match = re.search(pattern, text_lower)
        if match:
            # Try to grab the full line if possible
            for line in text.splitlines():
                if match.group(0) in line.lower() and len(line.strip()) < 80:
                    return line.strip()
            return label
    return "Bachelor of Science in Computer Science"


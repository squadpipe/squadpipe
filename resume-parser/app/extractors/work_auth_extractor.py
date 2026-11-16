import re

WORK_AUTH_PATTERNS = [
    (r'\b(us citizen|u\.s\. citizen|united states citizen|citizen)\b', 'US Citizen'),
    (r'\b(green card|permanent resident|greencard|pr)\b', 'Green Card'),
    (r'\b(h-1b|h1b|h-1b transfer|h1b specialty)\b', 'H-1B'),
    (r'\b(tn visa|nafta|tn-1|tn-2)\b', 'TN Visa'),
    (r'\b(opt|cpt|ead|stem opt)\b', 'OPT / CPT EAD'),
    (r'\b(c2c|corp-to-corp|corp to corp)\b', 'C2C Subcontractor'),
    (r'\b(w2|w-2 hourly)\b', 'W2 Hourly'),
]

def extract_work_authorization(text: str) -> str:
    """Detects work authorization from resume content."""
    text_lower = text.lower()
    for pattern, label in WORK_AUTH_PATTERNS:
        if re.search(pattern, text_lower):
            return label
    return "US Citizen" # Standard default if not specified


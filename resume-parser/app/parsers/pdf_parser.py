import io
import re
import pdfplumber
from pypdf import PdfReader


def clean_pdf_text(text: str) -> str:
    """Removes PDF custom font glyph artifacts like (cid:131) and normalizes spacing."""
    if not text:
        return ""
    cleaned = re.sub(r'\(cid:\d+\)', ' ', text)
    cleaned = re.sub(r'[•●▪◦]', ' • ', cleaned)
    # Clean stray '#' placeholders often emitted for icon glyphs between phone/email tokens
    cleaned = re.sub(r'(?<=\d)\s*#\s*(?=[A-Za-z0-9_.+-]+@)', ' · ', cleaned)
    cleaned = re.sub(r'\s*#\s*(?=Website|LinkedIn|GitHub|Portfolio)', ' · ', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'[ \t]{2,}', ' ', cleaned)
    lines = [line.strip() for line in cleaned.splitlines()]
    return "\n".join(line for line in lines if line).strip()


def extract_text_from_pdf(file_bytes: bytes) -> str:
    """Extracts text from PDF bytes using pdfplumber with fallback to pypdf."""
    text_content = []
    try:
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            for page in pdf.pages:
                extracted = page.extract_text()
                if extracted:
                    text_content.append(extracted)
    except Exception:
        # Fallback to PyPDF
        reader = PdfReader(io.BytesIO(file_bytes))
        for page in reader.pages:
            extracted = page.extract_text()
            if extracted:
                text_content.append(extracted)

    return clean_pdf_text("\n".join(text_content))


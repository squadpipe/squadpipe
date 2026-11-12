import io
from docx import Document

def extract_text_from_docx(file_bytes: bytes) -> str:
    """Extracts clean text from DOCX document bytes."""
    doc = Document(io.BytesIO(file_bytes))
    paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
    
    # Also extract text inside tables
    for table in doc.tables:
        for row in table.rows:
            row_text = " | ".join(cell.text.strip() for cell in row.cells if cell.text.strip())
            if row_text:
                paragraphs.append(row_text)
                
    return "\n".join(paragraphs).strip()


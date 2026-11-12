def extract_text_from_raw(raw_input: bytes | str) -> str:
    """Sanitizes and normalizes plain text resumes and email snippets."""
    if isinstance(raw_input, bytes):
        try:
            text = raw_input.decode("utf-8")
        except UnicodeDecodeError:
            text = raw_input.decode("latin-1", errors="ignore")
    else:
        text = str(raw_input)
        
    lines = [line.strip() for line in text.splitlines()]
    return "\n".join(line for line in lines if line)


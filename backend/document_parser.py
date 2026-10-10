"""
Extracts numbered/bulleted points from uploaded documents.
Supports: .txt, .pdf (via pypdf), .docx (via python-docx)
"""

import re
from pathlib import Path

def extract_points(file_path: str) -> list[str]:
    """
    Reads file and extracts numbered or bulleted points.
    
    Patterns matched:
      1) text      1. text     • text     - text     * text
    """
    text = read_file(file_path)
    
    # Pattern: starts with number/bullet, captures the rest of the line
    pattern = re.compile(
        r'^(?:\d+[\)\.]\s*|[•\-\*]\s*)(.+)$',
        re.MULTILINE
    )
    
    matches = [m.group(1).strip() for m in pattern.finditer(text)]
    
    # If no numbered points found, split by sentence and return top 6
    if not matches:
        sentences = [s.strip() for s in text.split('.') if len(s.strip()) > 15]
        matches = sentences[:6]
    
    return matches[:10]  # Max 10 points per upload


def read_file(file_path: str) -> str:
    suffix = Path(file_path).suffix.lower()
    
    if suffix == '.txt':
        return open(file_path, encoding='utf-8').read()
    
    elif suffix == '.pdf':
        import pypdf
        reader = pypdf.PdfReader(file_path)
        return '\n'.join(page.extract_text() for page in reader.pages)
    
    elif suffix in ('.doc', '.docx'):
        from docx import Document
        doc = Document(file_path)
        return '\n'.join(p.text for p in doc.paragraphs)
    
    else:
        raise ValueError(f"Unsupported file type: {suffix}")

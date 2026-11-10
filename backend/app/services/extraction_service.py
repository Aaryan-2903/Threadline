import io
from dataclasses import dataclass
from typing import List, Tuple
from fastapi import HTTPException, status
from app.core.config import settings

try:
    import pymupdf
except ImportError:
    import fitz as pymupdf  # fallback for older versions

import docx


@dataclass
class TextChunk:
    text: str
    source_reference: str
    page_number: int


@dataclass
class ExtractionResult:
    filename: str
    file_type: str
    page_count: int
    full_text: str
    chunks: List[TextChunk]


class DocumentExtractionService:
    @staticmethod
    def validate_file(filename: str, content: bytes) -> str:
        """Validate file size, extension, and non-empty content."""
        if not content or len(content) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded file is empty.",
            )

        if len(content) > settings.MAX_UPLOAD_SIZE_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File exceeds maximum allowed size of {settings.MAX_UPLOAD_SIZE_BYTES // (1024 * 1024)}MB.",
            )

        lower_name = filename.lower()
        if lower_name.endswith(".pdf"):
            return "pdf"
        elif lower_name.endswith(".docx"):
            return "docx"
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unsupported file format. Only PDF and DOCX files are supported.",
            )

    @classmethod
    def extract_text(cls, filename: str, content: bytes) -> ExtractionResult:
        """Extract text with page-level / paragraph-level citations."""
        file_type = cls.validate_file(filename, content)

        if file_type == "pdf":
            return cls._extract_pdf(filename, content)
        elif file_type == "docx":
            return cls._extract_docx(filename, content)
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported file type: {file_type}",
            )

    @classmethod
    def _extract_pdf(cls, filename: str, content: bytes) -> ExtractionResult:
        try:
            doc = pymupdf.open(stream=content, filetype="pdf")
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to parse PDF document. The file may be corrupt or encrypted: {str(e)}",
            )

        if doc.page_count == 0:
            doc.close()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="The PDF document contains no pages.",
            )

        chunks: List[TextChunk] = []
        full_text_parts: List[str] = []

        for page_idx in range(doc.page_count):
            page_num = page_idx + 1
            page = doc.load_page(page_idx)
            page_text = page.get_text("text").strip()
            if page_text:
                ref = f"Page {page_num}"
                chunks.append(TextChunk(text=page_text, source_reference=ref, page_number=page_num))
                full_text_parts.append(f"--- [Page {page_num}] ---\n{page_text}")

        page_count = doc.page_count
        doc.close()

        full_text = "\n\n".join(full_text_parts)
        return ExtractionResult(
            filename=filename,
            file_type="pdf",
            page_count=page_count,
            full_text=full_text,
            chunks=chunks,
        )

    @classmethod
    def _extract_docx(cls, filename: str, content: bytes) -> ExtractionResult:
        try:
            bio = io.BytesIO(content)
            doc = docx.Document(bio)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to parse DOCX document. The file may be corrupt or encrypted: {str(e)}",
            )

        chunks: List[TextChunk] = []
        full_text_parts: List[str] = []

        # Extract text from paragraphs
        current_section = "General"
        paragraph_idx = 0
        pseudo_page = 1
        lines_on_pseudo_page = 0

        for p in doc.paragraphs:
            text = p.text.strip()
            if not text:
                continue

            # Check if this looks like a heading
            if p.style and p.style.name and p.style.name.startswith("Heading"):
                current_section = text

            paragraph_idx += 1
            lines_on_pseudo_page += len(text) // 250 + 1
            if lines_on_pseudo_page > 15:
                pseudo_page += 1
                lines_on_pseudo_page = 0

            ref = f"Section: {current_section}, Para {paragraph_idx}"
            chunks.append(TextChunk(text=text, source_reference=ref, page_number=pseudo_page))
            full_text_parts.append(f"[{ref}]\n{text}")

        # Also extract text from tables if present
        for t_idx, table in enumerate(doc.tables):
            table_rows = []
            for row in table.rows:
                cells = [c.text.strip() for c in row.cells if c.text.strip()]
                if cells:
                    table_rows.append(" | ".join(cells))
            if table_rows:
                table_text = "\n".join(table_rows)
                ref = f"Table {t_idx + 1}"
                chunks.append(TextChunk(text=table_text, source_reference=ref, page_number=pseudo_page))
                full_text_parts.append(f"[{ref}]\n{table_text}")

        full_text = "\n\n".join(full_text_parts)
        page_count = max(1, pseudo_page)

        return ExtractionResult(
            filename=filename,
            file_type="docx",
            page_count=page_count,
            full_text=full_text,
            chunks=chunks,
        )


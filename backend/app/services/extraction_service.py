import io
import logging
import re
import zipfile
from dataclasses import dataclass
from typing import List, Tuple, Union
from fastapi import HTTPException, status
from app.core.config import settings

logger = logging.getLogger(__name__)


def _sanitize_error_message(error: Union[Exception, str]) -> str:
    """
    Sanitize error messages before logging to ensure API keys, tokens,
    credential query parameters, or database connection strings are never exposed to logs.
    """
    msg = str(error)
    # Redact query params like ?key=... or &key=...
    msg = re.sub(r"([?&]key=)[^&\s'\"]+", r"\1[REDACTED]", msg, flags=re.IGNORECASE)
    # Redact Bearer tokens
    msg = re.sub(r"(Bearer\s+)[A-Za-z0-9_\-\.]+", r"\1[REDACTED]", msg, flags=re.IGNORECASE)
    # Redact secret keys starting with sk-
    msg = re.sub(r"\bsk-[A-Za-z0-9_\-\.]+", r"sk-[REDACTED]", msg)
    # Redact Google API keys starting with AIza
    msg = re.sub(r"\bAIza[A-Za-z0-9_\-]+", r"AIza[REDACTED]", msg)
    # Redact x-goog-api-key header values
    msg = re.sub(r"(x-goog-api-key['\":\s=]+)[^,\s'\"]+", r"\1[REDACTED]", msg, flags=re.IGNORECASE)
    # Redact generic api_key / apikey patterns
    msg = re.sub(r"(api[_-]?key['\":\s=]+)[^,\s'\"]+", r"\1[REDACTED]", msg, flags=re.IGNORECASE)
    # Redact database connection URIs (e.g. postgresql://user:password@host/db)
    msg = re.sub(r"([a-zA-Z+]+://)([^:]+):([^@]+)@", r"\1[REDACTED]:[REDACTED]@", msg)
    return msg


def sanitize_exception(error: Exception) -> Exception:
    """
    Sanitize an exception's message and arguments in-place so that if logged with
    exc_info=True, the traceback's printed exception line does not expose credentials.
    """
    if hasattr(error, "args") and error.args:
        try:
            error.args = tuple(_sanitize_error_message(a) if isinstance(a, str) else a for a in error.args)
        except Exception:
            pass
    return error


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
        """
        Validate file size, extension, binary signature (magic bytes),
        and internal document structure before saving or processing.
        """
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
            # PDF validation: Must begin with valid PDF signature %PDF-
            if not content.startswith(b"%PDF-"):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid PDF document. File is missing required '%PDF-' signature or is corrupt.",
                )
            return "pdf"

        elif lower_name.endswith(".docx"):
            # DOCX validation: Must begin with standard ZIP local file header PK\x03\x04
            if not content.startswith(b"PK\x03\x04"):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid DOCX document. File does not contain a valid ZIP header signature.",
                )

            # Validate ZIP structure, archive safety / decompression bomb limits, and required entries
            try:
                bio = io.BytesIO(content)
                with zipfile.ZipFile(bio, "r") as zf:
                    infolist = zf.infolist()

                    # 1. Reject archives exceeding max entries limit (Zip-bomb: entry flood)
                    if len(infolist) > settings.MAX_DOCX_ENTRIES:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Invalid DOCX document. Archive contains too many entries.",
                        )

                    total_uncompressed_bytes = 0
                    for info in infolist:
                        # 2. Reject encrypted ZIP entries
                        is_encrypted = (info.flag_bits & 0x1 != 0) or (
                            hasattr(info, "is_encrypted") and info.is_encrypted()
                        )
                        if is_encrypted:
                            raise HTTPException(
                                status_code=status.HTTP_400_BAD_REQUEST,
                                detail="Invalid DOCX document. Encrypted archives or password-protected entries are not supported.",
                            )

                        # Check for corrupt negative sizes
                        if info.file_size < 0:
                            raise HTTPException(
                                status_code=status.HTTP_400_BAD_REQUEST,
                                detail="Invalid or corrupt DOCX archive. Corrupt entry metadata detected.",
                            )

                        # 3. Maximum individual uncompressed file size
                        if info.file_size > settings.MAX_DOCX_SINGLE_FILE_BYTES:
                            raise HTTPException(
                                status_code=status.HTTP_400_BAD_REQUEST,
                                detail="Invalid DOCX document. Individual file inside archive exceeds size limit.",
                            )

                        # 4. Individual entry compression ratio (for non-trivial entries)
                        if info.file_size > 100 * 1024:
                            entry_ratio = info.file_size / max(1, info.compress_size)
                            if entry_ratio > settings.MAX_DOCX_COMPRESSION_RATIO:
                                raise HTTPException(
                                    status_code=status.HTTP_400_BAD_REQUEST,
                                    detail="Invalid DOCX document. Suspicious compression ratio detected (potential decompression bomb).",
                                )

                        total_uncompressed_bytes += info.file_size

                    # 5. Maximum total uncompressed archive size
                    if total_uncompressed_bytes > settings.MAX_DOCX_TOTAL_UNCOMPRESSED_BYTES:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Invalid DOCX document. Total uncompressed archive size exceeds safety limit.",
                        )

                    # 6. Overall archive compression ratio (for non-trivial archives)
                    if total_uncompressed_bytes > 100 * 1024:
                        overall_ratio = total_uncompressed_bytes / max(1, len(content))
                        if overall_ratio > settings.MAX_DOCX_COMPRESSION_RATIO:
                            raise HTTPException(
                                status_code=status.HTTP_400_BAD_REQUEST,
                                detail="Invalid DOCX document. Suspicious compression ratio detected (potential decompression bomb).",
                            )

                    # 7. Required DOCX archive entries
                    namelist = set(zf.namelist())
                    if "[Content_Types].xml" not in namelist or "word/document.xml" not in namelist:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Invalid DOCX document. Archive is missing required document entries ([Content_Types].xml, word/document.xml).",
                        )
            except HTTPException:
                raise
            except (zipfile.BadZipFile, zipfile.LargeZipFile):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid or corrupt DOCX archive. Unable to parse document structure.",
                )
            except Exception:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid or corrupt DOCX archive. Unable to parse document structure.",
                )
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
        doc = None
        try:
            doc = pymupdf.open(stream=content, filetype="pdf")
            if doc.page_count == 0:
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
            full_text = "\n\n".join(full_text_parts)
            return ExtractionResult(
                filename=filename,
                file_type="pdf",
                page_count=page_count,
                full_text=full_text,
                chunks=chunks,
            )
        except HTTPException:
            raise
        except Exception as e:
            logger.error(
                "PDF extraction failed [operation=_extract_pdf, filename=%s, error_type=%s]: %s",
                filename,
                type(e).__name__,
                _sanitize_error_message(e),
                exc_info=True,
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to parse PDF document. The file may be corrupt, damaged, or encrypted.",
            )
        finally:
            if doc is not None:
                try:
                    doc.close()
                except Exception:
                    pass

    @classmethod
    def _extract_docx(cls, filename: str, content: bytes) -> ExtractionResult:
        try:
            bio = io.BytesIO(content)
            doc = docx.Document(bio)

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
        except HTTPException:
            raise
        except Exception as e:
            logger.error(
                "DOCX extraction failed [operation=_extract_docx, filename=%s, error_type=%s]: %s",
                filename,
                type(e).__name__,
                _sanitize_error_message(e),
                exc_info=True,
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to parse DOCX document. The file may be corrupt, damaged, or encrypted.",
            )


import json
import logging
import re
from typing import List, Optional
import httpx
from app.core.config import settings
from app.models.extracted_knowledge import KnowledgeCategory
from app.schemas.extracted_knowledge import AIStructuredExtraction, ExtractedClaimItem
from app.services.extraction_service import TextChunk, _sanitize_error_message

logger = logging.getLogger(__name__)


class AIKnowledgeService:
    @classmethod
    def extract_knowledge(
        cls, chunks: List[TextChunk], full_text: Optional[str] = None
    ) -> AIStructuredExtraction:
        """Extract structured knowledge items from text chunks using LLM or deterministic fallback."""
        if not chunks and not full_text:
            return AIStructuredExtraction(claims=[], document_summary=None)

        # 1. Attempt LLM extraction if an API key is provided
        if settings.GEMINI_API_KEY:
            try:
                llm_result = cls._call_gemini_extraction(chunks, settings.GEMINI_API_KEY)
                if llm_result and len(llm_result.claims) > 0:
                    return llm_result
            except Exception as e:
                sanitized_msg = _sanitize_error_message(e)
                logger.warning("Gemini extraction failed, falling back to semantic parser: %s", sanitized_msg)

        if settings.OPENAI_API_KEY:
            try:
                llm_result = cls._call_openai_extraction(chunks, settings.OPENAI_API_KEY)
                if llm_result and len(llm_result.claims) > 0:
                    return llm_result
            except Exception as e:
                sanitized_msg = _sanitize_error_message(e)
                logger.warning("OpenAI extraction failed, falling back to semantic parser: %s", sanitized_msg)

        # 2. Deterministic semantic extraction fallback
        return cls._semantic_rule_extraction(chunks)

    @classmethod
    def _semantic_rule_extraction(cls, chunks: List[TextChunk]) -> AIStructuredExtraction:
        """High precision rule-based semantic extractor for offline and fallback operation."""
        claims: List[ExtractedClaimItem] = []

        # Patterns for categories
        decision_pattern = re.compile(
            r"(?:we\s+decided\s+to|decision:|decided\s+to|agreed\s+to|approved|selected|chosen|resolved\s+that)\s+([^.\n]+)",
            re.IGNORECASE,
        )
        task_pattern = re.compile(
            r"(?:todo:|action\s+item:|must\s+implement|task:|need\s+to|will\s+deliver|assignee:|assigned\s+to)\s+([^.\n]+)",
            re.IGNORECASE,
        )
        risk_pattern = re.compile(
            r"(?:risk:|blocker:|concern:|warning:|threat:|bottleneck|vulnerability|delay\s+risk)\s+([^.\n]+)",
            re.IGNORECASE,
        )
        question_pattern = re.compile(
            r"(?:open\s+question:|question:|tbd:|unresolved:|to\s+clarify:|need\s+confirmation)\s+([^.\n]+)",
            re.IGNORECASE,
        )
        conflict_pattern = re.compile(
            r"(?:conflict:|discrepancy:|disagreement:|incompatible\s+with|contradicts)\s+([^.\n]+)",
            re.IGNORECASE,
        )

        owner_pattern = re.compile(
            r"(?:assigned\s+to|owner:|decided\s+by|lead:|by)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)",
            re.IGNORECASE,
        )

        for chunk in chunks:
            text = chunk.text
            sentences = re.split(r"(?<=[.!?])\s+|\n+", text)

            for sentence in sentences:
                clean_s = sentence.strip()
                if len(clean_s) < 15:
                    continue

                matched = False
                # Check decisions
                m_dec = decision_pattern.search(clean_s)
                if m_dec:
                    matched = True
                    desc = m_dec.group(1).strip()
                    title = f"Decision: {desc[:80].capitalize()}" if len(desc) > 5 else clean_s[:80]
                    owner_m = owner_pattern.search(clean_s)
                    owner = owner_m.group(1) if owner_m else None
                    claims.append(
                        ExtractedClaimItem(
                            category=KnowledgeCategory.DECISION,
                            title=title,
                            content=clean_s,
                            evidence_snippet=clean_s[:280],
                            source_reference=chunk.source_reference,
                            page_number=chunk.page_number,
                            confidence=0.92,
                            owner=owner,
                            impact_scope="Architecture & Governance",
                        )
                    )

                # Check tasks
                m_task = task_pattern.search(clean_s)
                if m_task:
                    matched = True
                    desc = m_task.group(1).strip()
                    title = f"Task: {desc[:80].capitalize()}" if len(desc) > 5 else clean_s[:80]
                    owner_m = owner_pattern.search(clean_s)
                    owner = owner_m.group(1) if owner_m else None
                    claims.append(
                        ExtractedClaimItem(
                            category=KnowledgeCategory.TASK,
                            title=title,
                            content=clean_s,
                            evidence_snippet=clean_s[:280],
                            source_reference=chunk.source_reference,
                            page_number=chunk.page_number,
                            confidence=0.88,
                            owner=owner,
                            impact_scope="Engineering Sprint",
                        )
                    )

                # Check risks
                m_risk = risk_pattern.search(clean_s)
                if m_risk:
                    matched = True
                    desc = m_risk.group(1).strip()
                    title = f"Risk: {desc[:80].capitalize()}" if len(desc) > 5 else clean_s[:80]
                    claims.append(
                        ExtractedClaimItem(
                            category=KnowledgeCategory.RISK,
                            title=title,
                            content=clean_s,
                            evidence_snippet=clean_s[:280],
                            source_reference=chunk.source_reference,
                            page_number=chunk.page_number,
                            confidence=0.86,
                            impact_scope="Operational Resilience",
                        )
                    )

                # Check questions
                m_q = question_pattern.search(clean_s)
                if m_q:
                    matched = True
                    desc = m_q.group(1).strip()
                    title = f"Question: {desc[:80].capitalize()}" if len(desc) > 5 else clean_s[:80]
                    claims.append(
                        ExtractedClaimItem(
                            category=KnowledgeCategory.QUESTION,
                            title=title,
                            content=clean_s,
                            evidence_snippet=clean_s[:280],
                            source_reference=chunk.source_reference,
                            page_number=chunk.page_number,
                            confidence=0.84,
                            impact_scope="Handover Alignment",
                        )
                    )

                # Check conflicts
                m_conf = conflict_pattern.search(clean_s)
                if m_conf:
                    matched = True
                    desc = m_conf.group(1).strip()
                    title = f"Conflict: {desc[:80].capitalize()}" if len(desc) > 5 else clean_s[:80]
                    claims.append(
                        ExtractedClaimItem(
                            category=KnowledgeCategory.CONFLICT,
                            title=title,
                            content=clean_s,
                            evidence_snippet=clean_s[:280],
                            source_reference=chunk.source_reference,
                            page_number=chunk.page_number,
                            confidence=0.89,
                            impact_scope="System Specification",
                        )
                    )

        # If text had content but no explicit keywords triggered, generate generic claims from paragraphs
        if not claims and chunks:
            for idx, chunk in enumerate(chunks[:5]):
                first_line = chunk.text.split("\n")[0].strip()
                if len(first_line) > 10:
                    claims.append(
                        ExtractedClaimItem(
                            category=KnowledgeCategory.DECISION if idx % 2 == 0 else KnowledgeCategory.TASK,
                            title=first_line[:80],
                            content=chunk.text[:300],
                            evidence_snippet=chunk.text[:280],
                            source_reference=chunk.source_reference,
                            page_number=chunk.page_number,
                            confidence=0.82,
                            impact_scope="Project Knowledge",
                        )
                    )

        summary = f"Extracted {len(claims)} knowledge items across {len(chunks)} source chunks."
        return AIStructuredExtraction(claims=claims, document_summary=summary)

    @classmethod
    def _call_gemini_extraction(
        cls, chunks: List[TextChunk], api_key: str
    ) -> Optional[AIStructuredExtraction]:
        """Call Google Gemini 2.0 API to extract structured claims."""
        sample_text = "\n\n".join(
            [f"[{c.source_reference} (Page {c.page_number})]: {c.text}" for c in chunks[:12]]
        )

        prompt = (
            "You are an expert AI knowledge handover assistant. Analyze the following document text and "
            "extract all key project knowledge into structured claims. "
            "Categories must be one of: 'decision', 'task', 'risk', 'question', 'conflict'. "
            "For each item, provide: category, title (concise summary), content (elaboration), "
            "evidence_snippet (verbatim quotation from the text), source_reference (e.g. Page 2), "
            "page_number (integer), confidence (0.0 to 1.0), owner (person name if specified), and impact_scope.\n\n"
            "Return a JSON object with a single key 'claims' containing an array of claim objects.\n\n"
            f"DOCUMENT CONTENT:\n{sample_text}"
        )

        url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"
        headers = {
            "x-goog-api-key": api_key,
            "Content-Type": "application/json",
        }
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "responseMimeType": "application/json",
            },
        }

        with httpx.Client(timeout=25.0) as client:
            resp = client.post(url, json=payload, headers=headers)
            if resp.status_code == 200:
                data = resp.json()
                text_content = data["candidates"][0]["content"]["parts"][0]["text"]
                parsed = json.loads(text_content)
                claims = [ExtractedClaimItem(**item) for item in parsed.get("claims", [])]
                return AIStructuredExtraction(claims=claims, document_summary="Generated by Gemini 2.0")
            else:
                logger.warning(
                    "Gemini API returned non-200 status %d (response length: %d)",
                    resp.status_code,
                    len(resp.text),
                )

        return None

    @classmethod
    def _call_openai_extraction(
        cls, chunks: List[TextChunk], api_key: str
    ) -> Optional[AIStructuredExtraction]:
        """Call OpenAI API to extract structured claims."""
        sample_text = "\n\n".join(
            [f"[{c.source_reference} (Page {c.page_number})]: {c.text}" for c in chunks[:12]]
        )

        prompt = (
            "Extract structured project knowledge items (decisions, tasks, risks, questions, conflicts) "
            "with verbatim evidence_snippet, source_reference, page_number, confidence, owner, and impact_scope. "
            "Return JSON matching { 'claims': [...] }.\n\n"
            f"DOCUMENT:\n{sample_text}"
        )

        url = "https://api.openai.com/v1/chat/completions"
        headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
        payload = {
            "model": "gpt-4o-mini",
            "messages": [{"role": "user", "content": prompt}],
            "response_format": {"type": "json_object"},
        }

        with httpx.Client(timeout=25.0) as client:
            resp = client.post(url, json=payload, headers=headers)
            if resp.status_code == 200:
                data = resp.json()
                content = data["choices"][0]["message"]["content"]
                parsed = json.loads(content)
                claims = [ExtractedClaimItem(**item) for item in parsed.get("claims", [])]
                return AIStructuredExtraction(claims=claims, document_summary="Generated by OpenAI")

        return None


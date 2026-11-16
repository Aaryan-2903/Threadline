import re
from typing import Any, Dict, List, Tuple


# Regex patterns for sensitive information detection
EMAIL_REGEX = re.compile(
    r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,24}\b",
    re.IGNORECASE,
)

# International and domestic phone numbers: e.g. +1-555-123-4567, (555) 123-4567, +91 9876543210
PHONE_REGEX = re.compile(
    r"(?:(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{2,4}\)?[-.\s]?)?\d{3,4}[-.\s]?\d{4}\b)",
)

# API Keys and Secret Tokens
API_KEY_PATTERNS = [
    # OpenAI secret key: sk-...
    (re.compile(r"\b(sk-[A-Za-z0-9]{20,T3BlbkFJ[A-Za-z0-9]{20,}|sk-proj-[A-Za-z0-9_\-]{40,}|sk-[a-zA-Z0-9]{32,})\b"), "[REDACTED_API_KEY:OPENAI]"),
    # Google Gemini / Cloud API Key: AIza...
    (re.compile(r"\b(AIza[0-9A-Za-z\-_]{30,40})\b"), "[REDACTED_API_KEY:GOOGLE]"),
    # GitHub Personal Access Token: ghp_..., github_pat_...
    (re.compile(r"\b(ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{40,})\b"), "[REDACTED_TOKEN:GITHUB]"),
    # AWS Access Key ID: AKIA...
    (re.compile(r"\b(AKIA[0-9A-Z]{16})\b"), "[REDACTED_KEY:AWS]"),
    # Generic Bearer tokens: Bearer ey... or Bearer [hex/b64]
    (re.compile(r"(?i)\bBearer\s+([A-Za-z0-9_\-\.]{25,})\b"), "Bearer [REDACTED_TOKEN]"),
    # Generic API Key / Secret assignments: api_key = "...", secret_key = "..."
    (re.compile(r"""(?i)(["']?(?:api[_-]?key|secret[_-]?key|client[_-]?secret|private[_-]?key|auth[_-]?token)["']?\s*[:=]\s*["'])([A-Za-z0-9_\-\.]{12,})(["'])"""), r"\1[REDACTED_SECRET]\3"),
]


class RedactionService:
    @staticmethod
    def scan_sensitive_data(text: str) -> List[Dict[str, Any]]:
        """
        Scan text and return detailed matches for sensitive information
        without exposing full secret contents in the report.
        """
        if not text:
            return []

        findings: List[Dict[str, Any]] = []

        # Scan emails
        for match in EMAIL_REGEX.finditer(text):
            val = match.group(0)
            parts = val.split("@")
            masked_preview = f"{parts[0][:2]}***@{parts[1]}" if len(parts[0]) > 2 else f"***@{parts[1]}"
            findings.append({
                "type": "email",
                "preview": masked_preview,
                "start": match.start(),
                "end": match.end(),
            })

        # Scan phone numbers (exclude short strings that look like single numbers)
        for match in PHONE_REGEX.finditer(text):
            val = match.group(0).strip()
            digits = re.sub(r"\D", "", val)
            if 7 <= len(digits) <= 15:
                findings.append({
                    "type": "phone",
                    "preview": f"***-***-{digits[-4:]}",
                    "start": match.start(),
                    "end": match.end(),
                })

        # Scan API keys
        for pattern, label in API_KEY_PATTERNS:
            for match in pattern.finditer(text):
                val = match.group(0)
                findings.append({
                    "type": "api_key",
                    "preview": f"{val[:4]}...[MASKED]",
                    "label": label,
                    "start": match.start(),
                    "end": match.end(),
                })

        return findings

    @staticmethod
    def redact_text(text: str) -> Tuple[str, int]:
        """
        Sanitize text by replacing emails, phone numbers, and API keys with secure placeholders.
        Returns the sanitized string and the total number of redactions made.
        """
        if not text:
            return text, 0

        redacted = text
        count = 0

        # Redact API keys first to prevent phone/number collision with numeric tokens
        for pattern, replacement in API_KEY_PATTERNS:
            redacted, n = pattern.subn(replacement, redacted)
            count += n

        # Redact emails
        redacted, n = EMAIL_REGEX.subn("[REDACTED_EMAIL]", redacted)
        count += n

        # Redact phone numbers (with validation of digit length)
        def _mask_phone(match: re.Match) -> str:
            nonlocal count
            val = match.group(0)
            digits = re.sub(r"\D", "", val)
            if 7 <= len(digits) <= 15:
                count += 1
                return "[REDACTED_PHONE]"
            return val

        redacted = PHONE_REGEX.sub(_mask_phone, redacted)

        return redacted, count

    @classmethod
    def redact_data_structure(cls, data: Any) -> Tuple[Any, int]:
        """
        Recursively redact sensitive text within nested dictionaries, lists, or strings.
        """
        if isinstance(data, str):
            return cls.redact_text(data)
        elif isinstance(data, list):
            new_list = []
            total = 0
            for item in data:
                redacted_item, n = cls.redact_data_structure(item)
                new_list.append(redacted_item)
                total += n
            return new_list, total
        elif isinstance(data, dict):
            new_dict = {}
            total = 0
            for k, v in data.items():
                redacted_v, n = cls.redact_data_structure(v)
                new_dict[k] = redacted_v
                total += n
            return new_dict, total
        return data, 0


redaction_service = RedactionService()


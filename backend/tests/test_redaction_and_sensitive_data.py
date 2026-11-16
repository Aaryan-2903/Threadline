from app.services.redaction_service import redaction_service


def test_redaction_service_masks_emails_phones_and_keys():
    text = (
        "Internal incident report:\n"
        "Lead engineer: john.doe@internal-company.org\n"
        "Direct line: +1-202-555-0143\n"
        "OpenAI API Key: sk-proj-ab9871239847129384712983471928347192837419827341982734\n"
        "Google Cloud API Key: AIzaSyB1234567890abcdefghijklmnopqrstuv\n"
        "GitHub token: ghp_123456789012345678901234567890123456\n"
        "Header: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.doNotLeakThisSignature\n"
    )

    findings = redaction_service.scan_sensitive_data(text)
    assert len(findings) >= 5

    types = {f["type"] for f in findings}
    assert "email" in types
    assert "phone" in types
    assert "api_key" in types

    redacted_text, count = redaction_service.redact_text(text)
    assert count >= 5
    assert "john.doe@internal-company.org" not in redacted_text
    assert "[REDACTED_EMAIL]" in redacted_text
    assert "+1-202-555-0143" not in redacted_text
    assert "[REDACTED_PHONE]" in redacted_text
    assert "sk-proj-" not in redacted_text
    assert "AIzaSy" not in redacted_text
    assert "ghp_" not in redacted_text


def test_recursive_redaction_structure():
    payload = {
        "title": "Config Report",
        "contacts": [
            {"name": "Alice", "email": "alice@corp.com", "phone": "555-123-4567"},
        ],
        "credentials": {
            "token": "AIzaSyB1234567890abcdefghijklmnopqrstuv",
        },
    }
    redacted, count = redaction_service.redact_data_structure(payload)
    assert count >= 3
    assert redacted["contacts"][0]["email"] == "[REDACTED_EMAIL]"
    assert redacted["contacts"][0]["phone"] == "[REDACTED_PHONE]"
    assert "AIza" not in redacted["credentials"]["token"]


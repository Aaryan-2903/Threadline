import time
import pytest
from fastapi import status
from app.core.config import settings
from app.core.rate_limiter import limiter, get_client_ip, get_route_tier


def test_rate_limiter_allows_requests_under_limit(client):
    """
    Verify requests under the rate limit succeed and return standard rate limit headers.
    """
    res = client.get("/api/v1/projects/")
    assert res.status_code == status.HTTP_200_OK

    assert "x-ratelimit-limit" in res.headers
    assert "x-ratelimit-remaining" in res.headers
    assert "x-ratelimit-reset" in res.headers

    limit_val = int(res.headers["x-ratelimit-limit"])
    rem_val = int(res.headers["x-ratelimit-remaining"])
    assert limit_val == settings.RATE_LIMIT_GENERAL
    assert rem_val < limit_val


def test_rate_limiter_blocks_when_general_limit_exceeded(client, monkeypatch):
    """
    Verify exceeding the general rate limit returns HTTP 429 with Retry-After header.
    """
    test_limit = 5
    monkeypatch.setattr(settings, "RATE_LIMIT_GENERAL", test_limit)
    monkeypatch.setattr(settings, "RATE_LIMIT_GENERAL_WINDOW", 60)

    # First 5 requests should pass
    for i in range(test_limit):
        res = client.get("/api/v1/projects/")
        assert res.status_code == status.HTTP_200_OK
        assert int(res.headers["x-ratelimit-remaining"]) == test_limit - (i + 1)

    # 6th request must be blocked with HTTP 429
    blocked_res = client.get("/api/v1/projects/")
    assert blocked_res.status_code == status.HTTP_429_TOO_MANY_REQUESTS

    # Verify Retry-After header
    assert "retry-after" in blocked_res.headers
    retry_after = int(blocked_res.headers["retry-after"])
    assert retry_after > 0
    assert blocked_res.headers["x-ratelimit-remaining"] == "0"

    # Verify safe response body
    detail = blocked_res.json()["detail"]
    assert "Rate limit exceeded" in detail
    assert "Try again in" in detail


def test_expensive_endpoints_have_dedicated_strict_limits(client, monkeypatch):
    """
    Verify expensive endpoints (e.g. report generation, batch review approval)
    use the dedicated expensive tier limit.
    """
    expensive_limit = 3
    monkeypatch.setattr(settings, "RATE_LIMIT_EXPENSIVE", expensive_limit)
    monkeypatch.setattr(settings, "RATE_LIMIT_EXPENSIVE_WINDOW", 60)

    # Create project to use for report generation
    proj = client.post("/api/v1/projects/", json={"name": "Expensive Limit Proj"}).json()
    project_id = proj["id"]

    # Trigger expensive endpoint 3 times
    for i in range(expensive_limit):
        res = client.post(f"/api/v1/reports/generate?project_id={project_id}")
        assert res.status_code == status.HTTP_201_CREATED
        assert int(res.headers["x-ratelimit-remaining"]) == expensive_limit - (i + 1)

    # 4th request must exceed expensive limit
    blocked_res = client.post(f"/api/v1/reports/generate?project_id={project_id}")
    assert blocked_res.status_code == status.HTTP_429_TOO_MANY_REQUESTS
    assert "retry-after" in blocked_res.headers


def test_different_clients_do_not_share_limits(client, monkeypatch):
    """
    Verify that Client A reaching their rate limit does not block Client B.
    """
    test_limit = 2
    monkeypatch.setattr(settings, "RATE_LIMIT_GENERAL", test_limit)
    monkeypatch.setattr(settings, "RATE_LIMIT_GENERAL_WINDOW", 60)

    # Client A: 198.51.100.1
    # Client B: 198.51.100.2
    # In order to simulate distinct client IPs through TestClient, configure testclient as a trusted proxy
    monkeypatch.setattr(settings, "TRUSTED_PROXIES", "testclient")

    # Client A exhausts their quota
    headers_a = {"x-forwarded-for": "198.51.100.1"}
    for _ in range(test_limit):
        res = client.get("/api/v1/projects/", headers=headers_a)
        assert res.status_code == status.HTTP_200_OK

    res_a_blocked = client.get("/api/v1/projects/", headers=headers_a)
    assert res_a_blocked.status_code == status.HTTP_429_TOO_MANY_REQUESTS

    # Client B makes a request with their own IP and must succeed
    headers_b = {"x-forwarded-for": "198.51.100.2"}
    res_b = client.get("/api/v1/projects/", headers=headers_b)
    assert res_b.status_code == status.HTTP_200_OK
    assert int(res_b.headers["x-ratelimit-remaining"]) == test_limit - 1


def test_arbitrary_untrusted_forwarded_for_headers_are_ignored(client, monkeypatch):
    """
    Security verification:
    When TRUSTED_PROXIES is empty (default), an attacker cannot bypass rate limits
    by rotating arbitrary X-Forwarded-For headers.
    """
    test_limit = 2
    monkeypatch.setattr(settings, "RATE_LIMIT_GENERAL", test_limit)
    monkeypatch.setattr(settings, "RATE_LIMIT_GENERAL_WINDOW", 60)
    monkeypatch.setattr(settings, "TRUSTED_PROXIES", "")  # Untrusted!

    # Attacker tries sending spoofed IP 1.1.1.1, then 2.2.2.2, then 3.3.3.3
    res1 = client.get("/api/v1/projects/", headers={"x-forwarded-for": "1.1.1.1"})
    assert res1.status_code == status.HTTP_200_OK

    res2 = client.get("/api/v1/projects/", headers={"x-forwarded-for": "2.2.2.2"})
    assert res2.status_code == status.HTTP_200_OK

    # 3rd request from same real connection (testclient) MUST be blocked despite new fake IP
    res3 = client.get("/api/v1/projects/", headers={"x-forwarded-for": "3.3.3.3"})
    assert res3.status_code == status.HTTP_429_TOO_MANY_REQUESTS


def test_exempt_routes_are_not_rate_limited(client, monkeypatch):
    """
    Verify health, root, docs, and openapi routes are never blocked by rate limiting.
    """
    monkeypatch.setattr(settings, "RATE_LIMIT_GENERAL", 1)
    monkeypatch.setattr(settings, "RATE_LIMIT_GENERAL_WINDOW", 60)

    # Rapid calls to health check
    for _ in range(5):
        res = client.get("/health")
        assert res.status_code == status.HTTP_200_OK
        assert res.json() == {"status": "healthy"}
        # Exempt routes should not have rate limit headers
        assert "x-ratelimit-limit" not in res.headers

    # Root endpoint
    res_root = client.get("/")
    assert res_root.status_code == status.HTTP_200_OK
    assert "x-ratelimit-limit" not in res_root.headers


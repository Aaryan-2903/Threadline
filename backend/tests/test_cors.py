import pytest
from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from starlette.testclient import TestClient
from app.core.config import Settings, settings
from app.core.rate_limiter import RateLimitMiddleware, limiter
from app.main import app


def test_configured_frontend_origin_allowed(client):
    """
    Verify that an explicitly configured frontend origin receives the matching
    Access-Control-Allow-Origin header and credentials support.
    """
    origin = "http://localhost:5173"
    response = client.get("/api/v1/projects/", headers={"origin": origin})

    assert response.status_code == status.HTTP_200_OK
    assert response.headers.get("access-control-allow-origin") == origin
    assert response.headers.get("access-control-allow-credentials") == "true"


def test_unconfigured_origin_rejected(client):
    """
    Verify that an unconfigured external origin does NOT receive Access-Control-Allow-Origin.
    """
    untrusted_origin = "https://unauthorized-domain.com"
    response = client.get("/api/v1/projects/", headers={"origin": untrusted_origin})

    assert response.status_code == status.HTTP_200_OK
    assert "access-control-allow-origin" not in response.headers


def test_arbitrary_vercel_preview_domains_not_blindly_trusted(client):
    """
    Security verification:
    Arbitrary *.vercel.app domains are rejected unless explicitly listed in FRONTEND_URLS.
    """
    attacker_vercel_domain = "https://malicious-preview-app.vercel.app"
    response = client.get("/api/v1/projects/", headers={"origin": attacker_vercel_domain})

    assert response.status_code == status.HTTP_200_OK
    assert "access-control-allow-origin" not in response.headers


def test_multiple_configured_origins_support():
    """
    Verify parsing and normalization of multiple comma-separated origins.
    """
    custom_settings = Settings(
        ENVIRONMENT="production",
        FRONTEND_URLS="https://threadline.vercel.app, https://threadline-git-feat.vercel.app/, http://localhost:3000",
        CORS_ALLOW_CREDENTIALS=True,
    )
    origins = custom_settings.allowed_cors_origins

    # Trailing slashes stripped and whitespace trimmed
    assert "https://threadline.vercel.app" in origins
    assert "https://threadline-git-feat.vercel.app" in origins
    assert "http://localhost:3000" in origins
    assert len(origins) == 3


def test_wildcard_origin_prohibited_in_production():
    """
    Verify that unrestricted wildcard '*' is rejected in production environments.
    """
    custom_settings = Settings(
        ENVIRONMENT="production",
        FRONTEND_URLS="*",
        CORS_ALLOW_CREDENTIALS=False,
    )
    with pytest.raises(ValueError, match="strictly prohibited in production"):
        _ = custom_settings.allowed_cors_origins


def test_wildcard_origin_cannot_combine_with_credentials():
    """
    Verify that CORS wildcard '*' cannot be combined with credentials per CORS spec.
    """
    custom_settings = Settings(
        ENVIRONMENT="development",
        FRONTEND_URLS="*",
        CORS_ALLOW_CREDENTIALS=True,
    )
    with pytest.raises(ValueError, match="cannot be combined with allow_credentials=True"):
        _ = custom_settings.allowed_cors_origins


def test_options_preflight_for_supported_methods_and_headers(client):
    """
    Verify CORS preflight OPTIONS request returns allowed methods and headers.
    """
    origin = "http://localhost:5173"
    response = client.options(
        "/api/v1/projects/",
        headers={
            "origin": origin,
            "access-control-request-method": "PATCH",
            "access-control-request-headers": "content-type,authorization",
        },
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.headers.get("access-control-allow-origin") == origin
    assert response.headers.get("access-control-allow-credentials") == "true"
    allow_methods = response.headers.get("access-control-allow-methods", "")
    assert "PATCH" in allow_methods
    assert "POST" in allow_methods


def test_rate_limit_429_response_retains_cors_headers(client, monkeypatch):
    """
    Verify that when RateLimitMiddleware returns an HTTP 429 response,
    the outer CORSMiddleware still attaches the Access-Control-Allow-Origin header
    so the browser does not fail with an opaque CORS error.
    """
    origin = "http://localhost:5173"
    monkeypatch.setattr(settings, "RATE_LIMIT_GENERAL", 1)
    monkeypatch.setattr(settings, "RATE_LIMIT_GENERAL_WINDOW", 60)

    # 1. First request succeeds
    res1 = client.get("/api/v1/projects/", headers={"origin": origin})
    assert res1.status_code == status.HTTP_200_OK
    assert res1.headers.get("access-control-allow-origin") == origin

    # 2. Second request is throttled with 429
    res2 = client.get("/api/v1/projects/", headers={"origin": origin})
    assert res2.status_code == status.HTTP_429_TOO_MANY_REQUESTS

    # 3. Must still include CORS headers
    assert res2.headers.get("access-control-allow-origin") == origin
    assert res2.headers.get("access-control-allow-credentials") == "true"
    assert "retry-after" in res2.headers


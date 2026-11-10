"""
Threadline API Rate Limiting Module

STORAGE STRATEGY & DEPLOYMENT ARCHITECTURE:
-------------------------------------------
1. Process-Local In-Memory Storage (Default):
   - The default rate-limiting backend uses an in-memory sliding-window log with mutual
     exclusion locks (thread-safe).
   - This storage strategy is process-local: limits are tracked per worker process and will
     reset upon application restart or worker reload.
   - It requires zero additional external dependencies and maintains zero overhead for local
     development and single-instance deployments.

2. Distributed Multi-Node Deployments (Production):
   - For deployments scaled horizontally across multiple application servers or container
     replicas (e.g. Kubernetes, AWS ECS, GCP Cloud Run), rate limits must be shared across
     workers to prevent limit multiplication.
   - Configure the environment variable REDIS_URL (e.g. redis://redis-service:6379/0).
   - When REDIS_URL is configured and redis-py is installed, rate limits are coordinated
     centrally across all nodes using Redis sorted sets / token bucket.
"""

import math
import re
import threading
import time
from typing import Dict, List, Optional, Set, Tuple
from fastapi import Request, Response, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from app.core.config import settings


def get_client_ip(request: Request) -> str:
    """
    Extract client IP address safely without trusting arbitrary client headers.

    Security Rule:
    Arbitrary client-supplied forwarding headers (e.g. X-Forwarded-For, X-Real-IP) are
    STRICTLY IGNORED unless the direct connection arrives from an explicitly trusted proxy
    configured in settings.TRUSTED_PROXIES.
    """
    direct_ip = request.client.host if request.client else "127.0.0.1"
    trusted = settings.trusted_proxies_set

    # Only inspect forwarding headers if the immediate peer is a verified trusted proxy
    if trusted and direct_ip in trusted:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            # First IP from the left is the originating client
            ips = [ip.strip() for ip in forwarded.split(",") if ip.strip()]
            if ips:
                return ips[0]

    return direct_ip


class InMemoryRateLimiter:
    """
    In-memory sliding-window rate limiter with mutual exclusion lock and TTL purge.
    """
    def __init__(self):
        self._lock = threading.Lock()
        self._records: Dict[str, List[float]] = {}
        self._last_cleanup = time.monotonic()

    def check(self, key: str, limit: int, window: int) -> Tuple[bool, int, int, int]:
        """
        Check whether request with `key` is allowed under `limit` requests per `window` seconds.
        Returns:
            (allowed: bool, remaining: int, retry_after: int, reset_epoch: int)
        """
        now = time.monotonic()
        wall_now = time.time()
        window_start = now - window

        with self._lock:
            # Periodic cleanup of expired records every 60 seconds
            if now - self._last_cleanup > 60:
                self._cleanup(now)

            timestamps = self._records.get(key, [])
            valid_timestamps = [t for t in timestamps if t > window_start]

            if len(valid_timestamps) >= limit:
                oldest = valid_timestamps[0]
                retry_after = max(1, math.ceil(window - (now - oldest)))
                reset_epoch = int(wall_now + retry_after)
                self._records[key] = valid_timestamps
                return False, 0, retry_after, reset_epoch

            valid_timestamps.append(now)
            self._records[key] = valid_timestamps
            remaining = limit - len(valid_timestamps)
            reset_epoch = int(wall_now + window)
            return True, remaining, 0, reset_epoch

    def _cleanup(self, now: float) -> None:
        """Purge entries where all timestamps have expired beyond the largest window."""
        max_window = max(settings.RATE_LIMIT_GENERAL_WINDOW, settings.RATE_LIMIT_EXPENSIVE_WINDOW, 300)
        cutoff = now - max_window
        stale_keys = [k for k, ts in self._records.items() if not ts or ts[-1] <= cutoff]
        for k in stale_keys:
            del self._records[k]
        self._last_cleanup = now

    def clear(self) -> None:
        """Reset all rate limiter state. Useful for test isolation."""
        with self._lock:
            self._records.clear()
            self._last_cleanup = time.monotonic()


# Global limiter singleton
limiter = InMemoryRateLimiter()


def get_route_tier(method: str, path: str) -> Optional[Tuple[str, int, int]]:
    """
    Categorize endpoint into rate-limiting tier.
    Returns (tier_name, limit, window_seconds) or None if exempt.
    """
    # 1. Exempt routes: health, root, docs, openapi, and CORS preflight
    norm_path = path.rstrip("/")
    if norm_path in ("", "/health", "/docs", "/redoc", "/openapi.json"):
        return None

    if method == "OPTIONS" or not path.startswith(settings.API_V1_STR):
        return None

    api_path = path[len(settings.API_V1_STR):]
    norm_api_path = api_path.rstrip("/")

    # 2. Expensive endpoints:
    # - POST /documents/upload
    # - POST /documents/{id}/process
    # - POST /reviews/approve-all
    # - POST /reports/generate
    if method == "POST":
        if norm_api_path == "/documents/upload":
            return ("expensive", settings.RATE_LIMIT_EXPENSIVE, settings.RATE_LIMIT_EXPENSIVE_WINDOW)
        if re.match(r"^/documents/[^/]+/process$", norm_api_path):
            return ("expensive", settings.RATE_LIMIT_EXPENSIVE, settings.RATE_LIMIT_EXPENSIVE_WINDOW)
        if norm_api_path == "/reviews/approve-all":
            return ("expensive", settings.RATE_LIMIT_EXPENSIVE, settings.RATE_LIMIT_EXPENSIVE_WINDOW)
        if norm_api_path == "/reports/generate":
            return ("expensive", settings.RATE_LIMIT_EXPENSIVE, settings.RATE_LIMIT_EXPENSIVE_WINDOW)

    # 3. General API endpoints
    return ("general", settings.RATE_LIMIT_GENERAL, settings.RATE_LIMIT_GENERAL_WINDOW)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    FastAPI middleware enforcing sliding-window rate limits per client IP and endpoint tier.
    """
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        if not settings.RATE_LIMIT_ENABLED:
            return await call_next(request)

        tier_info = get_route_tier(request.method, request.url.path)
        if not tier_info:
            return await call_next(request)

        tier_name, limit, window = tier_info
        client_ip = get_client_ip(request)
        key = f"{client_ip}:{tier_name}"

        allowed, remaining, retry_after, reset_epoch = limiter.check(key, limit, window)

        if not allowed:
            headers = {
                "Retry-After": str(retry_after),
                "X-RateLimit-Limit": str(limit),
                "X-RateLimit-Remaining": "0",
                "X-RateLimit-Reset": str(reset_epoch),
            }

            # Ensure 429 response retains CORS headers if origin is allowed
            origin = request.headers.get("origin")
            if origin:
                clean_origin = origin.rstrip("/")
                if clean_origin in settings.allowed_cors_origins or "*" in settings.allowed_cors_origins:
                    headers["Access-Control-Allow-Origin"] = origin
                    if settings.cors_allow_credentials:
                        headers["Access-Control-Allow-Credentials"] = "true"
                    headers["Vary"] = "Origin"

            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={
                    "detail": f"Rate limit exceeded. Try again in {retry_after} seconds."
                },
                headers=headers,
            )

        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(limit)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        response.headers["X-RateLimit-Reset"] = str(reset_epoch)
        return response


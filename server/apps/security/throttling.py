from __future__ import annotations

import logging
import math
import time
from dataclasses import dataclass

from django.conf import settings
from django.core.cache import caches
from django.core.exceptions import ImproperlyConfigured
from django.utils.crypto import salted_hmac
from rest_framework.throttling import BaseThrottle

from .ip import get_client_ip

logger = logging.getLogger("clinic.security.rate_limit")


@dataclass(frozen=True)
class RatePolicy:
    limit: int
    window_seconds: int
    critical: bool = False


@dataclass(frozen=True)
class LimitResult:
    allowed: bool
    wait: int | None = None
    count: int = 0


PERIODS = {
    "s": 1,
    "sec": 1,
    "second": 1,
    "seconds": 1,
    "m": 60,
    "min": 60,
    "minute": 60,
    "minutes": 60,
    "h": 60 * 60,
    "hour": 60 * 60,
    "hours": 60 * 60,
    "d": 24 * 60 * 60,
    "day": 24 * 60 * 60,
    "days": 24 * 60 * 60,
}


def parse_rate(value: str) -> tuple[int, int]:
    try:
        count, period = value.split("/", 1)
        count_int = int(count)
    except (TypeError, ValueError) as error:
        raise ImproperlyConfigured(f"Invalid rate-limit value: {value!r}") from error

    period = period.strip().lower()
    digits = ""
    while period and period[0].isdigit():
        digits += period[0]
        period = period[1:]
    multiplier = int(digits or "1")
    seconds = PERIODS.get(period)
    if count_int < 1 or multiplier < 1 or seconds is None:
        raise ImproperlyConfigured(f"Invalid rate-limit value: {value!r}")
    return count_int, multiplier * seconds


def policy_for_scope(scope: str) -> RatePolicy:
    policies = getattr(settings, "RATE_LIMIT_POLICIES", {})
    config = policies.get(scope)
    if config is None:
        raise ImproperlyConfigured(f"Missing rate-limit policy for scope {scope!r}")
    limit, window = parse_rate(config["rate"])
    return RatePolicy(limit=limit, window_seconds=window, critical=bool(config.get("critical", False)))


def _cache_alias() -> str:
    return getattr(settings, "RATE_LIMIT_CACHE_ALIAS", "default")


def _cache_backend_path() -> str:
    alias = _cache_alias()
    return settings.CACHES.get(alias, {}).get("BACKEND", "")


def _ensure_usable_cache(policy: RatePolicy) -> None:
    backend = _cache_backend_path()
    if policy.critical and settings.RATE_LIMIT_REQUIRE_SHARED_CACHE and (
        "locmem" in backend.lower() or "dummy" in backend.lower() or not backend
    ):
        raise ImproperlyConfigured("Critical rate limiting requires a shared production cache.")


def _safe_identity(value: str) -> str:
    digest = salted_hmac("clinic.rate-limit", value or "unknown", secret=settings.SECRET_KEY).hexdigest()
    return digest[:32]


def normalize_identifier(value: object) -> str:
    if value is None:
        return "<blank>"
    normalized = str(value).strip().casefold()
    return normalized or "<blank>"


def client_ip_identity(request) -> str:
    return f"ip:{get_client_ip(request) or 'unknown'}"


def user_or_ip_identity(request) -> str:
    user = getattr(request, "user", None)
    if getattr(user, "is_authenticated", False):
        return f"user:{user.pk}"
    return client_ip_identity(request)


def _window(now: float, window_seconds: int) -> tuple[int, int]:
    window_start = int(now // window_seconds) * window_seconds
    retry_after = max(1, math.ceil(window_start + window_seconds - now))
    return window_start, retry_after


def _cache_key(scope: str, identity: str, window_start: int) -> str:
    return f"clinic:rl:{scope}:{_safe_identity(identity)}:{window_start}"


def check_fixed_window(scope: str, identity: str, *, consume: bool = True) -> LimitResult:
    policy = policy_for_scope(scope)
    _ensure_usable_cache(policy)
    now = time.time()
    window_start, retry_after = _window(now, policy.window_seconds)
    key = _cache_key(scope, identity, window_start)
    cache = caches[_cache_alias()]

    try:
        if not consume:
            count = int(cache.get(key, 0) or 0)
            return LimitResult(allowed=count < policy.limit, wait=retry_after if count >= policy.limit else None, count=count)
        count = 1 if cache.add(key, 1, retry_after + 1) else int(cache.incr(key))
    except Exception:
        logger.exception("rate_limiter_cache_failure", extra={"scope": scope, "critical": policy.critical})
        if policy.critical:
            return LimitResult(allowed=False, wait=60, count=policy.limit + 1)
        return LimitResult(allowed=True, count=0)

    if count > policy.limit:
        logger.warning("rate_limit_exceeded", extra={"scope": scope, "critical": policy.critical})
        return LimitResult(allowed=False, wait=retry_after, count=count)
    return LimitResult(allowed=True, count=count)


def clear_current_window(scope: str, identity: str) -> None:
    policy = policy_for_scope(scope)
    now = time.time()
    window_start, _ = _window(now, policy.window_seconds)
    caches[_cache_alias()].delete(_cache_key(scope, identity, window_start))


class ScopedRateLimitThrottle(BaseThrottle):
    scope = ""
    identity_key = staticmethod(user_or_ip_identity)

    def __init__(self, *, scope: str | None = None, identity_key=None):
        self.scope = scope or self.scope
        if identity_key is not None:
            self.identity_key = identity_key
        self._wait: int | None = None

    def allow_request(self, request, view) -> bool:
        if not self.scope:
            return True
        result = check_fixed_window(self.scope, self.identity_key(request))
        self._wait = result.wait
        return result.allowed

    def wait(self) -> int | None:
        return self._wait


class AuthenticatedApiThrottle(ScopedRateLimitThrottle):
    scope = "api_general"

    def allow_request(self, request, view) -> bool:
        user = getattr(request, "user", None)
        if not getattr(user, "is_authenticated", False):
            return True
        return super().allow_request(request, view)


class LoginIpThrottle(ScopedRateLimitThrottle):
    scope = "auth_login_ip"
    identity_key = staticmethod(client_ip_identity)


class LoginGlobalThrottle(ScopedRateLimitThrottle):
    scope = "auth_login_global"
    identity_key = staticmethod(lambda request: "global")


class RefreshThrottle(ScopedRateLimitThrottle):
    scope = "auth_refresh"
    identity_key = staticmethod(client_ip_identity)


class CsrfBootstrapThrottle(ScopedRateLimitThrottle):
    scope = "auth_csrf"
    identity_key = staticmethod(client_ip_identity)


class AuthSessionThrottle(ScopedRateLimitThrottle):
    scope = "auth_session"


class AccountFailureLimiter:
    scope = "auth_login_account"

    def __init__(self, identifier: str):
        self.identity = f"account:{normalize_identifier(identifier)}"

    def check(self) -> LimitResult:
        return check_fixed_window(self.scope, self.identity, consume=False)

    def record_failure(self) -> LimitResult:
        result = check_fixed_window(self.scope, self.identity, consume=True)
        if not result.allowed:
            logger.warning("login_account_rate_limit_exceeded", extra={"scope": self.scope})
        return result

    def clear(self) -> None:
        clear_current_window(self.scope, self.identity)


class ActionRateLimitMixin:
    rate_limit_action_scopes: dict[str, str] = {}
    rate_limit_write_scope = "sensitive_write"
    rate_limit_search_scope = "expensive_search"

    def get_rate_limit_scope(self) -> str | None:
        action = getattr(self, "action", None)
        if action in self.rate_limit_action_scopes:
            return self.rate_limit_action_scopes[action]
        method = self.request.method.upper()
        if action == "list" and any(
            key in self.request.query_params for key in ("search", "ordering", "page")
        ):
            return self.rate_limit_search_scope
        if method in {"POST", "PUT", "PATCH", "DELETE"}:
            return self.rate_limit_write_scope
        return None

    def get_throttles(self):
        throttles = super().get_throttles()
        scope = self.get_rate_limit_scope()
        if scope:
            throttles.append(ScopedRateLimitThrottle(scope=scope))
        return throttles


class ScopedAPIViewRateLimitMixin:
    rate_limit_scope: str | None = None

    def get_throttles(self):
        throttles = super().get_throttles()
        if self.rate_limit_scope:
            throttles.append(ScopedRateLimitThrottle(scope=self.rate_limit_scope))
        return throttles

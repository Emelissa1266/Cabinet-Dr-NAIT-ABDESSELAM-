from __future__ import annotations

from django.conf import settings


def _split_header(value: str | None) -> list[str]:
    if not value:
        return []
    return [item.strip() for item in value.split(",") if item.strip()]


def get_client_ip(request) -> str:
    if request is None:
        return ""

    meta = request.META
    remote_addr = meta.get("REMOTE_ADDR", "") or ""
    trusted_proxies = set(getattr(settings, "TRUSTED_PROXY_IPS", []))

    if remote_addr in trusted_proxies:
        forwarded_for = _split_header(meta.get("HTTP_X_FORWARDED_FOR"))
        if forwarded_for:
            return forwarded_for[0]
        real_ip = meta.get("HTTP_X_REAL_IP", "")
        if real_ip:
            return real_ip.strip()

    return remote_addr


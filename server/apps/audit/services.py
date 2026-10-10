from apps.security.ip import get_client_ip as get_trusted_client_ip

from .models import AuditLog


def get_client_ip(request):
    return get_trusted_client_ip(request) or None


def record_audit_event(
    *,
    user,
    action: str,
    entity_type: str,
    entity_id,
    old_data=None,
    new_data=None,
    request=None,
) -> AuditLog:
    return AuditLog.objects.create(
        user=user if getattr(user, "is_authenticated", False) else None,
        role=getattr(user, "role", "") if getattr(user, "is_authenticated", False) else "",
        action=action,
        entity_type=entity_type,
        entity_id=str(entity_id),
        old_data=old_data,
        new_data=new_data,
        ip_address=get_client_ip(request),
    )

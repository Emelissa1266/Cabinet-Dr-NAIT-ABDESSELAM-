from __future__ import annotations

import math

from django.conf import settings
from rest_framework.exceptions import Throttled
from rest_framework.views import exception_handler


def clinic_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is not None and isinstance(exc, Throttled):
        response.data = {"detail": settings.RATE_LIMIT_THROTTLED_MESSAGE}
        wait = getattr(exc, "wait", None)
        if wait:
            response["Retry-After"] = str(max(1, math.ceil(wait)))
    return response


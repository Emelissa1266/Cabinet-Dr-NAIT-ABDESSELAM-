"""Development settings for the Clinic Management API."""

from .base import *

DEBUG = env_bool("DJANGO_DEBUG", True)

EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"

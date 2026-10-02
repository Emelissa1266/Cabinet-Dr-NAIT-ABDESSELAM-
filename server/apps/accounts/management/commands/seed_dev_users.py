import os

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = "Create or update local development users for authenticated E2E testing."

    USERS = (
        {
            "username": "admin.demo",
            "email": "admin.demo@example.test",
            "first_name": "Admin",
            "last_name": "Demo",
            "role": "ADMIN",
            "professional_title": "Administrateur",
            "is_staff": True,
            "is_superuser": True,
        },
        {
            "username": "doctor.demo",
            "email": "doctor.demo@example.test",
            "first_name": "Doctor",
            "last_name": "Demo",
            "role": "DOCTOR",
            "professional_title": "Chirurgien plasticien",
            "is_staff": False,
            "is_superuser": False,
        },
        {
            "username": "nurse.demo",
            "email": "nurse.demo@example.test",
            "first_name": "Nurse",
            "last_name": "Demo",
            "role": "NURSE",
            "professional_title": "Infirmier",
            "is_staff": False,
            "is_superuser": False,
        },
        {
            "username": "secretary.demo",
            "email": "secretary.demo@example.test",
            "first_name": "Secretary",
            "last_name": "Demo",
            "role": "SECRETARY",
            "professional_title": "Secretariat",
            "is_staff": False,
            "is_superuser": False,
        },
    )

    def add_arguments(self, parser):
        parser.add_argument("--password", help="Development password to assign to all seeded users.")

    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError("seed_dev_users is refused when DEBUG is False.")
        engine = settings.DATABASES["default"]["ENGINE"]
        if "sqlite" in engine:
            raise CommandError("seed_dev_users requires the configured PostgreSQL development database.")
        password = options.get("password") or os.getenv("CLINIC_DEV_USER_PASSWORD")
        if not password:
            raise CommandError("Provide --password or CLINIC_DEV_USER_PASSWORD.")
        if len(password) < 12:
            raise CommandError("Development password must be at least 12 characters.")

        User = get_user_model()
        for payload in self.USERS:
            user, created = User.objects.update_or_create(
                username=payload["username"],
                defaults={
                    "email": payload["email"],
                    "first_name": payload["first_name"],
                    "last_name": payload["last_name"],
                    "role": payload["role"],
                    "professional_title": payload["professional_title"],
                    "is_staff": payload["is_staff"],
                    "is_superuser": payload["is_superuser"],
                    "is_active": True,
                },
            )
            user.set_password(password)
            user.save(update_fields=["password", "updated_at"])
            status = "created" if created else "updated"
            self.stdout.write(self.style.SUCCESS(f"{payload['username']} {status}"))

        self.stdout.write("Development users are ready. Password was not printed.")

from django.core.management.base import BaseCommand

from apps.notifications.services import generate_due_reminders


class Command(BaseCommand):
    help = "Generate deterministic in-app operational reminders."

    def handle(self, *args, **options):
        result = generate_due_reminders()
        self.stdout.write(self.style.SUCCESS(f"Generated reminders: {result}"))

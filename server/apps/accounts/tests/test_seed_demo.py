from io import StringIO

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError
from django.db import transaction
from pypdf import PdfReader

from apps.accounts.management.commands.seed_demo import COUNTS, MARKER, Command
from apps.accounts.models import User
from apps.audit.models import AuditLog
from apps.billing.models import Invoice
from apps.care.models import CareSession
from apps.documents.models import Document
from apps.documents.storage import private_media_storage
from apps.medical.models import Consultation
from apps.patients.models import Patient
from apps.payments.models import Payment, Receipt
from apps.surgery.models import Surgery


@pytest.mark.django_db
def test_refuses_non_postgres_target(settings):
    settings.DEBUG = True
    settings.SETTINGS_MODULE = "config.settings.development"
    from django.db import connection
    if connection.vendor != "sqlite":
        pytest.skip("SQLite-specific target guard")
    with pytest.raises(CommandError, match="PostgreSQL clinic_db"):
        call_command("seed_demo", dry_run=True, stdout=StringIO())
    assert not User.objects.exists()


@pytest.mark.django_db
def test_medium_dataset_integrity_api_and_safe_reset(tmp_path, monkeypatch):
    monkeypatch.setattr(private_media_storage, "_location", str(tmp_path))
    private_media_storage.__dict__.pop("location", None)
    existing = User.objects.create_user(username="existing", email="existing@example.test", password="untouched")
    original_password = existing.password
    command = Command(stdout=StringIO())
    command.files = []
    with transaction.atomic():
        objects = command.run_seed(COUNTS, 42, "Fixture-Only-Random-Password!42")
    assert Patient.objects.count() == 150
    assert Consultation.objects.count() == 250
    assert Surgery.objects.count() == 60
    assert CareSession.objects.count() == 180
    from apps.agenda.models import Appointment
    assert Appointment.objects.count() == 300
    assert Invoice.objects.count() == 200
    assert Payment.objects.count() == 150
    assert Receipt.objects.count() == 120
    assert set(Invoice.objects.values_list("status", flat=True)) == set(Invoice.Status.values)
    assert set(Payment.objects.values_list("status", flat=True)) == set(Payment.Status.values)
    assert set(Surgery.objects.values_list("status", flat=True)) == {"PLANNED", "COMPLETED", "CANCELLED"}
    assert Invoice.objects.filter(created_by__role="NURSE").exists()
    assert Document.objects.count() == 15
    for doc in Document.objects.all():
        assert doc.file.storage.exists(doc.file.name)
        assert doc.file.name.startswith("secure/documents/")
        with doc.file.open("rb") as stream:
            assert "DOCUMENT FICTIF" in PdfReader(stream).pages[0].extract_text()
    for payment in Payment.objects.all():
        assert payment.allocated_amount <= payment.amount
        assert payment.payment_number.startswith("PAY-")
    assert Invoice.objects.exclude(status="DRAFT").exclude(invoice_number__startswith="INV-").count() == 0
    assert Receipt.objects.exclude(receipt_number__startswith="REC-").count() == 0
    existing.refresh_from_db()
    assert existing.password == original_password
    from rest_framework.test import APIClient

    from apps.dashboard.services import get_dashboard_for_user
    for role in User.Role.values:
        actor = User.objects.filter(role=role, username__startswith="seed.demo.").first()
        assert get_dashboard_for_user(actor)
        client = APIClient()
        client.force_authenticate(actor)
        assert client.get("/api/v1/patients/").status_code == 200
    client.force_authenticate(User.objects.get(username="seed.demo.admin1"))
    for route in ["consultations", "surgeries", "cares", "appointments", "invoices", "payments", "documents"]:
        response = client.get(f"/api/v1/{route}/")
        assert response.status_code == 200, (route, response.status_code)
    manifest = AuditLog.objects.create(action=MARKER, entity_type="DemoDataset", entity_id="v1",
        new_data={"objects": objects, "files": [], "seed": 42, "scale": "medium"})
    with pytest.raises(CommandError, match="Explicit confirmation"):
        command.reset(manifest, {"dry_run": False, "confirm_reset": None})
    # A newly added external record must prevent deletion, even for SET_NULL links.
    from apps.patients.models import PatientClinicalNote
    note = PatientClinicalNote.objects.create(patient=Patient.objects.first(), note="External record", recorded_by=existing)
    with pytest.raises(CommandError, match="external"):
        command.reset(manifest, {"dry_run": False, "confirm_reset": "DELETE DEMO clinic_db"})
    note.delete()
    command.reset(manifest, {"dry_run": False, "confirm_reset": "DELETE DEMO clinic_db"})
    assert not Patient.objects.exists()
    assert User.objects.count() == 1
    assert User.objects.get().password == original_password
    for field in command.files:
        field.storage.delete(field.name)


@pytest.mark.django_db
def test_existing_reserved_account_collision_is_not_changed():
    actor = User.objects.create_user(username="seed.demo.doctor1", email="original@example.test", role="NURSE", password="original")
    with pytest.raises(CommandError, match="collision"):
        Command().check_users()
    actor.refresh_from_db()
    assert actor.role == "NURSE"
    assert actor.check_password("original")


@pytest.mark.django_db
def test_dry_run_idempotence_and_rollback(tmp_path, monkeypatch):
    from django.db import connection
    monkeypatch.setattr(private_media_storage, "_location", str(tmp_path))
    private_media_storage.__dict__.pop("location", None)
    monkeypatch.setattr(Command, "check_target", lambda self: None)
    monkeypatch.setenv("CLINIC_DEMO_PASSWORD", "Fixture-Only-Random-Password!42")
    def sqlite_test_sql(execute, sql, params, many, context):
        if sql.startswith(("SELECT pg_advisory_xact_lock", "SET CONSTRAINTS")):
            return None
        return execute(sql, params, many, context)
    with connection.execute_wrapper(sqlite_test_sql):
        call_command("seed_demo", dry_run=True, scale="small", stdout=StringIO())
        assert not User.objects.exists()
        assert not list(tmp_path.rglob("*.pdf"))
        original = Command.create_documents
        def fail_after_files(self, *args):
            original(self, *args)
            raise CommandError("Injected rollback")
        monkeypatch.setattr(Command, "create_documents", fail_after_files)
        with pytest.raises(CommandError, match="Injected rollback"):
            call_command("seed_demo", scale="small", stdout=StringIO())
        assert not Patient.objects.exists()
        assert not User.objects.exists()
        assert not list(tmp_path.rglob("*.pdf"))
        monkeypatch.setattr(Command, "create_documents", original)
        call_command("seed_demo", scale="small", stdout=StringIO())
        passwords = dict(User.objects.values_list("pk", "password"))
        counts = (Patient.objects.count(), Invoice.objects.count(), Payment.objects.count(), AuditLog.objects.count())
        monkeypatch.delenv("CLINIC_DEMO_PASSWORD")
        call_command("seed_demo", scale="small", stdout=StringIO())
        assert counts == (Patient.objects.count(), Invoice.objects.count(), Payment.objects.count(), AuditLog.objects.count())
        assert passwords == dict(User.objects.values_list("pk", "password"))
    for doc in Document.objects.all():
        doc.file.storage.delete(doc.file.name)

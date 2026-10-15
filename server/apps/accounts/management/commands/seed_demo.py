"""Non-destructive, transactionally tracked development fixtures."""
import getpass
import os
import random
import sys
from datetime import date, datetime, time, timedelta
from decimal import Decimal

from django.apps import apps
from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError
from django.db import connection, transaction, OperationalError
from django.db.migrations.executor import MigrationExecutor
from django.db.models import Sum
from django.db.models.signals import post_save
from django.utils import timezone

from apps.accounts.models import User
from apps.agenda import services as agenda
from apps.agenda.models import Appointment, AppointmentType, StaffWorkingHours
from apps.audit.models import AuditLog
from apps.billing import services as billing
from apps.billing.models import Invoice
from apps.care import services as care_services
from apps.care.models import (Care, CareCategory, CareType, CareSession, CareObservation,
    ClinicalMeasurement, CareSessionMaterial, CareParameterDefinition, CareSessionParameter)
from apps.medical.models import Consultation, Prescription, PrescriptionItem
from apps.notifications.models import Notification
from apps.patients.models import Patient, PatientAllergy, PatientMedicalHistory, MedicalAlert, PatientClinicalNote
from apps.payments import services as payments
from apps.payments.models import Payment, Receipt
from apps.surgery import services as surgery_services
from apps.surgery.models import (
    Surgery, InterventionType, PreoperativeAssessment, PreoperativeChecklistItem,
    SurgeryPreoperativeChecklist, SurgeryConsent, SurgeryOperativeRecord,
    PostoperativeAssessment, PostoperativeFollowUp,
    SurgeryTeamMember, AnesthesiaRecord, PreoperativeRequirement,
)

MARKER = "SEED_DEMO_V1"
COUNTS = dict(patients=150, consultations=250, surgeries=60, sessions=180, appointments=300, invoices=200, payments=150)
ROLES = (("admin", "ADMIN", 1), ("doctor", "DOCTOR", 2), ("nurse", "NURSE", 3), ("secretary", "SECRETARY", 2))


def create(model, **values):
    obj = model(**values)
    obj.full_clean()
    obj.save()
    return obj


def demo_pdf():
    """Reuse the existing PDF serializer; no optional dependency required."""
    from apps.billing.pdf import _InvoicePdfBuilder, _Page
    builder = _InvoicePdfBuilder.__new__(_InvoicePdfBuilder)
    builder.pages = [_Page(operations=[
        "BT /F1 20 Tf 48 760 Td (DOCUMENT FICTIF \\227 TEST) Tj ET",
        "BT /F1 12 Tf 48 720 Td (Jeu de demonstration - aucune valeur medicale.) Tj ET",
    ])]
    builder.logo = None
    builder.page = builder.pages[0]
    builder.invoice_number = "DEMO - TEST"
    return builder._serialize()


class Command(BaseCommand):
    help = "Seed fictional development data, only in PostgreSQL clinic_db."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true")
        parser.add_argument("--seed", type=int, default=42)
        parser.add_argument("--scale", choices=("small", "medium", "large"), default="medium")
        parser.add_argument("--reset-demo", action="store_true")
        parser.add_argument("--confirm-reset", help="Explicit confirmation: DELETE DEMO clinic_db")

    def check_target(self):
        self.stdout.write(f"Target: {connection.vendor} / {connection.settings_dict['NAME']}; DEBUG={settings.DEBUG}")
        if not settings.DEBUG or settings.SETTINGS_MODULE != "config.settings.development":
            raise CommandError("Only config.settings.development with DEBUG=True is permitted.")
        if connection.vendor != "postgresql" or connection.settings_dict["NAME"] != "clinic_db":
            raise CommandError("Refused: configure PostgreSQL clinic_db in server/.env. No data written.")
        with connection.cursor() as cursor:
            cursor.execute("SELECT current_database(), version()")
            db, version = cursor.fetchone()
            if db != "clinic_db":
                raise CommandError("Actual database is not clinic_db.")
            cursor.execute("SELECT count(*) FROM pg_constraint WHERE connamespace = 'public'::regnamespace AND NOT convalidated")
            if cursor.fetchone()[0]:
                raise CommandError("Unvalidated PostgreSQL constraints detected.")
            cursor.execute("SHOW session_replication_role")
            if cursor.fetchone()[0] != "origin":
                raise CommandError("Database constraints/triggers must be enabled.")
        executor = MigrationExecutor(connection)
        if executor.migration_plan(executor.loader.graph.leaf_nodes()):
            raise CommandError("Pending migrations: apply them before seeding.")
        self.stdout.write(version.split(" on ")[0] + "; migrations applied; constraints enabled.")

    def handle(self, *args, **options):
        try:
            self.check_target()
        except OperationalError:
            raise CommandError("PostgreSQL connection refused: verify credentials, host and port in server/.env. No data written.") from None
        factor = {"small": Decimal("0.2"), "medium": Decimal(1), "large": Decimal(3)}[options["scale"]]
        counts = {k: int(v * factor) for k, v in COUNTS.items()}
        self.stdout.write(f"Plan seed={options['seed']}, scale={options['scale']}: {counts}")
        self.stdout.write("8 reserved users; 8 months history; private fictional PDFs; no existing password changed.")
        self.stdout.write("Surgery POSTPONED is unsupported; future PLANNED cases are used. No clinical photos.")
        self.files = []
        try:
            with transaction.atomic():
                with connection.cursor() as cursor:
                    cursor.execute("SELECT pg_advisory_xact_lock(782401142)")
                manifest = AuditLog.objects.filter(action=MARKER, entity_type="DemoDataset").first()
                self.validate_finances()
                if options["reset_demo"]:
                    if not manifest:
                        self.stdout.write("No tracked demo dataset to reset.")
                        return
                    self.reset(manifest, options)
                    return
                if manifest:
                    self.stdout.write(f"Dataset already exists (seed={manifest.new_data['seed']}, scale={manifest.new_data['scale']}); no duplicates created.")
                    self.print_counts(manifest.new_data["objects"])
                    return
                self.check_users()
                if options["dry_run"]:
                    self.stdout.write("Dry run: plan only; no SQL writes, files or financial sequence increments.")
                    return
                password = os.getenv("CLINIC_DEMO_PASSWORD")
                if not password:
                    if not sys.stdin.isatty():
                        raise CommandError("Set CLINIC_DEMO_PASSWORD in server/.env (never logged).")
                    password = getpass.getpass("Demo password (hidden): ")
                if len(password) < 12:
                    raise CommandError("CLINIC_DEMO_PASSWORD must contain at least 12 characters.")
                validate_password(password)
                objects = self.run_seed(counts, options["seed"], password)
                with connection.cursor() as cursor:
                    cursor.execute("SET CONSTRAINTS ALL IMMEDIATE")
                AuditLog.objects.create(action=MARKER, entity_type="DemoDataset", entity_id="v1", new_data={
                    "seed": options["seed"], "scale": options["scale"], "objects": objects,
                    "files": [f.name for f in self.files],
                })
                self.print_counts(objects)
        except Exception:
            for field in self.files:
                field.storage.delete(field.name)
            raise
        self.stdout.write(self.style.SUCCESS("Demo dataset committed; integrity checks passed."))

    def run_seed(self, counts, seed, password):
        objects = {}
        def remember(sender, instance, created, using, **kwargs):
            if created and using == connection.alias and sender._meta.app_label in {
                "accounts", "patients", "medical", "care", "surgery", "agenda",
                "billing", "payments", "documents", "notifications", "audit",
            } and sender._meta.model_name != "financialsequence":
                objects.setdefault(sender._meta.label, []).append(instance.pk)
        post_save.connect(remember, weak=False)
        try:
            self.generate(counts, random.Random(seed), password)
            self.validate_finances()
            connection.check_constraints()
        finally:
            post_save.disconnect(remember)
        return objects

    def check_users(self):
        for prefix, role, count in ROLES:
            for i in range(1, count + 1):
                username = f"seed.demo.{prefix}{i}"
                user = User.objects.filter(username=username).first()
                if user and (user.role != role or not user.is_active or user.email != f"{username}@example.test"
                             or (role != "ADMIN" and (user.is_superuser or user.is_staff))):
                    raise CommandError(f"Reserved account collision: {username}; existing account untouched.")
                if not user and User.objects.filter(email=f"{username}@example.test").exists():
                    raise CommandError(f"Reserved email collision: {username}; existing account untouched.")

    def print_counts(self, objects):
        for label, ids in sorted(objects.items()):
            self.stdout.write(f"{label}: {apps.get_model(label).objects.filter(pk__in=ids).count()}")

    def validate_finances(self):
        for invoice in Invoice.objects.all():
            reserved = invoice.allocations.exclude(payment__status="CANCELLED").aggregate(total=Sum("amount"))["total"] or Decimal(0)
            if reserved > invoice.total or invoice.paid_amount > invoice.total:
                raise CommandError(f"Financial integrity: overallocated invoice {invoice.pk}.")
            if reserved and invoice.status in {"DRAFT", "CANCELLED"}:
                raise CommandError(f"Financial integrity: allocations on {invoice.status} invoice {invoice.pk}.")
            if invoice.status not in {"DRAFT", "CANCELLED"}:
                expected = "PAID" if invoice.paid_amount >= invoice.total else "PARTIALLY_PAID" if invoice.paid_amount else "ISSUED"
                if invoice.status != expected:
                    raise CommandError(f"Financial integrity: invoice status {invoice.pk}.")
        for payment in Payment.objects.all():
            if payment.allocated_amount > payment.amount:
                raise CommandError(f"Financial integrity: overallocated payment {payment.pk}.")
            for allocation in payment.allocations.select_related("invoice"):
                if allocation.invoice.patient_id != payment.patient_id or allocation.invoice.currency != payment.currency:
                    raise CommandError(f"Financial integrity: allocation {allocation.pk}.")
        for receipt in Receipt.objects.select_related("payment"):
            # Existing service retains receipts when completed payments are cancelled.
            if receipt.patient_id != receipt.payment.patient_id or receipt.payment.status == "PENDING":
                raise CommandError(f"Financial integrity: receipt {receipt.pk}.")

    def reset(self, manifest, options):
        objects = manifest.new_data["objects"]
        self.print_counts(objects)
        # Include SET_NULL/PROTECT references: never silently alter external records.
        for model in apps.get_models():
            for field in model._meta.fields:
                if not field.is_relation or not field.remote_field:
                    continue
                target = field.remote_field.model._meta.label
                if target in objects:
                    refs = model.objects.filter(**{f"{field.name}_id__in": objects[target]}).exclude(pk__in=objects.get(model._meta.label, []))
                    if refs.exists():
                        raise CommandError(f"Reset refused: external {model._meta.label}.{field.name} references demo data.")
        if options["dry_run"]:
            self.stdout.write("Dry run reset: no deletion.")
            return
        if options["confirm_reset"] != "DELETE DEMO clinic_db":
            raise CommandError('Explicit confirmation required: --confirm-reset "DELETE DEMO clinic_db"')
        # Defer protected parents until their tracked children have been deleted.
        from django.db.models.deletion import ProtectedError
        pending = dict(objects)
        while pending:
            progress = False
            for label, ids in list(pending.items()):
                try:
                    with transaction.atomic():
                        apps.get_model(label).objects.filter(pk__in=ids).delete()
                except ProtectedError:
                    continue
                del pending[label]
                progress = True
            if not progress:
                raise CommandError("Reset refused: protected dependencies remain; all deletions rolled back.")
        from apps.documents.storage import private_media_storage
        for name in manifest.new_data.get("files", []):
            transaction.on_commit(lambda name=name: private_media_storage.delete(name))
        manifest.delete()
        self.stdout.write("Tracked demo rows deleted; shared financial sequences preserved.")

    def generate(self, n, rng, password):
        users = {}
        for prefix, role, count in ROLES:
            users[role] = []
            for i in range(1, count + 1):
                username = f"seed.demo.{prefix}{i}"
                user = User.objects.filter(username=username).first()
                if user is None:
                    user = User.objects.create_user(username=username, email=f"{username}@example.test", password=password,
                        first_name={"ADMIN": "Amine", "DOCTOR": "Samir", "NURSE": "Lina", "SECRETARY": "Yasmine"}[role],
                        last_name=f"Demo {i}", role=role, is_staff=role == "ADMIN", is_superuser=role == "ADMIN",
                        profile_notes="DONNEES FICTIVES - TEST")
                users[role].append(user)
                self.stdout.write(f"Demo account: {username} ({role}); password not displayed.")
        admin = users["ADMIN"][0]
        doctors, nurses = users["DOCTOR"], users["NURSE"]
        today = timezone.localdate()
        origin = today - timedelta(days=240)
        def stamp(day, hour=10):
            return timezone.make_aware(datetime.combine(day, time(hour)))
        def past():
            return origin + timedelta(days=rng.randrange(210))
        patients = []
        for i in range(n["patients"]):
            gender = rng.choice(["FEMALE", "MALE"])
            p = create(Patient, first_name=rng.choice(["Lina", "Amel", "Yasmine"] if gender == "FEMALE" else ["Samir", "Karim", "Nadir"]),
                last_name=f"Demo-{rng.choice(['Azzul', 'Tiziri', 'Numid', 'Ziri'])}-{i+1:04d}",
                date_of_birth=date(today.year-rng.randint(20, 68), rng.randint(1,12), rng.randint(1,28)),
                gender=gender, phone=f"TEST-{i+1:06d}",
                email=f"patient-{i+1}@example.test", address=f"Lot fictif {i+1}, quartier de demonstration",
                city=rng.choice(["Alger", "Tizi Ouzou", "Oran", "Bejaia", "Constantine"]),
                notes="PATIENT FICTIF - TEST", created_by=admin)
            p.created_at = stamp(origin + timedelta(days=rng.randrange(210)))
            Patient.objects.filter(pk=p.pk).update(created_at=p.created_at)
            create(PatientMedicalHistory, patient=p, title="DEMO - Bilan initial", description="Antecedents synthetiques sans particularite.", recorded_by=doctors[i%2])
            if i % 7 == 0:
                create(PatientAllergy, patient=p, title="DEMO - Allergie au latex", severity="Moderee", description="Scenario fictif de precautions de contact.", recorded_by=doctors[i%2])
                create(MedicalAlert, patient=p, category="ALLERGY", severity="WARNING", title="DEMO - Precaution latex", description="Alerte fictive de demonstration", created_by=doctors[i%2])
            create(PatientClinicalNote, patient=p, recorded_by=doctors[i%2], note="DEMO - Dossier synthetique de chirurgie plastique.")
            patients.append(p)
        consultations = []
        for i in range(n["consultations"]):
            patient = patients[i%len(patients)]
            visit_day = patient.created_at.date() + timedelta(days=rng.randrange(max(1, (today-timedelta(days=30)-patient.created_at.date()).days)))
            c = create(Consultation, patient=patient, doctor=doctors[i%2], consultation_date=stamp(visit_day),
                consultation_type=rng.choice(Consultation.ConsultationType.values), reason=rng.choice(["Evaluation esthetique", "Controle cicatriciel", "Consultation initiale", "Evaluation preoperatoire"]),
                clinical_findings="DEMO - Examen local sans signe inflammatoire.", diagnosis="DEMO - Evaluation morphologique fictive.",
                treatment_plan="DEMO - Surveillance et reevaluation clinique.", notes="DONNEES FICTIVES - TEST", status="COMPLETED" if i%10 else "DRAFT")
            consultations.append(c)
            if i%3 == 0:
                rx = create(Prescription, patient=c.patient, doctor=c.doctor, consultation=c, prescribed_at=c.consultation_date,
                    general_instructions="DEMO - Prescription fictive, ne pas utiliser pour un traitement.")
                create(PrescriptionItem, prescription=rx, medication_name="DEMO - Solution saline", dosage="Application locale", frequency="Lors du soin", duration="Scenario de 3 jours", instructions="TEST UNIQUEMENT")
        types = list(InterventionType.objects.filter(is_active=True).order_by("pk"))
        if not types:
            self.stdout.write("No intervention catalogue configured: creating reserved demo types.")
            types = [create(InterventionType, code=f"seed-demo-{i}", name=f"DEMO - {name}") for i,name in enumerate(["Revision cicatricielle", "Blepharoplastie", "Rhinoplastie"])]
        surgeries = []
        for i in range(n["surgeries"]):
            c = consultations[i%len(consultations)]
            day = c.consultation_date.date() + timedelta(days=7)
            if i%5 == 0:
                day = today + timedelta(days=1+i%28)
            kind = types[i%len(types)]
            s = create(Surgery, patient=c.patient, surgeon=c.doctor, consultation=c, intervention_type=kind,
                procedure_name=kind.name, indication="DEMO - Indication fictive apres evaluation.", planned_date=stamp(day), notes="INTERVENTION FICTIVE - TEST", anesthesia_type="LOCAL")
            s = surgery_services.plan_surgery(surgery=s, actor=c.doctor)
            create(SurgeryTeamMember, surgery=s, user=c.doctor, role="SURGEON", notes="DEMO - Equipe fictive")
            create(SurgeryTeamMember, surgery=s, user=nurses[i%3], role="NURSE", notes="DEMO - Equipe fictive")
            if i%5 == 1:
                s = surgery_services.cancel_surgery(surgery=s, actor=c.doctor, reason="DEMO - Indisponibilite fictive")
            elif i%5 != 0:
                s = surgery_services.begin_preop(surgery=s, actor=c.doctor)
                create(PreoperativeAssessment, surgery=s, assessed_by=c.doctor, assessment_date=stamp(day)-timedelta(days=1),
                    readiness_status="READY", medical_history_reviewed=True, allergies_reviewed=True, medications_reviewed=True,
                    contraindications_reviewed=True, required_tests_reviewed=True, fasting_status="NOT_REQUIRED", anesthesia_evaluation_status="CLEARED", assessment_notes="DEMO - Evaluation fictive")
                for item in PreoperativeChecklistItem.objects.filter(is_active=True, is_required=True):
                    create(SurgeryPreoperativeChecklist, surgery=s, checklist_item=item, status="COMPLETED", checked_by=c.doctor, checked_at=stamp(day)-timedelta(hours=1), notes="DEMO - Verification simulee")
                create(SurgeryConsent, surgery=s, consent_type="DEMO - Consentement eclaire", status="CONFIRMED", confirmed_by=c.doctor, confirmed_at=stamp(day)-timedelta(days=1), notes="FICTIF - Aucune signature reelle")
                create(PreoperativeRequirement, surgery=s, name="DEMO - Evaluation clinique", status="SATISFIED", reviewed_by=c.doctor, reviewed_at=stamp(day)-timedelta(days=1), result_summary="DEMO - Exigence fictive satisfaite")
                s = surgery_services.mark_ready(surgery=s, actor=c.doctor)
                s = surgery_services.start_surgery(surgery=s, actor=c.doctor)
                s.actual_start_at = stamp(day)
                s.save(update_fields=["actual_start_at"])
                create(SurgeryOperativeRecord, surgery=s, surgeon=c.doctor, procedure_performed=kind.name,
                    operative_findings="DEMO - Constatations fictives sans particularite", operative_technique="DEMO - Technique simulee",
                    actual_start_at=stamp(day), actual_end_at=stamp(day)+timedelta(hours=1), immediate_postoperative_condition="DEMO - Etat stable")
                s = surgery_services.complete_surgery(surgery=s, actor=c.doctor)
                create(AnesthesiaRecord, surgery=s, anesthesia_type="LOCAL", provider_name="DEMO - Praticien fictif", pre_anesthesia_notes="DEMO - Evaluation simulee", intraoperative_notes="DEMO - Surveillance simulee")
                create(PostoperativeAssessment, surgery=s, assessed_by=c.doctor, assessed_at=s.actual_end_at, general_condition="DEMO - Etat stable", pain_score=2, wound_status="DEMO - Pansement propre")
                create(PostoperativeFollowUp, surgery=s, patient=s.patient, doctor=c.doctor, follow_up_date=stamp(day+timedelta(days=7)), recovery_status="DEMO - Evolution favorable", pain_score=1)
            surgeries.append(s)
        category = create(CareCategory, name="DEMO - Soins locaux", description="DONNEES FICTIVES - TEST")
        care_types = [create(CareType, category=category, name=f"DEMO - {name}", default_price=Decimal(price)) for name,price in [("Pansement", "2000"), ("Retrait de fils", "1500"), ("Controle cicatriciel", "1000")]]
        parameters = {ct.pk: create(CareParameterDefinition, care_type=ct, key="demo-wound", label="DEMO - Aspect local", required=True) for ct in care_types}
        sessions = []
        for i in range(n["sessions"]):
            nurse = nurses[i%3]
            patient = patients[i%len(patients)]
            day = max(past(), patient.created_at.date()) if i%6 else today + timedelta(days=1+i%21)
            ct = care_types[i%3]
            care = create(Care, patient=patients[i%len(patients)], care_type=ct, prescribed_by=nurse, assigned_nurse=nurse,
                start_date=day, planned_sessions=1, price_per_session=ct.default_price, notes="DEMO - Soin autonome infirmier")
            session = create(CareSession, care=care, nurse=nurse, scheduled_at=stamp(day,14), notes="DEMO - Seance fictive")
            if i%6:
                session = care_services.start_care_session(session=session, nurse=nurse)
                create(CareObservation, care_session=session, nurse=nurse, observation="DEMO - Cicatrisation favorable, absence de signe inflammatoire.")
                create(CareSessionParameter, care_session=session, parameter_definition=parameters[ct.pk], value="DEMO - Propre", recorded_by=nurse)
                create(ClinicalMeasurement, care_session=session, recorded_by=nurse, measurement_type="TEMPERATURE", value="36.8", unit="C", recorded_at=stamp(day,14), notes="DEMO - Mesure fictive")
                create(CareSessionMaterial, care_session=session, recorded_by=nurse, name="DEMO - Compresses steriles", quantity=Decimal(2), unit="unite", notes="Consommation fictive")
                session = care_services.complete_care_session(session=session, nurse=nurse)
                CareSession.objects.filter(pk=session.pk).update(started_at=stamp(day,14), completed_at=stamp(day,14)+timedelta(minutes=20))
            sessions.append(session)
        appointment_type = create(AppointmentType, code="seed-demo-consultation", name="DEMO - Consultation", default_duration_minutes=30, category="CONSULTATION", requires_doctor=True)
        nursing_type = create(AppointmentType, code="seed-demo-care", name="DEMO - Soin infirmier", default_duration_minutes=30, category="NURSING_CARE", requires_nurse=True)
        for staff in doctors+nurses:
            if not StaffWorkingHours.objects.filter(staff=staff).exists():
                for weekday in [0,1,2,3,5,6]:
                    create(StaffWorkingHours, staff=staff, weekday=weekday, start_time=time(8), end_time=time(17))
        for i in range(n["appointments"]):
            future = i%5 == 0
            staff = (nurses if i%3 == 0 else doctors)[i % (3 if i%3 == 0 else 2)]
            typ = nursing_type if staff.role == "NURSE" else appointment_type
            day = today+timedelta(days=1+i%28) if future else max(past(), patients[i%len(patients)].created_at.date())
            slot = stamp(day,8)+timedelta(minutes=30*(i%16))
            for attempt in range(2000):
                try:
                    with transaction.atomic():
                        a = agenda.create_appointment(actor=users["SECRETARY"][i%2], patient=patients[i%len(patients)], appointment_type=typ,
                            primary_staff=staff, start_at=slot, reason="DEMO - Activite du cabinet", notes="RENDEZ-VOUS FICTIF - TEST")
                    break
                except ValidationError:
                    slot += timedelta(minutes=30)
                    if timezone.localtime(slot).hour >= 17:
                        slot = stamp(timezone.localtime(slot).date()+timedelta(days=1),8)
            else:
                raise CommandError("No available appointment slot; seeding rolled back.")
            if not future and slot >= timezone.now():
                raise CommandError("Historical appointment moved into future; seeding rolled back.")
            if future:
                if i%2:
                    agenda.confirm_appointment(appointment=a, actor=staff)
            elif i%7 == 1:
                agenda.cancel_appointment(appointment=a, actor=staff, reason="DEMO - Annulation fictive")
                Appointment.objects.filter(pk=a.pk).update(cancelled_at=slot-timedelta(days=1))
            elif i%7 == 2:
                agenda.no_show_appointment(appointment=a, actor=staff)
                Appointment.objects.filter(pk=a.pk).update(no_show_at=slot)
            else:
                a = agenda.confirm_appointment(appointment=a, actor=staff)
                a = agenda.check_in_appointment(appointment=a, actor=staff)
                a = agenda.start_appointment(appointment=a, actor=staff)
                agenda.complete_appointment(appointment=a, actor=staff)
                Appointment.objects.filter(pk=a.pk).update(checked_in_at=slot, completed_at=slot+timedelta(minutes=30))
            if future:
                create(Notification, recipient=staff, notification_type="APPOINTMENT", title="DEMO - Rendez-vous a venir", message="Evenement fictif pour les tests", patient=a.patient, appointment=a, deduplication_key=f"seed-demo-appointment-{a.pk}")
        invoices = []
        # Distinct clinical sources, including invoices owned independently by nurses.
        sources = [("consultation", c, c.patient, c.doctor, c.consultation_date.date(), Decimal("5000")) for c in consultations[:n['invoices']//2]]
        sources += [("care", s.care, s.care.patient, s.nurse, s.care.start_date, s.care.price_per_session) for s in sessions if s.status == "COMPLETED"][:n['invoices']//4]
        sources += [("surgery", s, s.patient, s.surgeon, s.planned_date.date(), Decimal("120000")) for s in surgeries if s.status == "COMPLETED"]
        used = {obj.pk for key,obj,*_ in sources if key == "consultation"}
        sources += [("consultation", c, c.patient, c.doctor, c.consultation_date.date(), Decimal("5000")) for c in consultations if c.pk not in used]
        for i, (key,obj,p,actor,day,price) in enumerate(sources[:n["invoices"]]):
            inv = billing.create_invoice(actor=actor, patient=p, issue_date=day, due_date=day+timedelta(days=30), currency="DZD", notes="FACTURE FICTIVE - TEST")
            billing.create_invoice_item(actor=actor, invoice=inv, **{key: obj}, description=f"DEMO - {key}", unit_price=price)
            if i < n["payments"] or i%4:
                inv = billing.issue_invoice(invoice=inv, actor=actor)
                Invoice.objects.filter(pk=inv.pk).update(finalized_at=stamp(day))
            if i >= n["payments"] and i%4 == 1:
                inv = billing.cancel_invoice(invoice=inv, actor=actor, reason="DEMO - Annulation fictive")
                Invoice.objects.filter(pk=inv.pk).update(cancelled_at=stamp(day))
            invoices.append((inv, actor))
        for i, (inv, actor) in enumerate(invoices[:n["payments"]]):
            amount = inv.total if i%4 == 0 else (inv.total/2).quantize(Decimal("0.01"))
            payment = payments.create_payment(actor=actor, patient=inv.patient, amount=amount, currency="DZD",
                payment_method=Payment.Method.values[i%len(Payment.Method.values)], paid_at=stamp(inv.issue_date), notes="PAIEMENT FICTIF - TEST")
            # One payment per invoice, so pending reservations can never overlap.
            reserved = inv.allocations.exclude(payment__status="CANCELLED").aggregate(total=Sum("amount"))["total"] or Decimal(0)
            if amount > inv.total-reserved:
                raise CommandError("Pending payment reservation would overallocate invoice.")
            payments.allocate_payment(payment=payment, invoice=inv, amount=amount, actor=actor)
            if i%10 == 8:
                payments.cancel_payment(payment=payment, actor=actor, reason="DEMO - Paiement annule")
                Payment.objects.filter(pk=payment.pk).update(cancelled_at=stamp(inv.issue_date))
            elif i%10 != 9:
                payments.complete_payment(payment=payment, actor=actor)
                Receipt.objects.filter(payment=payment).update(issued_at=stamp(inv.issue_date))
        self.create_documents(patients, admin)

    def create_documents(self, patients, actor):
        # Reuse the project's existing dependency-free PDF writer.
        from apps.documents.models import DocumentCategory
        from apps.documents.services import upload_document
        from django.core.files.uploadedfile import SimpleUploadedFile
        category = create(DocumentCategory, code="seed-demo-document", name="DEMO - Documents fictifs", system_type="CLINICAL")
        for p in patients[:max(1, len(patients)//10)]:
            content = demo_pdf()
            doc = upload_document(actor=actor, uploaded_file=SimpleUploadedFile("document-fictif-test.pdf", content, content_type="application/pdf"),
                patient=p, category=category, title="DOCUMENT FICTIF - TEST", description="Document synthetique sans donnees reelles.")
            self.files.append(doc.file)
            doc.full_clean()
            if not doc.file.storage.exists(doc.file.name):
                raise CommandError("Missing private demo file.")

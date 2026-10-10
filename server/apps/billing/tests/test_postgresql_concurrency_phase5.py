from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
from threading import Barrier

import pytest
from django.core.exceptions import ValidationError
from django.db import close_old_connections, connection, connections
from django.utils import timezone

from apps.accounts.models import User
from apps.billing.models import Invoice, InvoiceItem
from apps.billing.services import invoice_allocatable_amount, issue_invoice
from apps.patients.models import Patient
from apps.payments.models import Payment, PaymentAllocation, Receipt
from apps.payments.services import allocate_payment, create_payment, create_receipt


def assert_postgresql_database():
    assert connection.vendor == "postgresql"


def run_concurrently(values, worker):
    barrier = Barrier(len(values))

    def wrapped(value):
        close_old_connections()
        try:
            barrier.wait(timeout=10)
            return worker(value)
        finally:
            connections.close_all()

    with ThreadPoolExecutor(max_workers=len(values)) as executor:
        futures = [executor.submit(wrapped, value) for value in values]
        return [future.result(timeout=20) for future in futures]


def create_patient_and_actor():
    actor = User.objects.create_user(
        username="phase5-secretary",
        email="phase5-secretary@example.com",
        password="safe-test-password",
        role=User.Role.SECRETARY,
    )
    patient = Patient.objects.create(first_name="Phase5", last_name="Concurrency", created_by=actor)
    return patient, actor


def create_issued_invoice(*, patient, actor, amount: Decimal) -> Invoice:
    invoice = Invoice.objects.create(patient=patient, created_by=actor)
    InvoiceItem.objects.create(
        invoice=invoice,
        description="PostgreSQL concurrency validation",
        quantity=Decimal("1.00"),
        unit_price=amount,
        discount_amount=Decimal("0.00"),
    )
    return issue_invoice(invoice=invoice, actor=actor)


@pytest.mark.django_db(transaction=True)
def test_postgresql_concurrent_invoice_issue_generates_unique_invoice_numbers():
    assert_postgresql_database()
    patient, actor = create_patient_and_actor()
    invoice_ids = []
    for index in range(8):
        invoice = Invoice.objects.create(patient=patient, created_by=actor)
        InvoiceItem.objects.create(
            invoice=invoice,
            description=f"Concurrent invoice {index}",
            quantity=Decimal("1.00"),
            unit_price=Decimal("1000.00"),
            discount_amount=Decimal("0.00"),
        )
        invoice_ids.append(invoice.pk)

    def worker(invoice_id):
        thread_actor = User.objects.get(pk=actor.pk)
        invoice = Invoice.objects.get(pk=invoice_id)
        return issue_invoice(invoice=invoice, actor=thread_actor).invoice_number

    numbers = run_concurrently(invoice_ids, worker)

    assert len(numbers) == len(set(numbers)) == len(invoice_ids)
    assert all(number.startswith(f"INV-{timezone.localdate().year}-") for number in numbers)
    assert Invoice.objects.filter(status=Invoice.Status.ISSUED, invoice_number__in=numbers).count() == len(invoice_ids)


@pytest.mark.django_db(transaction=True)
def test_postgresql_concurrent_payment_creation_generates_unique_payment_numbers():
    assert_postgresql_database()
    patient, actor = create_patient_and_actor()

    def worker(index):
        thread_actor = User.objects.get(pk=actor.pk)
        thread_patient = Patient.objects.get(pk=patient.pk)
        payment = create_payment(
            actor=thread_actor,
            patient=thread_patient,
            amount=Decimal("1500.00") + Decimal(index),
            payment_method=Payment.Method.CASH,
        )
        return payment.payment_number

    numbers = run_concurrently(list(range(10)), worker)

    assert len(numbers) == len(set(numbers)) == 10
    assert all(number.startswith(f"PAY-{timezone.localdate().year}-") for number in numbers)
    assert Payment.objects.filter(payment_number__in=numbers).count() == 10


@pytest.mark.django_db(transaction=True)
def test_postgresql_concurrent_receipt_creation_generates_unique_receipt_numbers():
    assert_postgresql_database()
    patient, actor = create_patient_and_actor()
    payment_ids = [
        Payment.objects.create(
            patient=patient,
            amount=Decimal("1000.00"),
            payment_method=Payment.Method.CASH,
            status=Payment.Status.COMPLETED,
            received_by=actor,
            payment_number=f"PAY-MANUAL-{index}",
        ).pk
        for index in range(8)
    ]

    def worker(payment_id):
        thread_actor = User.objects.get(pk=actor.pk)
        payment = Payment.objects.get(pk=payment_id)
        return create_receipt(payment=payment, actor=thread_actor).receipt_number

    numbers = run_concurrently(payment_ids, worker)

    assert len(numbers) == len(set(numbers)) == len(payment_ids)
    assert all(number.startswith(f"REC-{timezone.localdate().year}-") for number in numbers)
    assert Receipt.objects.filter(receipt_number__in=numbers).count() == len(payment_ids)


@pytest.mark.django_db(transaction=True)
def test_postgresql_concurrent_receipt_creation_for_same_payment_is_idempotent():
    assert_postgresql_database()
    patient, actor = create_patient_and_actor()
    payment = Payment.objects.create(
        patient=patient,
        amount=Decimal("1000.00"),
        payment_method=Payment.Method.CASH,
        status=Payment.Status.COMPLETED,
        received_by=actor,
        payment_number="PAY-SAME-RECEIPT",
    )

    def worker(_index):
        thread_actor = User.objects.get(pk=actor.pk)
        thread_payment = Payment.objects.get(pk=payment.pk)
        return create_receipt(payment=thread_payment, actor=thread_actor).pk

    receipt_ids = run_concurrently(list(range(6)), worker)

    assert len(set(receipt_ids)) == 1
    assert Receipt.objects.filter(payment=payment).count() == 1


@pytest.mark.django_db(transaction=True)
def test_postgresql_concurrent_payment_allocations_cannot_over_reserve_invoice_balance():
    assert_postgresql_database()
    patient, actor = create_patient_and_actor()
    invoice = create_issued_invoice(patient=patient, actor=actor, amount=Decimal("20000.00"))
    payment_ids = [
        Payment.objects.create(
            patient=patient,
            amount=Decimal("15000.00"),
            payment_method=Payment.Method.CASH,
            received_by=actor,
            payment_number=f"PAY-ALLOC-{index}",
        ).pk
        for index in range(2)
    ]

    def worker(payment_id):
        thread_actor = User.objects.get(pk=actor.pk)
        payment = Payment.objects.get(pk=payment_id)
        thread_invoice = Invoice.objects.get(pk=invoice.pk)
        try:
            allocation = allocate_payment(
                payment=payment,
                invoice=thread_invoice,
                amount=Decimal("15000.00"),
                actor=thread_actor,
            )
        except ValidationError:
            return "rejected"
        return f"allocated:{allocation.pk}"

    results = run_concurrently(payment_ids, worker)

    assert sum(result.startswith("allocated:") for result in results) == 1
    assert results.count("rejected") == 1
    assert PaymentAllocation.objects.filter(invoice=invoice).count() == 1
    assert PaymentAllocation.objects.filter(invoice=invoice).first().amount == Decimal("15000.00")
    assert invoice_allocatable_amount(Invoice.objects.get(pk=invoice.pk)) == Decimal("5000.00")

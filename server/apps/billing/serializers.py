from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from .models import BillableService, Invoice, InvoiceItem
from .services import (
    create_invoice,
    create_invoice_item,
    update_invoice_discount,
    update_invoice_item,
)


def raise_drf_validation(error):
    if hasattr(error, "message_dict"):
        raise serializers.ValidationError(error.message_dict) from error
    raise serializers.ValidationError(error.messages) from error


class BillableServiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = BillableService
        fields = "__all__"
        read_only_fields = ("id", "created_at", "updated_at")


class InvoiceItemSerializer(serializers.ModelSerializer):
    description = serializers.CharField(required=False)
    quantity = serializers.DecimalField(max_digits=10, decimal_places=2, required=False)
    unit_price = serializers.DecimalField(max_digits=12, decimal_places=2, required=False)
    discount_amount = serializers.DecimalField(max_digits=12, decimal_places=2, required=False)
    gross_amount = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    net_amount = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    billable_service_name = serializers.CharField(source="billable_service.name", read_only=True)

    class Meta:
        model = InvoiceItem
        fields = (
            "id",
            "invoice",
            "billable_service",
            "billable_service_name",
            "description",
            "quantity",
            "unit_price",
            "discount_amount",
            "gross_amount",
            "net_amount",
            "consultation",
            "surgery",
            "care",
            "care_session",
            "appointment",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "gross_amount", "net_amount", "created_at", "updated_at")

    def create(self, validated_data):
        try:
            return create_invoice_item(
                actor=self.context["request"].user,
                request=self.context.get("request"),
                **validated_data,
            )
        except DjangoValidationError as error:
            raise_drf_validation(error)

    def update(self, instance, validated_data):
        try:
            return update_invoice_item(
                item=instance,
                actor=self.context["request"].user,
                request=self.context.get("request"),
                **validated_data,
            )
        except DjangoValidationError as error:
            raise_drf_validation(error)


class InvoiceSerializer(serializers.ModelSerializer):
    items = InvoiceItemSerializer(many=True, read_only=True)
    patient_reference = serializers.CharField(source="patient.patient_reference", read_only=True)
    patient_name = serializers.SerializerMethodField()
    subtotal = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    discount_total = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    total = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    paid_amount = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    remaining_amount = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    is_overdue = serializers.BooleanField(read_only=True)

    class Meta:
        model = Invoice
        fields = (
            "id",
            "invoice_number",
            "patient",
            "patient_reference",
            "patient_name",
            "status",
            "currency",
            "issue_date",
            "due_date",
            "discount_amount",
            "notes",
            "internal_notes",
            "created_by",
            "finalized_by",
            "finalized_at",
            "cancelled_by",
            "cancelled_at",
            "cancellation_reason",
            "subtotal",
            "discount_total",
            "total",
            "paid_amount",
            "remaining_amount",
            "is_overdue",
            "items",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "invoice_number",
            "status",
            "created_by",
            "finalized_by",
            "finalized_at",
            "cancelled_by",
            "cancelled_at",
            "cancellation_reason",
            "subtotal",
            "discount_total",
            "total",
            "paid_amount",
            "remaining_amount",
            "is_overdue",
            "created_at",
            "updated_at",
        )

    def get_patient_name(self, obj) -> str:
        return f"{obj.patient.first_name} {obj.patient.last_name}".strip()

    def create(self, validated_data):
        try:
            return create_invoice(
                actor=self.context["request"].user,
                request=self.context.get("request"),
                **validated_data,
            )
        except DjangoValidationError as error:
            raise_drf_validation(error)

    def update(self, instance, validated_data):
        if instance.status != Invoice.Status.DRAFT:
            raise serializers.ValidationError("Only draft invoices can be edited.")
        if "discount_amount" in validated_data:
            discount = validated_data.pop("discount_amount")
            instance = update_invoice_discount(
                invoice=instance,
                discount_amount=discount,
                actor=self.context["request"].user,
                request=self.context.get("request"),
            )
        for field, value in validated_data.items():
            setattr(instance, field, value)
        try:
            instance.full_clean()
        except DjangoValidationError as error:
            raise_drf_validation(error)
        instance.save()
        return instance


class CancelInvoiceSerializer(serializers.Serializer):
    reason = serializers.CharField()


class PatientFinancialSummarySerializer(serializers.Serializer):
    patient = serializers.IntegerField()
    total_invoiced = serializers.DecimalField(max_digits=12, decimal_places=2)
    total_paid = serializers.DecimalField(max_digits=12, decimal_places=2)
    total_remaining = serializers.DecimalField(max_digits=12, decimal_places=2)
    unpaid_invoices_count = serializers.IntegerField()
    partially_paid_invoices_count = serializers.IntegerField()

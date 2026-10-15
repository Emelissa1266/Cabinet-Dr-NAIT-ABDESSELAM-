from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from apps.accounts.models import User

from .models import BillableService, Invoice, InvoiceItem
from .services import (
    create_invoice_item,
    save_invoice_form,
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

    def validate(self, attrs):
        request = self.context["request"]
        user = request.user
        invoice = attrs.get("invoice") or getattr(self.instance, "invoice", None)
        care = attrs.get("care") or getattr(self.instance, "care", None)
        care_session = attrs.get("care_session") or getattr(self.instance, "care_session", None)
        if user.role == User.Role.NURSE:
            if not invoice or invoice.created_by_id != user.id:
                raise serializers.ValidationError("Only invoices created by this nurse can be modified.")
            if care and care.assigned_nurse_id != user.id:
                raise serializers.ValidationError("This care is outside the nurse workspace.")
            if care_session and care_session.nurse_id != user.id:
                raise serializers.ValidationError("This care session is outside the nurse workspace.")
        return attrs

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


class InvoiceFormLineSerializer(InvoiceItemSerializer):
    id = serializers.IntegerField(required=False, min_value=1)

    class Meta(InvoiceItemSerializer.Meta):
        fields = tuple(field for field in InvoiceItemSerializer.Meta.fields if field != "invoice")
        read_only_fields = tuple(field for field in InvoiceItemSerializer.Meta.read_only_fields if field != "id")

    def validate(self, attrs):
        user = self.context["request"].user
        if user.role == User.Role.NURSE:
            care, session = attrs.get("care"), attrs.get("care_session")
            if care and care.assigned_nurse_id != user.pk:
                raise serializers.ValidationError("This care is outside the nurse workspace.")
            if session and session.nurse_id != user.pk:
                raise serializers.ValidationError("This care session is outside the nurse workspace.")
        return attrs


class InvoiceSerializer(serializers.ModelSerializer):
    items = InvoiceItemSerializer(many=True, read_only=True)
    lines = InvoiceFormLineSerializer(many=True, write_only=True, required=False, allow_empty=False)
    emit = serializers.BooleanField(write_only=True, required=False, default=False)
    can_edit = serializers.SerializerMethodField()
    can_delete = serializers.SerializerMethodField()

    def get_can_edit(self, obj):
        user = self.context["request"].user
        return (obj.status == Invoice.Status.DRAFT and not obj.allocations.exists()
                and (user.role != User.Role.NURSE or obj.created_by_id == user.pk))

    def get_can_delete(self, obj):
        return self.get_can_edit(obj)

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
            "lines",
            "emit",
            "can_edit",
            "can_delete",
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

    def validate(self, attrs):
        user = self.context["request"].user
        if user.role == User.Role.NURSE and self.instance and self.instance.created_by_id != user.id:
            raise serializers.ValidationError("Only invoices created by this nurse can be modified.")
        return attrs

    def get_patient_name(self, obj) -> str:
        return f"{obj.patient.first_name} {obj.patient.last_name}".strip()

    def create(self, validated_data):
        try:
            return save_invoice_form(
                actor=self.context["request"].user,
                request=self.context.get("request"),
                **validated_data,
            )
        except DjangoValidationError as error:
            raise_drf_validation(error)

    def update(self, instance, validated_data):
        try:
            return save_invoice_form(invoice=instance, actor=self.context["request"].user,
                                     request=self.context.get("request"), **validated_data)
        except DjangoValidationError as error:
            raise_drf_validation(error)


class CancelInvoiceSerializer(serializers.Serializer):
    reason = serializers.CharField()


class PatientFinancialSummarySerializer(serializers.Serializer):
    patient = serializers.IntegerField()
    total_invoiced = serializers.DecimalField(max_digits=12, decimal_places=2)
    total_paid = serializers.DecimalField(max_digits=12, decimal_places=2)
    total_remaining = serializers.DecimalField(max_digits=12, decimal_places=2)
    unpaid_invoices_count = serializers.IntegerField()
    partially_paid_invoices_count = serializers.IntegerField()

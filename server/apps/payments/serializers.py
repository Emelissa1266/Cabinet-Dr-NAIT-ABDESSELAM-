from django.core.exceptions import ValidationError as DjangoValidationError
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.billing.models import Invoice
from apps.billing.serializers import raise_drf_validation

from .models import Payment, PaymentAllocation, Receipt
from .services import allocate_payment, create_payment


class PaymentAllocationSerializer(serializers.ModelSerializer):
    invoice_number = serializers.CharField(source="invoice.invoice_number", read_only=True)

    class Meta:
        model = PaymentAllocation
        fields = ("id", "payment", "invoice", "invoice_number", "amount", "created_at")
        read_only_fields = ("id", "created_at")

    def create(self, validated_data):
        try:
            return allocate_payment(
                payment=validated_data["payment"],
                invoice=validated_data["invoice"],
                amount=validated_data["amount"],
                actor=self.context["request"].user,
                request=self.context.get("request"),
            )
        except DjangoValidationError as error:
            raise_drf_validation(error)


class PaymentSerializer(serializers.ModelSerializer):
    patient_reference = serializers.CharField(source="patient.patient_reference", read_only=True)
    patient_name = serializers.SerializerMethodField()
    allocated_amount = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    unallocated_amount = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    allocations = PaymentAllocationSerializer(many=True, read_only=True)

    class Meta:
        model = Payment
        fields = (
            "id",
            "payment_number",
            "patient",
            "patient_reference",
            "patient_name",
            "amount",
            "currency",
            "payment_method",
            "status",
            "paid_at",
            "reference",
            "notes",
            "received_by",
            "cancelled_by",
            "cancelled_at",
            "cancellation_reason",
            "allocated_amount",
            "unallocated_amount",
            "allocations",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "payment_number",
            "status",
            "received_by",
            "cancelled_by",
            "cancelled_at",
            "cancellation_reason",
            "allocated_amount",
            "unallocated_amount",
            "created_at",
            "updated_at",
        )

    def get_patient_name(self, obj) -> str:
        return f"{obj.patient.first_name} {obj.patient.last_name}".strip()

    def create(self, validated_data):
        try:
            return create_payment(
                actor=self.context["request"].user,
                request=self.context.get("request"),
                **validated_data,
            )
        except DjangoValidationError as error:
            raise_drf_validation(error)

    def update(self, instance, validated_data):
        if instance.status != Payment.Status.PENDING:
            raise serializers.ValidationError("Only pending payments can be edited.")
        for field, value in validated_data.items():
            setattr(instance, field, value)
        try:
            instance.full_clean()
        except DjangoValidationError as error:
            raise_drf_validation(error)
        instance.save()
        return instance


class AllocatePaymentSerializer(serializers.Serializer):
    invoice = serializers.PrimaryKeyRelatedField(queryset=Invoice.objects.all())
    amount = serializers.DecimalField(max_digits=12, decimal_places=2)


class CancelPaymentSerializer(serializers.Serializer):
    reason = serializers.CharField()


class ReceiptSerializer(serializers.ModelSerializer):
    patient_reference = serializers.CharField(source="patient.patient_reference", read_only=True)
    patient_name = serializers.SerializerMethodField()
    payment_number = serializers.CharField(source="payment.payment_number", read_only=True)
    payment_amount = serializers.DecimalField(source="payment.amount", max_digits=12, decimal_places=2, read_only=True)
    payment_method = serializers.CharField(source="payment.payment_method", read_only=True)
    allocations = serializers.SerializerMethodField()

    class Meta:
        model = Receipt
        fields = (
            "id",
            "receipt_number",
            "payment",
            "payment_number",
            "payment_amount",
            "payment_method",
            "patient",
            "patient_reference",
            "patient_name",
            "issued_at",
            "issued_by",
            "notes",
            "allocations",
            "created_at",
        )
        read_only_fields = ("id", "receipt_number", "created_at")

    def get_patient_name(self, obj) -> str:
        return f"{obj.patient.first_name} {obj.patient.last_name}".strip()

    @extend_schema_field(serializers.ListField(child=serializers.DictField()))
    def get_allocations(self, obj) -> list[dict]:
        return [
            {
                "invoice": allocation.invoice_id,
                "invoice_number": allocation.invoice.invoice_number,
                "amount": allocation.amount,
            }
            for allocation in obj.payment.allocations.select_related("invoice")
        ]

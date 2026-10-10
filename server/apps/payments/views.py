from django.core.exceptions import ValidationError as DjangoValidationError
from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import extend_schema
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.models import User
from apps.billing.views import drf_validation
from apps.security.throttling import ActionRateLimitMixin

from .models import Payment, PaymentAllocation, Receipt
from .permissions import PaymentPermission
from .serializers import (
    AllocatePaymentSerializer,
    CancelPaymentSerializer,
    PaymentAllocationSerializer,
    PaymentSerializer,
    ReceiptSerializer,
)
from .services import allocate_payment, cancel_payment, complete_payment


class PaymentViewSet(ActionRateLimitMixin, viewsets.ModelViewSet):
    rate_limit_action_scopes = {
        "allocate": "sensitive_write",
        "cancel": "sensitive_write",
        "complete": "sensitive_write",
    }
    serializer_class = PaymentSerializer
    permission_classes = [PaymentPermission]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = {
        "patient": ["exact"],
        "status": ["exact"],
        "payment_method": ["exact"],
        "paid_at": ["date", "gte", "lte"],
        "received_by": ["exact"],
    }
    search_fields = ("payment_number", "reference", "patient__patient_reference", "patient__first_name", "patient__last_name")
    ordering_fields = ("paid_at", "created_at", "updated_at", "amount")
    ordering = ("-paid_at", "-created_at")

    def get_queryset(self):
        queryset = Payment.objects.select_related("patient", "received_by", "cancelled_by").prefetch_related(
            "allocations",
            "allocations__invoice",
        )
        if getattr(self.request.user, "role", None) == User.Role.NURSE:
            queryset = queryset.filter(allocations__invoice__items__care__assigned_nurse=self.request.user) | queryset.filter(
                allocations__invoice__items__care_session__nurse=self.request.user,
            )
            queryset = queryset.distinct()
        return queryset

    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        try:
            payment = complete_payment(payment=self.get_object(), actor=request.user, request=request)
        except DjangoValidationError as error:
            return Response(drf_validation(error), status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(payment).data)

    @extend_schema(request=CancelPaymentSerializer)
    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        serializer = CancelPaymentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            payment = cancel_payment(
                payment=self.get_object(),
                actor=request.user,
                reason=serializer.validated_data["reason"],
                request=request,
            )
        except DjangoValidationError as error:
            return Response(drf_validation(error), status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(payment).data)

    @extend_schema(request=AllocatePaymentSerializer, responses=PaymentAllocationSerializer)
    @action(detail=True, methods=["post"])
    def allocate(self, request, pk=None):
        serializer = AllocatePaymentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            allocation = allocate_payment(
                payment=self.get_object(),
                invoice=serializer.validated_data["invoice"],
                amount=serializer.validated_data["amount"],
                actor=request.user,
                request=request,
            )
        except DjangoValidationError as error:
            return Response(drf_validation(error), status=status.HTTP_400_BAD_REQUEST)
        return Response(PaymentAllocationSerializer(allocation, context={"request": request}).data)

    def destroy(self, request, *args, **kwargs):
        return Response({"detail": "Payments are cancelled, not deleted."}, status=status.HTTP_405_METHOD_NOT_ALLOWED)


class PaymentAllocationViewSet(ActionRateLimitMixin, viewsets.ReadOnlyModelViewSet):
    serializer_class = PaymentAllocationSerializer
    permission_classes = [PaymentPermission]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ("payment", "invoice")
    ordering = ("created_at",)

    def get_queryset(self):
        queryset = PaymentAllocation.objects.select_related("payment", "invoice", "invoice__patient")
        if getattr(self.request.user, "role", None) == User.Role.NURSE:
            queryset = queryset.filter(invoice__items__care__assigned_nurse=self.request.user) | queryset.filter(
                invoice__items__care_session__nurse=self.request.user,
            )
            queryset = queryset.distinct()
        return queryset


class ReceiptViewSet(ActionRateLimitMixin, viewsets.ReadOnlyModelViewSet):
    serializer_class = ReceiptSerializer
    permission_classes = [PaymentPermission]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ("patient", "payment", "issued_at")
    search_fields = ("receipt_number", "patient__patient_reference", "patient__first_name", "patient__last_name")
    ordering_fields = ("issued_at", "created_at")
    ordering = ("-issued_at", "-created_at")

    def get_queryset(self):
        queryset = Receipt.objects.select_related("patient", "payment", "issued_by")
        if getattr(self.request.user, "role", None) == User.Role.NURSE:
            queryset = queryset.filter(payment__allocations__invoice__items__care__assigned_nurse=self.request.user) | queryset.filter(
                payment__allocations__invoice__items__care_session__nurse=self.request.user,
            )
            queryset = queryset.distinct()
        return queryset

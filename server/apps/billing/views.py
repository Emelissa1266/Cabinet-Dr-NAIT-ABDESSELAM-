from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import DecimalField, F, OuterRef, Subquery, Sum, Value
from django.db.models.functions import Coalesce, Greatest
from django.http import HttpResponse
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.audit.services import record_audit_event
from apps.payments.models import Payment, PaymentAllocation

from .models import MONEY_ZERO, BillableService, Invoice, InvoiceItem
from .pdf import render_invoice_pdf
from .permissions import BillableServicePermission, FinancialPermission, InvoicePermission
from .serializers import (
    BillableServiceSerializer,
    CancelInvoiceSerializer,
    InvoiceItemSerializer,
    InvoiceSerializer,
    PatientFinancialSummarySerializer,
)
from .services import (
    cancel_invoice,
    delete_invoice,
    delete_invoice_item,
    issue_invoice,
    upsert_billable_service_audit,
)


def drf_validation(error):
    if hasattr(error, "message_dict"):
        return error.message_dict
    return {"detail": error.messages}


class BillableServiceViewSet(viewsets.ModelViewSet):
    queryset = BillableService.objects.all()
    serializer_class = BillableServiceSerializer
    permission_classes = [BillableServicePermission]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ("category", "is_active", "currency")
    search_fields = ("code", "name", "description")
    ordering_fields = ("category", "name", "default_unit_price", "created_at")
    ordering = ("category", "name")

    def perform_create(self, serializer):
        service = serializer.save()
        upsert_billable_service_audit(service=service, actor=self.request.user, request=self.request)

    def perform_update(self, serializer):
        old_data = {
            "code": self.get_object().code,
            "default_unit_price": str(self.get_object().default_unit_price),
        }
        service = serializer.save()
        upsert_billable_service_audit(
            service=service,
            actor=self.request.user,
            request=self.request,
            old_data=old_data,
        )


class InvoiceViewSet(viewsets.ModelViewSet):
    serializer_class = InvoiceSerializer
    permission_classes = [InvoicePermission]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = {
        "patient": ["exact"],
        "status": ["exact"],
        "issue_date": ["exact", "gte", "lte"],
        "due_date": ["exact", "gte", "lte"],
        "created_by": ["exact"],
    }
    search_fields = (
        "invoice_number",
        "patient__patient_reference",
        "patient__first_name",
        "patient__last_name",
    )
    ordering_fields = ("issue_date", "due_date", "created_at", "updated_at")
    ordering = ("-issue_date", "-created_at")

    def get_queryset(self):
        queryset = Invoice.objects.select_related(
            "patient",
            "created_by",
            "finalized_by",
            "cancelled_by",
        ).prefetch_related("items", "items__billable_service")
        user = self.request.user
        role = getattr(user, "role", None)
        if role == User.Role.NURSE:
            queryset = (
                queryset.filter(created_by=user)
                | queryset.filter(items__care__assigned_nurse=user)
                | queryset.filter(items__care_session__nurse=user)
            )
            queryset = queryset.distinct()
        overdue = self.request.query_params.get("overdue")
        if overdue is not None:
            overdue_bool = overdue.lower() in {"1", "true", "yes"}
            if overdue_bool:
                queryset = queryset.filter(
                    due_date__lt=timezone.localdate(),
                ).exclude(status__in=[Invoice.Status.CANCELLED, Invoice.Status.PAID])
        return queryset

    @action(detail=False, methods=["get"])
    def summary(self, request):
        queryset = self.filter_queryset(self.get_queryset()).exclude(
            status__in=[Invoice.Status.DRAFT, Invoice.Status.CANCELLED])
        money = DecimalField(max_digits=18, decimal_places=2)
        zero = Value(MONEY_ZERO, output_field=money)
        lines = InvoiceItem.objects.filter(invoice_id=OuterRef("pk")).order_by().values("invoice_id").annotate(
            amount=Sum("net_amount")).values("amount")
        allocations = PaymentAllocation.objects.filter(invoice_id=OuterRef("pk"), payment__status=Payment.Status.COMPLETED).order_by().values("invoice_id").annotate(
            amount=Sum("amount")).values("amount")
        queryset = queryset.annotate(
            _subtotal=Coalesce(Subquery(lines, output_field=money), zero),
            _paid=Coalesce(Subquery(allocations, output_field=money), zero),
        ).annotate(_total=Greatest(F("_subtotal") - F("discount_amount"), zero))
        totals = queryset.aggregate(total=Sum("_total"), paid=Sum("_paid"),
                                    remaining=Sum(Greatest(F("_total") - F("_paid"), zero)))
        return Response({key: format(value or MONEY_ZERO, ".2f") for key, value in totals.items()})

    @action(detail=True, methods=["post"])
    def issue(self, request, pk=None):
        try:
            invoice = issue_invoice(invoice=self.get_object(), actor=request.user, request=request)
        except DjangoValidationError as error:
            return Response(drf_validation(error), status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(invoice).data)

    @extend_schema(request=CancelInvoiceSerializer)
    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        serializer = CancelInvoiceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            invoice = cancel_invoice(
                invoice=self.get_object(),
                actor=request.user,
                reason=serializer.validated_data["reason"],
                request=request,
            )
        except DjangoValidationError as error:
            return Response(drf_validation(error), status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(invoice).data)

    def _pdf_response(self, *, inline: bool):
        invoice = self.get_object()
        pdf = render_invoice_pdf(invoice)
        filename = f"{invoice.invoice_number or 'facture-brouillon'}.pdf"
        response = HttpResponse(pdf, content_type="application/pdf")
        response["Cache-Control"] = "private, no-store, max-age=0"
        response["Pragma"] = "no-cache"
        response["X-Content-Type-Options"] = "nosniff"
        disposition = "inline" if inline else "attachment"
        response["Content-Disposition"] = f'{disposition}; filename="{filename}"'
        record_audit_event(
            user=self.request.user,
            action="INVOICE_PRINT_VIEWED" if inline else "INVOICE_PDF_DOWNLOADED",
            entity_type="Invoice",
            entity_id=invoice.pk,
            new_data={"invoice_number": invoice.invoice_number, "total": str(invoice.total)},
            request=self.request,
        )
        return response

    @action(detail=True, methods=["get"], url_path="pdf")
    def pdf(self, request, pk=None):
        return self._pdf_response(inline=False)

    @action(detail=True, methods=["get"], url_path="print")
    def print_pdf(self, request, pk=None):
        return self._pdf_response(inline=True)

    def destroy(self, request, *args, **kwargs):
        try:
            delete_invoice(invoice=self.get_object(), actor=request.user, request=request)
        except DjangoValidationError as error:
            return Response(drf_validation(error), status=status.HTTP_400_BAD_REQUEST)
        return Response(status=status.HTTP_204_NO_CONTENT)


class InvoiceItemViewSet(viewsets.ModelViewSet):
    serializer_class = InvoiceItemSerializer
    permission_classes = [InvoicePermission]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = (
        "invoice",
        "billable_service",
        "consultation",
        "surgery",
        "care",
        "care_session",
        "appointment",
    )
    search_fields = ("description", "invoice__invoice_number", "invoice__patient__patient_reference")
    ordering = ("id",)

    def get_queryset(self):
        queryset = InvoiceItem.objects.select_related(
            "invoice",
            "invoice__patient",
            "billable_service",
            "care",
            "care_session",
        )
        if getattr(self.request.user, "role", None) == User.Role.NURSE:
            queryset = (
                queryset.filter(invoice__created_by=self.request.user)
                | queryset.filter(care__assigned_nurse=self.request.user)
                | queryset.filter(care_session__nurse=self.request.user)
            )
            queryset = queryset.distinct()
        return queryset

    def destroy(self, request, *args, **kwargs):
        try:
            delete_invoice_item(item=self.get_object(), actor=request.user, request=request)
        except DjangoValidationError as error:
            return Response(drf_validation(error), status=status.HTTP_400_BAD_REQUEST)
        return Response(status=status.HTTP_204_NO_CONTENT)


class PatientFinancialSummaryView(APIView):
    permission_classes = [FinancialPermission]

    @extend_schema(
        parameters=[OpenApiParameter("patient_id", int, OpenApiParameter.PATH)],
        responses=PatientFinancialSummarySerializer,
    )
    def get(self, request, patient_id):
        invoices = Invoice.objects.filter(patient_id=patient_id).exclude(status=Invoice.Status.CANCELLED)
        if getattr(request.user, "role", None) == User.Role.NURSE:
            invoices = invoices.filter(items__care__assigned_nurse=request.user) | invoices.filter(
                items__care_session__nurse=request.user,
            )
            invoices = invoices.distinct()
        invoice_ids = list(invoices.values_list("id", flat=True))
        total_subtotal = InvoiceItem.objects.filter(invoice_id__in=invoice_ids).aggregate(total=Sum("net_amount"))[
            "total"
        ] or MONEY_ZERO
        total_invoice_discounts = invoices.aggregate(total=Sum("discount_amount"))["total"] or MONEY_ZERO
        total_invoiced = max(total_subtotal - total_invoice_discounts, MONEY_ZERO)
        total_paid = PaymentAllocation.objects.filter(
            invoice_id__in=invoice_ids,
            payment__status=Payment.Status.COMPLETED,
        ).aggregate(total=Sum("amount"))["total"] or MONEY_ZERO
        data = {
            "patient": patient_id,
            "total_invoiced": total_invoiced,
            "total_paid": total_paid,
            "total_remaining": max(total_invoiced - total_paid, MONEY_ZERO),
            "unpaid_invoices_count": invoices.filter(status=Invoice.Status.ISSUED).count(),
            "partially_paid_invoices_count": invoices.filter(status=Invoice.Status.PARTIALLY_PAID).count(),
        }
        return Response(PatientFinancialSummarySerializer(data).data)

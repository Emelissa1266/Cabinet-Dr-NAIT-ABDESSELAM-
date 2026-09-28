from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    BillableServiceViewSet,
    InvoiceItemViewSet,
    InvoiceViewSet,
    PatientFinancialSummaryView,
)

router = DefaultRouter()
router.register("billable-services", BillableServiceViewSet, basename="billable-service")
router.register("invoices", InvoiceViewSet, basename="invoice")
router.register("invoice-items", InvoiceItemViewSet, basename="invoice-item")

urlpatterns = [
    path("patients/<int:patient_id>/financial-summary/", PatientFinancialSummaryView.as_view(), name="patient-financial-summary"),
    *router.urls,
]

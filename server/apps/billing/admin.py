from django.contrib import admin

from .models import BillableService, FinancialSequence, Invoice, InvoiceItem


class InvoiceItemInline(admin.TabularInline):
    model = InvoiceItem
    extra = 0
    readonly_fields = ("gross_amount", "net_amount", "created_at", "updated_at")


@admin.register(BillableService)
class BillableServiceAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "category", "default_unit_price", "currency", "is_active")
    list_filter = ("category", "currency", "is_active")
    search_fields = ("code", "name", "description")


@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = ("invoice_number", "patient", "status", "issue_date", "total", "paid_amount", "remaining_amount")
    list_filter = ("status", "issue_date", "due_date")
    search_fields = ("invoice_number", "patient__patient_reference", "patient__first_name", "patient__last_name")
    readonly_fields = (
        "invoice_number",
        "subtotal",
        "discount_total",
        "total",
        "paid_amount",
        "remaining_amount",
        "finalized_at",
        "cancelled_at",
        "created_at",
        "updated_at",
    )
    inlines = [InvoiceItemInline]


@admin.register(InvoiceItem)
class InvoiceItemAdmin(admin.ModelAdmin):
    list_display = ("invoice", "description", "quantity", "unit_price", "discount_amount", "net_amount")
    list_filter = ("billable_service__category",)
    search_fields = ("description", "invoice__invoice_number", "invoice__patient__patient_reference")
    readonly_fields = ("gross_amount", "net_amount", "created_at", "updated_at")


@admin.register(FinancialSequence)
class FinancialSequenceAdmin(admin.ModelAdmin):
    list_display = ("key", "year", "current_value")
    readonly_fields = ("key", "year", "current_value")

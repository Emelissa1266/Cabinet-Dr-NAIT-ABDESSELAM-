from django.contrib import admin

from .models import Payment, PaymentAllocation, Receipt


class PaymentAllocationInline(admin.TabularInline):
    model = PaymentAllocation
    extra = 0
    readonly_fields = ("created_at",)


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ("payment_number", "patient", "amount", "payment_method", "status", "paid_at")
    list_filter = ("status", "payment_method", "paid_at")
    search_fields = ("payment_number", "reference", "patient__patient_reference", "patient__first_name", "patient__last_name")
    readonly_fields = ("payment_number", "cancelled_at", "created_at", "updated_at")
    inlines = [PaymentAllocationInline]


@admin.register(PaymentAllocation)
class PaymentAllocationAdmin(admin.ModelAdmin):
    list_display = ("payment", "invoice", "amount", "created_at")
    list_filter = ("created_at",)
    search_fields = ("payment__payment_number", "invoice__invoice_number")
    readonly_fields = ("created_at",)


@admin.register(Receipt)
class ReceiptAdmin(admin.ModelAdmin):
    list_display = ("receipt_number", "patient", "payment", "issued_at")
    list_filter = ("issued_at",)
    search_fields = ("receipt_number", "payment__payment_number", "patient__patient_reference")
    readonly_fields = ("receipt_number", "created_at")

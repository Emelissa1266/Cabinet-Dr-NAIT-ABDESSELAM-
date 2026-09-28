from rest_framework.routers import DefaultRouter

from .views import PaymentAllocationViewSet, PaymentViewSet, ReceiptViewSet

router = DefaultRouter()
router.register("payments", PaymentViewSet, basename="payment")
router.register("payment-allocations", PaymentAllocationViewSet, basename="payment-allocation")
router.register("receipts", ReceiptViewSet, basename="receipt")

urlpatterns = router.urls

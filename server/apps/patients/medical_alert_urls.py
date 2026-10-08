from rest_framework.routers import DefaultRouter

from .views import MedicalAlertViewSet

router = DefaultRouter()
router.register("medical-alerts", MedicalAlertViewSet, basename="medical-alert")

urlpatterns = router.urls

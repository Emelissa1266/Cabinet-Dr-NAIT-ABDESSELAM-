from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import ConsultationViewSet, MedicalInstructionViewSet, PrescriptionViewSet

router = DefaultRouter()
router.register("consultations", ConsultationViewSet, basename="consultation")
router.register("prescriptions", PrescriptionViewSet, basename="prescription")
router.register("medical-instructions", MedicalInstructionViewSet, basename="medical-instruction")

urlpatterns = [
    path("", include(router.urls)),
]

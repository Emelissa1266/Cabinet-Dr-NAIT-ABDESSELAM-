from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import ConsultationViewSet, MedicalInstructionViewSet, PrescriptionViewSet
from .work_leave_api import WorkLeaveViewSet

router = DefaultRouter()
router.register("work-leaves", WorkLeaveViewSet, basename="work-leave")
router.register("consultations", ConsultationViewSet, basename="consultation")
router.register("prescriptions", PrescriptionViewSet, basename="prescription")
router.register("medical-instructions", MedicalInstructionViewSet, basename="medical-instruction")

urlpatterns = [
    path("", include(router.urls)),
]

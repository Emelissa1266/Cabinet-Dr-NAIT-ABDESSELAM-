from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    CareCategoryViewSet,
    CareObservationViewSet,
    CareParameterDefinitionViewSet,
    CareSessionMaterialViewSet,
    CareSessionParameterViewSet,
    CareSessionViewSet,
    CareTypeViewSet,
    CareViewSet,
    ClinicalMeasurementViewSet,
)

router = DefaultRouter()
router.register("care-categories", CareCategoryViewSet, basename="care-category")
router.register("care-types", CareTypeViewSet, basename="care-type")
router.register("cares", CareViewSet, basename="care")
router.register("care-sessions", CareSessionViewSet, basename="care-session")
router.register("care-observations", CareObservationViewSet, basename="care-observation")
router.register("clinical-measurements", ClinicalMeasurementViewSet, basename="clinical-measurement")
router.register("care-session-materials", CareSessionMaterialViewSet, basename="care-session-material")
router.register("care-parameter-definitions", CareParameterDefinitionViewSet, basename="care-parameter-definition")
router.register("care-session-parameters", CareSessionParameterViewSet, basename="care-session-parameter")

urlpatterns = [
    path("", include(router.urls)),
]

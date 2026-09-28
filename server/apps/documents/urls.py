from rest_framework.routers import DefaultRouter

from .views import (
    ClinicalPhotoComparisonViewSet,
    ClinicalPhotoSetViewSet,
    ClinicalPhotoViewSet,
    DocumentCategoryViewSet,
    DocumentViewSet,
)

router = DefaultRouter()
router.register("document-categories", DocumentCategoryViewSet, basename="document-category")
router.register("documents", DocumentViewSet, basename="document")
router.register("clinical-photo-sets", ClinicalPhotoSetViewSet, basename="clinical-photo-set")
router.register("clinical-photos", ClinicalPhotoViewSet, basename="clinical-photo")
router.register("clinical-photo-comparisons", ClinicalPhotoComparisonViewSet, basename="clinical-photo-comparison")

urlpatterns = router.urls

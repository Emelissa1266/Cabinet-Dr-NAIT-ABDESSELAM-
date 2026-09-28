from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    AnesthesiaRecordViewSet,
    IntraoperativeEventViewSet,
    PostoperativeAssessmentViewSet,
    PostoperativeFollowUpViewSet,
    PreoperativeAssessmentViewSet,
    PreoperativeChecklistItemViewSet,
    PreoperativeRequirementViewSet,
    SurgeryComplicationViewSet,
    SurgeryConsentViewSet,
    SurgeryOperativeRecordViewSet,
    SurgeryPreoperativeChecklistViewSet,
    SurgeryTeamMemberViewSet,
    SurgeryViewSet,
)

router = DefaultRouter()
router.register("surgeries", SurgeryViewSet, basename="surgery")
router.register("preoperative-assessments", PreoperativeAssessmentViewSet, basename="preoperative-assessment")
router.register("preoperative-checklist-items", PreoperativeChecklistItemViewSet, basename="preoperative-checklist-item")
router.register("preoperative-checklists", SurgeryPreoperativeChecklistViewSet, basename="preoperative-checklist")
router.register("preoperative-requirements", PreoperativeRequirementViewSet, basename="preoperative-requirement")
router.register("surgery-consents", SurgeryConsentViewSet, basename="surgery-consent")
router.register("anesthesia-records", AnesthesiaRecordViewSet, basename="anesthesia-record")
router.register("operative-records", SurgeryOperativeRecordViewSet, basename="operative-record")
router.register("surgery-team-members", SurgeryTeamMemberViewSet, basename="surgery-team-member")
router.register("intraoperative-events", IntraoperativeEventViewSet, basename="intraoperative-event")
router.register("surgery-complications", SurgeryComplicationViewSet, basename="surgery-complication")
router.register("postoperative-assessments", PostoperativeAssessmentViewSet, basename="postoperative-assessment")
router.register("postoperative-follow-ups", PostoperativeFollowUpViewSet, basename="postoperative-follow-up")

urlpatterns = [
    path("", include(router.urls)),
]

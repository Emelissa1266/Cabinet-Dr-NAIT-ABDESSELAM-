from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    AgendaDayView,
    AgendaWeekView,
    AppointmentRescheduleViewSet,
    AppointmentStaffViewSet,
    AppointmentTypeViewSet,
    AppointmentViewSet,
    AvailabilityView,
    ClinicClosureViewSet,
    StaffTimeOffViewSet,
    StaffWorkingHoursViewSet,
)

router = DefaultRouter()
router.register("appointment-types", AppointmentTypeViewSet, basename="appointment-type")
router.register("appointments", AppointmentViewSet, basename="appointment")
router.register("appointment-staff", AppointmentStaffViewSet, basename="appointment-staff")
router.register("staff-working-hours", StaffWorkingHoursViewSet, basename="staff-working-hours")
router.register("staff-time-off", StaffTimeOffViewSet, basename="staff-time-off")
router.register("clinic-closures", ClinicClosureViewSet, basename="clinic-closure")
router.register("appointment-reschedules", AppointmentRescheduleViewSet, basename="appointment-reschedule")

urlpatterns = [
    path("", include(router.urls)),
    path("availability/", AvailabilityView.as_view(), name="availability"),
    path("agenda/day/", AgendaDayView.as_view(), name="agenda-day"),
    path("agenda/week/", AgendaWeekView.as_view(), name="agenda-week"),
]

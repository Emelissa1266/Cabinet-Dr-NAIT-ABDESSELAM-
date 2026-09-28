"""Root URL configuration for the Clinic Management API."""

from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from .views import health_check

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/v1/health/", health_check, name="health-check"),
    path("api/v1/auth/", include("apps.accounts.urls")),
    path("api/v1/patients/", include("apps.patients.urls")),
    path("api/v1/", include("apps.medical.urls")),
    path("api/v1/", include("apps.care.urls")),
    path("api/v1/", include("apps.surgery.urls")),
    path("api/v1/", include("apps.agenda.urls")),
    path("api/v1/", include("apps.billing.urls")),
    path("api/v1/", include("apps.payments.urls")),
    path("api/v1/", include("apps.documents.urls")),
    path("api/v1/", include("apps.notifications.urls")),
    path("api/v1/", include("apps.dashboard.urls")),
]

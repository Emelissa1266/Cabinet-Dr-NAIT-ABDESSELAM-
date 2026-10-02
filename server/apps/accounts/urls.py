from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import AdminUserViewSet, LoginView, LogoutView, MeView, RefreshView

router = DefaultRouter()
router.register("users", AdminUserViewSet, basename="admin-user")

urlpatterns = [
    path("login/", LoginView.as_view(), name="auth-login"),
    path("refresh/", RefreshView.as_view(), name="auth-refresh"),
    path("logout/", LogoutView.as_view(), name="auth-logout"),
    path("me/", MeView.as_view(), name="auth-me"),
    path("", include(router.urls)),
]

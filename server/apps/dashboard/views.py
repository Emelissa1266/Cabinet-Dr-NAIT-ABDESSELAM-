from drf_spectacular.utils import extend_schema
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .services import get_dashboard_for_user


class DashboardView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        description="Return a role-specific operational dashboard for the authenticated user.",
        responses={200: dict},
    )
    def get(self, request):
        return Response(get_dashboard_for_user(request.user))

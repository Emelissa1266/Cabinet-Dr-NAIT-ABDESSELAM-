from typing import ClassVar

import django_filters

from .models import Patient


class PatientFilter(django_filters.FilterSet):
    created_after = django_filters.DateTimeFilter(field_name="created_at", lookup_expr="gte")
    created_before = django_filters.DateTimeFilter(field_name="created_at", lookup_expr="lte")

    class Meta:
        model = Patient
        fields: ClassVar[dict[str, list[str]]] = {
            "gender": ["exact"],
            "city": ["exact", "icontains"],
            "is_active": ["exact"],
            "date_of_birth": ["exact", "gte", "lte"],
            "created_by": ["exact"],
        }

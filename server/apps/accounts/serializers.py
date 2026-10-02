from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import User


class UserSerializer(serializers.ModelSerializer):
    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "first_name",
            "last_name",
            "email",
            "phone",
            "role",
            "professional_title",
            "avatar",
            "avatar_url",
            "profile_notes",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "avatar_url",
            "is_active",
            "created_at",
            "updated_at",
        )

    @extend_schema_field(serializers.URLField(allow_null=True))
    def get_avatar_url(self, obj):
        request = self.context.get("request")
        if not obj.avatar:
            return None
        url = obj.avatar.url
        return request.build_absolute_uri(url) if request else url


class LoginSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        data["user"] = UserSerializer(
            self.user,
            context=self.context,
        ).data
        return data


class LogoutSerializer(serializers.Serializer):
    refresh = serializers.CharField()


class AdminUserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, allow_blank=False, trim_whitespace=False)
    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "first_name",
            "last_name",
            "email",
            "phone",
            "role",
            "professional_title",
            "profile_notes",
            "avatar_url",
            "is_active",
            "password",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "avatar_url", "created_at", "updated_at")

    @extend_schema_field(serializers.URLField(allow_null=True))
    def get_avatar_url(self, obj):
        request = self.context.get("request")
        if not obj.avatar:
            return None
        url = obj.avatar.url
        return request.build_absolute_uri(url) if request else url

    def validate(self, attrs):
        request = self.context.get("request")
        actor = getattr(request, "user", None)
        instance = self.instance
        next_role = attrs.get("role", getattr(instance, "role", None))
        next_active = attrs.get("is_active", getattr(instance, "is_active", True))
        if instance and actor and instance.pk == actor.pk:
            if "role" in attrs and next_role != User.Role.ADMIN:
                raise serializers.ValidationError("Administrators cannot remove their own ADMIN role.")
            if "is_active" in attrs and not next_active:
                raise serializers.ValidationError("Administrators cannot deactivate their own account.")
        if instance and instance.role == User.Role.ADMIN and instance.is_active:
            would_stop_being_active_admin = next_role != User.Role.ADMIN or not next_active
            if would_stop_being_active_admin:
                other_active_admins = User.objects.filter(role=User.Role.ADMIN, is_active=True).exclude(pk=instance.pk)
                if not other_active_admins.exists():
                    raise serializers.ValidationError("At least one active ADMIN account is required.")
        return attrs

    def create(self, validated_data):
        password = validated_data.pop("password", None)
        if not password:
            raise serializers.ValidationError({"password": "Initial password is required."})
        user = User(**validated_data)
        user.set_password(password)
        user.full_clean()
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        for field, value in validated_data.items():
            setattr(instance, field, value)
        if password:
            instance.set_password(password)
        instance.full_clean()
        instance.save()
        return instance

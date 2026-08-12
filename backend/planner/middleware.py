from django.conf import settings
from django.contrib.auth import get_user_model, login, logout
from django.http import JsonResponse


class ApiLoginRequiredMiddleware:
    """Protect private API endpoints with the social-login session."""

    public_paths = {
        "/api/v1/health/",
        "/api/v1/csrf/",
        "/api/v1/auth/status/",
        "/api/v1/auth/signup/",
        "/api/v1/auth/login/",
    }

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.user.is_authenticated and request.user.username == "demo-user" and not settings.ALLOW_DEMO_USER:
            logout(request)
        if request.path.startswith("/api/v1/") and request.path not in self.public_paths:
            if not request.user.is_authenticated:
                if settings.ALLOW_DEMO_USER:
                    user, _ = get_user_model().objects.get_or_create(
                        username="demo-user",
                        defaults={"email": "demo@somni.local"},
                    )
                    login(request, user, backend="django.contrib.auth.backends.ModelBackend")
                else:
                    return JsonResponse({"detail": "로그인이 필요합니다.", "loginUrl": "/auth/"}, status=401)
        return self.get_response(request)

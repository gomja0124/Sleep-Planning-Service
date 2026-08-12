from django.http import JsonResponse


class ApiLoginRequiredMiddleware:
    """Protect private API endpoints with the social-login session."""

    public_paths = {"/api/v1/health/"}

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.path.startswith("/api/v1/") and request.path not in self.public_paths:
            if not request.user.is_authenticated:
                return JsonResponse({"detail": "로그인이 필요합니다.", "loginUrl": "/auth/"}, status=401)
        return self.get_response(request)
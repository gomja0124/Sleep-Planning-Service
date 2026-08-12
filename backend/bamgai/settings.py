import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "replace-this-development-key-before-deployment")
DEBUG = os.environ.get("DJANGO_DEBUG", "true").lower() == "true"
ALLOWED_HOSTS = ["localhost", "127.0.0.1", "testserver"]

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.sites",
    "allauth",
    "allauth.account",
    "allauth.socialaccount",
    "allauth.socialaccount.providers.google",
    "allauth.socialaccount.providers.apple",
    "planner",
]
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "allauth.account.middleware.AccountMiddleware",
    "planner.middleware.ApiLoginRequiredMiddleware",
]
ROOT_URLCONF = "bamgai.urls"
TEMPLATES = [{"BACKEND": "django.template.backends.django.DjangoTemplates", "DIRS": [], "APP_DIRS": True, "OPTIONS": {"context_processors": [
    "django.template.context_processors.request", "django.contrib.auth.context_processors.auth",
    "django.contrib.messages.context_processors.messages",
+]}}]
WSGI_APPLICATION = "bamgai.wsgi.application"
DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": BASE_DIR / "db.sqlite3"}}
LANGUAGE_CODE = "ko-kr"
TIME_ZONE = "Asia/Seoul"
USE_I18N = True
USE_TZ = True
STATIC_URL = "static/"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
SITE_ID = 1

AUTHENTICATION_BACKENDS = [
    "django.contrib.auth.backends.ModelBackend",
    "allauth.account.auth_backends.AuthenticationBackend",
]
SOCIALACCOUNT_ONLY = True
SOCIALACCOUNT_LOGIN_ON_GET = False
SOCIALACCOUNT_AUTO_SIGNUP = True
SOCIALACCOUNT_STORE_TOKENS = False
LOGIN_REDIRECT_URL = "/auth/status/"
LOGOUT_REDIRECT_URL = "/auth/"


def _provider_app(prefix, *, apple=False):
    client_id = os.environ.get(f"{prefix}_CLIENT_ID")
    secret = os.environ.get(f"{prefix}_CLIENT_SECRET")
    if not client_id or not secret:
        return None
    app = {"client_id": client_id, "secret": secret, "key": ""}
    if apple:
        team_id = os.environ.get("APPLE_TEAM_ID")
        private_key = os.environ.get("APPLE_PRIVATE_KEY", "").replace("\\n", "\n")
        if not team_id or not private_key:
            return None
        app["key"] = team_id
        app["settings"] = {"certificate_key": private_key}
    return app


google_app = _provider_app("GOOGLE")
apple_app = _provider_app("APPLE", apple=True)
SOCIAL_LOGIN_CONFIGURED = {"google": bool(google_app), "apple": bool(apple_app)}
SOCIALACCOUNT_PROVIDERS = {
    "google": {
        "APPS": [google_app] if google_app else [],
        "SCOPE": ["profile", "email"],
        "AUTH_PARAMS": {"access_type": "online"},
        "OAUTH_PKCE_ENABLED": True,
    },
    "apple": {"APPS": [apple_app] if apple_app else []},
}
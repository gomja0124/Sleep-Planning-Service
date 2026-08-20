import os
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent
DEVELOPMENT_SECRET_KEY = "replace-this-development-key-before-deployment"
SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", DEVELOPMENT_SECRET_KEY)
DEBUG = os.environ.get("DJANGO_DEBUG", "true").lower() == "true"
SLEEP_RECORD_TEST_MODE = DEBUG and os.environ.get("SLEEP_RECORD_TEST_MODE", "true").lower() == "true"
# 데모 계정은 로그인 없이 모든 API를 열어 주므로 개발 환경에서만 허용한다.
ALLOW_DEMO_USER = DEBUG and os.environ.get("DJANGO_ALLOW_DEMO_USER", "false").lower() == "true"
# Render는 서비스 주소를 RENDER_EXTERNAL_URL로 자동 주입한다. 배포 전에는 주소를
# 알 수 없으므로, 직접 지정하지 않으면 그 값을 쓴다. 손으로 넣고 재배포할 필요가 없다.
RENDER_EXTERNAL_URL = os.environ.get("RENDER_EXTERNAL_URL", "")
FRONTEND_ORIGIN = (
    os.environ.get("FRONTEND_ORIGIN") or RENDER_EXTERNAL_URL or "http://localhost:4173"
).rstrip("/")

# 배포 도메인은 DJANGO_ALLOWED_HOSTS에 쉼표로 구분해 넣는다.
ALLOWED_HOSTS = ["localhost", "127.0.0.1", "testserver"] + [
    host.strip() for host in os.environ.get("DJANGO_ALLOWED_HOSTS", "").split(",") if host.strip()
]
if os.environ.get("RENDER_EXTERNAL_HOSTNAME"):
    ALLOWED_HOSTS.append(os.environ["RENDER_EXTERNAL_HOSTNAME"])

# 개발용 기본 키로 운영에 뜨면 세션과 CSRF 토큰을 누구나 위조할 수 있다.
if not DEBUG and SECRET_KEY == DEVELOPMENT_SECRET_KEY:
    raise ImproperlyConfigured("운영 환경에서는 DJANGO_SECRET_KEY를 반드시 설정해야 합니다.")

if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SECURE_SSL_REDIRECT = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SESSION_COOKIE_SAMESITE = "None"
    CSRF_COOKIE_SAMESITE = "None"
    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
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
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "allauth.account.middleware.AccountMiddleware",
    "planner.middleware.ApiLoginRequiredMiddleware",
]
ROOT_URLCONF = "bamgai.urls"
TEMPLATES = [{"BACKEND": "django.template.backends.django.DjangoTemplates", "DIRS": [], "APP_DIRS": True, "OPTIONS": {"context_processors": [
    "django.template.context_processors.request", "django.contrib.auth.context_processors.auth",
    "django.contrib.messages.context_processors.messages",
]}}]
WSGI_APPLICATION = "bamgai.wsgi.application"
# 로컬은 SQLite, 배포는 DATABASE_URL(Postgres 등)을 쓴다.
# PaaS의 디스크는 재배포마다 초기화되므로 SQLite로 운영하면 글이 사라진다.
DATABASE_URL = os.environ.get("DATABASE_URL", "")
if DATABASE_URL:
    import dj_database_url

    DATABASES = {"default": dj_database_url.parse(DATABASE_URL, conn_max_age=600, ssl_require=not DEBUG)}
else:
    DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": BASE_DIR / "db.sqlite3"}}
LANGUAGE_CODE = "ko-kr"
TIME_ZONE = "Asia/Seoul"
USE_I18N = True
USE_TZ = True
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

# 프런트를 같은 서비스에서 서빙한다.
#
# 프런트와 API가 다른 사이트에 있으면 세션 쿠키가 크로스사이트 쿠키가 되어
# Safari와 Firefox가 기본 차단한다. 아이폰에서 로그인이 안 된다는 뜻이다.
# 같은 출처에서 내보내면 그 문제가 아예 생기지 않고 CORS도 필요 없다.
#
# 배포 빌드에서 저장소 루트의 정적 파일을 frontend_dist로 복사한다.
WHITENOISE_ROOT = BASE_DIR / "frontend_dist"
WHITENOISE_INDEX_FILE = True
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
SITE_ID = 1
CORS_ALLOWED_ORIGINS = [FRONTEND_ORIGIN]
CORS_ALLOW_CREDENTIALS = True
CSRF_TRUSTED_ORIGINS = [FRONTEND_ORIGIN]

AUTHENTICATION_BACKENDS = [
    "django.contrib.auth.backends.ModelBackend",
    "allauth.account.auth_backends.AuthenticationBackend",
]
ACCOUNT_EMAIL_VERIFICATION = "none"
SOCIALACCOUNT_ONLY = True
SOCIALACCOUNT_LOGIN_ON_GET = False
SOCIALACCOUNT_AUTO_SIGNUP = True
SOCIALACCOUNT_STORE_TOKENS = True
LOGIN_REDIRECT_URL = f"{FRONTEND_ORIGIN}/?login=success"
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


GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "")
google_app = _provider_app("GOOGLE")
apple_app = _provider_app("APPLE", apple=True)
SOCIAL_LOGIN_CONFIGURED = {"google": bool(google_app), "apple": bool(apple_app)}
SOCIALACCOUNT_PROVIDERS = {
    "google": {
        "APPS": [google_app] if google_app else [],
        "SCOPE": ["profile", "email", "https://www.googleapis.com/auth/calendar.readonly"],
        "AUTH_PARAMS": {"access_type": "offline", "prompt": "consent"},
        "OAUTH_PKCE_ENABLED": True,
    },
    "apple": {"APPS": [apple_app] if apple_app else []},
}

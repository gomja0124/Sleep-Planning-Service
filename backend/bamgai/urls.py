from django.contrib import admin
from django.urls import include, path

from planner import views

urlpatterns = [
    path("admin/", admin.site.urls),
    path("accounts/", include("allauth.urls")),
    path("auth/", views.social_login, name="social-login"),
    path("auth/status/", views.auth_status, name="auth-status"),
    path("api/v1/health/", views.health),
    path("api/v1/csrf/", views.csrf),
    path("api/v1/me/", views.me),
    path("api/v1/schedules/", views.schedules),
    path("api/v1/schedules/<int:schedule_id>/", views.schedule_detail),
    path("api/v1/plans/", views.plans),
    path("api/v1/plans/<str:target_date>/override/", views.plan_override),
    path("api/v1/feedback/", views.feedback),
    path("api/v1/sleep-sessions/", views.sleep_sessions),
    path("api/v1/sleep-sessions/<int:session_id>/", views.sleep_session_detail),
    path("api/v1/calendars/sync/", views.sync_calendars),
    path("api/v1/calendars/google/sync/", views.google_calendar_sync),
    path("api/v1/calendars/apple/events/", views.apple_calendar_events),
    path("api/v1/calendars/<str:provider>/", views.calendar_connection),
    path("api/v1/challenges/", views.challenges),
    path("api/v1/challenges/<int:challenge_id>/join/", views.challenge_join),
    path("api/v1/community/posts/", views.community_posts),
]

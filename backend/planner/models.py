from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


def default_alert_settings():
    return {"routine": True, "lights-out": True, "wake": True}

class Profile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.CASCADE, related_name="sleep_profile")
    external_id = models.CharField(max_length=64, unique=True)
    name = models.CharField(max_length=40, default="사용자")
    selected_character = models.CharField(max_length=16, default="owl")
    onboarding_complete = models.BooleanField(default=False)
    target_wake = models.TimeField(default="07:30")
    target_sleep_minutes = models.PositiveSmallIntegerField(default=450)
    latency_minutes = models.PositiveSmallIntegerField(default=24)
    routine_minutes = models.PositiveSmallIntegerField(default=30)
    adaptation_week = models.PositiveSmallIntegerField(default=1)
    time_format = models.CharField(max_length=3, choices=[("12h", "12h"), ("24h", "24h")], default="24h")
    alert_settings = models.JSONField(default=default_alert_settings)
    points = models.PositiveIntegerField(default=120)
    group_streak = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class Schedule(models.Model):
    profile = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name="schedules")
    kind = models.CharField(max_length=8, choices=[("fixed", "fixed"), ("variable", "variable")])
    title = models.CharField(max_length=120)
    source = models.CharField(max_length=10, choices=[("manual", "manual"), ("google", "google"), ("apple", "apple")], default="manual")
    external_id = models.CharField(max_length=255, null=True, blank=True)
    days = models.JSONField(default=list, blank=True)
    date = models.DateField(null=True, blank=True)
    start_time = models.TimeField()
    preparation_minutes = models.PositiveSmallIntegerField(default=0)
    commute_minutes = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class CalendarConnection(models.Model):
    profile = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name="calendar_connections")
    provider = models.CharField(max_length=10, choices=[("apple", "Apple"), ("google", "Google")])
    selected_calendar_id = models.CharField(max_length=255, default="primary")
    sync_token = models.TextField(blank=True)
    connected = models.BooleanField(default=False)
    last_synced_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["profile", "provider"], name="one_calendar_per_provider")]


class Feedback(models.Model):
    profile = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name="feedback_entries")
    date = models.DateField()
    actual_sleep = models.TimeField()
    actual_wake = models.TimeField()
    freshness = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    sleepiness = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    failure_reason = models.CharField(max_length=240, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["profile", "date"], name="one_feedback_per_day")]


class PlanOverride(models.Model):
    profile = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name="plan_overrides")
    target_date = models.DateField()
    offset_minutes = models.SmallIntegerField(default=0)
    saved = models.BooleanField(default=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["profile", "target_date"], name="one_override_per_day")]


class SleepSession(models.Model):
    profile = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name="sleep_sessions")
    target_date = models.DateField()
    status = models.CharField(max_length=12, choices=[("sleeping", "sleeping"), ("alarm", "alarm"), ("checking", "checking"), ("complete", "complete"), ("idle", "idle")], default="sleeping")
    started_at = models.DateTimeField(null=True, blank=True)
    dismissed_at = models.DateTimeField(null=True, blank=True)
    ended_at = models.DateTimeField(null=True, blank=True)


class Challenge(models.Model):
    slug = models.SlugField(unique=True)
    title = models.CharField(max_length=120)
    goal = models.CharField(max_length=160)
    progress = models.PositiveSmallIntegerField(default=0)
    people = models.PositiveIntegerField(default=0)
    reward = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)


class ChallengeParticipation(models.Model):
    profile = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name="challenge_participations")
    challenge = models.ForeignKey(Challenge, on_delete=models.CASCADE, related_name="participations")
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["profile", "challenge"], name="one_challenge_join")]


class CommunityPost(models.Model):
    POST_TYPES = [("recruitment", "모집"), ("challenge", "도전"), ("season", "시즌")]
    post_type = models.CharField(max_length=16, choices=POST_TYPES)
    title = models.CharField(max_length=160)
    body = models.TextField(max_length=1000)
    meta = models.CharField(max_length=160, blank=True)
    author = models.ForeignKey(Profile, null=True, blank=True, on_delete=models.SET_NULL, related_name="posts")
    created_at = models.DateTimeField(auto_now_add=True)

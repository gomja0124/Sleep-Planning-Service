import json
from datetime import date, timedelta

from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.core.exceptions import ValidationError
from django.shortcuts import render
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import ensure_csrf_cookie

from .models import CalendarConnection, Challenge, ChallengeParticipation, CommunityPost, Feedback, PlanOverride, Profile, Schedule, SleepSession
from .services import date_from_string, recommendation, time_string
from .calendar_services import CalendarIntegrationError, sync_apple_events, sync_google_calendar


def payload(request):
    try:
        return json.loads(request.body or "{}")
    except json.JSONDecodeError:
        raise ValueError("JSON 본문이 올바르지 않습니다.")


def error(message, status=400):
    return JsonResponse({"detail": message}, status=status)


def profile_for(request):
    profile, _ = Profile.objects.get_or_create(
        user=request.user,
        defaults={
            "external_id": f"user-{request.user.pk}",
            "name": request.user.get_full_name().strip() or request.user.email or "사용자",
        },
    )
    return profile


def social_login(request):
    if request.user.is_authenticated:
        return auth_status(request)
    return render(request, "planner/social_login.html", {"providers": settings.SOCIAL_LOGIN_CONFIGURED})


@login_required
def auth_status(request):
    return render(request, "planner/auth_status.html", {"profile": profile_for(request)})

def schedule_data(item):
    return {"id": item.id, "kind": item.kind, "title": item.title, "source": item.source, "externalId": item.external_id, "days": item.days, "date": item.date.isoformat() if item.date else None, "startTime": time_string(item.start_time), "preparationMinutes": item.preparation_minutes, "commuteMinutes": item.commute_minutes}


def profile_data(profile):
    calendars = {item.provider: {"connected": item.connected, "selectedCalendarId": item.selected_calendar_id, "lastSyncedAt": item.last_synced_at.isoformat() if item.last_synced_at else None} for item in profile.calendar_connections.all()}
    return {"id": profile.external_id, "selectedCharacter": profile.selected_character, "onboardingComplete": profile.onboarding_complete, "profile": {"name": profile.name, "targetWake": time_string(profile.target_wake), "targetSleepMinutes": profile.target_sleep_minutes, "latencyMinutes": profile.latency_minutes, "routineMinutes": profile.routine_minutes, "adaptationWeek": profile.adaptation_week}, "settings": {"timeFormat": profile.time_format}, "alertSettings": profile.alert_settings, "community": {"points": profile.points, "groupStreak": profile.group_streak}, "calendarConnections": calendars}


@require_http_methods(["GET"])
def health(request):
    return JsonResponse({"status": "ok"})


@ensure_csrf_cookie
@require_http_methods(["GET"])
def csrf(request):
    return JsonResponse({"status": "ok"})


@require_http_methods(["GET", "PATCH"])
def me(request):
    profile = profile_for(request)
    if request.method == "PATCH":
        try:
            data = payload(request)
        except ValueError as exc:
            return error(str(exc))
        scalar_fields = {"name": "name", "selectedCharacter": "selected_character", "onboardingComplete": "onboarding_complete", "targetSleepMinutes": "target_sleep_minutes", "latencyMinutes": "latency_minutes", "routineMinutes": "routine_minutes", "adaptationWeek": "adaptation_week"}
        for source, target in scalar_fields.items():
            if source in data:
                setattr(profile, target, data[source])
        if "targetWake" in data:
            profile.target_wake = data["targetWake"]
        if "timeFormat" in data:
            profile.time_format = data["timeFormat"]
        if "alertSettings" in data:
            profile.alert_settings = data["alertSettings"]
        try:
            profile.full_clean()
        except Exception as exc:
            return error(str(exc))
        profile.save()
    return JsonResponse(profile_data(profile))


@require_http_methods(["GET", "POST"])
def schedules(request):
    profile = profile_for(request)
    if request.method == "GET":
        return JsonResponse({"results": [schedule_data(item) for item in profile.schedules.order_by("start_time", "id")]})
    try:
        data = payload(request)
        item = Schedule(profile=profile, kind=data["kind"], title=data["title"].strip(), days=data.get("days", []), date=data.get("date") or None, start_time=data["startTime"], preparation_minutes=data.get("preparationMinutes", 0), commute_minutes=data.get("commuteMinutes", 0))
        if item.kind == "fixed" and not item.days:
            return error("고정 일정은 반복 요일이 필요합니다.")
        if item.kind == "variable" and not item.date:
            return error("변동 일정은 날짜가 필요합니다.")
        item.full_clean(); item.save()
    except (KeyError, ValueError, ValidationError) as exc:
        return error(f"일정 입력값을 확인해 주세요: {exc}")
    return JsonResponse(schedule_data(item), status=201)


@require_http_methods(["PATCH", "DELETE"])
def schedule_detail(request, schedule_id):
    profile = profile_for(request)
    try:
        item = profile.schedules.get(id=schedule_id)
    except Schedule.DoesNotExist:
        return error("일정을 찾을 수 없습니다.", 404)
    if request.method == "DELETE":
        item.delete(); return JsonResponse({}, status=204)
    try:
        data = payload(request)
        mapping = {"kind": "kind", "title": "title", "days": "days", "date": "date", "startTime": "start_time", "preparationMinutes": "preparation_minutes", "commuteMinutes": "commute_minutes"}
        for source, target in mapping.items():
            if source in data: setattr(item, target, data[source])
        item.full_clean(); item.save()
    except (ValueError, ValidationError) as exc:
        return error(str(exc))
    return JsonResponse(schedule_data(item))


@require_http_methods(["GET"])
def plans(request):
    profile = profile_for(request)
    try:
        start = date_from_string(request.GET.get("start", (timezone.localdate() + timedelta(days=1)).isoformat()))
        days = min(max(int(request.GET.get("days", 7)), 1), 31)
    except ValueError:
        return error("start는 YYYY-MM-DD, days는 1~31이어야 합니다.")
    return JsonResponse({"results": [recommendation(profile, start + timedelta(days=index)) for index in range(days)]})


@require_http_methods(["PUT"])
def plan_override(request, target_date):
    profile = profile_for(request)
    try:
        data = payload(request); target = date_from_string(target_date)
        offset = int(data.get("offsetMinutes", 0))
    except ValueError as exc:
        return error(str(exc))
    if not -120 <= offset <= 120:
        return error("offsetMinutes는 -120~120 사이여야 합니다.")
    override, _ = PlanOverride.objects.update_or_create(profile=profile, target_date=target, defaults={"offset_minutes": offset, "saved": bool(data.get("saved", False))})
    return JsonResponse(recommendation(profile, override.target_date))


@require_http_methods(["GET", "POST"])
def feedback(request):
    profile = profile_for(request)
    if request.method == "GET":
        results = [{"date": item.date.isoformat(), "actualSleep": time_string(item.actual_sleep), "actualWake": time_string(item.actual_wake), "freshness": item.freshness, "sleepiness": item.sleepiness, "failureReason": item.failure_reason} for item in profile.feedback_entries.order_by("-date")]
        return JsonResponse({"results": results})
    try:
        data = payload(request)
        entry, _ = Feedback.objects.update_or_create(profile=profile, date=data["date"], defaults={"actual_sleep": data["actualSleep"], "actual_wake": data["actualWake"], "freshness": data["freshness"], "sleepiness": data["sleepiness"], "failure_reason": data.get("failureReason", "")})
        entry.full_clean(); entry.save()
    except (KeyError, ValueError, ValidationError) as exc:
        return error(f"피드백 입력값을 확인해 주세요: {exc}")
    return JsonResponse({"date": entry.date.isoformat(), "nextPlan": recommendation(profile, entry.date + timedelta(days=1))}, status=201)


@require_http_methods(["GET", "POST"])
def sleep_sessions(request):
    profile = profile_for(request)
    if request.method == "GET":
        items = profile.sleep_sessions.order_by("-id")[:20]
        return JsonResponse({"results": [session_data(item) for item in items]})
    try:
        data = payload(request)
        item = SleepSession(profile=profile, target_date=data["targetDate"], status=data.get("status", "sleeping"), started_at=timezone.now())
        item.full_clean(); item.save()
    except (KeyError, ValueError, ValidationError) as exc:
        return error(str(exc))
    return JsonResponse(session_data(item), status=201)


def session_data(item):
    return {"id": item.id, "targetDate": item.target_date.isoformat(), "status": item.status, "startedAt": item.started_at.isoformat() if item.started_at else None, "dismissedAt": item.dismissed_at.isoformat() if item.dismissed_at else None, "endedAt": item.ended_at.isoformat() if item.ended_at else None}


@require_http_methods(["PATCH"])
def sleep_session_detail(request, session_id):
    profile = profile_for(request)
    try: item = profile.sleep_sessions.get(id=session_id)
    except SleepSession.DoesNotExist: return error("수면 세션을 찾을 수 없습니다.", 404)
    try: data = payload(request)
    except ValueError as exc: return error(str(exc))
    if "status" in data: item.status = data["status"]
    if item.status == "checking" and not item.dismissed_at: item.dismissed_at = timezone.now()
    if item.status in {"complete", "idle"}: item.ended_at = timezone.now()
    try:
        item.full_clean(); item.save()
    except ValidationError as exc:
        return error(str(exc))
    return JsonResponse(session_data(item))


@require_http_methods(["PUT"])
def calendar_connection(request, provider):
    if provider not in {"apple", "google"}: return error("지원하지 않는 캘린더입니다.", 404)
    profile = profile_for(request)
    try: connected = bool(payload(request)["connected"])
    except (KeyError, ValueError) as exc: return error(str(exc))
    item, _ = CalendarConnection.objects.update_or_create(profile=profile, provider=provider, defaults={"connected": connected, "last_synced_at": timezone.now() if connected else None})
    return JsonResponse({"provider": provider, "connected": item.connected, "lastSyncedAt": item.last_synced_at.isoformat() if item.last_synced_at else None})


@require_http_methods(["POST"])
def sync_calendars(request):
    profile = profile_for(request)
    results = []
    google = profile.calendar_connections.filter(provider="google", connected=True).first()
    if google:
        try:
            results.append(sync_google_calendar(profile, google.selected_calendar_id))
        except CalendarIntegrationError as exc:
            return error(exc.detail, exc.status)
    apple = profile.calendar_connections.filter(provider="apple", connected=True).exists()
    return JsonResponse({
        "results": results,
        "appleDeviceSyncRequired": apple,
        "plansRecalculated": bool(results),
    })

@require_http_methods(["GET"])
def challenges(request):
    profile = profile_for(request)
    joined = set(profile.challenge_participations.values_list("challenge_id", flat=True))
    return JsonResponse({"results": [{"id": item.id, "slug": item.slug, "title": item.title, "goal": item.goal, "progress": item.progress, "people": item.people, "reward": item.reward, "joined": item.id in joined} for item in Challenge.objects.filter(is_active=True)]})


@require_http_methods(["POST", "DELETE"])
def challenge_join(request, challenge_id):
    profile = profile_for(request)
    try: challenge = Challenge.objects.get(id=challenge_id, is_active=True)
    except Challenge.DoesNotExist: return error("도전을 찾을 수 없습니다.", 404)
    if request.method == "POST":
        _, created = ChallengeParticipation.objects.get_or_create(profile=profile, challenge=challenge)
        if created: challenge.people += 1; challenge.save(update_fields=["people"])
        return JsonResponse({"joined": True})
    ChallengeParticipation.objects.filter(profile=profile, challenge=challenge).delete()
    return JsonResponse({"joined": False})


@require_http_methods(["GET", "POST"])
def community_posts(request):
    profile = profile_for(request)
    if request.method == "GET":
        posts = CommunityPost.objects.order_by("-created_at")[:50]
        return JsonResponse({"results": [{"id": item.id, "type": item.post_type, "title": item.title, "body": item.body, "meta": item.meta, "createdAt": item.created_at.isoformat()} for item in posts]})
    try:
        data = payload(request)
        item = CommunityPost.objects.create(author=profile, post_type=data.get("type", "recruitment"), title=data["title"], body=data["body"], meta=data.get("meta", ""))
    except (KeyError, ValueError) as exc: return error(str(exc))
    return JsonResponse({"id": item.id, "title": item.title}, status=201)

@require_http_methods(["POST"])
def google_calendar_sync(request):
    profile = profile_for(request)
    try:
        data = payload(request)
        result = sync_google_calendar(profile, data.get("calendarId", "primary"))
    except ValueError as exc:
        return error(str(exc))
    except CalendarIntegrationError as exc:
        return error(exc.detail, exc.status)
    result["plansRecalculated"] = True
    return JsonResponse(result)


@require_http_methods(["PUT"])
def apple_calendar_events(request):
    profile = profile_for(request)
    try:
        data = payload(request)
        events = data.get("events", [])
        deleted_ids = data.get("deletedIds", [])
        if not isinstance(events, list) or not isinstance(deleted_ids, list):
            return error("events와 deletedIds는 배열이어야 합니다.")
        result = sync_apple_events(profile, events, deleted_ids)
    except ValueError as exc:
        return error(str(exc))
    result["plansRecalculated"] = True
    return JsonResponse(result)

from datetime import datetime, timedelta
from urllib.parse import quote

import requests
from allauth.socialaccount.models import SocialAccount, SocialToken
from django.conf import settings
from django.utils import timezone

from .models import CalendarConnection, Schedule

GOOGLE_EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/{calendar_id}/events"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"


class CalendarIntegrationError(Exception):
    def __init__(self, detail, status=400):
        self.detail = detail
        self.status = status
        super().__init__(detail)


def _parse_start(value):
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if timezone.is_aware(parsed):
        parsed = timezone.localtime(parsed)
    return parsed


def _upsert_event(profile, provider, external_id, title, start_at):
    start = _parse_start(start_at)
    if not start:
        return False
    item, _ = Schedule.objects.update_or_create(
        profile=profile,
        source=provider,
        external_id=external_id,
        defaults={
            "kind": "variable",
            "title": (title or "제목 없는 일정")[:120],
            "date": start.date(),
            "days": [],
            "start_time": start.time().replace(second=0, microsecond=0),
            "preparation_minutes": 0,
            "commute_minutes": 0,
        },
    )
    return bool(item)


def _google_token(profile):
    account = SocialAccount.objects.filter(user=profile.user, provider="google").first()
    if not account:
        raise CalendarIntegrationError("Google 로그인 후 캘린더 접근을 허용해 주세요.", 409)
    token = SocialToken.objects.filter(account=account).order_by("-expires_at").first()
    if not token:
        raise CalendarIntegrationError("Google 캘린더 권한 토큰이 없습니다. Google 계정으로 다시 로그인해 주세요.", 409)
    return token


def _refresh_google_token(token):
    refresh_token = token.token_secret
    if not refresh_token:
        raise CalendarIntegrationError("Google 캘린더 권한이 만료되었습니다. Google 계정으로 다시 로그인해 주세요.", 401)
    response = requests.post(
        GOOGLE_TOKEN_URL,
        data={
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token",
        },
        timeout=10,
    )
    if not response.ok:
        raise CalendarIntegrationError("Google 캘린더 권한을 갱신하지 못했습니다. 다시 로그인해 주세요.", 401)
    data = response.json()
    token.token = data["access_token"]
    if data.get("expires_in"):
        token.expires_at = timezone.now() + timedelta(seconds=int(data["expires_in"]))
    token.save(update_fields=["token", "expires_at"])
    return token


def _google_get(token, calendar_id, params):
    events_url = GOOGLE_EVENTS_URL.format(calendar_id=quote(calendar_id, safe=""))
    response = requests.get(
        events_url,
        headers={"Authorization": f"Bearer {token.token}"},
        params=params,
        timeout=15,
    )
    if response.status_code == 401:
        token = _refresh_google_token(token)
        response = requests.get(
            events_url,
            headers={"Authorization": f"Bearer {token.token}"},
            params=params,
            timeout=15,
        )
    return response


def sync_google_calendar(profile, calendar_id="primary"):
    connection, _ = CalendarConnection.objects.get_or_create(profile=profile, provider="google")
    if calendar_id:
        connection.selected_calendar_id = calendar_id
    token = _google_token(profile)
    initial_sync = not connection.sync_token
    params = {"singleEvents": "true", "maxResults": 2500}
    if initial_sync:
        params.update({
            "orderBy": "startTime",
            "timeMin": (timezone.now() - timedelta(days=7)).isoformat(),
            "timeMax": (timezone.now() + timedelta(days=180)).isoformat(),
        })
    else:
        params.update({"syncToken": connection.sync_token, "showDeleted": "true"})

    imported = deleted = skipped = 0
    next_sync_token = None
    while True:
        response = _google_get(token, connection.selected_calendar_id, params)
        if response.status_code == 410 and not initial_sync:
            connection.sync_token = ""
            connection.save(update_fields=["sync_token"])
            return sync_google_calendar(profile, connection.selected_calendar_id)
        if not response.ok:
            raise CalendarIntegrationError("Google Calendar 일정을 가져오지 못했습니다.", response.status_code)
        data = response.json()
        for event in data.get("items", []):
            external_id = event.get("id")
            if not external_id:
                skipped += 1
                continue
            if event.get("status") == "cancelled":
                deleted += Schedule.objects.filter(profile=profile, source="google", external_id=external_id).delete()[0]
                continue
            if _upsert_event(profile, "google", external_id, event.get("summary"), event.get("start", {}).get("dateTime")):
                imported += 1
            else:
                skipped += 1  # 종일 일정은 수면 계획에 정확한 시각을 주지 않아 제외한다.
        if data.get("nextPageToken"):
            params["pageToken"] = data["nextPageToken"]
            continue
        next_sync_token = data.get("nextSyncToken")
        break

    connection.connected = True
    connection.last_synced_at = timezone.now()
    if next_sync_token:
        connection.sync_token = next_sync_token
    connection.save()
    return {"provider": "google", "imported": imported, "deleted": deleted, "skipped": skipped, "lastSyncedAt": connection.last_synced_at.isoformat()}


def sync_apple_events(profile, events, deleted_ids=()):
    imported = deleted = skipped = 0
    for external_id in deleted_ids:
        deleted += Schedule.objects.filter(profile=profile, source="apple", external_id=str(external_id)).delete()[0]
    for event in events:
        if not isinstance(event, dict):
            skipped += 1
            continue
        external_id = str(event.get("externalId") or event.get("eventIdentifier") or "")
        if not external_id:
            skipped += 1
            continue
        if event.get("isDeleted"):
            deleted += Schedule.objects.filter(profile=profile, source="apple", external_id=external_id).delete()[0]
            continue
        if _upsert_event(profile, "apple", external_id, event.get("title"), event.get("startAt")):
            imported += 1
        else:
            skipped += 1
    connection, _ = CalendarConnection.objects.get_or_create(profile=profile, provider="apple")
    connection.connected = True
    connection.last_synced_at = timezone.now()
    connection.save(update_fields=["connected", "last_synced_at"])
    return {"provider": "apple", "imported": imported, "deleted": deleted, "skipped": skipped, "lastSyncedAt": connection.last_synced_at.isoformat()}

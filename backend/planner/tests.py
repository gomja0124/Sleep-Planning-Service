import json
from datetime import date, timedelta

from django.test import TestCase, override_settings

from .models import Schedule


@override_settings(ALLOW_DEMO_USER=True)
class PlannerApiIntegrationTests(TestCase):
    def json_request(self, method, path, data=None, **extra):
        return getattr(self.client, method)(
            path,
            data=json.dumps(data or {}),
            content_type="application/json",
            **extra,
        )

    def test_demo_session_creates_profile_and_exposes_cors(self):
        response = self.client.get("/api/v1/me/", HTTP_ORIGIN="http://localhost:4173")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["profile"]["targetWake"], "07:30")
        self.assertEqual(response.headers["access-control-allow-origin"], "http://localhost:4173")
        self.assertTrue(self.client.session.get("_auth_user_id"))

    def test_onboarding_schedule_and_recommendation_flow(self):
        profile_response = self.json_request("patch", "/api/v1/me/", {
            "selectedCharacter": "cat",
            "onboardingComplete": True,
            "targetWake": "07:30",
            "targetSleepMinutes": 480,
        })
        self.assertEqual(profile_response.status_code, 200)

        target = date.today() + timedelta(days=1)
        schedule_response = self.json_request("post", "/api/v1/schedules/", {
            "kind": "variable",
            "title": "아침 수업",
            "date": target.isoformat(),
            "startTime": "09:00",
            "preparationMinutes": 30,
            "commuteMinutes": 60,
        })
        self.assertEqual(schedule_response.status_code, 201)

        plans_response = self.client.get(f"/api/v1/plans/?start={target.isoformat()}&days=1")
        self.assertEqual(plans_response.status_code, 200)
        plan = plans_response.json()["results"][0]
        self.assertEqual(plan["wakeTime"], "07:30")
        self.assertEqual(plan["targetDate"], target.isoformat())
        self.assertTrue(plan["reasons"])

    def test_sleep_session_state_flow(self):
        target = (date.today() + timedelta(days=1)).isoformat()
        start_response = self.json_request("post", "/api/v1/sleep-sessions/", {"targetDate": target})
        self.assertEqual(start_response.status_code, 201)
        session = start_response.json()
        self.assertEqual(session["status"], "sleeping")

        checking_response = self.json_request("patch", f"/api/v1/sleep-sessions/{session['id']}/", {"status": "checking"})
        self.assertEqual(checking_response.status_code, 200)
        self.assertEqual(checking_response.json()["status"], "checking")
        self.assertIsNotNone(checking_response.json()["dismissedAt"])

    def test_invalid_schedule_returns_bad_request(self):
        response = self.json_request("post", "/api/v1/schedules/", {
            "kind": "variable",
            "title": "잘못된 일정",
            "date": "not-a-date",
            "startTime": "09:00",
        })

        self.assertEqual(response.status_code, 400)
        self.assertIn("detail", response.json())

    def test_apple_calendar_events_are_upserted_and_deleted(self):
        first_response = self.json_request("put", "/api/v1/calendars/apple/events/", {
            "events": [{
                "externalId": "apple-event-1",
                "title": "오전 세미나",
                "startAt": "2026-08-14T09:00:00+09:00",
            }, "invalid-event"],
            "deletedIds": [],
        })

        self.assertEqual(first_response.status_code, 200)
        self.assertEqual(first_response.json()["imported"], 1)
        self.assertEqual(first_response.json()["skipped"], 1)
        imported = Schedule.objects.get(source="apple", external_id="apple-event-1")
        self.assertEqual(imported.title, "오전 세미나")
        self.assertEqual(str(imported.start_time), "09:00:00")

        delete_response = self.json_request("put", "/api/v1/calendars/apple/events/", {
            "events": [],
            "deletedIds": ["apple-event-1"],
        })

        self.assertEqual(delete_response.status_code, 200)
        self.assertEqual(delete_response.json()["deleted"], 1)
        self.assertFalse(Schedule.objects.filter(source="apple", external_id="apple-event-1").exists())

    def test_google_calendar_sync_requires_google_authorization(self):
        response = self.json_request("post", "/api/v1/calendars/google/sync/", {"calendarId": "primary"})

        self.assertEqual(response.status_code, 409)
        self.assertIn("Google 로그인", response.json()["detail"])


@override_settings(ALLOW_DEMO_USER=False)
class PlannerAuthenticationTests(TestCase):
    def test_private_api_requires_login_outside_demo_mode(self):
        response = self.client.get("/api/v1/me/")

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["loginUrl"], "/auth/")

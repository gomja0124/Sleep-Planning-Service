import json
from datetime import date, timedelta
from unittest.mock import Mock, patch

from allauth.socialaccount.models import SocialAccount
from allauth.socialaccount.providers.base.constants import AuthProcess
from django.http import HttpResponseRedirect
from django.test import TestCase, override_settings

from .models import Profile, Schedule
from .services import recommendation
from .sleep_analysis import analyze_sleep_history, calculate_bedtime_range_minutes


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

    @override_settings(SOCIAL_LOGIN_CONFIGURED={"google": False, "apple": False}, FRONTEND_ORIGIN="http://localhost:4173")
    def test_google_calendar_oauth_reports_missing_configuration(self):
        self.client.get("/api/v1/me/")
        response = self.client.get("/auth/calendars/google/connect/")

        self.assertRedirects(
            response,
            "http://localhost:4173/?calendar=google-config-missing",
            fetch_redirect_response=False,
        )

    @override_settings(SOCIAL_LOGIN_CONFIGURED={"google": True, "apple": False}, FRONTEND_ORIGIN="http://localhost:4173")
    @patch("planner.views.get_social_adapter")
    def test_google_calendar_oauth_starts_account_connect_flow(self, adapter_factory):
        self.client.get("/api/v1/me/")
        provider = Mock()
        provider.redirect.return_value = HttpResponseRedirect("https://accounts.google.com/o/oauth2/v2/auth")
        adapter_factory.return_value.get_provider.return_value = provider

        response = self.client.get("/auth/calendars/google/connect/")

        self.assertEqual(response.status_code, 302)
        provider.redirect.assert_called_once_with(
            response.wsgi_request,
            process=AuthProcess.CONNECT,
            next_url="http://localhost:4173/?calendar=google-connected",
        )

    @override_settings(SOCIAL_LOGIN_CONFIGURED={"google": True, "apple": False})
    def test_profile_exposes_google_oauth_authorization_state(self):
        self.client.get("/api/v1/me/")
        profile = Profile.objects.get(user__username="demo-user")
        SocialAccount.objects.create(user=profile.user, provider="google", uid="google-user-1")

        google = self.client.get("/api/v1/me/").json()["calendarConnections"]["google"]

        self.assertTrue(google["authorized"])
        self.assertTrue(google["oauthConfigured"])
        self.assertEqual(google["oauthUrl"], "/auth/calendars/google/connect/")

    def test_calendar_sync_mode_is_saved_and_exposed(self):
        response = self.json_request("put", "/api/v1/calendars/apple/", {
            "connected": True,
            "syncMode": "auto",
        })

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["syncMode"], "auto")
        profile = self.client.get("/api/v1/me/").json()
        self.assertTrue(profile["calendarConnections"]["apple"]["connected"])
        self.assertEqual(profile["calendarConnections"]["apple"]["syncMode"], "auto")

    def test_automatic_sync_ignores_manual_connections(self):
        self.json_request("put", "/api/v1/calendars/google/", {
            "connected": True,
            "syncMode": "manual",
        })

        response = self.json_request("post", "/api/v1/calendars/sync/", {"mode": "auto"})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["results"], [])
        self.assertFalse(response.json()["appleDeviceSyncRequired"])

    def test_invalid_calendar_sync_mode_is_rejected(self):
        response = self.json_request("put", "/api/v1/calendars/apple/", {
            "connected": True,
            "syncMode": "sometimes",
        })

        self.assertEqual(response.status_code, 400)

    def test_feedback_drives_adaptive_target_and_persists_extra_signals(self):
        self.json_request("patch", "/api/v1/me/", {"targetSleepMinutes": 420})
        responses = []
        for day in (10, 11, 12):
            responses.append(self.json_request("post", "/api/v1/feedback/", {
                "date": f"2026-08-{day}",
                "actualSleep": "23:00",
                "actualWake": "06:00",
                "freshness": 2,
                "sleepiness": 4,
                "sleepOnsetDelayMinutes": 0,
                "napDurationMinutes": 35,
                "napReason": "졸려서",
            }))

        result = responses[-1].json()
        self.assertEqual(result["analysis"]["primaryState"], "LOW_CONDITION_DESPITE_DURATION")
        self.assertEqual(result["analysis"]["suggestedAdjustmentMinutes"], 30)
        profile = Profile.objects.get(user__username="demo-user")
        self.assertEqual(profile.target_sleep_minutes, 450)
        self.assertEqual(profile.adaptation_state["previousTargetSleepMinutes"], 420)
        latest = profile.feedback_entries.get(date="2026-08-12")
        self.assertEqual(latest.nap_duration_minutes, 35)
        self.assertEqual(latest.sleep_onset_delay_minutes, 0)
        self.assertIn("bedtimeWindowStart", latest.recommendation_snapshot)

        analysis_response = self.client.get("/api/v1/sleep-analysis/")
        self.assertEqual(analysis_response.status_code, 200)
        self.assertTrue(analysis_response.json()["requiresEvaluation"])

    @override_settings(SLEEP_RECORD_TEST_MODE=True)
    def test_local_test_record_mode_accumulates_same_requested_date(self):
        self.json_request("patch", "/api/v1/me/", {"targetSleepMinutes": 420})
        responses = []
        for _ in range(3):
            responses.append(self.json_request("post", "/api/v1/feedback/", {
                "date": "2026-08-12",
                "actualSleep": "23:00",
                "actualWake": "06:00",
                "freshness": 2,
                "sleepiness": 4,
                "sleepOnsetDelayMinutes": 0,
                "testRecordMode": True,
            }))

        self.assertEqual(
            list(Profile.objects.get(user__username="demo-user").feedback_entries.order_by("date").values_list("date", flat=True)),
            [date(2026, 8, 12), date(2026, 8, 13), date(2026, 8, 14)],
        )
        self.assertEqual(responses[-1].json()["analysis"]["recordCount"], 3)
        self.assertGreater(responses[-1].json()["analysis"]["suggestedAdjustmentMinutes"], 0)


class SleepAnalysisParityTests(TestCase):
    profile = {"targetSleepMinutes": 450}

    @staticmethod
    def entry(date, sleep="23:00", wake="06:30", freshness=3, sleepiness=3, **extra):
        return {"date": date, "actualSleep": sleep, "actualWake": wake, "freshness": freshness, "sleepiness": sleepiness, **extra}

    def test_midnight_duration_and_circular_bedtime_range(self):
        result = analyze_sleep_history(self.profile, [self.entry("2026-08-12", "23:50", "07:20")])
        self.assertEqual(result["records"][0]["sleepOpportunityMinutes"], 450)
        self.assertEqual(calculate_bedtime_range_minutes(["23:30", "00:00", "00:30"]), 60)

    def test_repeated_short_sleep_reaches_current_target_first(self):
        feedback = [self.entry(f"2026-08-{day}", "01:00", "07:00", 2, 4) for day in range(8, 13)]
        result = analyze_sleep_history(self.profile, feedback)
        self.assertEqual(result["primaryState"], "INSUFFICIENT_SLEEP")
        self.assertEqual(result["adjustmentStrategy"], "REACH_CURRENT_TARGET")
        self.assertEqual(result["suggestedAdjustmentMinutes"], 0)

    def test_low_condition_with_reached_target_explores_longer_sleep(self):
        feedback = [self.entry(f"2026-08-{day}", "23:00", "06:30", 2, 4) for day in range(8, 13)]
        result = analyze_sleep_history(self.profile, feedback)
        self.assertEqual(result["primaryState"], "LOW_CONDITION_DESPITE_DURATION")
        self.assertEqual(result["recommendedTargetSleepMinutes"], 480)
        self.assertEqual(result["suggestedAdjustmentMinutes"], 30)

    def test_stable_records_keep_current_plan(self):
        feedback = [self.entry(f"2026-08-{day}", freshness=4, sleepiness=2) for day in range(6, 13)]
        result = analyze_sleep_history(self.profile, feedback)
        self.assertEqual(result["primaryState"], "STABLE")
        self.assertEqual(result["recommendedAction"], "KEEP_CURRENT_PLAN")
        self.assertEqual(result["confidence"], "high")

    def test_candidate_target_waits_for_three_evaluation_records(self):
        feedback = [self.entry("2026-08-11", "23:00", "06:00", 2, 4), self.entry("2026-08-12", "23:00", "06:00", 2, 4)]
        result = analyze_sleep_history(
            {"targetSleepMinutes": 420},
            feedback,
            {"candidateTargetSleepMinutes": 420, "evaluationStartDate": "2026-08-10"},
        )
        self.assertTrue(result["requiresEvaluation"])
        self.assertEqual(result["suggestedAdjustmentMinutes"], 0)

    def test_coarse_fine_and_maximum_target_steps_match_model_contract(self):
        coarse = analyze_sleep_history(
            {"targetSleepMinutes": 360},
            [self.entry(f"2026-08-{day}", "23:00", "04:50", 3, 3, napDurationMinutes=40) for day in range(8, 13)],
        )
        fine = analyze_sleep_history(
            {"targetSleepMinutes": 480},
            [self.entry(f"2026-08-{day}", "22:00", "06:00", 2, 4) for day in range(8, 13)],
        )
        capped = analyze_sleep_history(
            {"targetSleepMinutes": 540},
            [self.entry(f"2026-08-{day}", "21:00", "06:00", 2, 4) for day in range(8, 13)],
        )
        self.assertEqual(coarse["suggestedAdjustmentMinutes"], 60)
        self.assertEqual(fine["suggestedAdjustmentMinutes"], 15)
        self.assertEqual(capped["suggestedAdjustmentMinutes"], 0)
        self.assertEqual(capped["recommendedTargetSleepMinutes"], 540)

    def test_final_model_uses_estimated_sleep_for_target_decisions(self):
        feedback = [self.entry(
            f"2026-08-{day}", "23:00", "07:00", 2, 4,
            sleepOnsetDelayMinutes=75,
        ) for day in range(10, 13)]
        result = analyze_sleep_history(self.profile, feedback)

        self.assertEqual(result["averageSleepOpportunityMinutes"], 480)
        self.assertEqual(result["averageEstimatedSleepMinutes"], 405)
        self.assertEqual(result["averageDecisionSleepMinutes"], 405)
        self.assertEqual(result["adjustmentStrategy"], "REACH_CURRENT_TARGET")

    def test_final_model_preserves_targets_above_exploration_cap(self):
        feedback = [self.entry(f"2026-08-{day}", "22:00", "08:00", 4, 2) for day in range(8, 13)]
        result = analyze_sleep_history({"targetSleepMinutes": 600}, feedback)

        self.assertEqual(result["recommendedTargetSleepMinutes"], 600)

    def test_final_model_corrects_repeated_execution_and_onset_delay(self):
        late = [self.entry(
            f"2026-08-{day}", "00:00", "07:30",
            recommendationSnapshot={"bedtimeWindowStart": "23:00", "bedtimeWindowEnd": "23:30"},
        ) for day in range(10, 13)]
        onset = [self.entry(
            f"2026-08-{day}", "23:15", "07:30",
            sleepOnsetDelayMinutes=45,
            recommendationSnapshot={"bedtimeWindowStart": "23:00", "bedtimeWindowEnd": "23:30"},
        ) for day in range(10, 13)]

        late_result = analyze_sleep_history(self.profile, late)
        onset_result = analyze_sleep_history(self.profile, onset)
        self.assertTrue(late_result["repeatedLateExecution"])
        self.assertEqual(late_result["recommendedBedtimeOffsetMinutes"], 30)
        self.assertTrue(onset_result["repeatedSleepOnsetDifficulty"])
        self.assertEqual(onset_result["recommendedBedtimeOffsetMinutes"], -30)

    def test_final_model_bedtime_offset_is_applied_to_server_plan(self):
        profile = Profile.objects.create(external_id="final-model-plan")
        profile.refresh_from_db()
        result = recommendation(profile, date(2026, 8, 21), {
            "recommendedBedtimeOffsetMinutes": -30,
            "reasons": [],
        })

        self.assertEqual(result["modelBedtimeOffsetMinutes"], -30)
        self.assertEqual(result["totalBedtimeOffsetMinutes"], -30)
        self.assertEqual(result["bedtimeCenter"], "23:05")


@override_settings(ALLOW_DEMO_USER=False)
class PlannerAuthenticationTests(TestCase):
    def json_request(self, method, path, data=None):
        return getattr(self.client, method)(
            path,
            data=json.dumps(data or {}),
            content_type="application/json",
        )

    def test_private_api_requires_login_outside_demo_mode(self):
        response = self.client.get("/api/v1/me/")

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["loginUrl"], "/auth/")

    def test_email_signup_logout_and_login_flow(self):
        anonymous = self.client.get("/api/v1/auth/status/")
        self.assertFalse(anonymous.json()["authenticated"])

        signup = self.json_request("post", "/api/v1/auth/signup/", {
            "name": "소미",
            "email": "somni@example.com",
            "password": "safe-password-123",
        })
        self.assertEqual(signup.status_code, 201)
        self.assertTrue(signup.json()["authenticated"])
        self.assertEqual(signup.json()["profile"]["profile"]["name"], "소미")
        self.assertFalse(signup.json()["profile"]["onboardingComplete"])

        logout_response = self.json_request("post", "/api/v1/auth/logout/")
        self.assertEqual(logout_response.status_code, 200)
        self.assertEqual(self.client.get("/api/v1/me/").status_code, 401)

        login_response = self.json_request("post", "/api/v1/auth/login/", {
            "email": "SOMNI@example.com",
            "password": "safe-password-123",
        })
        self.assertEqual(login_response.status_code, 200)
        self.assertTrue(login_response.json()["authenticated"])

    def test_signup_rejects_short_password_and_duplicate_email(self):
        short = self.json_request("post", "/api/v1/auth/signup/", {
            "email": "short@example.com",
            "password": "short",
        })
        self.assertEqual(short.status_code, 400)

        payload = {"email": "duplicate@example.com", "password": "safe-password-123"}
        self.assertEqual(self.json_request("post", "/api/v1/auth/signup/", payload).status_code, 201)
        self.json_request("post", "/api/v1/auth/logout/")
        duplicate = self.json_request("post", "/api/v1/auth/signup/", payload)
        self.assertEqual(duplicate.status_code, 409)

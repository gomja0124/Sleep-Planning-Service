from datetime import date, datetime, time, timedelta

from .models import PlanOverride, Schedule
from .sleep_analysis import analyze_sleep_history

STEP_MINUTES = 5


def _minutes(value):
    return value.hour * 60 + value.minute


def _time(value):
    value %= 24 * 60
    return time(value // 60, value % 60)


def time_string(value):
    return value.strftime("%H:%M")


def duration_text(minutes):
    hours, minutes = divmod(max(0, minutes), 60)
    if not hours:
        return f"{minutes}분"
    if not minutes:
        return f"{hours}시간"
    return f"{hours}시간 {minutes}분"


def schedules_for(profile, target_date):
    weekday = (target_date.weekday() + 1) % 7  # Django 월요일=0 -> JavaScript 일요일=0
    result = []
    for schedule in Schedule.objects.filter(profile=profile):
        if schedule.kind == "variable" and schedule.date == target_date:
            result.append(schedule)
        elif schedule.kind == "fixed" and weekday in schedule.days:
            result.append(schedule)
    return sorted(result, key=lambda item: item.start_time)


def recommendation(profile, target_date, analysis=None):
    day_schedules = schedules_for(profile, target_date)
    target_wake = _minutes(profile.target_wake)
    constraints = []
    for schedule in day_schedules:
        required_wake = _minutes(schedule.start_time) - schedule.preparation_minutes - schedule.commute_minutes
        constraints.append((required_wake, schedule))
    strongest = min(constraints, key=lambda entry: entry[0], default=None)
    wake_minutes = strongest[0] if strongest and strongest[0] < target_wake else target_wake
    base_sleep = min(max(profile.target_sleep_minutes, 300), 600)
    sleep_minutes = base_sleep
    bedtime = round((wake_minutes - sleep_minutes - profile.latency_minutes) / STEP_MINUTES) * STEP_MINUTES
    start, end = bedtime - 15, bedtime + 15
    reasons = []
    if strongest and strongest[0] < target_wake:
        _, schedule = strongest
        reasons.append(f"{time_string(schedule.start_time)} {schedule.title} 전 {duration_text(schedule.commute_minutes)} 통학과 {duration_text(schedule.preparation_minutes)} 준비가 필요해 {time_string(_time(wake_minutes))} 기상으로 계산했어요.")
    elif strongest:
        reasons.append(f"첫 일정은 {time_string(strongest[1].start_time)} {strongest[1].title}이지만 희망 기상 시각 {time_string(profile.target_wake)}을 유지했어요.")
    else:
        reasons.append(f"이른 일정이 없어 희망 기상 시각 {time_string(profile.target_wake)}을 기준으로 계산했어요.")
    reasons.append(f"목표 수면 {duration_text(base_sleep)}과 평균 입면 {duration_text(profile.latency_minutes)}을 반영했어요.")
    analysis = analysis or analyze_sleep_history(profile)
    if analysis["reasons"]:
        reasons.append(analysis["reasons"][0]["message"])
    override = PlanOverride.objects.filter(profile=profile, target_date=target_date).first()
    user_offset = max(-120, min(120, override.offset_minutes if override else 0))
    model_offset = int(analysis.get("recommendedBedtimeOffsetMinutes") or 0)
    offset = max(-120, min(120, user_offset + model_offset))
    shift = lambda value: time_string(_time(value + offset))
    return {
        "targetDate": target_date.isoformat(), "wakeTime": time_string(_time(wake_minutes)),
        "bedtimeWindowStart": shift(start), "bedtimeWindowEnd": shift(end), "bedtimeCenter": shift(bedtime),
        "routineStart": shift(start - profile.routine_minutes), "sleepMinutes": max(0, sleep_minutes - offset),
        "baseSleepMinutes": base_sleep, "feedbackAdjustmentMinutes": 0,
        "userOffsetMinutes": user_offset, "modelBedtimeOffsetMinutes": model_offset,
        "totalBedtimeOffsetMinutes": offset, "saved": bool(override and override.saved), "reasons": reasons,
        "primaryScheduleId": strongest[1].id if strongest else None,
        "alerts": [{"type": "routine", "label": "취침 준비", "time": shift(start - profile.routine_minutes)}, {"type": "lights-out", "label": "불 끄기", "time": shift(start)}, {"type": "wake", "label": "기상", "time": time_string(_time(wake_minutes))}],
    }


def date_from_string(value):
    return datetime.strptime(value, "%Y-%m-%d").date()

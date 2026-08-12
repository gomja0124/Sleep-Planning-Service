from datetime import date, datetime, time, timedelta

from .models import Feedback, PlanOverride, Schedule

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


def feedback_adjustment(profile):
    entries = Feedback.objects.filter(profile=profile).order_by("-date")[:3]
    entries = list(entries)
    if not entries:
        return 0, None
    freshness = sum(item.freshness for item in entries) / len(entries)
    sleepiness = sum(item.sleepiness for item in entries) / len(entries)
    if freshness <= 2 and sleepiness >= 4:
        return 30, "최근 아침 컨디션과 낮 졸림을 반영해 수면 여유를 30분 늘렸어요."
    if freshness < 3 or sleepiness > 3:
        return 15, "최근 컨디션 피드백을 반영해 수면 여유를 15분 늘렸어요."
    return 0, "최근 컨디션이 안정적이라 현재 목표 수면 시간을 유지해요."


def schedules_for(profile, target_date):
    weekday = (target_date.weekday() + 1) % 7  # Django 월요일=0 -> JavaScript 일요일=0
    result = []
    for schedule in Schedule.objects.filter(profile=profile):
        if schedule.kind == "variable" and schedule.date == target_date:
            result.append(schedule)
        elif schedule.kind == "fixed" and weekday in schedule.days:
            result.append(schedule)
    return sorted(result, key=lambda item: item.start_time)


def recommendation(profile, target_date):
    day_schedules = schedules_for(profile, target_date)
    target_wake = _minutes(profile.target_wake)
    constraints = []
    for schedule in day_schedules:
        required_wake = _minutes(schedule.start_time) - schedule.preparation_minutes - schedule.commute_minutes
        constraints.append((required_wake, schedule))
    strongest = min(constraints, key=lambda entry: entry[0], default=None)
    wake_minutes = strongest[0] if strongest and strongest[0] < target_wake else target_wake
    adjustment, adjustment_reason = feedback_adjustment(profile)
    base_sleep = min(max(profile.target_sleep_minutes, 300), 600)
    sleep_minutes = base_sleep + adjustment
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
    if adjustment_reason:
        reasons.append(adjustment_reason)
    override = PlanOverride.objects.filter(profile=profile, target_date=target_date).first()
    offset = max(-120, min(120, override.offset_minutes if override else 0))
    shift = lambda value: time_string(_time(value + offset))
    return {
        "targetDate": target_date.isoformat(), "wakeTime": time_string(_time(wake_minutes)),
        "bedtimeWindowStart": shift(start), "bedtimeWindowEnd": shift(end), "bedtimeCenter": shift(bedtime),
        "routineStart": shift(start - profile.routine_minutes), "sleepMinutes": max(0, sleep_minutes - offset),
        "baseSleepMinutes": base_sleep, "feedbackAdjustmentMinutes": adjustment,
        "userOffsetMinutes": offset, "saved": bool(override and override.saved), "reasons": reasons,
        "primaryScheduleId": strongest[1].id if strongest else None,
        "alerts": [{"type": "routine", "label": "취침 준비", "time": shift(start - profile.routine_minutes)}, {"type": "lights-out", "label": "불 끄기", "time": shift(start)}, {"type": "wake", "label": "기상", "time": time_string(_time(wake_minutes))}],
    }


def date_from_string(value):
    return datetime.strptime(value, "%Y-%m-%d").date()

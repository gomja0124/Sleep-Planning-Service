from math import isfinite
from statistics import mean, median


MINUTES_IN_DAY = 24 * 60
DEFAULT_TARGET_SLEEP_MINUTES = 450
ANALYSIS_WINDOW_SIZE = 7
RULE_WINDOW_SIZE = 5
CURRENT_TARGET_GAP_MINUTES = 30
MODERATE_NAP_THRESHOLD_MINUTES = 30
COARSE_TARGET_THRESHOLD = 420
FINE_TARGET_THRESHOLD = 480
MAX_EXPLORATION_TARGET = 540
LATE_EXECUTION_THRESHOLD_MINUTES = 15
REPEATED_EXECUTION_COUNT = 3
ONSET_DIFFICULTY_THRESHOLD_MINUTES = 30
PRIMARY_STATE_PRIORITY = [
    "INSUFFICIENT_SLEEP",
    "LOW_CONDITION_DESPITE_DURATION",
    "IRREGULAR_TIMING",
    "STABLE",
    "NO_CLEAR_PATTERN",
]


def _number(value, *, positive=False):
    if value in (None, ""):
        return None
    try:
        result = float(value)
    except (TypeError, ValueError):
        return None
    if not isfinite(result):
        return None
    if positive and result < 0:
        return None
    return result


def _clock(value):
    if hasattr(value, "hour"):
        return value.hour * 60 + value.minute
    if not isinstance(value, str):
        return None
    parts = value.split(":")
    if len(parts) != 2 or not all(part.isdigit() for part in parts):
        return None
    hour, minute = map(int, parts)
    if hour > 23 or minute > 59:
        return None
    return hour * 60 + minute


def _time_string(value):
    if hasattr(value, "strftime"):
        return value.strftime("%H:%M")
    return value


def _date_string(value):
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value or "")


def _entry_value(entry, snake, camel=None, default=None):
    if isinstance(entry, dict):
        if camel and camel in entry:
            return entry[camel]
        return entry.get(snake, default)
    return getattr(entry, snake, default)


def _execution_offset(actual_time, snapshot):
    if not isinstance(snapshot, dict):
        return None
    actual = _clock(actual_time)
    start = _clock(snapshot.get("bedtimeWindowStart"))
    end = _clock(snapshot.get("bedtimeWindowEnd"))
    if actual is None or start is None or end is None:
        return None
    window_length = (end - start + MINUTES_IN_DAY) % MINUTES_IN_DAY
    actual_from_start = (actual - start + MINUTES_IN_DAY) % MINUTES_IN_DAY
    if actual_from_start <= window_length:
        return 0
    if actual_from_start - window_length <= MINUTES_IN_DAY / 2:
        return actual_from_start - window_length
    return actual_from_start - MINUTES_IN_DAY


def _normalize(entry, index, target):
    actual_sleep = _time_string(_entry_value(entry, "actual_sleep", "actualSleep"))
    actual_wake = _time_string(_entry_value(entry, "actual_wake", "actualWake"))
    sleep = _clock(actual_sleep)
    wake = _clock(actual_wake)
    if sleep is None or wake is None or sleep == wake:
        return None
    opportunity = wake + (MINUTES_IN_DAY if wake < sleep else 0) - sleep
    onset = _number(_entry_value(entry, "sleep_onset_delay_minutes", "sleepOnsetDelayMinutes"), positive=True)
    estimated = opportunity if onset is None else max(0, opportunity - onset)
    freshness = _number(_entry_value(entry, "freshness"))
    sleepiness = _number(_entry_value(entry, "sleepiness"))
    nap_duration = _number(_entry_value(entry, "nap_duration_minutes", "napDurationMinutes"), positive=True)
    nap_reason = str(_entry_value(entry, "nap_reason", "napReason", "") or "").strip()
    failure_reason = str(_entry_value(entry, "failure_reason", "failureReason", "") or "").strip()
    snapshot = _entry_value(entry, "recommendation_snapshot", "recommendationSnapshot")
    snapshot = dict(snapshot) if isinstance(snapshot, dict) else None
    raw_deficit = target - estimated
    return {
        "index": index,
        "date": _date_string(_entry_value(entry, "date")),
        "actualSleep": actual_sleep,
        "actualWake": actual_wake,
        "sleepOpportunityMinutes": opportunity,
        "sleepOnsetDelayMinutes": onset,
        "estimatedSleepMinutes": estimated,
        "executionOffsetMinutes": _execution_offset(actual_sleep, snapshot),
        "recommendationSnapshot": snapshot,
        "rawSleepDeficitMinutes": raw_deficit,
        "sleepDeficitMinutes": max(0, raw_deficit),
        "freshness": freshness,
        "sleepiness": sleepiness,
        "napDurationMinutes": nap_duration,
        "napReason": nap_reason,
        "failureReason": failure_reason,
    }


def calculate_bedtime_range_minutes(times):
    values = sorted(value for value in (_clock(item) for item in times) if value is not None)
    if len(values) < 2:
        return 0 if values else None
    gaps = []
    for index, current in enumerate(values):
        next_value = values[(index + 1) % len(values)]
        gaps.append(next_value + (MINUTES_IN_DAY if index == len(values) - 1 else 0) - current)
    return MINUTES_IN_DAY - max(gaps)


def _average(records, key):
    values = [record[key] for record in records if record[key] is not None]
    return round(mean(values), 1) if values else None


def _condition_signal(record):
    freshness, sleepiness = record["freshness"], record["sleepiness"]
    strong = (freshness is not None and freshness <= 2) or (sleepiness is not None and sleepiness >= 4)
    nap_reason_supports = not record["napReason"] or record["napReason"] in {"졸려서", "전날 잠이 부족해서"}
    moderate = nap_reason_supports and record["napDurationMinutes"] is not None and record["napDurationMinutes"] >= MODERATE_NAP_THRESHOLD_MINUTES and ((freshness == 3) or (sleepiness == 3))
    return strong or moderate


def _adaptive_adjustment(target):
    if target < 390:
        return 60, "COARSE"
    if target < COARSE_TARGET_THRESHOLD:
        return 30, "COARSE"
    if target < FINE_TARGET_THRESHOLD:
        return 30, "FINE"
    if target < MAX_EXPLORATION_TARGET:
        return 15, "FINE"
    return 0, "OBSERVE"


def _reason(code, value, message):
    return {"code": code, "value": value, "message": message}


def analyze_sleep_history(profile, feedback=None, adaptation_state=None):
    target = int(_number(_entry_value(profile, "target_sleep_minutes", "targetSleepMinutes")) or DEFAULT_TARGET_SLEEP_MINUTES)
    source = list(feedback if feedback is not None else getattr(profile, "feedback_entries").all())
    normalized = [_normalize(entry, index, target) for index, entry in enumerate(source)]
    valid = sorted((item for item in normalized if item), key=lambda item: (item["date"], -item["index"]), reverse=True)
    records = valid[:ANALYSIS_WINDOW_SIZE]
    rules = valid[:RULE_WINDOW_SIZE]
    state = adaptation_state if adaptation_state is not None else _entry_value(profile, "adaptation_state", default={}) or {}
    candidate = _number(state.get("candidateTargetSleepMinutes"))
    evaluation_start = str(state.get("evaluationStartDate") or "")
    evaluation_records = [item for item in valid if candidate == target and evaluation_start and item["date"] >= evaluation_start]
    evaluation_pending = candidate == target and bool(evaluation_start) and len(evaluation_records) < 3

    avg_opportunity = _average(records, "sleepOpportunityMinutes")
    avg_estimated = _average(records, "estimatedSleepMinutes")
    avg_last5 = _average(rules, "estimatedSleepMinutes")
    avg_deficit = _average(records, "sleepDeficitMinutes")
    avg_freshness = _average(records, "freshness")
    avg_sleepiness = _average(records, "sleepiness")
    bedtime_range = calculate_bedtime_range_minutes([item["actualSleep"] for item in records])
    insufficient = sum(item["sleepDeficitMinutes"] >= 30 and _condition_signal(item) for item in rules)
    low_condition = sum(item["estimatedSleepMinutes"] >= target - 15 and _condition_signal(item) for item in rules)
    needs_more = sum(_condition_signal(item) for item in rules)
    execution_offsets = [item["executionOffsetMinutes"] for item in rules]
    late_offsets = [value for value in execution_offsets if value is not None and value >= LATE_EXECUTION_THRESHOLD_MINUTES]
    early_offsets = [value for value in execution_offsets if value is not None and value <= -LATE_EXECUTION_THRESHOLD_MINUTES]
    avg_late = round(mean(late_offsets), 1) if late_offsets else None
    avg_early = round(mean(abs(value) for value in early_offsets), 1) if early_offsets else None
    onset_delays = [item["sleepOnsetDelayMinutes"] for item in rules if item["sleepOnsetDelayMinutes"] is not None and item["sleepOnsetDelayMinutes"] >= ONSET_DIFFICULTY_THRESHOLD_MINUTES]
    avg_onset = _average(rules, "sleepOnsetDelayMinutes")
    repeated_late = len(late_offsets) >= REPEATED_EXECUTION_COUNT
    repeated_early = len(early_offsets) >= REPEATED_EXECUTION_COUNT
    repeated_onset = len(onset_delays) >= REPEATED_EXECUTION_COUNT
    execution_correction = min(30, max(15, round((avg_late or 15) / 15) * 15)) if repeated_late else (-min(30, max(15, round((avg_early or 15) / 15) * 15)) if repeated_early else 0)
    onset_correction = -min(30, max(15, round((avg_onset or 30) / 30) * 15)) if repeated_onset else 0
    bedtime_offset = max(-30, min(30, execution_correction + onset_correction))

    matched = []
    if len(records) < 3:
        matched.append("INSUFFICIENT_DATA")
    else:
        if insufficient >= 3:
            matched.append("INSUFFICIENT_SLEEP")
        if low_condition >= 3:
            matched.append("LOW_CONDITION_DESPITE_DURATION")
        if len(rules) >= 3 and bedtime_range is not None and bedtime_range > 90:
            matched.append("IRREGULAR_TIMING")
        stable = all(value is not None for value in (avg_freshness, avg_sleepiness, avg_deficit, bedtime_range)) and avg_freshness >= 4 and avg_sleepiness <= 2 and avg_deficit < 30 and bedtime_range <= 90
        if stable:
            matched.append("STABLE")
        if not matched:
            matched.append("NO_CLEAR_PATTERN")

    primary = "INSUFFICIENT_DATA" if "INSUFFICIENT_DATA" in matched else next((item for item in PRIMARY_STATE_PRIORITY if item in matched), "NO_CLEAR_PATTERN")
    current_not_reached = avg_last5 is not None and avg_last5 < target - CURRENT_TARGET_GAP_MINUTES
    can_explore = len(records) >= 3 and needs_more >= 3 and not current_not_reached and avg_last5 is not None and avg_last5 >= target - CURRENT_TARGET_GAP_MINUTES
    adjustment = 0
    phase = "OBSERVE"
    strategy = "OBSERVE_OTHER_FACTORS"
    action = "KEEP_COLLECTING_DATA"
    if evaluation_pending:
        strategy, action = "KEEP_CURRENT_TARGET", "KEEP_CURRENT_PLAN"
    elif primary == "STABLE":
        phase, strategy, action = "MAINTENANCE", "KEEP_CURRENT_TARGET", "KEEP_CURRENT_PLAN"
    elif primary == "INSUFFICIENT_SLEEP" and current_not_reached:
        phase, strategy, action = "MAINTENANCE", "REACH_CURRENT_TARGET", "REACH_CURRENT_TARGET"
    elif primary in {"INSUFFICIENT_SLEEP", "LOW_CONDITION_DESPITE_DURATION"} and can_explore:
        adjustment, phase = _adaptive_adjustment(target)
        strategy = "EXPLORE_LONGER_TARGET" if adjustment else "OBSERVE_OTHER_FACTORS"
        action = "EXTEND_SLEEP_OPPORTUNITY" if adjustment else "OBSERVE_SLEEP_QUALITY_PATTERN"
    elif primary == "LOW_CONDITION_DESPITE_DURATION":
        action = "OBSERVE_SLEEP_QUALITY_PATTERN"
    elif primary == "IRREGULAR_TIMING":
        strategy, action = "KEEP_CURRENT_TARGET", "STABILIZE_SLEEP_TIMING"

    reasons = []
    if primary == "INSUFFICIENT_DATA":
        reasons.append(_reason("INSUFFICIENT_DATA", len(records), "유효한 수면 기록이 3개 미만이라 패턴 판단을 보류해요."))
    if "INSUFFICIENT_SLEEP" in matched:
        reasons.append(_reason("REPEATED_SLEEP_DEFICIT", insufficient, f"최근 5회 중 {insufficient}회에서 목표보다 30분 이상 수면이 부족했어요."))
    if strategy == "REACH_CURRENT_TARGET":
        reasons.append(_reason("CURRENT_TARGET_NOT_REACHED", None if avg_last5 is None else target - avg_last5, "목표를 더 늘리기보다 현재 목표 수면을 먼저 확보해요."))
    if strategy == "EXPLORE_LONGER_TARGET":
        reasons.append(_reason("TARGET_EXPLORATION", adjustment, f"목표 수면을 확보해도 컨디션 저하가 반복돼 {adjustment}분 늘려 탐색해요."))
    if "LOW_CONDITION_DESPITE_DURATION" in matched:
        reasons.append(_reason("LOW_CONDITION_DESPITE_DURATION", low_condition, f"최근 5회 중 {low_condition}회에서 수면 시간을 확보했지만 컨디션이 낮았어요."))
    if "IRREGULAR_TIMING" in matched:
        reasons.append(_reason("IRREGULAR_BEDTIME", bedtime_range, f"최근 취침 시각의 범위가 약 {bedtime_range}분이에요."))
    if "STABLE" in matched:
        reasons.append(_reason("STABLE_PATTERN", None, "최근 수면 시간과 컨디션, 취침 시각이 안정적이에요."))
    if "NO_CLEAR_PATTERN" in matched:
        reasons.append(_reason("NO_CLEAR_PATTERN", None, "현재 기록만으로는 뚜렷한 패턴을 판단하기 어려워요."))

    failure_counts = {}
    for item in records:
        if item["failureReason"]:
            failure_counts[item["failureReason"]] = failure_counts.get(item["failureReason"], 0) + 1
    dominant = max(failure_counts, key=failure_counts.get, default=None)
    confidence = "insufficient" if len(records) <= 2 else "low" if len(records) <= 4 else "medium" if len(records) <= 6 else "high"
    return {
        "analysisWindowSize": ANALYSIS_WINDOW_SIZE,
        "ruleWindowSize": RULE_WINDOW_SIZE,
        "recordCount": len(records),
        "invalidRecordCount": len(normalized) - len(valid),
        "currentTargetSleepMinutes": target,
        "recommendedTargetSleepMinutes": target if target >= MAX_EXPLORATION_TARGET else min(MAX_EXPLORATION_TARGET, max(target, target + adjustment)),
        "suggestedAdjustmentMinutes": adjustment,
        "adjustmentPhase": phase,
        "adjustmentStrategy": strategy,
        "primaryState": primary,
        "matchedStates": matched,
        "recommendedAction": action,
        "averageSleepOpportunityMinutes": avg_opportunity,
        "averageEstimatedSleepMinutes": avg_estimated,
        "averageDecisionSleepMinutes": avg_last5,
        "medianSleepOpportunityMinutes": round(median([item["sleepOpportunityMinutes"] for item in records]), 1) if records else None,
        "averageSleepDeficitMinutes": avg_deficit,
        "averageLateExecutionMinutes": avg_late,
        "averageEarlyExecutionMinutes": avg_early,
        "averageSleepOnsetDelayMinutes": avg_onset,
        "repeatedLateExecution": repeated_late,
        "repeatedEarlyExecution": repeated_early,
        "repeatedSleepOnsetDifficulty": repeated_onset,
        "recommendedBedtimeOffsetMinutes": bedtime_offset,
        "averageFreshness": avg_freshness,
        "averageSleepiness": avg_sleepiness,
        "bedtimeRangeMinutes": bedtime_range,
        "bedtimeRegularity": None if bedtime_range is None else "stable" if bedtime_range <= 30 else "moderate" if bedtime_range <= 90 else "irregular",
        "dominantFailureReason": dominant,
        "evaluationRecordCount": len(evaluation_records),
        "minimumEvaluationRecords": 3,
        "requiresEvaluation": evaluation_pending,
        "canAdjustAgain": not evaluation_pending,
        "counts": {
            "insufficientSleepCountLast5": insufficient,
            "lowConditionDespiteDurationCountLast5": low_condition,
            "needsMoreSleepCountLast5": needs_more,
            "napCountLast5": sum(item["napDurationMinutes"] is not None and item["napDurationMinutes"] >= MODERATE_NAP_THRESHOLD_MINUTES for item in rules),
            "lateExecutionCountLast5": len(late_offsets),
            "earlyExecutionCountLast5": len(early_offsets),
            "sleepOnsetDifficultyCountLast5": len(onset_delays),
        },
        "confidence": confidence,
        "reasons": reasons,
        "records": [{
            **{key: item[key] for key in ("date", "actualSleep", "actualWake", "sleepOpportunityMinutes", "sleepOnsetDelayMinutes", "estimatedSleepMinutes", "executionOffsetMinutes", "recommendationSnapshot", "rawSleepDeficitMinutes", "sleepDeficitMinutes")},
            "subjective": {key: item[key] for key in ("freshness", "sleepiness", "failureReason", "napDurationMinutes", "napReason")},
        } for item in records],
    }

const MINUTES_IN_DAY = 24 * 60;
const DEFAULT_TARGET_SLEEP_MINUTES = 450;
const ANALYSIS_WINDOW_SIZE = 7;
const RULE_WINDOW_SIZE = 5;
// These are MVP exploration heuristics, not medical sleep recommendations.
const CURRENT_TARGET_GAP_MINUTES = 30;
const MODERATE_NAP_THRESHOLD_MINUTES = 30;
const COARSE_TARGET_THRESHOLD = 420;
const FINE_TARGET_THRESHOLD = 480;
const MAX_EXPLORATION_TARGET = 540;
const LATE_EXECUTION_THRESHOLD_MINUTES = 15;
const REPEATED_EXECUTION_COUNT = 3;
const ONSET_DIFFICULTY_THRESHOLD_MINUTES = 30;

const PRIMARY_STATE_PRIORITY = [
  "INSUFFICIENT_SLEEP",
  "LOW_CONDITION_DESPITE_DURATION",
  "IRREGULAR_TIMING",
  "STABLE",
  "NO_CLEAR_PATTERN",
];

// REPEATED_LATE_EXECUTION: recommendationSnapshot이 있는 최근 기록을 기준으로
// 실제 취침이 권장 구간에서 반복적으로 벗어나면 취침 시각을 15~30분 보정한다.
// TODO(REPEATED_SLEEP_ONSET_DIFFICULTY): sleepOnsetDifficulty(1|2|3)가
// 외부 schema에 추가되기 전까지 failureReason을 이 Rule의 대체값으로 사용하지 않는다.
// TODO(SCHEDULE_CONFLICT): 일정으로 수면 확보 가능 여부는 sleep history 분석이
// 아니라 planner의 책임이므로 이 모듈에서는 판단하지 않는다.

function toFiniteNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function positiveFiniteNumber(value) {
  const number = toFiniteNumber(value);
  return number !== null && number >= 0 ? number : null;
}

function parseClock(value) {
  if (typeof value !== "string" || !/^\d{2}:\d{2}$/.test(value)) return null;

  const [hours, minutes] = value.split(":").map(Number);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function signedExecutionOffsetMinutes(actualTime, snapshot = {}) {
  const actual = parseClock(actualTime);
  const start = parseClock(snapshot?.bedtimeWindowStart);
  const end = parseClock(snapshot?.bedtimeWindowEnd);
  if (actual === null || start === null || end === null) return null;

  const windowLength = (end - start + MINUTES_IN_DAY) % MINUTES_IN_DAY;
  const actualFromStart = (actual - start + MINUTES_IN_DAY) % MINUTES_IN_DAY;
  if (actualFromStart <= windowLength) return 0;
  if (actualFromStart - windowLength <= MINUTES_IN_DAY / 2) {
    return actualFromStart - windowLength;
  }
  return actualFromStart - MINUTES_IN_DAY;
}

function roundMetric(value, digits = 1) {
  if (value === null || value === undefined) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function average(values) {
  const numbers = values.map(toFiniteNumber).filter((value) => value !== null);
  if (!numbers.length) return null;
  return roundMetric(numbers.reduce((sum, value) => sum + value, 0) / numbers.length);
}

function median(values) {
  const numbers = values
    .map(toFiniteNumber)
    .filter((value) => value !== null)
    .sort((left, right) => left - right);
  if (!numbers.length) return null;

  const middle = Math.floor(numbers.length / 2);
  const result = numbers.length % 2
    ? numbers[middle]
    : (numbers[middle - 1] + numbers[middle]) / 2;
  return roundMetric(result);
}

function dateSortValue(value) {
  return String(value ?? "");
}

function normalizeFeedbackEntry(entry, originalIndex) {
  if (!entry || typeof entry !== "object") {
    return { valid: false, originalIndex, reason: "invalid-entry" };
  }

  const sleepMinutes = parseClock(entry.actualSleep);
  const wakeMinutes = parseClock(entry.actualWake);
  if (sleepMinutes === null || wakeMinutes === null) {
    return { valid: false, originalIndex, reason: "invalid-time" };
  }
  if (sleepMinutes === wakeMinutes) {
    return { valid: false, originalIndex, reason: "same-time" };
  }

  const sleepOpportunityMinutes = wakeMinutes < sleepMinutes
    ? wakeMinutes + MINUTES_IN_DAY - sleepMinutes
    : wakeMinutes - sleepMinutes;
  const freshness = toFiniteNumber(entry.freshness);
  const sleepiness = toFiniteNumber(entry.sleepiness);
  const napDurationMinutes = positiveFiniteNumber(entry.napDurationMinutes);
  const napReason = String(entry.napReason ?? "").trim();
  const sleepOnsetDelayMinutes = positiveFiniteNumber(entry.sleepOnsetDelayMinutes);
  const estimatedSleepMinutes = sleepOnsetDelayMinutes === null
    ? sleepOpportunityMinutes
    : Math.max(0, sleepOpportunityMinutes - sleepOnsetDelayMinutes);

  return {
    valid: true,
    originalIndex,
    date: entry.date,
    actualSleep: entry.actualSleep,
    actualWake: entry.actualWake,
    recommendationSnapshot: entry.recommendationSnapshot
      && typeof entry.recommendationSnapshot === "object"
      ? { ...entry.recommendationSnapshot }
      : null,
    behavior: {
      lightsOutTime: entry.actualSleep,
      wakeTime: entry.actualWake,
      sleepOpportunityMinutes,
      sleepOnsetDelayMinutes,
      estimatedSleepMinutes,
    },
    subjective: {
      freshness,
      sleepiness,
      failureReason: entry.failureReason ?? "",
      napDurationMinutes,
      napReason,
    },
    sleepOpportunityMinutes,
    sleepOnsetDelayMinutes,
    estimatedSleepMinutes,
    executionOffsetMinutes: signedExecutionOffsetMinutes(
      entry.actualSleep,
      entry.recommendationSnapshot,
    ),
    rawSleepDeficitMinutes: null,
    sleepDeficitMinutes: null,
  };
}

function normalizeAndSortFeedback(feedback, targetSleepMinutes) {
  const normalized = (Array.isArray(feedback) ? feedback : [])
    .map((entry, originalIndex) => normalizeFeedbackEntry(entry, originalIndex));

  normalized.forEach((record) => {
    if (!record.valid) return;
    const rawSleepDeficitMinutes = targetSleepMinutes - record.estimatedSleepMinutes;
    record.targetSleepMinutes = targetSleepMinutes;
    record.rawSleepDeficitMinutes = rawSleepDeficitMinutes;
    record.sleepDeficitMinutes = Math.max(0, rawSleepDeficitMinutes);
  });

  const validRecords = normalized
    .filter((record) => record.valid)
    .sort((left, right) => {
      const dateDifference = dateSortValue(right.date).localeCompare(dateSortValue(left.date));
      return dateDifference || left.originalIndex - right.originalIndex;
    });

  return {
    validRecords,
    invalidRecords: normalized.filter((record) => !record.valid),
  };
}

function sortFeedback(feedback) {
  return (Array.isArray(feedback) ? feedback : [])
    .map((entry, originalIndex) => ({ entry, originalIndex }))
    .sort((left, right) => {
      const dateDifference = dateSortValue(right.entry?.date)
        .localeCompare(dateSortValue(left.entry?.date));
      return dateDifference || left.originalIndex - right.originalIndex;
    })
    .map(({ entry }) => entry);
}

/**
 * Returns the smallest arc containing all clock times on a 24-hour circle.
 * The thresholds based on this value are product MVP heuristics, not medical criteria.
 */
export function calculateBedtimeRangeMinutes(times = []) {
  const minutes = times
    .map(parseClock)
    .filter((value) => value !== null)
    .sort((left, right) => left - right);

  if (minutes.length < 2) return minutes.length ? 0 : null;

  let largestGap = 0;
  for (let index = 0; index < minutes.length; index += 1) {
    const current = minutes[index];
    const next = minutes[(index + 1) % minutes.length];
    const gap = index === minutes.length - 1
      ? next + MINUTES_IN_DAY - current
      : next - current;
    largestGap = Math.max(largestGap, gap);
  }

  return MINUTES_IN_DAY - largestGap;
}

function bedtimeRegularity(rangeMinutes) {
  if (rangeMinutes === null) return null;
  if (rangeMinutes <= 30) return "stable";
  if (rangeMinutes <= 90) return "moderate";
  return "irregular";
}

function dominantFailureReason(records) {
  const counts = new Map();
  records.forEach((record, index) => {
    const reason = String(record?.subjective?.failureReason ?? record?.failureReason ?? "").trim();
    if (!reason) return;
    const current = counts.get(reason) ?? { count: 0, firstIndex: index };
    current.count += 1;
    counts.set(reason, current);
  });

  let winner = null;
  counts.forEach((value, reason) => {
    if (!winner || value.count > winner.count
      || (value.count === winner.count && value.firstIndex < winner.firstIndex)) {
      winner = { reason, ...value };
    }
  });
  return winner?.reason ?? null;
}

function conditionIsLow(record) {
  const { freshness, sleepiness } = record.subjective;
  return (freshness !== null && freshness <= 2)
    || (sleepiness !== null && sleepiness >= 4);
}

function conditionSuggestsMoreSleep(record) {
  const { freshness, sleepiness, napDurationMinutes } = record.subjective;
  const strongPoorCondition = (freshness !== null && freshness <= 2)
    || (sleepiness !== null && sleepiness >= 4);
  const napReasonSupportsMoreSleep = !record.subjective.napReason
    || record.subjective.napReason === "졸려서"
    || record.subjective.napReason === "전날 잠이 부족해서";
  const moderateConditionWithNap = napReasonSupportsMoreSleep
    && napDurationMinutes !== null
    && napDurationMinutes >= MODERATE_NAP_THRESHOLD_MINUTES
    && ((freshness !== null && freshness === 3)
      || (sleepiness !== null && sleepiness === 3));
  return strongPoorCondition || moderateConditionWithNap;
}

function adaptiveAdjustment(currentTargetSleepMinutes) {
  if (currentTargetSleepMinutes < 390) {
    return { minutes: 60, phase: "COARSE" };
  }
  if (currentTargetSleepMinutes < COARSE_TARGET_THRESHOLD) {
    return { minutes: 30, phase: "COARSE" };
  }
  if (currentTargetSleepMinutes < FINE_TARGET_THRESHOLD) {
    return { minutes: 30, phase: "FINE" };
  }
  if (currentTargetSleepMinutes < MAX_EXPLORATION_TARGET) {
    return { minutes: 15, phase: "FINE" };
  }
  // The exploration cap is an MVP product safety guard, not a medical limit.
  return { minutes: 0, phase: "OBSERVE" };
}

function addReason(reasons, code, value, message) {
  reasons.push({ code, value, message });
}

function buildReasons({
  matchedStates,
  insufficientSleepCount,
  lowConditionCount,
  needsMoreSleepCount,
  averageSleepOpportunityMinutes,
  currentTargetSleepMinutes,
  suggestedAdjustmentMinutes,
  adjustmentStrategy,
  adjustmentPhase,
  bedtimeRangeMinutes,
  recordCount,
}) {
  const reasons = [];
  if (matchedStates.includes("INSUFFICIENT_DATA")) {
    addReason(
      reasons,
      "INSUFFICIENT_DATA",
      recordCount,
      "유효한 수면 기록이 3개 미만이라 강한 패턴 판단을 보류해요.",
    );
  }
  if (matchedStates.includes("INSUFFICIENT_SLEEP")) {
    addReason(
      reasons,
      "REPEATED_SLEEP_DEFICIT",
      insufficientSleepCount,
      `최근 5회 중 ${insufficientSleepCount}회에서 목표보다 30분 이상 수면 가능 시간이 부족했고 컨디션 저하가 함께 기록됐어요.`,
    );
  }
  if (adjustmentStrategy === "REACH_CURRENT_TARGET") {
    addReason(
      reasons,
      "CURRENT_TARGET_NOT_REACHED",
      currentTargetSleepMinutes - averageSleepOpportunityMinutes,
      "최근 수면 가능 시간이 현재 목표보다 평균적으로 부족해 목표를 더 늘리기보다 현재 목표를 먼저 확보합니다.",
    );
  }
  if (adjustmentStrategy === "EXPLORE_LONGER_TARGET") {
    const code = adjustmentPhase === "COARSE"
      ? "COARSE_TARGET_EXPLORATION"
      : "FINE_TARGET_EXPLORATION";
    addReason(
      reasons,
      code,
      suggestedAdjustmentMinutes,
      `현재 목표 수면시간은 대체로 확보하고 있지만 컨디션 저하가 반복되어 다음 목표를 ${suggestedAdjustmentMinutes}분 늘려 탐색합니다.`,
    );
  }
  if (adjustmentStrategy === "OBSERVE_OTHER_FACTORS") {
    addReason(
      reasons,
      "MAX_EXPLORATION_TARGET_REACHED",
      MAX_EXPLORATION_TARGET,
      "현재 탐색 상한에 도달해 수면시간을 추가로 늘리지 않고 다른 수면 품질 요인을 관찰합니다.",
    );
  }
  if (matchedStates.includes("LOW_CONDITION_DESPITE_DURATION")) {
    addReason(
      reasons,
      "LOW_CONDITION_DESPITE_DURATION",
      lowConditionCount,
      `최근 5회 중 ${lowConditionCount}회에서 목표에 가까운 수면 가능 시간에도 컨디션 저하가 기록됐어요.`,
    );
  }
  if (matchedStates.includes("IRREGULAR_TIMING")) {
    addReason(
      reasons,
      "IRREGULAR_BEDTIME",
      bedtimeRangeMinutes,
      `최근 취침 시각의 범위가 약 ${bedtimeRangeMinutes}분이에요.`,
    );
  }
  if (matchedStates.includes("STABLE")) {
    addReason(
      reasons,
      "STABLE_PATTERN",
      null,
      "최근 수면 가능 시간, 컨디션, 취침 시각이 안정적인 편이에요.",
    );
  }
  if (matchedStates.includes("NO_CLEAR_PATTERN")) {
    addReason(
      reasons,
      "NO_CLEAR_PATTERN",
      null,
      "현재 기록만으로는 하나의 뚜렷한 패턴을 판단하기 어려워요.",
    );
  }
  if (adjustmentPhase === "OBSERVE" && needsMoreSleepCount > 0
    && adjustmentStrategy !== "OBSERVE_OTHER_FACTORS") {
    addReason(
      reasons,
      "OBSERVE_MORE_DATA",
      needsMoreSleepCount,
      "컨디션 저하 신호가 충분히 반복되지 않아 현재 목표를 유지하며 더 관찰해요.",
    );
  }
  return reasons;
}

function selectPrimaryState(matchedStates) {
  if (matchedStates.includes("INSUFFICIENT_DATA")) return "INSUFFICIENT_DATA";
  return PRIMARY_STATE_PRIORITY.find((state) => matchedStates.includes(state))
    ?? "NO_CLEAR_PATTERN";
}

/**
 * Analyze user-entered sleep opportunity and subjective feedback without changing
 * the existing planner, UI, storage, or feedback schema.
 */
export function analyzeSleepHistory({ profile = {}, feedback = [], adaptationState = {} } = {}) {
  const configuredTarget = toFiniteNumber(profile?.targetSleepMinutes);
  const targetSleepMinutes = configuredTarget ?? DEFAULT_TARGET_SLEEP_MINUTES;
  const { validRecords, invalidRecords } = normalizeAndSortFeedback(feedback, targetSleepMinutes);
  const recentFeedback = sortFeedback(feedback).slice(0, ANALYSIS_WINDOW_SIZE);
  const analysisRecords = validRecords.slice(0, ANALYSIS_WINDOW_SIZE);
  const ruleRecords = validRecords.slice(0, RULE_WINDOW_SIZE);
  const recordCount = analysisRecords.length;
  const evaluationStartDate = dateSortValue(adaptationState?.evaluationStartDate);
  const candidateTargetSleepMinutes = toFiniteNumber(adaptationState?.candidateTargetSleepMinutes);
  const evaluationRecords = candidateTargetSleepMinutes === targetSleepMinutes && evaluationStartDate
    ? validRecords.filter((record) => dateSortValue(record.date) >= evaluationStartDate)
    : [];
  const evaluationRecordCount = evaluationRecords.length;
  const minimumEvaluationRecords = 3;
  const evaluationPending = candidateTargetSleepMinutes === targetSleepMinutes
    && Boolean(evaluationStartDate)
    && evaluationRecordCount < minimumEvaluationRecords;

  const averageSleepOpportunityMinutes = average(
    analysisRecords.map((record) => record.sleepOpportunityMinutes),
  );
  const averageEstimatedSleepMinutes = average(
    analysisRecords.map((record) => record.estimatedSleepMinutes),
  );
  // Target decisions use estimated sleep, while reports retain opportunity time.
  const averageDecisionSleepMinutes = average(
    ruleRecords.map((record) => record.estimatedSleepMinutes),
  );
  const medianSleepOpportunityMinutes = median(
    analysisRecords.map((record) => record.sleepOpportunityMinutes),
  );
  const averageSleepDeficitMinutes = average(
    analysisRecords.map((record) => record.sleepDeficitMinutes),
  );
  const averageFreshness = average(
    analysisRecords.map((record) => record.subjective.freshness),
  );
  const averageSleepiness = average(
    analysisRecords.map((record) => record.subjective.sleepiness),
  );
  const bedtimeRangeMinutes = calculateBedtimeRangeMinutes(
    analysisRecords.map((record) => record.actualSleep),
  );
  const regularity = bedtimeRegularity(bedtimeRangeMinutes);

  const insufficientSleepCount = ruleRecords.filter((record) => (
    record.sleepDeficitMinutes >= 30 && conditionSuggestsMoreSleep(record)
  )).length;
  const lowConditionCount = ruleRecords.filter((record) => (
    record.estimatedSleepMinutes >= targetSleepMinutes - 15 && conditionSuggestsMoreSleep(record)
  )).length;
  const needsMoreSleepCount = ruleRecords.filter(conditionSuggestsMoreSleep).length;
  const napCountLast5 = ruleRecords.filter((record) => (
    record.subjective.napDurationMinutes !== null
    && record.subjective.napDurationMinutes >= MODERATE_NAP_THRESHOLD_MINUTES
  )).length;
  const executionOffsets = ruleRecords.map((record) => record.executionOffsetMinutes);
  const lateExecutionOffsets = executionOffsets.filter((value) => (
    value !== null && value >= LATE_EXECUTION_THRESHOLD_MINUTES
  ));
  const earlyExecutionOffsets = executionOffsets.filter((value) => (
    value !== null && value <= -LATE_EXECUTION_THRESHOLD_MINUTES
  ));
  const averageLateExecutionMinutes = average(lateExecutionOffsets);
  const averageEarlyExecutionMinutes = average(earlyExecutionOffsets.map((value) => Math.abs(value)));
  const repeatedLateExecution = lateExecutionOffsets.length >= REPEATED_EXECUTION_COUNT;
  const repeatedEarlyExecution = earlyExecutionOffsets.length >= REPEATED_EXECUTION_COUNT;
  const onsetDelays = ruleRecords
    .map((record) => record.sleepOnsetDelayMinutes)
    .filter((value) => value !== null && value >= ONSET_DIFFICULTY_THRESHOLD_MINUTES);
  const averageSleepOnsetDelayMinutes = average(ruleRecords.map((record) => record.sleepOnsetDelayMinutes));
  const repeatedSleepOnsetDifficulty = onsetDelays.length >= REPEATED_EXECUTION_COUNT;
  const executionCorrectionMinutes = repeatedLateExecution
    ? Math.min(30, Math.max(15, Math.round((averageLateExecutionMinutes ?? 15) / 15) * 15))
    : repeatedEarlyExecution
      ? -Math.min(30, Math.max(15, Math.round((averageEarlyExecutionMinutes ?? 15) / 15) * 15))
      : 0;
  const onsetCorrectionMinutes = repeatedSleepOnsetDifficulty
    ? -Math.min(30, Math.max(15, Math.round((averageSleepOnsetDelayMinutes ?? 30) / 30) * 15))
    : 0;
  const recommendedBedtimeOffsetMinutes = Math.max(-30, Math.min(30,
    executionCorrectionMinutes + onsetCorrectionMinutes));

  const matchedStates = [];
  if (recordCount < 3) {
    matchedStates.push("INSUFFICIENT_DATA");
  } else {
    if (insufficientSleepCount >= 3) matchedStates.push("INSUFFICIENT_SLEEP");
    if (lowConditionCount >= 3) matchedStates.push("LOW_CONDITION_DESPITE_DURATION");
    if (ruleRecords.length >= 3 && bedtimeRangeMinutes !== null && bedtimeRangeMinutes > 90) {
      matchedStates.push("IRREGULAR_TIMING");
    }

    const stable = averageFreshness !== null
      && averageSleepiness !== null
      && averageSleepDeficitMinutes !== null
      && bedtimeRangeMinutes !== null
      && averageFreshness >= 4
      && averageSleepiness <= 2
      && averageSleepDeficitMinutes < 30
      && bedtimeRangeMinutes <= 90;
    if (stable) matchedStates.push("STABLE");
    if (!matchedStates.length) matchedStates.push("NO_CLEAR_PATTERN");
  }

  const primaryState = selectPrimaryState(matchedStates);
  const hasEnoughData = recordCount >= 3;
  const currentTargetNotReached = averageDecisionSleepMinutes !== null
    && averageDecisionSleepMinutes < targetSleepMinutes - CURRENT_TARGET_GAP_MINUTES;
  const repeatedMoreSleepSignal = needsMoreSleepCount >= 3;
  const canExploreLongerTarget = hasEnoughData
    && repeatedMoreSleepSignal
    && !currentTargetNotReached
    && averageDecisionSleepMinutes !== null
    && averageDecisionSleepMinutes >= targetSleepMinutes - CURRENT_TARGET_GAP_MINUTES;

  let suggestedAdjustmentMinutes = 0;
  let adjustmentPhase = hasEnoughData ? "OBSERVE" : "OBSERVE";
  let adjustmentStrategy = "OBSERVE_OTHER_FACTORS";
  let recommendedAction = "KEEP_COLLECTING_DATA";

  if (evaluationPending) {
    adjustmentPhase = "OBSERVE";
    adjustmentStrategy = "KEEP_CURRENT_TARGET";
    recommendedAction = "KEEP_CURRENT_PLAN";
  } else if (primaryState === "STABLE") {
    adjustmentPhase = "MAINTENANCE";
    adjustmentStrategy = "KEEP_CURRENT_TARGET";
    recommendedAction = "KEEP_CURRENT_PLAN";
  } else if (primaryState === "INSUFFICIENT_SLEEP" && currentTargetNotReached) {
    adjustmentPhase = "MAINTENANCE";
    adjustmentStrategy = "REACH_CURRENT_TARGET";
    recommendedAction = "REACH_CURRENT_TARGET";
  } else if (primaryState === "INSUFFICIENT_SLEEP" && canExploreLongerTarget) {
    const adjustment = adaptiveAdjustment(targetSleepMinutes);
    suggestedAdjustmentMinutes = adjustment.minutes;
    adjustmentPhase = adjustment.phase;
    adjustmentStrategy = adjustment.minutes
      ? "EXPLORE_LONGER_TARGET"
      : "OBSERVE_OTHER_FACTORS";
    recommendedAction = adjustment.minutes
      ? "EXTEND_SLEEP_OPPORTUNITY"
      : "OBSERVE_SLEEP_QUALITY_PATTERN";
  } else if (primaryState === "LOW_CONDITION_DESPITE_DURATION" && canExploreLongerTarget) {
    const adjustment = adaptiveAdjustment(targetSleepMinutes);
    suggestedAdjustmentMinutes = adjustment.minutes;
    adjustmentPhase = adjustment.phase;
    adjustmentStrategy = adjustment.minutes
      ? "EXPLORE_LONGER_TARGET"
      : "OBSERVE_OTHER_FACTORS";
    recommendedAction = adjustment.minutes
      ? "EXTEND_SLEEP_OPPORTUNITY"
      : "OBSERVE_SLEEP_QUALITY_PATTERN";
  } else if (primaryState === "LOW_CONDITION_DESPITE_DURATION") {
    adjustmentPhase = "OBSERVE";
    adjustmentStrategy = "OBSERVE_OTHER_FACTORS";
    recommendedAction = "OBSERVE_SLEEP_QUALITY_PATTERN";
  } else if (primaryState === "IRREGULAR_TIMING") {
    adjustmentPhase = "OBSERVE";
    adjustmentStrategy = "KEEP_CURRENT_TARGET";
    recommendedAction = "STABILIZE_SLEEP_TIMING";
  }

  const recommendedTargetSleepMinutes = targetSleepMinutes >= MAX_EXPLORATION_TARGET
    ? targetSleepMinutes
    : Math.min(
      MAX_EXPLORATION_TARGET,
      Math.max(targetSleepMinutes, targetSleepMinutes + suggestedAdjustmentMinutes),
    );

  const confidence = recordCount <= 2
    ? "insufficient"
    : recordCount <= 4
      ? "low"
      : recordCount <= 6
        ? "medium"
        : "high";

  return {
    analysisWindowSize: ANALYSIS_WINDOW_SIZE,
    ruleWindowSize: RULE_WINDOW_SIZE,
    recordCount,
    invalidRecordCount: invalidRecords.length,
    targetSleepMinutes,
    currentTargetSleepMinutes: targetSleepMinutes,
    recommendedTargetSleepMinutes,
    averageSleepOpportunityMinutes,
    averageEstimatedSleepMinutes,
    averageDecisionSleepMinutes,
    medianSleepOpportunityMinutes,
    averageSleepDeficitMinutes,
    averageLateExecutionMinutes,
    averageEarlyExecutionMinutes,
    averageSleepOnsetDelayMinutes,
    repeatedLateExecution,
    repeatedEarlyExecution,
    repeatedSleepOnsetDifficulty,
    recommendedBedtimeOffsetMinutes,
    averageFreshness,
    averageSleepiness,
    bedtimeRangeMinutes,
    bedtimeRegularity: regularity,
    dominantFailureReason: dominantFailureReason(recentFeedback),
    primaryState,
    matchedStates,
    recommendedAction,
    suggestedAdjustmentMinutes,
    adjustmentPhase,
    adjustmentStrategy,
    evaluationRecordCount,
    minimumEvaluationRecords,
    requiresEvaluation: evaluationPending,
    canAdjustAgain: !evaluationPending,
    counts: {
      insufficientSleepCountLast5: insufficientSleepCount,
      lowConditionDespiteDurationCountLast5: lowConditionCount,
      needsMoreSleepCountLast5: needsMoreSleepCount,
      napCountLast5,
      lateExecutionCountLast5: lateExecutionOffsets.length,
      earlyExecutionCountLast5: earlyExecutionOffsets.length,
      sleepOnsetDifficultyCountLast5: onsetDelays.length,
    },
    confidence,
    reasons: buildReasons({
      matchedStates,
      insufficientSleepCount,
      lowConditionCount,
      needsMoreSleepCount,
      averageSleepOpportunityMinutes: averageDecisionSleepMinutes,
      currentTargetSleepMinutes: targetSleepMinutes,
      suggestedAdjustmentMinutes,
      adjustmentStrategy,
      adjustmentPhase,
      bedtimeRangeMinutes,
      recordCount,
    }),
    records: analysisRecords.map((record) => ({
      date: record.date,
      actualSleep: record.actualSleep,
      actualWake: record.actualWake,
      behavior: { ...record.behavior },
      subjective: { ...record.subjective },
      sleepOpportunityMinutes: record.sleepOpportunityMinutes,
      sleepOnsetDelayMinutes: record.sleepOnsetDelayMinutes,
      estimatedSleepMinutes: record.estimatedSleepMinutes,
      executionOffsetMinutes: record.executionOffsetMinutes,
      recommendationSnapshot: record.recommendationSnapshot,
      rawSleepDeficitMinutes: record.rawSleepDeficitMinutes,
      sleepDeficitMinutes: record.sleepDeficitMinutes,
    })),
  };
}

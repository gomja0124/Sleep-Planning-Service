import test from "node:test";
import assert from "node:assert/strict";
import {
  analyzeSleepHistory,
  calculateBedtimeRangeMinutes,
} from "../src/sleep-analysis.mjs";

const profile = { targetSleepMinutes: 450 };

function feedbackEntry({
  date,
  actualSleep = "23:00",
  actualWake = "06:30",
  freshness = 3,
  sleepiness = 3,
  failureReason = "",
  sleepOnsetDelayMinutes,
  napDurationMinutes,
  napReason,
  recommendationSnapshot,
} = {}) {
  return {
    date, actualSleep, actualWake, freshness, sleepiness, failureReason,
    ...(sleepOnsetDelayMinutes === undefined ? {} : { sleepOnsetDelayMinutes }),
    ...(napDurationMinutes === undefined ? {} : { napDurationMinutes }),
    ...(napReason === undefined ? {} : { napReason }),
    ...(recommendationSnapshot === undefined ? {} : { recommendationSnapshot }),
  };
}

function repeatedEntries(count, overrides = {}) {
  return Array.from({ length: count }, (_, index) => feedbackEntry({
    date: `2026-08-${String(12 - index).padStart(2, "0")}`,
    ...overrides,
  }));
}

test("23:50 → 07:20은 450분의 수면 가능 시간으로 계산한다", () => {
  const result = analyzeSleepHistory({
    profile,
    feedback: [feedbackEntry({ actualSleep: "23:50", actualWake: "07:20" })],
  });
  assert.equal(result.records[0].sleepOpportunityMinutes, 450);
});

test("00:30 → 08:00은 450분의 수면 가능 시간으로 계산한다", () => {
  const result = analyzeSleepHistory({
    profile,
    feedback: [feedbackEntry({ actualSleep: "00:30", actualWake: "08:00" })],
  });
  assert.equal(result.records[0].sleepOpportunityMinutes, 450);
});

test("actualSleep과 actualWake가 같으면 invalid record로 처리한다", () => {
  const result = analyzeSleepHistory({
    profile,
    feedback: [feedbackEntry({ actualSleep: "23:00", actualWake: "23:00" })],
  });
  assert.equal(result.recordCount, 0);
  assert.equal(result.invalidRecordCount, 1);
  assert.equal(result.primaryState, "INSUFFICIENT_DATA");
});

test("잘못된 시간이 있어도 전체 분석은 중단되지 않는다", () => {
  const result = analyzeSleepHistory({
    profile,
    feedback: [
      feedbackEntry({ actualSleep: "not-time" }),
      feedbackEntry({ date: "2026-08-11" }),
      feedbackEntry({ date: "2026-08-10" }),
    ],
  });
  assert.equal(result.recordCount, 2);
  assert.equal(result.invalidRecordCount, 1);
  assert.equal(result.primaryState, "INSUFFICIENT_DATA");
});

test("feedback가 없거나 valid record가 1~2개면 INSUFFICIENT_DATA다", () => {
  assert.equal(analyzeSleepHistory({ profile, feedback: [] }).primaryState, "INSUFFICIENT_DATA");
  assert.equal(analyzeSleepHistory({ profile, feedback: repeatedEntries(2) }).primaryState, "INSUFFICIENT_DATA");
});

test("최근 5개 중 3개가 수면 부족과 컨디션 저하이면 INSUFFICIENT_SLEEP이다", () => {
  const result = analyzeSleepHistory({
    profile,
    feedback: [
      ...repeatedEntries(3, { actualSleep: "01:00", actualWake: "07:00", freshness: 2, sleepiness: 4 }),
      ...repeatedEntries(2, { actualSleep: "23:00", actualWake: "06:30", freshness: 4, sleepiness: 2 }),
    ],
  });
  assert.equal(result.primaryState, "INSUFFICIENT_SLEEP");
  assert.equal(result.recommendedAction, "REACH_CURRENT_TARGET");
  assert.equal(result.suggestedAdjustmentMinutes, 0);
  assert.equal(result.adjustmentStrategy, "REACH_CURRENT_TARGET");
  assert.equal(result.counts.insufficientSleepCountLast5, 3);
});

test("최근 5개 중 3개가 목표 시간에 가깝지만 컨디션이 낮으면 LOW_CONDITION_DESPITE_DURATION이다", () => {
  const result = analyzeSleepHistory({
    profile,
    feedback: [
      ...repeatedEntries(3, { actualSleep: "23:00", actualWake: "06:30", freshness: 2, sleepiness: 4 }),
      ...repeatedEntries(2, { actualSleep: "23:00", actualWake: "06:30", freshness: 4, sleepiness: 2 }),
    ],
  });
  assert.equal(result.primaryState, "LOW_CONDITION_DESPITE_DURATION");
  assert.equal(result.recommendedAction, "EXTEND_SLEEP_OPPORTUNITY");
  assert.equal(result.suggestedAdjustmentMinutes, 30);
  assert.equal(result.recommendedTargetSleepMinutes, 480);
  assert.equal(result.adjustmentPhase, "FINE");
  assert.equal(result.adjustmentStrategy, "EXPLORE_LONGER_TARGET");
  assert.equal(result.counts.lowConditionDespiteDurationCountLast5, 3);
});

test("취침 시각 범위가 90분을 초과하면 IRREGULAR_TIMING이다", () => {
  const result = analyzeSleepHistory({
    profile,
    feedback: [
      feedbackEntry({ date: "2026-08-12", actualSleep: "21:00" }),
      feedbackEntry({ date: "2026-08-11", actualSleep: "23:00" }),
      feedbackEntry({ date: "2026-08-10", actualSleep: "01:00" }),
    ],
  });
  assert.equal(result.primaryState, "IRREGULAR_TIMING");
  assert.equal(result.bedtimeRangeMinutes, 240);
});

test("취침 시각의 circular range를 자정 경계에서 계산한다", () => {
  assert.equal(calculateBedtimeRangeMinutes(["23:50", "00:10"]), 20);
  assert.equal(calculateBedtimeRangeMinutes(["23:30", "00:00", "00:30"]), 60);
  assert.equal(calculateBedtimeRangeMinutes(["22:30", "00:00", "01:30"]), 180);
});

test("좋은 패턴은 STABLE이다", () => {
  const result = analyzeSleepHistory({
    profile,
    feedback: repeatedEntries(7, {
      actualSleep: "23:00",
      actualWake: "06:30",
      freshness: 4,
      sleepiness: 2,
    }),
  });
  assert.equal(result.primaryState, "STABLE");
  assert.equal(result.recommendedAction, "KEEP_CURRENT_PLAN");
  assert.equal(result.confidence, "high");
});

test("3개 이상이지만 뚜렷한 Rule이 없으면 NO_CLEAR_PATTERN이다", () => {
  const result = analyzeSleepHistory({
    profile,
    feedback: repeatedEntries(3, { freshness: 3, sleepiness: 3 }),
  });
  assert.equal(result.primaryState, "NO_CLEAR_PATTERN");
  assert.equal(result.recommendedAction, "KEEP_COLLECTING_DATA");
});

test("sleepiness 또는 freshness가 null이어도 안전하게 평균을 계산한다", () => {
  const result = analyzeSleepHistory({
    profile,
    feedback: [
      feedbackEntry({ date: "2026-08-12", freshness: null, sleepiness: 4 }),
      feedbackEntry({ date: "2026-08-11", freshness: 4, sleepiness: null }),
      feedbackEntry({ date: "2026-08-10", freshness: null, sleepiness: null }),
    ],
  });
  assert.equal(result.averageFreshness, 4);
  assert.equal(result.averageSleepiness, 4);
  assert.equal(result.recordCount, 3);
});

test("freshness가 null이면 해당 값만 평균에서 제외한다", () => {
  const result = analyzeSleepHistory({
    profile,
    feedback: [
      feedbackEntry({ date: "2026-08-12", freshness: null, sleepiness: 2 }),
      feedbackEntry({ date: "2026-08-11", freshness: 4, sleepiness: 2 }),
      feedbackEntry({ date: "2026-08-10", freshness: 2, sleepiness: 2 }),
    ],
  });
  assert.equal(result.averageFreshness, 3);
  assert.equal(result.averageSleepiness, 2);
});

test("sleepiness가 null이면 해당 값만 평균에서 제외한다", () => {
  const result = analyzeSleepHistory({
    profile,
    feedback: [
      feedbackEntry({ date: "2026-08-12", freshness: 4, sleepiness: null }),
      feedbackEntry({ date: "2026-08-11", freshness: 4, sleepiness: 2 }),
      feedbackEntry({ date: "2026-08-10", freshness: 4, sleepiness: 4 }),
    ],
  });
  assert.equal(result.averageFreshness, 4);
  assert.equal(result.averageSleepiness, 3);
});

test("freshness와 sleepiness가 모두 없으면 subjective Rule을 발동하지 않는다", () => {
  const result = analyzeSleepHistory({
    profile,
    feedback: repeatedEntries(3, {
      actualSleep: "01:00",
      actualWake: "07:00",
      freshness: null,
      sleepiness: null,
    }),
  });
  assert.equal(result.primaryState, "NO_CLEAR_PATTERN");
  assert.equal(result.counts.insufficientSleepCountLast5, 0);
});

test("평균과 중앙값을 계산한다", () => {
  const result = analyzeSleepHistory({
    profile,
    feedback: [
      feedbackEntry({ date: "2026-08-12", actualSleep: "23:00", actualWake: "06:00" }),
      feedbackEntry({ date: "2026-08-11", actualSleep: "23:00", actualWake: "07:00" }),
      feedbackEntry({ date: "2026-08-10", actualSleep: "23:00", actualWake: "08:00" }),
    ],
  });
  assert.equal(result.averageSleepOpportunityMinutes, 480);
  assert.equal(result.medianSleepOpportunityMinutes, 480);
  assert.equal(result.averageSleepDeficitMinutes, 10);
});

test("수면 가능 시간과 입면 지연을 반영한 추정 실제 수면시간을 분리한다", () => {
  const result = analyzeSleepHistory({
    profile: { targetSleepMinutes: 450 },
    feedback: [
      feedbackEntry({
        date: "2026-08-12",
        actualSleep: "23:00",
        actualWake: "07:00",
        sleepOnsetDelayMinutes: 30,
      }),
      feedbackEntry({
        date: "2026-08-11",
        actualSleep: "23:00",
        actualWake: "07:00",
        sleepOnsetDelayMinutes: 60,
      }),
      feedbackEntry({
        date: "2026-08-10",
        actualSleep: "23:00",
        actualWake: "07:00",
        sleepOnsetDelayMinutes: null,
      }),
    ],
  });
  assert.equal(result.averageSleepOpportunityMinutes, 480);
  assert.equal(result.averageEstimatedSleepMinutes, 450);
  assert.equal(result.averageDecisionSleepMinutes, 450);
});

test("현재 목표가 540분보다 크면 추천 목표를 자동으로 줄이지 않는다", () => {
  const result = analyzeSleepHistory({
    profile: { targetSleepMinutes: 600 },
    feedback: repeatedEntries(5, {
      actualSleep: "23:00",
      actualWake: "07:00",
      freshness: 4,
      sleepiness: 2,
    }),
  });
  assert.equal(result.currentTargetSleepMinutes, 600);
  assert.equal(result.recommendedTargetSleepMinutes, 600);
  assert.equal(result.suggestedAdjustmentMinutes, 0);
});

test("추천 취침 구간보다 3회 이상 늦게 잔 경우 15~30분의 취침 보정을 제안한다", () => {
  const result = analyzeSleepHistory({
    profile,
    feedback: repeatedEntries(3, {
      actualSleep: "00:00",
      recommendationSnapshot: {
        bedtimeWindowStart: "23:00",
        bedtimeWindowEnd: "23:30",
      },
    }),
  });
  assert.equal(result.counts.lateExecutionCountLast5, 3);
  assert.equal(result.repeatedLateExecution, true);
  assert.equal(result.recommendedBedtimeOffsetMinutes, 30);
  assert.equal(result.records[0].executionOffsetMinutes, 30);
});

test("추천 취침 구간보다 3회 이상 일찍 잔 경우 음의 취침 보정을 제안한다", () => {
  const result = analyzeSleepHistory({
    profile,
    feedback: repeatedEntries(3, {
      actualSleep: "22:30",
      recommendationSnapshot: {
        bedtimeWindowStart: "23:00",
        bedtimeWindowEnd: "23:30",
      },
    }),
  });
  assert.equal(result.counts.earlyExecutionCountLast5, 3);
  assert.equal(result.repeatedEarlyExecution, true);
  assert.equal(result.recommendedBedtimeOffsetMinutes, -30);
  assert.equal(result.records[0].executionOffsetMinutes, -30);
});

test("입면 지연이 3회 이상 반복되면 더 일찍 눕도록 보정한다", () => {
  const result = analyzeSleepHistory({
    profile,
    feedback: repeatedEntries(3, {
      sleepOnsetDelayMinutes: 45,
      recommendationSnapshot: {
        bedtimeWindowStart: "23:00",
        bedtimeWindowEnd: "23:30",
      },
    }),
  });
  assert.equal(result.counts.sleepOnsetDifficultyCountLast5, 3);
  assert.equal(result.repeatedSleepOnsetDifficulty, true);
  assert.equal(result.averageSleepOnsetDelayMinutes, 45);
  assert.equal(result.recommendedBedtimeOffsetMinutes, -30);
});

test("dominantFailureReason은 빈 값을 제외하고 가장 최근 항목을 기준으로 동률을 결정한다", () => {
  const result = analyzeSleepHistory({
    profile,
    feedback: [
      feedbackEntry({ date: "2026-08-12", failureReason: "과제" }),
      feedbackEntry({ date: "2026-08-11", failureReason: "휴대폰을 오래 봄" }),
      feedbackEntry({ date: "2026-08-10", failureReason: "과제" }),
      feedbackEntry({ date: "2026-08-09", failureReason: "휴대폰을 오래 봄" }),
      feedbackEntry({ date: "2026-08-08", failureReason: "" }),
    ],
  });
  assert.equal(result.dominantFailureReason, "과제");
});

test("INSUFFICIENT_SLEEP와 IRREGULAR_TIMING이 함께 맞으면 우선순위를 적용한다", () => {
  const result = analyzeSleepHistory({
    profile,
    feedback: [
      ...repeatedEntries(3, { actualSleep: "01:00", actualWake: "07:00", freshness: 2, sleepiness: 4 }),
      feedbackEntry({ date: "2026-08-09", actualSleep: "21:00" }),
      feedbackEntry({ date: "2026-08-08", actualSleep: "23:00" }),
    ],
  });
  assert.equal(result.primaryState, "INSUFFICIENT_SLEEP");
  assert.deepEqual(result.matchedStates, ["INSUFFICIENT_SLEEP", "IRREGULAR_TIMING"]);
});

test("원본 profile과 feedback을 mutate하지 않는다", () => {
  const inputProfile = { targetSleepMinutes: 450 };
  const inputFeedback = [feedbackEntry({ date: "2026-08-12" })];
  const profileSnapshot = structuredClone(inputProfile);
  const feedbackSnapshot = structuredClone(inputFeedback);

  analyzeSleepHistory({ profile: inputProfile, feedback: inputFeedback });

  assert.deepEqual(inputProfile, profileSnapshot);
  assert.deepEqual(inputFeedback, feedbackSnapshot);
});

test("confidence는 valid record 수에 따라 결정한다", () => {
  assert.equal(analyzeSleepHistory({ profile, feedback: [] }).confidence, "insufficient");
  assert.equal(analyzeSleepHistory({ profile, feedback: repeatedEntries(3) }).confidence, "low");
  assert.equal(analyzeSleepHistory({ profile, feedback: repeatedEntries(5) }).confidence, "medium");
  assert.equal(analyzeSleepHistory({ profile, feedback: repeatedEntries(7) }).confidence, "high");
});

test("분석 결과의 adjustment는 기존 planner 입력에 연결할 수 있다", async () => {
  const { calculateRecommendation } = await import("../src/planner.mjs");
  const analysis = analyzeSleepHistory({
    profile,
    feedback: [
      ...repeatedEntries(3, { actualSleep: "01:00", actualWake: "07:00", freshness: 2, sleepiness: 4 }),
    ],
  });
  const recommendation = calculateRecommendation({
    profile: {
      ...profile,
      targetWake: "07:30",
      latencyMinutes: 0,
      targetSleepMinutes: profile.targetSleepMinutes + analysis.suggestedAdjustmentMinutes,
    },
    schedules: [],
    feedback: [],
    targetDate: new Date(2026, 7, 13, 12),
  });

  assert.equal(analysis.suggestedAdjustmentMinutes, 0);
  assert.equal(recommendation.baseSleepMinutes, 450);
});

test("6시간 target을 대체로 지키며 중간 컨디션과 반복 낮잠이 있으면 60분 COARSE 탐색한다", () => {
  const result = analyzeSleepHistory({
    profile: { targetSleepMinutes: 360 },
    feedback: [
      feedbackEntry({ date: "2026-08-12", actualSleep: "23:00", actualWake: "04:50", freshness: 3, napDurationMinutes: 40 }),
      feedbackEntry({ date: "2026-08-11", actualSleep: "23:00", actualWake: "04:55", freshness: 3, napDurationMinutes: 35 }),
      feedbackEntry({ date: "2026-08-10", actualSleep: "23:00", actualWake: "05:00", freshness: 2, napDurationMinutes: 0 }),
      feedbackEntry({ date: "2026-08-09", actualSleep: "23:00", actualWake: "05:10", freshness: 3, napDurationMinutes: 45 }),
      feedbackEntry({ date: "2026-08-08", actualSleep: "23:00", actualWake: "04:55", freshness: 3, napDurationMinutes: 30 }),
    ],
  });
  assert.equal(result.suggestedAdjustmentMinutes, 60);
  assert.equal(result.recommendedTargetSleepMinutes, 420);
  assert.equal(result.adjustmentPhase, "COARSE");
  assert.equal(result.adjustmentStrategy, "EXPLORE_LONGER_TARGET");
});

test("8시간 target인데 실제 평균이 6시간이면 target을 늘리지 않는다", () => {
  const result = analyzeSleepHistory({
    profile: { targetSleepMinutes: 480 },
    feedback: repeatedEntries(5, {
      actualSleep: "01:00", actualWake: "07:00", freshness: 2, sleepiness: 4,
    }),
  });
  assert.equal(result.suggestedAdjustmentMinutes, 0);
  assert.equal(result.recommendedTargetSleepMinutes, 480);
  assert.equal(result.recommendedAction, "REACH_CURRENT_TARGET");
  assert.equal(result.adjustmentStrategy, "REACH_CURRENT_TARGET");
});

test("7시간 target을 달성하지만 컨디션이 낮으면 30분 FINE 탐색한다", () => {
  const result = analyzeSleepHistory({
    profile: { targetSleepMinutes: 420 },
    feedback: repeatedEntries(5, {
      actualSleep: "23:00", actualWake: "06:00", freshness: 2, sleepiness: 4,
    }),
  });
  assert.equal(result.suggestedAdjustmentMinutes, 30);
  assert.equal(result.recommendedTargetSleepMinutes, 450);
  assert.equal(result.adjustmentPhase, "FINE");
});

test("8시간 target을 달성하지만 컨디션이 낮으면 15분 FINE 탐색한다", () => {
  const result = analyzeSleepHistory({
    profile: { targetSleepMinutes: 480 },
    feedback: repeatedEntries(5, {
      actualSleep: "22:00", actualWake: "06:00", freshness: 2, sleepiness: 4,
    }),
  });
  assert.equal(result.suggestedAdjustmentMinutes, 15);
  assert.equal(result.recommendedTargetSleepMinutes, 495);
  assert.equal(result.adjustmentPhase, "FINE");
});

test("9시간 target은 탐색 상한으로 추가 증가하지 않는다", () => {
  const result = analyzeSleepHistory({
    profile: { targetSleepMinutes: 540 },
    feedback: repeatedEntries(5, {
      actualSleep: "21:00", actualWake: "06:00", freshness: 2, sleepiness: 4,
    }),
  });
  assert.equal(result.suggestedAdjustmentMinutes, 0);
  assert.equal(result.recommendedTargetSleepMinutes, 540);
  assert.equal(result.adjustmentStrategy, "OBSERVE_OTHER_FACTORS");
});

test("한 번의 컨디션 저하만으로 target을 변경하지 않는다", () => {
  const result = analyzeSleepHistory({
    profile: { targetSleepMinutes: 360 },
    feedback: [
      feedbackEntry({ date: "2026-08-12", actualSleep: "23:00", actualWake: "05:00", freshness: 2, napDurationMinutes: 40 }),
      ...repeatedEntries(4, { actualSleep: "23:00", actualWake: "05:00", freshness: 3, napDurationMinutes: 0 }),
    ],
  });
  assert.equal(result.suggestedAdjustmentMinutes, 0);
  assert.equal(result.adjustmentPhase, "OBSERVE");
});

test("napDurationMinutes가 없거나 null, NaN, 음수여도 안전하다", () => {
  const result = analyzeSleepHistory({
    profile,
    feedback: [
      feedbackEntry({ date: "2026-08-12", napDurationMinutes: null }),
      feedbackEntry({ date: "2026-08-11", napDurationMinutes: NaN }),
      feedbackEntry({ date: "2026-08-10", napDurationMinutes: -10 }),
    ],
  });
  assert.equal(result.records[0].subjective.napDurationMinutes, null);
  assert.equal(result.records[1].subjective.napDurationMinutes, null);
  assert.equal(result.records[2].subjective.napDurationMinutes, null);
});

test("freshness 3만으로는 adjustment가 발생하지 않지만 낮잠과 결합하면 signal이다", () => {
  const withoutNap = analyzeSleepHistory({
    profile: { targetSleepMinutes: 360 },
    feedback: repeatedEntries(5, { actualSleep: "23:00", actualWake: "05:00", freshness: 3 }),
  });
  const withNap = analyzeSleepHistory({
    profile: { targetSleepMinutes: 360 },
    feedback: repeatedEntries(5, { actualSleep: "23:00", actualWake: "05:50", freshness: 3, napDurationMinutes: 30 }),
  });
  assert.equal(withoutNap.suggestedAdjustmentMinutes, 0);
  assert.equal(withNap.suggestedAdjustmentMinutes, 60);
});

test("피로가 아닌 낮잠 이유만 반복되면 중간 컨디션 signal로 사용하지 않는다", () => {
  const result = analyzeSleepHistory({
    profile: { targetSleepMinutes: 360 },
    feedback: repeatedEntries(5, {
      actualSleep: "23:00", actualWake: "05:50", freshness: 3,
      napDurationMinutes: 40, napReason: "습관적으로",
    }),
  });
  assert.equal(result.suggestedAdjustmentMinutes, 0);
});

test("recommendedTargetSleepMinutes는 540을 초과하지 않는다", () => {
  const result = analyzeSleepHistory({
    profile: { targetSleepMinutes: 510 },
    feedback: repeatedEntries(5, { actualSleep: "21:30", actualWake: "06:00", freshness: 2, sleepiness: 4 }),
  });
  assert.ok(result.recommendedTargetSleepMinutes <= 540);
});

test("STABLE이면 MAINTENANCE와 KEEP_CURRENT_TARGET을 반환한다", () => {
  const result = analyzeSleepHistory({
    profile,
    feedback: repeatedEntries(5, { actualSleep: "23:00", actualWake: "06:30", freshness: 4, sleepiness: 2 }),
  });
  assert.equal(result.primaryState, "STABLE");
  assert.equal(result.adjustmentPhase, "MAINTENANCE");
  assert.equal(result.adjustmentStrategy, "KEEP_CURRENT_TARGET");
});

test("적용 중인 candidate target은 평가 기록 3개 전까지 다시 조정하지 않는다", () => {
  const result = analyzeSleepHistory({
    profile: { targetSleepMinutes: 420 },
    adaptationState: {
      candidateTargetSleepMinutes: 420,
      evaluationStartDate: "2026-08-10",
    },
    feedback: [
      feedbackEntry({ date: "2026-08-12", actualSleep: "23:00", actualWake: "06:00", freshness: 2, sleepiness: 4 }),
      feedbackEntry({ date: "2026-08-11", actualSleep: "23:00", actualWake: "06:00", freshness: 2, sleepiness: 4 }),
    ],
  });
  assert.equal(result.evaluationRecordCount, 2);
  assert.equal(result.requiresEvaluation, true);
  assert.equal(result.canAdjustAgain, false);
  assert.equal(result.suggestedAdjustmentMinutes, 0);
  assert.equal(result.adjustmentStrategy, "KEEP_CURRENT_TARGET");
});

import test from "node:test";
import assert from "node:assert/strict";
import {
  applyPlanOffset,
  calculateRecommendation,
  feedbackAdjustment,
  formatDisplayTime,
  formatTime,
  scheduleAppliesToDate,
} from "../src/planner.mjs";

const profile = {
  targetWake: "07:30",
  targetSleepMinutes: 450,
  latencyMinutes: 20,
  routineMinutes: 30,
};

test("시간은 자정을 넘어도 24시간 형식으로 정규화한다", () => {
  assert.equal(formatTime(-15), "23:45");
  assert.equal(formatTime(24 * 60 + 20), "00:20");
});

test("설정에 따라 12시간제와 24시간제를 표시한다", () => {
  assert.equal(formatDisplayTime("00:05", "24h"), "00:05");
  assert.equal(formatDisplayTime("00:05", "12h"), "오전 12:05");
  assert.equal(formatDisplayTime("13:30", "12h"), "오후 1:30");
});
test("고정 일정은 선택한 요일에만 적용한다", () => {
  const monday = new Date(2026, 7, 3, 12);
  const fixed = { kind: "fixed", days: [1, 3] };
  assert.equal(scheduleAppliesToDate(fixed, monday), true);
  assert.equal(scheduleAppliesToDate(fixed, new Date(2026, 7, 4, 12)), false);
});

test("변동 일정은 지정한 날짜에만 적용한다", () => {
  const variable = { kind: "variable", date: "2026-08-07" };
  assert.equal(scheduleAppliesToDate(variable, new Date(2026, 7, 7, 12)), true);
  assert.equal(scheduleAppliesToDate(variable, new Date(2026, 7, 8, 12)), false);
});

test("첫 일정의 준비·통학 시간을 반영해 기상과 취침 구간을 계산한다", () => {
  const result = calculateRecommendation({
    profile,
    targetDate: new Date(2026, 7, 7, 12),
    schedules: [
      {
        id: "meeting",
        kind: "variable",
        date: "2026-08-07",
        title: "팀 회의",
        startTime: "09:00",
        preparationMinutes: 40,
        commuteMinutes: 50,
      },
    ],
  });

  assert.equal(result.wakeTime, "07:30");
  assert.equal(result.bedtimeCenter, "23:40");
  assert.equal(result.bedtimeWindowStart, "23:25");
  assert.match(result.reasons[0], /팀 회의/);
});

test("권장 불 끄기 시각은 5분 눈금으로 제안한다", () => {
  const result = calculateRecommendation({
    profile: { ...profile, latencyMinutes: 24 },
    targetDate: new Date(2026, 7, 7, 12),
  });

  assert.equal(result.bedtimeCenter, "23:35");
  assert.equal(result.bedtimeWindowStart, "23:20");
  assert.equal(result.bedtimeWindowEnd, "23:50");
  for (const value of [result.bedtimeCenter, result.bedtimeWindowStart, result.bedtimeWindowEnd]) {
    assert.equal(Number(value.slice(-2)) % 5, 0);
  }
});

test("일정이 늦으면 사용자의 희망 기상 시각을 유지한다", () => {
  const result = calculateRecommendation({
    profile,
    targetDate: new Date(2026, 7, 7, 12),
    schedules: [
      {
        id: "class",
        kind: "variable",
        date: "2026-08-07",
        title: "오후 수업",
        startTime: "13:00",
        preparationMinutes: 30,
        commuteMinutes: 40,
      },
    ],
  });

  assert.equal(result.wakeTime, "07:30");
  assert.match(result.reasons[0], /희망 기상 시각/);
});

test("최근 컨디션이 나쁘면 다음 추천의 수면 여유를 늘린다", () => {
  const feedback = [
    { date: "2026-08-05", freshness: 2, sleepiness: 4 },
    { date: "2026-08-04", freshness: 2, sleepiness: 5 },
  ];
  assert.deepEqual(feedbackAdjustment(feedback).minutes, 30);

  const result = calculateRecommendation({
    profile,
    targetDate: new Date(2026, 7, 7, 12),
    feedback,
  });
  assert.equal(result.feedbackAdjustmentMinutes, 30);
  assert.equal(result.bedtimeCenter, "23:10");
});

test("추천 후 불 끄기 계획은 1분 단위로 조절하고 기상 시각은 유지한다", () => {
  const base = calculateRecommendation({
    profile,
    targetDate: new Date(2026, 7, 7, 12),
  });
  const later = applyPlanOffset(base, 7);

  assert.equal(later.userOffsetMinutes, 7);
  assert.equal(later.bedtimeCenter, "23:47");
  assert.equal(later.routineStart, "23:02");
  assert.equal(later.wakeTime, base.wakeTime);
  assert.equal(later.sleepMinutes, base.sleepMinutes - 7);
  assert.equal(later.alerts.find((alert) => alert.type === "wake").time, base.wakeTime);
});

test("불 끄기 조절은 자정 경계를 올바르게 넘는다", () => {
  const shifted = applyPlanOffset({
    bedtimeWindowStart: "23:55",
    bedtimeWindowEnd: "00:25",
    bedtimeCenter: "00:10",
    routineStart: "23:25",
    wakeTime: "07:30",
    sleepMinutes: 450,
    alerts: [
      { type: "routine", time: "23:25" },
      { type: "lights-out", time: "23:55" },
      { type: "wake", time: "07:30" },
    ],
  }, 10);

  assert.equal(shifted.bedtimeWindowStart, "00:05");
  assert.equal(shifted.bedtimeWindowEnd, "00:35");
  assert.equal(shifted.routineStart, "23:35");
});

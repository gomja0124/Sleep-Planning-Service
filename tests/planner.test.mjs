import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateRecommendation,
  feedbackAdjustment,
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

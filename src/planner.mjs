const MINUTES_IN_DAY = 24 * 60;

export const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function parseTime(value) {
  if (typeof value !== "string" || !/^\d{2}:\d{2}$/.test(value)) {
    throw new TypeError(`올바르지 않은 시간입니다: ${value}`);
  }

  const [hours, minutes] = value.split(":").map(Number);
  if (hours > 23 || minutes > 59) {
    throw new RangeError(`올바르지 않은 시간입니다: ${value}`);
  }

  return hours * 60 + minutes;
}

export function formatTime(totalMinutes) {
  const normalized = ((Math.round(totalMinutes) % MINUTES_IN_DAY) + MINUTES_IN_DAY) % MINUTES_IN_DAY;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function formatDuration(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (!hours) return `${minutes}분`;
  if (!minutes) return `${hours}시간`;
  return `${hours}시간 ${minutes}분`;
}

export function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDays(date, amount) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount, 12, 0, 0, 0);
}

export function formatKoreanDate(date, includeYear = false) {
  const prefix = includeYear ? `${date.getFullYear()}년 ` : "";
  return `${prefix}${date.getMonth() + 1}월 ${date.getDate()}일 ${DAY_NAMES[date.getDay()]}요일`;
}

export function scheduleAppliesToDate(schedule, date) {
  if (schedule.kind === "variable") return schedule.date === dateKey(date);
  return schedule.kind === "fixed" && Array.isArray(schedule.days) && schedule.days.includes(date.getDay());
}

export function schedulesForDate(schedules, date) {
  return schedules
    .filter((schedule) => scheduleAppliesToDate(schedule, date))
    .sort((left, right) => parseTime(left.startTime) - parseTime(right.startTime));
}

export function feedbackAdjustment(feedback = []) {
  const recent = [...feedback]
    .filter((entry) => Number.isFinite(Number(entry.freshness)) && Number.isFinite(Number(entry.sleepiness)))
    .sort((left, right) => String(right.date).localeCompare(String(left.date)))
    .slice(0, 3);

  if (!recent.length) {
    return { minutes: 0, reason: null };
  }

  const averageFreshness = recent.reduce((sum, entry) => sum + Number(entry.freshness), 0) / recent.length;
  const averageSleepiness = recent.reduce((sum, entry) => sum + Number(entry.sleepiness), 0) / recent.length;

  if (averageFreshness <= 2 && averageSleepiness >= 4) {
    return { minutes: 30, reason: "최근 아침 컨디션과 낮 졸림을 반영해 수면 여유를 30분 늘렸어요." };
  }

  if (averageFreshness < 3 || averageSleepiness > 3) {
    return { minutes: 15, reason: "최근 컨디션 피드백을 반영해 수면 여유를 15분 늘렸어요." };
  }

  return { minutes: 0, reason: "최근 컨디션이 안정적이라 현재 목표 수면 시간을 유지해요." };
}

export function calculateRecommendation({ profile, schedules = [], feedback = [], targetDate }) {
  if (!(targetDate instanceof Date) || Number.isNaN(targetDate.getTime())) {
    throw new TypeError("targetDate는 유효한 Date여야 합니다.");
  }

  const targetWake = parseTime(profile.targetWake);
  const daySchedules = schedulesForDate(schedules, targetDate);
  const constrainedSchedules = daySchedules.map((schedule) => {
    const commuteMinutes = clamp(Number(schedule.commuteMinutes) || 0, 0, 240);
    const preparationMinutes = clamp(Number(schedule.preparationMinutes) || 0, 0, 240);
    return {
      schedule,
      requiredWake: parseTime(schedule.startTime) - commuteMinutes - preparationMinutes,
      commuteMinutes,
      preparationMinutes,
    };
  });

  const strongestConstraint = constrainedSchedules.reduce((earliest, current) => {
    if (!earliest || current.requiredWake < earliest.requiredWake) return current;
    return earliest;
  }, null);

  const scheduleRequiresEarlierWake = strongestConstraint && strongestConstraint.requiredWake < targetWake;
  const wakeMinutes = scheduleRequiresEarlierWake ? strongestConstraint.requiredWake : targetWake;
  const adjustment = feedbackAdjustment(feedback);
  const baseSleep = clamp(Number(profile.targetSleepMinutes) || 450, 300, 600);
  const sleepMinutes = baseSleep + adjustment.minutes;
  const latencyMinutes = clamp(Number(profile.latencyMinutes) || 0, 0, 120);
  const routineMinutes = clamp(Number(profile.routineMinutes) || 30, 0, 180);
  const bedtimeCenter = wakeMinutes - sleepMinutes - latencyMinutes;
  const bedtimeWindowStart = bedtimeCenter - 15;
  const bedtimeWindowEnd = bedtimeCenter + 15;
  const routineStart = bedtimeWindowStart - routineMinutes;

  const reasons = [];
  if (scheduleRequiresEarlierWake) {
    const { schedule, commuteMinutes, preparationMinutes } = strongestConstraint;
    reasons.push(
      `${schedule.startTime} ${schedule.title} 전 ${formatDuration(commuteMinutes)} 통학과 ${formatDuration(preparationMinutes)} 준비가 필요해 ${formatTime(wakeMinutes)} 기상으로 계산했어요.`,
    );
  } else if (strongestConstraint) {
    reasons.push(
      `첫 일정은 ${strongestConstraint.schedule.startTime} ${strongestConstraint.schedule.title}이지만 희망 기상 시각 ${profile.targetWake}을 유지했어요.`,
    );
  } else {
    reasons.push(`내일 이른 일정이 없어 희망 기상 시각 ${profile.targetWake}을 기준으로 계산했어요.`);
  }
  reasons.push(`목표 수면 ${formatDuration(baseSleep)}과 평균 입면 ${formatDuration(latencyMinutes)}을 반영했어요.`);
  if (adjustment.reason) reasons.push(adjustment.reason);

  return {
    targetDate: dateKey(targetDate),
    date: targetDate,
    daySchedules,
    primarySchedule: strongestConstraint?.schedule ?? null,
    wakeTime: formatTime(wakeMinutes),
    bedtimeWindowStart: formatTime(bedtimeWindowStart),
    bedtimeWindowEnd: formatTime(bedtimeWindowEnd),
    bedtimeCenter: formatTime(bedtimeCenter),
    routineStart: formatTime(routineStart),
    sleepMinutes,
    baseSleepMinutes: baseSleep,
    feedbackAdjustmentMinutes: adjustment.minutes,
    reasons,
    alerts: [
      { type: "routine", label: "취침 준비", time: formatTime(routineStart) },
      { type: "lights-out", label: "불 끄기", time: formatTime(bedtimeWindowStart) },
      { type: "wake", label: "기상", time: formatTime(wakeMinutes) },
    ],
  };
}

export function generateRecommendations({ profile, schedules = [], feedback = [], startDate, days = 7 }) {
  return Array.from({ length: days }, (_, index) =>
    calculateRecommendation({
      profile,
      schedules,
      feedback,
      targetDate: addDays(startDate, index),
    }),
  );
}

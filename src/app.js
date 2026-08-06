import {
  DAY_NAMES,
  addDays,
  dateKey,
  feedbackAdjustment,
  formatDuration,
  formatKoreanDate,
  generateRecommendations,
} from "./planner.mjs";

const STORAGE_KEY = "bamgai-demo-v1";

const icons = {
  moon: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.4 15.1A8.5 8.5 0 0 1 8.9 3.6 8.5 8.5 0 1 0 20.4 15.1Z"/></svg>`,
  home: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 11 9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9Z"/></svg>`,
  calendar: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3v3m14-3v3M3 9h18M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"/></svg>`,
  check: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>`,
  chart: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V10m6 10V4m6 16v-7m4 7H2"/></svg>`,
  bell: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Zm-8 12h4"/></svg>`,
  arrow: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>`,
  plus: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>`,
  edit: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 20 4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Zm10-13 3 3"/></svg>`,
  trash: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16m-10 4v6m4-6v6M9 4h6l1 3H8l1-3Zm-3 3 1 14h10l1-14"/></svg>`,
  spark: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2 1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2Zm7 14 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16Z"/></svg>`,
  clock: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`,
  route: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h2a3 3 0 0 0 3-3V9a3 3 0 0 1 3-3"/></svg>`,
};

const icon = (name) => `<span class="icon">${icons[name]}</span>`;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#039;",
    '"': "&quot;",
  })[character]);
}

function newId() {
  return globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function seedState() {
  const tomorrow = addDays(new Date(), 1);
  return {
    profile: {
      name: "도경",
      targetWake: "07:30",
      targetSleepMinutes: 450,
      latencyMinutes: 24,
      routineMinutes: 30,
      adaptationWeek: 1,
    },
    schedules: [
      {
        id: newId(),
        kind: "fixed",
        title: "전공 수업",
        days: [1, 3],
        startTime: "09:00",
        preparationMinutes: 40,
        commuteMinutes: 50,
      },
      {
        id: newId(),
        kind: "fixed",
        title: "카페 아르바이트",
        days: [2, 4],
        startTime: "11:00",
        preparationMinutes: 30,
        commuteMinutes: 25,
      },
      {
        id: newId(),
        kind: "variable",
        title: "팀 기획 회의",
        date: dateKey(tomorrow),
        startTime: "10:00",
        preparationMinutes: 30,
        commuteMinutes: 35,
      },
    ],
    feedback: [],
    alertSettings: { routine: true, "lights-out": true, wake: true },
    savedPlanDate: null,
  };
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved?.profile && Array.isArray(saved.schedules) && Array.isArray(saved.feedback)) return saved;
  } catch (error) {
    console.warn("저장된 데모 데이터를 불러오지 못했습니다.", error);
  }
  return seedState();
}

let state = loadState();
const ui = {
  view: "today",
  showReason: true,
  scheduleType: "fixed",
  editScheduleId: null,
  toast: "",
};

const app = document.querySelector("#app");

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getPlans() {
  return generateRecommendations({
    profile: state.profile,
    schedules: state.schedules,
    feedback: state.feedback,
    startDate: addDays(new Date(), 1),
    days: 7,
  });
}

function shortDate(date) {
  return `${date.getMonth() + 1}.${String(date.getDate()).padStart(2, "0")} ${DAY_NAMES[date.getDay()]}`;
}

function sleepGoalLabel() {
  return formatDuration(state.profile.targetSleepMinutes);
}

function navItem(view, label, iconName) {
  const active = ui.view === view;
  return `<button class="nav-item ${active ? "is-active" : ""}" data-view="${view}" aria-current="${active ? "page" : "false"}">
    ${icon(iconName)}<span>${label}</span>
  </button>`;
}

function shell(content) {
  return `
    <div class="app-shell">
      <aside class="sidebar">
        <button class="brand" data-view="today" aria-label="밤가이 홈">
          <span class="brand-mark">${icon("moon")}</span>
          <span><b>밤가이</b><small>나만의 수면 리듬</small></span>
        </button>
        <nav class="side-nav" aria-label="주요 메뉴">
          ${navItem("today", "오늘", "home")}
          ${navItem("schedule", "일정", "calendar")}
          ${navItem("feedback", "기상 체크", "check")}
          ${navItem("rhythm", "내 리듬", "chart")}
        </nav>
        <div class="phase-card">
          <span class="phase-label">개인화 적응 중</span>
          <strong>${state.profile.adaptationWeek}주차 <span>/ 3주</span></strong>
          <div class="progress-track"><span style="width:${Math.min(state.profile.adaptationWeek / 3, 1) * 100}%"></span></div>
          <p>수면 결과가 쌓일수록 추천이 도경님에게 더 가까워져요.</p>
        </div>
        <div class="sidebar-profile">
          <span class="avatar">도</span>
          <span><b>${escapeHtml(state.profile.name)}님</b><small>${sleepGoalLabel()} 목표</small></span>
          <button class="icon-button" data-view="rhythm" aria-label="내 리듬 설정">${icon("arrow")}</button>
        </div>
      </aside>
      <main class="main">
        <header class="topbar">
          <div><span class="eyebrow">오늘</span><strong>${formatKoreanDate(new Date(), true)}</strong></div>
          <button class="ghost-button compact" data-action="reset-demo">데모 초기화</button>
        </header>
        <div class="content">${content}</div>
      </main>
      <nav class="bottom-nav" aria-label="모바일 메뉴">
        ${navItem("today", "오늘", "home")}
        ${navItem("schedule", "일정", "calendar")}
        ${navItem("feedback", "기상 체크", "check")}
        ${navItem("rhythm", "내 리듬", "chart")}
      </nav>
      ${ui.toast ? `<div class="toast" role="status">${icon("check")} ${escapeHtml(ui.toast)}</div>` : ""}
    </div>`;
}

function owlPlaceholder() {
  return `<div class="owl-wrap" aria-label="올빼미 캐릭터 자리표시자">
    <div class="orbit orbit-one"></div><div class="orbit orbit-two"></div>
    <svg class="owl" viewBox="0 0 180 180" role="img" aria-hidden="true">
      <path class="owl-body" d="M45 67 29 46l31 9c9-7 19-10 30-10s21 3 30 10l31-9-16 21c8 12 12 27 12 43 0 36-25 56-57 56s-57-20-57-56c0-16 4-31 12-43Z"/>
      <circle class="owl-eye-ring" cx="68" cy="92" r="24"/><circle class="owl-eye-ring" cx="112" cy="92" r="24"/>
      <circle class="owl-eye" cx="70" cy="94" r="8"/><circle class="owl-eye" cx="110" cy="94" r="8"/>
      <path class="owl-beak" d="m90 102-9 12h18l-9-12Z"/>
      <path class="owl-wing" d="M49 118c9 11 17 17 26 19M131 118c-9 11-17 17-26 19"/>
    </svg>
    <span class="asset-note">순형 캐릭터 에셋 자리</span>
  </div>`;
}

function renderReasons(plan) {
  if (!ui.showReason) return "";
  return `<div class="reason-panel">
    <span class="reason-icon">${icon("spark")}</span>
    <div><b>이렇게 계산했어요</b><ul>${plan.reasons.map((reason) => `<li>${escapeHtml(reason)}</li>`).join("")}</ul></div>
  </div>`;
}

function renderToday() {
  const [plan, ...laterPlans] = getPlans();
  const isSaved = state.savedPlanDate === plan.targetDate;
  const primary = plan.primarySchedule;
  const adjustment = feedbackAdjustment(state.feedback);

  return `
    <section class="page-heading">
      <div><span class="section-kicker">GOOD EVENING</span><h1>오늘 밤, 이 리듬이면 괜찮아요.</h1><p>내일 일정과 최근 컨디션을 반영한 도경님의 수면 계획이에요.</p></div>
      <span class="live-chip"><i></i> ${state.profile.adaptationWeek}주차 개인화 진행 중</span>
    </section>

    <section class="hero-card">
      <div class="hero-copy">
        <span class="hero-label">${icon("spark")} ${formatKoreanDate(plan.date)} 계획</span>
        <p class="hero-caption">권장 불 끄기 구간</p>
        <h2>${plan.bedtimeWindowStart}<span>—</span>${plan.bedtimeWindowEnd}</h2>
        <p class="hero-sub">${plan.wakeTime} 기상 · ${formatDuration(plan.sleepMinutes)} 확보 목표</p>
        <div class="hero-actions">
          <button class="primary-button light" data-action="save-plan">${isSaved ? `${icon("check")} 오늘 계획 저장됨` : "오늘 계획으로 저장"}</button>
          <button class="text-button light-text" data-action="toggle-reason">${ui.showReason ? "근거 접기" : "계산 근거 보기"} ${icon("arrow")}</button>
        </div>
      </div>
      ${owlPlaceholder()}
      ${adjustment.minutes ? `<span class="adjustment-badge">피드백 반영 · ${adjustment.minutes}분 추가</span>` : ""}
    </section>

    ${renderReasons(plan)}

    <div class="dashboard-grid">
      <section class="card timeline-card">
        <div class="card-heading"><div><span class="card-kicker">TONIGHT</span><h3>오늘 밤 타임라인</h3></div><span class="soft-chip">알림 3개</span></div>
        <div class="timeline">
          ${plan.alerts.map((alert, index) => `<div class="timeline-row">
            <div class="timeline-marker ${alert.type}">${index === 0 ? icon("moon") : index === 1 ? icon("spark") : icon("bell")}</div>
            <div><span>${alert.label}</span><b>${alert.time}</b></div>
            <span class="timeline-status">${state.alertSettings[alert.type] ? "알림 켬" : "알림 끔"}</span>
          </div>`).join("")}
        </div>
      </section>

      <section class="card next-card">
        <div class="card-heading"><div><span class="card-kicker">TOMORROW</span><h3>내일 첫 일정</h3></div><button class="icon-button bordered" data-view="schedule" aria-label="일정 보기">${icon("arrow")}</button></div>
        ${primary ? `<div class="event-time"><b>${primary.startTime}</b><span>${escapeHtml(primary.title)}</span></div>
          <div class="event-meta"><span>${icon("route")} 통학 ${primary.commuteMinutes}분</span><span>${icon("clock")} 준비 ${primary.preparationMinutes}분</span></div>
          <div class="wake-callout"><span>필요 기상</span><strong>${plan.wakeTime}</strong></div>` : `<div class="empty-compact">내일 등록된 이른 일정이 없어요.<br>희망 기상 시각을 유지합니다.</div>`}
      </section>

      <section class="card alerts-card">
        <div class="card-heading"><div><span class="card-kicker">REMINDERS</span><h3>루틴 알림</h3></div>${icon("bell")}</div>
        <div class="setting-list">
          ${plan.alerts.map((alert) => `<button class="setting-row" data-action="toggle-alert" data-alert="${alert.type}">
            <span><b>${alert.label}</b><small>${alert.time}</small></span><i class="switch ${state.alertSettings[alert.type] ? "on" : ""}"><span></span></i>
          </button>`).join("")}
        </div>
      </section>
    </div>

    <section class="card week-card">
      <div class="card-heading"><div><span class="card-kicker">NEXT 7 DAYS</span><h3>이번 주 리듬 미리보기</h3></div><button class="text-button" data-view="rhythm">전체 계획 ${icon("arrow")}</button></div>
      <div class="week-strip">
        <div class="day-plan is-today"><span>${shortDate(plan.date)}</span><b>${plan.bedtimeWindowStart}</b><small>${plan.primarySchedule?.title ?? "희망 기상 기준"}</small></div>
        ${laterPlans.slice(0, 5).map((item) => `<div class="day-plan"><span>${shortDate(item.date)}</span><b>${item.bedtimeWindowStart}</b><small>${escapeHtml(item.primarySchedule?.title ?? "기본 리듬")}</small></div>`).join("")}
      </div>
    </section>`;
}

function scheduleWhen(schedule) {
  if (schedule.kind === "variable") {
    const [year, month, day] = schedule.date.split("-").map(Number);
    return `${month}월 ${day}일 · 한 번`;
  }
  return `${schedule.days.map((day) => `${DAY_NAMES[day]}요일`).join(" · ")} · 매주`;
}

function scheduleCard(schedule) {
  return `<article class="schedule-item">
    <div class="schedule-date-box"><b>${schedule.startTime}</b><span>${schedule.kind === "fixed" ? "고정" : "변동"}</span></div>
    <div class="schedule-body"><h4>${escapeHtml(schedule.title)}</h4><p>${scheduleWhen(schedule)}</p><div><span>준비 ${schedule.preparationMinutes}분</span><span>통학 ${schedule.commuteMinutes}분</span></div></div>
    <div class="schedule-actions">
      <button class="icon-button bordered" data-action="edit-schedule" data-id="${schedule.id}" aria-label="${escapeHtml(schedule.title)} 수정">${icon("edit")}</button>
      <button class="icon-button bordered danger" data-action="delete-schedule" data-id="${schedule.id}" aria-label="${escapeHtml(schedule.title)} 삭제">${icon("trash")}</button>
    </div>
  </article>`;
}

function renderScheduleForm() {
  const editing = state.schedules.find((schedule) => schedule.id === ui.editScheduleId);
  const type = editing?.kind ?? ui.scheduleType;
  const defaultDate = dateKey(addDays(new Date(), 1));
  const days = editing?.days ?? [1, 3];

  return `<section class="card form-card schedule-form-card">
    <div class="card-heading"><div><span class="card-kicker">${editing ? "EDIT" : "ADD NEW"}</span><h3>${editing ? "일정 수정" : "새 일정 추가"}</h3></div>${editing ? `<button class="ghost-button compact" data-action="cancel-edit">수정 취소</button>` : ""}</div>
    <div class="segmented" role="tablist" aria-label="일정 유형">
      <button class="${type === "fixed" ? "is-active" : ""}" data-action="schedule-type" data-type="fixed" type="button">고정 일정 <small>매주 반복</small></button>
      <button class="${type === "variable" ? "is-active" : ""}" data-action="schedule-type" data-type="variable" type="button">변동 일정 <small>특정 날짜</small></button>
    </div>
    <form id="schedule-form" data-kind="${type}" data-edit-id="${editing?.id ?? ""}">
      <div class="form-grid two">
        <label class="field"><span>일정 이름</span><input name="title" value="${escapeHtml(editing?.title ?? "")}" placeholder="예: 전공 수업" required maxlength="30"></label>
        <label class="field"><span>시작 시각</span><input name="startTime" type="time" value="${editing?.startTime ?? "09:00"}" required></label>
      </div>
      ${type === "fixed" ? `<fieldset class="field day-field"><legend>반복 요일</legend><div class="day-picker">
        ${DAY_NAMES.map((name, index) => `<label><input type="checkbox" name="days" value="${index}" ${days.includes(index) ? "checked" : ""}><span>${name}</span></label>`).join("")}
      </div></fieldset>` : `<label class="field"><span>적용 날짜</span><input name="date" type="date" value="${editing?.date ?? defaultDate}" required></label>`}
      <div class="form-grid two">
        <label class="field"><span>준비 시간</span><div class="input-unit"><input name="preparationMinutes" type="number" min="0" max="240" step="5" value="${editing?.preparationMinutes ?? 30}" required><span>분</span></div></label>
        <label class="field"><span>이동·통학 시간</span><div class="input-unit"><input name="commuteMinutes" type="number" min="0" max="240" step="5" value="${editing?.commuteMinutes ?? 30}" required><span>분</span></div></label>
      </div>
      <div class="form-note">${icon("spark")} ${type === "fixed" ? "매주 해당 요일의 계획에 반복 반영돼요." : "이 날짜의 수면 계획만 즉시 다시 계산해요."}</div>
      <button class="primary-button full" type="submit">${editing ? "수정 내용 저장" : `${icon("plus")} 일정 추가하기`}</button>
    </form>
  </section>`;
}

function renderSchedule() {
  const fixed = state.schedules.filter((schedule) => schedule.kind === "fixed");
  const variable = state.schedules.filter((schedule) => schedule.kind === "variable").sort((a, b) => a.date.localeCompare(b.date));
  return `
    <section class="page-heading compact-heading">
      <div><span class="section-kicker">SCHEDULE</span><h1>일정이 달라지면, 계획도 달라져야 하니까.</h1><p>반복 일정과 이번 주에만 생긴 변동 일정을 나눠서 관리하세요.</p></div>
    </section>
    <div class="schedule-layout">
      ${renderScheduleForm()}
      <div class="schedule-lists">
        <section class="card schedule-list-card">
          <div class="card-heading"><div><span class="card-kicker">REPEATING</span><h3>고정 일정 <em>${fixed.length}</em></h3></div><span class="soft-chip">주간 자동 반영</span></div>
          <div class="schedule-list">${fixed.length ? fixed.map(scheduleCard).join("") : `<div class="empty-state">${icon("calendar")}<b>고정 일정이 아직 없어요</b><p>수업이나 반복 아르바이트를 추가해 보세요.</p></div>`}</div>
        </section>
        <section class="card schedule-list-card">
          <div class="card-heading"><div><span class="card-kicker">ONE-OFF</span><h3>변동 일정 <em>${variable.length}</em></h3></div><span class="soft-chip accent">해당 날짜만 반영</span></div>
          <div class="schedule-list">${variable.length ? variable.map(scheduleCard).join("") : `<div class="empty-state">${icon("calendar")}<b>변동 일정이 없어요</b><p>시험, 약속, 회의를 특정 날짜에 추가해 보세요.</p></div>`}</div>
        </section>
      </div>
    </div>`;
}

function scoreOptions(name, labels) {
  return `<div class="score-options">${labels.map((label, index) => `<label><input type="radio" name="${name}" value="${index + 1}" ${index === 2 ? "checked" : ""} required><span><b>${index + 1}</b><small>${label}</small></span></label>`).join("")}</div>`;
}

function feedbackCard(entry) {
  const freshnessLabels = ["매우 피곤", "피곤", "보통", "개운", "매우 개운"];
  return `<article class="feedback-item">
    <div class="feedback-score">${entry.freshness}<small>/ 5</small></div>
    <div><b>${entry.date} · ${freshnessLabels[entry.freshness - 1]}</b><span>${entry.actualSleep} 취침 → ${entry.actualWake} 기상</span></div>
    <span class="soft-chip">낮 졸림 ${entry.sleepiness}</span>
  </article>`;
}

function renderFeedback() {
  const impact = feedbackAdjustment(state.feedback);
  const plan = getPlans()[0];
  return `
    <section class="page-heading compact-heading">
      <div><span class="section-kicker">MORNING CHECK</span><h1>어젯밤은 어땠나요?</h1><p>30초 피드백이 다음 수면 계획을 더 현실적으로 만들어요.</p></div>
      <span class="live-chip calm"><i></i> 상세 수면 기록은 나에게만 보여요</span>
    </section>
    <div class="feedback-layout">
      <section class="card form-card feedback-form-card">
        <div class="card-heading"><div><span class="card-kicker">QUICK CHECK</span><h3>오늘의 기상 체크</h3></div><span class="step-chip">약 30초</span></div>
        <form id="feedback-form">
          <input type="hidden" name="date" value="${dateKey(new Date())}">
          <div class="form-grid two">
            <label class="field"><span>실제 취침 시각</span><input name="actualSleep" type="time" value="${plan.bedtimeCenter}" required></label>
            <label class="field"><span>실제 기상 시각</span><input name="actualWake" type="time" value="${state.profile.targetWake}" required></label>
          </div>
          <fieldset class="field score-field"><legend>아침에 얼마나 개운했나요?</legend>${scoreOptions("freshness", ["많이 피곤", "피곤", "보통", "개운", "아주 개운"])}</fieldset>
          <fieldset class="field score-field"><legend>낮에 얼마나 졸렸나요?</legend>${scoreOptions("sleepiness", ["전혀 아님", "조금", "보통", "졸림", "매우 졸림"])}</fieldset>
          <label class="field"><span>계획을 지키기 어려웠다면</span><select name="failureReason"><option value="">해당 없음</option><option>휴대폰을 오래 봄</option><option>과제·공부</option><option>늦은 약속</option><option>잠이 오지 않음</option><option>기타</option></select></label>
          <button class="primary-button full" type="submit">피드백 저장하고 다음 계획에 반영</button>
        </form>
      </section>
      <div class="feedback-side">
        <section class="impact-card">
          <span class="impact-icon">${icon("spark")}</span><div><span>현재 개인화 반영</span><h3>${impact.minutes ? `수면 여유 +${impact.minutes}분` : "기본 리듬 유지"}</h3><p>${impact.reason ?? "첫 피드백을 남기면 다음 계획에 반영할게요."}</p></div>
        </section>
        <section class="card history-card">
          <div class="card-heading"><div><span class="card-kicker">RECENT</span><h3>최근 기록</h3></div><span class="soft-chip">${state.feedback.length}회</span></div>
          <div class="feedback-list">${state.feedback.length ? [...state.feedback].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5).map(feedbackCard).join("") : `<div class="empty-state small">${icon("check")}<b>아직 기록이 없어요</b><p>첫 체크를 완료하면 변화가 여기에 쌓여요.</p></div>`}</div>
        </section>
      </div>
    </div>`;
}

function renderRhythm() {
  const plans = getPlans();
  const impact = feedbackAdjustment(state.feedback);
  return `
    <section class="page-heading compact-heading">
      <div><span class="section-kicker">MY RHYTHM</span><h1>도경님의 기준을 알려 주세요.</h1><p>앱이 무조건 일찍 자라고 하지 않도록, 원하는 리듬을 먼저 기준으로 삼아요.</p></div>
    </section>
    <div class="rhythm-layout">
      <section class="card form-card profile-card">
        <div class="card-heading"><div><span class="card-kicker">BASELINE</span><h3>기본 수면 목표</h3></div><span class="soft-chip">언제든 수정 가능</span></div>
        <form id="profile-form">
          <label class="field"><span>이름</span><input name="name" value="${escapeHtml(state.profile.name)}" required maxlength="10"></label>
          <div class="form-grid two">
            <label class="field"><span>희망 기상 시각</span><input name="targetWake" type="time" value="${state.profile.targetWake}" required></label>
            <label class="field"><span>목표 수면 시간</span><div class="input-unit"><input name="targetSleepHours" type="number" min="5" max="10" step="0.5" value="${state.profile.targetSleepMinutes / 60}" required><span>시간</span></div></label>
          </div>
          <div class="form-grid two">
            <label class="field"><span>평균 입면 시간</span><div class="input-unit"><input name="latencyMinutes" type="number" min="0" max="120" step="1" value="${state.profile.latencyMinutes}" required><span>분</span></div></label>
            <label class="field"><span>취침 준비 루틴</span><div class="input-unit"><input name="routineMinutes" type="number" min="0" max="180" step="5" value="${state.profile.routineMinutes}" required><span>분</span></div></label>
          </div>
          <label class="field"><span>개인화 적응 주차</span><select name="adaptationWeek"><option value="1" ${state.profile.adaptationWeek === 1 ? "selected" : ""}>1주차 · 탐색 시작</option><option value="2" ${state.profile.adaptationWeek === 2 ? "selected" : ""}>2주차 · 패턴 확인</option><option value="3" ${state.profile.adaptationWeek === 3 ? "selected" : ""}>3주차 · 기준 안정화</option><option value="4" ${state.profile.adaptationWeek >= 4 ? "selected" : ""}>안정화 이후</option></select></label>
          <button class="primary-button full" type="submit">내 기준 저장하기</button>
        </form>
      </section>

      <section class="card policy-card">
        <div class="card-heading"><div><span class="card-kicker">UPDATE POLICY</span><h3>추천은 이렇게 바뀌어요</h3></div><span class="soft-chip accent">현재 ${state.profile.adaptationWeek}주차</span></div>
        <div class="policy-steps">
          <article class="${state.profile.adaptationWeek <= 3 ? "is-current" : ""}"><span>01</span><div><b>초기 2~3주</b><p>주 1회 전체 계획을 다시 계산하고, 변동 일정은 해당 날짜만 바로 반영해요.</p></div></article>
          <article class="${state.profile.adaptationWeek > 3 ? "is-current" : ""}"><span>02</span><div><b>리듬 안정화 이후</b><p>도경님이 요청할 때 전체 계획을 갱신하고, 피드백은 계속 리포트에 누적해요.</p></div></article>
          <article><span>03</span><div><b>과도한 변화 방지</b><p>낮은 컨디션이 반복돼도 한 번에 15~30분만 여유를 늘려 부담을 줄여요.</p></div></article>
        </div>
        <div class="policy-impact">${icon("spark")} <span><b>현재 적용값</b>${impact.reason ?? "피드백이 없어 기본 목표를 사용 중이에요."}</span></div>
      </section>
    </div>
    <section class="card plan-table-card">
      <div class="card-heading"><div><span class="card-kicker">WEEKLY PLAN</span><h3>7일 수면 계획</h3></div><span class="soft-chip">일정 변경 시 즉시 반영</span></div>
      <div class="plan-table">
        <div class="plan-row header"><span>기상일</span><span>첫 일정</span><span>취침 준비</span><span>불 끄기 구간</span><span>기상</span></div>
        ${plans.map((plan, index) => `<div class="plan-row ${index === 0 ? "highlight" : ""}"><span><b>${shortDate(plan.date)}</b>${index === 0 ? "<small>다음 계획</small>" : ""}</span><span>${escapeHtml(plan.primarySchedule ? `${plan.primarySchedule.startTime} ${plan.primarySchedule.title}` : "등록 일정 없음")}</span><span>${plan.routineStart}</span><span><b>${plan.bedtimeWindowStart}–${plan.bedtimeWindowEnd}</b></span><span>${plan.wakeTime}</span></div>`).join("")}
      </div>
    </section>`;
}

function render() {
  const views = {
    today: renderToday,
    schedule: renderSchedule,
    feedback: renderFeedback,
    rhythm: renderRhythm,
  };
  app.innerHTML = shell((views[ui.view] ?? renderToday)());
}

function toast(message) {
  ui.toast = message;
  render();
  window.setTimeout(() => {
    if (ui.toast === message) {
      ui.toast = "";
      render();
    }
  }, 2800);
}

document.addEventListener("click", (event) => {
  const viewButton = event.target.closest("[data-view]");
  if (viewButton) {
    ui.view = viewButton.dataset.view;
    ui.editScheduleId = null;
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }

  const actionButton = event.target.closest("[data-action]");
  if (!actionButton) return;
  const { action } = actionButton.dataset;

  if (action === "toggle-reason") {
    ui.showReason = !ui.showReason;
    render();
  }

  if (action === "save-plan") {
    state.savedPlanDate = getPlans()[0].targetDate;
    persist();
    toast("오늘의 수면 계획을 저장했어요.");
  }

  if (action === "toggle-alert") {
    const type = actionButton.dataset.alert;
    state.alertSettings[type] = !state.alertSettings[type];
    persist();
    render();
  }

  if (action === "schedule-type") {
    ui.scheduleType = actionButton.dataset.type;
    ui.editScheduleId = null;
    render();
  }

  if (action === "edit-schedule") {
    const schedule = state.schedules.find((item) => item.id === actionButton.dataset.id);
    if (schedule) {
      ui.editScheduleId = schedule.id;
      ui.scheduleType = schedule.kind;
      render();
      document.querySelector(".schedule-form-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  if (action === "cancel-edit") {
    ui.editScheduleId = null;
    render();
  }

  if (action === "delete-schedule") {
    const schedule = state.schedules.find((item) => item.id === actionButton.dataset.id);
    if (schedule && window.confirm(`‘${schedule.title}’ 일정을 삭제할까요?`)) {
      state.schedules = state.schedules.filter((item) => item.id !== schedule.id);
      if (ui.editScheduleId === schedule.id) ui.editScheduleId = null;
      persist();
      toast("일정을 삭제하고 수면 계획을 다시 계산했어요.");
    }
  }

  if (action === "reset-demo" && window.confirm("입력한 데모 데이터를 초기 상태로 되돌릴까요?")) {
    state = seedState();
    ui.view = "today";
    ui.editScheduleId = null;
    persist();
    toast("데모 데이터를 초기화했어요.");
  }
});

document.addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.target;
  const data = new FormData(form);

  if (form.id === "schedule-form") {
    const kind = form.dataset.kind;
    const days = data.getAll("days").map(Number);
    if (kind === "fixed" && !days.length) {
      toast("고정 일정의 반복 요일을 한 개 이상 선택해 주세요.");
      return;
    }

    const schedule = {
      id: form.dataset.editId || newId(),
      kind,
      title: String(data.get("title")).trim(),
      startTime: String(data.get("startTime")),
      preparationMinutes: Number(data.get("preparationMinutes")),
      commuteMinutes: Number(data.get("commuteMinutes")),
      ...(kind === "fixed" ? { days } : { date: String(data.get("date")) }),
    };
    const existingIndex = state.schedules.findIndex((item) => item.id === schedule.id);
    if (existingIndex >= 0) state.schedules.splice(existingIndex, 1, schedule);
    else state.schedules.push(schedule);
    ui.editScheduleId = null;
    persist();
    toast(kind === "variable" ? "변동 일정과 해당 날짜 계획을 업데이트했어요." : "고정 일정을 주간 계획에 반영했어요.");
  }

  if (form.id === "feedback-form") {
    const entry = {
      date: String(data.get("date")),
      actualSleep: String(data.get("actualSleep")),
      actualWake: String(data.get("actualWake")),
      freshness: Number(data.get("freshness")),
      sleepiness: Number(data.get("sleepiness")),
      failureReason: String(data.get("failureReason") || ""),
    };
    state.feedback = state.feedback.filter((item) => item.date !== entry.date);
    state.feedback.push(entry);
    persist();
    toast("피드백을 저장하고 다음 수면 계획을 조정했어요.");
  }

  if (form.id === "profile-form") {
    state.profile = {
      ...state.profile,
      name: String(data.get("name")).trim(),
      targetWake: String(data.get("targetWake")),
      targetSleepMinutes: Math.round(Number(data.get("targetSleepHours")) * 60),
      latencyMinutes: Number(data.get("latencyMinutes")),
      routineMinutes: Number(data.get("routineMinutes")),
      adaptationWeek: Number(data.get("adaptationWeek")),
    };
    persist();
    toast("도경님의 수면 기준으로 7일 계획을 다시 계산했어요.");
  }
});

render();

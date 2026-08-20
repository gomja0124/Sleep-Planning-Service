import {
  DAY_NAMES,
  addDays,
  applyPlanOffset,
  dateKey,
  formatDisplayTime,
  formatDuration,
  formatKoreanDate,
  generateRecommendations,
} from "./planner.mjs";
import { analyzeSleepHistory } from "./sleep-analysis.mjs";
import { createCommunity } from "./community/index.mjs";
import {
  createCommunityViewState,
  handleCommunityClick,
  handleCommunityInput,
  handleCommunitySubmit,
  renderCommunity as renderCommunityBoard,
} from "./community/ui.mjs";

const STORAGE_KEY = "bamgai-demo-v1";

// 게시판은 somni.js와 같은 모듈·같은 저장소를 쓴다. 어느 화면에서 글을 써도 함께 보인다.
const community = createCommunity();
const communityView = createCommunityViewState();

const CHARACTER_OPTIONS = {
  owl: {
    name: "루미",
    species: "올빼미",
    description: "조용히 계획을 세우고 차근차근 리듬을 맞춰요.",
  },
  bat: {
    name: "바미",
    species: "박쥐",
    description: "밤의 변화를 빠르게 알아채고 유연하게 계획을 바꿔요.",
  },
};

const CHALLENGES = [
  { id: "midnight", title: "12시 취침팟", goal: "오늘 00:00 전에 불 끄기", progress: 72, people: 18, reward: 30 },
  { id: "fifty-hours", title: "7일 50시간 수면", goal: "현재 32시간 · 18시간 남음", progress: 64, people: 42, reward: 80 },
];

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
  users: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m7-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm13 10v-2a4 4 0 0 0-3-3.9m-2-12a4 4 0 0 1 0 7.8"/></svg>`,
  gift: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12v9H4v-9M2 7h20v5H2V7Zm10 14V7m0 0H8.5A2.5 2.5 0 1 1 11 4.5V7Zm0 0h3.5A2.5 2.5 0 1 0 13 4.5V7Z"/></svg>`,
  refresh: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5m9.5-3A8 8 0 0 0 5.2 6M5.5 15A8 8 0 0 0 18.8 18"/></svg>`,
  minus: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg>`,
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
    selectedCharacter: null,
    onboardingComplete: false,
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
    adaptationState: {
      candidateTargetSleepMinutes: null,
      previousTargetSleepMinutes: null,
      evaluationStartDate: null,
      lastAdjustmentMinutes: 0,
    },
    recommendationHistory: {},
    alertSettings: { routine: true, "lights-out": true, wake: true },
    settings: { timeFormat: "24h" },
    calendarConnections: {
      apple: { connected: false, lastSyncedAt: null },
      google: { connected: false, lastSyncedAt: null },
    },
    planOverrides: {},
    sleepSession: { status: "idle", startedAt: null, dismissedAt: null, targetDate: null },
    community: { points: 120, groupStreak: 6, joinedChallenges: ["midnight"] },
    savedPlanDate: null,
  };
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved?.profile && Array.isArray(saved.schedules) && Array.isArray(saved.feedback)) {
      const base = seedState();
      const selectedCharacter = CHARACTER_OPTIONS[saved.selectedCharacter] ? saved.selectedCharacter : null;
      return {
        ...base,
        ...saved,
        selectedCharacter,
        onboardingComplete: Boolean(saved.onboardingComplete),
        profile: { ...base.profile, ...saved.profile },
        alertSettings: { ...base.alertSettings, ...saved.alertSettings },
        settings: { ...base.settings, ...saved.settings },
        calendarConnections: {
          apple: { ...base.calendarConnections.apple, ...saved.calendarConnections?.apple },
          google: { ...base.calendarConnections.google, ...saved.calendarConnections?.google },
        },
        planOverrides: { ...base.planOverrides, ...saved.planOverrides },
        adaptationState: { ...base.adaptationState, ...saved.adaptationState },
        recommendationHistory: { ...base.recommendationHistory, ...saved.recommendationHistory },
        sleepSession: { ...base.sleepSession, ...saved.sleepSession },
        community: { ...base.community, ...saved.community },
      };
    }
  } catch (error) {
    console.warn("저장된 데모 데이터를 불러오지 못했습니다.", error);
  }
  return seedState();
}

let state = loadState();
const ui = {
  view: state.sleepSession.status === "sleeping"
    ? "sleep"
    : state.sleepSession.status === "alarm"
      ? "alarm"
      : state.sleepSession.status === "checking"
        ? "feedback"
        : "today",
  characterDraft: state.selectedCharacter,
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
  const analysis = analyzeSleepHistory({
    profile: state.profile,
    feedback: state.feedback,
    adaptationState: state.adaptationState,
  });
  const planningProfile = {
    ...state.profile,
    targetSleepMinutes: analysis.recommendedTargetSleepMinutes,
  };
  return generateRecommendations({
    profile: planningProfile,
    schedules: state.schedules,
    feedback: [],
    startDate: addDays(new Date(), 1),
    days: 7,
  }).map((plan) => applyPlanOffset(plan, state.planOverrides[plan.targetDate] ?? 0));
}

function getSleepAnalysis() {
  return analyzeSleepHistory({
    profile: state.profile,
    feedback: state.feedback,
    adaptationState: state.adaptationState,
  });
}

function displayTime(value) {
  return formatDisplayTime(value, state.settings.timeFormat);
}

function connectedCalendars() {
  return Object.values(state.calendarConnections).filter((connection) => connection.connected).length;
}

function shortDate(date) {
  return `${date.getMonth() + 1}.${String(date.getDate()).padStart(2, "0")} ${DAY_NAMES[date.getDay()]}`;
}

function sleepGoalLabel() {
  return formatDuration(state.profile.targetSleepMinutes);
}

function characterArtwork(character, className = "") {
  const option = CHARACTER_OPTIONS[character] ?? CHARACTER_OPTIONS.owl;
  return `<span class="character-sprite character-${character} ${className}" role="img" aria-label="${option.species} 캐릭터 ${option.name}"></span>`;
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
          ${navItem("community", "커뮤니티", "users")}
          ${navItem("rhythm", "내 리듬", "chart")}
        </nav>
        <div class="phase-card">
          <span class="phase-label">개인화 적응 중</span>
          <strong>${state.profile.adaptationWeek}주차 <span>/ 3주</span></strong>
          <div class="progress-track"><span style="width:${Math.min(state.profile.adaptationWeek / 3, 1) * 100}%"></span></div>
          <p>수면 결과가 쌓일수록 추천이 도경님에게 더 가까워져요.</p>
        </div>
        <div class="sidebar-profile">
          ${characterArtwork(state.selectedCharacter, "avatar")}
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
        ${navItem("community", "커뮤니티", "users")}
        ${navItem("rhythm", "내 리듬", "chart")}
      </nav>
      ${ui.toast ? `<div class="toast" role="status">${icon("check")} ${escapeHtml(ui.toast)}</div>` : ""}
    </div>`;
}

function heroCharacter() {
  const selected = state.selectedCharacter ?? "owl";
  const option = CHARACTER_OPTIONS[selected];
  return `<div class="owl-wrap" aria-label="선택한 수면 메이트 ${option.species} ${option.name}">
    <div class="orbit orbit-one"></div><div class="orbit orbit-two"></div>
    ${characterArtwork(selected, "hero-character-art")}
    <span class="asset-note">나의 수면 메이트 · ${option.name}</span>
  </div>`;
}

function renderCharacterOnboarding() {
  const selected = ui.characterDraft;
  return `<main class="character-onboarding">
    <div class="onboarding-stars" aria-hidden="true"></div>
    <header class="onboarding-header">
      <span class="brand-mark">${icon("moon")}</span>
      <span><b>밤가이</b><small>나만의 수면 리듬 메이트</small></span>
    </header>
    <section class="onboarding-content">
      <span class="onboarding-step">첫 만남 · 1 / 2</span>
      <h1>오늘 밤을 함께할<br>친구를 골라주세요.</h1>
      <p>선택한 친구가 매일의 취침 계획과 아침 피드백을 함께할 거예요.<br>기능에는 차이가 없으니 마음이 가는 친구를 선택하세요.</p>
      <div class="character-grid" role="radiogroup" aria-label="수면 메이트 선택">
        ${Object.entries(CHARACTER_OPTIONS).map(([key, option]) => `<button class="character-choice ${selected === key ? "is-selected" : ""}" data-action="select-character" data-character="${key}" role="radio" aria-checked="${selected === key}">
          <span class="choice-check">${icon("check")}</span>
          ${characterArtwork(key, "choice-character-art")}
          <span class="character-copy"><small>${option.species}</small><b>${option.name}</b><em>${option.description}</em></span>
        </button>`).join("")}
      </div>
      <button class="onboarding-continue" data-action="confirm-character" ${selected ? "" : "disabled"}>
        ${selected ? `${CHARACTER_OPTIONS[selected].name}와 시작하기` : "친구를 선택해 주세요"} ${icon("arrow")}
      </button>
      <small class="onboarding-footnote">나중에 내 리듬 설정에서 다시 바꿀 수 있어요.</small>
    </section>
  </main>`;
}

function renderRhythmOnboarding() {
  const selected = state.selectedCharacter ?? "owl";
  const option = CHARACTER_OPTIONS[selected];
  return `<main class="rhythm-onboarding">
    <header class="onboarding-header rhythm-onboarding-header">
      <button class="onboarding-back" data-action="change-character" aria-label="캐릭터 선택으로 돌아가기">${icon("arrow")}</button>
      <span class="brand-mark">${icon("moon")}</span>
      <span><b>밤가이</b><small>내 리듬 초기 설정</small></span>
    </header>
    <section class="rhythm-onboarding-layout">
      <div class="rhythm-intro">
        <span class="onboarding-step">내 리듬 · 2 / 2</span>
        ${characterArtwork(selected, "rhythm-character-art")}
        <h1>${option.name}에게<br>도경님의 기준을 알려주세요.</h1>
        <p>두 가지만 입력하면 오늘 지킬 수 있는 취침 계획을 바로 만들어요. 캘린더 연결은 선택입니다.</p>
      </div>
      <form id="onboarding-form" class="onboarding-form-card">
        <div class="onboarding-form-heading"><span>필수 설정</span><b>언제 일어나고, 얼마나 자고 싶나요?</b></div>
        <div class="form-grid two">
          <label class="field"><span>일어나야 할 시간</span><input name="targetWake" type="time" value="${state.profile.targetWake}" required></label>
          <label class="field"><span>원하는 수면 길이</span><select name="targetSleepMinutes" required>
            ${[360,390,420,450,480,510,540].map((minutes) => `<option value="${minutes}" ${state.profile.targetSleepMinutes === minutes ? "selected" : ""}>${formatDuration(minutes)}</option>`).join("")}
          </select></label>
        </div>
        <fieldset class="field onboarding-choice-field"><legend>시간 표시</legend><div class="segmented radio-segmented">
          <label><input type="radio" name="timeFormat" value="24h" ${state.settings.timeFormat === "24h" ? "checked" : ""}><span>24시간제<small>23:30</small></span></label>
          <label><input type="radio" name="timeFormat" value="12h" ${state.settings.timeFormat === "12h" ? "checked" : ""}><span>12시간제<small>오후 11:30</small></span></label>
        </div></fieldset>
        <fieldset class="field onboarding-choice-field"><legend>캘린더 연결 <small>선택</small></legend><div class="calendar-choice-list">
          <label class="calendar-choice"><input type="checkbox" name="calendarProvider" value="apple" ${state.calendarConnections.apple.connected ? "checked" : ""}><span class="calendar-logo apple">A</span><span><b>Apple Calendar</b><small>iPhone 일정 변경을 계획에 반영</small></span><i>${icon("check")}</i></label>
          <label class="calendar-choice"><input type="checkbox" name="calendarProvider" value="google" ${state.calendarConnections.google.connected ? "checked" : ""}><span class="calendar-logo google">G</span><span><b>Google Calendar</b><small>학교·개인 일정을 선택 연결</small></span><i>${icon("check")}</i></label>
        </div></fieldset>
        <p class="permission-copy">현재 웹 프로토타입에서는 연결 상태만 저장합니다. 실제 일정 권한과 자동 동기화는 iOS PoC에서 연결합니다.</p>
        <button class="primary-button full onboarding-submit" type="submit">내 리듬 만들고 시작하기 ${icon("arrow")}</button>
      </form>
    </section>
  </main>`;
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
  const adjustment = getSleepAnalysis();
  const offsetLabel = plan.userOffsetMinutes
    ? `${plan.userOffsetMinutes > 0 ? "+" : ""}${plan.userOffsetMinutes}분 조절됨`
    : "추천값";

  return `
    <section class="page-heading">
      <div><span class="section-kicker">GOOD EVENING</span><h1>오늘 밤, 이 리듬이면 괜찮아요.</h1><p>내일 일정과 최근 컨디션을 반영한 도경님의 수면 계획이에요.</p></div>
      <span class="live-chip"><i></i> ${connectedCalendars() ? `캘린더 ${connectedCalendars()}개 동기화 중` : `${state.profile.adaptationWeek}주차 개인화 진행 중`}</span>
    </section>

    <section class="hero-card">
      <div class="hero-copy">
        <span class="hero-label">${icon("spark")} ${formatKoreanDate(plan.date)} 계획</span>
        <p class="hero-caption">권장 불 끄기 구간 · 5분 눈금으로 제안</p>
        <h2>${displayTime(plan.bedtimeWindowStart)}<span>—</span>${displayTime(plan.bedtimeWindowEnd)}</h2>
        <p class="hero-sub">${displayTime(plan.wakeTime)} 기상 · ${formatDuration(plan.sleepMinutes)} 확보 예상</p>
        <div class="time-stepper" aria-label="불 끄기 시각 1분 단위 조절">
          <button data-action="adjust-lights-out" data-delta="-1" aria-label="불 끄기 시각 1분 당기기">${icon("minus")}<span>1분</span></button>
          <strong><small>1분씩 직접 조절</small>${offsetLabel}</strong>
          <button data-action="adjust-lights-out" data-delta="1" aria-label="불 끄기 시각 1분 미루기"><span>1분</span>${icon("plus")}</button>
        </div>
        <div class="hero-actions">
          <button class="primary-button light" data-action="start-sleep">${icon("moon")} 수면 시작</button>
          <button class="text-button light-text" data-action="save-plan">${isSaved ? `${icon("check")} 계획 저장됨` : "오늘 계획 저장"}</button>
          <button class="text-button light-text" data-action="toggle-reason">${ui.showReason ? "근거 접기" : "계산 근거 보기"} ${icon("arrow")}</button>
        </div>
      </div>
      ${heroCharacter()}
      ${adjustment.suggestedAdjustmentMinutes ? `<span class="adjustment-badge">개인화 탐색 · ${adjustment.suggestedAdjustmentMinutes}분 추가</span>` : ""}
    </section>

    ${renderReasons(plan)}

    <div class="dashboard-grid">
      <section class="card timeline-card">
        <div class="card-heading"><div><span class="card-kicker">TONIGHT</span><h3>오늘 밤 타임라인</h3></div><span class="soft-chip">알림 3개</span></div>
        <div class="timeline">
          ${plan.alerts.map((alert, index) => `<div class="timeline-row">
            <div class="timeline-marker ${alert.type}">${index === 0 ? icon("moon") : index === 1 ? icon("spark") : icon("bell")}</div>
            <div><span>${alert.label}</span><b>${displayTime(alert.time)}</b></div>
            <span class="timeline-status">${state.alertSettings[alert.type] ? "알림 켬" : "알림 끔"}</span>
          </div>`).join("")}
        </div>
      </section>

      <section class="card next-card">
        <div class="card-heading"><div><span class="card-kicker">TOMORROW</span><h3>내일 첫 일정</h3></div><button class="icon-button bordered" data-view="schedule" aria-label="일정 보기">${icon("arrow")}</button></div>
        ${primary ? `<div class="event-time"><b>${displayTime(primary.startTime)}</b><span>${escapeHtml(primary.title)}</span></div>
          <div class="event-meta"><span>${icon("route")} 통학 ${primary.commuteMinutes}분</span><span>${icon("clock")} 준비 ${primary.preparationMinutes}분</span></div>
          <div class="wake-callout"><span>필요 기상</span><strong>${displayTime(plan.wakeTime)}</strong></div>` : `<div class="empty-compact">내일 등록된 이른 일정이 없어요.<br>희망 기상 시각을 유지합니다.</div>`}
      </section>

      <section class="card alerts-card">
        <div class="card-heading"><div><span class="card-kicker">REMINDERS</span><h3>루틴 알림</h3></div>${icon("bell")}</div>
        <div class="setting-list">
          ${plan.alerts.map((alert) => `<button class="setting-row" data-action="toggle-alert" data-alert="${alert.type}">
            <span><b>${alert.label}</b><small>${displayTime(alert.time)}</small></span><i class="switch ${state.alertSettings[alert.type] ? "on" : ""}"><span></span></i>
          </button>`).join("")}
        </div>
      </section>
    </div>

    <section class="card week-card">
      <div class="card-heading"><div><span class="card-kicker">NEXT 7 DAYS</span><h3>이번 주 리듬 미리보기</h3></div><button class="text-button" data-view="rhythm">전체 계획 ${icon("arrow")}</button></div>
      <div class="week-strip">
        <div class="day-plan is-today"><span>${shortDate(plan.date)}</span><b>${displayTime(plan.bedtimeWindowStart)}</b><small>${plan.primarySchedule?.title ?? "희망 기상 기준"}</small></div>
        ${laterPlans.slice(0, 5).map((item) => `<div class="day-plan"><span>${shortDate(item.date)}</span><b>${displayTime(item.bedtimeWindowStart)}</b><small>${escapeHtml(item.primarySchedule?.title ?? "기본 리듬")}</small></div>`).join("")}
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
    <div class="schedule-date-box"><b>${displayTime(schedule.startTime)}</b><span>${schedule.kind === "fixed" ? "고정" : "변동"}</span></div>
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
    <div><b>${entry.date} · ${freshnessLabels[entry.freshness - 1]}</b><span>${displayTime(entry.actualSleep)} 취침 → ${displayTime(entry.actualWake)} 기상</span></div>
    <span class="soft-chip">낮 졸림 ${entry.sleepiness}</span>
  </article>`;
}

function renderFeedback() {
  const impact = getSleepAnalysis();
  const plan = getPlans()[0];
  const cameFromAlarm = state.sleepSession.status === "checking";
  return `
    <section class="page-heading compact-heading">
      <div><span class="section-kicker">MORNING CHECK</span><h1>어젯밤은 어땠나요?</h1><p>30초 피드백이 다음 수면 계획을 더 현실적으로 만들어요.</p></div>
      <span class="live-chip calm"><i></i> ${cameFromAlarm ? "알람이 꺼졌어요 · 기상 체크를 완료해 주세요" : "상세 수면 기록은 나에게만 보여요"}</span>
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
          <div class="form-grid two">
            <label class="field"><span>불 끈 뒤 잠들기까지</span><select name="sleepOnsetDelayMinutes"><option value="">기억나지 않음</option><option value="0">거의 바로</option><option value="20">10~30분</option><option value="45">30~60분</option><option value="60">60분 이상</option></select></label>
            <label class="field"><span>낮잠 시간</span><div class="input-unit"><input name="napDurationMinutes" type="number" min="0" max="240" step="5" placeholder="없으면 0"><span>분</span></div></label>
          </div>
          <label class="field"><span>낮잠을 잤다면 이유</span><select name="napReason"><option value="">해당 없음</option><option value="졸려서">졸려서</option><option value="전날 잠이 부족해서">전날 잠이 부족해서</option><option value="습관적으로">습관적으로</option><option value="휴식하려고">휴식하려고</option><option value="기타">기타</option></select></label>
          <fieldset class="field score-field"><legend>아침에 얼마나 개운했나요?</legend>${scoreOptions("freshness", ["많이 피곤", "피곤", "보통", "개운", "아주 개운"])}</fieldset>
          <fieldset class="field score-field"><legend>낮에 얼마나 졸렸나요?</legend>${scoreOptions("sleepiness", ["전혀 아님", "조금", "보통", "졸림", "매우 졸림"])}</fieldset>
          <label class="field"><span>계획을 지키기 어려웠다면</span><select name="failureReason"><option value="">해당 없음</option><option>휴대폰을 오래 봄</option><option>과제·공부</option><option>늦은 약속</option><option>잠이 오지 않음</option><option>기타</option></select></label>
          <button class="primary-button full" type="submit">피드백 저장하고 다음 계획에 반영</button>
        </form>
      </section>
      <div class="feedback-side">
        <section class="impact-card">
          <span class="impact-icon">${icon("spark")}</span><div><span>현재 개인화 반영</span><h3>${impact.suggestedAdjustmentMinutes ? `목표 수면 +${impact.suggestedAdjustmentMinutes}분` : impact.adjustmentStrategy === "REACH_CURRENT_TARGET" ? "현재 목표 먼저 확보" : "현재 목표 관찰"}</h3><p>${impact.reasons[0]?.message ?? "첫 피드백을 남기면 다음 계획에 반영할게요."}</p></div>
        </section>
        <section class="card history-card">
          <div class="card-heading"><div><span class="card-kicker">RECENT</span><h3>최근 기록</h3></div><span class="soft-chip">${state.feedback.length}회</span></div>
          <div class="feedback-list">${state.feedback.length ? [...state.feedback].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5).map(feedbackCard).join("") : `<div class="empty-state small">${icon("check")}<b>아직 기록이 없어요</b><p>첫 체크를 완료하면 변화가 여기에 쌓여요.</p></div>`}</div>
        </section>
      </div>
    </div>`;
}

function renderSleepMode() {
  const plan = getPlans()[0];
  const selected = state.selectedCharacter ?? "owl";
  const now = new Date();
  const nowValue = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  return `<main class="device-stage sleep-stage">
    <section class="lockscreen-preview" aria-label="iPhone 잠금화면 Live Activity 미리보기">
      <div class="dynamic-island" aria-hidden="true"></div>
      <div class="lockscreen-date">${formatKoreanDate(now)}</div>
      <div class="lockscreen-time">${displayTime(nowValue)}</div>
      <div class="lockscreen-space"></div>
      <article class="live-activity-card">
        <div class="live-activity-top"><span><i></i> 수면 중</span><small>밤가이 Live Activity</small></div>
        <div class="live-activity-body">
          ${characterArtwork(selected, "live-character-art")}
          <div><small>예정 기상</small><strong>${displayTime(plan.wakeTime)}</strong><p>${CHARACTER_OPTIONS[selected].name}가 조용히 곁을 지키고 있어요.</p></div>
        </div>
        <div class="live-progress"><span style="width:42%"></span></div>
        <div class="live-activity-bottom"><span>수면 계획 진행 중</span><b>${formatDuration(plan.sleepMinutes)} 목표</b></div>
      </article>
      <div class="lockscreen-actions">
        <button class="ghost-button dark" data-action="end-sleep">수면 종료</button>
        <button class="primary-button light" data-action="preview-alarm">기상 알람 미리보기 ${icon("arrow")}</button>
      </div>
      <small class="prototype-note">웹에서는 잠금화면 경험을 시뮬레이션합니다. 실제 앱은 ActivityKit·WidgetKit으로 연결합니다.</small>
    </section>
  </main>`;
}

function renderAlarm() {
  const plan = getPlans()[0];
  const selected = state.selectedCharacter ?? "owl";
  return `<main class="alarm-screen">
    <div class="alarm-glow" aria-hidden="true"></div>
    <header><span class="brand-mark">${icon("moon")}</span><b>밤가이 기상 알람</b></header>
    <section class="alarm-content">
      <span class="alarm-label">GOOD MORNING</span>
      <h1>기상하셨네요<br>${escapeHtml(state.profile.name)}님.</h1>
      <p>${displayTime(plan.wakeTime)} · 오늘의 첫 약속을 준비할 시간이에요.</p>
      ${characterArtwork(selected, "alarm-character-art")}
      <div class="alarm-character-copy">${CHARACTER_OPTIONS[selected].name}도 함께 일어났어요.</div>
    </section>
    <button class="alarm-dismiss" data-action="dismiss-alarm">${icon("bell")} 알람 끄기</button>
    <small class="alarm-footnote">알람을 끄면 바로 기상 체크가 이어집니다.</small>
  </main>`;
}

function renderCommunity() {
  const joined = new Set(state.community.joinedChallenges);
  return `<section class="community-page">
    <section class="page-heading compact-heading community-heading">
      <div><span class="section-kicker">COMMUNITY</span><h1>같이 자는 약속은, 조금 더 지키기 쉬워요.</h1><p>게시판에서 친구를 만나고 우리만의 취침팟과 도전을 만들어 보세요.</p></div>
      <div class="reward-wallet">${icon("gift")}<span><small>꾸미기 포인트</small><b>${state.community.points} P</b></span></div>
    </section>

    <section class="community-streak-card">
      <div><span>서울대 멋사 낮밤바꾸기 취침팟</span><h2>모두 함께 ${state.community.groupStreak}일째</h2><p>오늘은 8명 중 6명이 수면 준비를 완료했어요.</p></div>
      <div class="streak-orbit">${characterArtwork(state.selectedCharacter ?? "owl", "streak-character-art")}<b>${state.community.groupStreak}</b><small>DAYS</small></div>
    </section>

    <div class="community-grid">
      <section class="card board-card cm-theme-day">
        ${renderCommunityBoard(community, communityView)}
      </section>

      <section class="card challenge-list-card">
        <div class="card-heading"><div><span class="card-kicker">CHALLENGES</span><h3>진행 중인 도전</h3></div><span class="soft-chip accent">개강 시즌</span></div>
        <div class="challenge-list">${CHALLENGES.map((challenge) => `<article class="challenge-card">
          <div class="challenge-title"><span>${icon("moon")}</span><div><h4>${challenge.title}</h4><p>${challenge.goal}</p></div></div>
          <div class="challenge-progress"><span style="width:${challenge.progress}%"></span></div>
          <div class="challenge-meta"><span>${challenge.people}명 함께 도전</span><b>+${challenge.reward} P</b></div>
          <button class="${joined.has(challenge.id) ? "joined" : ""}" data-action="toggle-challenge" data-challenge="${challenge.id}">${joined.has(challenge.id) ? `${icon("check")} 참여 중` : "도전 참여하기"}</button>
        </article>`).join("")}</div>
      </section>
    </div>

    <section class="card dressing-preview">
      <div><span class="card-kicker">REWARDS</span><h3>잘 잔 만큼 밤가이의 방이 포근해져요.</h3><p>기상 체크와 공동 도전을 완료해 시즌 의상, 액세서리, 방 배경을 모아 보세요.</p><button class="primary-button" data-action="open-dressing">꾸미기 미리보기</button></div>
      <div class="reward-items"><span>개강 달 쿠션<small>보유</small></span><span>별빛 안대<small>80 P</small></span><span>구름 침대<small>120 P</small></span></div>
      ${characterArtwork(state.selectedCharacter ?? "owl", "dressing-character-art")}
    </section>
  </section>`;
}

function calendarConnectionRow(provider, label, description) {
  const connection = state.calendarConnections[provider];
  const syncLabel = connection.lastSyncedAt
    ? new Date(connection.lastSyncedAt).toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit" })
    : "동기화 전";
  return `<div class="calendar-setting-row">
    <span class="calendar-logo ${provider}">${provider === "apple" ? "A" : "G"}</span>
    <span><b>${label}</b><small>${connection.connected ? `연결됨 · ${syncLabel}` : description}</small></span>
    <button class="ghost-button compact" data-action="toggle-calendar" data-provider="${provider}">${connection.connected ? "연결 해제" : "연결"}</button>
  </div>`;
}

function renderRhythm() {
  const plans = getPlans();
  const impact = getSleepAnalysis();
  return `
    <section class="page-heading compact-heading">
      <div><span class="section-kicker">MY RHYTHM</span><h1>도경님의 기준을 알려 주세요.</h1><p>앱이 무조건 일찍 자라고 하지 않도록, 원하는 리듬을 먼저 기준으로 삼아요.</p></div>
    </section>
    <div class="rhythm-layout">
      <section class="card form-card profile-card">
        <div class="card-heading"><div><span class="card-kicker">BASELINE</span><h3>기본 수면 목표</h3></div><button class="ghost-button compact" data-action="change-character">캐릭터 변경</button></div>
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
        <div class="policy-impact">${icon("spark")} <span><b>현재 적용값</b>${impact.reasons[0]?.message ?? "피드백이 없어 기본 목표를 사용 중이에요."}</span></div>
      </section>
    </div>
    <section class="settings-grid">
      <section class="card settings-card">
        <div class="card-heading"><div><span class="card-kicker">TIME FORMAT</span><h3>시간 표시 설정</h3></div><span class="soft-chip">앱 전체 적용</span></div>
        <div class="segmented settings-segmented">
          <button class="${state.settings.timeFormat === "24h" ? "is-active" : ""}" data-action="set-time-format" data-format="24h"><b>24시간제</b><small>23:30</small></button>
          <button class="${state.settings.timeFormat === "12h" ? "is-active" : ""}" data-action="set-time-format" data-format="12h"><b>12시간제</b><small>오후 11:30</small></button>
        </div>
        <p>메인, 일정, 알람, 잠금화면 Live Activity의 시간이 함께 바뀝니다.</p>
      </section>
      <section class="card calendar-settings-card">
        <div class="card-heading"><div><span class="card-kicker">CALENDAR</span><h3>선택 캘린더 연결</h3></div><button class="icon-button bordered" data-action="sync-calendars" aria-label="캘린더 다시 동기화">${icon("refresh")}</button></div>
        <div class="calendar-setting-list">
          ${calendarConnectionRow("apple", "Apple Calendar", "iPhone 일정과 연결")}
          ${calendarConnectionRow("google", "Google Calendar", "학교·개인 일정과 연결")}
        </div>
        <div class="shortcut-card"><span>${icon("spark")}</span><div><b>iPhone 단축어 자동화</b><p>캘린더가 바뀌면 밤가이를 열어 계획을 갱신하도록 개인 자동화를 설정할 수 있어요.</p></div><button data-action="shortcut-guide">설정 안내</button></div>
        <small class="prototype-inline-note">웹 데모는 연결·동기화 상태를 시뮬레이션하며 실제 권한은 요청하지 않습니다.</small>
      </section>
    </section>
    <section class="card plan-table-card">
      <div class="card-heading"><div><span class="card-kicker">WEEKLY PLAN</span><h3>7일 수면 계획</h3></div><span class="soft-chip">일정 변경 시 즉시 반영</span></div>
      <div class="plan-table">
        <div class="plan-row header"><span>기상일</span><span>첫 일정</span><span>취침 준비</span><span>불 끄기 구간</span><span>기상</span></div>
        ${plans.map((plan, index) => `<div class="plan-row ${index === 0 ? "highlight" : ""}"><span><b>${shortDate(plan.date)}</b>${index === 0 ? "<small>다음 계획</small>" : ""}</span><span>${escapeHtml(plan.primarySchedule ? `${displayTime(plan.primarySchedule.startTime)} ${plan.primarySchedule.title}` : "등록 일정 없음")}</span><span>${displayTime(plan.routineStart)}</span><span><b>${displayTime(plan.bedtimeWindowStart)}–${displayTime(plan.bedtimeWindowEnd)}</b></span><span>${displayTime(plan.wakeTime)}</span></div>`).join("")}
      </div>
    </section>`;
}

function render() {
  if (!state.selectedCharacter) {
    app.innerHTML = renderCharacterOnboarding();
    return;
  }
  if (!state.onboardingComplete) {
    app.innerHTML = renderRhythmOnboarding();
    return;
  }
  if (ui.view === "sleep") {
    app.innerHTML = renderSleepMode();
    return;
  }
  if (ui.view === "alarm") {
    app.innerHTML = renderAlarm();
    return;
  }
  const views = {
    today: renderToday,
    schedule: renderSchedule,
    feedback: renderFeedback,
    community: renderCommunity,
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

document.addEventListener("click", async (event) => {
  // 게시판 카드는 button이 아니라서 아래 data-action 검사보다 먼저 물어본다.
  const board = await handleCommunityClick(event, {
    community,
    view: communityView,
    confirm: (message) => window.confirm(message),
  });
  if (board.handled) {
    if (board.toast) toast(board.toast);
    else render();
    return;
  }

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

  if (action === "select-character") {
    ui.characterDraft = actionButton.dataset.character;
    render();
  }

  if (action === "confirm-character" && CHARACTER_OPTIONS[ui.characterDraft]) {
    state.selectedCharacter = ui.characterDraft;
    persist();
    ui.view = state.onboardingComplete ? "today" : "rhythm-onboarding";
    render();
  }

  if (action === "change-character") {
    ui.characterDraft = state.selectedCharacter;
    state.selectedCharacter = null;
    persist();
    render();
  }

  if (action === "toggle-reason") {
    ui.showReason = !ui.showReason;
    render();
  }

  if (action === "save-plan") {
    state.savedPlanDate = getPlans()[0].targetDate;
    persist();
    toast("오늘의 수면 계획을 저장했어요.");
  }

  if (action === "adjust-lights-out") {
    const plan = getPlans()[0];
    const current = Number(state.planOverrides[plan.targetDate] ?? 0);
    const next = Math.min(120, Math.max(-120, current + Number(actionButton.dataset.delta)));
    state.planOverrides[plan.targetDate] = next;
    state.savedPlanDate = null;
    persist();
    render();
  }

  if (action === "start-sleep") {
    const plan = getPlans()[0];
    state.savedPlanDate = plan.targetDate;
    state.sleepSession = {
      status: "sleeping",
      startedAt: new Date().toISOString(),
      dismissedAt: null,
      targetDate: plan.targetDate,
    };
    ui.view = "sleep";
    persist();
    render();
  }

  if (action === "preview-alarm") {
    state.sleepSession.status = "alarm";
    ui.view = "alarm";
    persist();
    render();
  }

  if (action === "end-sleep") {
    state.sleepSession.status = "idle";
    ui.view = "today";
    persist();
    toast("수면 세션을 종료했어요.");
  }

  if (action === "dismiss-alarm") {
    state.sleepSession.status = "checking";
    state.sleepSession.dismissedAt = new Date().toISOString();
    ui.view = "feedback";
    persist();
    render();
  }

  if (action === "set-time-format") {
    state.settings.timeFormat = actionButton.dataset.format === "12h" ? "12h" : "24h";
    persist();
    render();
  }

  if (action === "toggle-calendar") {
    const provider = actionButton.dataset.provider;
    const connection = state.calendarConnections[provider];
    if (connection) {
      connection.connected = !connection.connected;
      connection.lastSyncedAt = connection.connected ? new Date().toISOString() : null;
      state.savedPlanDate = null;
      persist();
      toast(`${provider === "apple" ? "Apple" : "Google"} Calendar ${connection.connected ? "연결 상태를 저장했어요." : "연결을 해제했어요."}`);
    }
  }

  if (action === "sync-calendars") {
    const active = Object.values(state.calendarConnections).filter((connection) => connection.connected);
    if (!active.length) {
      toast("먼저 연결할 캘린더를 선택해 주세요.");
    } else {
      const syncedAt = new Date().toISOString();
      active.forEach((connection) => { connection.lastSyncedAt = syncedAt; });
      state.savedPlanDate = null;
      persist();
      toast("변경된 일정을 확인하고 수면 계획을 다시 계산했어요.");
    }
  }

  if (action === "shortcut-guide") {
    toast("iPhone 단축어 → 자동화 → 앱 열기에서 밤가이를 선택하는 흐름으로 연결할 예정이에요.");
  }

  if (action === "toggle-challenge") {
    const challengeId = actionButton.dataset.challenge;
    const joined = new Set(state.community.joinedChallenges);
    if (joined.has(challengeId)) joined.delete(challengeId);
    else joined.add(challengeId);
    state.community.joinedChallenges = [...joined];
    persist();
    toast(joined.has(challengeId) ? "도전에 참여했어요. 오늘 수면 기록부터 함께 채워요." : "도전 참여를 취소했어요.");
  }

  if (action === "open-dressing") {
    toast(`현재 ${state.community.points}P를 보유하고 있어요. 꾸미기 저장은 다음 단계에서 연결해요.`);
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
    ui.characterDraft = null;
    ui.view = "today";
    ui.editScheduleId = null;
    persist();
    toast("데모 데이터를 초기화했어요.");
  }
});

document.addEventListener("submit", async (event) => {
  // await보다 먼저 막아야 한다. 마이크로태스크로 넘어간 뒤에는 브라우저가 이미 폼을 보낸 뒤다.
  event.preventDefault();

  const board = await handleCommunitySubmit(event, { community, view: communityView });
  if (board.handled) {
    if (board.toast) toast(board.toast);
    else render();
    return;
  }

  const form = event.target;
  const data = new FormData(form);

  if (form.id === "onboarding-form") {
    const providers = new Set(data.getAll("calendarProvider").map(String));
    const syncedAt = new Date().toISOString();
    state.profile = {
      ...state.profile,
      targetWake: String(data.get("targetWake")),
      targetSleepMinutes: Number(data.get("targetSleepMinutes")),
    };
    state.settings.timeFormat = data.get("timeFormat") === "12h" ? "12h" : "24h";
    Object.keys(state.calendarConnections).forEach((provider) => {
      const connected = providers.has(provider);
      state.calendarConnections[provider] = {
        connected,
        lastSyncedAt: connected ? syncedAt : null,
      };
    });
    state.onboardingComplete = true;
    ui.view = "today";
    persist();
    toast(`${CHARACTER_OPTIONS[state.selectedCharacter].name}와 도경님의 첫 수면 계획을 만들었어요.`);
    return;
  }

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
    const plan = getPlans()[0];
    const entry = {
      date: String(data.get("date")),
      actualSleep: String(data.get("actualSleep")),
      actualWake: String(data.get("actualWake")),
      freshness: Number(data.get("freshness")),
      sleepiness: Number(data.get("sleepiness")),
      failureReason: String(data.get("failureReason") || ""),
      sleepOnsetDelayMinutes: data.get("sleepOnsetDelayMinutes") === ""
        ? null
        : Number(data.get("sleepOnsetDelayMinutes")),
      napDurationMinutes: data.get("napDurationMinutes") === ""
        ? null
        : Number(data.get("napDurationMinutes")),
      napReason: String(data.get("napReason") || ""),
      recommendationSnapshot: {
        targetDate: plan.targetDate,
        bedtimeWindowStart: plan.bedtimeWindowStart,
        bedtimeWindowEnd: plan.bedtimeWindowEnd,
        bedtimeCenter: plan.bedtimeCenter,
        wakeTime: plan.wakeTime,
        targetSleepMinutes: plan.sleepMinutes,
      },
    };
    state.feedback = state.feedback.filter((item) => item.date !== entry.date);
    state.feedback.push(entry);
    state.recommendationHistory[entry.date] = entry.recommendationSnapshot;

    const analysis = getSleepAnalysis();
    if (analysis.suggestedAdjustmentMinutes > 0
      && analysis.recommendedTargetSleepMinutes !== state.profile.targetSleepMinutes) {
      const previousTarget = state.profile.targetSleepMinutes;
      state.profile.targetSleepMinutes = analysis.recommendedTargetSleepMinutes;
      state.adaptationState = {
        ...state.adaptationState,
        previousTargetSleepMinutes: previousTarget,
        candidateTargetSleepMinutes: analysis.recommendedTargetSleepMinutes,
        evaluationStartDate: entry.date,
        lastAdjustmentMinutes: analysis.suggestedAdjustmentMinutes,
      };
    }
    const completedAlarmFlow = state.sleepSession.status === "checking";
    if (completedAlarmFlow) {
      state.sleepSession.status = "complete";
      state.community.points += 10;
      ui.view = "today";
    }
    persist();
    toast(completedAlarmFlow
      ? "기상 체크 완료 · 꾸미기 포인트 10P를 받았어요."
      : "피드백을 저장하고 다음 수면 계획을 조정했어요.");
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

// 검색은 글자마다 다시 그리므로 입력 위치를 되돌려 준다.
document.addEventListener("input", (event) => {
  if (!handleCommunityInput(event, { view: communityView }).handled) return;
  render();
  const search = app.querySelector('[data-cm-input="query"]');
  if (!search) return;
  search.focus();
  search.setSelectionRange(search.value.length, search.value.length);
});

render();
community.load().catch(() => {}).finally(render);

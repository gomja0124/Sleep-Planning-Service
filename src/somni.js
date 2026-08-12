import { api } from "./api-client.js";

const app = document.querySelector("#app");
const storeKey = "somni-prototype-v2";
// Temporary local QA mode: the backend assigns each submission a new virtual
// date, so the three-record recommendation threshold can be tested immediately.
const testRecordMode = location.hostname === "localhost" || location.hostname === "127.0.0.1";

const companions = {
  cat: { name: "Momo", ko: "모모", label: "포근한 휴식", species: "고양이", row: 0 },
  bat: { name: "Bami", ko: "바미", label: "조용한 밤", species: "박쥐", row: 1 },
  owl: { name: "Lumi", ko: "루미", label: "규칙적인 리듬", species: "부엉이", row: 2 },
};
const emotions = { sleeping: 0, grumpy: 1, yawning: 2, tired: 3 };
const initial = {
  onboarding: false,
  step: 0,
  companion: "cat",
  name: "도경",
  bedtime: "23:30",
  wake: "07:30",
  screen: "home",
  routine: { sound: false, breathe: false, journal: false },
  checkin: { actualSleep: "23:30", actualWake: "07:30", freshness: 3, sleepiness: 3, sleepOnsetDelayMinutes: "", napDurationMinutes: "", napReason: "" },
  pendingFeedback: null,
  pendingSleepStart: false,
  plan: null,
  feedback: [],
  sleepAnalysis: null,
  activeSession: null,
  backendConnected: false,
  authResolved: false,
  authenticated: false,
  authMode: "welcome",
  socialProviders: { google: false, apple: false },
  calendarConnections: {
    apple: { connected: false, syncMode: "manual", lastSyncedAt: null },
    google: { connected: false, syncMode: "manual", lastSyncedAt: null },
  },
};

function loadLocalState() {
  try { return JSON.parse(localStorage.getItem(storeKey) || "{}"); }
  catch { return {}; }
}

let state = { ...initial, ...loadLocalState() };
state.checkin = { ...initial.checkin, ...state.checkin };
state.authResolved = false;
state.authenticated = false;
state.calendarConnections = {
  apple: { ...initial.calendarConnections.apple, ...state.calendarConnections?.apple },
  google: { ...initial.calendarConnections.google, ...state.calendarConnections?.google },
};
let toastTimer;
let calendarSyncing = false;
let lastAutomaticSync = 0;
const icon = (name) => ({ home: "⌂", routine: "◌", report: "⌁", settings: "⚙", arrow: "→", check: "✓", moon: "☾", play: "▷", back: "‹", sound: "♬", breathe: "◌", journal: "✦", alarm: "◷", refresh: "↻" }[name] || "•");

function persist() {
  localStorage.setItem(storeKey, JSON.stringify(state));
}

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function tomorrowKey() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return dateKey(tomorrow);
}

function minutes(value) {
  const [hours, mins] = value.split(":").map(Number);
  return hours * 60 + mins;
}

function targetSleepMinutes() {
  const duration = (minutes(state.wake) - minutes(state.bedtime) + 1440) % 1440;
  return Math.min(600, Math.max(300, duration));
}

function formatDate() {
  return new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" })
    .format(new Date()).toUpperCase();
}

function formatLockDate() {
  return new Intl.DateTimeFormat("ko-KR", { weekday: "long", month: "long", day: "numeric" })
    .format(new Date());
}

function formatClock(date = new Date()) {
  return new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false })
    .format(date);
}

function formatMeridiem(value) {
  const [hour, minute] = value.split(":").map(Number);
  const period = hour < 12 ? "오전" : "오후";
  return `${period} ${hour % 12 || 12}:${String(minute).padStart(2, "0")}`;
}

function elapsedSleep() {
  const startedAt = state.activeSession?.startedAt ? new Date(state.activeSession.startedAt) : new Date();
  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - startedAt.getTime()) / 60000));
  return {
    label: `${Math.floor(elapsedMinutes / 60)}시간 ${String(elapsedMinutes % 60).padStart(2, "0")}분 수면 중`,
    progress: Math.min(100, Math.max(5, elapsedMinutes / targetSleepMinutes() * 100)),
    startedAt: formatMeridiem(`${String(startedAt.getHours()).padStart(2, "0")}:${String(startedAt.getMinutes()).padStart(2, "0")}`),
  };
}

function applyProfile(data) {
  if (!data) return;
  state.companion = companions[data.selectedCharacter] ? data.selectedCharacter : "owl";
  state.onboarding = Boolean(data.onboardingComplete);
  state.name = data.profile?.name || state.name;
  state.wake = data.profile?.targetWake || state.wake;
  for (const provider of ["apple", "google"]) {
    state.calendarConnections[provider] = {
      ...state.calendarConnections[provider],
      ...(data.calendarConnections?.[provider] ?? {}),
    };
  }
}

function resetSignedOutState() {
  state.authMode = "welcome";
  state.onboarding = false;
  state.step = 0;
  state.companion = initial.companion;
  state.name = initial.name;
  state.bedtime = initial.bedtime;
  state.wake = initial.wake;
  state.screen = "home";
  state.routine = { ...initial.routine };
  state.pendingFeedback = null;
  state.pendingSleepStart = false;
  state.plan = null;
  state.feedback = [];
  state.sleepAnalysis = null;
  state.activeSession = null;
  state.calendarConnections = {
    apple: { ...initial.calendarConnections.apple },
    google: { ...initial.calendarConnections.google },
  };
}

async function refreshPlan() {
  const data = await api.plans(tomorrowKey(), 7);
  state.plan = data.results?.[0] ?? null;
  state.sleepAnalysis = data.analysis ?? state.sleepAnalysis;
  if (state.plan?.bedtimeCenter) state.bedtime = state.plan.bedtimeCenter;
}

async function loadBackend() {
  try {
    const profile = await api.me();
    applyProfile(profile);
    state.backendConnected = true;
    state.authenticated = true;
    state.authResolved = true;
    if (!state.onboarding) state.step = 0;
    if (state.onboarding) {
      const [plans, sessions, feedback] = await Promise.all([
        api.plans(tomorrowKey(), 7),
        api.sleepSessions(),
        api.feedback(),
      ]);
      state.plan = plans.results?.[0] ?? null;
      if (state.plan?.bedtimeCenter) state.bedtime = state.plan.bedtimeCenter;
      state.activeSession = sessions.results?.find((item) => !["complete", "idle"].includes(item.status)) ?? null;
      state.feedback = feedback.results ?? [];
      state.sleepAnalysis = feedback.analysis ?? plans.analysis ?? null;
      if (state.activeSession?.status === "sleeping") state.screen = "sleep";
    }
    persist();
    render();
    await syncCalendars("auto", { quiet: true });
  } catch (error) {
    resetSignedOutState();
    state.backendConnected = false;
    state.authenticated = false;
    state.authResolved = true;
    try {
      const auth = await api.authStatus();
      state.socialProviders = { ...state.socialProviders, ...auth.providers };
    } catch { /* The email login UI remains available if status lookup fails. */ }
    render();
    if (error.status === 401 && error.loginUrl) {
      showToast("로그인하면 수면 기록을 안전하게 저장할 수 있어요.");
    } else {
      showToast("서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.");
    }
  }
}

function character(kind = state.companion, emotion = "yawning", size = "") {
  const c = companions[kind] ?? companions.owl;
  const x = ["15%", "48%", "78%", "100%"][emotions[emotion]];
  const y = ["12%", "61%", "100%"][c.row];
  return `<span class="companion ${size}" style="--x:${x};--y:${y}" role="img" aria-label="${c.species} 캐릭터 ${c.ko}"></span>`;
}

function shell(content) {
  const tabs = [["home", "home", "홈"], ["routine", "routine", "루틴"], ["report", "report", "리포트"], ["settings", "settings", "설정"]];
  return `<main class="phone" aria-label="Somni 수면 앱"><div class="safe-top"><span>9:41</span><span>${state.backendConnected ? "● SYNC" : "● DEMO"}</span></div>${content}
    <nav class="tabbar" aria-label="메인 메뉴">${tabs.map(([id, i, label]) => `<button data-screen="${id}" class="${state.screen === id ? "active" : ""}"><i>${icon(i)}</i><span>${label}</span></button>`).join("")}</nav></main>`;
}

function authScreen() {
  if (state.authMode === "login" || state.authMode === "signup") {
    const signup = state.authMode === "signup";
    return `<main class="auth-screen"><div class="auth-stars"></div><button class="auth-back" data-auth-mode="welcome">${icon("back")}</button><section class="auth-copy"><span class="auth-logo">S</span><span class="eyebrow">SOMNI ACCOUNT</span><h1>${signup ? "처음 만났네요.\n함께 밤을 준비해요." : "다시 만나서\n반가워요."}</h1><p>${signup ? "계정을 만들면 수면 기록과 캘린더가 안전하게 동기화돼요." : "내 수면 리듬을 이어서 기록해 볼까요?"}</p></section><form class="auth-form" data-auth-form="${state.authMode}">${signup ? `<label>이름<input name="name" autocomplete="name" required maxlength="40" placeholder="이름"></label>` : ""}<label>이메일<input name="email" type="email" autocomplete="email" required placeholder="you@example.com"></label><label>비밀번호<input name="password" type="password" autocomplete="${signup ? "new-password" : "current-password"}" minlength="8" required placeholder="8자 이상"></label><button class="primary" type="submit">${signup ? "회원가입하고 시작하기" : "로그인"} ${icon("arrow")}</button></form><button class="auth-switch" data-auth-mode="${signup ? "login" : "signup"}">${signup ? "이미 계정이 있나요? 로그인" : "처음이신가요? 회원가입"}</button></main>`;
  }
  return `<main class="auth-screen auth-welcome"><div class="auth-stars"></div><section class="auth-copy"><span class="auth-logo">S</span><span class="eyebrow">SOMNI</span><h1>나만의 밤을\n시작해 볼까요?</h1><p>계정을 만들면 수면 기록과 일정을\n어떤 기기에서든 이어갈 수 있어요.</p></section><section class="auth-actions"><button class="primary" data-auth-mode="signup">회원가입 ${icon("arrow")}</button><button class="auth-secondary" data-auth-mode="login">이미 계정이 있어요</button><div class="auth-divider"><span>또는</span></div><button class="social-login google" data-social-login="google" ${state.socialProviders.google ? "" : "disabled"}><b>G</b> Google로 ${state.socialProviders.google ? "계속하기" : "준비 중"}</button><button class="social-login apple" data-social-login="apple" ${state.socialProviders.apple ? "" : "disabled"}><b>●</b> Apple로 ${state.socialProviders.apple ? "계속하기" : "준비 중"}</button></section></main>`;
}

function onboarding() {
  const selected = companions[state.companion];
  let body = "";
  if (state.step === 0) body = `<section class="onboard welcome"><div class="sky"></div><span class="eyebrow">SOMNI</span>${character("cat", "sleeping", "xl")}
    <div><h1>오늘 밤을<br>조금 더 편안하게.</h1><p>Somni는 부담 없는 작은 루틴으로<br>당신의 밤을 함께 정리해요.</p></div><button class="primary" data-next>시작하기 ${icon("arrow")}</button></section>`;
  if (state.step === 1) body = `<section class="onboard choose"><button class="back" data-prev>${icon("back")}</button><span class="eyebrow">YOUR COMPANION · 1/2</span><h1>오늘 밤을 함께할<br>친구를 골라주세요.</h1><p>언제든 설정에서 바꿀 수 있어요.</p><div class="companion-list">${Object.entries(companions).map(([id, c]) => `<button data-companion="${id}" class="companion-card ${id === state.companion ? "selected" : ""}">${character(id, "yawning", "card-art")}<span><b>${c.ko}</b><small>${c.label}</small></span><i>${id === state.companion ? icon("check") : ""}</i></button>`).join("")}</div><button class="primary" data-next>${selected.ko}와 시작하기 ${icon("arrow")}</button></section>`;
  if (state.step === 2) body = `<section class="onboard schedule"><button class="back" data-prev>${icon("back")}</button><span class="eyebrow">YOUR RHYTHM · 2/2</span>${character(state.companion, "yawning", "setup-art")}<h1>나만의 밤을<br>설정해 볼까요?</h1><p>완벽하지 않아도 괜찮아요. 바꾸고 싶을 때 언제든 조절할 수 있어요.</p><div class="time-sheet"><label>잠들고 싶은 시간 <input type="time" data-time="bedtime" value="${state.bedtime}"></label><label>일어나고 싶은 시간 <input type="time" data-time="wake" value="${state.wake}"></label></div><button class="primary" data-complete>내 리듬 만들기 ${icon("arrow")}</button></section>`;
  app.innerHTML = body;
}

function home() {
  const c = companions[state.companion];
  const planCopy = state.plan
    ? `${state.plan.bedtimeWindowStart}–${state.plan.bedtimeWindowEnd} 사이에 잠자리를 권해요.`
    : "내일의 리듬에 맞춘 편안한 시간을 준비했어요.";
  const insight = state.plan?.reasons?.[0] ?? "오늘의 작은 루틴이 내일 아침의 리듬을 만들어요.";
  return shell(`<section class="page home-page"><header><div><span class="eyebrow">${formatDate()}</span><h1>좋은 저녁이에요,<br>${state.name}님.</h1></div><button class="avatar" data-screen="settings">${character(state.companion, "yawning", "avatar-art")}</button></header>
  <section class="hero"><div class="hero-stars"></div><span class="eyebrow">TODAY'S BEDTIME</span><h2>${state.bedtime}</h2><p>${planCopy}</p>${character(state.companion, "yawning", "hero-art")}<span class="hello">${c.ko}가 기다리고 있어요</span></section>
  <section class="insight"><div><span class="soft-icon">☾</span><p>${insight}</p></div><span class="trend">${state.backendConnected ? "SYNC" : "DEMO"}</span></section>
  <section class="section-title"><div><span class="eyebrow">TONIGHT</span><h2>잠들기 전, 가볍게</h2></div><button data-screen="routine">전체 보기 ${icon("arrow")}</button></section>
  <div class="routine-preview"><button data-screen="routine"><span>01</span><i>${icon("sound")}</i><b>빗소리와 함께</b><small>10분 · 소리</small></button><button data-screen="routine"><span>02</span><i>${icon("breathe")}</i><b>느린 호흡</b><small>3분 · 호흡</small></button></div>
  <button class="primary sleep-button" data-screen="sleep">${icon("moon")} 잠들 준비하기</button></section>`);
}

function routine() {
  const activities = [["sound", "sound", "빗소리와 함께", "10분 · 사운드"], ["breathe", "breathe", "느린 호흡", "3분 · 호흡"], ["journal", "journal", "오늘의 한 줄", "2분 · 기록"]];
  const done = Object.values(state.routine).filter(Boolean).length;
  return shell(`<section class="page routine-page"><header class="simple-header"><div><span class="eyebrow">BEDTIME ROUTINE</span><h1>천천히,<br>잠들 준비를 해요.</h1></div>${character(state.companion, done > 1 ? "sleeping" : "yawning", "header-art")}</header><div class="progress"><span style="width:${done / 3 * 100}%"></span></div><p class="progress-copy">${done ? `${done}개의 작은 루틴을 마쳤어요.` : "오늘은 어떤 밤을 만들고 싶나요?"}</p><div class="activity-list">${activities.map(([id, i, title, meta], n) => `<button class="activity ${state.routine[id] ? "done" : ""}" data-routine="${id}"><span class="number">0${n + 1}</span><i>${icon(i)}</i><span class="activity-copy"><b>${title}</b><small>${meta}</small></span><em>${state.routine[id] ? icon("check") : icon("play")}</em></button>`).join("")}</div><button class="primary sleep-button" data-screen="sleep">${done ? "이제 잠들 준비하기" : "루틴 없이 바로 시작하기"} ${icon("arrow")}</button></section>`);
}

function report() {
  const latest = state.feedback?.[0];
  const displayedRecord = state.pendingFeedback ?? latest;
  const actualSleep = displayedRecord?.actualSleep ?? "23:48";
  const actualWake = displayedRecord?.actualWake ?? "07:06";
  const duration = (minutes(actualWake) - minutes(actualSleep) + 1440) % 1440;
  const hours = Math.floor(duration / 60);
  const mins = duration % 60;
  const pendingCopy = state.pendingFeedback
    ? "낮 시간 졸림은 오늘 하루를 보낸 뒤, 다음 취침 직전에 물어볼게요."
    : latest
      ? `개운함 ${latest.freshness}/5 · 낮 졸림 ${latest.sleepiness}/5`
      : "첫 수면 기록을 남기면 나만의 변화가 여기에 쌓여요.";
  const analysis = state.sleepAnalysis;
  const analysisLabel = ({ INSUFFICIENT_DATA: "기록을 모으는 중", INSUFFICIENT_SLEEP: "수면 시간 확보 필요", LOW_CONDITION_DESPITE_DURATION: "목표 수면 탐색 중", IRREGULAR_TIMING: "취침 리듬 안정화", STABLE: "안정적인 수면 리듬", NO_CLEAR_PATTERN: "패턴 관찰 중" })[analysis?.primaryState] ?? "나의 리듬 분석 중";
  const analysisReason = analysis?.reasons?.[0]?.message ?? "3번 이상 기록하면 수면 패턴을 분석해요.";
  return shell(`<section class="page report-page"><header><div><span class="eyebrow">SLEEP REPORT</span><h1>지난밤의<br>편안한 기록.</h1></div>${character(state.companion, "sleeping", "header-art")}</header><section class="report-card"><span>${displayedRecord?.date ?? "최근 기록"}</span><div><strong>${hours}<small>h</small> ${mins}<small>m</small></strong><p>수면 시간</p></div><div class="sleep-bar"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div><small>${actualSleep} 취침 <b>·</b> ${actualWake} 기상</small></section><section class="feedback"><span class="soft-icon">✦</span><div><b>${state.pendingFeedback ? "아침 기록을 임시 저장했어요." : "조금씩 내 리듬에 가까워지고 있어요."}</b><p>${pendingCopy}</p></div></section><section class="analysis-card"><span class="eyebrow">PERSONAL ANALYSIS</span><div><b>${analysisLabel}</b><em>${analysis?.confidence ? `신뢰도 ${analysis.confidence.toUpperCase()}` : "LEARNING"}</em></div><p>${analysisReason}</p>${analysis?.suggestedAdjustmentMinutes ? `<small>다음 목표 수면을 ${analysis.suggestedAdjustmentMinutes}분 늘려 탐색해요.</small>` : ""}</section><section class="section-title"><div><span class="eyebrow">THIS WEEK</span><h2>나의 수면 리듬</h2></div><button>7일</button></section><div class="chart">${[58, 72, 48, 80, 64, 88, 70].map((height, index) => `<span><i style="height:${height}%"></i><small>${"M T W T F S S".split(" ")[index]}</small></span>`).join("")}</div></section>`);
}

function checkin() {
  return shell(`<section class="page settings-page"><header><span class="eyebrow">MORNING CHECK-IN</span><h1>오늘 아침은<br>어떤가요?</h1></header><section class="profile-card">${character(state.companion, "yawning", "profile-art")}<div><b>지금 느끼는 것만 기록해요.</b><p>낮 졸림은 오늘 밤 잠들기 전에 물어볼게요.</p></div></section><section class="setting-group"><span>지난밤 기록</span><label><b>실제 취침 시각</b><input type="time" data-checkin="actualSleep" value="${state.checkin.actualSleep}"></label><label><b>실제 기상 시각</b><input type="time" data-checkin="actualWake" value="${state.checkin.actualWake}"></label><label><b>잠들기까지 걸린 시간</b><select data-checkin="sleepOnsetDelayMinutes"><option value="" ${state.checkin.sleepOnsetDelayMinutes === "" ? "selected" : ""}>기억나지 않음</option>${[[0, "거의 바로"], [20, "10~30분"], [45, "30~60분"], [60, "60분 이상"]].map(([value, label]) => `<option value="${value}" ${state.checkin.sleepOnsetDelayMinutes !== "" && Number(state.checkin.sleepOnsetDelayMinutes) === value ? "selected" : ""}>${label}</option>`).join("")}</select></label></section><section class="setting-group"><span>아침 컨디션</span><label><b>지금 얼마나 개운한가요?</b><select data-checkin="freshness">${[1, 2, 3, 4, 5].map((value) => `<option value="${value}" ${Number(state.checkin.freshness) === value ? "selected" : ""}>${value} / 5</option>`).join("")}</select></label></section><p class="timing-note">낮 시간 졸림은 하루를 충분히 보낸 후 평가해야 더 정확해요.</p><button class="primary sleep-button" data-save-morning>${icon("check")} 아침 기록 저장</button></section>`);
}

function daytimeCheckin() {
  return shell(`<section class="page settings-page daytime-checkin"><header><span class="eyebrow">BEFORE BED CHECK-IN</span><h1>오늘 낮에는<br>얼마나 졸렸나요?</h1></header><section class="profile-card">${character(state.companion, "tired", "profile-art")}<div><b>하루를 돌아볼 시간이에요.</b><p>지난밤 수면이 낮 컨디션에 미친 영향을 기록해요.</p></div></section><section class="sleepiness-scale" role="radiogroup" aria-label="낮 시간 졸림"><span>거의<br>안 졸림</span>${[1, 2, 3, 4, 5].map((value) => `<button data-sleepiness="${value}" class="${Number(state.checkin.sleepiness) === value ? "selected" : ""}" aria-pressed="${Number(state.checkin.sleepiness) === value}">${value}</button>`).join("")}<span>매우<br>졸림</span></section><section class="setting-group nap-check"><span>낮잠 기록 <small>선택</small></span><label><b>낮잠 시간</b><span class="minute-input"><input type="number" min="0" max="240" step="5" inputmode="numeric" data-checkin="napDurationMinutes" value="${state.checkin.napDurationMinutes}" placeholder="0"><em>분</em></span></label><label><b>낮잠을 잔 이유</b><select data-checkin="napReason"><option value="">해당 없음</option>${["졸려서", "전날 잠이 부족해서", "습관적으로", "휴식하려고", "기타"].map((reason) => `<option ${state.checkin.napReason === reason ? "selected" : ""}>${reason}</option>`).join("")}</select></label></section><p class="timing-note">이 답변을 지난밤 기록에 합친 뒤 오늘의 수면 모드를 시작할게요.</p><button class="primary sleep-button" data-save-daytime>${icon("moon")} 평가하고 수면 시작</button></section>`);
}

function settings() {
  const c = companions[state.companion];
  return shell(`<section class="page settings-page"><header><span class="eyebrow">SETTINGS</span><h1>내 밤의 설정</h1></header><section class="profile-card">${character(state.companion, "yawning", "profile-art")}<div><b>${c.ko}와 함께하는 밤</b><p>${state.backendConnected ? "계정에 안전하게 동기화 중" : c.label}</p></div><button data-reset-companion>변경</button></section><section class="setting-group"><span>수면 목표</span><button><b>권장 취침 시간</b><em>${state.bedtime}</em></button><button><b>기상 시간</b><em>${state.wake}</em></button></section><section class="setting-group calendar-group"><span>캘린더 동기화</span>${calendarSetting("apple", "Apple Calendar", "iPhone 일정")}${calendarSetting("google", "Google Calendar", "학교·개인 일정")}<button class="calendar-sync-button" data-sync-calendars><b>${icon("refresh")} 지금 동기화</b><em>변경 일정 확인</em></button><p class="calendar-help">자동 모드는 앱을 열거나 다시 돌아올 때 변경된 일정을 확인해 수면 계획에 반영해요.</p></section><section class="setting-group"><span>알림</span><button><b>취침 루틴 알림</b><em class="toggle on"></em></button><button><b>기상 알림</b><em class="toggle on"></em></button></section><section class="setting-group"><span>계정</span><button><b>서버 동기화</b><em>연결됨</em></button><button data-logout><b>로그아웃</b><em>${icon("arrow")}</em></button></section></section>`);
}

function calendarSetting(provider, label, description) {
  const connection = state.calendarConnections[provider];
  const lastSync = connection.lastSyncedAt
    ? new Date(connection.lastSyncedAt).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : "아직 동기화하지 않음";
  return `<article class="calendar-provider"><span class="calendar-mark ${provider}">${provider === "apple" ? "●" : "G"}</span><span class="calendar-copy"><b>${label}</b><small>${connection.connected ? lastSync : description}</small></span><button class="calendar-connect ${connection.connected ? "connected" : ""}" data-calendar-connect="${provider}">${connection.connected ? "연결됨" : "연결"}</button>${connection.connected ? `<label class="sync-mode"><input type="checkbox" data-calendar-auto="${provider}" ${connection.syncMode === "auto" ? "checked" : ""}><span>자동</span></label>` : ""}</article>`;
}

function requestAppleDeviceSync(reason = "manual") {
  const handler = globalThis.webkit?.messageHandlers?.somniCalendarSync;
  if (!handler?.postMessage) return false;
  handler.postMessage({ reason });
  return true;
}

async function syncCalendars(mode = "manual", { quiet = false } = {}) {
  if (!state.backendConnected || calendarSyncing) return;
  const active = Object.entries(state.calendarConnections).filter(([, item]) => item.connected && (mode === "manual" || item.syncMode === "auto"));
  if (!active.length) {
    if (!quiet) showToast("먼저 동기화할 캘린더를 연결해 주세요.");
    return;
  }
  calendarSyncing = true;
  try {
    const appleRequested = active.some(([provider]) => provider === "apple") && requestAppleDeviceSync(mode);
    const result = await api.syncCalendars(mode);
    const profile = await api.me();
    applyProfile(profile);
    await refreshPlan();
    lastAutomaticSync = Date.now();
    persist();
    render();
    if (!quiet) {
      if (result.appleDeviceSyncRequired && !appleRequested && !result.results?.length) showToast("Apple 일정은 iPhone 앱에서 캘린더 권한을 허용해 주세요.");
      else showToast("변경된 일정을 확인하고 계획을 업데이트했어요.");
    }
  } catch (error) {
    if (!quiet) showToast(error.message);
  } finally {
    calendarSyncing = false;
  }
}

function sleep() {
  const elapsed = elapsedSleep();
  return `<main class="sleep-screen lock-screen"><div class="lock-wallpaper"></div><div class="ios-status"><strong>${formatClock()}</strong><span class="dynamic-island"></span><span class="status-icons">▮▮▮ ⌁ ▰</span></div><div class="expand-hint">⌄ 탭하여 펼치기</div><section class="lock-clock"><span>${formatLockDate()}</span><strong>${formatClock()}</strong></section><section class="live-activity" aria-label="Somni 수면 Live Activity"><header><span class="live-app-icon"></span><b>SOMNI</b><em>Live</em></header><div class="live-main"><div class="live-avatar">${character(state.companion, "sleeping", "live-character")}</div><div><h1>수면 기록 중</h1><p>${elapsed.label}</p></div></div><div class="live-progress"><i style="width:${elapsed.progress}%"></i></div><div class="live-meta"><span><small>시작 시각</small><b>${elapsed.startedAt}</b></span><span><small>알람 설정</small><b>${formatMeridiem(state.wake)}</b></span></div></section><button class="return-to-somni" data-end-sleep>Somni로 돌아가 기상 체크</button><div class="home-indicator"></div></main>`;
}

function render() {
  if (!state.authResolved) app.innerHTML = `<main class="auth-screen auth-loading"><span class="auth-logo">S</span><p>내 리듬을 불러오는 중…</p></main>`;
  else if (!state.authenticated) app.innerHTML = authScreen();
  else if (!state.onboarding) onboarding();
  else app.innerHTML = state.screen === "sleep" ? sleep() : ({ home, routine, report, settings, checkin, "daytime-checkin": daytimeCheckin }[state.screen] || home)();
}

function showToast(message) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;
  document.body.append(el);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.remove(), 2600);
}

async function completeOnboarding() {
  state.onboarding = true;
  state.screen = "home";
  if (!state.backendConnected) return;
  const profile = await api.updateMe({
    selectedCharacter: state.companion,
    onboardingComplete: true,
    targetWake: state.wake,
    targetSleepMinutes: targetSleepMinutes(),
  });
  applyProfile(profile);
  await refreshPlan();
}

async function startSleep() {
  if (state.pendingFeedback) {
    state.pendingSleepStart = true;
    state.screen = "daytime-checkin";
    return;
  }
  await enterSleep();
}

async function enterSleep() {
  state.screen = "sleep";
  if (state.backendConnected) {
    state.activeSession = await api.startSleep(state.plan?.targetDate ?? tomorrowKey());
  } else {
    state.activeSession = {
      id: null,
      targetDate: state.plan?.targetDate ?? tomorrowKey(),
      status: "sleeping",
      startedAt: new Date().toISOString(),
    };
  }
}

async function endSleep() {
  if (state.backendConnected && state.activeSession?.id) {
    state.activeSession = await api.updateSleep(state.activeSession.id, "checking");
  }
  state.checkin.actualSleep = state.bedtime;
  state.checkin.actualWake = state.wake;
  state.screen = "checkin";
}

function saveMorning() {
  state.pendingFeedback = {
    date: state.activeSession?.targetDate ?? dateKey(new Date()),
    actualSleep: state.checkin.actualSleep,
    actualWake: state.checkin.actualWake,
    freshness: Number(state.checkin.freshness),
    sleepOnsetDelayMinutes: state.checkin.sleepOnsetDelayMinutes === "" ? null : Number(state.checkin.sleepOnsetDelayMinutes),
  };
  state.screen = "report";
  showToast("아침 기록을 저장했어요. 낮 졸림은 오늘 밤에 물어볼게요.");
}

async function saveDaytime() {
  const entry = {
    ...state.pendingFeedback,
    testRecordMode,
    sleepiness: Number(state.checkin.sleepiness),
    napDurationMinutes: state.checkin.napDurationMinutes === "" ? null : Number(state.checkin.napDurationMinutes),
    napReason: state.checkin.napReason,
    failureReason: "",
  };
  if (state.backendConnected) {
    const saved = await api.saveFeedback(entry);
    entry.date = saved.entry?.date ?? saved.date ?? entry.date;
    state.sleepAnalysis = saved.analysis ?? state.sleepAnalysis;
    if (state.activeSession?.id) state.activeSession = await api.updateSleep(state.activeSession.id, "complete");
    const feedback = await api.feedback();
    state.feedback = feedback.results ?? [];
    state.sleepAnalysis = feedback.analysis ?? state.sleepAnalysis;
    await refreshPlan();
  } else {
    state.feedback = [entry, ...(state.feedback ?? []).filter((item) => item.date !== entry.date)];
    state.activeSession = null;
  }
  state.pendingFeedback = null;
  state.checkin.sleepOnsetDelayMinutes = "";
  state.checkin.napDurationMinutes = "";
  state.checkin.napReason = "";
  state.routine = { sound: false, breathe: false, journal: false };
  const shouldStartSleep = state.pendingSleepStart;
  state.pendingSleepStart = false;
  if (shouldStartSleep) await enterSleep();
  else state.screen = "report";
  showToast("낮 컨디션까지 기록했어요.");
}

app.addEventListener("click", async (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  if (button.type === "submit" && button.closest("[data-auth-form]")) return;
  button.disabled = true;
  try {
    if (button.dataset.next !== undefined) state.step += 1;
    else if (button.dataset.prev !== undefined) state.step -= 1;
    else if (button.dataset.companion) state.companion = button.dataset.companion;
    else if (button.dataset.complete !== undefined) await completeOnboarding();
    else if (button.dataset.endSleep !== undefined) await endSleep();
    else if (button.dataset.saveMorning !== undefined) saveMorning();
    else if (button.dataset.saveDaytime !== undefined) await saveDaytime();
    else if (button.dataset.authMode) state.authMode = button.dataset.authMode;
    else if (button.dataset.socialLogin) {
      location.href = `${api.loginUrl}?provider=${button.dataset.socialLogin}`;
      return;
    } else if (button.dataset.logout !== undefined) {
      await api.logout();
      localStorage.removeItem(storeKey);
      location.reload();
      return;
    }
    else if (button.dataset.syncCalendars !== undefined) await syncCalendars("manual");
    else if (button.dataset.calendarConnect) {
      const provider = button.dataset.calendarConnect;
      const current = state.calendarConnections[provider];
      const updated = await api.updateCalendar(provider, !current.connected, current.syncMode);
      state.calendarConnections[provider] = { ...current, ...updated };
      if (updated.connected && provider === "apple") requestAppleDeviceSync("connect");
      showToast(`${provider === "apple" ? "Apple" : "Google"} Calendar ${updated.connected ? "연결 설정을 저장했어요." : "연결을 해제했어요."}`);
    }
    else if (button.dataset.sleepiness) state.checkin.sleepiness = Number(button.dataset.sleepiness);
    else if (button.dataset.screen === "sleep") await startSleep();
    else if (button.dataset.screen) state.screen = button.dataset.screen;
    else if (button.dataset.routine) {
      const key = button.dataset.routine;
      state.routine[key] = !state.routine[key];
      showToast(state.routine[key] ? "작은 루틴을 시작했어요." : "루틴을 다시 선택할 수 있어요.");
    } else if (button.dataset.resetCompanion !== undefined) {
      state.onboarding = false;
      state.step = 1;
      if (state.backendConnected) await api.updateMe({ onboardingComplete: false });
    } else if (button.dataset.login !== undefined) {
      location.href = api.loginUrl;
      return;
    } else return;
    persist();
    render();
  } catch (error) {
    if (error.status === 401 && error.loginUrl) location.href = error.loginUrl;
    else showToast(error.message);
    button.disabled = false;
  }
});

app.addEventListener("submit", async (event) => {
  const form = event.target.closest("[data-auth-form]");
  if (!form) return;
  event.preventDefault();
  const submit = form.querySelector("button[type=submit]");
  submit.disabled = true;
  try {
    const values = Object.fromEntries(new FormData(form));
    const response = form.dataset.authForm === "signup" ? await api.signup(values) : await api.login(values);
    applyProfile(response.profile);
    if (!state.onboarding) state.step = 0;
    state.authenticated = true;
    state.authResolved = true;
    state.backendConnected = true;
    persist();
    render();
  } catch (error) {
    showToast(error.message);
    submit.disabled = false;
  }
});

document.addEventListener("change", (event) => {
  if (event.target.dataset.time) {
    state[event.target.dataset.time] = event.target.value;
    persist();
  }
  if (event.target.dataset.checkin) {
    state.checkin[event.target.dataset.checkin] = event.target.value;
    persist();
  }
  if (event.target.dataset.calendarAuto) {
    const provider = event.target.dataset.calendarAuto;
    const connection = state.calendarConnections[provider];
    const syncMode = event.target.checked ? "auto" : "manual";
    api.updateCalendar(provider, true, syncMode).then((updated) => {
      state.calendarConnections[provider] = { ...connection, ...updated };
      persist();
      render();
      showToast(syncMode === "auto" ? "일정 변경을 자동으로 확인할게요." : "수동 동기화로 변경했어요.");
      if (syncMode === "auto") syncCalendars("auto", { quiet: true });
    }).catch((error) => showToast(error.message));
  }
});

globalThis.somniCalendarEventsChanged = async (events = [], deletedIds = []) => {
  try {
    const result = await api.pushAppleCalendarEvents(events, deletedIds);
    state.calendarConnections.apple = { ...state.calendarConnections.apple, connected: true, lastSyncedAt: result.lastSyncedAt };
    await refreshPlan();
    persist();
    render();
    showToast("Apple Calendar 변경 사항을 반영했어요.");
    return result;
  } catch (error) {
    showToast(error.message);
    throw error;
  }
};

document.addEventListener("visibilitychange", () => {
  if (!document.hidden && Date.now() - lastAutomaticSync > 60_000) syncCalendars("auto", { quiet: true });
});
globalThis.setInterval(() => syncCalendars("auto", { quiet: true }), 5 * 60_000);

render();
loadBackend();

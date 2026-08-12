const API_BASE = (globalThis.SOMNI_API_BASE
  ?? (location.hostname === "localhost" || location.hostname === "127.0.0.1"
    ? "http://localhost:8000"
    : location.origin)).replace(/\/$/, "");

let csrfReady = false;

function cookie(name) {
  return document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

async function request(path, options = {}) {
  const method = options.method ?? "GET";
  if (!["GET", "HEAD", "OPTIONS"].includes(method) && !csrfReady) {
    const response = await fetch(`${API_BASE}/api/v1/csrf/`, { credentials: "include" });
    if (!response.ok) throw await apiError(response);
    csrfReady = true;
  }

  const headers = new Headers(options.headers);
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const csrfToken = cookie("csrftoken");
  if (csrfToken) headers.set("X-CSRFToken", decodeURIComponent(csrfToken));

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    method,
    headers,
    credentials: "include",
  });
  if (!response.ok) throw await apiError(response);
  if (response.status === 204) return null;
  return response.json();
}

async function apiError(response) {
  let data = {};
  try { data = await response.json(); } catch { /* response is not JSON */ }
  const error = new Error(data.detail ?? `요청에 실패했습니다. (${response.status})`);
  error.status = response.status;
  error.loginUrl = data.loginUrl ? `${API_BASE}${data.loginUrl}` : null;
  return error;
}

export const api = {
  health: () => request("/api/v1/health/"),
  authStatus: () => request("/api/v1/auth/status/"),
  signup: (data) => request("/api/v1/auth/signup/", { method: "POST", body: JSON.stringify(data) }),
  login: (data) => request("/api/v1/auth/login/", { method: "POST", body: JSON.stringify(data) }),
  logout: () => request("/api/v1/auth/logout/", { method: "POST", body: "{}" }),
  me: () => request("/api/v1/me/"),
  updateMe: (data) => request("/api/v1/me/", { method: "PATCH", body: JSON.stringify(data) }),
  plans: (start, days = 7) => request(`/api/v1/plans/?start=${encodeURIComponent(start)}&days=${days}`),
  updatePlan: (targetDate, data) => request(`/api/v1/plans/${targetDate}/override/`, { method: "PUT", body: JSON.stringify(data) }),
  sleepSessions: () => request("/api/v1/sleep-sessions/"),
  startSleep: (targetDate) => request("/api/v1/sleep-sessions/", { method: "POST", body: JSON.stringify({ targetDate }) }),
  updateSleep: (id, status) => request(`/api/v1/sleep-sessions/${id}/`, { method: "PATCH", body: JSON.stringify({ status }) }),
  feedback: () => request("/api/v1/feedback/"),
  sleepAnalysis: () => request("/api/v1/sleep-analysis/"),
  saveFeedback: (data) => request("/api/v1/feedback/", { method: "POST", body: JSON.stringify(data) }),
  updateCalendar: (provider, connected, syncMode = "manual") => request(`/api/v1/calendars/${provider}/`, { method: "PUT", body: JSON.stringify({ connected, syncMode }) }),
  syncCalendars: (mode = "manual") => request("/api/v1/calendars/sync/", { method: "POST", body: JSON.stringify({ mode }) }),
  syncGoogleCalendar: (calendarId = "primary") => request("/api/v1/calendars/google/sync/", { method: "POST", body: JSON.stringify({ calendarId }) }),
  pushAppleCalendarEvents: (events, deletedIds = []) => request("/api/v1/calendars/apple/events/", { method: "PUT", body: JSON.stringify({ events, deletedIds }) }),
  loginUrl: `${API_BASE}/auth/`,
};

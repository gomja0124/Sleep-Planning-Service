// 커뮤니티 모듈이 공통으로 쓰는 오류 타입과 작은 유틸.

// UI가 사용자에게 그대로 보여줄 수 있는 한국어 message와,
// 화면이 분기 처리할 때 쓰는 code를 함께 담는다.
export class CommunityError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "CommunityError";
    this.code = code;
  }
}

export function fail(code, message) {
  throw new CommunityError(code, message);
}

export function randomId(prefix) {
  const random = globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 12)
    : Math.random().toString(36).slice(2, 14);
  return `${prefix}_${random}`;
}

export function nowIso() {
  return new Date().toISOString();
}

export function normalizeText(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

// 본문은 줄바꿈을 살려야 하므로 줄 단위로만 정리한다.
export function normalizeBody(value) {
  return String(value ?? "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
}

export function relativeTime(isoString, reference = new Date()) {
  const target = new Date(isoString);
  if (Number.isNaN(target.getTime())) return "";

  const diffMinutes = Math.floor((reference.getTime() - target.getTime()) / 60000);
  if (diffMinutes < 1) return "방금 전";
  if (diffMinutes < 60) return `${diffMinutes}분 전`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}시간 전`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}일 전`;

  return `${target.getMonth() + 1}월 ${target.getDate()}일`;
}

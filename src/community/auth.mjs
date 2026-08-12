// 회원가입·로그인·세션 로직.
//
// 비밀번호는 PBKDF2-SHA256으로 유도한 해시만 저장한다. 다만 이 저장소는 브라우저
// localStorage이므로, 기기 주인이 마음먹으면 해시를 그대로 꺼내 볼 수 있다.
// 실제 계정 보호는 서버를 붙이는 단계에서만 성립한다. 지금은 서버 API와 같은 모양의
// 비동기 인터페이스를 먼저 확정해 두는 것이 목적이다.

import { CommunityError, fail, nowIso, normalizeText, randomId } from "./common.mjs";

const PBKDF2_ITERATIONS = 120000;
const SALT_BYTES = 16;
const DERIVED_BITS = 256;
const SESSION_DAYS = 14;

export const HANDLE_PATTERN = /^[A-Za-z0-9_]{4,20}$/;
export const NICKNAME_MIN = 2;
export const NICKNAME_MAX = 12;
export const PASSWORD_MIN = 8;

function subtleCrypto() {
  const webCrypto = globalThis.crypto;
  if (!webCrypto?.subtle) {
    throw new CommunityError("crypto_unavailable", "이 환경에서는 로그인 기능을 쓸 수 없어요.");
  }
  return webCrypto;
}

function toHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

export async function derivePassword(password, saltHex) {
  const webCrypto = subtleCrypto();
  const salt = saltHex ? fromHex(saltHex) : webCrypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const keyMaterial = await webCrypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await webCrypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    DERIVED_BITS,
  );
  return { salt: toHex(salt), hash: toHex(new Uint8Array(bits)) };
}

// 길이가 달라도 같은 시간을 쓰도록 맞춰 비교한다.
function constantTimeEquals(left, right) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

export function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    handle: user.handle,
    nickname: user.nickname,
    character: user.character ?? "owl",
    joinedAt: user.joinedAt,
    demo: Boolean(user.demo),
  };
}

export function findUserByHandle(database, handle) {
  const normalized = normalizeText(handle).toLowerCase();
  return database.users.find((user) => user.handle.toLowerCase() === normalized) ?? null;
}

export function findUserById(database, userId) {
  return database.users.find((user) => user.id === userId) ?? null;
}

function assertSignUpInput({ handle, password, nickname }) {
  if (!HANDLE_PATTERN.test(handle)) {
    fail("invalid_handle", "아이디는 영문·숫자·밑줄 4~20자로 만들어 주세요.");
  }
  if (String(password ?? "").length < PASSWORD_MIN) {
    fail("weak_password", `비밀번호는 ${PASSWORD_MIN}자 이상이어야 해요.`);
  }
  if (nickname.length < NICKNAME_MIN || nickname.length > NICKNAME_MAX) {
    fail("invalid_nickname", `닉네임은 ${NICKNAME_MIN}~${NICKNAME_MAX}자로 지어 주세요.`);
  }
}

export async function signUp(database, { handle, password, nickname, character = "owl" }) {
  const cleanHandle = normalizeText(handle);
  const cleanNickname = normalizeText(nickname);
  assertSignUpInput({ handle: cleanHandle, password, nickname: cleanNickname });

  if (findUserByHandle(database, cleanHandle)) {
    fail("handle_taken", "이미 사용 중인 아이디예요.");
  }
  const nicknameTaken = database.users.some(
    (user) => user.nickname.toLowerCase() === cleanNickname.toLowerCase(),
  );
  if (nicknameTaken) {
    fail("nickname_taken", "이미 사용 중인 닉네임이에요.");
  }

  const { salt, hash } = await derivePassword(password);
  const user = {
    id: randomId("user"),
    handle: cleanHandle,
    nickname: cleanNickname,
    character,
    passwordSalt: salt,
    passwordHash: hash,
    joinedAt: nowIso(),
    demo: false,
  };
  database.users.push(user);

  return { user: publicUser(user), session: startSession(database, user) };
}

export async function signIn(database, { handle, password }) {
  const user = findUserByHandle(database, handle);
  // 아이디가 없는 경우와 비밀번호가 틀린 경우를 구분해서 알려주지 않는다.
  if (!user || !user.passwordHash) {
    fail("invalid_credentials", "아이디 또는 비밀번호를 다시 확인해 주세요.");
  }

  const { hash } = await derivePassword(password, user.passwordSalt);
  if (!constantTimeEquals(hash, user.passwordHash)) {
    fail("invalid_credentials", "아이디 또는 비밀번호를 다시 확인해 주세요.");
  }

  return { user: publicUser(user), session: startSession(database, user) };
}

export function startSession(database, user) {
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const session = { token: randomId("session"), userId: user.id, createdAt: nowIso(), expiresAt };
  database.sessions.push(session);
  return session;
}

export function signOut(database, token) {
  const before = database.sessions.length;
  database.sessions = database.sessions.filter((session) => session.token !== token);
  return database.sessions.length !== before;
}

// 만료된 세션은 조회 시점에 정리한다.
export function userForToken(database, token) {
  if (!token) return null;

  const now = Date.now();
  database.sessions = database.sessions.filter(
    (session) => new Date(session.expiresAt).getTime() > now,
  );

  const session = database.sessions.find((entry) => entry.token === token);
  if (!session) return null;

  return publicUser(findUserById(database, session.userId));
}

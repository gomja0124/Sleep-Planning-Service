// 커뮤니티 데이터 저장소 어댑터.
// 지금은 localStorage에 통째로 넣지만, 서버를 붙일 때는 read/write 두 함수만
// fetch 구현으로 갈아끼우면 나머지 로직은 그대로 쓸 수 있다.

export const COMMUNITY_STORAGE_KEY = "bamgai-community-v1";
export const COMMUNITY_SESSION_KEY = "bamgai-community-session-v1";

export const DATABASE_VERSION = 1;

export function emptyDatabase() {
  return {
    version: DATABASE_VERSION,
    users: [],
    sessions: [],
    posts: [],
    comments: [],
  };
}

function normalizeDatabase(value) {
  const base = emptyDatabase();
  if (!value || typeof value !== "object") return base;
  return {
    version: DATABASE_VERSION,
    users: Array.isArray(value.users) ? value.users : base.users,
    sessions: Array.isArray(value.sessions) ? value.sessions : base.sessions,
    posts: Array.isArray(value.posts) ? value.posts : base.posts,
    comments: Array.isArray(value.comments) ? value.comments : base.comments,
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

// 테스트와 서버 사이드에서 쓰는 휘발성 저장소.
export function createMemoryStore(initial) {
  let snapshot = normalizeDatabase(initial ? clone(initial) : null);
  return {
    async read() {
      return clone(snapshot);
    },
    async write(database) {
      snapshot = normalizeDatabase(clone(database));
    },
  };
}

// 브라우저 localStorage 저장소.
export function createLocalStore(key = COMMUNITY_STORAGE_KEY, storage = globalThis.localStorage) {
  if (!storage) return createMemoryStore();
  return {
    async read() {
      try {
        return normalizeDatabase(JSON.parse(storage.getItem(key)));
      } catch {
        return emptyDatabase();
      }
    },
    async write(database) {
      storage.setItem(key, JSON.stringify(normalizeDatabase(database)));
    },
  };
}

// 로그인 토큰만 따로 보관한다. 서버를 붙이면 이 자리가 쿠키나 Authorization 헤더가 된다.
export function createMemorySessionStore(initial = null) {
  let token = initial;
  return {
    async read() {
      return token;
    },
    async write(next) {
      token = next;
    },
  };
}

export function createLocalSessionStore(key = COMMUNITY_SESSION_KEY, storage = globalThis.localStorage) {
  if (!storage) return createMemorySessionStore();
  return {
    async read() {
      return storage.getItem(key);
    },
    async write(token) {
      if (token) storage.setItem(key, token);
      else storage.removeItem(key);
    },
  };
}

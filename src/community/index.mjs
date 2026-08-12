// 커뮤니티 기능의 단일 진입점.
//
// 화면(app.js, somni.js)은 이 파사드만 알면 되고, 저장소가 localStorage인지 서버인지는
// 모른다. 서버를 붙일 때는 store를 fetch 구현으로 바꾸거나, 아래 메서드 본문을
// 그대로 fetch 호출로 치환하면 된다. 조회는 동기, 변경은 비동기로 나눠 두어서
// 화면은 항상 메모리에 있는 최신 상태를 바로 그릴 수 있다.

import { CommunityError } from "./common.mjs";
import * as auth from "./auth.mjs";
import * as board from "./board.mjs";
import { seedDatabase } from "./seed.mjs";
import {
  createLocalSessionStore,
  createLocalStore,
  emptyDatabase,
} from "./store.mjs";

export { CommunityError } from "./common.mjs";
export { POST_CATEGORIES } from "./board.mjs";
export { relativeTime } from "./common.mjs";

export function createCommunity({ store = createLocalStore(), sessionStore = createLocalSessionStore(), seed = true } = {}) {
  let database = emptyDatabase();
  let token = null;
  let viewer = null;
  let loaded = false;

  async function persist() {
    await store.write(database);
  }

  function refreshViewer() {
    viewer = auth.userForToken(database, token);
    return viewer;
  }

  function requireViewer() {
    if (!viewer) {
      throw new CommunityError("not_signed_in", "로그인이 필요한 기능이에요.");
    }
    return viewer;
  }

  return {
    async load() {
      database = await store.read();
      if (seed) seedDatabase(database);
      token = await sessionStore.read();
      refreshViewer();
      loaded = true;
      await persist();
      return viewer;
    },

    get isLoaded() {
      return loaded;
    },

    get currentUser() {
      return viewer;
    },

    get isSignedIn() {
      return Boolean(viewer);
    },

    async signUp(input) {
      const result = await auth.signUp(database, input);
      token = result.session.token;
      await sessionStore.write(token);
      refreshViewer();
      await persist();
      return result.user;
    },

    async signIn(input) {
      const result = await auth.signIn(database, input);
      token = result.session.token;
      await sessionStore.write(token);
      refreshViewer();
      await persist();
      return result.user;
    },

    async signOut() {
      auth.signOut(database, token);
      token = null;
      viewer = null;
      await sessionStore.write(null);
      await persist();
    },

    listPosts(options = {}) {
      return board.listPosts(database, { ...options, viewerId: viewer?.id ?? null });
    },

    getPost(postId) {
      return board.getPost(database, postId, viewer?.id ?? null);
    },

    countPosts(category = null) {
      return database.posts.filter((post) => (category ? post.category === category : true)).length;
    },

    async createPost({ category, title, body }) {
      const user = requireViewer();
      const post = board.createPost(database, { authorId: user.id, category, title, body });
      await persist();
      return post;
    },

    async updatePost({ postId, category, title, body }) {
      const user = requireViewer();
      const post = board.updatePost(database, { postId, actorId: user.id, category, title, body });
      await persist();
      return post;
    },

    async deletePost(postId) {
      const user = requireViewer();
      const post = board.deletePost(database, { postId, actorId: user.id });
      await persist();
      return post;
    },

    async toggleLike(postId) {
      const user = requireViewer();
      const result = board.toggleLike(database, { postId, actorId: user.id });
      await persist();
      return result;
    },

    async addComment({ postId, body }) {
      const user = requireViewer();
      const comment = board.addComment(database, { postId, authorId: user.id, body });
      await persist();
      return comment;
    },

    async deleteComment(commentId) {
      const user = requireViewer();
      const comment = board.deleteComment(database, { commentId, actorId: user.id });
      await persist();
      return comment;
    },

    // 테스트와 디버깅용. 화면에서는 쓰지 않는다.
    snapshot() {
      return JSON.parse(JSON.stringify(database));
    },
  };
}

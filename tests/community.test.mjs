import test from "node:test";
import assert from "node:assert/strict";
import { createCommunity } from "../src/community/index.mjs";
import { categoryLabel, listPosts, popularityScore } from "../src/community/board.mjs";
import { relativeTime } from "../src/community/common.mjs";

// 권한 검사와 입력 검증은 백엔드(planner/tests.py)가 맡는다.
// 여기서는 서버 응답을 화면에 맞게 고르고 줄 세우는 부분만 확인한다.

function post(overrides = {}) {
  return {
    id: 1,
    type: "free",
    title: "제목",
    body: "내용",
    author: { id: "user-1", nickname: "민밤", character: "owl" },
    createdAt: "2026-08-12T21:00:00Z",
    updatedAt: null,
    commentCount: 0,
    likeCount: 0,
    likedByViewer: false,
    ownedByViewer: false,
    ...overrides,
  };
}

function fakeApi(posts = []) {
  const state = { posts: [...posts], calls: [] };
  return {
    state,
    me: async () => ({ id: "user-1", selectedCharacter: "owl", profile: { name: "민밤" } }),
    communityPosts: async () => ({ results: [...state.posts] }),
    communityPost: async (id) => ({
      ...state.posts.find((item) => item.id === id),
      comments: state.comments ?? [],
    }),
    createCommunityPost: async (data) => {
      state.calls.push(["create", data]);
      const created = post({ id: state.posts.length + 1, type: data.type, title: data.title, body: data.body });
      state.posts.push(created);
      return created;
    },
    updateCommunityPost: async (id, data) => {
      state.calls.push(["update", id, data]);
      const target = state.posts.find((item) => item.id === id);
      Object.assign(target, { type: data.type, title: data.title, body: data.body, updatedAt: "2026-08-12T22:00:00Z" });
      return target;
    },
    deleteCommunityPost: async (id) => {
      state.calls.push(["delete", id]);
      state.posts = state.posts.filter((item) => item.id !== id);
      return { deleted: true };
    },
    likeCommunityPost: async (id) => {
      state.calls.push(["like", id]);
      const target = state.posts.find((item) => item.id === id);
      target.likedByViewer = !target.likedByViewer;
      target.likeCount += target.likedByViewer ? 1 : -1;
      return { liked: target.likedByViewer, likeCount: target.likeCount };
    },
    addCommunityComment: async (id, body) => {
      state.calls.push(["comment", id, body]);
      return { id: 99, postId: id, body, author: { nickname: "민밤" }, createdAt: "2026-08-12T21:30:00Z", removableByViewer: true };
    },
    deleteCommunityComment: async (id) => {
      state.calls.push(["deleteComment", id]);
      return { deleted: true };
    },
  };
}

test("말머리는 서버 타입 값을 사람이 읽는 이름으로 바꾼다", () => {
  assert.equal(categoryLabel("recruitment"), "모집");
  assert.equal(categoryLabel("proof"), "인증");
  assert.equal(categoryLabel("challenge"), "도전");
  assert.equal(categoryLabel("없는값"), "자유");
});

test("최신글은 나중에 쓴 글이 위에 오고, 같은 시각이면 서버 순서를 지킨다", () => {
  const posts = [
    post({ id: 1, title: "먼저", createdAt: "2026-08-12T20:00:00Z" }),
    post({ id: 2, title: "같은 시각 A", createdAt: "2026-08-12T21:00:00Z" }),
    post({ id: 3, title: "같은 시각 B", createdAt: "2026-08-12T21:00:00Z" }),
  ];

  assert.deepEqual(listPosts(posts).map((item) => item.id), [2, 3, 1]);
});

test("인기글은 좋아요와 댓글이 많은 순으로 정렬한다", () => {
  const quiet = post({ id: 1, likeCount: 0, commentCount: 0 });
  const liked = post({ id: 2, likeCount: 3, commentCount: 0 });
  const discussed = post({ id: 3, likeCount: 0, commentCount: 3 });

  assert.ok(popularityScore(discussed) > popularityScore(liked));
  assert.deepEqual(
    listPosts([quiet, liked, discussed], { sort: "popular" }).map((item) => item.id),
    [3, 2, 1],
  );
});

test("말머리로 거르고 검색어로 찾을 수 있다", () => {
  const posts = [
    post({ id: 1, type: "recruitment", title: "취침팟 모집", body: "자정 전에 자요." }),
    post({ id: 2, type: "question", title: "낮잠 질문", body: "낮잠 때문에 고민이에요." }),
  ];

  assert.deepEqual(listPosts(posts, { category: "recruitment" }).map((item) => item.id), [1]);
  assert.deepEqual(listPosts(posts, { query: "낮잠" }).map((item) => item.id), [2]);
  assert.equal(listPosts(posts, { query: "없는단어" }).length, 0);
});

test("검색은 글쓴이 닉네임으로도 걸린다", () => {
  const posts = [
    post({ id: 1, author: { nickname: "민밤", character: "owl" } }),
    post({ id: 2, author: { nickname: "밤샘탈출", character: "bat" } }),
  ];

  assert.deepEqual(listPosts(posts, { query: "밤샘" }).map((item) => item.id), [2]);
});

test("로그인 상태면 프로필 이름을 그대로 쓴다", async () => {
  const community = createCommunity({ client: fakeApi([post()]) });
  await community.load();

  assert.equal(community.isSignedIn, true);
  assert.equal(community.currentUser.nickname, "민밤");
  assert.equal(community.countPosts(), 1);
});

test("로그인하지 않았으면 게시판을 비운 채로 안내만 한다", async () => {
  const client = fakeApi();
  client.me = async () => {
    const error = new Error("로그인이 필요합니다.");
    error.status = 401;
    throw error;
  };

  const community = createCommunity({ client });
  await community.load();

  assert.equal(community.isSignedIn, false);
  assert.equal(community.countPosts(), 0);
});

test("글을 쓰면 서버에 말머리·제목·내용을 보내고 목록을 다시 받는다", async () => {
  const client = fakeApi();
  const community = createCommunity({ client });
  await community.load();

  await community.createPost({ category: "recruitment", title: "같이 12시에 자실 분", body: "매일 알림 보낼게요." });

  assert.deepEqual(client.state.calls[0], ["create", {
    type: "recruitment",
    title: "같이 12시에 자실 분",
    body: "매일 알림 보낼게요.",
  }]);
  assert.equal(community.countPosts(), 1);
  assert.equal(community.listPosts()[0].title, "같이 12시에 자실 분");
});

test("좋아요는 서버 응답으로 목록의 개수와 눌림 상태를 갱신한다", async () => {
  const client = fakeApi([post({ id: 1 })]);
  const community = createCommunity({ client });
  await community.load();

  const liked = await community.toggleLike(1);
  assert.equal(liked.liked, true);
  assert.equal(community.listPosts()[0].likeCount, 1);
  assert.equal(community.listPosts()[0].likedByViewer, true);

  await community.toggleLike(1);
  assert.equal(community.listPosts()[0].likeCount, 0);
  assert.equal(community.listPosts()[0].likedByViewer, false);
});

test("댓글을 달면 열려 있는 글의 댓글 수가 함께 늘어난다", async () => {
  const client = fakeApi([post({ id: 1 })]);
  const community = createCommunity({ client });
  await community.load();
  await community.loadPost(1);

  await community.addComment({ postId: 1, body: "저도 같이 해요." });

  assert.equal(community.openPost.comments.length, 1);
  assert.equal(community.openPost.commentCount, 1);
  assert.equal(community.listPosts()[0].commentCount, 1);
});

test("댓글을 지우면 열린 글과 목록에서 함께 줄어든다", async () => {
  const client = fakeApi([post({ id: 1, commentCount: 1 })]);
  client.state.comments = [
    { id: 99, postId: 1, body: "지울 댓글", author: { nickname: "민밤" }, createdAt: "2026-08-12T21:30:00Z", removableByViewer: true },
  ];
  const community = createCommunity({ client });
  await community.load();
  await community.loadPost(1);

  await community.deleteComment(99);

  assert.equal(community.openPost.comments.length, 0);
  assert.equal(community.listPosts()[0].commentCount, 0);
});

test("글을 지우면 목록에서 빠지고 열린 글도 닫힌다", async () => {
  const client = fakeApi([post({ id: 1 })]);
  const community = createCommunity({ client });
  await community.load();
  await community.loadPost(1);

  await community.deletePost(1);

  assert.equal(community.countPosts(), 0);
  assert.equal(community.openPost, null);
});

test("작성 시각은 사람이 읽는 상대 시간으로 바꾼다", () => {
  const now = new Date("2026-08-12T21:00:00Z");
  assert.equal(relativeTime("2026-08-12T20:59:40Z", now), "방금 전");
  assert.equal(relativeTime("2026-08-12T20:30:00Z", now), "30분 전");
  assert.equal(relativeTime("2026-08-12T18:00:00Z", now), "3시간 전");
  assert.equal(relativeTime("2026-08-10T21:00:00Z", now), "2일 전");
});

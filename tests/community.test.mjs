import test from "node:test";
import assert from "node:assert/strict";
import { createCommunity } from "../src/community/index.mjs";
import { createMemorySessionStore, createMemoryStore } from "../src/community/store.mjs";
import { relativeTime } from "../src/community/common.mjs";

function newCommunity({ seed = false } = {}) {
  return createCommunity({
    store: createMemoryStore(),
    sessionStore: createMemorySessionStore(),
    seed,
  });
}

async function signedUpCommunity(overrides = {}) {
  const community = newCommunity();
  await community.load();
  await community.signUp({
    handle: "sleepy_min",
    password: "goodnight1",
    nickname: "민밤",
    ...overrides,
  });
  return community;
}

test("회원가입하면 바로 로그인 상태가 되고 비밀번호 원문은 저장하지 않는다", async () => {
  const community = await signedUpCommunity();

  assert.equal(community.isSignedIn, true);
  assert.equal(community.currentUser.nickname, "민밤");

  const stored = community.snapshot().users[0];
  assert.equal(stored.handle, "sleepy_min");
  assert.ok(!JSON.stringify(stored).includes("goodnight1"));
  assert.equal(typeof stored.passwordHash, "string");
  assert.notEqual(stored.passwordSalt, stored.passwordHash);
});

test("같은 아이디나 닉네임으로는 다시 가입할 수 없다", async () => {
  const community = await signedUpCommunity();

  await assert.rejects(
    () => community.signUp({ handle: "sleepy_min", password: "another123", nickname: "다른닉" }),
    (error) => error.code === "handle_taken",
  );
  await assert.rejects(
    () => community.signUp({ handle: "other_id", password: "another123", nickname: "민밤" }),
    (error) => error.code === "nickname_taken",
  );
});

test("아이디 형식과 비밀번호 길이를 검사한다", async () => {
  const community = newCommunity();
  await community.load();

  await assert.rejects(
    () => community.signUp({ handle: "짧음", password: "goodnight1", nickname: "민밤" }),
    (error) => error.code === "invalid_handle",
  );
  await assert.rejects(
    () => community.signUp({ handle: "valid_id", password: "1234", nickname: "민밤" }),
    (error) => error.code === "weak_password",
  );
});

test("비밀번호가 틀리면 아이디 존재 여부를 알려주지 않는다", async () => {
  const community = await signedUpCommunity();
  await community.signOut();

  const wrongPassword = await community
    .signIn({ handle: "sleepy_min", password: "wrongpassword" })
    .catch((error) => error);
  const missingUser = await community
    .signIn({ handle: "nobody_here", password: "wrongpassword" })
    .catch((error) => error);

  assert.equal(wrongPassword.code, "invalid_credentials");
  assert.equal(missingUser.code, "invalid_credentials");
  assert.equal(wrongPassword.message, missingUser.message);
});

test("로그아웃한 뒤 같은 비밀번호로 다시 로그인할 수 있다", async () => {
  const community = await signedUpCommunity();
  await community.signOut();
  assert.equal(community.isSignedIn, false);

  const user = await community.signIn({ handle: "sleepy_min", password: "goodnight1" });
  assert.equal(user.nickname, "민밤");
  assert.equal(community.isSignedIn, true);
});

test("세션은 저장소에 남아서 새로고침해도 로그인 상태가 유지된다", async () => {
  const store = createMemoryStore();
  const sessionStore = createMemorySessionStore();

  const first = createCommunity({ store, sessionStore, seed: false });
  await first.load();
  await first.signUp({ handle: "sleepy_min", password: "goodnight1", nickname: "민밤" });

  const second = createCommunity({ store, sessionStore, seed: false });
  const viewer = await second.load();

  assert.equal(viewer.nickname, "민밤");
  assert.equal(second.isSignedIn, true);
});

test("로그인하지 않으면 글을 쓸 수 없다", async () => {
  const community = newCommunity();
  await community.load();

  await assert.rejects(
    () => community.createPost({ category: "free", title: "익명 글", body: "쓸 수 있나요?" }),
    (error) => error.code === "not_signed_in",
  );
});

test("글을 쓰면 목록 맨 위에 올라오고 말머리가 붙는다", async () => {
  const community = await signedUpCommunity();
  await community.createPost({
    category: "recruit",
    title: "같이 12시에 자실 분",
    body: "매일 11시 50분에 알림 보낼게요.",
  });

  const [post] = community.listPosts();
  assert.equal(post.title, "같이 12시에 자실 분");
  assert.equal(post.categoryLabel, "모집");
  assert.equal(post.author.nickname, "민밤");
  assert.equal(post.ownedByViewer, true);
  assert.equal(post.commentCount, 0);
});

test("제목과 내용이 비어 있거나 너무 길면 거절한다", async () => {
  const community = await signedUpCommunity();

  await assert.rejects(
    () => community.createPost({ category: "free", title: "짧", body: "내용" }),
    (error) => error.code === "invalid_title",
  );
  await assert.rejects(
    () => community.createPost({ category: "free", title: "제목입니다", body: "   " }),
    (error) => error.code === "invalid_body",
  );
  await assert.rejects(
    () => community.createPost({ category: "free", title: "제목입니다", body: "가".repeat(1001) }),
    (error) => error.code === "invalid_body",
  );
  await assert.rejects(
    () => community.createPost({ category: "없는말머리", title: "제목입니다", body: "내용" }),
    (error) => error.code === "invalid_category",
  );
});

test("말머리로 거르고 검색어로 찾을 수 있다", async () => {
  const community = await signedUpCommunity();
  await community.createPost({ category: "recruit", title: "취침팟 모집", body: "자정 전에 자요." });
  await community.createPost({ category: "question", title: "낮잠 질문", body: "낮잠 때문에 고민이에요." });

  assert.equal(community.listPosts({ category: "recruit" }).length, 1);
  assert.equal(community.listPosts({ category: "recruit" })[0].title, "취침팟 모집");
  assert.equal(community.listPosts({ query: "낮잠" }).length, 1);
  assert.equal(community.listPosts({ query: "없는단어" }).length, 0);
});

test("인기글은 좋아요와 댓글이 많은 순으로 정렬한다", async () => {
  const community = await signedUpCommunity();
  const quiet = await community.createPost({ category: "free", title: "조용한 글", body: "아무도 안 봐요." });
  const popular = await community.createPost({ category: "free", title: "인기 있는 글", body: "댓글이 달려요." });

  await community.toggleLike(popular.id);
  await community.addComment({ postId: popular.id, body: "저도 그래요." });

  const latest = community.listPosts({ sort: "latest" });
  const byPopularity = community.listPosts({ sort: "popular" });

  assert.equal(latest[0].id, popular.id, "최신글은 나중에 쓴 글이 위에 온다");
  assert.equal(byPopularity[0].id, popular.id);
  assert.equal(byPopularity[1].id, quiet.id);
});

test("좋아요는 같은 사람이 다시 누르면 취소된다", async () => {
  const community = await signedUpCommunity();
  const post = await community.createPost({ category: "free", title: "좋아요 시험", body: "눌러 보세요." });

  const liked = await community.toggleLike(post.id);
  assert.equal(liked.liked, true);
  assert.equal(community.getPost(post.id).likeCount, 1);
  assert.equal(community.getPost(post.id).likedByViewer, true);

  const unliked = await community.toggleLike(post.id);
  assert.equal(unliked.liked, false);
  assert.equal(community.getPost(post.id).likeCount, 0);
});

test("댓글은 쓴 순서대로 보이고 글 상세에 함께 담긴다", async () => {
  const community = await signedUpCommunity();
  const post = await community.createPost({ category: "question", title: "질문 있어요", body: "다들 몇 시에 주무세요?" });

  await community.addComment({ postId: post.id, body: "저는 12시요." });
  await community.addComment({ postId: post.id, body: "저는 1시쯤이요." });

  const detail = community.getPost(post.id);
  assert.equal(detail.comments.length, 2);
  assert.equal(detail.comments[0].body, "저는 12시요.");
  assert.equal(detail.comments[1].author.nickname, "민밤");
  assert.equal(detail.commentCount, 2);
});

test("남의 글은 수정하거나 지울 수 없다", async () => {
  const community = await signedUpCommunity();
  const post = await community.createPost({ category: "free", title: "내 글이에요", body: "건드리지 마세요." });

  await community.signOut();
  await community.signUp({ handle: "other_user", password: "goodnight2", nickname: "다른사람" });

  await assert.rejects(
    () => community.deletePost(post.id),
    (error) => error.code === "forbidden",
  );
  await assert.rejects(
    () => community.updatePost({ postId: post.id, category: "free", title: "바꿔치기", body: "내용" }),
    (error) => error.code === "forbidden",
  );
});

test("글을 지우면 그 글의 댓글도 함께 사라진다", async () => {
  const community = await signedUpCommunity();
  const post = await community.createPost({ category: "free", title: "곧 지울 글", body: "삭제 시험이에요." });
  await community.addComment({ postId: post.id, body: "댓글도 사라지나요?" });

  await community.deletePost(post.id);

  assert.equal(community.getPost(post.id), null);
  assert.equal(community.snapshot().comments.length, 0);
});

test("글쓴이는 자기 글에 달린 남의 댓글을 지울 수 있다", async () => {
  const community = await signedUpCommunity();
  const post = await community.createPost({ category: "free", title: "댓글 관리", body: "댓글 규칙 시험이에요." });

  await community.signOut();
  await community.signUp({ handle: "guest_user", password: "goodnight3", nickname: "손님" });
  const guestComment = await community.addComment({ postId: post.id, body: "지나갑니다." });

  await community.signOut();
  await community.signIn({ handle: "sleepy_min", password: "goodnight1" });

  await community.deleteComment(guestComment.id);
  assert.equal(community.getPost(post.id).comments.length, 0);
});

test("수정한 글에는 수정 시각이 남는다", async () => {
  const community = await signedUpCommunity();
  const post = await community.createPost({ category: "free", title: "처음 제목", body: "처음 내용" });
  assert.equal(post.updatedAt, null);

  await community.updatePost({ postId: post.id, category: "question", title: "고친 제목", body: "고친 내용" });

  const updated = community.getPost(post.id);
  assert.equal(updated.title, "고친 제목");
  assert.equal(updated.categoryLabel, "질문");
  assert.equal(typeof updated.updatedAt, "string");
});

test("첫 실행에는 데모 글이 채워지고 두 번째 실행에는 늘어나지 않는다", async () => {
  const store = createMemoryStore();
  const sessionStore = createMemorySessionStore();

  const first = createCommunity({ store, sessionStore });
  await first.load();
  const seededCount = first.countPosts();
  assert.ok(seededCount > 0);

  const second = createCommunity({ store, sessionStore });
  await second.load();
  assert.equal(second.countPosts(), seededCount);
});

test("작성 시각은 사람이 읽는 상대 시간으로 바꾼다", () => {
  const now = new Date("2026-08-12T21:00:00Z");
  assert.equal(relativeTime("2026-08-12T20:59:40Z", now), "방금 전");
  assert.equal(relativeTime("2026-08-12T20:30:00Z", now), "30분 전");
  assert.equal(relativeTime("2026-08-12T18:00:00Z", now), "3시간 전");
  assert.equal(relativeTime("2026-08-10T21:00:00Z", now), "2일 전");
});

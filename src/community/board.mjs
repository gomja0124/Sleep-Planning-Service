// 게시판 도메인 로직. DOM도 저장소도 모르고, 넘겨받은 database 객체만 다룬다.

import { fail, nowIso, normalizeBody, normalizeText, randomId } from "./common.mjs";
import { findUserById, publicUser } from "./auth.mjs";

export const POST_CATEGORIES = {
  recruit: { id: "recruit", label: "모집", hint: "같이 잘 사람을 모아요" },
  proof: { id: "proof", label: "인증", hint: "오늘의 취침·기상을 남겨요" },
  question: { id: "question", label: "질문", hint: "수면 고민을 나눠요" },
  free: { id: "free", label: "자유", hint: "밤에 하고 싶은 이야기" },
};

export const TITLE_MIN = 2;
export const TITLE_MAX = 60;
export const BODY_MAX = 1000;
export const COMMENT_MAX = 300;

// 인기글 정렬 기준. 댓글이 달린 글을 좋아요만 있는 글보다 조금 더 위로 올린다.
export function popularityScore(post) {
  return post.likes.length * 3 + post.commentCount * 4;
}

function requireUser(database, userId) {
  const user = findUserById(database, userId);
  if (!user) fail("not_signed_in", "로그인이 필요한 기능이에요.");
  return user;
}

function requirePost(database, postId) {
  const post = database.posts.find((entry) => entry.id === postId);
  if (!post) fail("post_not_found", "이미 삭제된 글이에요.");
  return post;
}

function assertPostInput({ category, title, body }) {
  if (!POST_CATEGORIES[category]) {
    fail("invalid_category", "말머리를 선택해 주세요.");
  }
  if (title.length < TITLE_MIN || title.length > TITLE_MAX) {
    fail("invalid_title", `제목은 ${TITLE_MIN}~${TITLE_MAX}자로 써 주세요.`);
  }
  if (!body.length) {
    fail("invalid_body", "내용을 입력해 주세요.");
  }
  if (body.length > BODY_MAX) {
    fail("invalid_body", `내용은 ${BODY_MAX}자까지 쓸 수 있어요.`);
  }
}

export function createPost(database, { authorId, category, title, body }) {
  requireUser(database, authorId);
  const cleanTitle = normalizeText(title);
  const cleanBody = normalizeBody(body);
  assertPostInput({ category, title: cleanTitle, body: cleanBody });

  const post = {
    id: randomId("post"),
    authorId,
    category,
    title: cleanTitle,
    body: cleanBody,
    likes: [],
    createdAt: nowIso(),
    updatedAt: null,
  };
  database.posts.push(post);
  return post;
}

export function updatePost(database, { postId, actorId, category, title, body }) {
  const post = requirePost(database, postId);
  if (post.authorId !== actorId) {
    fail("forbidden", "내가 쓴 글만 수정할 수 있어요.");
  }

  const nextCategory = category ?? post.category;
  const cleanTitle = normalizeText(title);
  const cleanBody = normalizeBody(body);
  assertPostInput({ category: nextCategory, title: cleanTitle, body: cleanBody });

  post.category = nextCategory;
  post.title = cleanTitle;
  post.body = cleanBody;
  post.updatedAt = nowIso();
  return post;
}

export function deletePost(database, { postId, actorId }) {
  const post = requirePost(database, postId);
  if (post.authorId !== actorId) {
    fail("forbidden", "내가 쓴 글만 삭제할 수 있어요.");
  }

  database.posts = database.posts.filter((entry) => entry.id !== postId);
  database.comments = database.comments.filter((comment) => comment.postId !== postId);
  return post;
}

export function toggleLike(database, { postId, actorId }) {
  requireUser(database, actorId);
  const post = requirePost(database, postId);

  const index = post.likes.indexOf(actorId);
  if (index === -1) post.likes.push(actorId);
  else post.likes.splice(index, 1);

  return { post, liked: index === -1 };
}

export function addComment(database, { postId, authorId, body }) {
  requireUser(database, authorId);
  requirePost(database, postId);

  const cleanBody = normalizeBody(body);
  if (!cleanBody.length) fail("invalid_comment", "댓글 내용을 입력해 주세요.");
  if (cleanBody.length > COMMENT_MAX) {
    fail("invalid_comment", `댓글은 ${COMMENT_MAX}자까지 쓸 수 있어요.`);
  }

  const comment = {
    id: randomId("comment"),
    postId,
    authorId,
    body: cleanBody,
    createdAt: nowIso(),
  };
  database.comments.push(comment);
  return comment;
}

export function deleteComment(database, { commentId, actorId }) {
  const comment = database.comments.find((entry) => entry.id === commentId);
  if (!comment) fail("comment_not_found", "이미 삭제된 댓글이에요.");

  const post = database.posts.find((entry) => entry.id === comment.postId);
  // 댓글 작성자 본인과 글쓴이가 지울 수 있다.
  if (comment.authorId !== actorId && post?.authorId !== actorId) {
    fail("forbidden", "이 댓글을 삭제할 권한이 없어요.");
  }

  database.comments = database.comments.filter((entry) => entry.id !== commentId);
  return comment;
}

function decoratePost(database, post, viewerId) {
  const author = publicUser(findUserById(database, post.authorId));
  const commentCount = database.comments.filter((comment) => comment.postId === post.id).length;
  return {
    ...post,
    author: author ?? { id: post.authorId, nickname: "알 수 없음", character: "owl" },
    commentCount,
    likeCount: post.likes.length,
    likedByViewer: viewerId ? post.likes.includes(viewerId) : false,
    ownedByViewer: viewerId ? post.authorId === viewerId : false,
    categoryLabel: POST_CATEGORIES[post.category]?.label ?? "자유",
  };
}

export function listPosts(database, { sort = "latest", category = null, query = "", viewerId = null } = {}) {
  const keyword = normalizeText(query).toLowerCase();

  const entries = database.posts
    .map((post, index) => ({ index, view: decoratePost(database, post, viewerId) }))
    .filter(({ view }) => (category ? view.category === category : true))
    .filter(({ view }) => {
      if (!keyword) return true;
      return `${view.title} ${view.body} ${view.author.nickname}`.toLowerCase().includes(keyword);
    });

  // 같은 밀리초에 올라온 글은 나중에 저장된 쪽을 최신으로 본다.
  const byNewest = (left, right) =>
    String(right.view.createdAt).localeCompare(String(left.view.createdAt)) || right.index - left.index;

  if (sort === "popular") {
    entries.sort((left, right) =>
      popularityScore(right.view) - popularityScore(left.view) || byNewest(left, right));
  } else {
    entries.sort(byNewest);
  }

  return entries.map(({ view }) => view);
}

export function getPost(database, postId, viewerId = null) {
  const post = database.posts.find((entry) => entry.id === postId);
  if (!post) return null;

  const comments = database.comments
    .map((comment, index) => ({ comment, index }))
    .filter(({ comment }) => comment.postId === postId)
    .sort((left, right) =>
      String(left.comment.createdAt).localeCompare(String(right.comment.createdAt))
      || left.index - right.index)
    .map(({ comment }) => ({
      ...comment,
      author: publicUser(findUserById(database, comment.authorId))
        ?? { id: comment.authorId, nickname: "알 수 없음", character: "owl" },
      removableByViewer: viewerId
        ? comment.authorId === viewerId || post.authorId === viewerId
        : false,
    }));

  return { ...decoratePost(database, post, viewerId), comments };
}

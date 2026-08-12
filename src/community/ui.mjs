// app.js와 somni.js가 함께 쓰는 게시판 화면.
//
// 두 화면은 스타일시트도 셸 구조도 다르기 때문에, 이 모듈은 DOM을 직접 소유하지 않고
// HTML 문자열과 이벤트 처리 결과만 돌려준다. 호스트는 자기 렌더 루틴 안에서
// renderCommunity()를 끼워 넣고, 자기 이벤트 리스너에서 handleCommunityClick()과
// handleCommunitySubmit()에 먼저 물어보면 된다.
// 클래스 이름은 전부 cm- 로 시작해서 어느 스타일시트와도 겹치지 않는다.

import { POST_CATEGORIES, relativeTime } from "./index.mjs";

const TABS = [
  { id: "latest", label: "최신글", sort: "latest", category: null },
  { id: "popular", label: "인기글", sort: "popular", category: null },
  { id: "recruit", label: "모집글", sort: "latest", category: "recruit" },
];

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#039;",
    '"': "&quot;",
  }[character]));
}

function multiline(value) {
  return escapeHtml(value).replace(/\n/g, "<br>");
}

export function createCommunityViewState() {
  return {
    screen: "list", // list | detail | compose | auth
    tab: "latest",
    query: "",
    openPostId: null,
    editingPostId: null,
    authMode: "signin",
    error: null,
  };
}

function avatar(user) {
  const initial = escapeHtml(String(user?.nickname ?? "?").slice(0, 1));
  return `<span class="cm-avatar cm-avatar-${escapeHtml(user?.character ?? "owl")}" aria-hidden="true">${initial}</span>`;
}

function accountBar(community, view) {
  if (community.isSignedIn) {
    const user = community.currentUser;
    return `<div class="cm-account">
      ${avatar(user)}
      <span class="cm-account-name"><b>${escapeHtml(user.nickname)}</b><small>@${escapeHtml(user.handle)}</small></span>
      <button type="button" class="cm-ghost" data-cm-action="signout">로그아웃</button>
    </div>`;
  }
  return `<div class="cm-account">
    <span class="cm-account-name"><b>로그인하지 않았어요</b><small>글쓰기와 댓글은 로그인 후에</small></span>
    <button type="button" class="cm-primary cm-compact" data-cm-action="open-auth">로그인</button>
  </div>`;
}

function errorBanner(view) {
  if (!view.error) return "";
  return `<p class="cm-error" role="alert">${escapeHtml(view.error)}</p>`;
}

function postCard(post) {
  return `<article class="cm-card" data-cm-action="open-post" data-post-id="${escapeHtml(post.id)}" role="button" tabindex="0">
    <div class="cm-card-top">
      <span class="cm-chip cm-chip-${escapeHtml(post.category)}">${escapeHtml(post.categoryLabel)}</span>
      <small class="cm-time">${escapeHtml(relativeTime(post.createdAt))}</small>
    </div>
    <h4 class="cm-card-title">${escapeHtml(post.title)}</h4>
    <p class="cm-card-body">${escapeHtml(post.body)}</p>
    <div class="cm-card-foot">
      ${avatar(post.author)}
      <small>${escapeHtml(post.author.nickname)}</small>
      <span class="cm-counts">
        <b class="${post.likedByViewer ? "cm-liked" : ""}">♥ ${post.likeCount}</b>
        <b>💬 ${post.commentCount}</b>
      </span>
    </div>
  </article>`;
}

function renderList(community, view) {
  const tab = TABS.find((entry) => entry.id === view.tab) ?? TABS[0];
  const posts = community.listPosts({ sort: tab.sort, category: tab.category, query: view.query });

  const tabs = TABS.map((entry) => `<button type="button" class="${entry.id === view.tab ? "is-active" : ""}" data-cm-action="set-tab" data-tab="${entry.id}">${entry.label}</button>`).join("");

  const list = posts.length
    ? posts.map(postCard).join("")
    : `<p class="cm-empty">${view.query ? "검색 결과가 없어요." : "아직 글이 없어요. 첫 글을 남겨 보세요."}</p>`;

  return `<section class="cm">
    <header class="cm-head">
      <div><span class="cm-kicker">COMMUNITY</span><h2>커뮤니티 게시판</h2></div>
      <button type="button" class="cm-primary" data-cm-action="open-compose">글쓰기</button>
    </header>
    ${accountBar(community, view)}
    ${errorBanner(view)}
    <div class="cm-tabs">${tabs}</div>
    <label class="cm-search">
      <span class="cm-visually-hidden">게시글 검색</span>
      <input type="search" name="cm-query" placeholder="제목·내용·닉네임 검색" value="${escapeHtml(view.query)}" data-cm-input="query">
    </label>
    <div class="cm-list">${list}</div>
  </section>`;
}

function renderDetail(community, view) {
  const post = community.getPost(view.openPostId);
  if (!post) {
    return `<section class="cm">
      <button type="button" class="cm-back" data-cm-action="back-to-list">← 목록으로</button>
      <p class="cm-empty">이미 삭제된 글이에요.</p>
    </section>`;
  }

  const ownerButtons = post.ownedByViewer
    ? `<div class="cm-owner-actions">
        <button type="button" class="cm-ghost" data-cm-action="edit-post" data-post-id="${escapeHtml(post.id)}">수정</button>
        <button type="button" class="cm-ghost cm-danger" data-cm-action="delete-post" data-post-id="${escapeHtml(post.id)}">삭제</button>
      </div>`
    : "";

  const comments = post.comments.length
    ? post.comments.map((comment) => `<li class="cm-comment">
        ${avatar(comment.author)}
        <div>
          <small><b>${escapeHtml(comment.author.nickname)}</b> · ${escapeHtml(relativeTime(comment.createdAt))}</small>
          <p>${multiline(comment.body)}</p>
        </div>
        ${comment.removableByViewer ? `<button type="button" class="cm-ghost cm-danger cm-compact" data-cm-action="delete-comment" data-comment-id="${escapeHtml(comment.id)}">삭제</button>` : ""}
      </li>`).join("")
    : `<li class="cm-empty">첫 댓글을 남겨 보세요.</li>`;

  const commentForm = community.isSignedIn
    ? `<form class="cm-comment-form" data-cm-form="comment" data-post-id="${escapeHtml(post.id)}">
        <input type="text" name="body" placeholder="따뜻한 댓글을 남겨 주세요" maxlength="300" required>
        <button type="submit" class="cm-primary cm-compact">등록</button>
      </form>`
    : `<button type="button" class="cm-signin-hint" data-cm-action="open-auth">댓글을 쓰려면 로그인해 주세요</button>`;

  return `<section class="cm">
    <button type="button" class="cm-back" data-cm-action="back-to-list">← 목록으로</button>
    ${errorBanner(view)}
    <article class="cm-detail">
      <div class="cm-card-top">
        <span class="cm-chip cm-chip-${escapeHtml(post.category)}">${escapeHtml(post.categoryLabel)}</span>
        <small class="cm-time">${escapeHtml(relativeTime(post.createdAt))}${post.updatedAt ? " · 수정됨" : ""}</small>
      </div>
      <h2>${escapeHtml(post.title)}</h2>
      <div class="cm-detail-author">${avatar(post.author)}<small>${escapeHtml(post.author.nickname)}</small></div>
      <p class="cm-detail-body">${multiline(post.body)}</p>
      <div class="cm-detail-actions">
        <button type="button" class="cm-like ${post.likedByViewer ? "is-liked" : ""}" data-cm-action="toggle-like" data-post-id="${escapeHtml(post.id)}">♥ 좋아요 ${post.likeCount}</button>
        ${ownerButtons}
      </div>
    </article>
    <section class="cm-comments">
      <h3>댓글 ${post.commentCount}</h3>
      <ul>${comments}</ul>
      ${commentForm}
    </section>
  </section>`;
}

function renderCompose(community, view) {
  const editing = view.editingPostId ? community.getPost(view.editingPostId) : null;
  const categoryOptions = Object.values(POST_CATEGORIES).map((category) => {
    const checked = (editing?.category ?? "recruit") === category.id ? "checked" : "";
    return `<label class="cm-category">
      <input type="radio" name="category" value="${category.id}" ${checked} required>
      <span><b>${category.label}</b><small>${category.hint}</small></span>
    </label>`;
  }).join("");

  return `<section class="cm">
    <button type="button" class="cm-back" data-cm-action="back-to-list">← 목록으로</button>
    ${errorBanner(view)}
    <form class="cm-form" data-cm-form="post" ${editing ? `data-post-id="${escapeHtml(editing.id)}"` : ""}>
      <h2>${editing ? "글 수정하기" : "새 글 쓰기"}</h2>
      <fieldset class="cm-categories">
        <legend>말머리</legend>
        ${categoryOptions}
      </fieldset>
      <label class="cm-field">
        <span>제목</span>
        <input type="text" name="title" maxlength="60" required value="${escapeHtml(editing?.title ?? "")}" placeholder="어떤 이야기인가요?">
      </label>
      <label class="cm-field">
        <span>내용</span>
        <textarea name="body" rows="7" maxlength="1000" required placeholder="같이 자기로 한 약속, 오늘의 기록, 수면 고민 모두 좋아요.">${escapeHtml(editing?.body ?? "")}</textarea>
      </label>
      <button type="submit" class="cm-primary cm-full">${editing ? "수정 완료" : "올리기"}</button>
    </form>
  </section>`;
}

function renderAuth(community, view) {
  const isSignUp = view.authMode === "signup";
  return `<section class="cm">
    <button type="button" class="cm-back" data-cm-action="back-to-list">← 목록으로</button>
    <div class="cm-auth-switch">
      <button type="button" class="${isSignUp ? "" : "is-active"}" data-cm-action="set-auth-mode" data-mode="signin">로그인</button>
      <button type="button" class="${isSignUp ? "is-active" : ""}" data-cm-action="set-auth-mode" data-mode="signup">회원가입</button>
    </div>
    ${errorBanner(view)}
    <form class="cm-form" data-cm-form="auth" data-mode="${isSignUp ? "signup" : "signin"}">
      <h2>${isSignUp ? "밤가이 커뮤니티에 처음 오셨군요" : "다시 만나서 반가워요"}</h2>
      <label class="cm-field">
        <span>아이디</span>
        <input type="text" name="handle" autocomplete="username" required placeholder="영문·숫자·밑줄 4~20자">
      </label>
      ${isSignUp ? `<label class="cm-field">
        <span>닉네임</span>
        <input type="text" name="nickname" required maxlength="12" placeholder="게시판에 보일 이름">
      </label>` : ""}
      <label class="cm-field">
        <span>비밀번호</span>
        <input type="password" name="password" autocomplete="${isSignUp ? "new-password" : "current-password"}" required placeholder="8자 이상">
      </label>
      <button type="submit" class="cm-primary cm-full">${isSignUp ? "가입하고 시작하기" : "로그인"}</button>
      <p class="cm-note">데모용 계정입니다. 이 브라우저에만 저장되고 서버로 보내지 않으니, 실제로 쓰는 비밀번호는 넣지 마세요.</p>
    </form>
  </section>`;
}

export function renderCommunity(community, view) {
  if (view.screen === "auth") return renderAuth(community, view);
  if (view.screen === "compose") return renderCompose(community, view);
  if (view.screen === "detail") return renderDetail(community, view);
  return renderList(community, view);
}

function messageOf(error) {
  return error?.code ? error.message : "예상치 못한 문제가 생겼어요. 다시 시도해 주세요.";
}

// 호스트의 click 리스너에서 먼저 호출한다.
// 이 모듈이 처리했으면 { handled: true }를 돌려주고, 호스트는 다시 렌더하면 된다.
export async function handleCommunityClick(event, { community, view, confirm = () => true } = {}) {
  const target = event.target.closest("[data-cm-action]");
  if (!target) return { handled: false };

  const { cmAction: action, postId, commentId, tab, mode } = target.dataset;
  view.error = null;

  try {
    if (action === "set-tab") {
      view.tab = tab;
    } else if (action === "open-post") {
      view.openPostId = postId;
      view.screen = "detail";
    } else if (action === "back-to-list") {
      view.screen = "list";
      view.editingPostId = null;
    } else if (action === "open-compose") {
      if (!community.isSignedIn) {
        view.screen = "auth";
        view.error = "글을 쓰려면 먼저 로그인해 주세요.";
      } else {
        view.editingPostId = null;
        view.screen = "compose";
      }
    } else if (action === "edit-post") {
      view.editingPostId = postId;
      view.screen = "compose";
    } else if (action === "delete-post") {
      if (!confirm("이 글을 삭제할까요? 댓글도 함께 사라져요.")) return { handled: true, rerender: false };
      await community.deletePost(postId);
      view.screen = "list";
      view.openPostId = null;
      return { handled: true, rerender: true, toast: "글을 삭제했어요." };
    } else if (action === "toggle-like") {
      const { liked } = await community.toggleLike(postId);
      return { handled: true, rerender: true, toast: liked ? "이 글을 응원했어요." : "응원을 취소했어요." };
    } else if (action === "delete-comment") {
      await community.deleteComment(commentId);
      return { handled: true, rerender: true, toast: "댓글을 삭제했어요." };
    } else if (action === "open-auth") {
      view.screen = "auth";
      view.authMode = "signin";
    } else if (action === "set-auth-mode") {
      view.authMode = mode;
    } else if (action === "signout") {
      await community.signOut();
      view.screen = "list";
      return { handled: true, rerender: true, toast: "로그아웃했어요." };
    } else {
      return { handled: false };
    }
  } catch (error) {
    view.error = messageOf(error);
    if (error.code === "not_signed_in") view.screen = "auth";
  }

  return { handled: true, rerender: true };
}

// 호스트의 submit 리스너에서 먼저 호출한다.
export async function handleCommunitySubmit(event, { community, view } = {}) {
  const form = event.target.closest("[data-cm-form]");
  if (!form) return { handled: false };

  event.preventDefault();
  const data = new FormData(form);
  const kind = form.dataset.cmForm;
  view.error = null;

  try {
    if (kind === "auth") {
      const credentials = {
        handle: String(data.get("handle") ?? ""),
        password: String(data.get("password") ?? ""),
      };
      const user = form.dataset.mode === "signup"
        ? await community.signUp({ ...credentials, nickname: String(data.get("nickname") ?? "") })
        : await community.signIn(credentials);
      view.screen = "list";
      return { handled: true, rerender: true, toast: `${user.nickname}님, 환영해요.` };
    }

    if (kind === "post") {
      const payload = {
        category: String(data.get("category") ?? ""),
        title: String(data.get("title") ?? ""),
        body: String(data.get("body") ?? ""),
      };
      const editingId = form.dataset.postId;
      const post = editingId
        ? await community.updatePost({ postId: editingId, ...payload })
        : await community.createPost(payload);
      view.editingPostId = null;
      view.openPostId = post.id;
      view.screen = "detail";
      return { handled: true, rerender: true, toast: editingId ? "글을 수정했어요." : "글을 올렸어요." };
    }

    if (kind === "comment") {
      await community.addComment({ postId: form.dataset.postId, body: String(data.get("body") ?? "") });
      return { handled: true, rerender: true, toast: "댓글을 남겼어요." };
    }
  } catch (error) {
    view.error = messageOf(error);
    if (error.code === "not_signed_in") view.screen = "auth";
    return { handled: true, rerender: true };
  }

  return { handled: false };
}

// 검색창 입력을 반영한다. 호스트의 input 리스너에서 호출한다.
export function handleCommunityInput(event, { view } = {}) {
  if (event.target?.dataset?.cmInput !== "query") return { handled: false };
  view.query = event.target.value;
  return { handled: true, rerender: true, preserveFocus: true };
}

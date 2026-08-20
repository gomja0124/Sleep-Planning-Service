// 서버에서 받아온 글 목록을 화면에 맞게 고르고 줄 세우는 순수 함수들.
//
// 권한 검사와 검증은 전부 백엔드(planner/views.py)로 옮겼다. 여기 남은 것은
// 이미 받아온 배열을 다루는 표시 로직뿐이라 DOM도 네트워크도 건드리지 않는다.

import { normalizeText } from "./common.mjs";

// 서버 CommunityPost.POST_TYPES와 값이 일치해야 한다.
export const POST_CATEGORIES = {
  recruitment: { id: "recruitment", label: "모집", hint: "같이 잘 사람을 모아요" },
  proof: { id: "proof", label: "인증", hint: "오늘의 취침·기상을 남겨요" },
  question: { id: "question", label: "질문", hint: "수면 고민을 나눠요" },
  free: { id: "free", label: "자유", hint: "밤에 하고 싶은 이야기" },
};

// 운영이 만드는 말머리. 글쓰기 화면에는 노출하지 않지만 목록에는 나온다.
export const SYSTEM_CATEGORIES = {
  challenge: { id: "challenge", label: "도전" },
  season: { id: "season", label: "시즌" },
};

export function categoryLabel(type) {
  return POST_CATEGORIES[type]?.label ?? SYSTEM_CATEGORIES[type]?.label ?? "자유";
}

// 인기글 정렬 기준. 댓글이 달린 글을 좋아요만 있는 글보다 조금 더 위로 올린다.
export function popularityScore(post) {
  return (post.likeCount ?? 0) * 3 + (post.commentCount ?? 0) * 4;
}

export function listPosts(posts, { sort = "latest", category = null, query = "" } = {}) {
  const keyword = normalizeText(query).toLowerCase();

  const entries = posts
    .map((post, index) => ({ index, post }))
    .filter(({ post }) => (category ? post.type === category : true))
    .filter(({ post }) => {
      if (!keyword) return true;
      const haystack = `${post.title} ${post.body} ${post.author?.nickname ?? ""}`;
      return haystack.toLowerCase().includes(keyword);
    });

  // 서버가 이미 최신순으로 주지만, 같은 초에 올라온 글까지 안정적으로 줄 세운다.
  const byNewest = (left, right) =>
    String(right.post.createdAt).localeCompare(String(left.post.createdAt))
    || left.index - right.index;

  if (sort === "popular") {
    entries.sort((left, right) =>
      popularityScore(right.post) - popularityScore(left.post) || byNewest(left, right));
  } else {
    entries.sort(byNewest);
  }

  return entries.map(({ post }) => post);
}

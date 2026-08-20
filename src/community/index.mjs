// 커뮤니티 기능의 단일 진입점.
//
// 화면(somni.js, app.js)은 이 파사드만 알면 된다. 데이터는 전부 Django 백엔드에
// 있고, 로그인 세션은 앱이 이미 쓰고 있는 것을 그대로 따라간다. 이 모듈은 계정을
// 따로 만들지 않는다.
//
// 조회는 동기(캐시된 배열), 변경은 비동기(서버 왕복 후 캐시 갱신)로 나눠 두어서
// 화면은 항상 최신 상태를 바로 그릴 수 있다.

import { listPosts } from "./board.mjs";

export { POST_CATEGORIES, SYSTEM_CATEGORIES, categoryLabel } from "./board.mjs";
export { relativeTime } from "./common.mjs";

// client는 api-client.js의 api 객체다. 여기서 직접 import하지 않는 이유는
// api-client.js가 모듈을 읽는 순간 location을 건드려서 Node 테스트에서 깨지기 때문이다.
export function createCommunity({ client }) {
  let posts = [];
  let openPost = null;
  let viewer = null;
  let loaded = false;

  function adoptPost(updated) {
    posts = posts.map((post) => (post.id === updated.id ? { ...post, ...updated } : post));
    if (openPost?.id === updated.id) openPost = { ...openPost, ...updated };
  }

  async function refreshPosts() {
    const data = await client.communityPosts();
    posts = data.results ?? [];
    return posts;
  }

  return {
    // 로그인하지 않았으면 401이 나므로, 게시판은 비어 있는 채로 로그인 안내를 띄운다.
    async load() {
      try {
        const data = await client.me();
        viewer = {
          id: data.id ?? null,
          nickname: data.profile?.name ?? "나",
          character: data.selectedCharacter ?? "owl",
        };
        await refreshPosts();
      } catch {
        viewer = null;
        posts = [];
      }
      loaded = true;
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

    get openPost() {
      return openPost;
    },

    listPosts(options = {}) {
      return listPosts(posts, options);
    },

    countPosts() {
      return posts.length;
    },

    async refresh() {
      return refreshPosts();
    },

    async loadPost(postId) {
      openPost = await client.communityPost(postId);
      return openPost;
    },

    closePost() {
      openPost = null;
    },

    async createPost({ category, title, body }) {
      const post = await client.createCommunityPost({ type: category, title, body });
      await refreshPosts();
      openPost = await client.communityPost(post.id);
      return post;
    },

    async updatePost({ postId, category, title, body }) {
      const post = await client.updateCommunityPost(postId, { type: category, title, body });
      await refreshPosts();
      openPost = await client.communityPost(postId);
      return post;
    },

    async deletePost(postId) {
      await client.deleteCommunityPost(postId);
      posts = posts.filter((post) => post.id !== postId);
      if (openPost?.id === postId) openPost = null;
    },

    async toggleLike(postId) {
      const result = await client.likeCommunityPost(postId);
      adoptPost({ id: postId, likeCount: result.likeCount, likedByViewer: result.liked });
      return result;
    },

    async addComment({ postId, body }) {
      const comment = await client.addCommunityComment(postId, body);
      if (openPost?.id !== postId) return comment;

      const comments = [...openPost.comments, comment];
      openPost = { ...openPost, comments, commentCount: comments.length };
      adoptPost({ id: postId, commentCount: comments.length });
      return comment;
    },

    async deleteComment(commentId) {
      await client.deleteCommunityComment(commentId);
      if (!openPost) return;

      const comments = openPost.comments.filter((comment) => comment.id !== commentId);
      openPost = { ...openPost, comments, commentCount: comments.length };
      adoptPost({ id: openPost.id, commentCount: comments.length });
    },
  };
}

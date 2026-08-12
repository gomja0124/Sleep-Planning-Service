// 첫 실행에서 게시판이 비어 보이지 않도록 넣는 데모 데이터.
// demo 계정에는 비밀번호 해시가 없어서 로그인할 수 없다. 글쓴이 역할만 한다.

import { nowIso } from "./common.mjs";

const HOUR = 60 * 60 * 1000;

const DEMO_USERS = [
  { id: "user_demo_lumi", handle: "lumi_owl", nickname: "루미지기", character: "owl" },
  { id: "user_demo_bami", handle: "bami_night", nickname: "밤샘탈출", character: "bat" },
  { id: "user_demo_momo", handle: "momo_rest", nickname: "모모모", character: "cat" },
];

const DEMO_POSTS = [
  {
    id: "post_demo_1",
    authorId: "user_demo_lumi",
    category: "recruit",
    title: "서울대 멋사 낮밤바꾸기 취침팟 모집해요",
    body: "자정 전에 같이 불 끄고 아침 기상 체크까지 하는 팟이에요.\n지금 8명이고 두 자리 남았습니다. 강제성은 없고, 서로 인증만 올려요.",
    hoursAgo: 2,
    likedBy: ["user_demo_bami", "user_demo_momo"],
  },
  {
    id: "post_demo_2",
    authorId: "user_demo_bami",
    category: "proof",
    title: "3일 연속 00시 전에 누웠습니다",
    body: "과제 몰아서 하던 습관 고치는 중인데 생각보다 할 만해요.\n알람 끄고 바로 일어나는 게 제일 어렵네요.",
    hoursAgo: 5,
    likedBy: ["user_demo_lumi"],
  },
  {
    id: "post_demo_3",
    authorId: "user_demo_momo",
    category: "question",
    title: "낮잠 자면 밤에 잠이 안 오는데 어떻게 하세요?",
    body: "점심 먹고 30분만 자려다가 두 시간씩 자버립니다.\n다들 낮잠 어떻게 관리하시는지 궁금해요.",
    hoursAgo: 9,
    likedBy: [],
  },
];

const DEMO_COMMENTS = [
  {
    id: "comment_demo_1",
    postId: "post_demo_1",
    authorId: "user_demo_momo",
    body: "저 한 자리 신청할게요! 기상 체크는 몇 시까지 올리면 되나요?",
    hoursAgo: 1,
  },
  {
    id: "comment_demo_2",
    postId: "post_demo_3",
    authorId: "user_demo_bami",
    body: "저는 알람 맞춰두고 20분 넘기지 않으려고 해요. 넘어가면 그날 밤이 통째로 밀리더라고요.",
    hoursAgo: 7,
  },
];

function agoIso(hours) {
  return new Date(Date.now() - hours * HOUR).toISOString();
}

export function seedDatabase(database) {
  if (database.users.length || database.posts.length) return database;

  database.users = DEMO_USERS.map((user) => ({
    ...user,
    passwordSalt: null,
    passwordHash: null,
    joinedAt: nowIso(),
    demo: true,
  }));

  database.posts = DEMO_POSTS.map(({ hoursAgo, likedBy, ...post }) => ({
    ...post,
    likes: [...likedBy],
    createdAt: agoIso(hoursAgo),
    updatedAt: null,
  }));

  database.comments = DEMO_COMMENTS.map(({ hoursAgo, ...comment }) => ({
    ...comment,
    createdAt: agoIso(hoursAgo),
  }));

  return database;
}

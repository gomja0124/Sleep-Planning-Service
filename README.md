# 밤가이 · Sleep Planning Service

매일 다른 대학생의 일정에 맞춰 오늘 지킬 수 있는 취침 구간을 제안하는 모바일 웹 MVP입니다.

현재 `feat/dogyeong-sleep-planner` 브랜치에는 도경 담당 범위 중 아래 흐름이 구현되어 있습니다.

- 첫 실행 `캐릭터 선택 → 내 리듬 → 메인` 온보딩과 선택값 유지
- 일어나야 할 시간·원하는 수면 길이 초기 설정
- 12시간제·24시간제 전역 시간 표시 설정
- 권장 불 끄기 구간은 `00·05·10…55분` 눈금으로 제안하고, 제안 후에는 1분 단위로 앞/뒤 조절
- 고정 일정과 변동 일정의 입력·수정·삭제
- Apple·Google Calendar 선택 연결·동기화 상태 목업
- 통학·준비·평균 입면 시간을 반영한 취침 구간 계산
- 추천 근거 및 취침 준비·불 끄기·기상 알림 시각 표시
- 수면 Live Activity 목업 → 기상 알람 → 알람 끄기 → 기상 체크
- 아침 컨디션 피드백 저장, 다음 추천 반영, 꾸미기 포인트 지급
- 커뮤니티 게시판, 친구 모집, 공동 연속 일수, 취침팟·누적 수면 도전, 시즌 보상 화면
- 초기 2~3주/안정화 이후 업데이트 정책 안내

## 커뮤니티 게시판

`feat/ppine-community` 브랜치에서 게시판과 로그인을 붙였습니다.

- 아이디·비밀번호 회원가입과 로그인, 새로고침 후에도 유지되는 세션
- 말머리(모집·인증·질문·자유)별 글쓰기, 수정, 삭제
- 최신글·인기글·모집글 정렬과 제목·내용·닉네임 검색
- 댓글 작성과 삭제, 좋아요와 취소
- 로그인하지 않은 사람은 읽기만 가능하고, 글쓰기를 누르면 로그인 화면으로 안내

게시판 로직은 `src/community/`에 화면과 분리해 두어서 두 진입점이 같은 모듈과 같은 저장소를 공유합니다.
한쪽에서 쓴 글이 다른 쪽에도 그대로 보입니다.

비밀번호는 PBKDF2-SHA256 해시로만 저장하지만, 저장 위치가 브라우저 `localStorage`라 기기 주인은 언제든 꺼내 볼 수 있습니다.
실제 계정 보호는 서버를 붙이는 단계에서만 성립하므로, 로그인 화면에도 실제 쓰는 비밀번호를 넣지 말라고 안내하고 있습니다.
지금 단계의 목적은 서버 API와 같은 모양의 비동기 인터페이스를 먼저 확정해 두는 것입니다.

서버를 붙일 때는 `src/community/store.mjs`의 `read`/`write`를 `fetch` 구현으로 바꾸거나,
`src/community/index.mjs`의 메서드 본문을 API 호출로 치환하면 됩니다. 화면 코드는 손대지 않아도 됩니다.

## 실행

별도 패키지 설치가 필요 없습니다.

```bash
npm run dev
```

진입점이 두 개입니다.

- [http://localhost:4173](http://localhost:4173) — `src/somni.js` 모바일 앱 (홈·루틴·커뮤니티·리포트·설정)
- [http://localhost:4173/planner.html](http://localhost:4173/planner.html) — `src/app.js` 수면 계획 앱 (오늘·일정·커뮤니티·내 리듬)

`index.html`은 `153b236` 커밋에서 `src/somni.js`로 교체됐고, 그때부터 `src/app.js`는 어떤 HTML도 읽지 않는 상태였습니다.
두 화면을 모두 살리기 위해 `planner.html`을 따로 두었습니다.

## 테스트

```bash
npm test
```

## 구조

```text
.
├── index.html                    # somni 모바일 앱 진입점
├── planner.html                  # 수면 계획 앱 진입점
├── somni.css                     # 모바일 앱 스타일
├── styles.css                    # 수면 계획 앱 스타일
├── community.css                 # 게시판 전용 스타일 (두 진입점이 공유)
├── DESIGN.md                     # 모바일 앱용 디자인 시스템·Claude Design 프롬프트
├── assets/characters.png         # 올빼미·박쥐 캐릭터 원본 에셋
├── src/
│   ├── somni.js                  # 모바일 앱 화면
│   ├── app.js                    # 수면 계획 화면, 일정 CRUD, 로컬 데이터 흐름
│   ├── planner.mjs               # 설명 가능한 수면 계획 계산 로직
│   └── community/
│       ├── index.mjs             # 게시판 파사드 · 서버로 갈아끼울 지점
│       ├── auth.mjs              # 회원가입·로그인·세션
│       ├── board.mjs             # 글·댓글·좋아요 도메인 로직
│       ├── store.mjs             # 저장소 어댑터 (localStorage / 메모리)
│       ├── seed.mjs              # 첫 실행용 데모 글
│       ├── ui.mjs                # 두 화면이 공유하는 게시판 렌더러
│       └── common.mjs            # 공통 오류 타입과 유틸
├── tests/
│   ├── planner.test.mjs          # 계산 로직 단위 테스트
│   └── community.test.mjs        # 게시판·인증 단위 테스트
└── docs/도경_회의전_체크리스트.md
```

데모 데이터는 브라우저 `localStorage`에만 저장됩니다. 백엔드 연동 시 `src/app.js`의 저장 함수만 API 호출로 교체할 수 있도록 계산 로직을 분리했습니다.

Apple·Google Calendar, iPhone 단축어, ActivityKit·WidgetKit Live Activity와 실제 기상 알람은 웹에서 직접 호출하지 않습니다. 현재 브랜치에서는 사용자 흐름과 상태 계약을 검증하는 목업으로 구현했으며, 네이티브 iOS PoC에서 실제 권한과 백그라운드 동작을 연결해야 합니다.

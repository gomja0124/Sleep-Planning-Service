# 밤가이 · Sleep Planning Service

매일 다른 대학생의 일정에 맞춰 오늘 지킬 수 있는 취침 구간을 제안하는 모바일 웹 MVP입니다.

현재 `main`은 Somni 모바일 프론트엔드와 Django API, 계정·캘린더·적응형 수면 분석을 통합한 상태입니다.

- 첫 실행 `캐릭터 선택 → 내 리듬 → 메인` 온보딩과 선택값 유지
- 일어나야 할 시간·원하는 수면 길이 초기 설정
- 12시간제·24시간제 전역 시간 표시 설정
- 권장 불 끄기 구간은 `00·05·10…55분` 눈금으로 제안하고, 제안 후에는 1분 단위로 앞/뒤 조절
- 고정 일정과 변동 일정의 입력·수정·삭제
- Apple·Google Calendar 선택 연결·자동/수동 동기화
- 통학·준비·평균 입면 시간을 반영한 취침 구간 계산
- 추천 근거 및 취침 준비·불 끄기·기상 알림 시각 표시
- 수면 Live Activity 목업 → 기상 알람 → 알람 끄기 → 기상 체크
- 아침 컨디션·입면 지연·낮 졸림·낮잠 기록을 통한 적응형 수면 목표 탐색
- 커뮤니티 게시판, 친구 모집, 공동 연속 일수, 취침팟·누적 수면 도전, 시즌 보상 화면
- 초기 2~3주/안정화 이후 업데이트 정책 안내

## 실행

파이썬 가상환경의 의존성을 설치한 뒤 DB와 두 서버를 실행합니다.

```bash
.venv/bin/pip install -r requirements.txt
.venv/bin/python backend/manage.py migrate
.venv/bin/python backend/manage.py runserver
# 다른 터미널
npm run dev
```

브라우저에서 [http://localhost:4173](http://localhost:4173)을 엽니다.
`src/app.js` 쪽 수면 계획 화면은 [http://localhost:4173/planner.html](http://localhost:4173/planner.html)에서 볼 수 있습니다.

## 커뮤니티 게시판

`feat/ppine-community` 브랜치에서 게시판을 붙였습니다. 계정은 앱이 이미 쓰는
로그인 세션을 그대로 따라가고, 게시판이 계정을 따로 만들지 않습니다.

- 말머리(모집·인증·질문·자유)별 글쓰기, 수정, 삭제
- 최신글·인기글·모집글 정렬과 제목·내용·닉네임 검색
- 댓글 작성과 삭제, 좋아요와 취소
- 글쓴이만 자기 글을 수정·삭제하고, 댓글은 작성자 본인과 글쓴이가 삭제

데이터는 전부 Django 백엔드에 있습니다. 화면 로직은 `src/community/`에 모아 두어
`src/somni.js`와 `src/app.js`가 같은 모듈과 같은 서버를 공유합니다. 어느 화면에서
쓴 글이든 양쪽에 그대로 보입니다.

읽기에도 로그인이 필요한데, `/api/v1/` 전체를 막는 기존
`ApiLoginRequiredMiddleware` 규칙을 그대로 따랐기 때문입니다.

말머리는 서버의 `CommunityPost.POST_TYPES`가 기준입니다. 운영이 만드는
`challenge`·`season`은 목록에는 나오지만 글쓰기 화면에는 노출하지 않습니다.

Google Calendar OAuth를 사용하려면 Google Cloud Console에서 Calendar API를
활성화하고 OAuth 웹 클라이언트의 승인된 리디렉션 URI에
`http://localhost:8000/accounts/google/login/callback/`을 등록하세요. 이후
`.env.example`을 참고해 `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`을 서버 환경에
설정하면 앱 설정 화면의 Google Calendar 연결 버튼이 활성화됩니다.

Apple Calendar는 OAuth 대신 iOS EventKit 권한으로 연동합니다. 실제 iPhone용
SwiftUI/WKWebView 셸과 변경 감지 브리지는 [`ios/README.md`](./ios/README.md)에
있으며, 브라우저에서 Apple 연결을 누른 경우에는 연결된 것으로 잘못 표시하지
않고 iPhone 앱이 필요하다는 안내를 표시합니다.

로컬 개발 환경에서는 `SLEEP_RECORD_TEST_MODE=true`가 기본값입니다. 같은 날짜에
수면 사이클을 반복해도 기록 날짜를 하루씩 증가시켜 저장하므로, 유효 기록 3건에
따른 추천 수면 변경을 바로 검증할 수 있습니다. 실제 날짜 기준으로 테스트하려면
환경변수를 `false`로 설정하세요. `DJANGO_DEBUG=false`인 운영 환경에서는 항상
비활성화됩니다.

## 테스트

```bash
npm run test:all
```

## 배포

**Django가 프런트까지 같은 출처에서 서빙합니다.** 서비스 하나만 올리면 됩니다.

프런트와 API를 다른 사이트에 나눠 올리면 세션 쿠키가 크로스사이트 쿠키가 되는데,
Safari와 Firefox는 이를 기본 차단합니다. 아이폰에서 로그인이 안 된다는 뜻이라
수면 앱에는 치명적입니다. 같은 출처로 내보내면 이 문제가 생기지 않고 CORS도
필요 없습니다.

Render 기준으로는 저장소에 `render.yaml`이 있어 **Blueprint로 한 번에** 만들어집니다.
대시보드에서 New + → Blueprint → 이 저장소를 고르면 웹 서비스와 Postgres가 함께
생성되고, 비밀 키는 Render가 생성합니다. 손으로 넣어야 하는 환경변수가 없습니다.

직접 설정할 때는 아래 두 명령을 씁니다.

- **Build Command** — `./build.sh` (의존성 설치, 프런트 복사, 정적 파일 수집, 마이그레이션)
- **Start Command** — `gunicorn bamgai.wsgi:application --chdir backend --bind 0.0.0.0:$PORT`

| 변수 | 값 | 없으면 |
|---|---|---|
| `DJANGO_DEBUG` | `false` | 예외 화면에 소스와 설정이 노출됩니다 |
| `DJANGO_SECRET_KEY` | 길고 무작위한 값 | **서버가 아예 뜨지 않습니다** |
| `DJANGO_ALLOWED_HOSTS` | 배포 도메인 (예: `.onrender.com`) | 모든 요청이 400 |
| `DATABASE_URL` | Postgres 연결 문자열 | 재배포마다 글이 사라집니다 |

`FRONTEND_ORIGIN`은 지정하지 않으면 Render가 주입하는 `RENDER_EXTERNAL_URL`을
씁니다. 배포 전에는 주소를 알 수 없으므로, 직접 넣고 재배포할 필요가 없습니다.
다른 호스팅을 쓴다면 배포된 자기 주소를 직접 넣으세요.

`SOMNI_API_BASE`는 설정하지 않습니다. `src/api-client.js`가 알아서 자기 출처를 씁니다.

### 정적 화면만 공유할 때

`.github/workflows/deploy-pages.yml`을 Actions 탭에서 수동 실행하면 프런트만
GitHub Pages로 나갑니다. 위에 적은 쿠키 문제 때문에 **로그인과 게시판은 동작하지
않습니다.** 화면과 디자인만 보여줄 때 쓰세요.

## 구조

```text
.
├── index.html                 # 앱 진입점
├── somni.css / integration.css # iPhone 크기 Somni UI
├── assets/                    # 수면 친구 캐릭터 에셋
├── src/
│   ├── somni.js              # 실제 앱 화면과 API 상태
│   ├── api-client.js         # Django 세션 API 클라이언트
│   ├── sleep-analysis.mjs    # 원본 수면 분석 계약
│   └── community/            # 게시판 (두 화면이 공유)
│       ├── index.mjs         # 서버 호출을 감싼 파사드
│       ├── board.mjs         # 정렬·검색 같은 표시 로직
│       ├── ui.mjs            # 공용 렌더러와 이벤트 처리
│       └── common.mjs        # 공통 유틸
├── community.css              # 게시판 전용 스타일 (밤·낮 테마)
├── planner.html               # src/app.js 수면 계획 화면 진입점
├── backend/planner/
│   ├── services.py           # 일정 기반 취침 계획
│   ├── sleep_analysis.py     # 서버 적응형 수면 분석
│   ├── models.py             # CommunityPost·Comment·PostLike 포함
│   └── views.py              # /api/v1/community/… 엔드포인트
└── tests/                     # JavaScript·Django 회귀 테스트
```

계정별 프로필·일정·수면 기록·분석 상태는 Django DB에 저장됩니다. `localStorage`는 작성 중인 아침/취침 체크인과 화면 상태만 보조적으로 유지합니다.

Google Calendar는 Django의 OAuth 토큰으로 변경분을 동기화합니다. Apple Calendar는 웹에서 직접 읽을 수 없어 iOS EventKit 브릿지가 일정을 API로 전달하도록 구성했습니다. ActivityKit·WidgetKit Live Activity와 실제 기상 알람의 백그라운드 동작은 네이티브 iOS PoC에서 연결해야 합니다.

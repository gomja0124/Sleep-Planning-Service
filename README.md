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

## 테스트

```bash
npm run test:all
```

## 구조

```text
.
├── index.html                 # 앱 진입점
├── somni.css / integration.css # iPhone 크기 Somni UI
├── assets/                    # 수면 친구 캐릭터 에셋
├── src/
│   ├── somni.js              # 실제 앱 화면과 API 상태
│   ├── api-client.js         # Django 세션 API 클라이언트
│   └── sleep-analysis.mjs    # 원본 수면 분석 계약
├── backend/planner/
│   ├── services.py           # 일정 기반 취침 계획
│   └── sleep_analysis.py     # 서버 적응형 수면 분석
└── tests/                     # JavaScript·Django 회귀 테스트
```

계정별 프로필·일정·수면 기록·분석 상태는 Django DB에 저장됩니다. `localStorage`는 작성 중인 아침/취침 체크인과 화면 상태만 보조적으로 유지합니다.

Google Calendar는 Django의 OAuth 토큰으로 변경분을 동기화합니다. Apple Calendar는 웹에서 직접 읽을 수 없어 iOS EventKit 브릿지가 일정을 API로 전달하도록 구성했습니다. ActivityKit·WidgetKit Live Activity와 실제 기상 알람의 백그라운드 동작은 네이티브 iOS PoC에서 연결해야 합니다.

# 밤가이 · Sleep Planning Service

매일 다른 대학생의 일정에 맞춰 오늘 지킬 수 있는 취침 구간을 제안하는 모바일 웹 MVP입니다.

현재 `feat/dogyeong-sleep-planner` 브랜치에는 도경 담당 범위 중 아래 흐름이 구현되어 있습니다.

- 첫 실행 `캐릭터 선택 → 내 리듬 → 메인` 온보딩과 선택값 유지
- 일어나야 할 시간·원하는 수면 길이 초기 설정
- 12시간제·24시간제 전역 시간 표시 설정
- 권장 불 끄기 구간의 5분 단위 앞/뒤 조절
- 고정 일정과 변동 일정의 입력·수정·삭제
- Apple·Google Calendar 선택 연결·동기화 상태 목업
- 통학·준비·평균 입면 시간을 반영한 취침 구간 계산
- 추천 근거 및 취침 준비·불 끄기·기상 알림 시각 표시
- 수면 Live Activity 목업 → 기상 알람 → 알람 끄기 → 기상 체크
- 아침 컨디션 피드백 저장, 다음 추천 반영, 꾸미기 포인트 지급
- 커뮤니티 게시판, 친구 모집, 공동 연속 일수, 취침팟·누적 수면 도전, 시즌 보상 화면
- 초기 2~3주/안정화 이후 업데이트 정책 안내

## 실행

별도 패키지 설치가 필요 없습니다.

```bash
npm run dev
```

브라우저에서 [http://localhost:4173](http://localhost:4173)을 엽니다.

## 테스트

```bash
npm test
```

## 구조

```text
.
├── index.html                 # 앱 진입점
├── styles.css                # 반응형 UI
├── DESIGN.md                  # 모바일 앱용 디자인 시스템·Claude Design 프롬프트
├── assets/characters.png     # 올빼미·박쥐 캐릭터 원본 에셋
├── src/
│   ├── app.js                # 화면, 일정 CRUD, 로컬 데이터 흐름
│   └── planner.mjs            # 설명 가능한 수면 계획 계산 로직
├── tests/planner.test.mjs     # 계산 로직 단위 테스트
└── docs/도경_회의전_체크리스트.md
```

데모 데이터는 브라우저 `localStorage`에만 저장됩니다. 백엔드 연동 시 `src/app.js`의 저장 함수만 API 호출로 교체할 수 있도록 계산 로직을 분리했습니다.

Apple·Google Calendar, iPhone 단축어, ActivityKit·WidgetKit Live Activity와 실제 기상 알람은 웹에서 직접 호출하지 않습니다. 현재 브랜치에서는 사용자 흐름과 상태 계약을 검증하는 목업으로 구현했으며, 네이티브 iOS PoC에서 실제 권한과 백그라운드 동작을 연결해야 합니다.

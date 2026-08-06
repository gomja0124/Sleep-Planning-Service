# 밤가이 · Sleep Planning Service

매일 다른 대학생의 일정에 맞춰 오늘 지킬 수 있는 취침 구간을 제안하는 모바일 웹 MVP입니다.

현재 `feat/dogyeong-sleep-planner` 브랜치에는 도경 담당 범위 중 아래 흐름이 구현되어 있습니다.

- 희망 기상 시각·목표 수면 시간 온보딩
- 첫 실행 시 올빼미·박쥐 수면 메이트 선택 및 선택값 유지
- 고정 일정과 변동 일정의 입력·수정·삭제
- 통학·준비·평균 입면 시간을 반영한 취침 구간 계산
- 추천 근거 및 취침 준비·불 끄기·기상 알림 시각 표시
- 아침 컨디션 피드백 저장 및 다음 추천 반영
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

# 밤가이 Django API

프론트엔드와 분리된 Django 백엔드입니다. 이메일 계정 또는 Google·Apple 소셜 로그인 세션으로 사용자 데이터를 구분합니다. 데모 자동 로그인은 기본적으로 꺼져 있으며, 필요한 경우에만 `DJANGO_ALLOW_DEMO_USER=true`로 활성화합니다.

## 실행

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python backend/manage.py migrate
.venv/bin/python backend/manage.py runserver
```

프론트엔드는 별도 터미널에서 `npm run dev`로 실행하고 `http://localhost:4173`을 엽니다. 기본 API 주소는 `http://localhost:8000`입니다.

## 테스트

```bash
npm run test:all
```

## API

| Method | Path | 용도 |
| --- | --- | --- |
| `GET`, `PATCH` | `/api/v1/me/` | 온보딩·프로필·시간 형식·알림 설정 |
| `GET` | `/api/v1/auth/status/` | 현재 로그인 상태 |
| `POST` | `/api/v1/auth/signup/`, `/login/`, `/logout/` | 이메일 계정과 세션 관리 |
| `GET`, `POST` | `/api/v1/schedules/` | 고정·변동 일정 조회/생성 |
| `PATCH`, `DELETE` | `/api/v1/schedules/{id}/` | 일정 수정/삭제 |
| `GET` | `/api/v1/plans/?start=YYYY-MM-DD&days=7` | 일정·피드백 기반 수면 계획 |
| `PUT` | `/api/v1/plans/{date}/override/` | 불 끄기 시각 조절 및 계획 저장 |
| `GET`, `POST` | `/api/v1/feedback/` | 기상 후 수면·컨디션 기록 |
| `GET`, `POST` | `/api/v1/sleep-sessions/` | 수면 시작/Live Activity 상태 |
| `PATCH` | `/api/v1/sleep-sessions/{id}/` | 알람·기상 체크 상태 전환 |
| `PUT` | `/api/v1/calendars/apple/`, `/google/` | 캘린더 연결 상태 |
| `POST` | `/api/v1/calendars/sync/` | 연결된 Google 캘린더 동기화 및 Apple 기기 동기화 필요 여부 확인 |
| `POST` | `/api/v1/calendars/google/sync/` | Google Calendar API에서 선택 캘린더 일정 동기화 |
| `PUT` | `/api/v1/calendars/apple/events/` | iOS EventKit이 전달한 Apple Calendar 일정 반영 |
| `GET` | `/api/v1/challenges/` | 도전 현황 |
| `POST`, `DELETE` | `/api/v1/challenges/{id}/join/` | 도전 참여/취소 |
| `GET`, `POST` | `/api/v1/community/posts/` | 커뮤니티 게시글 |

`GET /api/v1/plans/` 응답에는 권장 취침 구간, 취침 준비·불 끄기·기상 알림, 추천 근거, 피드백 반영분과 수동 조절값이 함께 포함됩니다.

Google 연동에는 OAuth 동의 화면에서 `calendar.readonly` 권한과 오프라인 접근 토큰이 필요합니다. Apple Calendar는 웹 서버가 iCloud에 직접 접근하지 않고, iOS 앱의 EventKit이 읽은 이벤트를 `/api/v1/calendars/apple/events/`로 전달하는 구조입니다. 종일 일정은 정확한 시작 시각이 없어 수면 계획 입력에서 제외됩니다.

캘린더별로 `manual` 또는 `auto` 동기화 방식을 저장합니다. 자동 모드는 앱 실행, 포그라운드 복귀, 앱이 열려 있는 동안 5분 주기로 변경 일정을 확인합니다. iOS EventKit 연결 규약과 수명주기 처리는 [IOS_CALENDAR_BRIDGE.md](./IOS_CALENDAR_BRIDGE.md)를 참고하세요.

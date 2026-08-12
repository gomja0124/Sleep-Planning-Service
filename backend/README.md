# 밤가이 Django API

프론트엔드와 분리된 Django 백엔드입니다. MVP에서는 `X-User-Id` 헤더로 사용자 데이터를 구분하며, 헤더가 없으면 `demo-user`를 사용합니다. 실제 배포 전에는 이 식별을 인증된 사용자 ID로 교체해야 합니다.

## 실행

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python backend/manage.py migrate
.venv/bin/python backend/manage.py runserver
```

## API

| Method | Path | 용도 |
| --- | --- | --- |
| `GET`, `PATCH` | `/api/v1/me/` | 온보딩·프로필·시간 형식·알림 설정 |
| `GET`, `POST` | `/api/v1/schedules/` | 고정·변동 일정 조회/생성 |
| `PATCH`, `DELETE` | `/api/v1/schedules/{id}/` | 일정 수정/삭제 |
| `GET` | `/api/v1/plans/?start=YYYY-MM-DD&days=7` | 일정·피드백 기반 수면 계획 |
| `PUT` | `/api/v1/plans/{date}/override/` | 불 끄기 시각 조절 및 계획 저장 |
| `GET`, `POST` | `/api/v1/feedback/` | 기상 후 수면·컨디션 기록 |
| `GET`, `POST` | `/api/v1/sleep-sessions/` | 수면 시작/Live Activity 상태 |
| `PATCH` | `/api/v1/sleep-sessions/{id}/` | 알람·기상 체크 상태 전환 |
| `PUT` | `/api/v1/calendars/apple/`, `/google/` | 캘린더 연결 상태 |
| `POST` | `/api/v1/calendars/sync/` | 연결 캘린더 동기화 후 재계산 신호 |
| `GET` | `/api/v1/challenges/` | 도전 현황 |
| `POST`, `DELETE` | `/api/v1/challenges/{id}/join/` | 도전 참여/취소 |
| `GET`, `POST` | `/api/v1/community/posts/` | 커뮤니티 게시글 |

`GET /api/v1/plans/` 응답에는 권장 취침 구간, 취침 준비·불 끄기·기상 알림, 추천 근거, 피드백 반영분과 수동 조절값이 함께 포함됩니다.

---
version: alpha
name: Bamgai-calm-mobile-sleep-companion
description: |
  A mobile-first sleep planning system for university students whose schedules change every day. The experience should feel like a quiet room just before sleep: deep dusk navy, soft moonlit surfaces, restrained periwinkle, and one warm lime accent reserved for the next action. The product must never feel clinical, competitive, or alarmist. It should make the user feel gently guided by a chosen character companion — Lumi the owl or Bami the bat — while turning fixed classes, one-off plans, commute time, sleep feedback, and wake goals into an explainable bedtime window. Design for a native-feeling 390×844 mobile viewport first, with safe areas, one-thumb operation, calm motion, large touch targets, and Korean copy.

colors:
  primary: "#7890E8"
  on-primary: "#F9FAFF"
  primary-deep: "#596FC6"
  canvas: "#F5F3ED"
  canvas-night: "#101726"
  surface: "#FFFDFC"
  surface-night: "#182235"
  surface-lavender: "#EFEDFB"
  surface-blue: "#EAF3FA"
  surface-mint: "#E8F5F0"
  ink: "#18202D"
  ink-soft: "#626B78"
  ink-muted: "#8F96A1"
  on-night: "#F7F8FC"
  on-night-muted: "#AEB7C8"
  hairline: "#E5E2DA"
  hairline-night: "#2B374B"
  moon-lime: "#D9FF78"
  moon-lime-deep: "#BDD959"
  owl-blue: "#41BCEB"
  bat-purple: "#8A67C7"
  success: "#3D8D79"
  warning: "#B88645"
  danger: "#C76666"

typography:
  display-time:
    fontFamily: SF Pro Rounded
    fontSize: 52px
    fontWeight: 700
    lineHeight: 1.0
    letterSpacing: -1.5px
  heading-xl:
    fontFamily: Pretendard
    fontSize: 30px
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: -0.6px
  heading-lg:
    fontFamily: Pretendard
    fontSize: 22px
    fontWeight: 700
    lineHeight: 1.35
    letterSpacing: -0.35px
  heading-md:
    fontFamily: Pretendard
    fontSize: 17px
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: -0.2px
  body-md:
    fontFamily: Pretendard
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: -0.1px
  body-strong:
    fontFamily: Pretendard
    fontSize: 15px
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: -0.1px
  button-md:
    fontFamily: Pretendard
    fontSize: 15px
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: -0.1px
  caption-md:
    fontFamily: Pretendard
    fontSize: 13px
    fontWeight: 500
    lineHeight: 1.5
    letterSpacing: 0
  caption-sm:
    fontFamily: Pretendard
    fontSize: 11px
    fontWeight: 600
    lineHeight: 1.45
    letterSpacing: 0.2px
  utility-xs:
    fontFamily: Pretendard
    fontSize: 10px
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: 0.8px
    textTransform: uppercase

rounded:
  none: 0px
  xs: 10px
  sm: 14px
  md: 20px
  lg: 28px
  full: 9999px

spacing:
  xxs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 20px
  xl: 24px
  xxl: 32px
  section: 40px

components:
  button-primary:
    backgroundColor: "{colors.moon-lime}"
    textColor: "{colors.ink}"
    typography: "{typography.button-md}"
    rounded: "{rounded.sm}"
    padding: 16px 20px
    height: 52px
  button-primary-pressed:
    backgroundColor: "{colors.moon-lime-deep}"
    textColor: "{colors.ink}"
    typography: "{typography.button-md}"
    rounded: "{rounded.sm}"
  button-secondary:
    backgroundColor: "{colors.surface-lavender}"
    textColor: "{colors.primary-deep}"
    typography: "{typography.button-md}"
    rounded: "{rounded.sm}"
    padding: 14px 18px
    height: 48px
  button-quiet:
    backgroundColor: transparent
    textColor: "{colors.ink-soft}"
    typography: "{typography.caption-md}"
    rounded: "{rounded.sm}"
    height: 44px
  button-icon-circular:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.full}"
    size: 44px
  card-plan-night:
    backgroundColor: "{colors.canvas-night}"
    textColor: "{colors.on-night}"
    rounded: "{rounded.lg}"
    padding: 24px
  card-surface:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: 20px
  character-choice:
    backgroundColor: "{colors.surface-night}"
    textColor: "{colors.on-night}"
    rounded: "{rounded.md}"
    padding: 0px
  character-choice-selected:
    backgroundColor: "{colors.surface-night}"
    textColor: "{colors.on-night}"
    borderColor: "{colors.moon-lime}"
    borderWidth: 2px
    rounded: "{rounded.md}"
  input-default:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    borderColor: "{colors.hairline}"
    borderWidth: 1px
    rounded: "{rounded.sm}"
    height: 52px
    padding: 0px 16px
  input-focused:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    borderColor: "{colors.primary}"
    borderWidth: 2px
    rounded: "{rounded.sm}"
  segmented-control:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.sm}"
    padding: 4px
    height: 48px
  segmented-control-active:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xs}"
  status-chip:
    backgroundColor: "{colors.surface-lavender}"
    textColor: "{colors.primary-deep}"
    typography: "{typography.caption-sm}"
    rounded: "{rounded.full}"
    padding: 7px 11px
  timeline-marker:
    backgroundColor: "{colors.surface-lavender}"
    textColor: "{colors.primary-deep}"
    rounded: "{rounded.sm}"
    size: 40px
  schedule-row:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: 14px
  feedback-scale:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.sm}"
    size: 52px
  feedback-scale-selected:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.sm}"
    size: 52px
  bottom-navigation:
    backgroundColor: "{colors.canvas-night}"
    textColor: "{colors.on-night-muted}"
    rounded: "{rounded.md}"
    height: 68px
  bottom-navigation-active:
    backgroundColor: "{colors.moon-lime}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
  bottom-sheet:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: 24px
---

## Overview

Claude Design에게 요청합니다. 이 문서를 단일 디자인 기준으로 사용해 **밤가이** 모바일 앱을 설계하세요. 결과물은 웹 대시보드가 아니라 iOS와 Android에서 실제 구현 가능한 네이티브 앱 화면이어야 합니다. 기준 아트보드는 iPhone 15 크기에 가까운 `390×844px`이며, 상단 상태바와 하단 홈 인디케이터 safe area를 반드시 확보합니다.

밤가이는 대학생의 고정 일정, 변동 일정, 통학·준비 시간, 희망 기상 시각, 최근 수면 피드백을 분석해 `오늘 지킬 수 있는 취침 구간`을 제안합니다. 서비스의 중심 감정은 성취 경쟁이 아니라 안도감, 자기 통제감, 부드러운 복귀입니다. 사용자가 계획을 지키지 못했을 때 실패·경고·연속 기록 초기화를 강조하지 말고 “오늘 다시 맞추기”를 제안합니다.

첫 실행에서 사용자는 `assets/characters.png`의 두 캐릭터 중 하나를 선택합니다. 왼쪽 캐릭터는 **올빼미 루미**, 오른쪽 캐릭터는 **박쥐 바미**로 사용합니다. 캐릭터는 장식이 아니라 수면 계획을 설명하고 피드백을 전달하는 정서적 안내자입니다. 원본 이미지의 어두운 배경과 푸른색·보라색 발광을 유지하고, 앱 전체 색을 캐릭터 색으로 과도하게 바꾸지 않습니다.

**필수 화면과 연결 흐름:**
1. 캐릭터 선택 — 루미/바미 중 하나를 고르고 시작
2. 기본 목표 온보딩 — 희망 기상 시각, 목표 수면 시간, 평균 입면 시간, 취침 준비 시간
3. 일정 — 에브리타임처럼 고정 일정을 요일별로 추가하고, 시험·약속·회의는 날짜별 변동 일정으로 추가
4. 오늘 — 다음 날 첫 일정, 권장 불 끄기 30분 구간, 취침 준비/불 끄기/기상 알림, 추천 근거
5. 기상 체크 — 실제 취침·기상, 개운함 1~5, 낮 졸림 1~5, 실패 이유
6. 내 리듬 — 7일 계획, 적응 주차, 업데이트 정책, 캐릭터 변경

**Key Characteristics:**
- 깊은 밤색 `{colors.canvas-night}` 위에 달빛 같은 `{colors.moon-lime}`을 단 하나의 주요 행동에만 사용
- 넓은 여백, 낮은 정보 밀도, 20–28px의 둥근 카드, 부드러운 1px 경계
- 취침 시각은 한 시각이 아니라 30분 범위이며 `{typography.display-time}`으로 가장 크게 표시
- 캐릭터는 홈의 오른쪽 또는 하단 1/3에 배치하되 시간 정보보다 시각적 우선순위가 높아지지 않게 함
- 추천마다 “왜 이 시간인지”를 2–3개의 짧은 근거로 표시
- 44px 이상의 터치 영역, 한 손 조작, 하단 4탭 탐색
- 의료 진단, 치료, 최적이라는 단정적 표현 금지

## Colors

### Brand & Accent
- **Dusk Periwinkle** (`{colors.primary}` — `#7890E8`): 선택, 포커스, 현재 단계, 그래프의 기준선에 사용합니다. 한 화면의 15%를 넘기지 않습니다.
- **Moon Lime** (`{colors.moon-lime}` — `#D9FF78`): 다음으로 해야 할 행동과 권장 시간에만 사용합니다. 캐릭터 선택 확정, 오늘 계획 저장, 추천 취침 구간이 대표 사용처입니다.
- **Owl Blue / Bat Purple** (`{colors.owl-blue}`, `{colors.bat-purple}`): 각 캐릭터의 선택 링, 작은 상태 점, 캐릭터 전용 축하 순간에만 사용합니다.

### Surface
- **Warm Canvas** (`{colors.canvas}`): 낮 화면의 전체 배경입니다. 순백색보다 눈부심이 적은 따뜻한 회백색을 사용합니다.
- **Night Canvas** (`{colors.canvas-night}`): 캐릭터 선택과 오늘의 수면 계획 카드에 사용합니다. 앱 전체를 상시 다크 모드로 만들지는 않습니다.
- **Surface** (`{colors.surface}`): 입력, 일정, 피드백, 리포트 카드의 기본 표면입니다.
- **Soft Lavender / Blue / Mint**: 추천 근거, 기상 알림, 긍정 피드백을 구분하는 저채도 보조 표면입니다.
- 그림자는 `0 12px 36px rgba(16, 23, 38, 0.06)` 한 단계만 사용합니다. 어두운 카드에는 그림자를 사용하지 않습니다.

### Text
- **Ink** (`{colors.ink}`): 제목과 핵심 숫자.
- **Ink Soft** (`{colors.ink-soft}`): 본문과 입력 설명.
- **Ink Muted** (`{colors.ink-muted}`): 메타데이터, 비활성 탭, 보조 시간.
- **On Night / On Night Muted**: 밤 카드 위의 1차·2차 텍스트. 긴 본문은 밤 카드 위에 올리지 않습니다.

### Semantic
- **Success**는 피드백 저장, 계획 달성에만 사용합니다.
- **Warning**은 수면 부족 가능성을 차분하게 알릴 때 사용하며 아이콘과 설명을 함께 둡니다.
- **Danger**는 일정 삭제나 기록 삭제 확인에만 사용합니다. 수면 점수나 계획 실패에는 빨간색을 쓰지 않습니다.
- 색만으로 상태를 전달하지 말고 체크, 달, 알람 등의 아이콘과 텍스트를 함께 사용합니다.

## Typography

### Font Family
- 한국어 기본은 **Pretendard**를 사용합니다. iOS에서는 Apple SD Gothic Neo, Android에서는 Noto Sans KR로 자연스럽게 대체할 수 있습니다.
- 시간 숫자는 **SF Pro Rounded** 또는 플랫폼의 rounded system font를 사용해 차갑고 분석적인 인상을 줄입니다.
- 영문 섹션 라벨은 `{typography.utility-xs}`로 작게 쓰되 핵심 정보로 사용하지 않습니다.

### Hierarchy

| Token | Size | Weight | Use |
|---|---:|---:|---|
| `{typography.display-time}` | 52px | 700 | 권장 불 끄기 범위, 주요 기상 시각 |
| `{typography.heading-xl}` | 30px | 700 | 온보딩과 화면의 핵심 문장 |
| `{typography.heading-lg}` | 22px | 700 | 주요 카드 제목, 캐릭터 이름 |
| `{typography.heading-md}` | 17px | 700 | 섹션 및 입력 그룹 제목 |
| `{typography.body-md}` | 15px | 400 | 설명과 추천 근거 |
| `{typography.body-strong}` | 15px | 600 | 일정명, 버튼 보조 레이블 |
| `{typography.caption-md}` | 13px | 500 | 시간 메타데이터와 카드 설명 |
| `{typography.caption-sm}` | 11px | 600 | 칩, 상태, 보조 라벨 |

### Principles
한 화면에서 크게 읽혀야 하는 것은 하나뿐입니다. 오늘 화면에서는 취침 구간, 일정 화면에서는 다음 일정, 기상 체크에서는 질문이 가장 커야 합니다. 큰 숫자와 작은 설명의 대비를 사용하되 전체 문장을 대문자로 쓰거나 자간을 과도하게 좁히지 않습니다.

### Note on Font Substitutes
Pretendard가 없다면 iOS는 `SF Pro Text + Apple SD Gothic Neo`, Android는 `Roboto + Noto Sans KR`를 사용합니다. 시간 숫자는 반드시 tabular numerals를 적용해 값이 바뀔 때 폭이 흔들리지 않게 합니다.

## Layout

### Spacing System
- 4px 기반으로 구성하되 실제 컴포넌트 간격은 8, 12, 16, 20, 24, 32, 40px을 우선합니다.
- 모바일 좌우 기본 여백은 20px, 큰 카드 내부는 24px, 작은 행 내부는 14–16px입니다.
- 주요 섹션 사이는 `{spacing.section}` 40px, 관련 카드 사이는 12–16px입니다.

### Grid & Container
- 기준 아트보드 `390×844px`, 최소 지원 폭 `320px`, 태블릿 확장 기준 `768px`입니다.
- 화면은 기본 1열입니다. 캐릭터 선택만 2열을 유지해 두 친구를 같은 조건에서 비교하게 합니다.
- 하단 탐색은 `오늘 / 일정 / 기상 체크 / 내 리듬` 4개 고정 탭입니다.
- 입력 CTA는 화면 하단 safe area 위에 sticky로 둘 수 있지만 키보드가 열리면 콘텐츠를 가리지 않아야 합니다.

### Whitespace Philosophy
여백은 사용자가 잠들기 전 빠르게 읽고 앱을 닫게 만드는 장치입니다. 빈 공간을 장식으로 채우지 말고, 한 카드에는 한 질문 또는 한 결정만 둡니다. 홈 첫 화면에는 수면 계획, 추천 근거 한 줄, 저장 CTA까지만 보여야 합니다.

## Elevation & Depth

| Level | Treatment | Use |
|---|---|---|
| 0 — Flat | 그림자 없음 | 배경, 타임라인, 설정 행 |
| 1 — Hairline | 1px `{colors.hairline}` | 입력, 일정 행, 구분선 |
| 2 — Calm card | `0 12px 36px rgba(16,23,38,.06)` | 홈 보조 카드, 피드백 카드 |
| 3 — Modal | 어두운 35% scrim + bottom sheet | 일정 추가, 삭제 확인, 알림 권한 설명 |

밤 카드의 깊이는 그림자가 아니라 `{colors.canvas-night}`와 캐릭터 이미지의 은은한 빛으로 만듭니다. 유리 질감과 강한 블러는 사용하지 않습니다.

### Decorative Depth
- 별은 1px 이하 점으로 캐릭터 선택 화면 상단에만 드물게 배치합니다.
- 달 궤도선은 홈 캐릭터 뒤에 1px, 12% 불투명도로 최대 2개만 사용합니다.
- 캐릭터 원본 이미지의 glow는 유지하되 추가 네온 효과를 만들지 않습니다.

## Shapes

### Border Radius Scale

| Token | Value | Use |
|---|---:|---|
| `{rounded.xs}` | 10px | 작은 시간 칩, 요일 선택 |
| `{rounded.sm}` | 14px | 버튼, 입력, 일정 행 |
| `{rounded.md}` | 20px | 일반 카드, 캐릭터 선택 카드 |
| `{rounded.lg}` | 28px | 오늘의 계획 카드, bottom sheet |
| `{rounded.full}` | 9999px | 상태 점, 프로필, 토글 |

### Photography Geometry
- `assets/characters.png`은 좌우 50%씩 분리해 표시합니다. 원본 비율을 늘이거나 얼굴을 자르지 않습니다.
- 캐릭터 선택에서는 각 캐릭터의 전신이 보이게 하고, 홈에서는 가슴 위 중심 크롭도 허용합니다.
- 캐릭터 위에 긴 텍스트나 버튼을 겹치지 않습니다.

## Components

### Buttons

**`button-primary`** — 한 화면에 하나만 사용합니다. `{colors.moon-lime}` 배경, 52px 높이, 문장은 “루미와 시작하기”, “오늘 계획 저장하기”처럼 결과가 분명해야 합니다.

**`button-secondary`** — 일정 추가, 추천 다시 계산처럼 중요하지만 즉시 실행하지 않아도 되는 행동입니다.

**`button-quiet`** — 근거 접기, 다음에 하기, 취소 등에 사용합니다. 텍스트만 있어도 터치 영역은 44px 이상입니다.

**`button-icon-circular`** — 뒤로가기, 편집, 삭제. 아이콘만 쓸 때 접근성 레이블을 필수로 지정합니다.

### Inputs & Forms

**`input-default` / `input-focused`**
- 레이블은 항상 입력 위에 유지합니다. placeholder만으로 의미를 전달하지 않습니다.
- 시간 입력은 플랫폼 기본 time picker를 사용하고, 수면 시간은 30분 단위 stepper 또는 wheel picker를 사용합니다.
- 오류는 입력 아래 한 문장으로 설명하고 레이아웃을 흔드는 toast만 사용하지 않습니다.

**`segmented-control`**
- 일정 추가에서 `고정 일정 / 변동 일정`을 구분합니다.
- 고정 일정은 요일 선택, 변동 일정은 날짜 선택을 보여줍니다. 두 입력을 한 화면에 동시에 보여주지 않습니다.

### Cards & Containers

**`card-plan-night`**
- 오늘 홈의 최상단 카드입니다.
- 순서: 대상 날짜 → “권장 불 끄기 구간” → 큰 시간 범위 → 기상/수면시간 → CTA → 캐릭터.
- 추천 근거는 기본 1줄만 보이고 “왜 이 시간인가요?”를 누르면 2–3줄로 확장합니다.

**`character-choice` / `character-choice-selected`**
- 루미와 바미를 같은 크기로 나란히 표시합니다.
- 선택 시 2px Moon Lime 테두리와 우상단 체크만 추가합니다. 캐릭터 크기를 키워 선택을 표현하지 않습니다.
- 선택 전 CTA는 비활성화하고, 선택 후 “루미와 시작하기”처럼 이름을 포함합니다.

**`schedule-row`**
- 시작 시각, 일정명, 반복/날짜, 준비·통학 시간, 편집을 표시합니다.
- 고정 일정과 변동 일정은 별도 섹션과 작은 상태 칩으로 구분합니다.

**`feedback-scale` / `feedback-scale-selected`**
- 1–5 점수를 가로 한 줄로 표시합니다. 숫자 아래에 양 끝 의미를 짧게 붙입니다.
- 선택된 값만 `{colors.primary}`로 채우고 나머지는 흰색 표면을 유지합니다.

### Navigation

**`bottom-navigation`**
- 오늘, 일정, 기상 체크, 내 리듬 4탭입니다.
- 아이콘 22px + 라벨 10–11px. 선택 탭은 `{colors.moon-lime}` 캡슐 배경 또는 아이콘/텍스트 색 반전 중 하나만 사용합니다.
- 키보드가 열리면 숨기고, scroll-to-top은 현재 탭을 다시 누를 때만 실행합니다.

**Top App Bar**
- 화면 제목, 날짜 또는 뒤로가기만 둡니다. 로고와 프로필, 여러 액션을 한 줄에 모두 넣지 않습니다.
- 야간 사용을 고려해 높이 52–56px, 아이콘 터치 영역 44px을 유지합니다.

### Signature Components

**Bedtime Window**
- `23:20 — 23:50`처럼 범위 기호 앞뒤에 충분한 간격을 둡니다.
- 아래에 “07:30 기상 · 7시간 30분 목표”를 배치합니다.
- 일정 변경 또는 피드백으로 바뀌었으면 “회의가 1시간 당겨져 35분 빨라졌어요”처럼 변화 이유를 작은 칩으로 제공합니다.

**Sleep Timeline**
- 취침 준비 → 불 끄기 → 기상 3단계 세로 타임라인입니다.
- 각 단계는 시각, 알림 켜짐 상태, 아이콘을 포함합니다. 연결선은 hairline 한 줄만 사용합니다.

**Character Message**
- 한 문장, 최대 36자. “오늘도 꼭 성공해!”가 아니라 “어제보다 15분만 일찍 준비해 볼까요?”처럼 부담이 적은 문장을 사용합니다.

**Permission Bottom Sheet**
- OS 알림 권한을 요청하기 전에 취침 준비·불 끄기·기상 알림이 왜 필요한지 먼저 설명합니다.
- “알림 켜기”와 “나중에”를 제공하고, 거부한 뒤 반복 팝업을 띄우지 않습니다.

## Do's and Don'ts

### Do
- 한 화면의 가장 중요한 다음 행동 하나만 `{component.button-primary}`로 표현합니다.
- 수면 계획이 바뀌면 결과와 함께 근거를 같은 화면에서 제공합니다.
- 캐릭터를 선택한 사용자의 이름과 캐릭터 이름을 자연스럽게 사용합니다.
- 고정 일정과 변동 일정의 입력·목록·칩을 시각적으로 명확히 구분합니다.
- 실제 취침 실패를 기록해도 격려와 작은 조정안을 보여줍니다.
- 모든 터치 영역을 최소 44×44px, 본문 대비를 WCAG AA 이상으로 유지합니다.
- 다크 화면은 캐릭터 선택과 오늘의 계획처럼 취침 맥락이 강한 순간에 집중합니다.

### Don't
- 의료 진단, 수면장애 예측, 치료 효과를 암시하지 않습니다.
- 빨간 경고, 불꽃, 연속 기록 소멸, 경쟁 랭킹으로 행동을 압박하지 않습니다.
- 보라색과 파란색 glow를 모든 카드에 반복하지 않습니다.
- 한 화면에 그래프, 점수, 일정, 캐릭터, 긴 설명을 동시에 넣지 않습니다.
- 취침 직전 화면에 자동재생 애니메이션, 채팅 피드, 탐색형 콘텐츠를 넣지 않습니다.
- 캐릭터를 배경 장식처럼 반투명하게 반복 배치하지 않습니다.
- 데스크톱 사이드바를 축소한 형태로 모바일 화면을 만들지 않습니다.

## Responsive Behavior

### Breakpoints

| Name | Width | Key Changes |
|---|---:|---|
| compact-mobile | 320–359px | 좌우 여백 16px, 시간 44px, 캐릭터 선택 카드 설명 2줄 제한 |
| mobile | 360–430px | 기본 390px 레이아웃, 1열 카드, 하단 4탭 |
| mobile-large | 431–599px | 콘텐츠 max-width 430px 유지, 바깥 여백 확대 |
| tablet | 600–1023px | 콘텐츠 max-width 720px, 홈 보조 카드만 2열 허용 |
| tablet-large | 1024px+ | 모바일 정보 구조 유지, 중앙 정렬된 768px 앱 캔버스 사용 |

### Touch Targets
버튼과 입력은 최소 48px 높이, 아이콘 버튼은 시각 크기 24px이더라도 hit area 44px을 확보합니다. 1–5 피드백 선택지는 52px 이상이며 인접 hit area가 겹치지 않습니다.

### Collapsing Strategy
- 캐릭터 선택 2열은 320px까지 유지하되 설명을 줄입니다.
- 주간 계획은 표 대신 날짜별 가로 스크롤 카드 또는 세로 리스트로 전환합니다.
- 일정 추가는 full-screen push 화면 또는 bottom sheet 하나를 사용합니다.
- 추천 근거는 모바일에서 accordion으로 기본 접힘 상태를 허용합니다.

### Image Behavior
- 캐릭터 원본의 좌우 절반을 각각 독립 이미지처럼 사용합니다.
- `aspect-fit`을 기본으로 하고, 홈의 작은 프로필 썸네일에서만 정사각 크롭을 허용합니다.
- 2x/3x 모바일 에셋을 준비할 때 색공간은 sRGB, PNG 또는 lossless WebP를 사용합니다.

## Iteration Guide

1. 먼저 390×844 캐릭터 선택 화면과 오늘 홈 화면을 완성해 감정 톤을 고정합니다.
2. `assets/characters.png`을 연결하고 루미/바미 선택 상태와 홈 캐릭터가 일치하는지 확인합니다.
3. `{components.card-plan-night}` 안에서 취침 범위가 첫 3초 안에 읽히는지 테스트합니다.
4. 일정 추가에서 고정/변동 전환 후 불필요한 필드가 사라지는지 확인합니다.
5. 기상 체크 1–5 선택을 한 손으로 완료할 수 있는지 테스트합니다.
6. Dynamic Type 120%, 200%에서 버튼과 시간 범위가 잘리지 않는지 확인합니다.
7. 어두운 방 기준으로 화면 밝기와 대비를 검토하고 순백색 면적을 줄입니다.
8. 모든 추천 화면에 계산 근거와 재계산 트리거가 있는지 확인합니다.
9. 성공/실패 양쪽 상태에서 문구가 사용자를 압박하지 않는지 검토합니다.

## Known Gaps

- 올빼미·박쥐 원본이 하나의 가로 이미지에 들어 있으므로 개발 시 좌우 크롭 또는 별도 에셋 분리가 필요합니다.
- 실제 캐릭터 수면·기상 표정과 메달 이미지는 아직 없습니다. 정적 기본 표정으로 구현하고 임의 생성하지 않습니다.
- OS 알림 권한, 백그라운드 알림, Asleep API 연동 화면은 실제 플랫폼 제약 확인이 필요합니다.
- 다크 모드 전체 테마는 정의하지 않았습니다. 현재는 야간 핵심 화면만 dark surface를 사용합니다.
- 의료적 위험 신호 안내와 개인정보·수면 데이터 삭제 플로우는 별도 정책 검토가 필요합니다.

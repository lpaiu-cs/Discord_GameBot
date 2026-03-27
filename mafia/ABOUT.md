# Mafia Module

이 디렉토리는 `Discord Game Bot` 안에서 웹 대시보드 기반 `마피아42 시즌4 일반·클래식`을 담당하는 모듈이다. 저장소 루트 `package.json`은 이 모듈의 실행, 빌드, 테스트를 위임한다.

## 현재 스코프

- 4~8인
- 일반/클래식
- `시즌4 밸런스`
- `간호사` 제외
- `예언자`, `판사`, `교주팀` 제외
- 듀얼 고유능력 제외
- 룰방 로컬 규칙 제외

`2017-03-10` 간호사 추가 이후 요소는 미구현 누락이 아니라 의도적 범위 제외다.

## 모듈 구조

- `src`: Discord 봇, 게임 엔진, 웹 서버
- `resource`: 역할 이미지와 정적 리소스
- `tests`: 자동 테스트
- `scripts`: 빌드 스크립트와 보조 도구
- `docs`: 규칙, 설계, 스모크 테스트 문서

## Source Of Truth

- 규칙의 단일 기준 문서는 `docs/RULE.md`다.
- 엔진 구현, 웹 UI, 테스트, 운영 문서는 `docs/RULE.md`와 같은 semantics를 유지해야 한다.

## 시간 규칙 요약

- 밤: `25초`
- 토론 시간: `생존자 수 × 15초`
- 각 생존자는 하루 한 번 `±10초` 시간 조절 가능
- 투표 / 최후의 반론: `15초`

## 아키텍처 요약

- Discord 책임
  - 로비 생성
  - 참가 버튼
  - 게임 시작 안내
  - 개인 입장 URL ephemeral 발급
  - `/mafia create`
  - `/mafia dashboard`
  - 공개 상태/결과 미러링
  - 게임 종료 요약 안내
- Web 책임
  - 공개 게임 상태
  - 공개 채팅
  - 마피아/연인/망자 채팅
  - 개인 행동 UI
  - 세션/재입장 처리

기존 DM 기반 진행은 기본 경로에서 제거됐다. Discord는 로비와 링크 발급만 담당하고, 실제 조작과 비밀 정보 처리는 웹 대시보드가 맡는다.

## 운영 전제

- 현재 게임 진행 상태는 `in-memory` 로 처리한다.
- 따라서 프로세스 재시작이나 크래시가 나면 진행 중인 판은 종료된다.
- 대신 비즈니스 데이터는 별도 DB로 분리한다.
  - 플레이어 전적
  - 승패/판수
  - 역할별 통계
  - 길드별 매치 기록

## 웹 입장 흐름

1. Discord 로비에서 `참가` 버튼 사용
2. 봇이 ephemeral 메시지로 개인 입장 링크를 발급
3. 링크는 `1회용 join ticket` 을 포함한 `/auth/exchange?ticket=...` 형태
4. 서버가 ticket 검증 후 세션 쿠키를 발급하고 `/game/:gameId` 로 이동
5. 이후 웹 대시보드는 WebSocket 우선, 실패 시 version 기반 short polling fallback 으로 상태를 갱신

ephemeral 메시지가 사라져도 `/mafia dashboard` 로 새 링크를 다시 받을 수 있다.

현재 유지하는 마피아 slash command 는 `/mafia create`, `/mafia dashboard` 두 개뿐이다. 참가/나가기/시작은 모두 로비 버튼으로 처리한다.

## URL Provider

- 기본: `fixed_base_url`
  - `PUBLIC_BASE_URL` 사용
  - `WEB_MODE=fixed`
  - `QUICK_TUNNEL_ENABLED=false`
- 실험용: `quick_tunnel`
  - `WEB_MODE=quick_tunnel`
  - `QUICK_TUNNEL_ENABLED=true`
  - Cloudflare Quick Tunnel 제약 때문에 기본 운영 경로로 두지 않는다.

실시간 전송은 WebSocket을 먼저 시도하며, 불가할 경우 자동으로 version 기반 short polling으로 fallback 한다. `cloudflared` 가 PATH 에 바로 안 잡히는 경우 `CLOUDFLARED_PATH` 로 실행 파일 경로를 직접 지정할 수 있다.

## 환경 변수

- `DISCORD_BOT_TOKEN`
- `DISCORD_APPLICATION_ID`
- `DISCORD_GUILD_ID`
- `DISCORD_RULESET=balance`
- `PUBLIC_BASE_URL`
- `WEB_SESSION_SECRET`
- `JOIN_TICKET_SECRET`
- `WEB_MODE=fixed|quick_tunnel`
- `QUICK_TUNNEL_ENABLED=true|false`
- `CLOUDFLARED_PATH`
- `WEB_PORT`
- `JOIN_TICKET_TTL_SECONDS`
- `TRIAL_VOTE_SECONDS`
- `AUTO_DELETE_SECRET_CHANNELS`
- `DATABASE_URL`
- `DATABASE_SSL`

## 시작 방법

아래 명령은 저장소 루트에서 실행한다.

```bash
npm install
npm run db:migrate
npm run dev:mafia
```

- `npm run dev` 는 `npm run dev:mafia` 의 alias 다.
- 프로덕션 빌드와 회귀 테스트도 저장소 루트에서 실행한다.

```bash
npm test
npm run build
```

## 개발자용 1인 웹 프리뷰

Discord 없이 웹 대시보드 UI 를 빠르게 확인하려면 아래 스크립트를 사용한다.

```bash
npm run dev:mafia:preview
```

기본값은 `night` / `mafia` / `balance` / `http://localhost:3010` 이다.

PowerShell 예시:

```powershell
$env:PREVIEW_PHASE='vote'
$env:PREVIEW_ROLE='reporter'
$env:PREVIEW_RULESET='balance'
$env:DEV_PREVIEW_PORT='3010'
npm run dev:mafia:preview
```

지원 phase:

- `night`
- `discussion`
- `vote`
- `defense`
- `trial`

지원 role:

- 현재 구현 범위의 모든 직업 + `citizen`

이 프리뷰는 실제 Discord 로비 흐름을 대체하지 않고, UI 와 세션/입장 흐름을 로컬에서 빠르게 점검하는 용도다.

## 개발자용 연습 시뮬레이션

자동 진행되는 연습 시나리오를 띄우려면:

```bash
npm run dev:mafia:practice
```

기본값은 `practice1` 이고 `http://localhost:3014` 에서 동작한다. 시나리오별 스크립트:

- `practice1`: 내가 `마피아`로 시작하고 밤 마피아 채팅과 낮 공개 채팅을 본다
- `practice2`: 내가 `정치인`으로 시작하고 보면 안 되는 비밀 채팅이 숨겨지는지 본다
- `practice3`: 내가 `영매`로 시작하고 밤 망자 채팅이 보이는지 본다
- `practice4`: 내가 이미 죽은 상태로 시작하고 망자 채팅 read/write 를 본다

```bash
npm run dev:mafia:practice1
npm run dev:mafia:practice2
npm run dev:mafia:practice3
npm run dev:mafia:practice4
```

모든 연습 시나리오는 대략 `두 번의 낮`까지 자동화된 NPC 흐름으로 진행된다. 이 시나리오는 엔진 전체의 승패나 분기를 계산하는 실제 회귀 테스트를 대체하지 않는다. 자동 진행 중 사용자가 직접 개입할 수는 있지만, NPC는 그 개입에 반응해 분기하지 않는다.

주 목적은 비밀 채팅 접근 권한 판정, 투표/재판 행동 가시성, 죽은 상태의 UI 반영, 역할에 따른 카드 및 채팅 권한 갱신 검증 등 클라이언트 UI 와 서버 검증 로직 간 정합성을 빠르게 점검하는 데 있다. 예전처럼 4개를 한 번에 띄우려면 `npm run dev:mafia:practice:all` 을 사용한다.

PowerShell 예시:

```powershell
$env:DEV_PRACTICE_PORT='3015'
$env:PRACTICE_RULESET='balance'
npm run dev:mafia:practice3
```

`dev:mafia:practice:all` 은 게임별 세션 쿠키를 따로 쓰므로 `practice1~4` 를 같은 브라우저에서 동시에 열어도 유지된다.

## 주요 문서

- `docs/RULE.md`
- `docs/WEB_DASHBOARD_ARCHITECTURE.md`
- `docs/SMOKE_TEST_WEB.md`
- `docs/INGAME_UI_EXAMPLES.md`
- `docs/DISCORD_SMOKE_TEST_2026-03-23.md`
- `docs/game-platform-refactor-plan.md`

## 운영 메모

- 상태 갱신 정책
  - WebSocket 최우선 시도 및 오프라인/에러 시 자동 재접속
  - WebSocket 실패/미지원 환경에서는 version 기반 short polling으로 fallback
  - Polling 대체 시 간격: foreground `2초`, background/inactive `7초`
- 상태 변경 API 및 WebSocket 상태 push는 `version` 기반 최소 payload 응답을 지원한다.
- 세션 정책은 `최근 세션 1개만 유지` 다.

## Legacy 이미지 보정 스크립트

생성형 AI 로 만든 아이콘에서 가짜 투명 배경이 텍스처로 남는 경우 `scripts/legacy-tools/remove_bg.py` 를 쓸 수 있다. 밝기를 alpha 값으로 맵핑해서 안티앨리어싱을 보존하는 방식이다.

저장소 루트에서 실행 예시:

```bash
python mafia/scripts/legacy-tools/remove_bg.py "mafia/resource/roles/*_icon.png"
```

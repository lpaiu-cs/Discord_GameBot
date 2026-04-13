# Data Models

## 개요

이 저장소는 `실시간 게임 상태`와 `종료 후 비즈니스 기록`을 분리한다.

- 실시간 상태:
  - `liar/src/engine/game.ts`
  - `mafia/src/game/game.ts`
- 종료 후 기록:
  - `mafia/src/db/*.ts`
  - `mafia/src/db/schema.sql`

## `liar` 핵심 모델

기준 파일:

- `liar/src/engine/model.ts`
- `liar/src/engine/game.ts`

### 핵심 타입

- `LiarPhase`
  - `lobby | clue | discussion | voting | guess | ended`
- `LiarWinner`
  - `citizens | liar | cancelled`
- `LiarMode`
  - `modeA | modeB`
- `LiarPlayer`
  - `userId`, `displayName`, `joinedAt`
- `LiarClue`
  - 단서 제출 내용과 순서
- `LiarVote`
  - 투표자, 대상, 시각
- `LiarResult`
  - 승자, 종료 사유, 지목 대상, 최종 추리 단어

### `LiarGame` 주요 상태

- 식별:
  - `id`, `guildId`, `guildName`, `channelId`, `hostId`
- 진행 상태:
  - `phase`, `startedAt`, `endedAt`, `phaseDeadlineAt`
- 참가자:
  - `players: Map<string, LiarPlayer>`
- 진행 기록:
  - `clues: LiarClue[]`
  - `votes: Map<string, LiarVote>`
  - `turnOrder`, `currentTurnIndex`
- 비밀 정보:
  - `liarId`
  - `secretWord`
  - `liarAssignedCategoryId`, `liarAssignedCategoryLabel`, `liarAssignedWord`
- 결과:
  - `accusedUserId`
  - `result`

### 라이어 전적 모델

기준 파일:

- `mafia/src/db/liar-types.ts`
- `mafia/src/db/liar-match-record.ts`
- `mafia/src/db/liar-player-stats.ts`

핵심 구조:

- `RecordedLiarMatch`
  - 길드, 모드, 카테고리, 정답/오답 제시어, 종료 상태, 승자, 지목 대상, 시작/종료 시각, 참가자 배열
- `RecordedLiarMatchPlayer`
  - joined order, host 여부, liar 여부, accused 여부, 승패, clue 제출 여부, vote 대상
- `LiarPlayerStats`
  - lifetime, streaks, categoryStats, recentMatches

## `mafia` 핵심 모델

기준 파일:

- `mafia/src/game/model.ts`
- `mafia/src/game/game.ts`

### 핵심 타입

- `Ruleset`
  - 현재 코드상 `"balance"` 만 활성화
- `Role`
  - public role + internal role (`citizen`, `evil`)
- `Team`
  - `citizen | mafia`
- `Phase`
  - `lobby | night | discussion | vote | defense | trial | ended`
- `NightActionType`
  - `mafiaKill`, `spyInspect`, `beastMark`, `beastKill`, `policeInspect`, `doctorProtect`, `mediumAscend`, `thugThreaten`, `reporterArticle`, `detectiveTrack`, `terrorMark`, `priestRevive`
- `PlayerState`
  - 역할, 생존 여부, 연인, 군인/기자/성직자 사용 여부, 테러 표시, 낮 투표 락 등

### `MafiaGame` 주요 상태

- 식별:
  - `id`, `guildId`, `guildName`, `channelId`, `hostId`, `ruleset`
- 참가자:
  - `players: Map<string, PlayerState>`
- 비밀/서브채널:
  - `secretChannels`, `contactedIds`
- 밤 행동:
  - `nightActions`, `bonusNightActions`, `spyBonusGrantedTonight`
- 낮 행동:
  - `dayVotes`, `trialVotes`, `pendingTrialBurns`
- 기록/표시:
  - `webChats`, `privateLogs`, `audioCues`
  - `publicConfirmedMemos`, `privateConfirmedMemos`
- 진행 상태:
  - `phase`, `phaseContext`, `dayNumber`, `nightNumber`
  - `currentTrialTargetId`, `pendingArticle`, `pendingAftermathChoice`
- 종료:
  - `endedWinner`, `endedReason`

## shared business DB 모델

기준 파일:

- `mafia/src/db/schema.sql`
- `mafia/src/db/types.ts`

### 공통 테이블

- `users`
  - Discord user 기준 프로필/최근 활동
- `guilds`
  - Discord guild 기준 메타데이터

### 마피아 전적 테이블

- `matches`
- `match_players`
- `player_lifetime_stats`
- `player_role_stats`

### 라이어 전적 테이블

- `liar_matches`
- `liar_match_players`
- `liar_player_lifetime_stats`

### 핵심 원칙

- 실시간 게임 상태는 메모리 객체에 둔다.
- 종료 후 정규화된 레코드만 DB에 적재한다.
- `buildRecordedMatch` / `buildRecordedLiarMatch` 류 함수가 `엔진 상태 -> 비즈니스 기록` 경계다.
- `DATABASE_URL` 이 없으면 로컬 파일 fallback 을 사용하지만, 타입 구조는 shared business DB 기준으로 설계한다.

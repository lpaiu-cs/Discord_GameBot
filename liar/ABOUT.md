# Liar Module

이 디렉토리는 `Discord Game Bot` 안에서 Discord 채팅 기반 `라이어게임` 모듈을 담당한다. 현재는 slash command 중심의 1차 MVP가 구현되어 있다.

## 현재 상태

- `/liar create/join/leave/category/start/clue/begin-vote/vote/tally/guess/status/end` 구현
- 참가자는 `/제시어` 로 자기 정보만 ephemeral 응답으로 확인
- 웹 대시보드 없이 Discord 채널 안에서 로비, 설명, 토론, 투표, 추리, 종료까지 진행
- 세부 설계와 후속 확장은 `PLAN.md` 에 정리

## 예정 구조

- `src`: Discord 명령어, 세션 관리, 라운드 엔진
- `resource`: 주제/단어 데이터와 봇 자산
- `tests`: 룰 검증과 명령어 회귀 테스트
- `docs` 또는 `PLAN.md`: 설계와 룰 결정 기록

현재 루트 봇 런타임은 `mafia/`와 `liar/` 명령을 함께 등록하며, 루트 `build`와 `test`에도 `liar/` 소스가 포함된다.

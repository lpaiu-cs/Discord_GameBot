# discord_mafia

Discord 서버에서 구동되는 `마피아42 시즌4 일반·클래식` 복제 봇입니다.

프로젝트 범위는 `2017-03-10 간호사 추가 이전`의 `시즌4 초기/밸런스`까지만 고정합니다.

현재 범위는 아래로 고정합니다.

- 4~8인
- 일반/클래식
- `2017-03-10` 간호사 추가 이전까지만 복제
- `예언자`, `판사`, `교주팀` 제외
- 듀얼 고유능력 제외
- 룰방 로컬 규칙 제외
- 현재 문서와 구현에서 빠져 있는 `간호사` 및 이후 시점 요소는 미구현 누락이 아니라 의도적 omission

## Source Of Truth

- 규칙의 단일 기준 문서는 [RULE.md](/Users/lpaiu/vs/discord_mafia/RULE.md) 입니다.
- 엔진 구현, 역할 카드 설명, UI 예시 문서, 테스트는 `RULE.md`와 같은 semantics를 유지해야 합니다.

## 시작 방법

1. `.env`를 채웁니다.
2. 의존성을 설치합니다.
3. 봇을 실행합니다.

```bash
npm install
npm run dev
```

## 검증 명령

```bash
npm test
npm run build
```

## 주요 문서

- 규칙 기준: [RULE.md](/Users/lpaiu/vs/discord_mafia/RULE.md)
- 인게임 UI 예시: [INGAME_UI_EXAMPLES.md](/Users/lpaiu/vs/discord_mafia/docs/INGAME_UI_EXAMPLES.md)
- Discord 스모크 테스트 기록: [DISCORD_SMOKE_TEST_2026-03-23.md](/Users/lpaiu/vs/discord_mafia/docs/DISCORD_SMOKE_TEST_2026-03-23.md)

## 구현 메모

- 밤 시간: 25초
- 낮 토론 시간: 생존자 수 x 15초
- 투표 시간: 15초
- 최후의 반론: 15초
- 찬반 투표 시간은 환경변수로 조정합니다.

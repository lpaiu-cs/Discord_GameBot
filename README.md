# Discord Game Bot

이 저장소는 게임별 모듈을 분리하는 상위 루트다.

- [mafia/ABOUT.md](./mafia/ABOUT.md): 웹 대시보드 기반 마피아 모듈
- [liar/ABOUT.md](./liar/ABOUT.md): Discord 채팅 기반 라이어게임 모듈
- [liar/PLAN.md](./liar/PLAN.md): Discord 채팅 기반 라이어게임 계획

현재 루트 봇 런타임은 `mafia/`와 `liar/`를 함께 실행하며, 루트 `package.json`은 두 모듈을 함께 빌드하고 테스트한다.

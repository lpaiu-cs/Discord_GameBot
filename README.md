# Discord Game Bot

이 저장소는 게임별 모듈을 분리하는 상위 루트다.

- [mafia/ABOUT.md](./mafia/ABOUT.md): 웹 대시보드 기반 마피아 모듈
- [liar/ABOUT.md](./liar/ABOUT.md): Discord 채팅 기반 라이어게임 모듈
- [liar/PLAN.md](./liar/PLAN.md): Discord 채팅 기반 라이어게임 계획
- 라이어 모듈은 현재 resource 기반 제시어, 길드별 카테고리 팩 override, shared business DB 전적 저장, `/liar stats` 조회까지 포함한다.

현재 루트 봇 런타임은 `mafia/`와 `liar/`를 함께 실행하며, 루트 `package.json`은 두 모듈을 함께 빌드하고 테스트한다.

## PM2 운영

루트 `.env`를 채운 뒤 PM2 전역 설치가 필요하다.

```bash
npm install -g pm2
npm run pm2:start
```

재배포 시에는 빌드 후 같은 프로세스를 다시 반영한다.

```bash
npm run pm2:restart
```

기본 운영 명령:

```bash
npm run pm2:logs
npm run pm2:stop
npm run pm2:delete
pm2 save
pm2 startup
```

PM2 설정은 루트 [`ecosystem.config.cjs`](./ecosystem.config.cjs)에 있다. 단일 프로세스로 `dist/mafia/src/index.js`를 실행하며, 이 진입점이 `mafia`와 `liar` 모듈을 함께 올린다.

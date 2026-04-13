# @memory

이 디렉토리는 장기 프로젝트용 저장소 내 메모리다.

목적:

- 다음 에이전트가 이전 맥락을 잃지 않게 한다.
- 현재 프롬프트 진행 상태를 압축해서 남긴다.
- 폴더 구조, 핵심 데이터 모델, 단계별 마일스톤을 빠르게 복구하게 한다.

## 읽기 순서

1. `current_context.md`
2. `repo_map.md`
3. `data_models.md`
4. `milestones.md`
5. `agent_changelog.md`

## 파일 설명

- `current_context.md`: 지금 프로젝트가 어디까지 왔는지
- `repo_map.md`: 어디에 무엇이 있는지
- `data_models.md`: 상태 객체와 DB 구조가 어떻게 생겼는지
- `milestones.md`: divide & conquer 기준의 현재 단계
- `agent_changelog.md`: 에이전트 지침 변경 기록

## 운영 원칙

- 장문의 회고보다 `다음 행동에 필요한 압축 정보`를 우선한다.
- 완료된 작업과 미완료 작업을 명확히 구분한다.
- 코드 구조가 바뀌면 즉시 갱신한다.
- 문서 전용 작업이어도 메모리가 낡으면 갱신한다.

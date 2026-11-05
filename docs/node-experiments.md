# 제작 노드 단독 실험

분석(`analysis`), 훅 검토(`hook`), 시각 검증(`visual`)을 저장된 draft 스냅샷에서 하나씩 실행한다.
초안 제작과 영어 폴리싱은 실험 대상에 포함하지 않는다.

## 운영과 공유하는 경로

실험도 `execute` → `stagePrompt` → `stagePolicy` → 작업 전용 MCP → 같은 CLI 모델·출력 스키마·완료 검사를 사용한다.
실험용 프롬프트나 별도 모델은 없다. 실행 시점의 코드와 프롬프트를 사용하므로 과거 실행 당시 버전을 재현하는 기능은 아니다.
수정한 프롬프트는 다음 실험부터 반영한다.

SQLite backup으로 프로젝트·자산·설정·원본 이미지·이전 단계 기록을 함께 복사한다. 프로젝트와 draft ID도 유지한다.
`production_context`와 자료 조회는 복사한 DB에서 제공하고, 폰트·렌더러·캐릭터 참조는 같은 저장소를 사용한다.
노드 완료 후 다음 단계로 넘어가지 않으며 이전/후속 단계의 draft 기록을 삭제하지 않는다.

## 실행

```sh
pnpm experiment:node --draft 28 --step visual --output /absolute/experiments/spacing-28
```

- `--draft`: 화면의 작업 번호. `--step`: `analysis`, `hook`, `visual` 중 하나.
- 새 output 폴더는 운영 DB를 한 번 복사한다. 다른 DB를 기준으로 하려면 `--source /absolute/source.sqlite`를 지정한다.
- 같은 실험 결과에서 이어서 수정하려면 같은 폴더에 `--continue`를 붙인다. 시작 상태부터 비교하려면 새 output 폴더를 쓴다.
- 실행 제한은 기본 1,200초, `--timeout`으로 1~3,600초 사이에서 지정한다. 취소·시간 초과는 해당 CLI를 중단하고 복사본을 남긴다.
- 실행 중에는 실험 서버 주소와 결과 폴더가 출력된다. 종료하면 서버와 임시 Next 빌드·설정 파일을 정리한다.

분석·훅도 `--step analysis`, `--step hook`으로 실행한다. 지정 단계의 입력이 확보된 draft가 필요하다.
외부 원본 이미지가 없으면 재수집하지 않고 거부한다. 수집 스케줄러·텔레그램 전송은 실험 서버에서 꺼진다.
웹 조사와 CLI·이미지 생성 권한은 운영 노드와 같으므로 모델이 필요하다고 판단하면 해당 기능은 사용될 수 있다.

## 결과와 반복

output 루트의 `experiment.sqlite`가 실험 복사본이다. 각 실행 폴더에는 다음을 저장한다.

- `input.json`: 실제 단계의 프롬프트, 모델, 스키마, 도구 권한, 시작 context.
- `before/after.json`, `before/after-project.json`: 단계 결과와 편집 문서.
- `before/after-NN.png`, `before/after-layout.json`: 전체 슬라이드와 실제 경계 측정값.
- `manifest.json`: 단계·성공 여부·프롬프트 해시·복사본 위치. `server.log`: 서버 실행 기록.

시각 노드는 [측정 기반 레이아웃 기준](production-prompts/layout.md)에 따라 간격 계획 → 수정 → 재측정 → 미리보기를 반복한다.
서버가 실제 측정값으로 간격 조건을 검사하고 실패하면 같은 CLI가 수정한다. 재시도 상한은 [노드 구축 원칙](production-node-design.md#같은-cli에서-오류-수정-후-계속-진행)을 따른다.
수치 통과만으로 최종 디자인을 승인하지 않는다. 전후 이미지에서 읽는 흐름·그룹·원본 구성 보존을 함께 비교한다.
원본 운영 draft에 자동으로 덮어쓰지 않는다. 채택한 결과는 별도 편집 작업으로 적용한다.

## 구현 경계

`experiment` API action은 `CONTENT_STUDIO_EXPERIMENT=1`, `CONTENT_STUDIO_DISABLE_COLLECTION=1`,
별도 절대 DB 경로가 설정된 서버에서만 허용한다. 운영 DB와 심볼릭·하드 링크로 같은 파일을 가리키는 경로도 거부한다.
일반 `resume`은 기존처럼 중단·실패 상태만 허용하며, 완료된 운영 draft를 재개하는 우회 경로로 사용하지 않는다.
실험 파일에는 실제 콘텐츠·설정이 포함되므로 저장소에는 커밋하지 않는다. 비교가 끝나면 해당 output 폴더를 정리한다.

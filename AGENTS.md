<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project structure

- When a non-vendored folder grows beyond five files, review it for cohesive feature subgroups and introduce a subfolder when the ownership boundary is clear.
- Keep generated or shared primitive collections such as `src/components/ui` flat when grouping would make discovery harder.

## 슬라이드 생성과 수정

- Content Studio로 게시용 슬라이드를 생성하거나 수정할 때는 작업 전에 `docs/content-guidelines.md`를 반드시 읽고 적용한다. MCP로 프로젝트를 선택·복제·편집하는 작업도 포함한다.
- 슬라이드 작업을 새로 시작할 때 가이드의 최신 내용을 다시 읽는다.
- 이 가이드의 배경색·훅·레이아웃 규칙은 게시용 슬라이드에 적용한다. Content Studio 앱 자체의 UI 개발에는 적용하지 않는다.
- 슬라이드 생성 기능을 개발할 때는 가이드를 요구사항으로 참고하되, 문서에 적힌 규칙이 코드로 이미 구현되어 있다고 가정하지 않는다.

## 콘텐츠 리서치 (임시 기준)

- 수집 도구와 플랫폼별 한계는 `docs/research.md`를 참고한다.

- 리서치가 필요하면 먼저 목적과 대상 주제·계정을 정하고 필요한 수집 MCP를 선택한다. 모든 콘텐츠 제작에 리서치를 강제하지 않는다.
- 기본 후보는 주제에 관련된 슬라이드쇼이며 조회수 100,000 이상을 확인한다. 좋아요 기준은 아직 고정하지 않으며 요청에서 주어진 값이 있으면 적용한다. 이 기준은 추후 사용자와 조정한다.
- 해당 요청에서 사용자가 지정한 조건이 기본 기준보다 우선한다. `criteria`에 조건을 전달하고 결과의 `criteriaEvaluation`을 확인한다.
- 조회수·저장 수 등 원본에서 제공하지 않는 수치는 `null`이다. 추정하거나 0으로 바꾸지 않고, 확인할 수 없는 필수 조건은 충족했다고 주장하지 않는다. 반응 수는 수집 시점의 값이며 축약 표시된 수치는 원본 표시도 확인한다.
- 후보의 본문과 필요한 슬라이드 이미지를 직접 확인한다. 반응 수를 내용의 사실성이나 운동 효과의 근거로 취급하지 않는다.
- 댓글 본문·답글은 수집하지 않는다. 게시물의 댓글 수만 반응 지표로 사용한다.
- 실패 원인을 확인한 후 필요하면 캡차 도구 또는 같은 수집 세션의 브라우저를 사용한다. 401·403·빈 응답을 캡차로 단정하지 않는다. 해결 후 같은 작업을 재개하고 종료 시 수집 세션을 정리한다.

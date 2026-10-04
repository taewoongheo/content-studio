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
- 슬라이드 작업을 새로 시작할 때 가이드의 최신 내용을 다시 읽는다. 템플릿 선택은 `list_template_guides`의 재사용 가이드와 목록 메타데이터로만 판단하며, 후보 비교를 위한 전체 JSON·미리보기 읽기는 금지한다.
- 이 가이드의 배경색·훅·레이아웃 규칙은 게시용 슬라이드에 적용한다. Content Studio 앱 자체의 UI 개발에는 적용하지 않는다.
- 슬라이드 생성 기능을 개발할 때는 가이드를 요구사항으로 참고하되, 문서에 적힌 규칙이 코드로 이미 구현되어 있다고 가정하지 않는다.

- MCP로 새 슬라이드 프로젝트를 만들 때는 등록된 템플릿을 `clone_project`로 복제해야 한다. 템플릿이 없으면 생성할 수 없으며 우회 생성하지 않는다.

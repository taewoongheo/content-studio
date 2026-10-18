<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project structure

- 편집 화면은 `src/screens/slideshow-editor`와 `src/screens/video-editor`로 구분하며 진입 컴포넌트도 `SlideshowEditorScreen`·`VideoEditorScreen`으로 명명한다.

- When a non-vendored folder grows beyond five files, review it for cohesive feature subgroups and introduce a subfolder when the ownership boundary is clear.
- Keep generated or shared primitive collections such as `src/components/ui` flat when grouping would make discovery harder.

## 코드 소유권과 의존 방향

- `src/domains/slideshow`, `video`, `research`는 각 기능의 문서·명령·저장·렌더링을 소유한다. `screens`는 화면 구성과 화면에서만 쓰는 상호작용을 소유한다. 여러 화면이 사용하는 API 클라이언트와 모델은 해당 도메인에 둔다.
- `src/domains/workspace`는 공통 탭 계약·프로젝트 변경 알림과 두 편집기의 목록 조합을 담당한다. 슬라이드쇼와 영상은 서로 직접 참조하지 않는다.
- `src/lib/mcp`는 도구 등록·프로토콜 입력과 결과 변환을 담당한다. 편집·파일 가져오기·원자적 저장은 도메인 서비스를 호출하며 도메인에서 MCP나 화면을 가져오지 않는다.
- `src/lib/local-db`는 SQLite 연결과 시작 시 스키마 적용만 담당한다. 테이블·저장소·마이그레이션은 각 도메인이 소유하며 연결 초기화에서 도메인의 스키마를 참조하는 것은 허용한다.
- 공용 미디어 검증·미리보기 실행 큐는 `src/lib/media`, 공용 프로젝트 UI는 `src/components/projects`에 둔다. `pnpm test`의 `src/architecture/boundaries.test.ts`가 의존 방향과 클라이언트의 서버 코드 유입을 검사한다.

## 슬라이드 생성과 수정

- Content Studio로 게시용 슬라이드를 생성하거나 수정할 때는 작업 전에 `docs/content-guidelines.md`를 반드시 읽고 적용한다. MCP로 프로젝트를 선택·복제·편집하는 작업도 포함한다.
- 슬라이드 작업을 새로 시작할 때 가이드의 최신 내용을 다시 읽는다.
- 이 가이드의 배경색·훅·레이아웃 규칙은 게시용 슬라이드에 적용한다. Content Studio 앱 자체의 UI 개발에는 적용하지 않는다.
- 슬라이드 생성 기능을 개발할 때는 가이드를 요구사항으로 참고하되, 문서에 적힌 규칙이 코드로 이미 구현되어 있다고 가정하지 않는다.

## 레퍼런스 없는 콘텐츠 제작 요청

“콘텐츠 제작 시작해보자”, “콘텐츠 만들어줘”처럼 레퍼런스 없이 제작을 요청하면 다음 흐름으로 직접 진행한다. 사용자가 주제·템플릿을 지정하지 않았다는 이유만으로 주제나 참고 콘텐츠를 보내 달라고 묻고 작업을 끝내지 않는다.

1. `docs/content-guidelines.md`와 `docs/research-guidelines.md`를 읽고 `get_content_plan`으로 단일 루프의 템플릿 순서·다음 템플릿·전체 게시 이력·미게시 프로젝트를 확인한다. 사용자가 템플릿이나 주제를 지정했다면 해당 요청을 우선한다.
2. 기본적으로 `nextTemplateId`의 템플릿을 사용한다. 비교에는 구성 설명과 요약 메타데이터만 사용하며 후보의 전체 문서·미리보기를 읽지 않는다. 원본의 구체적인 주제가 아니라 재사용 가능한 전달 목적과 정보 구조를 기준으로 판단한다.
3. 전체 최근 게시글과 해당 템플릿에서 만든 최근 게시글의 `topic`·`message`를 함께 확인해 주제를 정한다. 제목만 다른 같은 내용을 반복하지 않는다. 회피 조건이 충돌하면 전체 게시 이력과 겹치지 않는 내용을 우선한다. 미게시 프로젝트도 확인해 같은 초안을 다시 만들지 않는다. 같은 큰 주제라도 핵심 내용이 다른 콘텐츠는 가능하다.
4. 정한 주제 안에서 플랫폼 게시물을 직접 확인하고 관련 자료·설명 방식·근거를 리서치한다. 리서치는 주제를 무작위로 고르는 단계가 아니다. 근거에 따라 메시지를 좁히거나 바꿀 수 있으며, 적격 후보를 찾지 못하면 이유를 설명한다.
5. 선택한 루프 템플릿을 `clone_project`로 복제한다. `topic`·`message`를 함께 전달하거나 제작 후 `set_content_metadata`로 저장한다. 복제본을 읽고 내용·페이지·요소를 편집한다. 원본은 변경하지 않는다. 전체 미리보기와 문구를 검토하고 저장을 확인한다. 게시 완료 등록은 사용자가 저장 프로젝트의 ‘게시’ 버튼으로 직접 수행한다.

리서치 상한 안에서 기준에 맞는 소재를 확보하지 못하거나 등록된 템플릿이 전혀 없으면 실제 막힌 이유와 진행한 범위를 설명한다. 적격 후보를 지어내거나 조건을 임의로 낮추지 않는다. 사용자가 레퍼런스·주제·템플릿을 명시한 경우에는 해당 요청을 우선한다.

## 콘텐츠 리서치

- 리서치를 시작하기 전에 `docs/research-guidelines.md`를 반드시 읽고 목적·선별 기준·확인 방법을 적용한다.
- 리서치 기준의 원문은 `docs/research-guidelines.md`에서 관리한다. 도구 사용법과 지원 범위는 아래 작업 안내를 따른다.

## 문서의 역할

- `README.md`는 프로젝트의 목적과 주요 기능을 소개한다. MCP 명세·글꼴 설정·저장 동작·설치 명령 등 내부 사용법을 넣지 않는다.
- `AGENTS.md`는 에이전트의 작업 지침, 내부 사용법, 구현 시 확인할 계약과 개발 검증 방법을 관리한다.
- `docs/content-guidelines.md`는 게시용 슬라이드의 작성·재사용·검토 기준을 관리한다.
- `docs/research-guidelines.md`는 조사 목적, 레퍼런스 선별 기준과 결과 확인 기준을 관리한다. 도구 설치나 API 명세를 섞지 않는다.
- 같은 기준을 여러 문서에 복사하지 않고 원문을 링크한다. 구현의 실제 지원 범위는 코드와 MCP 스키마로 확인하며, 문서만으로 구현을 가정하지 않는다.

## 로컬 실행과 개발

```sh
pnpm install
pnpm exec playwright install chromium
pnpm dev
```

- 앱은 `http://127.0.0.1:3000`에서 실행한다. `pnpm dev`와 `pnpm start`는 `127.0.0.1`에 바인딩한다. Host/Origin 검사는 인증을 대신하지 않으므로 외부 인터페이스나 역방향 프록시로 노출하려면 별도 인증이 필요하다.
- 앱은 Next.js·React 기반의 로컬 시각 편집기다. Codex 실행과 AI 대화는 외부 에이전트가 담당한다.
- DB·편집 상태·리서치 작업은 로컬 단일 서버 프로세스를 기준으로 한다. 여러 서버 프로세스나 서버리스 배포를 지원한다고 가정하지 않는다.
- 기존 작업 트리의 브랜치·미커밋 변경을 먼저 확인하고 관련 없는 변경을 보존한다.
- 개발은 원본 폴더 `/Users/taewoongheo/Projects/content-studio-workspace/content-studio`에서 `feat/*` 브랜치를 만들어 진행한다. 사용자가 별도로 요청하지 않으면 새 worktree나 작업 폴더를 만들지 않는다.
- `pnpm test:mcp`는 임시 DB·리서치 런타임·Next 빌드 폴더를 분리해 실행 중인 개발 서버와 충돌하지 않는다. 별도 빌드 검증에는 `CONTENT_STUDIO_DIST_DIR=.next-validation pnpm build`처럼 프로젝트 안의 빌드 폴더를 지정한다. 같은 빌드로 실행하려면 `pnpm start`와 `test:mcp --production`에도 동일한 값을 전달한다.

## 생성 파일과 임시 작업

- `output/`을 프로젝트 저장소나 콘텐츠 제작 작업 폴더로 사용하지 않는다. 생성 이미지·영상, 미리보기, MCP 요청/응답 JSON과 일회성 스크립트를 소스 저장소에 남기거나 커밋하지 않는다.
- 파일 경로가 필요한 제작 단계는 시스템 임시 폴더 안에 작업별 경로를 만들고 사용한다. 프로젝트에서 사용할 미디어는 API/MCP로 가져와 DB 저장을 확인한 뒤 직접 만든 임시 파일을 정리한다. 생성 도구가 관리하는 원본 폴더를 임의로 삭제하지 않는다.
- 사용자가 요청한 최종 다운로드·내보내기 파일은 지정한 위치에 저장한다. 편집 상태는 메모리, 저장 프로젝트와 사용 자산은 DB에서 관리하며 제작 중간 파일을 영구 보관할 필요가 있다고 가정하지 않는다.

## 프로젝트와 편집 상태

- UI의 새 편집기는 4:5 (1080 × 1350), 6장으로 시작한다. 화면 비율은 편집기 상단에서, 장 수는 추가·삭제로 조정한다. 이 UI 생성 경로와 MCP의 템플릿 복제 경로를 구분한다.
- Element 정의와 슬라이드별 placement를 분리한다. 텍스트 내용과 이미지 ID는 placement의 `value`에 있다. 좌표는 슬라이드 크기에 대한 비율, 글자 크기는 px이다.
- `scope: "common"`은 공유 기본값을 변경하고 해당 속성의 개별 덮어쓰기를 해제한다. `scope: "local"`은 해당 장의 placement에만 적용한다. UI의 적용 대상은 현재 장이 기본이며 선택한 여러 장이나 전체 장으로 확장할 수 있다.
- 텍스트·이미지·도형·배경과 슬라이드·레이어 순서를 편집할 수 있다. 캔버스의 슬라이드 경계 밖 요소는 기본적으로 잘라 보이고 ‘잘린 영역 표시’는 편집 화면에만 적용한다.
- 프로젝트 저장은 시각 문서와 사용 이미지를 함께 저장한다. 선택·가이드 등 화면 상태는 콘텐츠 저장과 구분한다.
- UI는 첫 미저장 변경 후 최대 5초 안에 자동 저장하며, 계속 입력해도 저장을 미루지 않는다. 저장 실패는 표시하고 5초 뒤 최신 문서로 재시도한다.
- 저장 버튼·Ctrl+S / Cmd+S, 탭 전환·종료, PNG ZIP 내보내기는 입력 중인 변경을 반영한 뒤 저장한다. 변경 없는 빈 임시 탭은 DB에 만들지 않는다.
- 저장된 프로젝트 이름 변경은 이름만 DB에 갱신하며 미저장 본문을 함께 저장하지 않는다. 임시 프로젝트 이름 변경도 DB에 새 프로젝트를 만들지 않는다.
- 닫을 때 저장 실패나 revision 충돌이 나면 탭과 편집 내용을 유지한다. 미저장 비활성 탭은 저장 후 종료·저장하지 않고 종료·취소를 선택한다. 프로젝트 삭제는 UI에서 확인한 뒤 저장본·이미지·열린 탭을 함께 삭제한다.
- 서버에 열린 탭 목록은 여러 브라우저 창이 공유하고, 선택한 탭은 창마다 독립적이다. 탭 전환은 입력을 반영·저장하고 프로젝트별 장·요소 선택과 표시 설정을 복원한다.
- 같은 열린 프로젝트를 선택하면 기존 탭을 재사용한다. 닫았다 다시 열면 새 `tabId`가 생긴다. 대시보드 이동이나 브라우저 새로고침은 서버 탭을 닫지 않는다.
- 서버 재시작은 열린 탭·되돌리기 이력을 초기화한다. 저장 프로젝트와 자산은 다시 열 수 있다. 탭 닫기는 외부 에이전트 실행을 중단하지 않는다.

## MCP 연결과 프로젝트 작업

앱 서버의 `/mcp`는 로컬 Streamable HTTP MCP를 제공한다. 실행 중인 앱의 포트를 확인하고 Codex의 `~/.codex/config.toml`에 등록한다. 설정 변경 후 Codex를 재시작한다.

```toml
[mcp_servers.content_studio]
url = "http://127.0.0.1:3000/mcp"
```

| 도구 | 용도 |
| --- | --- |
| `list_projects` | 저장 프로젝트와 열린 미저장 작업 조회 |
| `open_project` | 저장 프로젝트를 편집 가능한 열린 작업으로 불러오기 |
| `read_project` | 전체/부분/개요 문서와 최신 revision·tabId 읽기 |
| `list_template_guides` | 루프 순서의 템플릿 구성 설명과 요약 메타데이터 조회 |
| `get_content_plan` | 다음 템플릿·전체 게시 이력·미게시 프로젝트 조회 |
| `set_content_metadata` | 개별 콘텐츠의 주제·메시지 저장 |
| `set_reuse_guide` | 템플릿의 `composition` 저장 |
| `register_template`, `unregister_template` | 선택 페이지로 독립 템플릿 생성 / 템플릿 삭제 |
| `clone_project` | 독립 템플릿에서 새 게시글 생성 |
| `edit_project` | 편집 명령 배열을 한 묶음으로 적용 |
| `undo_project` | 직전 편집 묶음 되돌리기 |
| `preview_slide` | 기존 단일 슬라이드 전체 해상도 PNG 확인 |
| `preview_slides` | 여러 장을 한 번에 축소 미리보기, 생략하면 전체 장 확인 |
| `rename_project` | 슬라이드쇼 이름만 변경 |
| `export_slideshow` | 전체 슬라이드를 PNG ZIP으로 내보내는 작업 시작 |
| `get_render_job`, `cancel_render_job` | 영상/슬라이드쇼 내보내기 상태 조회·취소 |

- 템플릿 비교·선택은 `list_template_guides`의 메타데이터로 한다. 비교를 위해 후보의 전체 문서나 미리보기를 읽지 않는다. 선택한 원본을 `clone_project`로 복제한 뒤 복제본을 읽고 편집한다.
- `clone_project`는 등록된 `templateId`가 필수다. 등록된 템플릿이 없으면 UI에서 원본을 지정하도록 사용자에게 안내한다. 생성 제한을 우회하려고 에이전트가 임의 등록하거나 원본을 수정하지 않는다.
- 템플릿은 게시글과 독립된 문서·이미지·메타데이터를 소유한다. 게시글의 ‘템플릿으로 만들기’에서 남길 페이지를 선택하며 내용·개별 덮어쓰기·사용 Element와 이미지까지 복사한다. 템플릿 ID는 새로 만들고 원본 게시글 ID를 저장하지 않는다. 역할별 장수는 강제하지 않으며 기본 훅·본문·CTA와 다른 본문 형식도 대표 페이지로 남길 수 있다. 템플릿 편집은 기존 슬라이드쇼 편집기·명령·자동 저장·렌더러를 재사용한다.
- 템플릿 목록의 가로 미리보기와 페이지 선택 다이얼로그는 같은 슬라이드 렌더러를 사용한다. 저장 문서 조회는 탭을 열거나 자동 저장하지 않는다. 화면에 보이는 미리보기부터 로딩하며 템플릿 저장 후 갱신한다.
- 템플릿 생성은 저장된 게시글을 읽으며 열린 미저장 본문을 저장하지 않는다. 원본 게시글의 등록 상태·연결·내용을 변경하지 않는다. 게시글에 템플릿 등록 여부는 없으며 같은 게시글에서 여러 독립 템플릿을 만들 수 있다. 템플릿에서 만든 새 게시글은 문서·이미지를 복사하고 `template_id`만 이력 분류용으로 기록한다. 이후 템플릿 수정은 기존 게시글에 전파되지 않는다.
- 루프는 하나이며 `content_templates.loop_order` 양수 순서로 반복한다. `NULL`은 순서 변경 트랜잭션의 임시 값이다. 드래그·키보드 이동으로 전체 순서를 원자적으로 저장하며 오래된 목록·누락·중복 ID는 거부한다. 루프 제외는 확인창을 거쳐 독립 템플릿과 해당 자산을 삭제하고 열린 탭 및 게시글 부모 연결을 정리한다. 게시글·게시 시각은 유지하며 제외 보관 목록은 없다.
- 게시글의 부모는 ‘내용 정보’ 또는 `set_content_metadata`에서 루프의 템플릿으로 변경하거나 해제할 수 있다. 연결은 현재 이력 분류에만 사용하며 문서를 동기화하지 않는다. 템플릿을 만들 때 사용한 원본 게시글과의 연결은 없다. 게시글과 템플릿은 각각 독립적으로 삭제할 수 있다.

- `composition`은 최대 2000자의 템플릿 구성 설명이다. 생성·복제에는 비어 있지 않은 설명이 필요하다. `register_template`는 `projectId`, 선택한 `slideIds`, `templateName`·`templateTopic`·`templateMessage`·`composition`을 받아 새 `template.id`를 반환한다. `set_reuse_guide`·`unregister_template`·`clone_project`는 `templateId`를 받는다. 기존 프로젝트 읽기·편집 도구는 열린 템플릿 ID도 사용할 수 있다.
- 구성 설명을 작성·갱신할 때는 실제 문서의 핵심 시각적 특징과 적합한 정보 형식·분량을 연결해 설명한다. 주제·메시지도 원본에 묶이지 않는 재사용 설명으로 작성하며, 상세 기준은 아래 템플릿 정보 작성 가이드를 따른다. 비교·선택 때의 메타데이터 경계와 작성 때의 문서 확인을 구분한다.
- `read_project`는 기본적으로 기존 전체 응답을 유지한다. `slideIds`·`elementIds`는 조회 범위를 좁히고 해당 문서에 `partial: true`를 표시한다. `outline: true`는 스타일 없는 내용·ID 개요를, `includeAssets: false`는 자산 메타데이터 생략을 제공한다. 존재하지 않는 ID는 거부한다. `edit_project`의 `includeDocument: false`는 전체 문서 대신 최신 revision과 결과 ID 요약을 반환하며, 기본값은 기존 전체 응답이다.
- `preview_slides`의 `slideIds`를 생략하면 전체 장을 확인한다. 기본 너비 540px, 64~1920px 범위이며 원본보다 확대하지 않는다. 렌더러 코드·프로젝트·탭·revision·크기에 따라 바이트 한도 내에서 결과를 재사용한다. 브라우저는 작업 간 재사용하고 유휴 시 종료한다. 기존 `preview_slide`는 전체 해상도 PNG 응답을 유지한다.
- `export_slideshow`는 최신 `expectedTabId`·`expectedRevision`, 절대 `.zip` `outputPath`를 받는다. 요청 시점의 문서·이미지를 캡처하고 작업 ID를 즉시 반환한다. `get_render_job`을 1~2초 간격으로 조회하고 `completed`의 `result.outputPath`·`bytes`를 확인한다. `failed`에는 오류가 있고, `cancel_render_job` 후 최종 상태를 다시 확인한다. 완료 메타데이터는 최대 40개·15분 보관하며 서버 재시작에는 초기화된다. 출력 폴더는 이미 있어야 하고 덮어쓰기는 `overwrite: true`가 필요하다. 취소·실패는 기존 파일을 보존한다.
- `edit_project`와 `undo_project`에는 최신 읽기·쓰기 응답의 `expectedRevision`과 `expectedTabId`를 사용한다. 닫힌 작업이나 이전 탭 ID는 거부된다. 다시 연 작업은 다시 읽고 최신 값을 사용한다.
- Element 공유 누락 검증은 문서 쓰기 배치·되돌리기·프로젝트 복제의 최종 문서에서 한 번 실행한다. 읽기·미리보기·이름·메타데이터 변경은 검증하지 않는다. 결과의 `warnings`는 경고이며 저장을 차단하거나 자동 병합하지 않는다. 비교 조건·허용치는 `src/domains/slideshow/editor/inspection/shared-elements.ts` 한 곳에서 관리한다. `includeDocument: false`에서도 경고를 반환한다.
- `rebind_element`는 `slideId`·`placementId`·대상 `elementId`를 받아 같은 종류의 Element로 다시 연결한다. 내용·부분 텍스트 스타일·레이어 순서·실제 외형을 보존하며 차이는 개별 덮어쓰기로 남긴다. 일반 편집과 같은 저장·되돌리기 계약을 따른다. 경고 해석과 배치 작성 기준은 [제작 가이드](docs/content-guidelines.md#3-독립-템플릿을-복제해-제작한다)를 따른다.
- 편집 명령 배열은 한 단계로 되돌린다. 실패한 묶음은 문서·revision·되돌리기 이력과 신규 이미지 등록을 복구한다. `clone_project`, `edit_project`, `undo_project`는 DB 저장 성공 후 성공을 반환한다.
- 읽기·열기·미리보기는 자동 저장하지 않는다. MCP 생성·복제·명시적 열기는 탭을 추가하며 브라우저 화면을 강제로 전환하지 않는다. 프로젝트 삭제·탭 닫기는 MCP로 제공하지 않는다.
- `register_template`·`clone_project`·`create_video_project`·`clone_video_project`·`export_slideshow`·`start_video_export`·`export_video`는 선택적 `requestId`(1~128자)를 지원한다. 새 작업에는 고유 ID를 만들고, 응답 유실/연결 재시도에는 같은 도구·ID·인자를 그대로 사용한다. 동시 요청과 다른 MCP 연결에서도 최초 성공/실패 응답을 재사용하며 같은 ID로 인자를 바꾸면 `REQUEST_ID_REUSED`를 반환한다. 수정한 요청이나 실패한 렌더링을 새로 실행하려면 새 ID를 사용한다. 기록은 서버 메모리에 완료 후 1시간 유지하며 서버 재시작 시 사라진다. 재시작·만료 후 재요청은 중복 방지를 보장하지 않으므로 프로젝트/작업 목록을 먼저 확인한다. 기록 256개 또는 완료 응답 합계 32MiB에 도달하면 기존 기록을 밀어내지 않고 새 ID 요청을 `REQUEST_CACHE_FULL`로 거부한다. 이미 실행 중인 응답이 완료되면서 바이트 기준을 초과할 수 있다. `requestId` 생략 시 기존 동작을 유지한다. 재사용 응답은 최초 스냅샷이며 현재 상태는 다시 읽어야 한다. 내보내기 작업 메타데이터 보관 기간(15분·최대 40개)은 별도이므로 반환된 작업 ID를 즉시 조회한다.
- MCP 도구 오류는 기존 `isError`·텍스트 문구와 함께 `structuredContent.error`의 `code`·`message`·`details`·`recovery`를 반환한다. 스키마 오류의 `details.issues`에는 필드 경로와 제한값/허용값이 있다. 실행 중 명령 오류는 `commandIndex`(0부터)·`commandType`·대상 ID를 제공한다. `REVISION_CONFLICT`·`TAB_CONFLICT`는 최신 상태를 다시 읽고, `PROJECT_NOT_OPEN`은 명시적으로 연 뒤 다시 읽는다. 오류 문자열을 파싱해 복구하지 않는다.
- 에이전트는 앱 DB에 직접 쓰지 않는다. 저장과 편집은 앱 API/MCP를 사용한다.

### 템플릿 정보 작성 가이드

템플릿의 `topic`·`message`·`composition`은 모두 **원본의 구체적인 내용에 묶이지 않는 재사용 설명**이다. 템플릿 정보는 게시글 정보와 독립적으로 저장한다. 작성 대상 문서를 읽어 실제 전달 구조를 확인하되, 제목·결론·특정 운동명·부위·루틴을 그대로 요약하지 않는다. 개별 게시글의 주제와 메시지는 `content_projects`에서 구체적으로 기록한다.

| 항목 | 역할 | 재사용 가능한 예시 |
| --- | --- | --- |
| 주제 (`topic`) | 반복 제작할 콘텐츠 유형과 범위 | 부위별 운동 선택 가이드, 운동 순위·평가 가이드, 운동 팁·실행 가이드 |
| 메시지 (`message`) | 그 유형이 독자의 이해·선택·실행을 어떻게 돕는지 | 각 부위에 맞는 운동 대안을 비교하고 하나씩 골라 루틴을 구성하도록 돕는다. |
| 구성 (`composition`) | 그 메시지를 전달하기 좋은 정보량·시각적 구조·페이지 흐름 | 이미지·이름·짧은 설명이 있는 카드 세 개로 대안을 함께 제시하고, 한 페이지에 한 그룹을 다룬다. |

- **주제:** ‘가슴 운동 선택’ 대신 ‘부위별 운동 선택 가이드’, ‘이두 운동 13개’ 대신 ‘운동 순위·평가 가이드’, ‘주 5일 PPLUL’ 대신 ‘운동 분할·루틴 계획’처럼 재사용할 유형으로 쓴다. 실제 적용 범위를 넘는 모호한 ‘정보 전달’ 같은 표현은 피한다.
- **메시지:** 원본 게시글의 주장이나 결론 대신 독자가 비교·선택·이해·실행할 수 있게 하는 목적을 쓴다. 특정 부위·운동명·요일 수·순위 결과에 묶지 않는다. 템플릿 메시지를 새 게시글의 확정된 결론이나 필수 주제로 취급하지 않는다.
- **구성:** 어떤 메시지 유형을 어떤 정보 형식·분량으로 전달할 때 적합한지, 이를 돕는 핵심 시각적 특징과 필요한 페이지 흐름을 2~4문장으로 연결한다. 최대 2000자다. 현재 게시글 내용을 요약하거나 요소 좌표·색상·폰트·세부 배치를 나열하지 않는다.
- **구체성을 남길 곳:** 카드 세 개, 한 장에 한 항목, 두 설명 덩어리, 전체 개요 뒤 그룹별 목록처럼 실제 레이아웃을 구분하는 특징은 유지한다. 적합한 정보량은 현재 레이아웃에 대한 활용 판단이며 고정된 필수 내용이나 모든 문장 길이를 수용한다는 보장이 아니다. 원본의 ‘13개 운동’, ‘9가지 팁’, ‘5일’ 같은 콘텐츠 항목 수는 재사용 제약으로 넣지 않는다.
- **최종 확인:** 원본의 구체적인 운동·부위·주장·항목 수를 바꿔도 주제·메시지·구성 설명이 성립하는지 확인한다. 동시에 두 템플릿의 활용 방식과 시각적 차이를 구분할 수 있어야 한다. 템플릿 설명 갱신 시 연결된 게시글의 이름·내용 정보·문서·이미지·부모·게시 상태와 루프 순서를 함께 변경하지 않는다.

구성 작성 틀:

> [어떤 유형의 메시지를 어떤 정보 형식·분량으로 전달할 때] 적합하다. [이를 뒷받침하는 핵심 시각적 특징]을 사용한다. [페이지 흐름 또는 특히 유용한 활용 상황]에 유용하다.

주제·문구·이미지만 바뀌면 템플릿 설명은 유지한다. 전달 목적, 핵심 시각적 특징, 정보량, 페이지 흐름이 달라져 적합한 포맷이 바뀌면 해당 설명을 갱신한다. 설명을 작성·갱신할 때의 원본 확인과 템플릿 선택 때의 메타데이터 경계를 구분한다. 선택할 때는 저장된 설명과 요약 메타데이터만 사용한다.


## 이미지와 텍스트 편집

- 텍스트 배경은 기존 `update_visual`의 `style.backgroundColor`(6자리 HEX 또는 `transparent`)와 `style.borderRadius`(0–100px)로 설정한다. UI의 ‘배경 모서리 반경 (px)’도 같은 속성을 사용하며 현재 장·선택한 장·전체 장 적용, 저장·되돌리기·미리보기·내보내기에 유지한다.

- 텍스트·이미지·도형의 `style.rotation`은 요소 중심 기준 시계 방향 각도(-360~360도)이며 생략하면 0도다. UI의 ‘회전 (°)’ 입력과 MCP의 `add_element`·`update_visual`(common/local)이 같은 값을 사용하고 저장·되돌리기·미리보기·내보내기에 유지한다. 위치·너비·높이는 회전 전 프레임 기준이며 배경은 회전할 수 없다.

이미지는 파일 시스템에서 선택한 절대 경로를 `edit_project`의 `set_local_image`로 전달한다. 이미지 요소를 생성·배치한 뒤 같은 묶음에서 적용할 수도 있다.

```json
{
  "projectId": "작업 ID",
  "expectedRevision": 0,
  "expectedTabId": "현재 열린 탭 ID",
  "commands": [{
    "type": "set_local_image",
    "slideId": "slide-1",
    "placementId": "이미지 배치 ID",
    "localPath": "/absolute/path/exercise.png"
  }]
}
```

- 앱은 최대 10MB의 PNG/JPG/WebP를 검증·등록하고 문서에 적용한다. 되돌리기는 배치를 복구하며 이미 등록된 자산은 유지한다. UI에서는 드롭과 파일 선택도 사용할 수 있다.
- 부분 색상은 슬라이드별 텍스트 placement에 저장한다. `set_slot_value`의 `textColors`는 새 내용과 함께, `set_text_colors`는 내용을 유지하며 색상만 적용한다.
- 부분 굵기도 슬라이드별 텍스트 placement의 `textWeights`에 저장한다. `set_text_weights`는 `{ start, end, fontWeight }` 구간 전체를 교체하고 `[]`로 해제한다. `fontWeight`는 정수 100–900이며 렌더링과 UI는 선택 글꼴의 지원 굵기에 맞춘다. 색상과 굵기 구간은 서로 독립적이며 겹쳐 적용할 수 있다. `set_slot_value`에 `textWeights`를 함께 전달하면 원자적으로 교체하고, 생략하면 내용 수정에 맞춰 구간을 보정한다. UTF-16·정렬·비중첩·글자 경계 규칙은 색상과 같다. UI에서 내용 선택 후 굵기 적용·선택 해제·전체 해제를 제공하며 저장·되돌리기·복제·클립보드·미리보기·내보내기에 유지한다.
- `textColors`는 전체 구간을 교체하며 `[]`는 모두 해제한다. 구간은 정렬된 비중첩 UTF-16 인덱스, 끝 제외, 6자리 HEX로 지정한다. 이모지나 결합 문자 중간을 자르는 구간은 거부한다.
- `set_slot_value`에서 `textColors`를 생략하면 기존 구간을 새 내용에 맞춰 보정한다. UI의 선택 색상 적용·선택 구간 해제·모두 해제도 같은 모델을 사용한다.

```json
{
  "type": "set_slot_value",
  "slideId": "slide-1",
  "placementId": "title-1",
  "value": "BUILD CHEST",
  "textColors": [{ "start": 6, "end": 11, "color": "#FF0000" }]
}
```

## 콘텐츠 글꼴

선택한 템플릿의 스타일을 유지한다. 아래는 현재 코드의 지원 글꼴과 역할이며 새 콘텐츠의 시각적 방향을 임의로 바꾸라는 지침이 아니다.

| 역할 | `fontFamily` | 지원 굵기 |
| --- | --- | --- |
| 훅 | `oswald` | 700 (Bold) |
| 본문 제목 | `space-grotesk` | 300–700, 권장 700 |
| 본문 | `inter` | 100–900, 권장 400–500 |
| 기본 대체 | `sans-serif` (Geist) | 100–900 |

- 새 텍스트는 Inter로 시작한다. 지원하지 않는 글리프는 시스템 sans-serif로 대체된다.
- `update_visual`의 `fontStyle`은 `normal` 또는 `italic`이다. Inter·Geist는 실제 이탤릭, Oswald·Space Grotesk는 합성 기울임을 사용한다. 편집기·미리보기·내보내기는 같은 렌더링을 사용한다.
- 이전 문서의 Anton·Bebas Neue·Barlow Condensed는 Oswald, Source Sans 3는 Inter, 명조·고정폭은 Geist로 정규화한다. `anton`을 새 편집 명령의 지원 글꼴로 안내하지 않는다.
- 지원 목록의 원문은 `src/domains/slideshow/editor/typography/fonts.ts`, 실제 로딩은 `src/app/layout.tsx`에서 확인한다.

## 저장 데이터와 구현 경계

- SQLite 기본 위치는 `/Users/taewoongheo/Projects/content-studio-workspace/content-studio.sqlite`로 고정한다. 실행 폴더·브랜치·포트에 따라 경로를 바꾸거나 새 DB를 만들지 않는다. 검증용 DB는 `CONTENT_STUDIO_DB_PATH`의 절대 경로로만 분리한다.
- 리서치 로그인 상태·Python 환경·모델도 `/Users/taewoongheo/Projects/content-studio-workspace/.content-studio-research`를 공유한다. `CONTENT_STUDIO_RESEARCH_RUNTIME_DIR`을 설정한다면 절대 경로를 사용한다.
- 프로젝트 문서와 사용 이미지 바이트·메타데이터를 프로젝트별로 저장한다. 사용 이미지는 `content_project_assets`에서 관리한다. 외부 파일 이동·삭제는 저장된 프로젝트에 영향을 주지 않는다.
- 복제는 문서와 이미지 사본을 함께 복제하고, 프로젝트 삭제는 해당 프로젝트의 이미지 사본도 삭제한다. 공용 이미지·캐릭터 라이브러리를 전제로 구현하지 않는다.
- 편집 중 문서·이미지·되돌리기 이력은 서버 메모리에 유지한다. API와 MCP가 같은 작업 레지스트리와 저장 로직을 사용한다.
- v12 슬라이드쇼 DB는 `content_projects`, `content_project_assets`, `content_templates`, `content_template_assets`가 소유권을 나눈다. 템플릿은 `document_json`과 자체 자산을 저장하며 게시글 외래키를 갖지 않는다. 게시글의 선택적 `template_id`만 템플릿을 참조한다. 영상 테이블은 별도로 유지한다. 스키마는 슬라이드쇼 도메인에서 관리하고 공용 DB 모듈은 연결·버전 확인·스키마 적용만 담당한다.
- 프로젝트의 `topic`은 개별 콘텐츠의 주제, `message`는 구체적인 핵심 내용이다. 템플릿 설정의 `topic`은 재사용할 콘텐츠 유형, `message`는 독자의 이해·선택·실행을 돕는 일반적인 목적이며 원본의 구체적인 내용을 요약하지 않는다. 작성 기준은 위 템플릿 정보 작성 가이드에서 관리한다. `composition`은 일반적인 재사용 전달 목적과 구조다. 빈 임시 프로젝트는 필수 입력을 강제하지 않지만 게시 전에는 주제·메시지가 필요하다.
- `published_at`은 사용자가 ‘게시’ 버튼을 누른 서버 현재 시각(UTC ISO)이며 `NULL`은 미게시다. 달력은 한국 시간으로 표시한다. 재클릭은 기존 시각을 유지한다. 기록 취소는 시각만 비우며 문서·이미지는 유지한다. 게시 이력은 현재 프로젝트·부모 설정을 조회하므로 내용 정보나 부모를 바꾸면 이력에도 반영된다. 별도 게시 테이블이나 `is_published`는 없다.
- 구형 DB는 서버 시작 시 변환하지 않고 거부한다. 이 로컬 개발 전환에는 별도 마이그레이션 명령을 유지하지 않는다. DB 직접 변환은 사용자의 명시적 요청이 있을 때만 서버 종료·백업 후 수행하고 자산·외래키·기존 게시글 보존을 확인한다. 일반 콘텐츠 편집은 API/MCP를 사용한다.

- MCP 등록은 `src/lib/mcp/server.ts`, 프로젝트 도구는 `src/lib/mcp/tools/projects.ts`, 리서치 등록은 `src/lib/mcp/research/tools.ts`, 조회·검색·이미지는 `research/tools/gather`, 작업 상태·브라우저·종료는 `research/tools/control`에서 확인한다. UI → 명령 → 저장 경로를 추적해 실제 동작을 검증한다.

## 영상 편집

- 편집기 열기에서 `slideshow` / `video`를 선택하고 유형별 저장 프로젝트와 열린 탭을 표시한다. 영상은 독립된 Remotion 편집기이며 슬라이드 문서·placement 모델에 맞추지 않는다.
- 영상 편집기의 상단 프로젝트 액션·저장 상태·내보내기 문구, 왼쪽 선택 항목 편집, 오른쪽 Element 추가·복제·제거·드래그 레이어 배치는 슬라이드쇼와 맞춘다. 공통 위치·크기는 UI에서 %로 표시하되 영상 문서에는 px로 저장한다. 연결 영상의 `sequenceIndex`는 재생 순서이며 문서 배열의 레이어 순서와 독립적이다. 레이어 이동은 재생 시점·순서를 바꾸지 않고, 타임라인의 클립 이동은 재생 순서만 바꾼다. 이어붙이기는 오디오·텍스트까지 포함한 전체 끝에 추가하며, 다른 요소 뒤에 시작하는 연결 클립은 `sequenceStart`에 시작 기준을 보존한다. 빈 프로젝트의 첫 MP4는 0초에서 시작한다.
- 영상 문서 검증과 프레임 계산은 `src/domains/video/domain/model.ts`, 타임라인 편집은 `domain/editing.ts`, FPS 변환은 `domain/settings.ts`, 저장·열린 탭·revision 가드는 `src/domains/video/server`, 미리보기와 MP4의 공통 구성은 `src/domains/video/remotion`에서 관리한다. 영상 UI는 `src/screens/video-editor`다.
- 새 영상의 기본 배경은 흰색이다. 캔버스에 영상·이미지 파일을 여러 개 드롭하면 독립 요소로 추가한다. 미디어의 모서리 핸들은 기본적으로 비율을 유지하며 Shift로 비율을 해제한다. 안전 영역과 정렬 가이드는 편집 오버레이로만 표시하고 내보내기에 포함하지 않는다.
- 영상 이어붙이기는 `sequence` 클립의 순서·자르기 후 시작 시점을 다시 계산한다. 영상 요소는 독립된 시작 시점과 프레임을 사용하며 여러 개를 동시에 재생할 수 있다. 모든 요소는 시작 시점·표시 시간을 갖고, 화면 요소는 뒤에서 앞으로 레이어 순서대로 그린다.
- 영상 API는 `/api/video-projects` 아래에서 생성·열기·revision 검사 저장·이름 변경·복제·삭제·자산·내보내기를 제공한다. 기존 MCP 슬라이드 도구와 템플릿 루프는 슬라이드쇼 전용이며, 영상은 아래 별도 MCP 도구를 사용한다. UI/API/MCP는 영상 세션·revision·저장 로직을 공유한다. 에이전트는 DB를 직접 편집하지 않는다.
- 빈 영상 탭은 최초 편집/파일 추가 전 DB에 저장하지 않는다. UI는 첫 변경 후 5초 안에 저장하고 실패 시 5초 후 재시도한다. 저장·탭 전환·닫기·MP4 내보내기는 진행 중인 파일 추가와 최신 입력 저장을 기다린다. 충돌/저장 실패 시 전환을 막고 초안을 유지한다. 브라우저 종료에는 미저장 경고를 표시하며 비활성화 시 저장을 시도한다.
- 업로드는 선언한 MIME과 파일 시그니처가 일치해야 하며 파일당 최대 200MB다. 프로젝트별 미디어 바이트를 SQLite에 보관한다. 외부 원본 경로를 참조하지 않는다. 프로젝트 복제는 자산 사본을 만들고 삭제는 해당 프로젝트의 자산과 열린 탭을 함께 정리한다. 영상은 MP4 내보내기와 MP4 불러오기만 제공한다. MP4 불러오기는 미디어 클립을 이어붙이며 편집 문서를 복원하는 기능이 아니다. 슬라이드쇼의 PNG ZIP 내보내기는 유지한다.
- 재생 중 편집기 본체·속성 패널·레이어 목록은 프레임 구독을 하지 않는다. 재생선은 `requestAnimationFrame`과 transform으로 보간하고 상단 시간 눈금까지 표시한다. 시간 눈금은 초당 간격을 고정하며 전체 길이 변경으로 기존 클립을 축소하지 않는다. 오디오의 재생 시간은 원본 선택 구간과 표시 길이로 정하고 속도 압축은 하지 않는다. `pnpm test:video --profile`은 브라우저의 편집기 호출 수와 화면 갱신 표본을 측정한다.
- 로컬 MP4 렌더링은 `scripts/video/render.mts`를 별도 프로세스로 실행하고 임시 파일을 정리한다. 앱 체크아웃과 Node 의존성이 필요하며 단일 서버에서 한 번에 하나를 렌더링한다. 폰트는 Remotion Google Fonts 로더로 불러오므로 초기 로딩/렌더링에 네트워크가 필요하다.
- `pnpm test:video`는 임시 DB·리서치 폴더·Next 빌드 폴더에서 실제 브라우저로 유형 필터, 긴 이름과 좁은 화면, 동시 영상, 편집·저장·되돌리기·MP4 불러오기·복제·삭제·서버 재시작 복원을 확인한다. 테스트 미디어 생성에는 `ffmpeg`가 필요하다. `pnpm test:video --render`는 실제 MP4 출력과 `ffprobe`의 H.264/AAC 검증도 실행한다. 사용자 DB·인증 파일은 사용하지 않는다.

### 영상 MCP

영상 도구 등록은 `src/lib/mcp/video/tools.ts`, 입력 계약은 `schema.ts`, 편집은 `commands.ts`와 `writes.ts`, 로컬 미디어 검사는 `media/local.ts`에서 관리한다.

| 도구 | 용도 |
| --- | --- |
| `list_video_projects` | 저장 프로젝트·열린 초안 요약 조회 |
| `create_video_project` | 이름·초기 설정으로 독립 영상 탭 생성 |
| `open_video_project`, `read_video_project` | 저장본 열기 / 이미 열린 문서·revision·자산 메타데이터 읽기 |
| `edit_video_project` | 순서 있는 명령 묶음 적용·저장, 기본은 결과 요약 반환 |
| `undo_video_project`, `redo_video_project` | 편집 묶음 단위 되돌리기·다시 실행 및 저장 |
| `rename_video_project`, `clone_video_project` | 이름만 변경 / 저장 문서·자산 복제 |
| `preview_video` | 같은 Remotion 구성으로 지정 프레임 1~8개 PNG 확인 |
| `start_video_export` | 에이전트 권장: MP4 작업 시작 후 공통 작업 도구로 조회·취소 |
| `export_video` | 기존 호환용 동기식 H.264/AAC MP4 생성 |
| `close_video_project`, `delete_video_project` | 사용자 요청에 따른 탭 닫기 / 프로젝트·자산 삭제 |

- 편집·되돌리기·이름 변경·복제·내보내기·닫기·삭제에는 최신 응답의 `expectedTabId`·`expectedRevision`이 필요하다. 닫았다 다시 열면 기존 탭 ID를 재사용하지 않는다. 영상 탭 생성·열기·복제는 브라우저를 강제 전환하지 않는다. 읽기·미리보기는 저장하지 않는다.
- 모든 위치·크기는 px, 모든 시간은 문서 FPS의 정수 프레임이다. `set_document`는 해상도·배경·최소 길이·FPS를 수정하며 FPS 변경은 원본 트림·페이드·연결 시작 기준까지 실제 시간을 유지한다. 같은 변환을 UI에서 사용한다.
- `add_layer`는 텍스트·도형의 기본값을 지원한다. `update_layer`는 해당 종류의 모든 문서 속성을 수정하며 다른 종류의 속성·알 수 없는 속성은 거부한다. `remove_layer`, `duplicate_layer`, `split_layer`, `move_layer`, `trim_layer`, `reorder_layers`, `reorder_sequence`로 삭제·복제·분할·이동·자르기·쌓임 순서·연결 순서를 편집한다. `reorder_layers`는 전체 요소 ID를 뒤→앞 순서로, `reorder_sequence`는 연결 영상 ID 전체를 재생 순서로 받는다. 문서 전체를 교체할 필요가 없다.
- `import_media`는 절대 `localPath`의 영상·오디오·이미지를 읽고 실제 메타데이터로 요소를 만든다. 기본 연결 영상은 전체 끝에 추가하고 `mode: "overlay"` 영상·이미지·오디오는 기본 0프레임에 추가한다. `from`으로 독립 요소의 시점을 지정할 수 있다. `layerId`를 지정하면 같은 묶음 뒤 명령에서 참조할 수 있다. `replace_media`는 같은 종류의 파일로 원본을 교체하고 배치·스타일을 유지한다. 미디어는 UI와 동일한 브라우저 코덱 지원 범위에서 검사하며 시스템 ffprobe에 의존하지 않는다.
- 한 묶음은 한 undo 단계이며 DB 저장이 성공해야 성공을 반환한다. 비동기 파일 읽기 후 revision을 재검사하며 실패하면 새 프로젝트 행·자산·문서 변경이 롤백되고 메모리의 revision·이력도 유지된다. 성공 후 undo는 기존 자산을 유지한다. 기본 결과는 revision·요소 요약·자산 메타데이터이고 전체 문서는 `includeDocument: true` 또는 `read_video_project`로 확인한다.
- `read_video_project`는 기본 전체 응답을 유지한다. `layerIds`로 부분 문서(`partial: true`), `outline: true`로 내용·타이밍·ID 개요를 조회하고 `includeAssets: false`로 자산 메타데이터를 생략한다. 모든 조회는 최신 tabId·revision을 유지한다.
- `start_video_export`는 동기식 `export_video`와 같은 경로·revision 계약으로 문서·미디어를 캡처하며 작업 ID를 즉시 반환한다. 에이전트는 공통 `get_render_job`·`cancel_render_job`으로 진행률과 완료·실패·취소를 확인한다. 기존 `export_video`와 UI MP4 다운로드도 유지한다. 취소는 렌더 하위 프로세스 종료와 임시 파일 정리를 기다리고, 이미 완료된 파일은 삭제하지 않는다.
- 영상 렌더러는 소스가 동일한 동안 번들을 재사용하고 프레임은 탭·revision·소스·크기별 캐시에 보관한다. 미디어는 렌더링 범위의 임시 loopback 서버에서 제공하며 파일로 재복사하지 않는다. 요청 종료 후 서버·작업 파일을, 유휴 시 번들을 정리하며 정상적인 서버 종료 시에도 남은 임시 렌더 폴더를 정리한다. 여러 영상·오디오 가져오기는 최대 두 파일을 동시에 검사하며 한 브라우저를 공유한다.
- 미리보기는 `frames`(0부터, 실제 길이 내), 선택 `width`(기본 540)를 받고 PNG 이미지와 해당 revision을 반환한다. 가이드·선택은 포함하지 않으며 오디오는 정지 이미지에서 들리지 않는다. 여러 시점을 확인한 뒤 MP4로 내보낸다. `export_video`의 출력 폴더는 이미 있어야 하며 기존 파일은 기본 거부하고 `overwrite: true`일 때만 덮어쓴다. 출력 경로는 렌더링 전에 예약하며 임시 파일을 완성한 뒤 교체하고 실패 시 예약·임시 파일을 정리한다. 덮어쓰기 렌더링이 실패하면 기존 파일을 보존한다.
- MCP 변경은 열린 영상 UI에 반영한다. 미저장 입력은 덮어쓰지 않으며 revision 충돌로 저장을 막고 최신 내용 다시 읽기를 제공한다. 선택·가이드·비율 잠금은 문서가 아닌 편집 화면 상태다. 영상 삭제 도구는 명시적 사용자 요청과 `confirm: true`에만 사용한다. 영상 삭제 API도 열린 탭 ID와 revision을 검사하고, 닫힌 저장본은 목록에서 받은 저장 revision으로 검사하며 삭제 때문에 탭을 열지 않는다. 슬라이드쇼의 삭제·탭 닫기 MCP 정책은 변경하지 않는다.
- `pnpm test:video`에는 실제 MCP 클라이언트의 모든 영상 도구·PNG 미리보기·UI 동기화·충돌 보호 검사도 포함된다. `--render`는 UI와 MCP의 실제 MP4 출력을 함께 검사한다.

## 콘텐츠 리서치 작업 안내

선별 정책은 `docs/research-guidelines.md`를 먼저 읽는다. 리서치 도구는 프로젝트 복제와 독립적이며 에이전트가 조사 목적에 맞춰 선택한다. 레퍼런스 없는 제작 요청에는 위의 리서치 우선 흐름을 적용한다. 사용 도구와 호출 순서를 일괄 고정하지 않으며 레퍼런스가 있는 작업까지 같은 탐색을 반복하지 않는다.

### 설치와 런타임

```sh
pnpm setup:research
pnpm setup:captcha
```

- Python 도구 설치에는 시스템 Python 3와 pip/venv가 필요하다. `setup:research`는 앱 상위 워크스페이스의 `.content-studio-research/python`에 Instaloader 4.15.3과 browser-cookie3 0.20.1을 설치한다. Node가 Python 워커를 실행하므로 별도 Python 서버가 필요하지 않다.
- YouTube.js와 Playwright는 npm 의존성이다. TikTok 수집은 설치된 Chromium을 사용한다. 오픈소스 저장소 전체를 앱에 복사하지 않고 어댑터로 연결한다.
- CAPTCHA는 선택 설치다. `setup:captcha`는 captcha-bypass v1.1.1의 플랫폼별 실행 파일·모델을 다운로드하고 `scripts/research/captcha-release.json`의 SHA-256을 검증한다. 자산은 `.content-studio-research/captcha`에 둔다. 유료 CAPTCHA 서비스나 API 키를 사용하지 않는다.
- 설치와 앱 실행에 동일한 `CONTENT_STUDIO_RESEARCH_RUNTIME_DIR`을 지정하면 런타임 위치를 변경할 수 있다. 실행 파일은 `CONTENT_STUDIO_RESEARCH_PYTHON`, `CONTENT_STUDIO_CAPTCHA_EXECUTABLE`의 절대 경로로 지정할 수 있다. CAPTCHA 모델은 실행 파일과 함께 설치한다. 설치용 Python 명령은 `CONTENT_STUDIO_PYTHON_BOOTSTRAP`으로 변경한다.
- Python 환경과 모델을 Next 소스 그래프에 넣지 않는다. 동적 네이티브 실행은 `turbopackIgnore`로 빌드 추적에서 제외하며 로컬 설치를 전제로 한다. 빌드 산출물만 복사하는 배포는 지원 범위가 아니다. 실행 환경과 `workers/instagram/collector.py`를 포함한 앱 체크아웃이 필요하다.

### 로그인 계정 연결

- 대시보드 **설정 → 리서치 계정 연결 → 로그인**은 macOS Safari에서 해당 플랫폼 로그인 페이지를 연다. 사용자가 Safari 기본 프로필에서 로그인·인증하고 Safari를 완전히 종료한 뒤 대시보드의 **로그인 완료**를 누르면 쿠키를 가져와 저장한다. 로그인에는 Chromium을 실행하지 않으며 검색에만 Chromium을 사용한다. 비밀번호·쿠키·토큰을 채팅으로 요구하지 않는다.
- macOS에서는 **Safari에서 가져오기**로 Safari 기본 프로필의 로그인 쿠키를 연결할 수 있다. Safari에서 해당 플랫폼에 로그인하고 완전히 종료한 뒤 사용한다. 가져오기는 명시적인 대시보드 동작에서만 실행하며 상태 폴링·MCP에서 Safari 파일을 자동으로 읽지 않는다.
- Safari 가져오기는 `workers/accounts/safari.py`가 로컬 쿠키 파일을 읽고 선택한 플랫폼 도메인의 유효 쿠키만 private pipe로 전달한다. `accounts/import`에서 검증한 뒤 기존 세션 저장소에 저장하고 다음 Chromium 컨텍스트에서 복원한다. Safari를 검색 브라우저로 사용하거나 개인 Chrome 프로필을 변경하지 않는다. 기존 컨텍스트는 저장 전에 닫으며 진행 중인 검색·세션 변경과 동시에 가져오지 않는다. 로그인 대기 중의 가져오기는 로그인 완료와 같은 동작이다.
- 파일 접근 거부·도구 미설치·로그인 쿠키 없음은 값이 제거된 오류로 표시한다. Safari 파일 접근이 거부되면 **시스템 설정 → 개인정보 보호 및 보안 → 전체 디스크 접근 권한**에서 서버 실행 앱(Codex 또는 터미널)의 권한을 확인하고 앱과 서버를 재시작한다. 이 권한은 다른 앱의 데이터에도 접근할 수 있는 넓은 권한이며 사용자가 직접 판단하고 변경한다. 별도 Safari 프로필·비공개 창·메모리에만 남은 쿠키는 지원하지 않으며 browser-cookie3가 제공하지 않는 SameSite는 Lax로 변환한다. 가져오기 성공은 유효 쿠키의 로컬 저장을 의미하며 플랫폼의 실제 인증 성공을 보장하지 않는다.
- 저장하는 것은 쿠키와 웹 저장소 인증 상태다. 사용자 브라우저의 프로필을 가져오거나 비밀번호를 저장하지 않는다. 소스 밖 런타임의 `accounts/{platform}.json`에 원자적으로 저장하고 디렉터리는 0700, 파일은 0600으로 제한한다. 인증 파일을 Git·프로젝트 DB·API/MCP 응답에 넣지 않는다.
- 연결 상태는 저장된 인증 쿠키를 기준으로 한다. 실제 검색 가능성까지 보증하지 않는다. 쿠키의 명시적 만료 또는 플랫폼의 명시적 로그인 요구 시 `login_required`로 표시한다. 일반 403·빈 검색 결과·요청 제한만으로 세션 만료를 단정하지 않는다.
- 앱의 로그인 대기 상태는 최대 10분 유지하며 취소·저장·연결 해제·시간 초과 때 해제한다. 사용자의 Safari 창을 자동으로 닫거나 Safari에서 로그아웃하지 않는다. 연결 해제는 해당 플랫폼의 진행 작업을 취소하고 앱에 저장한 쿠키와 전용 Chromium 컨텍스트를 제거한다.
- TikTok·Instagram 내부 검색은 연결된 계정이 필요하다. 기존 URL 수집은 연결되어 있으면 같은 쿠키를 사용하고, 연결이 없으면 기존 익명 수집을 시도할 수 있다. Instagram Python 수집에 전달하는 쿠키는 해당 플랫폼 도메인으로 제한한다.
- 계정 만료는 대시보드 설정과 사이드바, `get_research_accounts`, `get_collection_job.account`에 함께 반영된다. 재로그인 뒤 실패 작업을 재시도하거나 취소된 작업을 새로 시작한다.

### 수집 도구와 결과 읽기

| 도구 | 입력과 동작 |
| --- | --- |
| `search_social_candidates` | `platform`, `query`, `type: accounts/posts`, `limit`으로 플랫폼 내부 검색. 한 결과 페이지, 기본 10개·최대 30개. 외부 웹 검색으로 대체하지 않음 |
| `get_research_accounts` | 비밀 정보 없는 TikTok·Instagram 연결 상태 조회. 로그인 창을 열거나 인증을 갱신하지 않음 |
| `list_account_posts` | `accountUrl`, `limit`으로 계정 게시물 수집. 기본 10개, 최대 30개. YouTube는 커뮤니티 게시물 |
| `read_social_post` | 정규 게시물 `url`의 본문·미디어·공개 반응 수 수집. YouTube는 출처 `channelUrl`도 필요 |
| `get_collection_job` | `jobId`의 진행 상태·결과·실패 원인 조회 |
| `read_post_images` | 완료 작업의 `jobId`, `postId`, 0부터 시작하는 `imageIndexes`로 이미지 확인. 호출당 최대 3장 |
| `open_collection_browser` | 멈춘 TikTok 작업 또는 Instagram 검색의 기존 브라우저를 앞으로 가져오고 스크린샷 반환 |
| `solve_collection_captcha` | CAPTCHA가 확인된 TikTok 작업의 슬라이더·회전 해결 시도. 필요하면 컨트롤 선택자 지정 |
| `resume_collection` | 실패 작업을 원래 세션에서 재시도. 작업당 총 3회 제한 |
| `close_collection_session` | `sessionId`의 작업 취소·전용 브라우저 종료·결과와 커서 제거 |

- 수집 요청은 `jobId`와 `sessionId`를 먼저 반환한다. `get_collection_job`의 `running`, `complete`, `blocked`를 확인한다. 실행 중인 작업은 이후 다시 조회한다. 검색도 같은 작업 조회·종료 도구를 사용한다. 계정 검색은 `accounts`, 게시물 검색은 `posts`를 반환한다.
- URL은 정규 HTTPS Instagram/TikTok/YouTube 계정·게시물 URL을 사용한다. 단축 URL·다른 호스트·사용자 정보·별도 포트는 지원하지 않는다. 계정 페이지네이션은 같은 `accountUrl`·`sessionId`와 `nextCursor`를 사용한다.
- 레퍼런스의 선별 조건을 `criteria`로 명시한다. 지원 필드는 `format`, `minViews`, `minLikes`다. 기본 정책을 코드가 자동 주입하지는 않으므로 요청을 만들 때 기준 문서와 사용자 조건을 반영한다.
- `criteriaEvaluation`은 조건이 모두 확인되어 충족되면 `passed`, 확인된 값이 조건에 맞지 않으면 `failed`, 실패 조건은 없지만 필요한 수치가 없으면 `unverified`다. 주제 관련성은 에이전트가 본문·이미지를 확인한다.
- `metrics`는 좋아요·조회수·저장·댓글·공유 수를 반환하고 없는 값은 `null`이다. YouTube의 축약 수치는 `metricsAsDisplayed`도 확인한다. 댓글 본문·답글을 수집하지 않는다.
- `media`는 순서가 있는 URL 배열이다. `read_post_images`는 이미지 호스트와 크기를 검증해 MCP 이미지로 반환한다. OCR·사실 검증·프로젝트 자산 등록을 자동으로 수행하지 않는다. URL 만료 시 다시 수집한다.

```json
{
  "url": "https://www.tiktok.com/@account/photo/1234567890123456789",
  "criteria": { "format": "slideshow", "minViews": 100000 }
}
```

### 플랫폼 지원 범위와 실패 처리

| 플랫폼 | 수집 방식 | 현재 지원 범위 |
| --- | --- | --- |
| Instagram | 검색은 로그인 Chromium의 내부 검색 응답, URL 수집은 Instaloader HTTP | 계정·게시물 검색은 웹 SERP 지원 범위에 한정. 플랫폼이 지원 응답을 제공하지 않으면 `unsupported`. 저장 쿠키를 URL 수집에도 사용. 페이지네이션 미지원 |
| TikTok | 검색은 로그인 Chromium의 내부 검색 응답, URL 수집은 공식 플레이어·공개 프로필·creator embed | 계정·게시물 키워드 검색. creator embed 계정 수집은 제한된 최근 표본. 페이지네이션 미지원 |
| YouTube | YouTube.js의 InnerTube 검색·커뮤니티 피드 | 검색은 채널·영상이며 커뮤니티 게시물 직접 검색은 아님. 채널을 찾은 뒤 커뮤니티 목록 조회. 계정 피드 페이지네이션 지원. 개별 커뮤니티 게시물은 출처 채널 필요 |

- 공개 페이지와 비공식 인터페이스 변경에 영향을 받는다. 사용자가 연결한 로그인 세션만 사용하며 프록시는 자동으로 사용하지 않는다. 검색은 전용 Chromium에서 실행한다. Safari는 명시적인 쿠키 가져오기 출처로만 사용하며 사용자 Chrome 프로필은 사용하지 않는다.
- `block.reason`은 `captcha_required`, `login_required`, `rate_limited`, `access_denied`, `empty_response`, `unsupported`, `setup_required`, `timeout`, `not_found`, `source_error` 등을 구분한다. 401·403·빈 응답만으로 CAPTCHA라고 판단하지 않는다.
- TikTok의 전용 브라우저는 사용자의 기존 프로필과 별개다. 필요하면 `open_collection_browser`로 기존 창을 computer use에 넘긴다. 새 브라우저를 열면 원래 수집 세션에 반영되지 않는다.
- 로컬 CAPTCHA 도구는 확인된 도전만 처리한다. 컨트롤·원본 이미지가 인식되지 않거나 모델이 없으면 `unsupported_challenge`·`solver_unavailable` 등을 반환한다. `challenge_cleared`는 화면에서 도전이 사라진 상태이며 `resume_collection`의 수집 성공으로 복구를 확인한다. 실제 TikTok CAPTCHA 해결 성공률은 아직 검증하지 않았다.
- Instagram 검색은 전용 브라우저를 사용한다. Instagram Python HTTP 수집과 YouTube InnerTube 세션은 브라우저로 넘길 수 없다. 별도 브라우저에서 CAPTCHA를 처리하면 이 세션도 복구된다고 주장하지 않는다.
- 결과·커서는 서버 메모리에만 있다. 서버 재시작·명시적 종료·30분 비활성 후 제거된다. 최대 64개 작업을 유지한다. 브라우저는 Chromium 한 프로세스에 최대 3개 컨텍스트를 사용하며 플랫폼별 동시 작업은 하나로 제한한다. 작업 시간은 최대 60초, 성공 후 브라우저 유휴 시간은 60초, 확인된 CAPTCHA의 유휴 시간은 5분이다. 결과 조회는 브라우저 수명을 연장하지 않으며 마지막 컨텍스트가 닫히면 프로세스도 종료한다. 로그인 상태 파일은 결과 수명과 별개로 유지한다. 조사 종료 후 세션을 정리한다. 이 종료는 Content Studio 프로젝트 탭이나 사용자 브라우저를 닫지 않는다.

## 변경 검증

```sh
pnpm test
pnpm exec tsc --noEmit
pnpm lint
pnpm build
pnpm test:mcp
pnpm test:mcp --production
pnpm test:research
pnpm test:search
pnpm test:research-accounts --live-youtube
```

- 변경 범위에 필요한 검증을 선택한다. 문서만 바꾸면 링크·지침 일관성을 확인하며 앱 전체 테스트를 불필요하게 반복하지 않는다.
- `test:mcp`는 임시 DB·별도 포트의 실제 HTTP 클라이언트와 브라우저로 편집·복제·이미지·미리보기·되돌리기·자동 저장·탭 전환·stale-tab 거부·실패 복구·서버 재시작 후 복원을 검증한다. `--production`은 빌드 완료 후 실행한다. 기존 DB와 Codex 설정은 변경하지 않는다.
- `test:research`는 런타임 설치와 프로덕션 빌드 후 실행한다. 실제 HTTP MCP로 플랫폼별 개별 게시물과 마지막 슬라이드 이미지, YouTube 계정 페이지네이션, TikTok 브라우저 인계, 로컬 엔진의 합성 슬라이더 해결을 검증한다. 익명 Instagram/TikTok 계정 목록의 접근 결과도 출력한다.
- 실제 플랫폼 접근 검증은 네트워크·게시물 상태·플랫폼 차단에 영향을 받는다. 합성 CAPTCHA 테스트를 실제 플랫폼 CAPTCHA 해결의 증거로 보고하지 않는다. 정적 검사, 실제 MCP 동작, 화면 확인 결과를 구분해 보고한다.

- `test:search`는 합성 플랫폼 응답을 실제 Chromium에 제공해 로그인·쿠키 복원·검색 응답·인증 거절·유휴 프로세스 종료를 검증한다. 실제 TikTok·Instagram 로그인 검색 성공의 증거는 아니다.
- `test:research-accounts`는 빌드 후 임시 DB·인증 폴더로 실제 대시보드와 HTTP MCP의 만료 상태·연결 해제·Origin 보호를 검증한다. `--live-youtube`는 실제 내부 채널 검색도 검증한다. 사용자 인증 폴더를 테스트에 사용하지 않는다.

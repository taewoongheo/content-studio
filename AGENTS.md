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

## 콘텐츠 제작의 범위

- 자동 제작의 분석·방향·조사·참고 이유·콘텐츠·최종 요약은 영어로 저장한다. 서버가 비영어로 감지한 값은 거부하므로 해당 필드를 영어로 고쳐 다시 저장한다. 생산기의 한국어는 화면용 번역이며 제작 입력이나 원본에 사용하지 않는다.
- 자동 제작은 콘텐츠별 분석 단계에서 소재·답·표현 방향을 정하고 단계별 draft를 저장한다. 시각적 방향은 과거 게시글과 선별 레퍼런스의 실제 이미지를 참고한다. `create_project`는 새 게시글을 생성한다. `clone_project`는 사용자가 지정한 기존 게시글을 독립 사본으로 복사하는 수동 경로다.
- 제작할 내용은 사용자 요청이나 별도의 콘텐츠 기획에서 정한다. 내용이 정해지지 않았다면 필요한 주제·핵심 메시지를 확인한다. 기존 게시글의 내용을 새 콘텐츠의 주제로 간주하지 않는다.
- 정한 내용의 제작·검토 기준은 [콘텐츠 제작 가이드](docs/content-guidelines.md)를 따른다. 리서치는 [리서치 가이드](docs/research-guidelines.md)를 따른다.

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
- 앱은 Next.js·React 기반의 로컬 시각 편집기다. 콘텐츠 제작 화면은 외부 Codex CLI를 단계별로 실행한다. 폴리싱 대화는 별도 데스크탑에서 진행한다.
- DB·편집 상태·리서치 작업은 로컬 단일 서버 프로세스를 기준으로 한다. 여러 서버 프로세스나 서버리스 배포를 지원한다고 가정하지 않는다.
- 기존 작업 트리의 브랜치·미커밋 변경을 먼저 확인하고 관련 없는 변경을 보존한다.
- 개발은 원본 폴더 `/Users/taewoongheo/Projects/content-studio-workspace/content-studio`에서 `feat/*` 브랜치를 만들어 진행한다. 사용자가 별도로 요청하지 않으면 새 worktree나 작업 폴더를 만들지 않는다.
- `pnpm test:mcp`는 임시 DB·리서치 런타임·Next 빌드 폴더를 분리해 실행 중인 개발 서버와 충돌하지 않는다. 별도 빌드 검증에는 `CONTENT_STUDIO_DIST_DIR=.next-validation pnpm build`처럼 프로젝트 안의 빌드 폴더를 지정한다. 같은 빌드로 실행하려면 `pnpm start`와 `test:mcp --production`에도 동일한 값을 전달한다.

## 생성 파일과 임시 작업

- `output/`을 프로젝트 저장소나 콘텐츠 제작 작업 폴더로 사용하지 않는다. 생성 이미지·영상, 미리보기, MCP 요청/응답 JSON과 일회성 스크립트를 소스 저장소에 남기거나 커밋하지 않는다.
- 파일 경로가 필요한 제작 단계는 시스템 임시 폴더 안에 작업별 경로를 만들고 사용한다. 프로젝트에서 사용할 미디어는 API/MCP로 가져와 DB 저장을 확인한 뒤 직접 만든 임시 파일을 정리한다. 생성 도구가 관리하는 원본 폴더를 임의로 삭제하지 않는다.
- 사용자가 요청한 최종 다운로드·내보내기 파일은 지정한 위치에 저장한다. 편집 상태는 메모리, 저장 프로젝트와 사용 자산은 DB에서 관리하며 제작 중간 파일을 영구 보관할 필요가 있다고 가정하지 않는다.

## 프로젝트와 편집 상태

- UI의 새 편집기는 4:5 (1080 × 1350), 6장으로 시작한다. 화면 비율은 편집기 상단에서, 장 수는 추가·삭제로 조정한다. 자동 제작은 분석에서 정한 내용으로 새 프로젝트를 만든다.
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
| `set_content_metadata` | 개별 콘텐츠의 주제·메시지 저장 |
| `clone_project` | 기존 게시글을 독립 사본으로 복사 (`projectId`) |
| `create_project` | 소재·메시지가 정해진 게시글을 생성·저장 |
| `production_query`, `production_read_images` | 과거 게시 로그·사용자 선별 사례 조회와 보존 이미지 확인 |
| `production_read_project`, `production_preview_project` | 참고 게시글의 DB 저장 문서·이미지 조회. 편집기 탭을 열지 않음 |
| `edit_project` | 편집 명령 배열을 한 묶음으로 적용 |
| `undo_project` | 직전 편집 묶음 되돌리기 |
| `preview_slide` | 기존 단일 슬라이드 전체 해상도 PNG 확인 |
| `preview_slides` | 여러 장을 한 번에 축소 미리보기, 생략하면 전체 장 확인 |
| `rename_project` | 슬라이드쇼 이름만 변경 |
| `export_slideshow` | 전체 슬라이드를 PNG ZIP으로 내보내는 작업 시작 |
| `get_render_job`, `cancel_render_job` | 영상/슬라이드쇼 내보내기 상태 조회·취소 |


- `read_project`는 기본적으로 기존 전체 응답을 유지한다. `slideIds`·`elementIds`는 조회 범위를 좁히고 해당 문서에 `partial: true`를 표시한다. `outline: true`는 스타일 없는 내용·ID 개요를, `includeAssets: false`는 자산 메타데이터 생략을 제공한다. 존재하지 않는 ID는 거부한다. `edit_project`의 `includeDocument: false`는 전체 문서 대신 최신 revision과 결과 ID 요약을 반환하며, 기본값은 기존 전체 응답이다.
- `preview_slides`의 `slideIds`를 생략하면 전체 장을 확인한다. 기본 너비 540px, 64~1920px 범위이며 원본보다 확대하지 않는다. 렌더러 코드·프로젝트·탭·revision·크기에 따라 바이트 한도 내에서 결과를 재사용한다. 브라우저는 작업 간 재사용하고 유휴 시 종료한다. 기존 `preview_slide`는 전체 해상도 PNG 응답을 유지한다.
- `export_slideshow`는 최신 `expectedTabId`·`expectedRevision`, 절대 `.zip` `outputPath`를 받는다. 요청 시점의 문서·이미지를 캡처하고 작업 ID를 즉시 반환한다. `get_render_job`을 1~2초 간격으로 조회하고 `completed`의 `result.outputPath`·`bytes`를 확인한다. `failed`에는 오류가 있고, `cancel_render_job` 후 최종 상태를 다시 확인한다. 완료 메타데이터는 최대 40개·15분 보관하며 서버 재시작에는 초기화된다. 출력 폴더는 이미 있어야 하고 덮어쓰기는 `overwrite: true`가 필요하다. 취소·실패는 기존 파일을 보존한다.
- `edit_project`와 `undo_project`에는 최신 읽기·쓰기 응답의 `expectedRevision`과 `expectedTabId`를 사용한다. 닫힌 작업이나 이전 탭 ID는 거부된다. 다시 연 작업은 다시 읽고 최신 값을 사용한다.
- Element 공유 누락 검증은 문서 쓰기 배치·되돌리기·프로젝트 복제의 최종 문서에서 한 번 실행한다. 읽기·미리보기·이름·메타데이터 변경은 검증하지 않는다. 결과의 `warnings`는 경고이며 저장을 차단하거나 자동 병합하지 않는다. 비교 조건·허용치는 `src/domains/slideshow/editor/inspection/shared-elements.ts` 한 곳에서 관리한다. `includeDocument: false`에서도 경고를 반환한다.
- `set_slide_role`은 페이지의 `hook`·`body`·`cta` 역할을 변경하며 시각 요소는 유지한다. `remove_element`는 배치에서 사용하지 않는 일반 Element 정의만 삭제한다. 사용 중이거나 배경인 정의는 거부하며 둘 다 기존 배치 저장·되돌리기 계약을 따른다.
- `rebind_element`는 `slideId`·`placementId`·대상 `elementId`를 받아 같은 종류의 Element로 다시 연결한다. 내용·부분 텍스트 스타일·레이어 순서·실제 외형을 보존하며 차이는 개별 덮어쓰기로 남긴다. 일반 편집과 같은 저장·되돌리기 계약을 따른다. 경고 해석과 배치 작성 기준은 [제작 가이드](docs/content-guidelines.md#3-내용에-맞게-구조와-배치를-만든다)를 따른다.
- 편집 명령 배열은 한 단계로 되돌린다. 실패한 묶음은 문서·revision·되돌리기 이력과 신규 이미지 등록을 복구한다. `clone_project`, `edit_project`, `undo_project`는 DB 저장 성공 후 성공을 반환한다.
- 읽기·열기·미리보기는 자동 저장하지 않는다. MCP 생성·복제·명시적 열기는 탭을 추가하며 브라우저 화면을 강제로 전환하지 않는다. 프로젝트 삭제·탭 닫기는 MCP로 제공하지 않는다.
- `create_project`·`clone_project`·`create_video_project`·`clone_video_project`·`export_slideshow`·`start_video_export`·`export_video`는 선택적 `requestId`(1~128자)를 지원한다. 새 작업에는 고유 ID를 만들고, 응답 유실/연결 재시도에는 같은 도구·ID·인자를 그대로 사용한다. 동시 요청과 다른 MCP 연결에서도 최초 성공/실패 응답을 재사용하며 같은 ID로 인자를 바꾸면 `REQUEST_ID_REUSED`를 반환한다. 수정한 요청이나 실패한 렌더링을 새로 실행하려면 새 ID를 사용한다. 기록은 서버 메모리에 완료 후 1시간 유지하며 서버 재시작 시 사라진다. 재시작·만료 후 재요청은 중복 방지를 보장하지 않으므로 프로젝트/작업 목록을 먼저 확인한다. 기록 256개 또는 완료 응답 합계 32MiB에 도달하면 기존 기록을 밀어내지 않고 새 ID 요청을 `REQUEST_CACHE_FULL`로 거부한다. 이미 실행 중인 응답이 완료되면서 바이트 기준을 초과할 수 있다. `requestId` 생략 시 기존 동작을 유지한다. 재사용 응답은 최초 스냅샷이며 현재 상태는 다시 읽어야 한다. 내보내기 작업 메타데이터 보관 기간(15분·최대 40개)은 별도이므로 반환된 작업 ID를 즉시 조회한다.
- MCP 도구 오류는 기존 `isError`·텍스트 문구와 함께 `structuredContent.error`의 `code`·`message`·`details`·`recovery`를 반환한다. 스키마 오류의 `details.issues`에는 필드 경로와 제한값/허용값이 있다. 실행 중 명령 오류는 `commandIndex`(0부터)·`commandType`·대상 ID를 제공한다. `REVISION_CONFLICT`·`TAB_CONFLICT`는 최신 상태를 다시 읽고, `PROJECT_NOT_OPEN`은 명시적으로 연 뒤 다시 읽는다. 오류 문자열을 파싱해 복구하지 않는다.
- 에이전트는 앱 DB에 직접 쓰지 않는다. 저장과 편집은 앱 API/MCP를 사용한다.

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

과거 게시글과 선별 레퍼런스의 실제 이미지를 참고해 내용에 맞는 스타일을 정한다. 아래는 지원 글꼴과 역할이다.

| 역할 | `fontFamily` | 지원 굵기 |
| --- | --- | --- |
| 훅·CTA 페이지의 강조 제목 | `oswald` | 700 (Bold) |
| 본문 페이지 전체·일반 설명 | `inter` | 100–900, 권장 400–500 |

- 지원 글꼴은 Oswald와 Inter 두 개뿐이며 새 텍스트는 Inter로 시작한다. 별도 Fallback 글꼴은 제공하거나 로딩하지 않는다.
- `update_visual`의 `fontStyle`은 `normal` 또는 `italic`이다. Inter는 실제 이탤릭, Oswald는 합성 기울임을 사용한다. 편집기·미리보기·내보내기는 같은 렌더링을 사용한다.
- 이전 문서의 Anton·Bebas Neue·Barlow Condensed는 Oswald, Space Grotesk·Geist(sans-serif)·Source Sans 3·명조·고정폭은 Inter로 정규화한다. `anton`을 새 편집 명령의 지원 글꼴로 안내하지 않는다.
- 지원 목록의 원문은 `src/domains/slideshow/editor/typography/fonts.ts`, 실제 로딩은 `src/app/layout.tsx`에서 확인한다.

## 저장 데이터와 구현 경계

- SQLite 기본 위치는 `/Users/taewoongheo/Projects/content-studio-workspace/content-studio.sqlite`로 고정한다. 실행 폴더·브랜치·포트에 따라 경로를 바꾸거나 새 DB를 만들지 않는다. 검증용 DB는 `CONTENT_STUDIO_DB_PATH`의 절대 경로로만 분리한다.
- 프로젝트 문서와 사용 이미지 바이트·메타데이터를 프로젝트별로 저장한다. 사용 이미지는 `content_project_assets`에서 관리한다. 외부 파일 이동·삭제는 저장된 프로젝트에 영향을 주지 않는다.
- 복제는 문서와 이미지 사본을 함께 복제하고, 프로젝트 삭제는 해당 프로젝트의 이미지 사본도 삭제한다. 공용 이미지·캐릭터 라이브러리를 전제로 구현하지 않는다.
- 편집 중 문서·이미지·되돌리기 이력은 서버 메모리에 유지한다. API와 MCP가 같은 작업 레지스트리와 저장 로직을 사용한다.
- DB v17에서 슬라이드쇼는 `content_projects`와 `content_project_assets`, 콘텐츠 생산은 로그·단계별 draft·선별 레퍼런스·이미지 보존본을 소유한다. 영상 테이블은 별도로 유지한다. 각 도메인이 스키마를 관리하며 공용 DB 모듈은 연결·버전 확인·스키마 적용만 담당한다.
- 프로젝트의 `topic`은 개별 콘텐츠의 주제, `message`는 구체적인 핵심 내용이다. 빈 임시 프로젝트는 필수 입력을 강제하지 않지만 제작 완료 전에는 주제·메시지가 필요하다.
- 게시 상태는 `content_creation_logs.post_url`과 `actual_published_at`으로 관리한다. 사용자가 URL을 등록하면 Apify로 실제 게시 시각·성과·전체 슬라이드 축소본을 가져온 뒤 생명주기를 완료한다. 달력은 이 로그를 한국 날짜로 표시한다. 별도의 수동 게시 버튼과 프로젝트 게시 시각은 없다.

- 구형 DB는 서버 시작 시 변환하지 않고 거부한다. 이 로컬 개발 전환에는 별도 마이그레이션 명령을 유지하지 않는다. DB 직접 변환은 사용자의 명시적 요청이 있을 때만 서버를 종료한 뒤 수행하고 자산·외래키·기존 게시글 보존을 확인한다. 일반 콘텐츠 편집은 API/MCP를 사용한다.

- MCP 등록은 `src/lib/mcp/server.ts`, 프로젝트 도구는 `src/lib/mcp/tools/projects.ts`, 리서치 등록은 `src/lib/mcp/research/tools.ts`, 조회·검색·이미지는 `research/tools/gather`, 작업 상태·종료는 `research/tools/control`에서 확인한다. UI → 명령 → 저장 경로를 추적해 실제 동작을 검증한다.

## 영상 편집

- 편집기 열기에서 `slideshow` / `video`를 선택하고 유형별 저장 프로젝트와 열린 탭을 표시한다. 영상은 독립된 Remotion 편집기이며 슬라이드 문서·placement 모델에 맞추지 않는다.
- 영상 편집기의 상단 프로젝트 액션·저장 상태·내보내기 문구, 왼쪽 선택 항목 편집, 오른쪽 Element 추가·복제·제거·드래그 레이어 배치는 슬라이드쇼와 맞춘다. 공통 위치·크기는 UI에서 %로 표시하되 영상 문서에는 px로 저장한다. 연결 영상의 `sequenceIndex`는 재생 순서이며 문서 배열의 레이어 순서와 독립적이다. 레이어 이동은 재생 시점·순서를 바꾸지 않고, 타임라인의 클립 이동은 재생 순서만 바꾼다. 이어붙이기는 오디오·텍스트까지 포함한 전체 끝에 추가하며, 다른 요소 뒤에 시작하는 연결 클립은 `sequenceStart`에 시작 기준을 보존한다. 빈 프로젝트의 첫 MP4는 0초에서 시작한다.
- 영상 문서 검증과 프레임 계산은 `src/domains/video/domain/model.ts`, 타임라인 편집은 `domain/editing.ts`, FPS 변환은 `domain/settings.ts`, 저장·열린 탭·revision 가드는 `src/domains/video/server`, 미리보기와 MP4의 공통 구성은 `src/domains/video/remotion`에서 관리한다. 영상 UI는 `src/screens/video-editor`다.
- 새 영상의 기본 배경은 흰색이다. 캔버스에 영상·이미지 파일을 여러 개 드롭하면 독립 요소로 추가한다. 미디어의 모서리 핸들은 기본적으로 비율을 유지하며 Shift로 비율을 해제한다. 안전 영역과 정렬 가이드는 편집 오버레이로만 표시하고 내보내기에 포함하지 않는다.
- 영상 이어붙이기는 `sequence` 클립의 순서·자르기 후 시작 시점을 다시 계산한다. 영상 요소는 독립된 시작 시점과 프레임을 사용하며 여러 개를 동시에 재생할 수 있다. 모든 요소는 시작 시점·표시 시간을 갖고, 화면 요소는 뒤에서 앞으로 레이어 순서대로 그린다.
- 영상 API는 `/api/video-projects` 아래에서 생성·열기·revision 검사 저장·이름 변경·복제·삭제·자산·내보내기를 제공한다. 기존 MCP 슬라이드 도구는 슬라이드쇼 전용이며, 영상은 아래 별도 MCP 도구를 사용한다. UI/API/MCP는 영상 세션·revision·저장 로직을 공유한다. 에이전트는 DB를 직접 편집하지 않는다.
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

선별 정책은 [리서치 기준](docs/research-guidelines.md)을 먼저 읽는다. 분석·제작 중 필요한 자료를 조회하고, 기존 자료로 충분하면 재사용한다.

### 게시 정보와 사용자 지정 레퍼런스: Apify

- `APIFY_API_TOKEN`은 서버 환경 변수로 설정한다. 운영 TikTok 계정의 로그인·쿠키를 사용하지 않는다.
- 소재는 과거 게시 로그와 인터넷·커뮤니티 조사로 정하고, 표현 방식은 과거 게시글과 사용자가 직접 등록한 선별 레퍼런스를 참고한다. 자동 TikTok 검색·게시글 수집 도구는 제공하지 않는다.
- `production_read_images`로 지정 레퍼런스와 실제 게시 당시의 보존 이미지를 확인한다. 외부 URL 등록은 사용자의 레퍼런스 등록 동작에서만 수집한다.
- 과거 게시 로그와 선별 레퍼런스는 `production_query`로 조회한다. 자체 게시글은 기존 미리보기를 사용한다.
- 게시 URL 등록과 최근 성과 갱신도 같은 Apify 클라이언트를 사용한다. 확인되지 않은 수치는 `null`로 유지한다.
- TikTok·Instagram의 로그인, Safari 쿠키 가져오기, 로컬 브라우저 검색·수집, Python 워커와 CAPTCHA 처리는 제공하지 않는다. Instagram을 수집할 대체 경로는 현재 없다.

### 제작 중 필요한 조사: 웹 검색

- 분석에서는 인터넷·커뮤니티에서 소재 후보와 독자의 상황을 조사한다. 이후 단계에서는 필요한 질문이 있을 때만 추가로 조사한다. 모두 조사하거나 종류별로 구분해 저장하지 않는다.
- 제작용 CLI 실행에만 `-c web_search="live"`를 전달한다. 전역 Codex 설정과 파일 쓰기 권한은 변경하지 않는다. 설정 계약은 [OpenAI 공식 문서](https://learn.chatgpt.com/docs/web-search)를 따른다.
- 기존 research 항목에 질문·출처·발견 내용·판단을 저장한다. 출처와 판단 기준은 [리서치 기준](docs/research-guidelines.md)을 따른다.
- 일반 웹 검색은 소재 후보 탐색과 현재 내용의 질문 확인에 사용한다. TikTok·Instagram 내부 검색·피드 수집과 외부 시각 레퍼런스 자동 발굴은 추가하지 않는다.

### YouTube: 로그인 없는 일반 조회

YouTube.js의 InnerTube를 사용한다. 자동 제작 에이전트의 도구에는 포함하지 않으며 일반 MCP에서 명시적으로 사용할 수 있다.

| 도구 | 입력과 동작 |
| --- | --- |
| `search_social_candidates` | `platform: youtube`, 검색어, `type: accounts/posts`, 최대 30개. 채널 또는 영상 검색 |
| `list_account_posts` | 공개 채널의 커뮤니티 게시물. 같은 세션과 커서로 페이지네이션 |
| `read_social_post` | 개별 커뮤니티 게시물. 원본 채널 `channelUrl` 필요 |
| `get_collection_job` | 작업 상태·결과·실패 원인과 조건 충족 여부 조회 |
| `read_post_images` | 완료 작업의 게시물 이미지 확인. 호출당 최대 3장 |
| `resume_collection` | 실패 작업 재시도. 작업당 총 3회 제한 |
| `close_collection_session` | 해당 작업 취소, 결과·커서 제거 |

- 검색은 채널·영상을 반환하며 커뮤니티 게시물 직접 검색은 아니다. 채널을 찾은 뒤 커뮤니티 목록을 조회한다.
- `criteria`로 형식·최소 조회수·좋아요 조건을 전달할 수 있다. 누락된 수치는 조건 충족으로 간주하지 않는다. 축약 수치는 원본 표시도 확인한다.
- 댓글 본문·답글은 수집하지 않는다. 결과·커서는 서버 메모리에만 유지하며 서버 재시작·명시적 종료·30분 비활성 후 제거한다.
- 최대 64개 작업, 요청당 최대 60초다. 사용을 마치면 세션을 종료한다. 브라우저·쿠키 저장소나 별도 설치는 필요 없다.

## 변경 검증

```sh
pnpm test
pnpm exec tsc --noEmit
pnpm lint
pnpm build
pnpm test:mcp
pnpm test:mcp --production
```

- 변경 범위에 필요한 검증을 선택한다. 문서만 바꾸면 링크·지침 일관성을 확인하며 앱 전체 테스트를 불필요하게 반복하지 않는다.
- `test:mcp`는 임시 DB·별도 포트의 실제 HTTP 클라이언트와 브라우저로 편집·복제·이미지·미리보기·되돌리기·자동 저장·탭 전환·stale-tab 거부·실패 복구·서버 재시작 후 복원을 검증한다. `--production`은 빌드 완료 후 실행한다. 기존 DB와 Codex 설정은 변경하지 않는다.
- 리서치 검증은 Apify 클라이언트의 요청·응답 처리, YouTube 작업의 재시도·취소와 MCP 계약을 확인한다. 합성 응답을 사용한 검증을 실제 플랫폼 접근 성공으로 보고하지 않는다.

## 콘텐츠 제작 실행

- `src/domains/content-production`은 작업·단계별 draft, 확정 로그, 선별 레퍼런스, 실행 제어와 게시 연결을 소유한다. 단계는 analysis → production → hook → visual 순서로 고정한다. 각 단계 지침은 docs/production-prompts/의 Markdown에서 관리하고 공통 지침과 합친다.
- 실행 도구는 작업별 MCP 주소와 실행 토큰으로 제한한다. 분석에는 편집기 열기·읽기·미리보기를 제공하지 않는다. 참고 게시글은 production_read_project / production_preview_project로 DB 저장본을 읽는다. 제작·검토의 일반 편집기 도구도 해당 작업 프로젝트만 열고 읽고 수정할 수 있다. hook은 훅 슬라이드의 텍스트와 local 배치만, visual은 배치·스타일만 수정한다. 검토 단계는 새 프로젝트 생성·방향 변경·이전 단계 undo를 제공하지 않는다. 중간 저장과 상태 변경은 앱 API/MCP를 사용한다.
- 훅·시각 검토는 해당 실행에서 실제 참고 이미지 조회와 최신 저장본 전체 슬라이드 미리보기를 확인해야 통과한다. review_passed가 true이고 시각 검증까지 끝나야 finished가 된다. 실패 시 해당 단계에서 중단하며 재개할 수 있다. 현재 CTA는 콘텐츠와 관련된 짧은 팔로우 유도로 작성한다.
- 서버의 `APIFY_API_TOKEN`으로 공개 TikTok 자료를 수집하며 운영 계정 쿠키를 사용하지 않는다. 키를 프롬프트나 클라이언트로 보내지 않는다.
- 분석 자료 노드를 누르면 오른쪽에서 성과 상위 10개·하위 10개·최신 10개(앞 그룹과 중복 제외)의 실제 수치·관측 시각·활용 근거를 확인한다. 최신 갱신 실행의 성공·실패와 결과는 서버 메모리에 유지한다. 서버 재시작 후에는 DB 최신 성과와 남은 분석 draft의 출처를 표시하며 과거 실행의 갱신 결과로 단정하지 않는다.
- 제작용 모델 기본값은 `gpt-5.6-sol`이며 콘텐츠 제작 화면 하단에서 변경한다. 설정은 작업공간의 `.content-studio-production/settings.json`에 저장하며 전역 Codex 설정은 변경하지 않는다. 검증에서는 `CONTENT_STUDIO_PRODUCTION_RUNTIME_DIR` 절대 경로로 설정 파일을 분리한다.
- `CONTENT_STUDIO_CODEX_BIN`은 실행할 CLI 경로를 지정한다. 일반 실행은 `codex`를 사용한다. 자동 검사에서만 격리된 실행 fixture를 사용할 수 있고 실제 모델 제작 성공과 구분한다.
- `production_context`, `production_save_draft`, `production_comparisons`, `production_change_direction`, `production_create_project`, `production_import_image`는 실행 중인 작업 전용 MCP에서만 제공한다. 단계 완료는 서버 실행기가 필수 출력·저장·실제 이미지 검토를 검사해 처리한다.
- 캔버스 하단 초기화는 확인 후 모든 제작 작업을 중단하고 draft·연결된 미게시 프로젝트와 이미지를 삭제한다. 게시 콘텐츠·일반 저장 프로젝트·선별 레퍼런스는 보존한다. 성과 갱신 중에는 초기화를 막는다.
- 취소·제거는 실행 권한과 프로세스를 종료하고 작업 전체 및 모든 단계 draft를 삭제한다. 중단은 저장 내용을 유지한다. 게시 콘텐츠 중복 범위는 최근 24시간이고 성과 갱신 범위는 한국 날짜 오늘~3일 전이다.
- DB v17는 구형 템플릿 저장소와 프로젝트 게시 컬럼을 사용하지 않는다. 기존 DB를 자동 변환하지 않는다. 직접 변환은 사용자가 명시적으로 요청했을 때만 수행하고 프로젝트 문서·자산 보존과 외래키를 확인한다.

- 소재 판단용 `production_query(kind="logs")`는 `post_url`이 등록된 로그만 반환한다. 미게시 작업은 중복 확인을 위한 `production_comparisons`로 읽는다. 제작 중 문서·이미지는 content_drafts.project_id로 연결한다. 편집기로 열 수 있지만 대시보드 모든 콘텐츠에서는 제외한다. 게시 URL 조회·저장이 성공하면 연결을 로그로 옮기고 모든 단계 draft를 삭제한다. 남은 draft가 하나라도 있으면 새 제작을 막는다. 로그 행은 작업 시작 때 확보하되 게시 전 project_id는 비워둔다. 기존에 저장된 일반 게시글은 보존한다.

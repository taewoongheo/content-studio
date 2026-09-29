# Content Studio

Content Studio is a local-first workspace for producing publishable content from a product context and references. It reduces the need to repeat product details, describe visual direction from scratch, and rebuild generated results manually.

## Roadmap

| Stage | Goal | Scope |
| --- | --- | --- |
| **1 — Production MVP** | Complete one piece of content quickly | Slideshow, video, text, three creation methods, product context, proposals and choices, conversational AI editing, save and recovery, export |
| **2 — Repeatable operations** | Reuse validated workflows across content and accounts | Reusable formats, multiple content jobs, account-level content management and distribution |
| **3 — Automated decisions** | Reduce the work required to decide what to make | Relevant content and format discovery, topic and format recommendations, and feedback into later decisions |

Stage one includes slideshow, video, and text content with reference-based, template-based, and from-scratch creation. The three content types are media types; references and templates define the format. Their inputs and production steps can differ.

## Current implementation

```text
Select product context
→ Choose content type and creation method
→ Upload reference images for a TikTok slideshow
→ Open the visual editor with AI-analyzed slides and Elements
→ Discuss and select a topic in chat; fill the body slots
→ Discuss and select a hook
→ Edit slides directly or ask AI to edit them
```

This is the implemented reference-based slideshow flow. Slides, Element styles and positions, and slot values are stored as a JSON editing document in server memory. Uploaded editor images and their metadata are stored together in local SQLite. The editor renders a browser preview but does not yet export finished image files. Other content types and creation methods remain visible as product choices but are not implemented as generation flows.

The dashboard also has a **Published Content** page with a calendar and bounded, scrollable list in one view. It reads published records from local SQLite without manual entry; removing a record deletes only the local DB entry, not the post on TikTok or another platform. A future publishing flow must write the record for it to appear here. The **Image Assets** page manages reusable images and characters. Creating a character requires a description and one turnaround image, stored together in SQLite. Other uploads are general images; the character's turnaround is identified by its asset ID without a separate image category. Both pages read from local SQLite on entry and refresh after changes.

## 목표 편집 방식: 포맷 기반 카피

이 제품에서 카피할 대상은 레퍼런스의 문구 자체가 아니라 **시각적 구조와 표현 규칙**이다. 레퍼런스 이미지로부터 초안을 만든 뒤, 같은 포맷의 역할과 스타일을 유지하면서 새로운 주제와 내용을 채운다. 목표는 매번 레이아웃을 다시 설명하거나 결과물을 수작업으로 재조립하지 않고, 반복 가능한 포맷을 편집기에서 바로 확인·활용하는 것이다.

초기 입력 후에는 별도의 분석·전략·본문·훅 페이지를 차례로 거치지 않고 편집기를 연다. AI가 레퍼런스 이미지를 분석해 슬라이드와 Element의 시각적 초안을 만들며, 사용자는 실제 화면을 보면서 틀린 분석을 고친다. 이때 Element의 실제 내용은 모두 비워 두고, 캔버스에는 짧은 역할명만 안내로 표시한다. 내용은 채팅에서 주제와 흐름을 정한 뒤 채운다.

레퍼런스 방식에서는 게시물의 모든 슬라이드 이미지를 순서대로 업로드한다. 업로드한 이미지 수가 초안의 장수가 되며, 반복형은 첫 장을 훅, 마지막 장을 CTA, 그 사이를 본문으로 분석한다. 시각적 형태와 역할이 반복되는 단위는 하나의 Element로 정의해 여러 장에 배치하고, 각 장의 위치·스타일 차이는 배치별 값으로 보존한다. 각 배치의 실제 텍스트·이미지 내용은 독립된 빈 슬롯에서 나중에 채운다.

### 슬라이드와 Element

- **슬라이드**는 한 장의 완성 화면이다. 반복형 슬라이드쇼는 훅 1장, 본문 n장, CTA 1장으로 시작한다. 장면별 구성도 같은 편집 모델을 사용하되 본문 각 장의 구성은 달라질 수 있다.
- **Element**는 스타일과 의미를 함께 가진 시각적 단위다. 슬라이드 밖에 저장하며, 화면에 보이는 **레이어**와 그 레이어에 채울 **콘텐츠 슬롯**을 함께 포함한다. 레이어는 기본 위치·스타일을, 역할·의미는 이 자리에 어떤 내용이 들어가야 하는지까지 설명한다. 예를 들어 `동작 이름`, `동작 이미지`, `설명`, `CTA 문구`가 각각 Element가 될 수 있다. 레이어와 슬롯은 별개로 슬라이드에 배치하지 않는다.
- **배경**도 모든 슬라이드에 공유 배치되는 기본 Element다. 내용 슬롯이 없는 예외이며 삭제할 수 없다. 기본 적용 범위는 전체이고, 필요한 장만 색을 다르게 할 때는 같은 배경 Element의 장별 색상 설정을 사용한다.
- 슬라이드에는 Element를 복제해 배치한다. 배치된 Element의 슬롯에는 그 장의 실제 텍스트·이미지를 채운다. 따라서 같은 역할과 스타일의 Element를 여러 장에서 재사용하면서 내용은 장마다 달리할 수 있다. 복제하면 선택한 장에만 새 공유 Element가 만들어지고, 장마다 다른 슬롯 내용도 함께 복제된다.
- Element의 적용 범위는 편집기 가운데 Element 영역에서 고른다. 기본은 해당 Element가 있는 장 전체이며, 일부 장만 선택할 수도 있다. 현재 보고 있는 장은 항상 포함된다. 이 범위는 위치·스타일 수정과 복제·제거에 공통으로 적용된다. 일부 선택은 바꾼 속성만 해당 장에 적용하고, 전체 선택에서 위치를 바꾸면 기존 개별 위치 설정을 통일한다. 내용은 현재 장에서만 수정한다.
- Element는 독립적으로 재사용되므로 슬라이드별로 필요한 Element를 더하거나 뺄 수 있다. 텍스트·이미지와 사각형·원형·삼각형 도형을 추가할 수 있다. 모든 본문 슬라이드가 같은 Element 목록을 가져야 하는 것은 아니다.

Element의 역할만 맞는다고 슬라이드 전체가 완성되는 것은 아니다. 여러 Element를 조합한 후에는 배치 충돌·영역 이탈·텍스트 넘침을 확인하고, AI가 한 장 전체를 읽어 내용의 중복, 시각적 위계, 앞뒤 슬라이드와의 연결을 검토한다. 이 검토는 사용자 편집을 몰래 덮어쓰지 않고 수정 제안으로 보여준다.

### 대화와 내용 채우기

편집기 옆에는 AI 대화창을 둔다. 페이지를 열면 배경을 제외한 첫 Element가 선택되고, 다른 Element가 없는 장에서는 배경이 선택된다. 슬라이드 또는 하단 목록에서 Element를 선택하면 왼쪽 편집 영역에서 역할, 내용, 위치, 스타일을 직접 고칠 수 있고 변경은 자동 저장된다. 빈 영역을 선택하면 배경 Element의 색을 편집한다. 레퍼런스에서 추출한 포맷 규칙은 이후 AI 생성의 내부 맥락으로 유지하지만 별도 편집 UI는 제공하지 않는다. 대화창의 `주제 제안`, `훅 제안` 버튼은 현재 편집 상태를 바탕으로 제안을 만든다. 제안은 대화 안에서 클릭 가능한 선택지로 표시하고, 사용자가 선택·확정한 것만 편집기에 반영한다.

화면은 처음부터 편집기지만 내용 생성의 의존성은 유지한다. 주제를 확정하고, 본문 전체의 흐름과 내용을 구성한 다음, 그 내용을 뒷받침하는 훅을 고른다. AI는 확정된 내용을 각 슬라이드의 Element 역할에 맞춰 채운다. 한 장의 내용이나 스타일만 다시 제안받을 수도 있고, 본문 전체의 흐름을 다시 논의할 수도 있다.

이 편집 방식의 첫 버전은 **레퍼런스 기반 슬라이드쇼에 구현되었다.** 레퍼런스 이미지는 읽기 전용으로 비교할 수 있고, AI가 복원할 수 없는 사진·배경은 비어 있는 이미지 슬롯으로 남겨 사용자가 교체한다. 현재 작업 문서와 레퍼런스 이미지는 로컬 서버 실행 중에만 유지된다. 편집기에 업로드한 이미지는 SQLite에 보존되지만, 작업 문서는 아직 재시작 후 복구할 수 없다. 이미지 생성·파일 내보내기·영상 편집도 아직 지원하지 않는다. 이후 템플릿 기반·처음부터 생성 방식은 편집기를 초기화하는 방법만 달리한다. 영상은 같은 슬라이드·Element 구분을 출발점으로 삼되 시간, 전환, 오디오를 표현하는 편집 기능이 추가로 필요하다.

## Product requirements

- Product context is registered once and reused across content jobs.
- A creation job selects a media type and one of three creation methods.
- The implemented reference-based slideshow flow accepts uploaded images, not links.
- Template-based creation selects a content structure, separate from visual design.
- From-scratch creation accepts optional ideas and production direction.
- Later stages will support proposals, user choices, conversational revision, recovery, preview, and export.

## Technical architecture

```text
Browser: production UI, previews, and conversation
    ↕
Next.js server: route handlers, local data, and agent requests
    ↕                         ↕
In-memory jobs/temp references + SQLite image assets  Codex app-server
                            agent work and tools
```

| Area | Direction |
| --- | --- |
| Web framework | Next.js App Router and TypeScript |
| Runtime | Personal local execution; the server can access local files and Codex |
| AI connection | ChatGPT-authenticated local Codex through `codex app-server` |
| Database | SQLite stores editor image bytes, metadata, and character records; jobs remain in memory and reference uploads remain temporary |
| Workflow | JSON editor document, validated edit commands, and one reusable Codex thread per job |
| UI | shadcn components with Tailwind CSS |

### Local image storage

SQLite stores the original image bytes (`BLOB`) and the image's name, description, type, size, and optional character link in the same database. Character records, reference images, and published-post records share the database. The dashboard can add and delete these records; AI auto-selection from the asset library is not implemented yet. Image listing queries exclude the binary column, and previews fetch bytes by asset ID only when displayed.

The default database location is `content-studio.sqlite` beside the repository, in the parent `content-studio-workspace/` directory. The repository itself remains a separate Git root, so the database is not tracked by that repository. Set `CONTENT_STUDIO_DB_PATH` to use a different path. SQLite uses WAL sidecar files while the server runs, so back up a live database with SQLite's backup mechanism rather than copying only the main file. The database is created lazily when an editor image is first uploaded. Existing images in temporary job folders are not migrated automatically.

## Local Codex connection

Install and authenticate the Codex CLI before starting the Next.js server:

```bash
codex login
pnpm dev
```

The server starts `codex app-server` through a Node.js child process during Next.js startup. The process communicates over JSON lines through standard input and output. The sidebar receives connection changes through an SSE stream instead of polling repeatedly. The connection status checks the ChatGPT-managed account and does not send a model-generation request.

The `dev` and `start` scripts bind Next.js to `127.0.0.1` because the local API can start and stop the Codex child process. Keep that loopback binding when changing how the application is launched; the API's Host and Origin checks are additional browser-request validation, not a network access boundary.

The repository configuration for CodeRabbit lives in `.coderabbit.yaml`. It sets English reviews, a balanced review profile, automatic review for non-draft pull requests, and path-specific guidance for the Next.js screens and Codex process lifecycle.

## Source layout

```text
src/
  app/                       routes and server handlers
  screens/dashboard/
    dashboard-screen.tsx    dashboard composition
    components/              dashboard-specific UI and forms
    hooks/                   dashboard-specific hooks
  components/ui/             shared UI primitives
  hooks/                     shared hooks
  lib/codex/                 Codex process and connection management
  lib/content-jobs/editor/   JSON document, validation, edit commands, AI workflow
  lib/local-db/              SQLite schema, images, and characters
  screens/editor/            slide preview, chat, and Element inspector
public/                      static files
```

Application code lives in `src/`. Screen-specific UI stays under `src/screens/`; shared components belong under `src/components/`. Project configuration, `.env.*` files, and `public/` remain at the repository root. The `@/` import alias points to `src/`.

## Success criteria

The first production goal is to create four publishable pieces of content in one hour or less. The primary measures are time to a publishable result and the amount of manual revision required. Reach and engagement are not first-stage success metrics.

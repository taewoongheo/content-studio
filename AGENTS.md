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

## 레퍼런스 없는 콘텐츠 제작 요청

“콘텐츠 제작 시작해보자”, “콘텐츠 만들어줘”처럼 레퍼런스 없이 제작을 요청하면 다음 흐름으로 직접 진행한다. 사용자가 주제·템플릿을 지정하지 않았다는 이유만으로 주제나 참고 콘텐츠를 보내 달라고 묻고 작업을 끝내지 않는다.

1. `docs/content-guidelines.md`와 `docs/research-guidelines.md`를 읽고 리서치부터 시작한다. 주제를 지정했다면 그 주제에서, 지정하지 않았다면 운동·피트니스 범위에서 소재를 탐색하고 선택한다. 수집 요청의 상한과 선별 기준은 리서치 기준 문서를 따른다.
2. 주제에 맞는 내용과 전달 방식을 자유롭게 탐색한다. 기존 템플릿의 비교형·랭킹형·팁 설명형·루틴 목록형 등에 리서치 범위를 미리 제한하지 않는다.
3. 선택한 소재와 정보 흐름에 가장 적합한 `composition`을 가진 템플릿을 `list_template_guides`의 메타데이터로 선택한다. 현재 원본의 주제가 아니라 핵심 시각적 특징과 적합한 정보 형식·분량, 필요한 페이지 흐름을 기준으로 판단한다. 탐색한 형식과 완전히 일치할 필요는 없으며, 모두 잘 맞지 않더라도 그나마 적합한 템플릿 하나를 고른다.
4. 선택한 등록 템플릿을 `clone_project`로 복제해 새 프로젝트를 만들고 복제본을 읽는다. 복제는 기존 시각적 규칙을 출발점으로 삼기 위한 절차이며 원본 포맷에 내용을 억지로 맞추기 위한 절차가 아니다.
5. 복제본의 내용을 작성하고 주제와 전달 방식에 맞게 페이지 구성, 요소 추가·삭제와 배치를 직접 수정한다. 원본 템플릿은 변경하지 않는다. 콘텐츠 가이드에 따라 미리보기와 문구를 검토하고 저장한 결과를 확인한다.

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
| `read_project` | 작업 문서와 최신 revision·tabId 읽기 |
| `list_template_guides` | 등록된 템플릿의 구성 설명과 요약 메타데이터 조회 |
| `set_reuse_guide` | 프로젝트의 `composition` 저장 |
| `register_template`, `unregister_template` | 템플릿 등록·해제 |
| `clone_project` | 등록된 템플릿 프로젝트 복제 |
| `edit_project` | 편집 명령 배열을 한 묶음으로 적용 |
| `undo_project` | 직전 편집 묶음 되돌리기 |
| `preview_slide` | 기존 렌더러로 슬라이드 PNG 확인 |

- 템플릿 비교·선택은 `list_template_guides`의 메타데이터로 한다. 비교를 위해 후보의 전체 문서나 미리보기를 읽지 않는다. 선택한 원본을 `clone_project`로 복제한 뒤 복제본을 읽고 편집한다.
- `clone_project`는 등록된 `templateProjectId`가 필수다. 등록된 템플릿이 없으면 UI에서 원본을 지정하도록 사용자에게 안내한다. 생성 제한을 우회하려고 에이전트가 임의 등록하거나 원본을 수정하지 않는다.
- 템플릿은 기존 저장 프로젝트의 `is_template` 상태다. 등록 시 사본을 만들지 않으며 원본 변경은 이후 복제에 반영된다. 복제된 프로젝트는 독립적이고 자동으로 템플릿이 되지 않는다. 해제는 원본을 삭제하지 않는다.
- `composition`은 최대 2000자의 단일 설명이다. 등록·복제에는 비어 있지 않은 설명이 필요하다. 등록 시 설명을 함께 저장할 수 있고, 설명 변경은 등록 상태를 변경하지 않는다. 등록은 열린 미저장 본문을 자동 저장하지 않는다.
- 구성 설명을 작성·갱신할 때는 실제 문서의 핵심 시각적 특징과 적합한 정보 형식·분량을 연결해 설명한다. 상세 작성 요령은 아래를 따른다. 비교·선택 때의 메타데이터 경계와 작성 때의 문서 확인을 구분한다.
- `edit_project`와 `undo_project`에는 최신 읽기·쓰기 응답의 `expectedRevision`과 `expectedTabId`를 사용한다. 닫힌 작업이나 이전 탭 ID는 거부된다. 다시 연 작업은 다시 읽고 최신 값을 사용한다.
- 편집 명령 배열은 한 단계로 되돌린다. 실패한 묶음은 문서·revision·되돌리기 이력과 신규 이미지 등록을 복구한다. `clone_project`, `edit_project`, `undo_project`는 DB 저장 성공 후 성공을 반환한다.
- 읽기·열기·미리보기는 자동 저장하지 않는다. MCP 생성·복제·명시적 열기는 탭을 추가하며 브라우저 화면을 강제로 전환하지 않는다. 프로젝트 삭제·탭 닫기는 MCP로 제공하지 않는다.
- 에이전트는 앱 DB에 직접 쓰지 않는다. 저장과 편집은 앱 API/MCP를 사용한다.

### 템플릿 프로젝트의 ‘구성’ 작성 요령

‘구성’은 에이전트가 시각적 특성을 재사용할 템플릿을 선택할 때 읽는 설명입니다. **어떤 정보 형식·분량을 담기에 좋은지와 이를 뒷받침하는 핵심 시각적 특징**을 함께 작성합니다. 현재 게시글의 내용을 요약하거나 요소 배치를 세세하게 나열하는 대신, 다른 주제에도 적용할 수 있도록 2~4문장으로 간결하게 적습니다. 저장 한도는 2000자입니다.

- **적합한 사용 상황:** 여러 짧은 항목을 나열하는 리스트, 선택지를 함께 보여주는 비교, 하나의 메시지를 풀어내는 설명, 항목별 순위 공개 등 어떤 포맷에 유리한지 적습니다. ‘한 페이지에 4~5개 이상의 짧은 텍스트 항목’처럼 정보량이 선택에 도움이 된다면 함께 적습니다.
- **핵심 시각적 특징:** 번호가 붙은 목록, 이미지 중심의 카드 묶음, 큰 이미지와 짧은 설명 등 다른 템플릿과 구별되는 특징을 적습니다. 색상·폰트·좌표·세부 배치를 모두 열거할 필요는 없습니다.
- **페이지 흐름:** 전체 개요 뒤에 그룹별 상세가 이어지는지, 독립적인 팁이 반복되는지, 순위가 차례로 공개되는지처럼 적합성을 설명하는 데 필요한 흐름만 적습니다.

원본의 실제 구성과 요소 역할을 확인해 작성합니다. 적합한 정보량은 현재 레이아웃을 기준으로 한 활용 판단이며, 모든 문장 길이를 수용한다는 보장이나 고정된 필수 항목 수가 아닙니다. 템플릿을 선택할 때는 저장된 구성 설명과 요약 메타데이터를 사용합니다.

작성 틀은 다음처럼 사용할 수 있습니다. 항목별로 나눠 저장할 필요 없이 ‘구성’ 칸 하나에 작성합니다.

> [어떤 정보 형식·분량을 보여줄 때] 적합하다. [이를 뒷받침하는 핵심 시각적 특징]을 사용한다. [페이지 흐름 또는 특히 유용한 활용 상황]에 유용하다.

| 템플릿 | 구성 예시 |
| --- | --- |
| Build Muscle With a 5-Day PPLUL Split | 한 페이지에 4~5개 이상의 짧은 텍스트 항목을 리스트로 정리하고, 그룹이나 단계별로 나누어 보여줄 때 유용하다. 큰 제목과 가로로 나뉜 칸으로 전체 흐름을 먼저 보여주고, 본문에서는 회색 원형 번호가 붙은 목록과 큰 이미지를 결합한다. 항목마다 짧은 수치나 조건을 함께 표시하기 좋으며, 전체 개요 뒤에 그룹별 상세 목록이 이어지는 포맷에 적합하다. |
| Build a Bigger Chest | 그룹별로 여러 선택지를 한눈에 보여주고 그중 하나를 고르게 하는 포맷에 적합하다. 이미지와 짧은 이름을 묶은 카드 세 개를 한 페이지에 모아 배치하고, 그룹 제목과 보조 이미지를 더해 선택지의 관계를 보여준다. 긴 설명보다 이미지 중심의 대안 비교나 카테고리별 선택 가이드를 만들 때 유용하다. |
| 9 Muscle-Building Lessons I Wish I Knew | 독립적인 팁이나 핵심 사항을 한 페이지에 하나씩, 짧은 설명 두 덩어리로 풀어낼 때 적합하다. 큰 번호와 제목으로 주제를 구분하고, 여백을 둔 설명과 큰 이미지를 결합한 구성을 반복한다. 여러 항목을 빽빽하게 나열하기보다 한 가지 메시지와 그 이유·보충 설명을 차례로 전달하는 포맷에 유용하다. |
| Biceps Exercise Tier List | 여러 항목의 순위와 짧은 평가를 한 페이지에 하나씩 공개하는 랭킹 포맷에 적합하다. 중앙 정렬된 큰 순위·항목명과 짧은 평가 문구, 화면에서 큰 비중을 차지하는 이미지로 항목 하나에 시선을 모은다. 낮은 순위부터 상위 순위로 이어지는 구성을 활용해, 각 항목의 평가 이유를 간결하게 설명하며 넘겨보게 할 때 유용하다. |

‘가슴 운동에 적합하다’처럼 현재 주제에만 묶인 설명보다 ‘이미지 중심의 여러 선택지를 함께 보여주고 하나를 고르게 할 때 적합하다’처럼 형식의 적합성을 설명합니다. 실제 제목·본문 문구를 작성하거나 ‘운동명과 세트·횟수가 필요하다’처럼 특정 내용을 요구하는 지침으로 만들지 않습니다. ‘이미지가 아래에 있다’ 같은 배치 사실만 적기보다, 그 구성이 어떤 정보 전달에 유리한지 연결합니다.

주제·문구·이미지만 바뀌면 기존 설명을 유지합니다. 핵심 시각적 특징, 정보량, 페이지 흐름이 달라져 적합한 포맷이 바뀌면 구성을 갱신합니다.


## 이미지와 텍스트 편집

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
- 지원 목록의 원문은 `src/lib/content-jobs/editor/typography/fonts.ts`, 실제 로딩은 `src/app/layout.tsx`에서 확인한다.

## 저장 데이터와 구현 경계

- SQLite 기본 위치는 `/Users/taewoongheo/Projects/content-studio-workspace/content-studio.sqlite`로 고정한다. 실행 폴더·브랜치·포트에 따라 경로를 바꾸거나 새 DB를 만들지 않는다. 검증용 DB는 `CONTENT_STUDIO_DB_PATH`의 절대 경로로만 분리한다.
- 리서치 로그인 상태·Python 환경·모델도 `/Users/taewoongheo/Projects/content-studio-workspace/.content-studio-research`를 공유한다. `CONTENT_STUDIO_RESEARCH_RUNTIME_DIR`을 설정한다면 절대 경로를 사용한다.
- 프로젝트 문서와 사용 이미지 바이트·메타데이터를 프로젝트별로 저장한다. 사용 이미지는 `content_project_assets`에서 관리한다. 외부 파일 이동·삭제는 저장된 프로젝트에 영향을 주지 않는다.
- 복제는 문서와 이미지 사본을 함께 복제하고, 프로젝트 삭제는 해당 프로젝트의 이미지 사본도 삭제한다. 공용 이미지·캐릭터 라이브러리를 전제로 구현하지 않는다.
- 편집 중 문서·이미지·되돌리기 이력은 서버 메모리에 유지한다. API와 MCP가 같은 작업 레지스트리와 저장 로직을 사용한다.
- `content_projects`에 `composition`·`is_template` 등 요구 컬럼이 없는 구형 DB는 쓰기 전에 오류로 중단한다. 자동 DB 마이그레이션이 있다고 가정하거나 에이전트가 직접 스키마를 바꾸지 않는다.
- MCP 등록은 `src/lib/mcp/server.ts`, 프로젝트 도구는 `src/lib/mcp/tools/projects.ts`, 리서치 등록은 `src/lib/mcp/research/tools.ts`, 조회·검색·이미지는 `research/tools/gather`, 작업 상태·브라우저·종료는 `research/tools/control`에서 확인한다. UI → 명령 → 저장 경로를 추적해 실제 동작을 검증한다.

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

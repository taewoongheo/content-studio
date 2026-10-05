# 콘텐츠 리서치 MCP

콘텐츠에 활용할 소재와 설명 방식을 찾고 새로운 전달 방식을 실험하기 위해 실제 플랫폼의 게시물을 조사한다. 에이전트가 본문·슬라이드 이미지·반응 지표를 수집하고 직접 확인할 수 있도록 MCP 도구를 제공한다.

## 설치

앱은 Node.js로 실행한다. YouTube.js와 Playwright는 `pnpm install`로 설치하며, Instagram에만 별도 Python 프로세스를 사용한다. 오픈소스 저장소 전체를 복사하지 않고 버전을 지정한 라이브러리와 필요한 어댑터를 사용한다.

```sh
pnpm install
pnpm exec playwright install chromium
pnpm setup:research
```

`setup:research`에는 시스템의 Python 3와 pip/venv가 필요하다. 전역 Python 패키지를 변경하지 않고 워크스페이스의 `.content-studio-research/python`에 Instaloader 4.15.3을 설치한다. 이 디렉터리는 앱 소스 폴더의 상위에 위치한다. 별도 Python 서버를 실행할 필요는 없다. MCP 요청 시 Node가 JSON 입력으로 워커를 실행한다.

슬라이더·회전 CAPTCHA 인식 엔진은 선택 설치다.

```sh
pnpm setup:captcha
```

[captcha-bypass](https://github.com/Hiram-Wong/captcha-bypass)의 v1.1.1 플랫폼별 실행 파일과 모델을 다운로드하고, 저장된 SHA-256과 비교한다. 실행 파일과 모델은 `.content-studio-research/captcha`에 둔다. 유료 CAPTCHA 서비스나 API 키를 사용하지 않는다. 이 엔진은 모든 CAPTCHA를 지원하거나 플랫폼 접근을 보장하지 않는다.

설치 위치를 바꾸려면 설치 명령과 앱 실행에 동일한 `CONTENT_STUDIO_RESEARCH_RUNTIME_DIR`을 지정한다. 기존 실행 환경을 사용하려면 `CONTENT_STUDIO_RESEARCH_PYTHON`으로 Python 실행 파일, `CONTENT_STUDIO_CAPTCHA_EXECUTABLE`로 CAPTCHA 실행 파일의 절대 경로를 지정한다. CAPTCHA 모델은 실행 파일과 함께 설치되어 있어야 한다. 설치용 Python 명령은 `CONTENT_STUDIO_PYTHON_BOOTSTRAP`으로 변경할 수 있다.

이 기능은 로컬 단일 서버 프로세스용이다. 빌드 산출물만 다른 컴퓨터에 복사하는 배포는 지원하지 않는다. 해당 컴퓨터에도 런타임 설치와 `workers/instagram/collector.py`를 포함한 앱 체크아웃이 필요하다.

## 도구

| MCP | 역할 |
| --- | --- |
| `list_account_posts` | 지정 계정의 게시물을 제한된 수만큼 수집. 기본 10개, 최대 30개. YouTube는 커뮤니티 게시물 |
| `read_social_post` | 지정 게시물의 본문·미디어·공개 반응 수 수집 |
| `get_collection_job` | 작업 상태, 결과, 조건 판정, 실패 원인 조회 |
| `read_post_images` | 완료된 작업에서 선택한 이미지들을 MCP 이미지로 반환. 호출당 최대 3장 |
| `open_collection_browser` | 기존 TikTok 수집 브라우저를 앞으로 가져오고 스크린샷 반환 |
| `solve_collection_captcha` | CAPTCHA가 확인된 TikTok 작업에서 로컬 인식 엔진과 마우스로 해결 시도 |
| `resume_collection` | 원래 세션에서 실패 작업 재시도. 작업당 총 3회 제한 |
| `close_collection_session` | 작업 취소, 전용 브라우저 종료, 임시 결과·커서 제거 |

수집 요청은 `jobId`와 `sessionId`를 바로 반환한다. `get_collection_job`으로 `running`, `complete`, `blocked` 상태를 확인한다. 완료 결과는 게시물의 `id`, `text`, `format`, `media`, `metrics`, `criteriaEvaluation`을 포함한다. 이미지 안의 문장은 자동 OCR하지 않으며 에이전트가 `read_post_images`로 확인한다. 이미지는 응답용으로 크기 제한 후 반환하고 프로젝트에 자동 등록하지 않는다.

일반적인 게시물 요청 예시:

```json
{
  "url": "https://www.tiktok.com/@account/photo/1234567890123456789",
  "criteria": { "format": "slideshow", "minViews": 100000 }
}
```

계정 요청은 `accountUrl`과 `limit`을 사용한다. YouTube의 `nextCursor`를 사용할 때는 동일한 `accountUrl`과 `sessionId`를 전달한다. 개별 YouTube 게시물은 출처 채널의 `channelUrl`도 필요하다. 단축 URL 대신 정규 플랫폼 URL을 사용한다.

## 기준과 수치

선별 기준의 원문은 [리서치 기준](research-guidelines.md)에 있다. 에이전트가 그 기준과 이번 사용자 요청을 읽고 조건을 `criteria`에 명시한다. 앱은 전달된 조건을 판정하며 기본값 100k를 모든 요청에 자동 주입하지 않는다. 주제 관련성은 에이전트가 본문과 이미지를 읽고 판단한다.

- `passed`: 전달한 모든 조건이 확인되고 충족됨.
- `failed`: 확인된 값이나 형식이 조건에 맞지 않음.
- `unverified`: 확인 가능한 조건에는 실패가 없지만 필요한 수치를 원본에서 제공하지 않음.

`viewCount`, `likeCount`, `saveCount`, `commentCount`, `shareCount` 중 없는 값은 `null`이다. 0과 구분하며 다른 반응 수로 조회수를 추정하지 않는다. YouTube의 축약 반응 수는 숫자와 `metricsAsDisplayed` 원본 표시를 함께 반환한다. 반응 수는 수집 시점의 값이며, 내용의 사실성을 증명하지 않는다. 조회수가 없는 후보는 100k 조건의 적격 후보로 확정할 수 없다.

## 플랫폼별 범위와 복구

| 플랫폼 | 수집 방식 | 제한 |
| --- | --- | --- |
| Instagram | Instaloader의 비로그인 게시물·프로필 조회 | 공개 게시물의 이미지·캐러셀을 수집할 수 있어도 계정 목록은 401 등으로 막힐 수 있음. 계정 페이지네이션 미지원 |
| TikTok | 전용 Chromium의 공식 임베드 플레이어, 공개 프로필·creator embed | 직접 게시물과 익명 계정 목록의 접근 가능성이 다름. 계정 목록은 제한된 최근 표본이며 페이지네이션 미지원 |
| YouTube | YouTube.js의 InnerTube 커뮤니티 피드 | 채널 게시물 페이지네이션 지원. 조회수·저장·공유 수 등은 공개되지 않을 수 있음 |

위 방식은 비공식 수집 인터페이스와 공개 페이지 구조 변경에 영향을 받는다. 성공한 게시물의 경우에도 모든 반응 지표가 공개되는 것은 아니다. 로그인이나 프록시 서비스는 자동 사용하지 않는다.

`blocked.block.reason`은 `captcha_required`, `login_required`, `rate_limited`, `access_denied`, `empty_response`, `unsupported`, `setup_required`, `timeout`, `not_found`, `source_error` 등을 구분한다. HTTP 401·403이나 빈 응답만으로 CAPTCHA라고 판단하지 않는다.

TikTok은 처음부터 전용 브라우저를 유지한다. CAPTCHA가 확인되면 에이전트가 로컬 해결 도구 또는 `open_collection_browser` 후 computer use를 선택한다. 같은 창을 조작해야 수집 세션에 반영된다. 해결 도구의 `challenge_cleared`는 화면에서 CAPTCHA가 사라졌다는 뜻이며, `resume_collection`의 데이터 수집 성공으로 실제 복구를 확인한다. 컨트롤·원본 이미지가 인식되지 않거나 모델이 없으면 명시적으로 실패 상태를 반환한다. 실제 TikTok CAPTCHA의 해결 성공률은 아직 검증하지 않았다.

Instagram Python HTTP 세션과 YouTube InnerTube 세션은 브라우저로 넘길 수 없다. 새 브라우저에서 화면을 열었다고 이 세션의 접근 문제가 해결되지는 않는다. 이 두 플랫폼은 현재 실패 원인을 반환하고 같은 엔진으로 재시도한다.

결과와 커서는 서버 메모리에만 보관하며 재시작, 명시적 세션 종료 또는 30분 비활성 후 제거한다. 최대 64개 작업, 최대 3개 TikTok 브라우저를 유지한다. 조사 후 `close_collection_session`을 호출한다. 사용자의 브라우저 프로필이나 Content Studio 프로젝트 탭은 이 세션과 별개다.

## 검증

```sh
pnpm test
pnpm lint
pnpm build
pnpm test:mcp --production
pnpm test:research
```

`test:research`는 설치 완료와 프로덕션 빌드가 필요하다. 임시 DB·포트로 앱을 실행하고 실제 HTTP MCP로 Instagram/TikTok/YouTube 게시물 및 마지막 슬라이드 이미지, YouTube 계정 페이지네이션, TikTok 브라우저 인계, 로컬 엔진의 합성 슬라이더 해결을 검증한다. 익명 Instagram/TikTok 계정 목록의 접근 결과도 출력한다. 네트워크·게시물 변경·플랫폼 차단에 따라 실패할 수 있으며, 이 검증은 실제 플랫폼 CAPTCHA 해결의 증거가 아니다.

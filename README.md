# Content Studio

Content Studio is a local-first workspace for producing publishable content from a product context and references. It reduces the need to repeat product details, describe visual direction from scratch, and rebuild generated results manually.

## Roadmap

| Stage | Goal | Scope |
| --- | --- | --- |
| **1 — Production MVP** | Complete one piece of content quickly | Slideshow, video, text, three creation methods, product context, proposals and choices, conversational AI editing, save and recovery, export |
| **2 — Repeatable operations** | Reuse validated workflows across content and accounts | Reusable formats, multiple content jobs, account-level content management and distribution |
| **3 — Automated decisions** | Reduce the work required to decide what to make | Relevant content and format discovery, topic and format recommendations, and feedback into later decisions |

Stage one includes slideshow, video, and text content with reference-based, template-based, and from-scratch creation. The three content types are media types; references and templates define the format. Their inputs and production steps can differ.

## Current product flow

```text
Select product context
→ Choose content type and creation method
→ Enter references, template, or direct production requirements
→ Propose and choose a topic
→ Propose and choose a hook
→ Propose the body structure and copy
→ Gather images and produce the visual result
→ Review and revise with AI conversation
→ Export
```

The current UI implements the product context form, the content creation input form, and local Codex connection status. AI generation, proposals, editing, persistence of content jobs, and export are planned next.

## Product requirements

- Product context is registered once and reused across content jobs.
- A creation job selects a media type and one of three creation methods.
- Reference-based creation accepts links and media appropriate to the selected type.
- Template-based creation selects a content structure, separate from visual design.
- From-scratch creation accepts optional ideas and production direction.
- Later stages will support proposals, user choices, conversational revision, recovery, preview, and export.

## Technical architecture

```text
Browser: production UI, previews, and conversation
    ↕
Next.js server: route handlers, local data, and agent requests
    ↕                         ↕
Local database/files       Codex app-server
                            agent work and tools
```

| Area | Direction |
| --- | --- |
| Web framework | Next.js App Router and TypeScript |
| Runtime | Personal local execution; the server can access local files and Codex |
| AI connection | ChatGPT-authenticated local Codex through `codex app-server` |
| Database | Local database; SQLite remains the current candidate |
| Workflow | Explicit stage functions and saved state; no LangGraph in the core flow |
| UI | shadcn components with Tailwind CSS |

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
public/                      static files
```

Application code lives in `src/`. Screen-specific UI stays under `src/screens/`; shared components belong under `src/components/`. Project configuration, `.env.*` files, and `public/` remain at the repository root. The `@/` import alias points to `src/`.

## Success criteria

The first production goal is to create four publishable pieces of content in one hour or less. The primary measures are time to a publishable result and the amount of manual revision required. Reach and engagement are not first-stage success metrics.

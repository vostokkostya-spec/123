# Project task register

**Updated:** 2026-09-14 12:47 MSK  
**Source of truth:** this file, `docs/PROJECT-KNOWLEDGE.md`, GitHub Issues/PRs, and the repository test suite.

This register consolidates the tasks found in the repository history, merged pull requests, GitHub issue list, and the local session task register. No `.vscode/tasks.json`, Codex export, private chat transcript, Chrome tab export, or external task database was present in the workspace, so those sources could not be imported.

## Now

| ID | Status | Task | Acceptance criteria |
|---|---|---|---|
| `long-file-chunking` | IN PROGRESS | Replace coder beginning-only truncation with bounded head/tail or chunked context. | Long input preserves useful context from both file ends; truncation metadata remains visible; tests cover short and long files. |

## Next

| ID | Status | Task | Acceptance criteria |
|---|---|---|---|
| `structured-router-output` | PENDING | Use Ollama JSON Schema output for router classification. | Valid schema is sent with the request; response is parsed and validated; malformed JSON falls back to the shared keyword selector. |
| `reviewer-apply-gate` | PENDING | Block `code --apply` when reviewer returns `ISSUES`. | No write occurs on `ISSUES`; an explicit safe message is printed; approve and offline behavior are tested. |
| `persistent-task-memory` | PENDING | Design bounded task history and memory. | Retention, redaction, storage location, and opt-out are documented before implementation. |
| `multi-file-proposals` | PENDING | Extend coder proposals to multiple files. | Paths stay inside workspace; each file has a diff; review and confirmation cover the complete proposal. |

## External / product backlog

| ID | Status | Source | Task |
|---|---|---|---|
| `github-issue-1` | OPEN | GitHub Issue #1 | Original orchestration feature; keep open until the project owner closes it. |
| `agent-evaluation` | DEFERRED | Audit decision | Evaluate third-party agents only for a concrete use case, from pinned and auditable sources. |
| `private-context-import` | BLOCKED | Scope limitation | Import VS Code/Codex conversations, Chrome pages, personal databases, or external disks only after the user supplies explicit exports or exact paths. |

## Completed

- Initial Node.js orchestration scaffold.
- Ollama status, safe model selection, embedding exclusion, and timeout handling.
- Ollama-backed planner, coder, and reviewer.
- Safe coder diff flow with interactive `--apply` confirmation.
- Reviewer fail-safe verdict (`ISSUES` when marker is missing).
- Hybrid keyword + LLM routing with `temperature=0`.
- Shared keyword selector for fast path and offline fallback.
- Routing regression coverage: 18/18 tests passing.
- PR #5 merged as `00e2e8d`.

## VS Code shortcuts

Run these from the integrated terminal:

```powershell
npm test
node src/index.js ollama-status
node src/index.js route "Fix the login bug"
node src/index.js route "How should we organize the project release?" --llm
node src/index.js code "Add input validation" --file src/example.js
```

## Research and installation policy

The audit checked public GitHub, Ollama, VS Code, and Agent Reach documentation. No additional agent, model, application, browser extension, or global package was installed. Installation requires a named use case, a pinned/auditable source, a defined data boundary, and a rollback path.
